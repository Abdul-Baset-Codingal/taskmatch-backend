// import express from "express";
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import User from "../models/user.js";
// import cookieParser from "cookie-parser";
// import { createNotification } from "./notificationHelper.js";


// const app = express();

// app.use(cookieParser());
// const isProduction = process.env.NODE_ENV === "production";


// const createToken = (id) => {
//     return jwt.sign({ id }, process.env.JWT_SECRET, {
//         expiresIn: "7d",
//     });
// };



// const tokenCookieOptions = {
//     httpOnly: true,
//     secure: true,
//     sameSite: "none",
//     path: "/",
//     maxAge: 7 * 24 * 60 * 60 * 1000,
    
// };

// const statusCookieOptions = {
//     httpOnly: true,
//     secure: true,
//     sameSite: "none",
//     path: "/",
//     maxAge: 7 * 24 * 60 * 60 * 1000,
// };





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

//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Base user data
//         const userData = {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password: hashedPassword,
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


import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { createNotification } from "./notificationHelper.js";
import emailjs from "@emailjs/nodejs";
import crypto from "crypto";
import PasswordReset from "../models/PasswordReset.js"
import User from "../models/user.js";
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

//         const hashedPassword = await bcrypt.hash(password, 10);

//         // Base user data
//         const userData = {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password: hashedPassword,
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

export const signup = async (req, res) => {
    try {
        const {
            firstName,
            lastName,
            email,
            phone,
            postalCode,
            password,
            role,  // "client" or "tasker"
            otp,   // Add OTP from request body
            dob,
            address: street,  // Renamed for clarity (assuming body has 'address' as street)
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
            serviceCategories: categories,  // Renamed
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
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }
        otps.delete(email); // Clear after use

        if (!["client", "tasker"].includes(role)) {
            return res.status(400).json({ message: "Invalid role type" });
        }

        // Check for existing email
        const existingEmail = await User.findOne({ email });
        if (existingEmail) {
            return res.status(400).json({ message: "Email already exists" });
        }

        // Check for existing phone number
        const existingPhone = await User.findOne({ phone });
        if (existingPhone) {
            return res.status(400).json({ message: "Phone number already exists" });
        }

        // Base user data
        const userData = {
            firstName,
            lastName,
            email,
            phone,
            postalCode,
            password, // Set plaintext password here; the pre-save hook will hash it
            roles: role === "tasker" ? ["client", "tasker"] : ["client"],
            currentRole: role,
        };

        if (role === "tasker") {
            // Validate required tasker fields (uncomment if needed)
            const requiredFields = {
                about: about,
                profilePicture: profilePicture,
                dob: dob,
                yearsOfExperience: yearsOfExperience,
                categories: categories,
                skills: skills,
                qualifications: qualifications,
                services: services,
                certifications: certifications,
                backgroundCheckConsent: backgroundCheckConsent,
                hasInsurance: hasInsurance,
                availability: availability,
                serviceAreas: serviceAreas,
                language: language,
                travelDistance: travelDistance,
                idType: idType,
                sin: sin,
                // Note: issueDate and expiryDate are optional but recommended
                passportUrl: passportUrl,  // Conditional on idType
                governmentIdFront: governmentIdFront,  // Conditional on idType
                governmentIdBack: governmentIdBack,  // Conditional on idType
            };

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

            // Set bank details (optional for taskers)
            userData.accountHolder = accountHolder;
            userData.accountNumber = accountNumber;
            userData.routingNumber = routingNumber;
        }

        const user = await User.create(userData);

        let message = "Signup successful";
        let loginCookies = true;

        let token = null;

        if (role === "tasker") {
            // For taskers, do not set login cookies; profile is under review by default
            message = "Tasker profile submitted successfully. Your profile is under review and will be approved by admin soon. You can login once approved.";
            loginCookies = false;
        } else {
            // For clients, set login cookies
            token = createToken(user._id);
            res.cookie("token", token, tokenCookieOptions);
            res.cookie("isLoggedIn", "true", statusCookieOptions);
        }

        res.status(201).json({ message, user: { ...user.toObject(), password: undefined }, token });
    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err.message });
    }
};



export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        console.log("emaill", email)
        console.log("password", password)

        const user = await User.findOne({ email });
        console.log(user)
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // 🚫 Check if the user is blocked
        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account has been blocked by the admin." });
        }

        // 🚫 Check if the user is a tasker under review
        // if (user.roles.includes("tasker") && !user.taskerProfileCheck) {
        //     return res.status(403).json({ message: "Your tasker profile is under review. Please wait for admin approval." });
        // }

        console.log(password, "passworddddd")
        console.log(user.password, "user passsss")
        const match = await bcrypt.compare(password, user.password);
        console.log(match)
        if (!match) return res.status(400).json({ message: "Invalid credentials" });

        const token = createToken(user._id);

        res.cookie("token", token, tokenCookieOptions);
        res.cookie("isLoggedIn", "true", statusCookieOptions);

        res.status(200).json({ message: "Login successful", user, token });
    } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// export const logout = (req, res) => {
//     console.log("Logout called, cookies before clear:", req.cookies);

//     const isProduction = process.env.NODE_ENV === "production";

//     res.clearCookie("token", {
//         httpOnly: true,
//         secure: isProduction,
//         sameSite: isProduction ? "none" : "lax",
//         path: "/",
//     });

//     res.clearCookie("isLoggedIn", {
//         httpOnly: true,
//         secure: isProduction,
//         sameSite: isProduction ? "none" : "lax",
//         path: "/",
//     });

//     console.log("Cookies cleared");
//     return res.status(200).json({ message: "Logout successful" });
// };


export const logout = (req, res) => {
    console.log("=== LOGOUT DEBUG START ===");
    console.log("1. All cookies received:", req.cookies);
    console.log("2. Token cookie exists:", !!req.cookies?.token);
    console.log("3. isLoggedIn cookie exists:", !!req.cookies?.isLoggedIn);
    console.log("4. Request headers:", req.headers);
    console.log("5. Origin:", req.headers.origin);

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

    console.log("=== LOGOUT DEBUG END ===");

    return res.status(200).json({
        message: "Logout successful",
        debug: {
            cookiesReceived: Object.keys(req.cookies || {}),
            clearedAt: new Date().toISOString()
        }
    });
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






//     console.log('Request body:', req.body);
//     console.log('Authenticated user ID:', req.user?._id);
//     console.log('Target user ID:', req.params.id);
//     try {
//         const userId = req.params.id;

//         // Find the user
//         const user = await User.findById(userId);
//         if (!user) {
//             console.log('User not found for ID:', userId);
//             return res.status(404).json({ error: 'User not found' });
//         }

//         // Validate email uniqueness if provided
//         const { email, password, rating, reviewCount, ...otherData } = req.body;
//         if (email && email !== user.email) {
//             const existingEmail = await User.findOne({ email });
//             if (existingEmail) {
//                 console.log('Email already in use:', email);
//                 return res.status(400).json({ error: 'Email already in use' });
//             }
//         }

//         // Prepare update data, explicitly excluding rating and reviewCount
//         const updateData = { ...otherData };
//         if (email) updateData.email = email;
//         if (password) {
//             updateData.password = await bcrypt.hash(password, 10);
//         }

//         // Load the user document and apply updates manually to ensure full context for validation
//         const updatedUserDoc = await User.findById(userId);
//         if (!updatedUserDoc) {
//             return res.status(404).json({ error: 'User not found' });
//         }

//         // Ensure roles is always an array to prevent validation errors
//         if (!Array.isArray(updatedUserDoc.roles)) {
//             updatedUserDoc.roles = [];
//         }

//         // Apply updates
//         Object.assign(updatedUserDoc, updateData);

//         // If roles is being updated, ensure it's an array
//         if (updateData.roles && !Array.isArray(updateData.roles)) {
//             updatedUserDoc.roles = [updateData.roles];
//         } else if (updateData.roles) {
//             updatedUserDoc.roles = updateData.roles;
//         }

//         // Save with validation
//         await updatedUserDoc.save({ runValidators: true });

//         const updatedUser = updatedUserDoc.toObject();

//         console.log('Updated user:', updatedUser);

//         // Create notification for profile update (non-blocking)
//         try {
//             await createNotification(
//                 req.user?._id || userId, // Use authenticated user ID
//                 "Profile Updated Successfully",
//                 "Your tasker profile has been updated. You can now switch to tasker mode if all fields are complete.",
//                 "profile-update"
//             );
//             console.log("Notification created for profile update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: 'User updated', user: updatedUser });
//     } catch (error) {
//         console.error('Update user error:', error);
//         res.status(500).json({ error: 'Failed to update user', details: error.message });
//     }
// };

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


