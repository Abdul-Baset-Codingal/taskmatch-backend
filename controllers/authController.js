
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createNotification } from "./notificationHelper.js";
import emailjs from "@emailjs/nodejs";
import crypto from "crypto";
import PasswordReset from "../models/PasswordReset.js"
import User from "../models/user.js";
import { logAuth, logActivity } from "../utils/activityLogger.js";

const app = express();

app.use(cookieParser());
const isProduction = process.env.NODE_ENV === "production";

// EmailJS Configuration (use environment variables)
const EMAILJS_SERVICE_ID = process.env.EMAILJS_SERVICE_ID;
const EMAILJS_TEMPLATE_ID = process.env.EMAILJS_TEMPLATE_ID;
const EMAILJS_PUBLIC_KEY = process.env.EMAILJS_PUBLIC_KEY;
const EMAILJS_PRIVATE_KEY = process.env.EMAILJS_PRIVATE_KEY;
const EMAILJS_RESET_TEMPLATE_ID = process.env.EMAILJS_RESET_TEMPLATE_ID;

// Initialize EmailJS ONCE for server-side usage (critical fix)
emailjs.init({
    publicKey: EMAILJS_PUBLIC_KEY,
    privateKey: EMAILJS_PRIVATE_KEY,
});

// In-memory OTP storage (use Redis or DB for production)
const otps = new Map(); // email -> {otp, expires}
const resetTokens = new Map();


const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

const tokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const statusCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

// New endpoint: Send OTP
export const sendOtp = async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ message: "Email required" });
    }

    // ✅ Normalize email - THIS IS THE FIX
    const cleanEmail = email.toLowerCase().trim();

    const otp = crypto.randomInt(100000, 999999).toString();
    const expires = Date.now() + 15 * 60 * 1000; // 15 mins

    // ✅ Store with normalized email
    otps.set(cleanEmail, { otp, expires });

    console.log("📧 OTP generated for:", cleanEmail);
    console.log("🔑 OTP:", otp); // Debug log

    const expiryDate = new Date(expires);
    const formattedTime = expiryDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
    });
    const formattedDate = expiryDate.toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
    });
    const timeString = `${formattedTime} on ${formattedDate}`;

    const templateParams = {
        email: cleanEmail,        // ✅ Use normalized email
        passcode: otp,
        time: timeString,
    };

    try {
        const response = await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_TEMPLATE_ID,
            templateParams
        );
        console.log("✅ Email sent successfully:", response);
        res.status(200).json({ message: "OTP sent" });
    } catch (err) {
        console.error("❌ Failed to send email:", err);
        res.status(500).json({ message: err.text || "Failed to send OTP" });
    }
};


// reset password

export const forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        console.log("📧 Forgot password request for:", email);

        if (!email || email.trim() === "") {
            return res.status(400).json({ message: "Email is required" });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Find user
        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            console.log("❌ User not found:", cleanEmail);
            return res.status(200).json({
                message: "If an account exists, you will receive a reset code"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account has been blocked."
            });
        }

        // Generate 6-digit OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        // ⭐ DELETE old requests and CREATE new one in MongoDB
        await PasswordReset.deleteMany({ email: cleanEmail });

        const resetRequest = await PasswordReset.create({
            email: cleanEmail,
            otp: otp,
            expires: expires,
            attempts: 0
        });

        console.log("✅ OTP stored in MongoDB:", resetRequest._id);
        console.log("✅ OTP:", otp);

        // Format expiry time for email
        const formattedTime = expires.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        const formattedDate = expires.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
        });
        const timeString = `${formattedTime} on ${formattedDate}`;

        // Send email via EmailJS
        const templateParams = {
            to_email: cleanEmail,
            to_name: user.firstName || "User",
            passcode: otp,
            time: timeString,
        };

        console.log("📤 Sending email with params:", templateParams);

        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_RESET_TEMPLATE_ID,
            templateParams
        );

        console.log("✅ Email sent successfully to:", cleanEmail);

        res.status(200).json({
            message: "Reset code sent to your email",
            success: true
        });

    } catch (err) {
        console.error("❌ Forgot password error:", err);
        res.status(500).json({ message: "Failed to send reset code. Please try again." });
    }
};


// ========================================
// VERIFY RESET OTP
// ========================================
export const verifyResetOtp = async (req, res) => {
    try {
        const { email, otp } = req.body;

        console.log("🔍 Verify OTP request - Email:", email, "OTP:", otp);

        if (!email || !otp) {
            return res.status(400).json({ message: "Email and OTP are required" });
        }

        const cleanEmail = email.toLowerCase().trim();

        // ⭐ Find in MongoDB
        const resetRequest = await PasswordReset.findOne({ email: cleanEmail });

        console.log("🔍 Found in MongoDB:", !!resetRequest);

        if (!resetRequest) {
            return res.status(400).json({
                message: "No reset request found. Please request a new code."
            });
        }

        // Check attempts
        if (resetRequest.attempts >= 5) {
            await PasswordReset.deleteOne({ _id: resetRequest._id });
            return res.status(400).json({
                message: "Too many failed attempts. Please request a new code."
            });
        }

        // Check expiry
        if (new Date() > new Date(resetRequest.expires)) {
            await PasswordReset.deleteOne({ _id: resetRequest._id });
            return res.status(400).json({
                message: "Code has expired. Please request a new one."
            });
        }

        // Verify OTP
        if (resetRequest.otp !== otp) {
            resetRequest.attempts += 1;
            await resetRequest.save();
            console.log("❌ Invalid OTP. Attempts:", resetRequest.attempts);
            return res.status(400).json({
                message: `Invalid code. ${5 - resetRequest.attempts} attempts remaining.`
            });
        }

        // ✅ OTP is valid - Generate reset token
        const resetToken = crypto.randomBytes(32).toString("hex");

        resetRequest.resetToken = resetToken;
        resetRequest.tokenExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        resetRequest.otpVerified = true;
        await resetRequest.save();

        console.log("✅ OTP verified! Reset token generated.");

        res.status(200).json({
            message: "OTP verified successfully",
            resetToken: resetToken,
            success: true
        });

    } catch (err) {
        console.error("❌ Verify OTP error:", err);
        res.status(500).json({ message: "Verification failed. Please try again." });
    }
};


// ========================================
// RESET PASSWORD
// ========================================
export const resetPassword = async (req, res) => {
    try {
        const { email, otp, newPassword, confirmPassword, resetToken } = req.body;

        console.log("🔐 Reset password request for:", email);

        // Validate inputs
        if (!email || !newPassword || !confirmPassword) {
            return res.status(400).json({ message: "All fields are required" });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({ message: "Passwords do not match" });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({
                message: "Password must be at least 8 characters long"
            });
        }

        const cleanEmail = email.toLowerCase().trim();

        // ⭐ Find in MongoDB
        const resetRequest = await PasswordReset.findOne({ email: cleanEmail });

        console.log("🔍 Found reset request in MongoDB:", !!resetRequest);

        if (!resetRequest) {
            return res.status(400).json({
                message: "No reset request found. Please request a new code."
            });
        }

        // Verify authorization (either resetToken or OTP)
        let isValid = false;

        // Method 1: Reset Token verification
        if (resetToken && resetRequest.resetToken) {
            const tokenMatch = resetRequest.resetToken === resetToken;
            const tokenNotExpired = new Date() <= new Date(resetRequest.tokenExpires);
            console.log("🔍 Token match:", tokenMatch, "Not expired:", tokenNotExpired);

            if (tokenMatch && tokenNotExpired) {
                isValid = true;
            }
        }

        // Method 2: Direct OTP verification
        if (!isValid && otp) {
            const otpMatch = resetRequest.otp === otp;
            const otpNotExpired = new Date() <= new Date(resetRequest.expires);
            console.log("🔍 OTP match:", otpMatch, "Not expired:", otpNotExpired);

            if (otpMatch && otpNotExpired) {
                isValid = true;
            }
        }

        if (!isValid) {
            return res.status(400).json({
                message: "Invalid or expired reset code. Please request a new one."
            });
        }

        console.log("✅ Authorization verified");

        // Find user
        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            return res.status(400).json({ message: "User not found" });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account has been blocked."
            });
        }

        // Check if new password is same as old
        const isSamePassword = await bcrypt.compare(newPassword, user.password);
        if (isSamePassword) {
            return res.status(400).json({
                message: "New password cannot be the same as your current password"
            });
        }

        // Hash and update password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        user.password = hashedPassword;
        user.passwordChangedAt = new Date();
        await user.save();

        // ⭐ Delete reset request from MongoDB
        await PasswordReset.deleteOne({ _id: resetRequest._id });

        console.log("✅ Password reset successful for:", cleanEmail);

        res.status(200).json({
            message: "Password reset successful! You can now login with your new password.",
            success: true
        });

    } catch (err) {
        console.error("❌ Reset password error:", err);
        res.status(500).json({ message: "Password reset failed. Please try again." });
    }
};


// ========================================
// RESEND RESET OTP
// ========================================
export const resendResetOtp = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({ message: "Email is required" });
        }

        const cleanEmail = email.toLowerCase().trim();

        // Rate limiting check
        const existing = await PasswordReset.findOne({ email: cleanEmail });
        if (existing) {
            const timeSinceCreated = Date.now() - new Date(existing.createdAt).getTime();
            if (timeSinceCreated < 60000) {
                const waitTime = Math.ceil((60000 - timeSinceCreated) / 1000);
                return res.status(429).json({
                    message: `Please wait ${waitTime} seconds before requesting a new code`
                });
            }
        }

        const user = await User.findOne({ email: cleanEmail });

        if (!user) {
            return res.status(200).json({
                message: "If an account exists, you will receive a new code"
            });
        }

        if (user.isBlocked) {
            return res.status(403).json({
                message: "Your account has been blocked."
            });
        }

        // Generate new OTP
        const otp = crypto.randomInt(100000, 999999).toString();
        const expires = new Date(Date.now() + 15 * 60 * 1000);

        // Delete old and create new
        await PasswordReset.deleteMany({ email: cleanEmail });
        await PasswordReset.create({
            email: cleanEmail,
            otp: otp,
            expires: expires,
            attempts: 0
        });

        console.log("✅ New OTP generated:", otp);

        // Format time
        const formattedTime = expires.toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
        });
        const formattedDate = expires.toLocaleDateString("en-US", {
            month: "long",
            day: "2-digit",
            year: "numeric",
        });

        // Send email
        await emailjs.send(
            EMAILJS_SERVICE_ID,
            EMAILJS_RESET_TEMPLATE_ID,
            {
                to_email: cleanEmail,
                to_name: user.firstName || "User",
                passcode: otp,
                time: `${formattedTime} on ${formattedDate}`,
            }
        );

        console.log("✅ New OTP sent to:", cleanEmail);

        res.status(200).json({
            message: "A new code has been sent to your email",
            success: true
        });

    } catch (err) {
        console.error("❌ Resend OTP error:", err);
        res.status(500).json({ message: "Failed to resend code. Please try again." });
    }
};

// ----------------------------- reset password-------------------------------------






// export const signup = async (req, res) => {
//     try {
//         const {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password,
//             role,  // "client" or "tasker"
//             otp,   // Add OTP from request body
//             dob,
//             address: street,  // Renamed for clarity (assuming body has 'address' as street)
//             city,
//             province,
//             language,
//             about,
//             travelDistance,
//             idType,
//             passportUrl,
//             governmentIdFront,
//             governmentIdBack,
//             sin,
//             issueDate,
//             expiryDate,
//             serviceCategories: categories,  // Renamed
//             skills,
//             experienceYears: yearsOfExperience,
//             qualifications,
//             services,
//             certifications,
//             backgroundCheckConsent,
//             hasInsurance,
//             availability,
//             serviceAreas,
//             profilePicture,
//             accountHolder,
//             accountNumber,
//             routingNumber,
//         } = req.body;

//         console.log(req.body);

//         // Verify OTP first
//         const stored = otps.get(email);
//         if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
//             return res.status(400).json({ message: "Invalid or expired OTP" });
//         }
//         otps.delete(email); // Clear after use

//         if (!["client", "tasker"].includes(role)) {
//             return res.status(400).json({ message: "Invalid role type" });
//         }

//         // Check for existing email
//         const existingEmail = await User.findOne({ email });
//         if (existingEmail) {
//             return res.status(400).json({ message: "Email already exists" });
//         }

//         // Check for existing phone number
//         const existingPhone = await User.findOne({ phone });
//         if (existingPhone) {
//             return res.status(400).json({ message: "Phone number already exists" });
//         }

//         // Base user data
//         const userData = {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password, // Set plaintext password here; the pre-save hook will hash it
//             roles: role === "tasker" ? ["client", "tasker"] : ["client"],
//             currentRole: role,
//         };

//         if (role === "tasker") {
//             // Validate required tasker fields (uncomment if needed)
//             const requiredFields = {
//                 about: about,
//                 profilePicture: profilePicture,
//                 dob: dob,
//                 yearsOfExperience: yearsOfExperience,
//                 categories: categories,
//                 skills: skills,
//                 qualifications: qualifications,
//                 services: services,
//                 certifications: certifications,
//                 backgroundCheckConsent: backgroundCheckConsent,
//                 hasInsurance: hasInsurance,
//                 availability: availability,
//                 serviceAreas: serviceAreas,
//                 language: language,
//                 travelDistance: travelDistance,
//                 idType: idType,
//                 sin: sin,
//                 // Note: issueDate and expiryDate are optional but recommended
//                 passportUrl: passportUrl,  // Conditional on idType
//                 governmentIdFront: governmentIdFront,  // Conditional on idType
//                 governmentIdBack: governmentIdBack,  // Conditional on idType
//             };

//             // Set tasker fields
//             userData.dob = dob ? new Date(dob) : undefined;
//             userData.address = {
//                 street: street || "",
//                 city: city || "",
//                 province: province || "",
//                 postalCode,
//             };
//             userData.language = language;
//             userData.about = about;
//             userData.travelDistance = travelDistance;
//             userData.idType = idType;
//             userData.sin = sin;
//             userData.issueDate = issueDate ? new Date(issueDate) : undefined;
//             userData.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
//             userData.categories = categories;
//             userData.skills = skills;
//             userData.yearsOfExperience = yearsOfExperience;
//             userData.qualifications = qualifications;
//             userData.services = services;
//             userData.certifications = certifications;
//             userData.backgroundCheckConsent = backgroundCheckConsent;
//             userData.hasInsurance = hasInsurance;
//             userData.availability = availability;
//             userData.serviceAreas = serviceAreas;
//             userData.profilePicture = profilePicture;

//             // Set bank details (optional for taskers)
//             userData.accountHolder = accountHolder;
//             userData.accountNumber = accountNumber;
//             userData.routingNumber = routingNumber;
//         }

//         const user = await User.create(userData);

//         let message = "Signup successful";
//         let loginCookies = true;

//         let token = null;

//         if (role === "tasker") {
//             // For taskers, do not set login cookies; profile is under review by default
//             message = "Tasker profile submitted successfully. Your profile is under review and will be approved by admin soon. You can login once approved.";
//             loginCookies = false;
//         } else {
//             // For clients, set login cookies
//             token = createToken(user._id);
//             res.cookie("token", token, tokenCookieOptions);
//             res.cookie("isLoggedIn", "true", statusCookieOptions);
//         }

//         res.status(201).json({ message, user: { ...user.toObject(), password: undefined }, token });
//     } catch (err) {
//         res.status(500).json({ message: "Signup failed", error: err.message });
//     }
// };



// export const login = async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         console.log("emaill", email)
//         console.log("password", password)

//         const user = await User.findOne({ email });
//         console.log(user)
//         if (!user) return res.status(400).json({ message: "Invalid credentials" });

//         // 🚫 Check if the user is blocked
//         if (user.isBlocked) {
//             return res.status(403).json({ message: "Your account has been blocked by the admin." });
//         }

//         // 🚫 Check if the user is a tasker under review
//         // if (user.roles.includes("tasker") && !user.taskerProfileCheck) {
//         //     return res.status(403).json({ message: "Your tasker profile is under review. Please wait for admin approval." });
//         // }

//         console.log(password, "passworddddd")
//         console.log(user.password, "user passsss")
//         const match = await bcrypt.compare(password, user.password);
//         console.log(match)
//         if (!match) return res.status(400).json({ message: "Invalid credentials" });

//         const token = createToken(user._id);

//         res.cookie("token", token, tokenCookieOptions);
//         res.cookie("isLoggedIn", "true", statusCookieOptions);

//         res.status(200).json({ message: "Login successful", user, token });
//     } catch (err) {
//         res.status(500).json({ message: "Login failed", error: err.message });
//     }
// };




// export const logout = (req, res) => {
//     console.log("=== LOGOUT DEBUG START ===");
//     console.log("1. All cookies received:", req.cookies);
//     console.log("2. Token cookie exists:", !!req.cookies?.token);
//     console.log("3. isLoggedIn cookie exists:", !!req.cookies?.isLoggedIn);
//     console.log("4. Request headers:", req.headers);
//     console.log("5. Origin:", req.headers.origin);

//     const clearOptions = {
//         httpOnly: true,
//         secure: true,
//         sameSite: "none",
//         path: "/",
//     };

//     console.log("6. Clear options:", clearOptions);

//     res.clearCookie("token", clearOptions);
//     res.clearCookie("isLoggedIn", clearOptions);

//     // Also try setting expired cookies as backup
//     res.cookie("token", "", { ...clearOptions, maxAge: 0 });
//     res.cookie("isLoggedIn", "", { ...clearOptions, maxAge: 0 });

//     console.log("=== LOGOUT DEBUG END ===");

//     return res.status(200).json({
//         message: "Logout successful",
//         debug: {
//             cookiesReceived: Object.keys(req.cookies || {}),
//             clearedAt: new Date().toISOString()
//         }
//     });
// };



export const signup = async (req, res) => {
    const { email, role } = req.body;

    try {
        const {
            firstName,
            lastName,
            phone,
            postalCode,
            password,
            otp,
            dob,
            address: street,
            city,
            province,
            language,
            about,
            travelDistance,
            idType,
            passportUrl,
            governmentIdFront,
            governmentIdBack,
            sin,
            issueDate,
            expiryDate,
            serviceCategories: categories,
            skills,
            experienceYears: yearsOfExperience,
            qualifications,
            services,
            certifications,
            backgroundCheckConsent,
            hasInsurance,
            availability,
            serviceAreas,
            profilePicture,
            accountHolder,
            accountNumber,
            routingNumber,
        } = req.body;

        console.log(req.body);

        // Verify OTP first
        const stored = otps.get(email);
        if (!stored || stored.otp !== otp || Date.now() > stored.expires) {
            // Log failed signup - OTP issue
            await logAuth({
                action: "SIGNUP_FAILED",
                req,
                email,
                status: "failure",
                errorMessage: "Invalid or expired OTP",
                metadata: { role, attemptedEmail: email },
            });

            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        otps.delete(email);

        if (!["client", "tasker"].includes(role)) {
            // Log failed signup - Invalid role
            await logAuth({
                action: "SIGNUP_FAILED",
                req,
                email,
                status: "failure",
                errorMessage: "Invalid role type",
                metadata: { role, attemptedEmail: email },
            });

            return res.status(400).json({ message: "Invalid role type" });
        }

        // Check for existing email
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            // Log failed signup - Email exists
            await logAuth({
                action: "SIGNUP_FAILED",
                req,
                email,
                status: "failure",
                errorMessage: "Email already exists",
                metadata: { role },
            });

            return res.status(400).json({ message: "Email already exists" });
        }

        // Check for existing phone number
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            // Log failed signup - Phone exists
            await logAuth({
                action: "SIGNUP_FAILED",
                req,
                email,
                status: "failure",
                errorMessage: "Phone number already exists",
                metadata: { role, phone },
            });

            return res.status(400).json({ message: "Phone number already exists" });
        }

        // Base user data
        const userData = {
            firstName,
            lastName,
            email,
            phone,
            postalCode,
            password,
            roles: role === "tasker" ? ["client", "tasker"] : ["client"],
            currentRole: role,
        };

        if (role === "tasker") {
            // Set tasker fields
            userData.dob = dob ? new Date(dob) : undefined;
            userData.address = {
                street: street || "",
                city: city || "",
                province: province || "",
                postalCode,
            };
            userData.language = language;
            userData.about = about;
            userData.travelDistance = travelDistance;
            userData.idType = idType;
            userData.sin = sin;
            userData.issueDate = issueDate ? new Date(issueDate) : undefined;
            userData.expiryDate = expiryDate ? new Date(expiryDate) : undefined;
            userData.categories = categories;
            userData.skills = skills;
            userData.yearsOfExperience = yearsOfExperience;
            userData.qualifications = qualifications;
            userData.services = services;
            userData.certifications = certifications;
            userData.backgroundCheckConsent = backgroundCheckConsent;
            userData.hasInsurance = hasInsurance;
            userData.availability = availability;
            userData.serviceAreas = serviceAreas;
            userData.profilePicture = profilePicture;
            userData.accountHolder = accountHolder;
            userData.accountNumber = accountNumber;
            userData.routingNumber = routingNumber;
        }

        const user = await User.create(userData);

        // ✅ Log successful signup
        await logAuth({
            action: "SIGNUP",
            user,
            req,
            status: "success",
            metadata: {
                role: user.currentRole,
                phone: user.phone,
                postalCode: user.postalCode,
                registrationType: role === "tasker" ? "tasker_registration" : "client_registration",
                categories: role === "tasker" ? categories : undefined,
            },
        });

        let message = "Signup successful";
        let loginCookies = true;
        let token = null;

        if (role === "tasker") {
            message =
                "Tasker profile submitted successfully. Your profile is under review and will be approved by admin soon. You can login once approved.";
            loginCookies = false;
        } else {
            token = createToken(user._id);
            res.cookie("token", token, tokenCookieOptions);
            res.cookie("isLoggedIn", "true", statusCookieOptions);

            // ✅ Log auto-login for client
            await logAuth({
                action: "LOGIN",
                user,
                req,
                status: "success",
                metadata: {
                    loginType: "auto_after_signup",
                },
            });
        }

        res.status(201).json({
            message,
            user: { ...user.toObject(), password: undefined },
            token,
        });
    } catch (err) {
        // Log failed signup - Server error
        await logAuth({
            action: "SIGNUP_FAILED",
            req,
            email,
            status: "failure",
            errorMessage: err.message,
            metadata: { role },
        });

        res.status(500).json({ message: "Signup failed", error: err.message });
    }
};

export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        console.log("email", email);
        console.log("password", password);

        const user = await User.findOne({ email });
        console.log(user);

        if (!user) {
            // ✅ Log failed login - User not found
            await logAuth({
                action: "LOGIN_FAILED",
                req,
                email,
                status: "failure",
                errorMessage: "User not found",
            });

            return res.status(400).json({ message: "Invalid credentials" });
        }

        // 🚫 Check if the user is blocked
        if (user.isBlocked) {
            // ✅ Log failed login - Blocked user
            await logAuth({
                action: "LOGIN_FAILED",
                user,
                req,
                status: "failure",
                errorMessage: "Account blocked by admin",
            });

            return res.status(403).json({
                message: "Your account has been blocked by the admin.",
            });
        }

        console.log(password, "passworddddd");
        console.log(user.password, "user passsss");

        const match = await bcrypt.compare(password, user.password);
        console.log(match);

        if (!match) {
            // ✅ Log failed login - Wrong password
            await logAuth({
                action: "LOGIN_FAILED",
                user,
                req,
                status: "failure",
                errorMessage: "Invalid password",
            });

            return res.status(400).json({ message: "Invalid credentials" });
        }

        const token = createToken(user._id);

        res.cookie("token", token, tokenCookieOptions);
        res.cookie("isLoggedIn", "true", statusCookieOptions);

        // ✅ Log successful login
        await logAuth({
            action: "LOGIN",
            user,
            req,
            status: "success",
            metadata: {
                loginMethod: "email_password",
                currentRole: user.currentRole,
                roles: user.roles,
            },
        });

        res.status(200).json({ message: "Login successful", user, token });
    } catch (err) {
        // ✅ Log failed login - Server error
        await logAuth({
            action: "LOGIN_FAILED",
            req,
            email,
            status: "failure",
            errorMessage: err.message,
        });

        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

export const logout = async (req, res) => {
    console.log("=== LOGOUT DEBUG START ===");
    console.log("1. All cookies received:", req.cookies);
    console.log("2. Token cookie exists:", !!req.cookies?.token);
    console.log("3. isLoggedIn cookie exists:", !!req.cookies?.isLoggedIn);
    console.log("4. Request headers:", req.headers);
    console.log("5. Origin:", req.headers.origin);

    try {
        // Get user info before clearing cookies (if using auth middleware)
        const user = req.user || null; // Assuming you have auth middleware that sets req.user

        const clearOptions = {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
        };

        console.log("6. Clear options:", clearOptions);

        res.clearCookie("token", clearOptions);
        res.clearCookie("isLoggedIn", clearOptions);

        // Also try setting expired cookies as backup
        res.cookie("token", "", { ...clearOptions, maxAge: 0 });
        res.cookie("isLoggedIn", "", { ...clearOptions, maxAge: 0 });

        // ✅ Log successful logout
        if (user) {
            await logAuth({
                action: "LOGOUT",
                user,
                req,
                status: "success",
                metadata: {
                    logoutMethod: "manual",
                },
            });
        } else {
            // If no user in req, still log the logout attempt
            await logActivity({
                action: "LOGOUT",
                description: "User logged out (user details not available in request)",
                req,
                status: "success",
                module: "auth",
            });
        }

        console.log("=== LOGOUT DEBUG END ===");

        return res.status(200).json({
            message: "Logout successful",
            debug: {
                cookiesReceived: Object.keys(req.cookies || {}),
                clearedAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error("Logout error:", err);

        // Still try to clear cookies even if logging fails
        const clearOptions = {
            httpOnly: true,
            secure: true,
            sameSite: "none",
            path: "/",
        };
        res.clearCookie("token", clearOptions);
        res.clearCookie("isLoggedIn", clearOptions);

        return res.status(200).json({
            message: "Logout successful",
        });
    }
};



// Add this to your auth controller file
export const checkEmailExists = async (req, res) => {
    try {
        const { email } = req.query;

        if (!email) {
            return res.status(400).json({
                exists: false,
                message: "Email is required"
            });
        }

        // Basic email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                exists: false,
                valid: false,
                message: "Invalid email format"
            });
        }

        const existingUser = await User.findOne({
            email: email.toLowerCase().trim()
        });

        return res.status(200).json({
            exists: !!existingUser,
            valid: true,
            message: existingUser ? "Email already exists" : "Email is available"
        });
    } catch (err) {
        res.status(500).json({
            exists: false,
            message: "Error checking email",
            error: err.message
        });
    }
};

// Check if phone exists
export const checkPhoneExists = async (req, res) => {
    try {
        const { phone } = req.query;

        if (!phone) {
            return res.status(400).json({
                exists: false,
                message: "Phone number is required"
            });
        }

        // Clean the phone number (remove spaces, dashes, parentheses)
        const cleanedPhone = phone.replace(/[\s\-\(\)]/g, '');

        // Basic phone format validation (Canadian/US format: 10 digits or with +1 prefix)
        const phoneRegex = /^(\+1)?[0-9]{10}$/;
        if (!phoneRegex.test(cleanedPhone)) {
            return res.status(400).json({
                exists: false,
                valid: false,
                message: "Invalid phone number format"
            });
        }

        // Normalize phone number for database lookup
        // Store format: +1XXXXXXXXXX
        let normalizedPhone = cleanedPhone;
        if (!normalizedPhone.startsWith('+1')) {
            normalizedPhone = `+1${normalizedPhone}`;
        }

        // Also check without +1 prefix for legacy data
        const phoneVariations = [
            normalizedPhone,           // +1XXXXXXXXXX
            cleanedPhone,              // XXXXXXXXXX or +1XXXXXXXXXX
            cleanedPhone.replace(/^\+1/, ''), // XXXXXXXXXX (without +1)
        ];

        const existingUser = await User.findOne({
            phone: { $in: phoneVariations }
        });

        return res.status(200).json({
            exists: !!existingUser,
            valid: true,
            message: existingUser ? "Phone number already registered" : "Phone number is available"
        });
    } catch (err) {
        res.status(500).json({
            exists: false,
            message: "Error checking phone number",
            error: err.message
        });
    }
};


export const getAdminUsers = async (req, res) => {
    try {
        const {
            // Pagination
            page = 1,
            limit = 10,

            // Role filter: 'client', 'tasker', 'both', 'all'
            roleType = 'all',

            // Search
            search = '',

            // Status filters
            status = '',  // active, inactive, suspended, banned
            isBlocked = '',

            // Verification filters
            emailVerified = '',
            phoneVerified = '',
            identityVerified = '',

            // Tasker specific filters
            taskerStatus = '',  // not_applied, under_review, approved, rejected
            stripeConnectStatus = '',

            // Location filters
            city = '',
            province = '',
            country = '',

            // Marketplace stats filters
            minTotalSpent = '',
            maxTotalSpent = '',
            minTasksCompleted = '',
            maxTasksCompleted = '',
            minBookingsCompleted = '',
            maxBookingsCompleted = '',
            minTotalEarnings = '',
            maxTotalEarnings = '',

            // Rating filters
            minRating = '',
            maxRating = '',

            // Date filters
            createdFrom = '',
            createdTo = '',
            lastActiveFrom = '',
            lastActiveTo = '',

            // Sorting
            sortBy = 'createdAt',
            sortOrder = 'desc',

            // Category filter (for taskers)
            category = '',
        } = req.query;

        // Build query object
        const query = {};

        // ==================== ROLE TYPE FILTERING ====================
        switch (roleType) {
            case 'client':
                // Users who are ONLY clients (not taskers)
                query.roles = { $eq: ['client'] };
                break;
            case 'tasker':
                // Users who have tasker role (approved taskers only)
                query.roles = { $in: ['tasker'] };
                query.taskerStatus = 'approved';
                break;
            case 'both':
                // Users who have BOTH client and tasker roles
                query.roles = { $all: ['client', 'tasker'] };
                query.taskerStatus = 'approved';
                break;
            case 'pending':
                // Users with pending tasker verification
                query.taskerStatus = 'under_review';
                break;
            case 'all':
            default:
                // All users except admins (or include admins if needed)
                query.roles = { $nin: ['admin'] };
                break;
        }

        // ==================== SEARCH ====================
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { firstName: searchRegex },
                { lastName: searchRegex },
                { email: searchRegex },
                { phone: searchRegex },
                { 'address.city': searchRegex },
            ];
        }

        // ==================== STATUS FILTERS ====================
        if (status) {
            switch (status) {
                case 'active':
                    query.isBlocked = false;
                    query.isEmailVerified = true;
                    break;
                case 'inactive':
                    query.isBlocked = false;
                    query.isEmailVerified = false;
                    break;
                case 'suspended':
                    query.isBlocked = true;
                    // You might want to add a suspendedAt field to differentiate
                    break;
                case 'banned':
                    query.isBlocked = true;
                    // You might want to add a bannedAt field to differentiate
                    break;
            }
        }

        if (isBlocked !== '') {
            query.isBlocked = isBlocked === 'true';
        }

        // ==================== VERIFICATION FILTERS ====================
        if (emailVerified !== '') {
            query.isEmailVerified = emailVerified === 'true';
        }

        if (phoneVerified !== '') {
            query.isPhoneVerified = phoneVerified === 'true';
        }

        if (identityVerified !== '') {
            query['idVerification.verified'] = identityVerified === 'true';
        }

        // ==================== TASKER STATUS FILTER ====================
        if (taskerStatus && roleType !== 'pending') {
            query.taskerStatus = taskerStatus;
        }

        if (stripeConnectStatus) {
            query.stripeConnectStatus = stripeConnectStatus;
        }

        // ==================== LOCATION FILTERS ====================
        if (city) {
            query['address.city'] = new RegExp(city, 'i');
        }

        if (province) {
            query['address.province'] = new RegExp(province, 'i');
        }

        if (country) {
            query['address.country'] = new RegExp(country, 'i');
        }

        // ==================== MARKETPLACE STATS FILTERS ====================
        // For clients - total spent (you'll need to aggregate from bookings/tasks)
        // For now, using stats field
        if (minTasksCompleted) {
            query['stats.tasksCompleted'] = {
                ...query['stats.tasksCompleted'],
                $gte: parseInt(minTasksCompleted)
            };
        }

        if (maxTasksCompleted) {
            query['stats.tasksCompleted'] = {
                ...query['stats.tasksCompleted'],
                $lte: parseInt(maxTasksCompleted)
            };
        }

        if (minBookingsCompleted) {
            query['stats.bookingsCompleted'] = {
                ...query['stats.bookingsCompleted'],
                $gte: parseInt(minBookingsCompleted)
            };
        }

        if (maxBookingsCompleted) {
            query['stats.bookingsCompleted'] = {
                ...query['stats.bookingsCompleted'],
                $lte: parseInt(maxBookingsCompleted)
            };
        }

        if (minTotalEarnings) {
            query['stats.totalEarnings'] = {
                ...query['stats.totalEarnings'],
                $gte: parseInt(minTotalEarnings)
            };
        }

        if (maxTotalEarnings) {
            query['stats.totalEarnings'] = {
                ...query['stats.totalEarnings'],
                $lte: parseInt(maxTotalEarnings)
            };
        }

        // ==================== RATING FILTERS ====================
        if (minRating) {
            query.rating = { ...query.rating, $gte: parseFloat(minRating) };
        }

        if (maxRating) {
            query.rating = { ...query.rating, $lte: parseFloat(maxRating) };
        }

        // ==================== DATE FILTERS ====================
        if (createdFrom || createdTo) {
            query.createdAt = {};
            if (createdFrom) {
                query.createdAt.$gte = new Date(createdFrom);
            }
            if (createdTo) {
                query.createdAt.$lte = new Date(createdTo);
            }
        }

        if (lastActiveFrom || lastActiveTo) {
            query.updatedAt = {};
            if (lastActiveFrom) {
                query.updatedAt.$gte = new Date(lastActiveFrom);
            }
            if (lastActiveTo) {
                query.updatedAt.$lte = new Date(lastActiveTo);
            }
        }

        // ==================== CATEGORY FILTER (for taskers) ====================
        if (category) {
            query.categories = { $in: [category] };
        }

        // ==================== SORTING ====================
        const sortOptions = {};
        sortOptions[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // ==================== PAGINATION ====================
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        // ==================== EXECUTE QUERY ====================
        const [users, totalCount] = await Promise.all([
            User.find(query)
                .select('-password -__v')
                .sort(sortOptions)
                .skip(skip)
                .limit(limitNum)
                .lean(),
            User.countDocuments(query),
        ]);

        // ==================== FORMAT RESPONSE ====================
        const formattedUsers = users.map(user => ({
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            profilePicture: user.profilePicture,
            roles: user.roles,
            currentRole: user.currentRole,
            status: user.isBlocked ? 'suspended' : (user.isEmailVerified ? 'active' : 'inactive'),
            verification: {
                email: user.isEmailVerified || false,
                phone: user.isPhoneVerified || false,
                identity: user.idVerification?.verified || false,
                address: !!user.address?.city,
            },
            location: {
                city: user.address?.city || '',
                province: user.address?.province || '',
                country: user.address?.country || 'CA',
            },
            taskerStatus: user.taskerStatus,
            stripeConnectStatus: user.stripeConnectStatus,
            rating: user.rating || 0,
            reviewCount: user.reviewCount || 0,
            stats: {
                tasksCompleted: user.stats?.tasksCompleted || 0,
                bookingsCompleted: user.stats?.bookingsCompleted || 0,
                totalEarnings: user.stats?.totalEarnings || 0,
                responseRate: user.stats?.responseRate || 100,
                completionRate: user.stats?.completionRate || 100,
            },
            categories: user.categories || [],
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
            lastActive: user.updatedAt, // or create a separate lastActive field
        }));

        // ==================== CALCULATE STATS ====================
        const stats = await calculateUserStats(roleType);

        res.status(200).json({
            success: true,
            data: {
                users: formattedUsers,
                pagination: {
                    currentPage: pageNum,
                    totalPages: Math.ceil(totalCount / limitNum),
                    totalCount,
                    limit: limitNum,
                    hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
                    hasPrevPage: pageNum > 1,
                },
                stats,
            },
        });

    } catch (error) {
        console.error('Get admin users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch users',
            error: error.message,
        });
    }
};

/**
 * Calculate user statistics based on role type
 */
const calculateUserStats = async (roleType) => {
    const baseQuery = { roles: { $nin: ['admin'] } };

    let roleQuery = {};
    switch (roleType) {
        case 'client':
            roleQuery = { roles: { $eq: ['client'] } };
            break;
        case 'tasker':
            roleQuery = { roles: { $in: ['tasker'] }, taskerStatus: 'approved' };
            break;
        case 'both':
            roleQuery = { roles: { $all: ['client', 'tasker'] }, taskerStatus: 'approved' };
            break;
        case 'pending':
            roleQuery = { taskerStatus: 'under_review' };
            break;
        default:
            roleQuery = baseQuery;
    }

    const [
        totalCount,
        activeCount,
        blockedCount,
        verifiedCount,
    ] = await Promise.all([
        User.countDocuments(roleQuery),
        User.countDocuments({ ...roleQuery, isBlocked: false, isEmailVerified: true }),
        User.countDocuments({ ...roleQuery, isBlocked: true }),
        User.countDocuments({ ...roleQuery, isEmailVerified: true, isPhoneVerified: true }),
    ]);

    // Get aggregate stats
    const aggregateStats = await User.aggregate([
        { $match: roleQuery },
        {
            $group: {
                _id: null,
                totalEarnings: { $sum: '$stats.totalEarnings' },
                avgRating: { $avg: '$rating' },
                totalTasksCompleted: { $sum: '$stats.tasksCompleted' },
                totalBookingsCompleted: { $sum: '$stats.bookingsCompleted' },
            },
        },
    ]);

    return {
        total: totalCount,
        active: activeCount,
        blocked: blockedCount,
        verified: verifiedCount,
        totalEarnings: aggregateStats[0]?.totalEarnings || 0,
        avgRating: aggregateStats[0]?.avgRating?.toFixed(1) || 0,
        totalTasksCompleted: aggregateStats[0]?.totalTasksCompleted || 0,
        totalBookingsCompleted: aggregateStats[0]?.totalBookingsCompleted || 0,
    };
};

/**
 * Get single user details for admin
 * @route GET /api/auth/admin/users/:id
 * @access Admin only
 */
export const getAdminUserById = async (req, res) => {
    try {
        const { id } = req.params;

        const user = await User.findById(id)
            .select('-password -__v')
            .lean();

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        // Get additional statistics (tasks, bookings, etc.)
        // You'll need to import your Task and Booking models
        // const tasksPosted = await Task.countDocuments({ postedBy: id });
        // const tasksCompleted = await Task.countDocuments({ assignedTo: id, status: 'completed' });
        // const bookings = await Booking.find({ $or: [{ client: id }, { tasker: id }] });

        const formattedUser = {
            id: user._id,
            name: `${user.firstName} ${user.lastName}`,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
            profilePicture: user.profilePicture,
            about: user.about,
            dob: user.dob,
            language: user.language,
            roles: user.roles,
            currentRole: user.currentRole,
            status: user.isBlocked ? 'suspended' : (user.isEmailVerified ? 'active' : 'inactive'),
            verification: {
                email: user.isEmailVerified || false,
                phone: user.isPhoneVerified || false,
                identity: user.idVerification?.verified || false,
                address: !!user.address?.city,
            },
            address: user.address,
            taskerInfo: user.roles.includes('tasker') ? {
                status: user.taskerStatus,
                appliedAt: user.taskerAppliedAt,
                approvedAt: user.taskerApprovedAt,
                rejectedAt: user.taskerRejectedAt,
                rejectionReason: user.taskerRejectionReason,
                profileComplete: user.taskerProfileComplete,
                categories: user.categories,
                skills: user.skills,
                services: user.services,
                availability: user.availability,
                travelDistance: user.travelDistance,
                serviceAreas: user.serviceAreas,
                yearsOfExperience: user.yearsOfExperience,
                qualifications: user.qualifications,
                certifications: user.certifications,
                pricingType: user.pricingType,
                chargesGST: user.chargesGST,
            } : null,
            paymentInfo: {
                stripeCustomerId: user.stripeCustomerId,
                stripeConnectAccountId: user.stripeConnectAccountId,
                stripeConnectStatus: user.stripeConnectStatus,
                stripeConnectDetails: user.stripeConnectDetails,
            },
            idVerification: user.idVerification,
            backgroundCheck: user.backgroundCheck,
            insurance: user.insurance,
            rating: user.rating || 0,
            reviewCount: user.reviewCount || 0,
            reviews: user.reviews || [],
            stats: user.stats,
            agreements: user.agreements,
            createdAt: user.createdAt,
            updatedAt: user.updatedAt,
        };

        res.status(200).json({
            success: true,
            data: formattedUser,
        });

    } catch (error) {
        console.error('Get admin user by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch user',
            error: error.message,
        });
    }
};

/**
 * Update user status (block/unblock/suspend)
 * @route PATCH /api/auth/admin/users/:id/status
 * @access Admin only
 */
export const updateUserStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body;

        const user = await User.findById(id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found',
            });
        }

        switch (action) {
            case 'block':
            case 'suspend':
                user.isBlocked = true;
                user.blockedAt = new Date();
                user.blockedReason = reason;
                break;
            case 'unblock':
            case 'activate':
                user.isBlocked = false;
                user.blockedAt = null;
                user.blockedReason = null;
                break;
            case 'ban':
                user.isBlocked = true;
                user.isBanned = true;
                user.bannedAt = new Date();
                user.bannedReason = reason;
                break;
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action',
                });
        }

        await user.save();

        res.status(200).json({
            success: true,
            message: `User ${action}ed successfully`,
            data: {
                id: user._id,
                isBlocked: user.isBlocked,
                status: user.isBlocked ? 'suspended' : 'active',
            },
        });

    } catch (error) {
        console.error('Update user status error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update user status',
            error: error.message,
        });
    }
};

/**
 * Bulk update users
 * @route PATCH /api/auth/admin/users/bulk
 * @access Admin only
 */
export const bulkUpdateUsers = async (req, res) => {
    try {
        const { userIds, action, reason } = req.body;

        if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'User IDs are required',
            });
        }

        let updateData = {};

        switch (action) {
            case 'block':
            case 'suspend':
                updateData = {
                    isBlocked: true,
                    blockedAt: new Date(),
                    blockedReason: reason,
                };
                break;
            case 'unblock':
            case 'activate':
                updateData = {
                    isBlocked: false,
                    blockedAt: null,
                    blockedReason: null,
                };
                break;
            case 'delete':
                const deleteResult = await User.deleteMany({ _id: { $in: userIds } });
                return res.status(200).json({
                    success: true,
                    message: `${deleteResult.deletedCount} users deleted successfully`,
                });
            default:
                return res.status(400).json({
                    success: false,
                    message: 'Invalid action',
                });
        }

        const result = await User.updateMany(
            { _id: { $in: userIds } },
            { $set: updateData }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} users updated successfully`,
            data: {
                modifiedCount: result.modifiedCount,
                action,
            },
        });

    } catch (error) {
        console.error('Bulk update users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update users',
            error: error.message,
        });
    }
};

/**
 * Export users to CSV
 * @route GET /api/auth/admin/users/export
 * @access Admin only
 */
export const exportUsers = async (req, res) => {
    try {
        const { roleType = 'all', format = 'json' } = req.query;

        let query = { roles: { $nin: ['admin'] } };

        switch (roleType) {
            case 'client':
                query = { roles: { $eq: ['client'] } };
                break;
            case 'tasker':
                query = { roles: { $in: ['tasker'] }, taskerStatus: 'approved' };
                break;
            case 'both':
                query = { roles: { $all: ['client', 'tasker'] }, taskerStatus: 'approved' };
                break;
            case 'pending':
                query = { taskerStatus: 'under_review' };
                break;
        }

        const users = await User.find(query)
            .select('firstName lastName email phone address roles currentRole isBlocked isEmailVerified isPhoneVerified rating stats createdAt')
            .lean();

        if (format === 'csv') {
            // Generate CSV
            const headers = [
                'ID', 'Name', 'Email', 'Phone', 'City', 'Province',
                'Roles', 'Status', 'Email Verified', 'Phone Verified',
                'Rating', 'Tasks Completed', 'Created At'
            ];

            const csvRows = users.map(user => [
                user._id,
                `${user.firstName} ${user.lastName}`,
                user.email,
                user.phone,
                user.address?.city || '',
                user.address?.province || '',
                user.roles.join(', '),
                user.isBlocked ? 'Blocked' : 'Active',
                user.isEmailVerified ? 'Yes' : 'No',
                user.isPhoneVerified ? 'Yes' : 'No',
                user.rating || 0,
                user.stats?.tasksCompleted || 0,
                user.createdAt,
            ]);

            const csvContent = [
                headers.join(','),
                ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
            ].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=users-${roleType}-${Date.now()}.csv`);
            return res.send(csvContent);
        }

        res.status(200).json({
            success: true,
            data: users,
            count: users.length,
        });

    } catch (error) {
        console.error('Export users error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export users',
            error: error.message,
        });
    }
};


export const switchRole = async (req, res) => {
    try {
        const { role: newRole } = req.body;
        if (!["client", "tasker"].includes(newRole)) {
            return res.status(400).json({ message: "Invalid role" });
        }

        console.log("this is the req body:", req.body)

        const userId = req.user.id;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (user.currentRole === newRole) {
            return res.json({ message: "Already in this role", currentRole: newRole });
        }

        if (newRole === "tasker") {
            // CRITICAL: Only allow if approved
            if (user.taskerStatus !== "approved") {
                return res.status(403).json({
                    message: "Your Tasker application is still under review.",
                    taskerStatus: user.taskerStatus,
                    // Optional: give more info
                    ...(user.taskerStatus === "rejected" && {
                        rejectionReason: user.taskerRejectionReason,
                    }),
                });
            }

            // Ensure tasker role exists
            if (!user.roles.includes("tasker")) {
                user.roles.push("tasker");
            }
            user.currentRole = "tasker";
        } else {
            // Client switch always allowed
            if (!user.roles.includes("client")) user.roles.push("client");
            user.currentRole = "client";
        }

        await user.save();

        res.json({
            message: "Role switched successfully",
            currentRole: user.currentRole,
            roles: user.roles,
            taskerStatus: user.taskerStatus,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Switch failed" });
    }
};




export const submitTaskerApplication = async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User.findById(userId).select("firstName lastName email taskerStatus roles");

        if (!user) return res.status(404).json({ message: "User not found" });

        console.log("userrrrrrrr ", user)
        console.log("userIddddd", userId)


        console.log("Tasker application submission:", {
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            currentStatus: user.taskerStatus,
            timestamp: new Date().toISOString()
        });

        // Handle resubmission based on current status
        if (user.taskerStatus === "under_review") {
            // Application already under review - send reminder notification
            try {
                await createNotification(
                    userId,
                    "⏳ Application Already Under Review",
                    `Your tasker application is currently under review. We'll notify you as soon as a decision is made. Thank you for your patience!`,
                    "application-reminder",
                    userId
                );
                console.log("✅ Reminder notification sent - application already under review");
            } catch (notifErr) {
                console.error("❌ Failed to create reminder notification:", notifErr);
            }

            return res.status(200).json({
                success: true,
                message: "Application already submitted and under review",
                taskerStatus: user.taskerStatus
            });
        }

        if (user.taskerStatus === "approved") {
            // Already approved - send confirmation
            try {
                await createNotification(
                    userId,
                    "✅ You're Already a Tasker!",
                    `You're already approved as a tasker! You can start accepting tasks and bookings right away. Switch to tasker mode to get started.`,
                    "already-approved-reminder",
                    userId
                );
                console.log("✅ Reminder notification sent - already approved");
            } catch (notifErr) {
                console.error("❌ Failed to create already approved notification:", notifErr);
            }

            return res.status(200).json({
                success: true,
                message: "You're already an approved tasker",
                taskerStatus: user.taskerStatus
            });
        }

        // Check if this is a reapplication after rejection
        const isReapplication = user.taskerStatus === "rejected";

        // Add tasker role + mark under review
        if (!user.roles.includes("tasker")) {
            user.roles.push("tasker");
        }

        user.taskerStatus = "under_review";
        user.taskerAppliedAt = new Date();
        user.taskerProfileCheck = true;

        await user.save();

        // Get user's full name for notifications
        const applicantName = `${user.firstName} ${user.lastName}`;
        const applicantEmail = user.email;

        // Create notification for the applicant
        try {
            const applicantTitle = isReapplication
                ? "🔄 Reapplication Submitted Successfully!"
                : "📝 Application Submitted Successfully!";

            const applicantMessage = isReapplication
                ? `Your new tasker application has been submitted for review. We appreciate you giving it another try! Our team will review your updated application within 24-48 hours. You'll receive a notification once a decision is made.`
                : `Thank you for applying to become a tasker! Your application is now under review. Our team will carefully evaluate your application within 24-48 hours. You'll receive a notification once a decision is made.`;

            await createNotification(
                userId,
                applicantTitle,
                applicantMessage,
                isReapplication ? "application-resubmitted" : "application-submitted",
                userId
            );
            console.log("✅ Confirmation notification sent to applicant");

        } catch (notifErr) {
            console.error("❌ Failed to create applicant notification (non-blocking):", notifErr);
        }

        // Send follow-up tips notification
        try {
            await createNotification(
                userId,
                "💡 While You Wait - Profile Tips",
                `While your application is under review, make sure your profile is complete! Add a professional photo, write a compelling bio, and list your skills. A complete profile increases your chances of approval and attracts more clients!`,
                "application-tips",
                userId
            );
            console.log("✅ Tips notification sent to applicant");

        } catch (notifErr) {
            console.error("❌ Failed to create tips notification (non-blocking):", notifErr);
        }

        // Create notification for admin(s)
        try {
            // Find all admin users
            const admins = await User.find({
                roles: { $in: ["admin"] },
                isActive: true
            }).select("_id");

            if (admins && admins.length > 0) {
                const adminNotificationTitle = isReapplication
                    ? "🔄 New Tasker Reapplication"
                    : "🆕 New Tasker Application";

                const adminNotificationMessage = isReapplication
                    ? `${applicantName} (${applicantEmail}) has resubmitted their tasker application after a previous rejection. Please review their updated application.`
                    : `${applicantName} (${applicantEmail}) has submitted a new tasker application. Please review and approve or reject the application.`;

                // Send notification to each admin
                for (const admin of admins) {
                    await createNotification(
                        admin._id,
                        adminNotificationTitle,
                        adminNotificationMessage,
                        "new-tasker-application",
                        userId // Link to the applicant's user ID
                    );
                }
                console.log(`✅ Notification sent to ${admins.length} admin(s) about new application`);

            } else {
                console.warn("⚠️ No active admins found to notify about new application");
            }

        } catch (notifErr) {
            console.error("❌ Failed to create admin notification (non-blocking):", notifErr);
        }

        // Send email notification (optional - if you have email service)
        try {
            // Uncomment and implement if you have email service
            /*
            await sendEmail({
                to: user.email,
                subject: isReapplication ? "Tasker Reapplication Received" : "Tasker Application Received",
                template: "tasker-application-received",
                data: {
                    name: applicantName,
                    isReapplication,
                    reviewTime: "24-48 hours"
                }
            });
            console.log("✅ Email notification sent to applicant");
            */
        } catch (emailErr) {
            console.error("❌ Failed to send email notification (non-blocking):", emailErr);
        }

        // Track application metrics (optional)
        try {
            // Log application for analytics
            console.log("Application metrics:", {
                type: isReapplication ? "reapplication" : "new_application",
                userId,
                userName: applicantName,
                email: applicantEmail,
                timestamp: user.taskerAppliedAt,
                previousStatus: isReapplication ? "rejected" : "none"
            });
        } catch (metricsErr) {
            console.error("❌ Failed to log metrics (non-blocking):", metricsErr);
        }

        res.status(200).json({
            success: true,
            message: isReapplication
                ? "Reapplication submitted! Under review."
                : "Application submitted! Under review.",
            taskerStatus: "under_review",
            reviewTimeframe: "24-48 hours",
            tips: {
                completeProfile: "Complete your profile for better approval chances",
                addPhoto: "Add a professional profile photo",
                addSkills: "List your relevant skills and experience"
            }
        });

    } catch (err) {
        console.error("❌ Submit tasker error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
};


export const approveRejectTasker = async (req, res) => {
    try {
        const { id } = req.params;
        const { action, reason } = req.body; // action: "approve" or "reject"

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        let notificationTitle = "";
        let notificationMessage = "";
        let notificationType = "";

        if (action === "approve") {
            user.taskerStatus = "approved";
            user.taskerApprovedAt = new Date();

            // Ensure 'tasker' role is added to roles array
            const validRoles = [...new Set([...(user.roles || ['client']), 'client', 'tasker'])].filter(role =>
                role && typeof role === 'string' && (role === 'client' || role === 'tasker' || role === 'admin')
            );
            user.roles = validRoles;
            user.taskerProfileCheck = true;

            // Set notification for approval
            notificationTitle = "🎉 Congratulations! You're Now a Tasker!";
            notificationMessage = "Your tasker application has been approved! You can now switch to Tasker mode from the navbar and start accepting jobs. Welcome to the team!";
            notificationType = "tasker-application-approved";

        } else if (action === "reject") {
            user.taskerStatus = "rejected";
            user.taskerRejectedAt = new Date();
            user.taskerRejectionReason = reason || "Did not meet requirements";

            // Set notification for rejection
            notificationTitle = "Tasker Application Update";
            notificationMessage = `Your tasker application was not approved at this time. Reason: ${user.taskerRejectionReason}. Please review and update your profile, then resubmit your application.`;
            notificationType = "tasker-application-rejected";

        } else {
            return res.status(400).json({ message: "Invalid action" });
        }

        await user.save();

        // Send notification to the user
        try {
            await createNotification(
                id, // User ID who will receive the notification
                notificationTitle,
                notificationMessage,
                notificationType,
                null // relatedId - can be null for tasker applications
            );
            console.log(`Notification sent to user ${id} for tasker ${action}`);
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
            // Don't fail the whole request if notification fails
        }

        res.json({
            success: true,
            message: `Tasker ${action}d successfully`,
            taskerStatus: user.taskerStatus,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Server error" });
    }
};



export const updateProfile = async (req, res) => {
    console.log("Received", req.method, "/api/auth/users/:id");
    console.log("Request body:", req.body);
    console.log("Authenticated user ID:", req.user?._id);
    console.log("Target user ID:", req.params.id);

    try {
        const userId = req.params.id;

        // 🔹 Find the user (fetch full doc to preserve roles)
        const user = await User.findById(userId);
        if (!user) {
            console.log("User not found for ID:", userId);
            return res.status(404).json({ error: "User not found" });
        }

        console.log("Pre-update roles:", user.roles);  // Log before

        // UPDATED: Ignore userId in body (redundant) - Fixed destructuring to avoid redeclaration
        const { email, password, rating, reviewCount, role: incomingRole, ...otherData } = req.body;
        let updateData = { ...otherData };

        // 🔹 Handle role switch specifically (treat 'role' as currentRole)
        const newRole = incomingRole; // From { role: 'tasker' } or { role: 'client' }
        let isRoleSwitch = false;
        if (newRole) {
            isRoleSwitch = true;
            console.log(`Role switch requested to: ${newRole}`);

            // Always ensure 'client' is in roles (default behavior)
            let validRoles = [...new Set([...(user.roles || ['client']), 'client'])].filter(role =>
                role && typeof role === 'string' && (role === 'client' || role === 'tasker' || role === 'admin')
            );

            if (newRole === 'tasker') {
                // For tasker switch: Check if profile is complete
                const missingFields = computeMissingFields(user);
                if (missingFields.length > 0 || !user.taskerProfileCheck) {
                    console.log("Tasker switch blocked - missing fields:", missingFields);
                    return res.status(400).json({
                        message: "Tasker profile incomplete. Please complete required fields first.",
                        missingFields
                    });
                }
                // Add 'tasker' to roles if not present
                validRoles = [...new Set([...validRoles, 'tasker'])];
                console.log("Tasker switch approved - roles now:", validRoles);
            } else if (newRole === 'client') {
                // Client switch always allowed, no additional checks
                console.log("Client switch approved - roles:", validRoles);
            }

            // Set roles and currentRole
            updateData.roles = validRoles;
            updateData.currentRole = newRole;
        }

        // 🔹 Log document fields for debugging (profile updates)
        if (!isRoleSwitch) {
            console.log("Document fields in payload:", {
                idType: updateData.idType,
                passportUrl: updateData.passportUrl,
                governmentIdFront: updateData.governmentIdFront,
                governmentIdBack: updateData.governmentIdBack,
                insuranceDocument: updateData.insuranceDocument,
                profilePicture: updateData.profilePicture,
                backgroundCheckConsent: updateData.backgroundCheckConsent,
            });
        }

        // 🔹 CRITICAL: Preserve/validate roles (prevents [null] corruption) - only if not set by role switch
        if (!updateData.roles && !isRoleSwitch) {
            // Don't touch roles if not provided—preserve existing (always include 'client')
            updateData.roles = [...new Set([...(user.roles || ['client']), 'client'])].filter(role =>
                role && typeof role === 'string' && (role === 'client' || role === 'tasker' || role === 'admin')
            );
            console.log("Preserving roles (not in payload):", updateData.roles);
        }

        // 🔹 Email uniqueness check (unchanged)
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail && existingEmail._id.toString() !== userId) {
                console.log("Email already in use:", email);
                return res.status(400).json({ error: "Email already in use" });
            }
        }

        // 🔹 Add email/password to updateData (unchanged)
        if (email) updateData.email = email;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // 🔹 Update with explicit $set (avoids schema resets)
        let updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },  // Only set explicit fields
            { new: true, runValidators: true }
        ).select('-password');

        // 🔹 NEW: After profile update (not role switch), check if tasker profile is now complete
        if (!isRoleSwitch && (updateData.idType || updateData.passportUrl || updateData.governmentIdFront || updateData.governmentIdBack || updateData.issueDate || updateData.expiryDate || updateData.backgroundCheckConsent)) {
            // Re-fetch to get latest fields
            updatedUser = await User.findById(userId).select('-password');
            const isComplete = isTaskerProfileComplete(updatedUser);
            if (isComplete && !updatedUser.taskerProfileCheck) {
                console.log("Tasker profile now complete - updating flags and adding tasker role");
                // Ensure both roles
                const validRoles = [...new Set([...(updatedUser.roles || ['client']), 'client', 'tasker'])].filter(role =>
                    role && typeof role === 'string' && (role === 'client' || role === 'tasker' || role === 'admin')
                );
                await User.findByIdAndUpdate(userId, {
                    $set: {
                        taskerProfileCheck: true,
                        roles: validRoles
                    }
                });
                // Re-fetch updated user
                updatedUser = await User.findById(userId).select('-password');
            }
        }

        console.log("Post-update roles:", updatedUser.roles);  // Log after
        console.log("Post-update currentRole:", updatedUser.currentRole);

        // 🔹 Notification
        try {
            const notificationTitle = isRoleSwitch
                ? `Switched to ${newRole.charAt(0).toUpperCase() + newRole.slice(1)} Mode`
                : "Profile Updated Successfully";
            const notificationMessage = isRoleSwitch
                ? `You have successfully switched to ${newRole} mode. Switch back anytime via the navbar.`
                : "Your profile has been updated. If tasker requirements are met, you can now switch to Tasker mode.";
            await createNotification(
                req.user?._id || userId,
                notificationTitle,
                notificationMessage,
                isRoleSwitch ? "role-switch" : "profile-update"
            );
            console.log("Notification created for", isRoleSwitch ? "role switch" : "profile update");
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr);
        }

        return res.status(200).json({ message: "User updated successfully", user: updatedUser });
    } catch (error) {
        console.error("Update user error:", error);
        return res.status(500).json({
            error: "Failed to update user",
            details: error.message,
        });
    }
};

// 🔹 Helper: Check if tasker profile is complete (required fields for tasker)
const isTaskerProfileComplete = (user) => {
    if (!user.idType) return false;
    if (user.idType === 'passport' && !user.passportUrl) return false;
    if (user.idType === 'governmentID' && (!user.governmentIdFront || !user.governmentIdBack)) return false;
    if (!user.issueDate || !user.expiryDate) return false;
    if (new Date(user.expiryDate) <= new Date(user.issueDate)) return false;
    if (!user.backgroundCheckConsent) return false;
    // Optional: Add more (e.g., profilePicture, sin, dob) if required
    return true;
};

// 🔹 Helper: Compute missing fields for tasker (for error response)
const computeMissingFields = (user) => {
    const missing = [];
    if (!user.idType) missing.push('idType');
    else if (user.idType === 'passport' && !user.passportUrl) missing.push('passportUrl');
    else if (user.idType === 'governmentID') {
        if (!user.governmentIdFront) missing.push('governmentIdFront');
        if (!user.governmentIdBack) missing.push('governmentIdBack');
    }
    if (!user.issueDate) missing.push('issueDate');
    if (!user.expiryDate) missing.push('expiryDate');
    if (user.issueDate && user.expiryDate && new Date(user.expiryDate) <= new Date(user.issueDate)) {
        if (!missing.includes('expiryDate')) missing.push('expiryDate'); // Invalid
    }
    if (!user.backgroundCheckConsent) missing.push('backgroundCheckConsent');
    // Optional: Add more if needed
    return [...new Set(missing)]; // Unique
};






export const verifyToken = async (req, res) => {
    const token = req.cookies.token;

    console.log(token)

    if (!token) return res.status(401).json({ message: "No token provided" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select("-password");
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ user });
    } catch (err) {
        res.status(401).json({ message: "Invalid or expired token" });
    }
};


export const getTopTaskerReviews = async (req, res) => {
    try {
        const taskers = await User.find({ currentRole: "tasker", "reviews.0": { $exists: true } })
            .populate({
                path: "reviews.reviewer",
                select: "firstName lastName profilePicture", // Include reviewer details if needed elsewhere
            })
            .sort({ reviewCount: -1, rating: -1 })
            .limit(6);
        
        console.log(taskers)    

        const reviews = [];
        for (const tasker of taskers) {
            for (const review of tasker.reviews) {
                if (reviews.length < 6) {
                    const service = tasker.services?.length > 0 ? tasker.services[0].title : "General Service";
                    reviews.push({
                        taskerFirstName: tasker.firstName,
                        taskerLastName: tasker.lastName,
                        taskerProfilePicture: tasker.profilePicture || "",
                        reviewerFirstName: review.reviewer?.firstName || "Anonymous",
                        reviewerLastName: review.reviewer?.lastName || "",
                        reviewerProfilePicture: review.reviewer?.profilePicture || "",
                        rating: review.rating || 0,
                        message: review.message || "No review message provided",
                        service: service,
                        createdAt: review.createdAt || new Date(),
                    });
                }
            }
        }

        const sortedReviews = reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6);

        res.status(200).json(sortedReviews);
    } catch (error) {
        console.error("Error fetching top tasker reviews:", error);
        res.status(500).json({ message: "Server error", error: error.message });
    }
};

export const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 10, search, role, province } = req.query;

        // Build filter object
        const filter = {};
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } }
            ];
        }
        if (role) filter.currentRole = role;
        if (province) filter.province = province;

        const skip = (page - 1) * limit;

        const users = await User.find(filter)
            .select('-password') // Exclude password field
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        const totalUsers = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalUsers / limit);

        res.status(200).json({
            message: "Users retrieved successfully",
            users,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalUsers,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to retrieve users", error: err.message });
    }
};
// controllers/userController.js


export const getUserById = async (req, res) => {
    console.log('Route hit: GET /users/single/:id');  // NEW: Log entry
    console.log('Params:', req.params);  // Log the extracted :id
    console.log('Full URL:', req.originalUrl);  // Log the incoming path

    try {
        const { id } = req.params;
        if (!id || id.length !== 24) {  // NEW: Early validation for ObjectId
            console.log('Invalid ID format:', id);
            return res.status(400).json({ message: 'Invalid user ID format' });
        }

        const user = await User.findById(id).select('-password');  // IMPROVED: Exclude password

        console.log('DB Query Result:', user ? 'Found' : 'Not found');  // NEW: Log DB outcome

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({ user });  // IMPROVED: Wrap in object for consistency
    } catch (err) {
        console.error('getUserById Error:', err);  // IMPROVED: More detailed logging
        res.status(500).json({ message: 'Error fetching user', error: err.message });
    }
};


export const getTaskersByCategory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category = '',
            search = '',
            province = '',
            availability = '',
            rating = '',
            experience = '',
            minPrice = '',
            maxPrice = '',
        } = req.query;

        // Build the filter object
        const filter = { currentRole: 'tasker' };

        console.log(req.query)

        // 🔍 Filter by serviceCategories
        if (category) {
            filter.categories = { $in: [category] }; // Use $in for exact matching
        }

        // 🔍 Search by fullName, email, or city
        if (search) {
            filter.$or = [
                { fullName: { $regex: new RegExp(search, 'i') } },
                { email: { $regex: new RegExp(search, 'i') } },
                { 'address.city': { $regex: new RegExp(search, 'i') } },
            ];
        }

        // 🌍 Filter by province
        if (province) {
            filter['address.province'] = { $regex: new RegExp(province, 'i') };
        }

        // ⏰ Filter by availability
        if (availability && availability !== 'All') {
            filter.availability = {
                $elemMatch: { day: { $regex: new RegExp(availability, 'i') } },
            };
        }

        // ⭐ Filter by rating
        if (rating && rating !== 'All Ratings') {
            filter.rating = { $gte: parseFloat(rating) };
        }

        // 🛠️ Filter by experience
        if (experience && experience !== 'All Levels') {
            filter.yearsOfExperience = { $gte: parseInt(experience) };
        }

        // 💰 Filter by price range
        if (minPrice || maxPrice) {
            filter['services.hourlyRate'] = {};
            if (minPrice) {
                filter['services.hourlyRate'].$gte = parseFloat(minPrice);
            }
            if (maxPrice) {
                filter['services.hourlyRate'].$lte = parseFloat(maxPrice);
            }
        }

        // 🔍 Log filter for debugging
        console.log('Tasker filter applied:', JSON.stringify(filter, null, 2));

        const skip = (parseInt(page) - 1) * parseInt(limit);

        // 🧾 Fetch taskers
        const taskers = await User.find(filter)
            .select('-password')
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 });

        // 📦 Log fetched taskers
        console.log('Fetched taskers:', taskers.map(t => ({ _id: t._id, categories: t.categories })));

        // 📦 Get total count for pagination
        const totalTaskers = await User.countDocuments(filter);
        const totalPages = Math.ceil(totalTaskers / parseInt(limit));

        // ✅ Send response
        res.status(200).json({
            message: 'Taskers fetched successfully',
            taskers,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalTaskers,
                hasNext: parseInt(page) < totalPages,
                hasPrev: parseInt(page) > 1,
            },
        });
    } catch (err) {
        console.error('Error fetching taskers:', err);
        res.status(500).json({
            message: 'Failed to retrieve taskers',
            error: err.message,
        });
    }
};

export const submitRating = async (req, res) => {
    try {
        const { taskerId, rating, comment } = req.body;
        const clientId = req.user._id; // Assumes auth middleware sets req.user

        // Validate client role
        const client = await User.findById(clientId);
        if (!client || client.role !== "client") {
            return res.status(403).json({ message: "Only clients can submit ratings" });
        }

        // Validate tasker exists and is a tasker
        const tasker = await User.findById(taskerId);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(404).json({ message: "Tasker not found" });
        }

        // Validate rating
        if (!Number.isInteger(rating) || rating < 0 || rating > 5) {
            return res.status(400).json({ message: "Rating must be an integer between 0 and 5" });
        }

        // Check for duplicate review
        const existingReview = await Review.findOne({ taskerId, clientId });
        if (existingReview) {
            return res.status(400).json({ message: "You have already rated this tasker" });
        }

        // Create new review
        const review = await Review.create({
            taskerId,
            clientId,
            rating,
            comment: comment || "",
        });

        // Calculate average rating and update review count
        const reviews = await Review.find({ taskerId });
        const avgRating = reviews.length
            ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
            : 0;

        // Update tasker's rating and reviewCount
        await User.updateOne(
            { _id: taskerId },
            { rating: avgRating, reviewCount: reviews.length }
        );

        // Create notification for the tasker (non-blocking)
        try {
            await createNotification(
                taskerId,
                "New Review Received",
                `You received a ${rating}-star review from ${client.firstName} ${client.lastName}. "${comment || 'No comment provided'}"`,
                "review",
                review._id
            );
            console.log("Notification created for new review"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Rating submitted successfully", review });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to submit rating", error: err.message });
    }
};



export const toggleBlockUser = async (req, res) => {
    try {
        const { id } = req.params;
        const { block } = req.body; // boolean: true to block, false to unblock

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        user.isBlocked = block;
        await user.save();

        res.status(200).json({
            message: block ? "User blocked successfully" : "User unblocked successfully",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                isBlocked: user.isBlocked,
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to update user block status", error: err.message });
    }
};

export const toggleTaskerProfileCheck = async (req, res) => {
    try {
        const { id } = req.params;
        const { approve } = req.body; // boolean: true to approve, false to reject/under review

        const user = await User.findById(id);
        if (!user) return res.status(404).json({ message: "User not found" });

        if (!user.roles.includes("tasker")) {
            return res.status(400).json({ message: "This action is only applicable for taskers" });
        }

        user.taskerProfileCheck = approve;
        await user.save();

        res.status(200).json({
            message: approve ? "Tasker profile approved successfully" : "Tasker profile set under review successfully",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                taskerProfileCheck: user.taskerProfileCheck,
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to update tasker profile check status", error: err.message });
    }
};

// ==== DELETE USER ====
export const deleteUser = async (req, res) => {
    try {
        const { id } = req.params;

        const deletedUser = await User.findByIdAndDelete(id);
        if (!deletedUser) {
            return res.status(404).json({ message: "User not found" });
        }

        res.status(200).json({
            message: "User deleted successfully",
            deletedUser: {
                id: deletedUser._id,
                fullName: deletedUser.fullName,
                email: deletedUser.email
            }
        });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete user", error: err.message });
    }
};


