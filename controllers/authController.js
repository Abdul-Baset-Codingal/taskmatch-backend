import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
    secure: true,
    sameSite: "none",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// ==== SIGNUP ====
export const signup = async (req, res) => {
    try {
        const { fullName, email, phone, province, password, role } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: "Email already in use" });
        }

        const newUser = await User.create({
            fullName,
            email,
            phone,
            province,
            password, // Assumes pre-save middleware in User model hashes this
            role,
        });

        const token = generateToken(newUser._id);

        res.cookie("token", token, { ...cookieOptions });
        res.cookie("isLoggedIn", "true", {
            ...cookieOptions,
            httpOnly: false,
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                id: newUser._id,
                fullName: newUser.fullName,
                email: newUser.email,
                role: newUser.role,
                token: token,
            },
        });
    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err.message });
    }
};

// ==== LOGIN ====
export const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

        const token = generateToken(user._id);

        res.cookie("token", token, { ...cookieOptions });
        res.cookie("isLoggedIn", "true", {
            ...cookieOptions,
            httpOnly: false,
        });

        res.status(200).json({
            message: "Login successful",
            user: {
                id: user._id,
                fullName: user.fullName,
                email: user.email,
                role: user.role,
            },
        });
    } catch (err) {
        res.status(500).json({ message: "Login failed", error: err.message });
    }
};

// ==== LOGOUT ====
export const logout = async (req, res) => {
    try {
        res.clearCookie("token", {
            ...cookieOptions,
        });

        res.clearCookie("isLoggedIn", {
            ...cookieOptions,
            httpOnly: false,
        });

        res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        res.status(500).json({ message: "Logout failed", error: err.message });
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