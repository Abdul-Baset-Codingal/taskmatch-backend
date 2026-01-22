// utils/activityLogger.js
import { ActivityLog } from "../models/ActivityLog.js";

/**
 * Simple user agent parser (no external dependency)
 */
const parseUserAgent = (userAgentString) => {
    if (!userAgentString) return { browser: "unknown", device: "unknown" };

    const ua = userAgentString.toLowerCase();
    let browser = "unknown";
    let device = "unknown";

    // Detect browser
    if (ua.includes("firefox")) {
        browser = "Firefox";
    } else if (ua.includes("edg/")) {
        browser = "Edge";
    } else if (ua.includes("chrome")) {
        browser = "Chrome";
    } else if (ua.includes("safari")) {
        browser = "Safari";
    } else if (ua.includes("opera") || ua.includes("opr/")) {
        browser = "Opera";
    } else if (ua.includes("msie") || ua.includes("trident/")) {
        browser = "Internet Explorer";
    }

    // Detect device type
    if (ua.includes("mobile") || ua.includes("android") || ua.includes("iphone")) {
        device = "mobile";
    } else if (ua.includes("tablet") || ua.includes("ipad")) {
        device = "tablet";
    } else if (ua.includes("windows") || ua.includes("macintosh") || ua.includes("linux")) {
        device = "desktop";
    }

    return { browser, device };
};

/**
 * Get IP address from request
 */
const getIpAddress = (req) => {
    if (!req) return null;

    return (
        req.ip ||
        req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.headers?.["x-real-ip"] ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        "unknown"
    );
};

/**
 * Main activity logging function
 */
export const logActivity = async ({
    userId = null,
    userEmail = null,
    userName = null,
    userRole = "guest",
    action,
    description,
    req = null,
    metadata = {},
    status = "success",
    module = "other",
    severity = "info",
    sessionId = null,
}) => {
    try {
        const logData = {
            userId,
            userEmail,
            userName,
            userRole,
            action,
            description,
            metadata,
            status,
            module,
            severity,
            sessionId,
        };

        // Extract IP and User Agent from request if provided
        if (req) {
            logData.ipAddress = getIpAddress(req);
            logData.userAgent = req.headers?.["user-agent"] || "unknown";

            const { browser, device } = parseUserAgent(logData.userAgent);
            logData.browser = browser;
            logData.device = device;
        }

        const log = await ActivityLog.create(logData);
        console.log(`📝 Activity Logged: [${action}] - ${description}`);
        return log;
    } catch (error) {
        console.error("❌ Failed to create activity log:", error.message);
        return null;
    }
};

/**
 * Helper function for authentication logs
 */
export const logAuth = async ({
    action,
    user = null,
    req,
    status = "success",
    email = null,
    metadata = {},
    errorMessage = null,
}) => {
    const descriptions = {
        LOGIN: `User ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email || email}) logged in successfully`,
        LOGIN_FAILED: `Failed login attempt for email: ${email || user?.email || "unknown"}${errorMessage ? ` - Reason: ${errorMessage}` : ""}`,
        LOGOUT: `User ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email}) logged out`,
        SIGNUP: `New ${user?.currentRole || "user"} registered: ${user?.firstName || ""} ${user?.lastName || ""} (${user?.email})`,
        SIGNUP_FAILED: `Failed signup attempt for email: ${email || "unknown"}${errorMessage ? ` - Reason: ${errorMessage}` : ""}`,
        OTP_SENT: `OTP sent to email: ${email || user?.email || "unknown"}`,
        OTP_VERIFIED: `OTP verified for email: ${email || user?.email || "unknown"}`,
        OTP_FAILED: `OTP verification failed for email: ${email || user?.email || "unknown"}`,
        PASSWORD_RESET_REQUEST: `Password reset requested for: ${email || user?.email || "unknown"}`,
        PASSWORD_RESET_SUCCESS: `Password reset successful for: ${email || user?.email || "unknown"}`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "guest",
        action,
        description: descriptions[action] || `${action} action performed`,
        req,
        metadata: {
            ...metadata,
            errorMessage: errorMessage || undefined,
        },
        status,
        module: "auth",
        severity: status === "failure" ? "warning" : "info",
    });
};

/**
 * Helper function for task-related logs
 */
export const logTask = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    status = "success",
    metadata = {},
}) => {
    const descriptions = {
        TASK_CREATED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} created a new task: "${taskTitle || taskId}"`
            : `Failed to create task "${taskTitle || "Unknown"}"`,
        TASK_UPDATED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} updated task: "${taskTitle || taskId}"`
            : `Failed to update task "${taskTitle || taskId}"`,
        TASK_DELETED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} deleted task: "${taskTitle || taskId}"`
            : `Failed to delete task "${taskTitle || taskId}"`,
        TASK_VIEWED: `${user?.firstName || "User"} ${user?.lastName || ""} viewed task: "${taskTitle || taskId}"`,
        TASK_CANCELLED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} cancelled task: "${taskTitle || taskId}"`
            : `Failed to cancel task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Task action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for bid-related logs
 */
export const logBid = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    bidId = null,
    offerPrice = null,
    status = "success",
    metadata = {},
}) => {
    const descriptions = {
        BID_PLACED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} placed a bid of $${offerPrice} on task: "${taskTitle || taskId}"`
            : `Failed to place bid on task "${taskTitle || taskId}"`,
        BID_UPDATED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} updated bid to $${offerPrice} on task: "${taskTitle || taskId}"`
            : `Failed to update bid on task "${taskTitle || taskId}"`,
        BID_WITHDRAWN: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} withdrew bid from task: "${taskTitle || taskId}"`
            : `Failed to withdraw bid from task "${taskTitle || taskId}"`,
        BID_ACCEPTED: status === "success"
            ? `Bid of $${offerPrice} accepted for task: "${taskTitle || taskId}"`
            : `Failed to accept bid for task "${taskTitle || taskId}"`,
        BID_REJECTED: status === "success"
            ? `Bid rejected for task: "${taskTitle || taskId}"`
            : `Failed to reject bid for task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "tasker",
        action,
        description: descriptions[action] || `Bid action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            bidId,
            offerPrice,
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for comment-related logs
 */
export const logComment = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    commentId = null,
    commentPreview = null,
    status = "success",
    metadata = {},
}) => {
    const descriptions = {
        COMMENT_ADDED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} commented on task: "${taskTitle || taskId}"`
            : `Failed to add comment on task "${taskTitle || taskId}"`,
        COMMENT_UPDATED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} updated comment on task: "${taskTitle || taskId}"`
            : `Failed to update comment on task "${taskTitle || taskId}"`,
        COMMENT_DELETED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} deleted comment from task: "${taskTitle || taskId}"`
            : `Failed to delete comment from task "${taskTitle || taskId}"`,
        REPLY_ADDED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} replied to comment on task: "${taskTitle || taskId}"`
            : `Failed to reply to comment on task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Comment action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            commentId,
            commentPreview: commentPreview?.substring(0, 100),
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for task acceptance/assignment logs
 */
export const logTaskAcceptance = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    clientId = null,
    amount = null,
    status = "success",
    metadata = {},
}) => {
    const amountFormatted = amount ? `$${(amount / 100).toFixed(2)}` : "";

    const descriptions = {
        TASK_ACCEPTED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} accepted task: "${taskTitle || taskId}"${amountFormatted ? ` for ${amountFormatted}` : ""}`
            : `Failed to accept task "${taskTitle || taskId}"`,
        TASK_COMPLETED: status === "success"
            ? `Task "${taskTitle || taskId}" marked as completed by ${user?.firstName || "User"} ${user?.lastName || ""}`
            : `Failed to complete task "${taskTitle || taskId}"`,
        TASK_REJECTED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} rejected task: "${taskTitle || taskId}"`
            : `Failed to reject task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "tasker",
        action,
        description: descriptions[action] || `Task action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            clientId,
            amount,
            amountFormatted,
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for payment-related logs
 */
export const logPayment = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    amount = null,
    paymentIntentId = null,
    status = "success",
    metadata = {},
}) => {
    const amountFormatted = amount ? `$${(amount / 100).toFixed(2)}` : "$0.00";

    const descriptions = {
        PAYMENT_INITIATED: status === "success"
            ? `Payment of ${amountFormatted} initiated for task: "${taskTitle || taskId}"`
            : `Failed to initiate payment for task "${taskTitle || taskId}"`,
        PAYMENT_AUTHORIZED: status === "success"
            ? `Payment of ${amountFormatted} authorized (held) for task: "${taskTitle || taskId}"`
            : `Failed to authorize payment for task "${taskTitle || taskId}"`,
        PAYMENT_CAPTURED: status === "success"
            ? `Payment of ${amountFormatted} captured for task: "${taskTitle || taskId}"`
            : `Failed to capture payment for task "${taskTitle || taskId}"`,
        PAYMENT_COMPLETED: status === "success"
            ? `Payment of ${amountFormatted} completed for task: "${taskTitle || taskId}"`
            : `Payment failed for task "${taskTitle || taskId}"`,
        PAYMENT_FAILED: `Payment of ${amountFormatted} failed for task: "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Payment action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            amount,
            amountFormatted,
            paymentIntentId,
            ...metadata,
        },
        status,
        module: "payment",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for booking-related logs
 */
// export const logBooking = async ({
//     action,
//     user,
//     req,
//     bookingId = null,
//     taskTitle = null,
//     status = "success",
//     metadata = {},
// }) => {
//     const descriptions = {
//         BOOKING_CREATED: `${user?.firstName} ${user?.lastName} created a booking for: "${taskTitle || bookingId}"`,
//         BOOKING_ACCEPTED: `Tasker ${user?.firstName} ${user?.lastName} accepted booking: "${bookingId}"`,
//         BOOKING_REJECTED: `Tasker ${user?.firstName} ${user?.lastName} rejected booking: "${bookingId}"`,
//         BOOKING_COMPLETED: `Booking completed: "${bookingId}"`,
//         BOOKING_CANCELLED: `${user?.firstName} ${user?.lastName} cancelled booking: "${bookingId}"`,
//         BOOKING_UPDATED: `${user?.firstName} ${user?.lastName} updated booking: "${bookingId}"`,
//     };

//     return logActivity({
//         userId: user?._id || user?.id,
//         userEmail: user?.email,
//         userName: `${user?.firstName} ${user?.lastName}`,
//         userRole: user?.currentRole || "client",
//         action,
//         description: descriptions[action] || `Booking action: ${action}`,
//         req,
//         metadata: {
//             bookingId,
//             taskTitle,
//             ...metadata,
//         },
//         status,
//         module: "booking",
//     });
// };

/**
 * Helper function for admin actions
 */
export const logAdminAction = async ({
    action,
    admin,
    targetUser = null,
    req,
    status = "success",
    metadata = {},
}) => {
    const descriptions = {
        USER_BLOCKED: `Admin ${admin?.firstName} ${admin?.lastName} blocked user: ${targetUser?.email}`,
        USER_UNBLOCKED: `Admin ${admin?.firstName} ${admin?.lastName} unblocked user: ${targetUser?.email}`,
        TASKER_APPROVED: `Admin ${admin?.firstName} ${admin?.lastName} approved tasker: ${targetUser?.email}`,
        TASKER_REJECTED: `Admin ${admin?.firstName} ${admin?.lastName} rejected tasker: ${targetUser?.email}`,
        ADMIN_ACTION: `Admin ${admin?.firstName} ${admin?.lastName} performed action`,
    };

    return logActivity({
        userId: admin?._id || admin?.id,
        userEmail: admin?.email,
        userName: `${admin?.firstName} ${admin?.lastName}`,
        userRole: "admin",
        action,
        description: descriptions[action] || `Admin action: ${action}`,
        req,
        metadata: {
            targetUserId: targetUser?._id,
            targetUserEmail: targetUser?.email,
            ...metadata,
        },
        status,
        module: "admin",
        severity: "warning",
    });
};


// utils/activityLogger.js - Add this new helper function

/**
 * Helper function for review-related logs
 */
export const logReview = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    reviewId = null,
    rating = null,
    revieweeId = null,
    revieweeName = null,
    status = "success",
    metadata = {},
}) => {
    const ratingStars = rating ? "⭐".repeat(Math.round(rating)) : "";

    const descriptions = {
        REVIEW_POSTED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} posted a ${rating}-star review ${ratingStars} for ${revieweeName || "tasker"} on task: "${taskTitle || taskId}"`
            : `Failed to post review for task "${taskTitle || taskId}"`,
        REVIEW_UPDATED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} updated review to ${rating} stars for task: "${taskTitle || taskId}"`
            : `Failed to update review for task "${taskTitle || taskId}"`,
        REVIEW_DELETED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} deleted review from task: "${taskTitle || taskId}"`
            : `Failed to delete review from task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Review action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            reviewId,
            rating,
            ratingStars,
            revieweeId,
            revieweeName,
            ...metadata,
        },
        status,
        module: "review",
        severity: status === "failure" ? "error" : "info",
    });
};

// utils/activityLogger.js - Add these new helper functions

/**
 * Helper function for booking-related logs (Enhanced version)
 */
export const logBooking = async ({
    action,
    user,
    req,
    bookingId = null,
    taskerId = null,
    taskerName = null,
    serviceTitle = null,
    amount = null,
    status = "success",
    metadata = {},
}) => {
    const amountFormatted = amount ? `$${amount.toFixed(2)}` : "";

    const descriptions = {
        BOOKING_CREATED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} created a booking for "${serviceTitle}"${taskerName ? ` with ${taskerName}` : ""}${amountFormatted ? ` - Total: ${amountFormatted}` : ""}`
            : `Failed to create booking for "${serviceTitle || "service"}"`,
        BOOKING_CONFIRMED: status === "success"
            ? `Booking "${bookingId}" confirmed for "${serviceTitle}"${amountFormatted ? ` - Amount: ${amountFormatted}` : ""}`
            : `Failed to confirm booking "${bookingId}"`,
        BOOKING_ACCEPTED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} accepted booking for "${serviceTitle}"`
            : `Failed to accept booking "${bookingId}"`,
        BOOKING_REJECTED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} rejected booking for "${serviceTitle}"`
            : `Failed to reject booking "${bookingId}"`,
        BOOKING_COMPLETED: status === "success"
            ? `Booking "${serviceTitle}" marked as completed${amountFormatted ? ` - Paid: ${amountFormatted}` : ""}`
            : `Failed to complete booking "${bookingId}"`,
        BOOKING_CANCELLED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} cancelled booking for "${serviceTitle}"`
            : `Failed to cancel booking "${bookingId}"`,
        BOOKING_UPDATED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} updated booking "${bookingId}"`
            : `Failed to update booking "${bookingId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Booking action: ${action}`,
        req,
        metadata: {
            bookingId,
            taskerId,
            taskerName,
            serviceTitle,
            amount,
            amountFormatted,
            ...metadata,
        },
        status,
        module: "booking",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for quote request logs
 */
export const logQuoteRequest = async ({
    action,
    user,
    req,
    quoteId = null,
    taskerId = null,
    taskerName = null,
    taskTitle = null,
    budget = null,
    status = "success",
    metadata = {},
}) => {
    const budgetFormatted = budget ? `$${budget}` : "Negotiable";

    const descriptions = {
        QUOTE_REQUESTED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} requested a quote for "${taskTitle}"${taskerName ? ` from ${taskerName}` : ""} - Budget: ${budgetFormatted}`
            : `Failed to request quote for "${taskTitle || "task"}"`,
        QUOTE_RESPONDED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} responded to quote request for "${taskTitle}"`
            : `Failed to respond to quote "${quoteId}"`,
        QUOTE_ACCEPTED: status === "success"
            ? `Quote accepted for "${taskTitle}" - Budget: ${budgetFormatted}`
            : `Failed to accept quote "${quoteId}"`,
        QUOTE_REJECTED: status === "success"
            ? `Quote rejected for "${taskTitle}"`
            : `Failed to reject quote "${quoteId}"`,
        QUOTE_EXPIRED: `Quote request for "${taskTitle}" has expired`,
        QUOTE_CANCELLED: status === "success"
            ? `${user?.firstName || "User"} ${user?.lastName || ""} cancelled quote request for "${taskTitle}"`
            : `Failed to cancel quote "${quoteId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Quote action: ${action}`,
        req,
        metadata: {
            quoteId,
            taskerId,
            taskerName,
            taskTitle,
            budget,
            budgetFormatted,
            ...metadata,
        },
        status,
        module: "booking",
        severity: status === "failure" ? "error" : "info",
    });
};


// utils/activityLogger.js - Add these new helper functions

/**
 * Helper function for task completion-related logs
 */
export const logTaskCompletion = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    taskerId = null,
    taskerName = null,
    clientId = null,
    clientName = null,
    amount = null,
    status = "success",
    metadata = {},
}) => {
    const amountFormatted = amount ? `$${(amount / 100).toFixed(2)}` : "";

    const descriptions = {
        COMPLETION_REQUESTED: status === "success"
            ? `${user?.firstName || "Tasker"} ${user?.lastName || ""} requested completion for task: "${taskTitle || taskId}"`
            : `Failed to request completion for task "${taskTitle || taskId}"`,
        COMPLETION_APPROVED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} approved completion for task: "${taskTitle || taskId}"${amountFormatted ? ` - Payment: ${amountFormatted}` : ""}`
            : `Failed to approve completion for task "${taskTitle || taskId}"`,
        COMPLETION_REJECTED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} rejected completion for task: "${taskTitle || taskId}"`
            : `Failed to reject completion for task "${taskTitle || taskId}"`,
        TASK_COMPLETED: status === "success"
            ? `Task "${taskTitle || taskId}" completed successfully${amountFormatted ? ` - Payment captured: ${amountFormatted}` : ""}`
            : `Failed to complete task "${taskTitle || taskId}"`,
        TASK_NOT_COMPLETED: status === "success"
            ? `Task "${taskTitle || taskId}" marked as not completed - Payment cancelled`
            : `Failed to mark task "${taskTitle || taskId}" as not completed`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Task completion action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            taskerId,
            taskerName,
            clientId,
            clientName,
            amount,
            amountFormatted,
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};

/**
 * Helper function for bid acceptance logs
 */
export const logBidAcceptance = async ({
    action,
    user,
    req,
    taskId = null,
    taskTitle = null,
    bidId = null,
    taskerId = null,
    taskerName = null,
    bidAmount = null,
    totalAmount = null,
    taskerPayout = null,
    status = "success",
    metadata = {},
}) => {
    const bidFormatted = bidAmount ? `$${bidAmount.toFixed(2)}` : "";
    const totalFormatted = totalAmount ? `$${(totalAmount / 100).toFixed(2)}` : "";
    const payoutFormatted = taskerPayout ? `$${(taskerPayout / 100).toFixed(2)}` : "";

    const descriptions = {
        BID_ACCEPTED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} accepted ${taskerName || "tasker"}'s bid of ${bidFormatted} for task: "${taskTitle || taskId}" - Total: ${totalFormatted}`
            : `Failed to accept bid for task "${taskTitle || taskId}"`,
        BID_REJECTED: status === "success"
            ? `${user?.firstName || "Client"} ${user?.lastName || ""} rejected bid from ${taskerName || "tasker"} for task: "${taskTitle || taskId}"`
            : `Failed to reject bid for task "${taskTitle || taskId}"`,
    };

    return logActivity({
        userId: user?._id || user?.id || null,
        userEmail: user?.email || null,
        userName: user ? `${user.firstName} ${user.lastName}` : null,
        userRole: user?.currentRole || "client",
        action,
        description: descriptions[action] || `Bid action: ${action}`,
        req,
        metadata: {
            taskId,
            taskTitle,
            bidId,
            taskerId,
            taskerName,
            bidAmount,
            bidFormatted,
            totalAmount,
            totalFormatted,
            taskerPayout,
            payoutFormatted,
            ...metadata,
        },
        status,
        module: "task",
        severity: status === "failure" ? "error" : "info",
    });
};


// utils/activityLogger.js - Make sure to export all functions

