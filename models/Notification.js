import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        title: {
            type: String,
            required: true,
        },
        message: {
            type: String,
            required: true,
        },
        type: {
            type: String,
            enum: ["task-posted", "task-completed", "message", "review", "new-tasker", "role-switch"],
            required: true,
        },
        relatedId: {
            type: mongoose.Schema.Types.ObjectId, // e.g., task ID, message ID
            required: false,
        },
        read: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

// Index for performance
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);