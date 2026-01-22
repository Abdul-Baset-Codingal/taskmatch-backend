// models/ActivityLog.js
import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            default: null, // null for failed attempts where user doesn't exist
        },
        userEmail: {
            type: String,
            default: null,
        },
        userName: {
            type: String,
            default: null,
        },
        userRole: {
            type: String,
            enum: ["client", "tasker", "admin", "guest", "unknown"],
            default: "guest",
        },
        action: {
            type: String,
            required: true,
            enum: [
                // Auth actions
                "LOGIN",
                "LOGIN_FAILED",
                "LOGOUT",
                "SIGNUP",
                "SIGNUP_FAILED",
                "PASSWORD_RESET_REQUEST",
                "PASSWORD_RESET_SUCCESS",
                "PASSWORD_CHANGE",
                "OTP_SENT",
                "OTP_VERIFIED",
                "OTP_FAILED",

                // Task actions
                "TASK_CREATED",
                "TASK_UPDATED",
                "TASK_DELETED",
                "TASK_VIEWED",
                "TASK_CANCELLED",

                // Booking actions
                "BOOKING_CREATED",
                "BOOKING_CONFIRMED",
                "BOOKING_ACCEPTED",
                "BOOKING_REJECTED",
                "BOOKING_COMPLETED",
                "BOOKING_CANCELLED",
                "BOOKING_UPDATED",

                // Quote actions (NEW)
                "QUOTE_REQUESTED",
                "QUOTE_RESPONDED",
                "QUOTE_ACCEPTED",
                "QUOTE_REJECTED",
                "QUOTE_EXPIRED",
                "QUOTE_CANCELLED",

                // Profile actions
                "PROFILE_UPDATED",
                "PROFILE_PICTURE_UPDATED",
                "AVAILABILITY_UPDATED",

                "COMPLETION_REQUESTED",
                "COMPLETION_APPROVED",
                "COMPLETION_REJECTED",
                "TASK_COMPLETED",
                "TASK_NOT_COMPLETED",
                // Payment actions
                "PAYMENT_INITIATED",
                "PAYMENT_COMPLETED",
                "PAYMENT_FAILED",
                "WITHDRAWAL_REQUEST",
                "WITHDRAWAL_COMPLETED",

                // Review actions
                "REVIEW_POSTED",
                "REVIEW_UPDATED",
                "REVIEW_DELETED",

                // Admin actions
                "USER_BLOCKED",
                "USER_UNBLOCKED",
                "TASKER_APPROVED",
                "TASKER_REJECTED",
                "ADMIN_ACTION",

                // Communication
                "MESSAGE_SENT",
                "NOTIFICATION_SENT",

                // Other
                "ROLE_SWITCHED",
                "ACCOUNT_DELETED",
                "OTHER",
            ],
        },
        description: {
            type: String,
            required: true,
        },
        ipAddress: {
            type: String,
            default: null,
        },
        userAgent: {
            type: String,
            default: null,
        },
        browser: {
            type: String,
            default: null,
        },
        device: {
            type: String,
            enum: ["desktop", "mobile", "tablet", "unknown"],
            default: "unknown",
        },
        location: {
            country: { type: String, default: null },
            city: { type: String, default: null },
            region: { type: String, default: null },
        },
        metadata: {
            type: mongoose.Schema.Types.Mixed,
            default: {},
        },
        status: {
            type: String,
            enum: ["success", "failure", "pending", "warning"],
            default: "success",
        },
        module: {
            type: String,
            enum: [
                "auth",
                "task",
                "booking",
                "payment",
                "review",
                "profile",
                "admin",
                "communication",
                "other",
            ],
            default: "other",
        },
        severity: {
            type: String,
            enum: ["info", "warning", "error", "critical"],
            default: "info",
        },
        sessionId: {
            type: String,
            default: null,
        },
    },
    {
        timestamps: true,
    }
);

// Indexes for efficient querying
activityLogSchema.index({ userId: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ userRole: 1, createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });
activityLogSchema.index({ status: 1 });
activityLogSchema.index({ userEmail: 1 });

// TTL index - automatically delete logs older than 90 days (optional)
// activityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);