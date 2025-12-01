import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import cookieParser from "cookie-parser";
import { createNotification } from "./notificationHelper.js";


const app = express();

app.use(cookieParser());


// Token generator
const createToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

const isProduction = process.env.NODE_ENV === "production";


const tokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};

const statusCookieOptions = {
    httpOnly: false,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};





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

        const hashedPassword = await bcrypt.hash(password, 10);

        // Base user data
        const userData = {
            firstName,
            lastName,
            email,
            phone,
            postalCode,
            password: hashedPassword,
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

        if (role === "tasker") {
            // For taskers, do not set login cookies; profile is under review by default
            message = "Tasker profile submitted successfully. Your profile is under review and will be approved by admin soon. You can login once approved.";
            loginCookies = false;
        } else {
            // For clients, set login cookies
            const token = createToken(user._id);
            res.cookie("token", token, tokenCookieOptions);
            res.cookie("isLoggedIn", "true", statusCookieOptions);
        }

        res.status(201).json({ message, user: { ...user.toObject(), password: undefined } });
    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err.message });
    }
};


export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        // 🚫 Check if the user is blocked
        if (user.isBlocked) {
            return res.status(403).json({ message: "Your account has been blocked by the admin." });
        }

        // 🚫 Check if the user is a tasker under review
        if (user.roles.includes("tasker") && !user.taskerProfileCheck) {
            return res.status(403).json({ message: "Your tasker profile is under review. Please wait for admin approval." });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) return res.status(400).json({ message: "Invalid credentials" });

        const token = createToken(user._id);

        res.cookie("token", token, tokenCookieOptions);
        res.cookie("isLoggedIn", "true", statusCookieOptions);

        res.status(200).json({ message: "Login successful", user });
    } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

export const logout = (req, res) => {
    console.log("Logout called, cookies before clear:", req.cookies);

    const isProduction = process.env.NODE_ENV === "production";

    res.clearCookie("token", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
    });

    res.clearCookie("isLoggedIn", {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        path: "/",
    });

    console.log("Cookies cleared");
    return res.status(200).json({ message: "Logout successful" });
};


// const app = express();
// app.use(cookieParser());

// // Token generator
// const createToken = (id) => {
//     return jwt.sign({ id }, process.env.JWT_SECRET, {
//         expiresIn: "7d",
//     });
// };

// // ✅ Helper: Detect iOS 12-13 (has SameSite="none" bug)
// const isIOS12or13 = (userAgent) => {
//     return /iP(ad|hone|od).* OS (12|13)_/.test(userAgent || '');
// };

// // ✅ Dynamic cookie options based on user agent
// const getCookieOptions = (userAgent = '') => {
//     const isOldIOS = isIOS12or13(userAgent);
//     const isProduction = process.env.NODE_ENV === "production";

//     return {
//         token: {
//             httpOnly: true,
//             secure: isProduction,
//             sameSite: isOldIOS ? "strict" : (isProduction ? "none" : "lax"),
//             path: "/",
//             maxAge: 7 * 24 * 60 * 60 * 1000,
//             ...(isProduction && process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN })
//         },
//         status: {
//             httpOnly: false,
//             secure: isProduction,
//             sameSite: isOldIOS ? "strict" : (isProduction ? "none" : "lax"),
//             path: "/",
//             maxAge: 7 * 24 * 60 * 60 * 1000,
//             ...(isProduction && process.env.COOKIE_DOMAIN && { domain: process.env.COOKIE_DOMAIN })
//         }
//     };
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
//             role,
//             dob,
//             address: street,
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
//             serviceCategories: categories,
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
//             userData.accountHolder = accountHolder;
//             userData.accountNumber = accountNumber;
//             userData.routingNumber = routingNumber;
//         }

//         const user = await User.create(userData);

//         let message = "Signup successful";
//         let token = null;

//         if (role === "tasker") {
//             // For taskers, profile is under review
//             message = "Tasker profile submitted successfully. Your profile is under review and will be approved by admin soon. You can login once approved.";
//         } else {
//             // ✅ For clients, set login cookies AND send token in response
//             token = createToken(user._id);
//             const userAgent = req.headers['user-agent'];
//             const cookieOpts = getCookieOptions(userAgent);

//             res.cookie("token", token, cookieOpts.token);
//             res.cookie("isLoggedIn", "true", cookieOpts.status);
//         }

//         // ✅ Send token in response body for iOS/Safari fallback
//         res.status(201).json({
//             message,
//             user: { ...user.toObject(), password: undefined },
//             token // Will be null for taskers, valid token for clients
//         });
//     } catch (err) {
//         console.error("Signup error:", err);
//         res.status(500).json({ message: "Signup failed", error: err.message });
//     }
// };

// export const login = async (req, res) => {
//     try {
//         const { email, password } = req.body;

//         const user = await User.findOne({ email });
//         if (!user) return res.status(400).json({ message: "Invalid credentials" });

//         // 🚫 Check if the user is blocked
//         if (user.isBlocked) {
//             return res.status(403).json({ message: "Your account has been blocked by the admin." });
//         }

//         // 🚫 Check if the user is a tasker under review
//         if (user.roles.includes("tasker") && !user.taskerProfileCheck) {
//             return res.status(403).json({ message: "Your tasker profile is under review. Please wait for admin approval." });
//         }

//         const match = await bcrypt.compare(password, user.password);
//         if (!match) return res.status(400).json({ message: "Invalid credentials" });

//         // ✅ Create token and set cookies with dynamic options
//         const token = createToken(user._id);
//         const userAgent = req.headers['user-agent'];
//         const cookieOpts = getCookieOptions(userAgent);

//         res.cookie("token", token, cookieOpts.token);
//         res.cookie("isLoggedIn", "true", cookieOpts.status);

//         // ✅ Send token in response body for iOS/Safari fallback
//         res.status(200).json({
//             message: "Login successful",
//             user: { ...user.toObject(), password: undefined },
//             token // For localStorage fallback on iOS/Safari
//         });
//     } catch (err) {
//         console.error("Login error:", err);
//         res.status(500).json({ message: "Login failed", error: err.message });
//     }
// };

// export const logout = (req, res) => {
//     console.log("Logout called, cookies before clear:", req.cookies);

//     const userAgent = req.headers['user-agent'];
//     const cookieOpts = getCookieOptions(userAgent);

//     // ✅ Clear cookies with same options used to set them
//     res.clearCookie("token", cookieOpts.token);
//     res.clearCookie("isLoggedIn", cookieOpts.status);

//     console.log("Cookies cleared");
//     return res.status(200).json({ message: "Logout successful" });
// };


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

        if (action === "approve") {
            user.taskerStatus = "approved";
            user.taskerApprovedAt = new Date();
        } else if (action === "reject") {
            user.taskerStatus = "rejected";
            user.taskerRejectedAt = new Date();
            user.taskerRejectionReason = reason || "Did not meet requirements";
        } else {
            return res.status(400).json({ message: "Invalid action" });
        }

        await user.save();

        // Optional: send notification to user
        // await createNotification(...)

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
// In controllers/userController.js



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
        const taskers = await User.find({ role: "tasker", "reviews.0": { $exists: true } })
            .populate({
                path: "reviews.reviewer",
                select: "firstName lastName profilePicture", // Include reviewer details if needed elsewhere
            })
            .sort({ reviewCount: -1, rating: -1 })
            .limit(6);

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


