// models/Notification.js
import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            // Task lifecycle
            "task-posted",
            "task-accepted",
            "task-accept-confirmed",
            "task-updated",
            "task-deleted",
            "task-delete-confirmed",
            "task-deleted-bidder",
            "task-completed",
            "task-declined",
            "task-decline-confirmed",
            "task-available-again",
            "task-assigned-other",

            // Task Bid related
            "new-bid",
            "bid-submitted",
            "bid-accepted",
            "bid-accept-confirmed",
            "bid-rejected",

            // Completion related
            "completion-requested",
            "completion-request-sent",
            "completion-declined",

            // Communication
            "new-comment",
            "new-reply",
            "new-message",

            // Status updates
            "status-updated",
            "status-update-confirmed",

            // Booking related
            "booking-request",
            "booking-request-sent",
            "booking-confirmed",
            "booking-updated",
            "booking-update-confirmed",
            "booking-cancelled",
            "booking-completed",
            "booking-in-progress",
            "booking-pending",
            "booking-service-changed",
            "booking-deleted",
            "booking-delete-confirmed",
            "booking-status-updated",
            "booking-status-update-confirmed",
            "booking-prompt",

            // Quote request related
            "quote-request",
            "quote-request-sent",
            "quote-accepted",
            "quote-rejected",
            "quote-completed",
            "quote-pending",
            "quote-updated",
            "quote-details-updated",
            "quote-update-confirmed",
            "quote-status-updated",
            "quote-status-update-confirmed",
            "quote-work-completed",
            "quote-deleted",
            "quote-delete-confirmed",
            "service-preparation",

            // Quote bid related
            "quote-bid-received",
            "quote-bid-submitted",
            "quote-bid-accepted",
            "quote-bid-accept-confirmed",
            "quote-bid-rejected",
            "quote-bid-reject-confirmed",

            // Prompts
            "find-tasker-prompt",

            // Payment related
            "refund-initiated",
            "earnings-update",

            // Reviews
            "review",
            "review-prompt",

            // User/Profile related
            "role-switch",
            "profile-updated",

            // Tasker Application related (NEW)
            "tasker-application-submitted",
            "tasker-application-approved",
            "tasker-application-rejected",
            "tasker-application-resubmitted"
        ]
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    isRead: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Add indexes for faster queries
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, isRead: 1 });

export default mongoose.model("Notification", notificationSchema);