import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";
import { createNotification } from "./notificationHelper.js"; // Helper for creating

// Get user's notifications
export const getNotifications = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;
        if (!userId) return res.status(401).json({ message: "Invalid token" });

        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20)
            .lean();

        const unreadCount = await Notification.countDocuments({ user: userId, read: false });

        res.json({ notifications, unreadCount });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};

// Mark single as read
export const markAsRead = async (req, res) => {
    try {
        const { id } = req.params;
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;
        if (!userId) return res.status(401).json({ message: "Invalid token" });

        const notification = await Notification.findOneAndUpdate(
            { _id: id, user: userId },
            { read: true },
            { new: true }
        );

        if (!notification) return res.status(404).json({ message: "Notification not found" });

        res.json({ message: "Marked as read" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to mark as read" });
    }
};

// Mark all as read
export const markAllAsRead = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;
        if (!userId) return res.status(401).json({ message: "Invalid token" });

        await Notification.updateMany({ user: userId, read: false }, { read: true });

        res.json({ message: "All marked as read" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to mark all as read" });
    }
};