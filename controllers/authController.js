import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/user.js";

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
    });
};

export const signup = async (req, res) => {
    const { fullName, email, phone, province, password, role } = req.body;
    console.log("Incoming signup data:", req.body);
    try {
        const userExists = await User.findOne({ email });
        if (userExists) return res.status(400).json({ message: "User already exists" });
        console.log("Incoming password:", req.body.password);

        const hashedPassword = await bcrypt.hash(password, 10);
        console.log(req.body);
        const newUser = await User.create({
            fullName,
            email,
            phone,
            province,
            password: hashedPassword,
            role,
        });

        const token = generateToken(newUser._id);

        res.status(201).json({
            _id: newUser._id,
            fullName: newUser.fullName,
            email: newUser.email,
            role: newUser.role,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: "Signup failed", error: error.message });

        console.error("Signup error:", error);
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

        res.status(200).json({
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            role: user.role,
            token,
        });
    } catch (error) {
        res.status(500).json({ message: "Login failed", error: error.message });
    }
};
