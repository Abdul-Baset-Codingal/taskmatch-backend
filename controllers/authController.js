import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";
import cookieParser from "cookie-parser";


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
    secure: true,           // required with sameSite:none
    sameSite: "none",       // allows cross-site cookie sending
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",              // cookie applies to all backend routes
};


const statusCookieOptions = {
    httpOnly: false,          // accessible by JS on frontend
    secure: true,             // sent only over HTTPS
    sameSite: "none",         // allows cross-site cookie sending
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    path: "/",                // cookie applies to all backend routes
};

export const signup = async (req, res) => {
    try {
        const { fullName, email, phone, postalCode, password, role } = req.body;

        const existing = await User.findOne({ email });
        if (existing) return res.status(400).json({ message: "User already exists" });

        const hashedPassword = await bcrypt.hash(password, 10);

        const userData = {
            fullName,
            email,
            phone,
            postalCode,
            password: hashedPassword,
            role,
        };

        // Add tasker-specific fields only if role is 'tasker'
        if (role === "tasker") {
            userData.categories = req.body.serviceCategories || [];
            userData.skills = req.body.skills || [];
            userData.yearsOfExperience = req.body.experienceYears || "";
            userData.qualifications = req.body.qualifications || [];
            userData.services = req.body.services || [];
            userData.certifications = req.body.certifications || [];
            userData.backgroundCheckConsent = req.body.backgroundCheckConsent || false;
            userData.hasInsurance = req.body.hasInsurance || false;
            userData.availability = req.body.availability || [];
            userData.serviceAreas = req.body.serviceAreas || [];
            // add other tasker fields as needed
        }

        const user = await User.create(userData);

        const token = createToken(user._id);

        res.cookie("token", token, tokenCookieOptions);
        res.cookie("isLoggedIn", "true", statusCookieOptions);

        res.status(201).json({ message: "Signup successful", user });
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



export const verifyToken = async (req, res) => {
    const token = req.cookies.token;

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


export const getTaskersByCategory = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            category = '',
            search = '',
            province = '',
            availability = '', // e.g., "Monday" or "All"
            rating = '', // e.g., "4" for 4+ stars
            experience = '', // e.g., "5" for 5+ years
            minPrice = '', // e.g., "20" for min hourly rate
            maxPrice = '', // e.g., "50" for max hourly rate
        } = req.query;

        // Build the filter object
        const filter = { role: 'tasker' };

        // 🔍 Filter by serviceCategories (case-insensitive)
        if (category) {
            filter.categories = {
                $elemMatch: { $regex: new RegExp(category, 'i') },
            };
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

        // ⭐ Filter by rating (assuming rating is stored or calculated)
        if (rating && rating !== 'All Ratings') {
            filter.rating = { $gte: parseFloat(rating) }; // Assumes rating is a number field in the schema
        }

        // 🛠️ Filter by experience (yearsOfExperience)
        if (experience && experience !== 'All Levels') {
            filter.yearsOfExperience = { $gte: parseInt(experience) };
        }

        // 💰 Filter by price range (hourlyRate in services)
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
            .select('-password') // Exclude sensitive data
            .limit(parseInt(limit))
            .skip(skip)
            .sort({ createdAt: -1 }); // Sort by newest first

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