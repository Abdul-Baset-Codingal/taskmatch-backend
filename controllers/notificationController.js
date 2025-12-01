import jwt from "jsonwebtoken";
import Notification from "../models/Notification.js";
import { createNotification } from "./notificationHelper.js"; // Helper for creating

// Mark single notification as read
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
            { isRead: true },  // FIX: Changed from 'read' to 'isRead'
            { new: true }
        );

        if (!notification) return res.status(404).json({ message: "Notification not found" });

        res.json({ message: "Marked as read", notification });
    } catch (err) {
        console.error("Error marking as read:", err);
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

        await Notification.updateMany(
            { user: userId, isRead: false },  // FIX: Changed from 'read' to 'isRead'
            { isRead: true }  // FIX: Changed from 'read' to 'isRead'
        );

        res.json({ message: "All marked as read" });
    } catch (err) {
        console.error("Error marking all as read:", err);
        res.status(500).json({ message: "Failed to mark all as read" });
    }
};

// Get notifications (update this too)
export const getNotifications = async (req, res) => {
    try {
        const token = req.cookies.token;
        if (!token) return res.status(401).json({ message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId || decoded._id;
        if (!userId) return res.status(401).json({ message: "Invalid token" });

        const notifications = await Notification.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(20);

        // Map isRead to read for frontend compatibility
        const formattedNotifications = notifications.map(notif => ({
            id: notif._id,
            title: notif.title,
            message: notif.message,
            date: notif.createdAt,
            type: notif.type,
            read: notif.isRead,  // Map isRead to read for frontend
            relatedId: notif.relatedId
        }));

        const unreadCount = await Notification.countDocuments({
            user: userId,
            isRead: false  // FIX: Use isRead
        });

        res.json({
            notifications: formattedNotifications,
            unreadCount
        });
    } catch (err) {
        console.error("Error fetching notifications:", err);
        res.status(500).json({ message: "Failed to fetch notifications" });
    }
};