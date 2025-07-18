import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

// ==== SIGNUP ====
export const signup = async (req, res) => {
    try {
        const { fullName, email, phone, province, password, role } = req.body;

        const newUser = await User.create({
            fullName,
            email,
            phone,
            province,
            password, // 🔒 ensure password hashing is in model
            role,
        });

        const token = generateToken(newUser._id);

        // Set secure cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production", // ✅ true on Render
            sameSite: "Lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        // Optional: for UI state
        res.cookie("isLoggedIn", "true", {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(201).json({
            message: "User created successfully",
            user: {
                id: newUser._id,
                email: newUser.email,
                fullName: newUser.fullName,
            },
        });
    } catch (err) {
        res.status(500).json({ message: "Signup failed", error: err.message });
    }
};

// ==== LOGIN ====
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Wrong password" });

        const token = generateToken(user._id);

        res.cookie("token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.cookie("isLoggedIn", "true", {
            httpOnly: false,
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            path: "/",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error: error.message });
    }
};

// ==== LOGOUT ====
export const logout = async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
    });

    res.clearCookie("isLoggedIn", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/",
    });

    res.status(200).json({ message: "Logged out successfully" });
};
