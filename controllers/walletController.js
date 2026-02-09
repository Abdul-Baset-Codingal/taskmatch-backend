// controllers/walletController.js
import User from "../models/user.js";
import Task from "../models/task.js";
import BookingTasker from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import WithdrawalRequest from "../models/WithdrawalRequest.js";
import WalletTransaction from "../models/WalletTransaction.js";
import { createNotification } from "./notificationHelper.js";

// ==================== HELPER FUNCTIONS ====================

// Get tasker payout from a task/booking/quote
const getTaskerPayout = (item) => {
    if (item.payment?.taskerPayout) {
        return item.payment.taskerPayout;
    }
    if (item.payment?.taskerPayoutCents) {
        return item.payment.taskerPayoutCents / 100;
    }
    if (item.acceptedBidAmount) {
        const bidAmount = item.acceptedBidAmount;
        return bidAmount - (bidAmount * 0.12) - (bidAmount * 0.13);
    }
    return 0;
};

// ==================== TASKER ENDPOINTS ====================

/**
 * GET /api/wallet/balance
 * Get tasker's wallet balance and summary
 */
export const getWalletBalance = async (req, res) => {
    try {
        const userId = req.user.id;

        const user = await User.findById(userId).select('wallet bankAccount firstName lastName');
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Get pending withdrawal requests
        const pendingWithdrawals = await WithdrawalRequest.find({
            tasker: userId,
            status: "pending"
        }).select('amount requestedAt');

        const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

        // Calculate available balance
        const availableBalance = (user.wallet?.balance || 0) - pendingAmount;

        res.status(200).json({
            success: true,
            wallet: {
                balance: user.wallet?.balance || 0,
                availableBalance: Math.max(0, availableBalance),
                pendingWithdrawal: pendingAmount,
                totalEarned: user.wallet?.totalEarned || 0,
                totalWithdrawn: user.wallet?.totalWithdrawn || 0,
                lastUpdated: user.wallet?.lastUpdated,
            },
            pendingWithdrawals,
            hasBankAccount: !!(user.bankAccount?.accountNumber),
            bankAccountLast4: user.bankAccount?.last4,
        });

    } catch (error) {
        console.error("Error getting wallet balance:", error);
        res.status(500).json({ error: "Failed to get wallet balance" });
    }
};

/**
 * GET /api/wallet/transactions
 * Get tasker's transaction history
 */
export const getWalletTransactions = async (req, res) => {
    try {
        const userId = req.user.id;
        const { page = 1, limit = 20, type } = req.query;

        const query = { user: userId };
        if (type) {
            query.type = type;
        }

        const transactions = await WalletTransaction.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('taskId', 'taskTitle')
            .populate('bookingId', 'service.title')
            .populate('quoteId', 'taskTitle');

        const total = await WalletTransaction.countDocuments(query);

        res.status(200).json({
            success: true,
            transactions,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        console.error("Error getting transactions:", error);
        res.status(500).json({ error: "Failed to get transactions" });
    }
};

/**
 * GET /api/wallet/earnings
 * Get detailed earnings breakdown
 */
export const getEarningsBreakdown = async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = 'all' } = req.query; // all, month, week

        let dateFilter = {};
        const now = new Date();

        if (period === 'week') {
            dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
        } else if (period === 'month') {
            dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
        }

        // Get completed tasks
        const taskQuery = {
            acceptedBy: userId,
            status: 'completed',
            ...(period !== 'all' && { completedAt: dateFilter })
        };
        const tasks = await Task.find(taskQuery).select('taskTitle acceptedBidAmount payment completedAt');

        // Get completed bookings
        const bookingQuery = {
            tasker: userId,
            status: 'completed',
            ...(period !== 'all' && { completedAt: dateFilter })
        };
        const bookings = await BookingTasker.find(bookingQuery).select('service.title payment completedAt');

        // Get completed quotes
        const quoteQuery = {
            tasker: userId,
            status: 'completed',
            ...(period !== 'all' && { completedAt: dateFilter })
        };
        const quotes = await RequestQuote.find(quoteQuery).select('taskTitle payment completedAt');

        // Calculate earnings
        const taskEarnings = tasks.reduce((sum, t) => sum + getTaskerPayout(t), 0);
        const bookingEarnings = bookings.reduce((sum, b) => sum + getTaskerPayout(b), 0);
        const quoteEarnings = quotes.reduce((sum, q) => sum + getTaskerPayout(q), 0);

        const totalEarnings = taskEarnings + bookingEarnings + quoteEarnings;

        res.status(200).json({
            success: true,
            period,
            earnings: {
                tasks: {
                    count: tasks.length,
                    amount: taskEarnings,
                },
                bookings: {
                    count: bookings.length,
                    amount: bookingEarnings,
                },
                quotes: {
                    count: quotes.length,
                    amount: quoteEarnings,
                },
                total: totalEarnings,
            },
            recentItems: [
                ...tasks.map(t => ({ type: 'task', title: t.taskTitle, amount: getTaskerPayout(t), date: t.completedAt })),
                ...bookings.map(b => ({ type: 'booking', title: b.service?.title, amount: getTaskerPayout(b), date: b.completedAt })),
                ...quotes.map(q => ({ type: 'quote', title: q.taskTitle, amount: getTaskerPayout(q), date: q.completedAt })),
            ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10),
        });

    } catch (error) {
        console.error("Error getting earnings breakdown:", error);
        res.status(500).json({ error: "Failed to get earnings breakdown" });
    }
};

/**
 * POST /api/wallet/withdraw
 * Create a withdrawal request
 */
export const createWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { amount, note } = req.body;

        // Validate amount
        if (!amount || amount < 1) {
            return res.status(400).json({ error: "Minimum withdrawal amount is $1" });
        }

        // Get user with wallet and bank info
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        // Check if bank account is set up
        if (!user.bankAccount?.accountNumber || !user.bankAccount?.routingNumber) {
            return res.status(400).json({
                error: "Please set up your bank account before requesting a withdrawal",
                code: "NO_BANK_ACCOUNT"
            });
        }

        // Get pending withdrawals
        const pendingWithdrawals = await WithdrawalRequest.find({
            tasker: userId,
            status: "pending"
        });
        const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

        // Calculate available balance
        const availableBalance = (user.wallet?.balance || 0) - pendingAmount;

        // Validate sufficient balance
        if (amount > availableBalance) {
            return res.status(400).json({
                error: `Insufficient balance. Available: $${availableBalance.toFixed(2)}`,
                availableBalance,
            });
        }

        // Create withdrawal request
        const withdrawalRequest = new WithdrawalRequest({
            tasker: userId,
            amount,
            note,
            status: "pending",
            requestedAt: new Date(),
            bankAccountSnapshot: {
                accountHolderName: user.bankAccount.accountHolderName,
                bankName: user.bankAccount.bankName,
                last4: user.bankAccount.last4,
                accountType: user.bankAccount.accountType,
            },
        });

        await withdrawalRequest.save();

        // Update user's pending withdrawal amount
        await User.findByIdAndUpdate(userId, {
            $inc: { 'wallet.pendingWithdrawal': amount },
        });

        // Create notification
        await createNotification(
            userId,
            "💸 Withdrawal Request Submitted",
            `Your withdrawal request for $${amount.toFixed(2)} has been submitted and is pending approval.`,
            "withdrawal-pending",
            withdrawalRequest._id
        );

        console.log(`✅ Withdrawal request created: $${amount} for user ${userId}`);

        res.status(201).json({
            success: true,
            message: "Withdrawal request submitted successfully",
            withdrawal: withdrawalRequest,
        });

    } catch (error) {
        console.error("Error creating withdrawal request:", error);
        res.status(500).json({ error: "Failed to create withdrawal request" });
    }
};

/**
 * GET /api/wallet/withdrawals
 * Get tasker's withdrawal requests
 */
export const getMyWithdrawalRequests = async (req, res) => {
    try {
        const userId = req.user.id;
        const { status, page = 1, limit = 10 } = req.query;

        const query = { tasker: userId };
        if (status) {
            query.status = status;
        }

        const withdrawals = await WithdrawalRequest.find(query)
            .sort({ requestedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await WithdrawalRequest.countDocuments(query);

        res.status(200).json({
            success: true,
            withdrawals,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        console.error("Error getting withdrawal requests:", error);
        res.status(500).json({ error: "Failed to get withdrawal requests" });
    }
};

/**
 * DELETE /api/wallet/withdraw/:id
 * Cancel a pending withdrawal request
 */
export const cancelWithdrawalRequest = async (req, res) => {
    try {
        const userId = req.user.id;
        const { id } = req.params;

        const withdrawal = await WithdrawalRequest.findOne({
            _id: id,
            tasker: userId,
            status: "pending"
        });

        if (!withdrawal) {
            return res.status(404).json({ error: "Withdrawal request not found or cannot be cancelled" });
        }

        // Update status
        withdrawal.status = "cancelled";
        await withdrawal.save();

        // Update user's pending withdrawal amount
        await User.findByIdAndUpdate(userId, {
            $inc: { 'wallet.pendingWithdrawal': -withdrawal.amount },
        });

        res.status(200).json({
            success: true,
            message: "Withdrawal request cancelled",
        });

    } catch (error) {
        console.error("Error cancelling withdrawal:", error);
        res.status(500).json({ error: "Failed to cancel withdrawal request" });
    }
};

// ==================== ADMIN ENDPOINTS ====================

/**
 * GET /api/admin/withdrawals
 * Get all withdrawal requests (Admin only)
 */
export const getAllWithdrawalRequests = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const query = {};
        if (status) {
            query.status = status;
        }

        const withdrawals = await WithdrawalRequest.find(query)
            .populate('tasker', 'firstName lastName email phone bankAccount profilePicture wallet')
            .populate('processedBy', 'firstName lastName')
            .sort({ requestedAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await WithdrawalRequest.countDocuments(query);

        // Get summary stats
        const stats = await WithdrawalRequest.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    totalAmount: { $sum: '$amount' },
                }
            }
        ]);

        res.status(200).json({
            success: true,
            withdrawals,
            stats: stats.reduce((acc, s) => {
                acc[s._id] = { count: s.count, amount: s.totalAmount };
                return acc;
            }, {}),
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            }
        });

    } catch (error) {
        console.error("Error getting all withdrawals:", error);
        res.status(500).json({ error: "Failed to get withdrawal requests" });
    }
};

/**
 * PUT /api/admin/withdrawals/:id/approve
 * Approve a withdrawal request (Admin only)
 */
export const approveWithdrawalRequest = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { id } = req.params;
        const { paymentMethod, paymentReference, adminNote } = req.body;

        const withdrawal = await WithdrawalRequest.findById(id).populate('tasker');
        if (!withdrawal) {
            return res.status(404).json({ error: "Withdrawal request not found" });
        }

        if (withdrawal.status !== "pending") {
            return res.status(400).json({ error: "Only pending requests can be approved" });
        }

        // Update withdrawal request
        withdrawal.status = "completed";
        withdrawal.processedBy = adminId;
        withdrawal.processedAt = new Date();
        withdrawal.paymentMethod = paymentMethod || "bank_transfer";
        withdrawal.paymentReference = paymentReference;
        withdrawal.paymentDate = new Date();
        withdrawal.adminNote = adminNote;

        await withdrawal.save();

        // Update user's wallet
        await User.findByIdAndUpdate(withdrawal.tasker._id, {
            $inc: {
                'wallet.balance': -withdrawal.amount,
                'wallet.pendingWithdrawal': -withdrawal.amount,
                'wallet.totalWithdrawn': withdrawal.amount,
            },
            'wallet.lastUpdated': new Date(),
        });

        // Create wallet transaction record
        const user = await User.findById(withdrawal.tasker._id);
        await WalletTransaction.create({
            user: withdrawal.tasker._id,
            type: 'withdrawal',
            amount: -withdrawal.amount,
            balanceAfter: user.wallet.balance - withdrawal.amount,
            description: `Withdrawal - ${paymentMethod || 'Bank Transfer'}`,
            withdrawalRequestId: withdrawal._id,
            metadata: {
                paymentReference,
                paymentMethod,
            },
            createdBy: adminId,
        });

        // Notify tasker
        await createNotification(
            withdrawal.tasker._id,
            "✅ Withdrawal Approved!",
            `Your withdrawal request for $${withdrawal.amount.toFixed(2)} has been approved and processed. ${paymentReference ? `Reference: ${paymentReference}` : ''}`,
            "withdrawal-approved",
            withdrawal._id
        );

        console.log(`✅ Withdrawal ${id} approved by admin ${adminId}`);

        res.status(200).json({
            success: true,
            message: "Withdrawal request approved and processed",
            withdrawal,
        });

    } catch (error) {
        console.error("Error approving withdrawal:", error);
        res.status(500).json({ error: "Failed to approve withdrawal request" });
    }
};

/**
 * PUT /api/admin/withdrawals/:id/reject
 * Reject a withdrawal request (Admin only)
 */
export const rejectWithdrawalRequest = async (req, res) => {
    try {
        const adminId = req.user.id;
        const { id } = req.params;
        const { adminNote } = req.body;

        if (!adminNote) {
            return res.status(400).json({ error: "Please provide a reason for rejection" });
        }

        const withdrawal = await WithdrawalRequest.findById(id);
        if (!withdrawal) {
            return res.status(404).json({ error: "Withdrawal request not found" });
        }

        if (withdrawal.status !== "pending") {
            return res.status(400).json({ error: "Only pending requests can be rejected" });
        }

        // Update withdrawal request
        withdrawal.status = "rejected";
        withdrawal.processedBy = adminId;
        withdrawal.processedAt = new Date();
        withdrawal.adminNote = adminNote;

        await withdrawal.save();

        // Release pending amount back to available balance
        await User.findByIdAndUpdate(withdrawal.tasker, {
            $inc: { 'wallet.pendingWithdrawal': -withdrawal.amount },
            'wallet.lastUpdated': new Date(),
        });

        // Notify tasker
        await createNotification(
            withdrawal.tasker,
            "❌ Withdrawal Request Rejected",
            `Your withdrawal request for $${withdrawal.amount.toFixed(2)} was rejected. Reason: ${adminNote}`,
            "withdrawal-rejected",
            withdrawal._id
        );

        console.log(`❌ Withdrawal ${id} rejected by admin ${adminId}`);

        res.status(200).json({
            success: true,
            message: "Withdrawal request rejected",
            withdrawal,
        });

    } catch (error) {
        console.error("Error rejecting withdrawal:", error);
        res.status(500).json({ error: "Failed to reject withdrawal request" });
    }
};

/**
 * Helper: Sync wallet balance from completed tasks/bookings/quotes
 * Call this when a task is completed to update the wallet
 */
export const addEarningToWallet = async (userId, amount, description, referenceType, referenceId) => {
    try {
        // Update user wallet
        const user = await User.findByIdAndUpdate(
            userId,
            {
                $inc: {
                    'wallet.balance': amount,
                    'wallet.totalEarned': amount,
                },
                'wallet.lastUpdated': new Date(),
            },
            { new: true }
        );

        // Create transaction record
        await WalletTransaction.create({
            user: userId,
            type: 'earning',
            amount: amount,
            balanceAfter: user.wallet.balance,
            description,
            ...(referenceType === 'task' && { taskId: referenceId }),
            ...(referenceType === 'booking' && { bookingId: referenceId }),
            ...(referenceType === 'quote' && { quoteId: referenceId }),
        });

        console.log(`💰 Added $${amount} to wallet for user ${userId}`);
        return true;
    } catch (error) {
        console.error("Error adding earning to wallet:", error);
        return false;
    }
};