
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

// Allow frontend origin and credentials


const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};




export const signup = async (req, res) => {
    try {
        const { fullName, email, phone, province, password, role } = req.body;

        // 1. Create user in DB
        const newUser = await User.create({
            fullName,
            email,
            phone,
            province,
            password, // make sure you're hashing password in model or here
            role,
        });

        // 2. Create token
        const token = generateToken(newUser._id);

        // 3. Set cookie
        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });


        // 4. Send response
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
export const login = async (req, res) => {
    const { email, password } = req.body;

    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: "Invalid credentials" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ message: "Wrong password" });

        const token = generateToken(user._id);

        // Set token cookie
        res.cookie("token", token, {
            httpOnly: true,                // secure flag for token
            secure: process.env.NODE_ENV === "production", // only true in production
            sameSite: "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
            path: "/",
        });

        // Set isLoggedIn cookie for UI state
        res.cookie("isLoggedIn", "true", {
            httpOnly: false,     // accessible from JS
            secure: process.env.NODE_ENV === "production",
            sameSite: "Lax",
            maxAge: 7 * 24 * 60 * 60 * 1000,
            path: "/",
        });

        // Send user data response
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

export const logout = async (req, res) => {
    res.clearCookie("token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production", // match your original setup
        sameSite: "Lax", // same as used in setting the cookie
        path: "/", // ✅ important to match the path used in cookie
    });

    res.clearCookie("isLoggedIn", {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "Lax",
        path: "/", // ✅ important
    });

    res.status(200).json({ message: "Logged out successfully" });
};

