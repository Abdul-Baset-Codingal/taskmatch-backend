// controllers/adminTaskController.js
import Task from "../models/task.js";
import User from "../models/user.js";
import mongoose from "mongoose";

// ==================== GET ALL TASKS FOR ADMIN ====================
export const getAllTasksAdmin = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            schedule,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            startDate,
            endDate,
            minPrice,
            maxPrice,
            hasPayment,
            clientId,
            taskerId
        } = req.query;

        // Build query
        const query = {};

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Schedule filter
        if (schedule && schedule !== 'all') {
            query.schedule = schedule;
        }

        // Search filter (title, description, location)
        if (search) {
            query.$or = [
                { taskTitle: { $regex: search, $options: 'i' } },
                { taskDescription: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
                { serviceTitle: { $regex: search, $options: 'i' } }
            ];
        }

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        // Price range filter
        if (minPrice || maxPrice) {
            query.price = {};
            if (minPrice) query.price.$gte = parseFloat(minPrice);
            if (maxPrice) query.price.$lte = parseFloat(maxPrice);
        }

        // Payment status filter
        if (hasPayment === 'true') {
            query['payment.status'] = { $exists: true, $ne: null };
        } else if (hasPayment === 'false') {
            query['payment.status'] = { $exists: false };
        }

        // Client filter
        if (clientId) {
            query.client = new mongoose.Types.ObjectId(clientId);
        }

        // Tasker filter
        if (taskerId) {
            query.acceptedBy = new mongoose.Types.ObjectId(taskerId);
        }

        // Build sort
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [tasks, totalCount] = await Promise.all([
            Task.find(query)
                .populate('client', 'firstName lastName email profilePicture phone')
                .populate('acceptedBy', 'firstName lastName email profilePicture phone')
                .populate('bids.taskerId', 'firstName lastName email profilePicture')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            Task.countDocuments(query)
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / parseInt(limit));
        const hasNextPage = parseInt(page) < totalPages;
        const hasPrevPage = parseInt(page) > 1;

        res.status(200).json({
            success: true,
            data: tasks,
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                totalCount,
                limit: parseInt(limit),
                hasNextPage,
                hasPrevPage
            }
        });
    } catch (error) {
        console.error("Error fetching admin tasks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch tasks",
            error: error.message
        });
    }
};

// ==================== GET SINGLE TASK (ADMIN) ====================
export const getTaskByIdAdmin = async (req, res) => {
    try {
        const { taskId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID"
            });
        }

        const task = await Task.findById(taskId)
            .populate('client', 'firstName lastName email profilePicture phone createdAt')
            .populate('acceptedBy', 'firstName lastName email profilePicture phone createdAt')
            .populate('bids.taskerId', 'firstName lastName email profilePicture')
            .populate('comments.userId', 'firstName lastName profilePicture')
            .populate('messages.sender', 'firstName lastName profilePicture')
            .lean();

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        res.status(200).json({
            success: true,
            data: task
        });
    } catch (error) {
        console.error("Error fetching task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch task",
            error: error.message
        });
    }
};

// ==================== UPDATE TASK (ADMIN) ====================
export const updateTaskAdmin = async (req, res) => {
    try {
        const { taskId } = req.params;
        const updateData = req.body;

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID"
            });
        }

        // Fields that admin can update
        const allowedFields = [
            'taskTitle',
            'taskDescription',
            'location',
            'schedule',
            'estimatedTime',
            'price',
            'status',
            'additionalInfo',
            'offerDeadline',
            'extraCharge',
            'stripeStatus'
        ];

        // Filter out fields that shouldn't be updated
        const filteredUpdate = {};
        for (const key of allowedFields) {
            if (updateData[key] !== undefined) {
                filteredUpdate[key] = updateData[key];
            }
        }

        // Handle nested payment updates
        if (updateData.payment) {
            for (const key in updateData.payment) {
                filteredUpdate[`payment.${key}`] = updateData.payment[key];
            }
        }

        const task = await Task.findByIdAndUpdate(
            taskId,
            { $set: filteredUpdate },
            { new: true, runValidators: true }
        )
            .populate('client', 'firstName lastName email profilePicture')
            .populate('acceptedBy', 'firstName lastName email profilePicture');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Task updated successfully",
            data: task
        });
    } catch (error) {
        console.error("Error updating task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update task",
            error: error.message
        });
    }
};

// ==================== DELETE TASK (ADMIN) ====================
export const deleteTaskAdmin = async (req, res) => {
    try {
        const { taskId } = req.params;

        console.log(req.params)

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID"
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        // Check if task has active payment - might need special handling
        if (task.payment?.status === 'held' || task.payment?.status === 'captured') {
            return res.status(400).json({
                success: false,
                message: "Cannot delete task with active payment. Please refund first."
            });
        }

        await Task.findByIdAndDelete(taskId);

        res.status(200).json({
            success: true,
            message: "Task deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete task",
            error: error.message
        });
    }
};

// ==================== BULK DELETE TASKS (ADMIN) ====================
export const bulkDeleteTasksAdmin = async (req, res) => {
    try {
        const { taskIds } = req.body;

        if (!Array.isArray(taskIds) || taskIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Task IDs array is required"
            });
        }

        // Validate all IDs
        const validIds = taskIds.filter(id => mongoose.Types.ObjectId.isValid(id));

        if (validIds.length !== taskIds.length) {
            return res.status(400).json({
                success: false,
                message: "Some task IDs are invalid"
            });
        }

        // Check for tasks with active payments
        const tasksWithPayments = await Task.find({
            _id: { $in: validIds },
            'payment.status': { $in: ['held', 'captured'] }
        }).select('_id taskTitle');

        if (tasksWithPayments.length > 0) {
            return res.status(400).json({
                success: false,
                message: "Some tasks have active payments and cannot be deleted",
                tasksWithPayments: tasksWithPayments.map(t => ({
                    id: t._id,
                    title: t.taskTitle
                }))
            });
        }

        const result = await Task.deleteMany({ _id: { $in: validIds } });

        res.status(200).json({
            success: true,
            message: `${result.deletedCount} tasks deleted successfully`,
            deletedCount: result.deletedCount
        });
    } catch (error) {
        console.error("Error bulk deleting tasks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete tasks",
            error: error.message
        });
    }
};

// ==================== GET TASK STATISTICS (ADMIN) ====================
export const getTaskStatistics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        const dateFilter = {};
        if (startDate || endDate) {
            dateFilter.createdAt = {};
            if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
            if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
        }

        const [
            totalTasks,
            statusCounts,
            scheduleCounts,
            paymentStats,
            recentTasks,
            topClients,
            topTaskers,
            priceStats,
            dailyStats
        ] = await Promise.all([
            // Total tasks
            Task.countDocuments(dateFilter),

            // Count by status
            Task.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$status", count: { $sum: 1 } } }
            ]),

            // Count by schedule type
            Task.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$schedule", count: { $sum: 1 } } }
            ]),

            // Payment statistics
            Task.aggregate([
                { $match: { ...dateFilter, 'payment.status': { $exists: true } } },
                {
                    $group: {
                        _id: "$payment.status",
                        count: { $sum: 1 },
                        totalAmount: { $sum: "$payment.totalClientPays" }
                    }
                }
            ]),

            // Recent 5 tasks
            Task.find(dateFilter)
                .populate('client', 'firstName lastName email')
                .sort({ createdAt: -1 })
                .limit(5)
                .select('taskTitle status price createdAt client')
                .lean(),

            // Top 5 clients by task count
            Task.aggregate([
                { $match: dateFilter },
                { $group: { _id: "$client", taskCount: { $sum: 1 } } },
                { $sort: { taskCount: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                {
                    $project: {
                        _id: 1,
                        taskCount: 1,
                        firstName: "$user.firstName",
                        lastName: "$user.lastName",
                        email: "$user.email"
                    }
                }
            ]),

            // Top 5 taskers by completed tasks
            Task.aggregate([
                { $match: { ...dateFilter, status: "completed", acceptedBy: { $exists: true } } },
                { $group: { _id: "$acceptedBy", taskCount: { $sum: 1 } } },
                { $sort: { taskCount: -1 } },
                { $limit: 5 },
                {
                    $lookup: {
                        from: "users",
                        localField: "_id",
                        foreignField: "_id",
                        as: "user"
                    }
                },
                { $unwind: "$user" },
                {
                    $project: {
                        _id: 1,
                        taskCount: 1,
                        firstName: "$user.firstName",
                        lastName: "$user.lastName",
                        email: "$user.email"
                    }
                }
            ]),

            // Price statistics
            Task.aggregate([
                { $match: dateFilter },
                {
                    $group: {
                        _id: null,
                        avgPrice: { $avg: "$price" },
                        minPrice: { $min: "$price" },
                        maxPrice: { $max: "$price" },
                        totalRevenue: { $sum: "$payment.applicationFee" }
                    }
                }
            ]),

            // Daily task creation stats (last 30 days)
            Task.aggregate([
                {
                    $match: {
                        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
                    }
                },
                {
                    $group: {
                        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                        count: { $sum: 1 }
                    }
                },
                { $sort: { _id: 1 } }
            ])
        ]);

        // Format status counts
        const statusCountsFormatted = statusCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        // Format schedule counts
        const scheduleCountsFormatted = scheduleCounts.reduce((acc, curr) => {
            acc[curr._id] = curr.count;
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            data: {
                totalTasks,
                statusCounts: statusCountsFormatted,
                scheduleCounts: scheduleCountsFormatted,
                paymentStats,
                recentTasks,
                topClients,
                topTaskers,
                priceStats: priceStats[0] || {
                    avgPrice: 0,
                    minPrice: 0,
                    maxPrice: 0,
                    totalRevenue: 0
                },
                dailyStats
            }
        });
    } catch (error) {
        console.error("Error fetching task statistics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch statistics",
            error: error.message
        });
    }
};

// ==================== CHANGE TASK STATUS (ADMIN) ====================
export const changeTaskStatusAdmin = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status, reason } = req.body;

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID"
            });
        }

        const validStatuses = ["pending", "in progress", "completed", "requested", "not completed", "declined", "cancelled"];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid status",
                validStatuses
            });
        }

        const updateData = { status };

        // Add completion date if marking as completed
        if (status === 'completed') {
            updateData.completedAt = new Date();
        }

        // Add cancellation reason if provided
        if (status === 'cancelled' && reason) {
            updateData.cancellationReason = reason;
        }

        const task = await Task.findByIdAndUpdate(
            taskId,
            { $set: updateData },
            { new: true }
        )
            .populate('client', 'firstName lastName email')
            .populate('acceptedBy', 'firstName lastName email');

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        res.status(200).json({
            success: true,
            message: `Task status changed to ${status}`,
            data: task
        });
    } catch (error) {
        console.error("Error changing task status:", error);
        res.status(500).json({
            success: false,
            message: "Failed to change task status",
            error: error.message
        });
    }
};

// ==================== REFUND TASK PAYMENT (ADMIN) ====================
export const refundTaskPaymentAdmin = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { reason, amount } = req.body; // amount is optional for partial refund

        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid task ID"
            });
        }

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        if (!task.payment?.paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: "No payment found for this task"
            });
        }

        // Here you would integrate with Stripe for actual refund
        // This is a placeholder for the refund logic

        /*
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        const refund = await stripe.refunds.create({
            payment_intent: task.payment.paymentIntentId,
            amount: amount ? amount * 100 : undefined, // Partial refund if amount specified
            reason: 'requested_by_customer'
        });
        */

        // Update task payment status
        task.payment.status = 'refunded';
        task.payment.refundedAt = new Date();
        task.payment.refundReason = reason;
        task.payment.refundAmount = amount || task.payment.totalClientPays;
        task.status = 'cancelled';

        await task.save();

        res.status(200).json({
            success: true,
            message: "Payment refunded successfully",
            data: task
        });
    } catch (error) {
        console.error("Error refunding payment:", error);
        res.status(500).json({
            success: false,
            message: "Failed to refund payment",
            error: error.message
        });
    }
};

// ==================== EXPORT TASKS (ADMIN) ====================
export const exportTasksAdmin = async (req, res) => {
    try {
        const { format = 'json', status, startDate, endDate } = req.query;

        const query = {};

        if (status && status !== 'all') {
            query.status = status;
        }

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const tasks = await Task.find(query)
            .populate('client', 'firstName lastName email')
            .populate('acceptedBy', 'firstName lastName email')
            .lean();

        if (format === 'csv') {
            // Convert to CSV
            const fields = [
                'taskTitle',
                'status',
                'price',
                'location',
                'schedule',
                'clientName',
                'taskerName',
                'createdAt'
            ];

            const csvData = tasks.map(task => ({
                taskTitle: task.taskTitle,
                status: task.status,
                price: task.price,
                location: task.location,
                schedule: task.schedule,
                clientName: task.client ? `${task.client.firstName} ${task.client.lastName}` : 'N/A',
                taskerName: task.acceptedBy ? `${task.acceptedBy.firstName} ${task.acceptedBy.lastName}` : 'N/A',
                createdAt: task.createdAt
            }));

            const csvHeader = fields.join(',');
            const csvRows = csvData.map(row =>
                fields.map(field => `"${row[field] || ''}"`).join(',')
            );
            const csvContent = [csvHeader, ...csvRows].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename=tasks_export.csv');
            return res.send(csvContent);
        }

        res.status(200).json({
            success: true,
            count: tasks.length,
            data: tasks
        });
    } catch (error) {
        console.error("Error exporting tasks:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export tasks",
            error: error.message
        });
    }
};

// ==================== BLOCK/UNBLOCK COMMENT (ADMIN) ====================
export const toggleCommentBlock = async (req, res) => {
    try {
        const { taskId, commentId } = req.params;
        const { isBlocked, reason } = req.body;

        const task = await Task.findById(taskId);

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        const comment = task.comments.id(commentId);

        if (!comment) {
            return res.status(404).json({
                success: false,
                message: "Comment not found"
            });
        }

        comment.isBlocked = isBlocked;
        comment.blockReason = isBlocked ? reason : undefined;

        await task.save();

        res.status(200).json({
            success: true,
            message: isBlocked ? "Comment blocked" : "Comment unblocked",
            data: comment
        });
    } catch (error) {
        console.error("Error toggling comment block:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update comment",
            error: error.message
        });
    }
};

// ==================== DELETE BID (ADMIN) ====================
export const deleteBidAdmin = async (req, res) => {
    try {
        const { taskId, bidId } = req.params;

        const task = await Task.findById(taskId);

        console.log(req.params)

        if (!task) {
            return res.status(404).json({
                success: false,
                message: "Task not found"
            });
        }

        const bidIndex = task.bids.findIndex(bid => bid._id.toString() === bidId);

        if (bidIndex === -1) {
            return res.status(404).json({
                success: false,
                message: "Bid not found"
            });
        }

        task.bids.splice(bidIndex, 1);
        await task.save();

        res.status(200).json({
            success: true,
            message: "Bid deleted successfully"
        });
    } catch (error) {
        console.error("Error deleting bid:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete bid",
            error: error.message
        });
    }
};