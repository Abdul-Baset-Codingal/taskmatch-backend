// controllers/adminLogController.js
import { ActivityLog } from "../models/ActivityLog.js";

/**
 * Get all activity logs with pagination and filters
 */
export const getAllLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            action,
            module,
            status,
            userRole,
            userId,
            userEmail,
            startDate,
            endDate,
            search,
            severity,
            sortBy = "createdAt",
            sortOrder = "desc",
        } = req.query;

        // Build filter query
        const filter = {};

        if (action) filter.action = action;
        if (module) filter.module = module;
        if (status) filter.status = status;
        if (userRole) filter.userRole = userRole;
        if (userId) filter.userId = userId;
        if (severity) filter.severity = severity;

        if (userEmail) {
            filter.userEmail = { $regex: userEmail, $options: "i" };
        }

        if (search) {
            filter.$or = [
                { description: { $regex: search, $options: "i" } },
                { userEmail: { $regex: search, $options: "i" } },
                { userName: { $regex: search, $options: "i" } },
            ];
        }

        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        // Pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);
        const sortOptions = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

        // Execute query
        const [logs, total] = await Promise.all([
            ActivityLog.find(filter)
                .sort(sortOptions)
                .skip(skip)
                .limit(parseInt(limit))
                .populate("userId", "firstName lastName email profilePicture")
                .lean(),
            ActivityLog.countDocuments(filter),
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(total / parseInt(limit));

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalLogs: total,
                limit: parseInt(limit),
                hasNextPage: parseInt(page) < totalPages,
                hasPrevPage: parseInt(page) > 1,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch logs",
            error: err.message,
        });
    }
};

/**
 * Get log statistics for dashboard
 */
export const getLogStats = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        // Get various statistics
        const [
            totalLogs,
            logsByAction,
            logsByModule,
            logsByStatus,
            logsByRole,
            recentFailures,
            dailyStats,
        ] = await Promise.all([
            // Total logs count
            ActivityLog.countDocuments(dateFilter),

            // Logs grouped by action
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$action", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // Logs grouped by module
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$module", count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),

            // Logs grouped by status
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$status", count: { $sum: 1 } } },
            ]),

            // Logs grouped by user role
            ActivityLog.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$userRole", count: { $sum: 1 } } },
            ]),

            // Recent failures
            ActivityLog.find({ ...dateFilter, status: "failure" })
                .sort({ createdAt: -1 })
                .limit(10)
                .lean(),

            // Daily statistics for last 7 days
            ActivityLog.aggregate([
                {
                    $match: {
                        createdAt: {
                            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
                        },
                    },
                },
                {
                    $group: {
                        _id: {
                            $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                        },
                        total: { $sum: 1 },
                        logins: {
                            $sum: { $cond: [{ $eq: ["$action", "LOGIN"] }, 1, 0] },
                        },
                        signups: {
                            $sum: { $cond: [{ $eq: ["$action", "SIGNUP"] }, 1, 0] },
                        },
                        failures: {
                            $sum: { $cond: [{ $eq: ["$status", "failure"] }, 1, 0] },
                        },
                    },
                },
                { $sort: { _id: 1 } },
            ]),
        ]);

        res.status(200).json({
            success: true,
            stats: {
                totalLogs,
                byAction: logsByAction,
                byModule: logsByModule,
                byStatus: logsByStatus,
                byRole: logsByRole,
                recentFailures,
                dailyStats,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch log statistics",
            error: err.message,
        });
    }
};

/**
 * Get logs for a specific user
 */
export const getUserLogs = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find({ userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            ActivityLog.countDocuments({ userId }),
        ]);

        res.status(200).json({
            success: true,
            data: logs,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(total / parseInt(limit)),
                totalLogs: total,
            },
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch user logs",
            error: err.message,
        });
    }
};

/**
 * Get real-time logs (for live dashboard)
 */
export const getRecentLogs = async (req, res) => {
    try {
        const { limit = 20 } = req.query;

        const logs = await ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate("userId", "firstName lastName email profilePicture")
            .lean();

        res.status(200).json({
            success: true,
            data: logs,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch recent logs",
            error: err.message,
        });
    }
};

/**
 * Delete old logs (cleanup)
 */
export const deleteOldLogs = async (req, res) => {
    try {
        const { daysOld = 90 } = req.body;

        const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);

        const result = await ActivityLog.deleteMany({
            createdAt: { $lt: cutoffDate },
        });

        res.status(200).json({
            success: true,
            message: `Deleted ${result.deletedCount} logs older than ${daysOld} days`,
            deletedCount: result.deletedCount,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to delete old logs",
            error: err.message,
        });
    }
};

/**
 * Export logs as CSV
 */
export const exportLogs = async (req, res) => {
    try {
        const { startDate, endDate, action, module, format = "json" } = req.query;

        const filter = {};
        if (action) filter.action = action;
        if (module) filter.module = module;
        if (startDate || endDate) {
            filter.createdAt = {};
            if (startDate) filter.createdAt.$gte = new Date(startDate);
            if (endDate) filter.createdAt.$lte = new Date(endDate);
        }

        const logs = await ActivityLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(10000) // Limit export to 10k records
            .lean();

        if (format === "csv") {
            // Convert to CSV
            const headers = [
                "Timestamp",
                "User Email",
                "User Name",
                "Role",
                "Action",
                "Description",
                "Status",
                "IP Address",
                "Browser",
            ].join(",");

            const rows = logs.map((log) =>
                [
                    new Date(log.createdAt).toISOString(),
                    log.userEmail || "",
                    log.userName || "",
                    log.userRole || "",
                    log.action || "",
                    `"${(log.description || "").replace(/"/g, '""')}"`,
                    log.status || "",
                    log.ipAddress || "",
                    log.browser || "",
                ].join(",")
            );

            const csv = [headers, ...rows].join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=activity_logs_${new Date().toISOString().split("T")[0]}.csv`
            );
            return res.send(csv);
        }

        res.status(200).json({
            success: true,
            data: logs,
            count: logs.length,
        });
    } catch (err) {
        res.status(500).json({
            success: false,
            message: "Failed to export logs",
            error: err.message,
        });
    }
};