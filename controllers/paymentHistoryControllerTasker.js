// controllers/taskerPaymentController.js

import Stripe from 'stripe';
import mongoose from 'mongoose';
import Task from '../models/task.js';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Get tasker's payment/earnings history
 */
export const getTaskerPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1, type = 'all' } = req.query;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        // Build query - tasks where this user is the accepted tasker
        const query = {
            acceptedBy: userId,
            'payment.paymentIntentId': { $exists: true, $ne: null }
        };

        // Filter by payment status
        if (type === 'completed' || type === 'received') {
            query['payment.status'] = { $in: ['captured', 'released'] };
        } else if (type === 'pending' || type === 'held') {
            query['payment.status'] = 'held';
        } else if (type === 'cancelled') {
            query['payment.status'] = { $in: ['cancelled', 'refunded', 'failed'] };
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const tasks = await Task.find(query)
            .populate('client', 'firstName lastName email profileImage')
            .sort({ 'payment.authorizedAt': -1, createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit))
            .lean();

        const totalCount = await Task.countDocuments(query);

        // Transform tasks into transactions
        const transactions = [];

        for (const task of tasks) {
            const payment = task.payment;

            if (!payment) continue;

            const clientName = task.client
                ? `${task.client.firstName} ${task.client.lastName}`
                : 'Unknown Client';

            // Determine transaction type and status for tasker
            let transactionType = 'Earnings Pending';
            let transactionStatus = 'Pending';
            let isPositive = true;

            switch (payment.status) {
                case 'held':
                    transactionType = 'Payment Held';
                    transactionStatus = 'Held';
                    break;
                case 'captured':
                case 'released':
                    transactionType = 'Payment Received';
                    transactionStatus = 'Completed';
                    break;
                case 'refunded':
                    transactionType = 'Payment Refunded';
                    transactionStatus = 'Refunded';
                    isPositive = false;
                    break;
                case 'cancelled':
                case 'failed':
                    transactionType = 'Payment Cancelled';
                    transactionStatus = 'Cancelled';
                    isPositive = false;
                    break;
                default:
                    transactionType = 'Processing';
                    transactionStatus = 'Processing';
            }

            // For tasker, show what they receive (after deductions)
            const taskerPayout = payment.taskerPayout || 0;
            const bidAmount = payment.bidAmount || task.acceptedBidAmount || 0;

            transactions.push({
                id: task._id.toString(),
                paymentIntentId: payment.paymentIntentId,
                date: payment.releasedAt || payment.capturedAt || payment.authorizedAt || task.acceptedAt || task.createdAt,
                type: transactionType,

                // Amounts
                grossAmount: bidAmount,
                netAmount: taskerPayout,
                amount: taskerPayout,
                amountFormatted: isPositive ? `+$${taskerPayout.toFixed(2)}` : `-$${taskerPayout.toFixed(2)}`,

                description: task.taskTitle,
                status: transactionStatus,
                taskStatus: task.status,

                details: {
                    taskId: task._id.toString(),
                    taskTitle: task.taskTitle,
                    client: task.client ? {
                        id: task.client._id?.toString(),
                        name: clientName,
                        email: task.client.email,
                        profileImage: task.client.profileImage,
                    } : null,
                    paymentMethod: 'Stripe Transfer',

                    // Earnings breakdown (tasker view)
                    bidAmount: bidAmount,
                    taskerPlatformFee: payment.taskerPlatformFee || 0,
                    taskerTax: payment.taskerTax || 0,
                    taskerPayout: taskerPayout,

                    // Deduction percentages
                    platformFeePercent: 12,
                    taxPercent: 13,
                    totalDeductionPercent: 25,

                    // Timestamps
                    authorizedAt: payment.authorizedAt,
                    capturedAt: payment.capturedAt,
                    releasedAt: payment.releasedAt,

                    currency: payment.currency || 'CAD',
                    receiptUrl: null,
                }
            });
        }

        // Calculate summary statistics for tasker
        const completedPayments = transactions.filter(t => t.status === 'Completed');
        const pendingPayments = transactions.filter(t => ['Held', 'Pending', 'Processing'].includes(t.status));
        const cancelledPayments = transactions.filter(t => ['Cancelled', 'Refunded'].includes(t.status));

        const summary = {
            totalEarned: completedPayments.reduce((sum, t) => sum + t.netAmount, 0),
            totalGross: completedPayments.reduce((sum, t) => sum + t.grossAmount, 0),
            pendingAmount: pendingPayments.reduce((sum, t) => sum + t.netAmount, 0),
            pendingGross: pendingPayments.reduce((sum, t) => sum + t.grossAmount, 0),
            totalDeductions: completedPayments.reduce((sum, t) => sum + (t.grossAmount - t.netAmount), 0),
            completedCount: completedPayments.length,
            pendingCount: pendingPayments.length,
            cancelledCount: cancelledPayments.length,
            totalTransactions: totalCount,
        };

        return res.status(200).json({
            success: true,
            transactions,
            summary,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: totalCount,
                totalPages: Math.ceil(totalCount / parseInt(limit)),
            }
        });

    } catch (error) {
        console.error('Error fetching tasker payment history:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history',
            details: error.message
        });
    }
};

/**
 * Get tasker earnings summary for dashboard
 */
export const getTaskerEarningsSummary = async (req, res) => {
    try {
        const userId = req.user.id;

        // Aggregate earnings data
        const result = await Task.aggregate([
            {
                $match: {
                    acceptedBy: new mongoose.Types.ObjectId(userId),
                    'payment.paymentIntentId': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$payment.status',
                    totalPayout: { $sum: { $ifNull: ['$payment.taskerPayout', 0] } },
                    totalGross: { $sum: { $ifNull: ['$payment.bidAmount', '$acceptedBidAmount'] } },
                    totalPlatformFee: { $sum: { $ifNull: ['$payment.taskerPlatformFee', 0] } },
                    totalTax: { $sum: { $ifNull: ['$payment.taskerTax', 0] } },
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalEarned = 0;
        let totalGross = 0;
        let totalPending = 0;
        let pendingGross = 0;
        let totalDeductions = 0;
        let completedTasks = 0;
        let pendingTasks = 0;

        for (const item of result) {
            switch (item._id) {
                case 'captured':
                case 'released':
                    totalEarned += item.totalPayout;
                    totalGross += item.totalGross;
                    totalDeductions += (item.totalPlatformFee + item.totalTax);
                    completedTasks += item.count;
                    break;
                case 'held':
                    totalPending += item.totalPayout;
                    pendingGross += item.totalGross;
                    pendingTasks += item.count;
                    break;
            }
        }

        // Get Stripe Connect account status
        const user = await User.findById(userId);
        let stripeAccountStatus = 'not_connected';
        let payoutsEnabled = false;
        let availableBalance = 0;
        let pendingBalance = 0;

        if (user?.stripeConnectAccountId) {
            try {
                const account = await stripe.accounts.retrieve(user.stripeConnectAccountId);
                stripeAccountStatus = account.charges_enabled && account.payouts_enabled ? 'active' : 'pending';
                payoutsEnabled = account.payouts_enabled;

                // Get balance if payouts enabled
                if (payoutsEnabled) {
                    try {
                        const balance = await stripe.balance.retrieve({
                            stripeAccount: user.stripeConnectAccountId,
                        });

                        const cadAvailable = balance.available.find(b => b.currency === 'cad');
                        const cadPending = balance.pending.find(b => b.currency === 'cad');

                        availableBalance = cadAvailable ? cadAvailable.amount / 100 : 0;
                        pendingBalance = cadPending ? cadPending.amount / 100 : 0;
                    } catch (balanceError) {
                        console.error('Error fetching balance:', balanceError.message);
                    }
                }
            } catch (e) {
                console.error('Error fetching Stripe account:', e.message);
            }
        }

        // Calculate averages
        const averageEarning = completedTasks > 0 ? totalEarned / completedTasks : 0;
        const averageDeduction = completedTasks > 0 ? totalDeductions / completedTasks : 0;

        return res.status(200).json({
            success: true,
            summary: {
                // Earnings
                totalEarned: Math.round(totalEarned * 100) / 100,
                totalGross: Math.round(totalGross * 100) / 100,
                totalPending: Math.round(totalPending * 100) / 100,
                pendingGross: Math.round(pendingGross * 100) / 100,

                // Deductions
                totalDeductions: Math.round(totalDeductions * 100) / 100,

                // Task counts
                completedTasks,
                pendingTasks,
                totalTasks: result.reduce((sum, r) => sum + r.count, 0),

                // Averages
                averageEarning: Math.round(averageEarning * 100) / 100,
                averageDeduction: Math.round(averageDeduction * 100) / 100,

                // Stripe account
                stripeAccountStatus,
                payoutsEnabled,
                availableBalance,
                pendingBalance,
            }
        });

    } catch (error) {
        console.error('Error fetching tasker earnings summary:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch earnings summary',
            details: error.message
        });
    }
};

/**
 * Get single payment details for tasker
 */
export const getTaskerPaymentDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;

        const task = await Task.findById(taskId)
            .populate('client', 'firstName lastName email profileImage')
            .populate('acceptedBy', 'firstName lastName email')
            .lean();

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        // Check that this user is the tasker
        if (task.acceptedBy?._id?.toString() !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized to view this payment' });
        }

        const payment = task.payment;

        if (!payment?.paymentIntentId) {
            return res.status(404).json({ success: false, error: 'No payment found for this task' });
        }

        const clientName = task.client
            ? `${task.client.firstName} ${task.client.lastName}`
            : 'Unknown Client';

        const paymentDetails = {
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            taskStatus: task.status,

            client: task.client ? {
                id: task.client._id.toString(),
                name: clientName,
                email: task.client.email,
                profileImage: task.client.profileImage,
            } : null,

            paymentIntentId: payment.paymentIntentId,
            status: payment.status,
            currency: payment.currency || 'CAD',

            // Earnings breakdown
            earnings: {
                grossAmount: payment.bidAmount || task.acceptedBidAmount || 0,
                platformFee: payment.taskerPlatformFee || 0,
                platformFeePercent: 12,
                tax: payment.taskerTax || 0,
                taxPercent: 13,
                totalDeductions: (payment.taskerPlatformFee || 0) + (payment.taskerTax || 0),
                netAmount: payment.taskerPayout || 0,
            },

            // Fee breakdown for display
            feeBreakdown: [
                {
                    label: 'Task Earnings',
                    amount: payment.bidAmount || task.acceptedBidAmount || 0,
                    type: 'gross'
                },
                {
                    label: 'Platform Fee (12%)',
                    amount: -(payment.taskerPlatformFee || 0),
                    type: 'deduction'
                },
                {
                    label: 'Tax Withholding (13%)',
                    amount: -(payment.taskerTax || 0),
                    type: 'deduction'
                },
                {
                    label: 'Your Earnings',
                    amount: payment.taskerPayout || 0,
                    type: 'net',
                    isTotal: true
                },
            ],

            // Timeline
            timeline: [
                payment.authorizedAt && {
                    event: 'Payment Authorized',
                    date: payment.authorizedAt,
                    description: 'Client payment held',
                },
                payment.capturedAt && {
                    event: 'Payment Captured',
                    date: payment.capturedAt,
                    description: 'Payment processed',
                },
                payment.releasedAt && {
                    event: 'Payment Released',
                    date: payment.releasedAt,
                    description: `$${payment.taskerPayout?.toFixed(2)} sent to you`,
                },
            ].filter(Boolean),
        };

        return res.status(200).json({
            success: true,
            payment: paymentDetails,
        });

    } catch (error) {
        console.error('Error fetching tasker payment details:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment details',
            details: error.message
        });
    }
};

/**
 * Download tasker receipt/earnings statement
 */
export const downloadTaskerReceipt = async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;

        const task = await Task.findById(taskId)
            .populate('client', 'firstName lastName email')
            .populate('acceptedBy', 'firstName lastName email')
            .lean();

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        if (task.acceptedBy?._id?.toString() !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        if (!task.payment?.paymentIntentId) {
            return res.status(404).json({ success: false, error: 'No payment found' });
        }

        const payment = task.payment;
        const clientName = task.client
            ? `${task.client.firstName} ${task.client.lastName}`
            : 'Unknown Client';
        const taskerName = `${task.acceptedBy.firstName} ${task.acceptedBy.lastName}`;

        const receiptData = {
            receiptNumber: `EARN-${task._id.toString().slice(-8).toUpperCase()}`,
            date: payment.releasedAt || payment.capturedAt || payment.authorizedAt || new Date(),

            type: 'Earnings Statement',

            task: {
                title: task.taskTitle,
                id: task._id.toString(),
            },

            parties: {
                tasker: {
                    name: taskerName,
                    email: task.acceptedBy.email,
                },
                client: {
                    name: clientName,
                    email: task.client?.email,
                },
            },

            earnings: {
                items: [
                    { description: 'Task Earnings (Gross)', amount: payment.bidAmount || 0 },
                    { description: 'Platform Fee (12%)', amount: -(payment.taskerPlatformFee || 0) },
                    { description: 'Tax Withholding (13%)', amount: -(payment.taskerTax || 0) },
                ],
                grossTotal: payment.bidAmount || 0,
                totalDeductions: (payment.taskerPlatformFee || 0) + (payment.taskerTax || 0),
                netTotal: payment.taskerPayout || 0,
            },

            currency: 'CAD',
            status: payment.status,
        };

        return res.status(200).json({
            success: true,
            receiptData,
            type: 'earnings_statement'
        });

    } catch (error) {
        console.error('Error generating tasker receipt:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate receipt',
            details: error.message
        });
    }
};

export default {
    getTaskerPaymentHistory,
    getTaskerEarningsSummary,
    getTaskerPaymentDetails,
    downloadTaskerReceipt,
};