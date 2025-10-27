import Notification from "../models/Notification.js";

export const createNotification = async (userId, title, message, type, relatedId = null) => {
    try {
        const notification = new Notification({
            user: userId,
            title,
            message,
            type,
            relatedId,
        });
        await notification.save();
        console.log("Created notification:", notification._id); // Debug
        return notification;
    } catch (err) {
        console.error("Failed to create notification:", err);
    }
};