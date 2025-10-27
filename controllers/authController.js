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



// COMMON COOKIE OPTIONS
const tokenCookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
};


const statusCookieOptions = {
    httpOnly: false,          // accessible by JS on frontend
    secure: true,             // sent only over HTTPS
    sameSite: "none",         // allows cross-site cookie sending
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",                // cookie applies to all backend routes
};


// export const signup = async (req, res) => {
//     try {
//         const { firstName, lastName , email, phone, postalCode, password, role } = req.body;

//         const existing = await User.findOne({ email });
//         if (existing) return res.status(400).json({ message: 'User already exists' });

//         const hashedPassword = await bcrypt.hash(password, 10);

//         const userData = {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password: hashedPassword,
//             role,
//         };

//         if (role === 'tasker') {
//             // multer + CloudinaryStorage puts the uploaded file info in req.file
//             userData.profilePicture = req.body.profilePicture || ''; // Use ImgBB URL


//             console.log(req.body)


//             userData.categories = req.body.serviceCategories || [];
//             userData.skills = req.body.skills || [];
//             userData.yearsOfExperience = req.body.experienceYears || '';
//             userData.qualifications = req.body.qualifications || [];
//             userData.services = req.body.services || [];
//             userData.certifications = req.body.certifications || [];
//             userData.backgroundCheckConsent = req.body.backgroundCheckConsent || false;
//             userData.hasInsurance = req.body.hasInsurance || false;
//             userData.availability = req.body.availability || [];
//             userData.serviceAreas = req.body.serviceAreas || [];
//             userData.profilePicture = req.body.profilePicture || ''; // Use ImgBB URL

//         }

//         const user = await User.create(userData);

//         const token = createToken(user._id);

//         res.cookie('token', token, tokenCookieOptions);
//         res.cookie('isLoggedIn', 'true', statusCookieOptions);

//         res.status(201).json({ message: 'Signup successful', user });
//     } catch (err) {
//         res.status(500).json({ message: 'Signup failed', error: err.message });
//     }
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
//             idType, // New field
//             govID, // URL for passport or front of government ID
//             govIDBack, // URL for back of government ID
//             serviceCategories,
//             skills,
//             experienceYears,
//             qualifications,
//             services,
//             certifications,
//             backgroundCheckConsent,
//             hasInsurance,
//             availability,
//             serviceAreas,
//             profilePicture
//         } = req.body;

//         console.log(req.body)

//         const existing = await User.findOne({ email });
//         if (existing) return res.status(400).json({ message: 'User already exists' });

//         const hashedPassword = await bcrypt.hash(password, 10);

//         const userData = {
//             firstName,
//             lastName,
//             email,
//             phone,
//             postalCode,
//             password: hashedPassword,
//             role,
//         };

//         if (role === 'tasker') {
//             userData.idType = idType || null; // Store ID type
//             userData.governmentId = govID || ''; // Store passport or front of government ID
//             userData.govIDBack = govIDBack || ''; // Store back of government ID (if applicable)
//             userData.categories = serviceCategories || [];
//             userData.skills = skills || [];
//             userData.yearsOfExperience = experienceYears || '';
//             userData.qualifications = qualifications || [];
//             userData.services = services || [];
//             userData.certifications = certifications || [];
//             userData.backgroundCheckConsent = backgroundCheckConsent || false;
//             userData.hasInsurance = hasInsurance || false;
//             userData.availability = availability || [];
//             userData.serviceAreas = serviceAreas || [];
//             userData.profilePicture = profilePicture || ''; // Use ImgBB URL
//         }

//         const user = await User.create(userData);

//         const token = createToken(user._id);

//         res.cookie('token', token, tokenCookieOptions);
//         res.cookie('isLoggedIn', 'true', statusCookieOptions);

//         res.status(201).json({ message: 'Signup successful', user });
//     } catch (err) {
//         res.status(500).json({ message: 'Signup failed', error: err.message });
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
            dob,
            address: street,  // Renamed for clarity
            city,
            province,
            language,
            about,
            travelDistance,
            idType,
            govID,
            govIDBack,
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
        } = req.body;

        console.log(req.body);

        if (!["client", "tasker"].includes(role)) {
            return res.status(400).json({ message: "Invalid role type" });
        }

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "User already exists" });

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
            // Validate required tasker fields
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
                governmentId: govID,
                govIDBack: govIDBack,
            };

            // for (const [field, value] of Object.entries(requiredFields)) {
            //     if (!value || (Array.isArray(value) && value.length === 0)) {
            //         return res.status(400).json({ message: `${field.charAt(0).toUpperCase() + field.slice(1)} is required for taskers` });
            //     }
            // }

            // Set tasker fields
            userData.dob = dob;
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
            userData.governmentId = govID;
            userData.govIDBack = govIDBack;
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
        }

        const user = await User.create(userData);

        const token = createToken(user._id);

        res.cookie("token", token, tokenCookieOptions);
        res.cookie("isLoggedIn", "true", statusCookieOptions);

        res.status(201).json({ message: "Signup successful", user: { ...user.toObject(), password: undefined } });
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


// switch role 

// export const switchRole = async (req, res) => {
//     try {
//         const { role: newRole } = req.body;  // "client" or "tasker"

//         if (!["client", "tasker"].includes(newRole)) {
//             return res.status(400).json({ message: "Invalid role type" });
//         }

//         // Decode token (adjust to your auth middleware)
//         const token = req.cookies.token;
//         if (!token) return res.status(401).json({ message: "Unauthorized" });

//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         console.log("Decoded token:", decoded); // Debug: Log to confirm payload structure
//         const userId = decoded.id || decoded.userId || decoded._id; // Flexible: try common keys
//         if (!userId) return res.status(401).json({ message: "Invalid token payload" });

//         const user = await User.findById(userId);
//         if (!user) return res.status(404).json({ message: "User not found" });

//         console.log("Authenticated user ID:", userId); // Debug log (remove in prod)

//         if (user.currentRole === newRole) {
//             return res.json({ message: "No change needed", user: { currentRole: user.currentRole, roles: user.roles } });
//         }

//         if (newRole === "tasker") {
//             // Check if "tasker" role is available
//             if (!user.roles.includes("tasker")) {
//                 user.roles.push("tasker");
//             }

//             // Explicitly set rating and reviewCount to defaults for taskers to pass validation
//             if (user.rating === null) {
//                 user.rating = 0;
//             }
//             if (user.reviewCount === null) {
//                 user.reviewCount = 0;
//             }

//             // Validate required tasker fields
//             const requiredFields = [
//                 "about", "profilePicture", "dob", "yearsOfExperience", "categories",
//                 "skills", "qualifications", "services", "certifications",
//                 "backgroundCheckConsent", "hasInsurance", "availability", "serviceAreas",
//                 "language", "travelDistance", "idType", "governmentId", "govIDBack",
//             ];

//             const missingFields = [];
//             for (const field of requiredFields) {
//                 const value = user[field];
//                 if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && !value.trim())) {
//                     missingFields.push(field);
//                 }
//             }



//             user.currentRole = "tasker";
//         } else {
//             // Switch to client: always allowed
//             if (!user.roles.includes("client")) {
//                 user.roles.push("client");
//             }
//             user.currentRole = "client";
//         }

//         await user.save();

//         try {
//             await createNotification(
//                 userId,
//                 "Role Switched Successfully",
//                 `You have switched from ${previousRole} to ${newRole}. Explore your new features!`,
//                 "role-switch"
//             );
//             console.log("Notification created for role switch"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }
//         res.json({ message: "Role switched successfully", user: { currentRole: user.currentRole, roles: user.roles } });


//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ message: "Switch role failed", error: err.message });
//     }
// };
export const switchRole = async (req, res) => {
    try {
        const { role: newRole } = req.body;  // "client" or "tasker"

        if (!["client", "tasker"].includes(newRole)) {
            return res.status(400).json({ message: "Invalid role type" });
        }

        // Decode token (adjust to your auth middleware)
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log("Decoded token:", decoded); // Debug: Log to confirm payload structure
        const userId = decoded.id || decoded.userId || decoded._id; // Flexible: try common keys
        if (!userId) return res.status(401).json({ message: "Invalid token payload" });

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        console.log("Authenticated user ID:", userId); // Debug log (remove in prod)

        if (user.currentRole === newRole) {
            return res.json({ message: "No change needed", user: { currentRole: user.currentRole, roles: user.roles } });
        }

        const previousRole = user.currentRole; // Track previous role for notification (moved here for scope)

        if (newRole === "tasker") {
            // Check if "tasker" role is available
            if (!user.roles.includes("tasker")) {
                user.roles.push("tasker");
            }

            // Explicitly set rating and reviewCount to defaults for taskers to pass validation
            if (user.rating === null) {
                user.rating = 0;
            }
            if (user.reviewCount === null) {
                user.reviewCount = 0;
            }

            // Validate required tasker fields
            const requiredFields = [
                "about", "profilePicture", "dob", "yearsOfExperience", "categories",
                "skills", "qualifications", "services", "certifications",
                "backgroundCheckConsent", "hasInsurance", "availability", "serviceAreas",
                "language", "travelDistance", "idType", "governmentId", "govIDBack",
            ];

            const missingFields = [];
            for (const field of requiredFields) {
                const value = user[field];
                if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && !value.trim())) {
                    missingFields.push(field);
                }
            }

            // if (missingFields.length > 0) {
            //     return res.status(400).json({
            //         message: "Please complete your tasker profile first",
            //         missingFields,
            //     });
            // }

            user.currentRole = "tasker";
        } else {
            // Switch to client: always allowed
            if (!user.roles.includes("client")) {
                user.roles.push("client");
            }
            user.currentRole = "client";
        }

        await user.save();

        // Create notification for the role switch (BEFORE sending response)
        try {
            await createNotification(
                userId,
                "Role Switched Successfully",
                `You have switched from ${previousRole} to ${newRole}. Explore your new features!`,
                "role-switch"
            );
            console.log("Notification created for role switch"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.json({ message: "Role switched successfully", user: { currentRole: user.currentRole, roles: user.roles } });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Switch role failed", error: err.message });
    }
};


// In controllers/userController.js

export const updateProfile = async (req, res) => {
    console.log('Received PUT /api/users/:id');
    console.log('Request body:', req.body);
    console.log('Authenticated user ID:', req.user?._id);
    console.log('Target user ID:', req.params.id);
    try {
        const userId = req.params.id;

        // Find the user
        const user = await User.findById(userId);
        if (!user) {
            console.log('User not found for ID:', userId);
            return res.status(404).json({ error: 'User not found' });
        }

        // Validate email uniqueness if provided
        const { email, password, rating, reviewCount, ...otherData } = req.body;
        if (email && email !== user.email) {
            const existingEmail = await User.findOne({ email });
            if (existingEmail) {
                console.log('Email already in use:', email);
                return res.status(400).json({ error: 'Email already in use' });
            }
        }

        // Prepare update data, explicitly excluding rating and reviewCount
        const updateData = { ...otherData };
        if (email) updateData.email = email;
        if (password) {
            updateData.password = await bcrypt.hash(password, 10);
        }

        // Update user
        const updatedUser = await User.findByIdAndUpdate(
            userId,
            { $set: updateData },
            { new: true, runValidators: true }
        );

        console.log('Updated user:', updatedUser);

        // Create notification for profile update (non-blocking)
        try {
            await createNotification(
                req.user?._id || userId, // Use authenticated user ID
                "Profile Updated Successfully",
                "Your tasker profile has been updated. You can now switch to tasker mode if all fields are complete.",
                "profile-update"
            );
            console.log("Notification created for profile update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: 'User updated', user: updatedUser });
    } catch (error) {
        console.error('Update user error:', error);
        res.status(500).json({ error: 'Failed to update user', details: error.message });
    }
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
        if (role) filter.role = role;
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


export const
    getUserById = async (req, res) => {
        try {
            const { id } = req.params;

            const user = await User.findById(id);

            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }

            res.status(200).json(user);
        } catch (err) {
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
        const filter = { role: 'tasker' };

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


