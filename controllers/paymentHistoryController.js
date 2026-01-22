// controllers/paymentController.js
import mongoose from 'mongoose';

import Stripe from 'stripe';
import Task from '../models/task.js';
import User from '../models/user.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Get client's payment history
 */
export const getClientPaymentHistory = async (req, res) => {
    try {
        const userId = req.user.id;
        const { limit = 20, page = 1, type = 'all' } = req.query;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        // Build query
        const query = {
            client: userId,
            'payment.paymentIntentId': { $exists: true, $ne: null }
        };

        // Filter by payment status
        if (type === 'completed') {
            query['payment.status'] = { $in: ['captured', 'released'] };
        } else if (type === 'pending') {
            query['payment.status'] = 'held';
        } else if (type === 'refunded') {
            query['payment.status'] = 'refunded';
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const tasks = await Task.find(query)
            .populate('acceptedBy', 'firstName lastName email profileImage')
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

            const taskerName = task.acceptedBy
                ? `${task.acceptedBy.firstName} ${task.acceptedBy.lastName}`
                : 'Unknown Tasker';

            // Determine transaction type and status
            let transactionType = 'Payment Authorized';
            let transactionStatus = 'Pending';

            switch (payment.status) {
                case 'held':
                    transactionType = 'Payment Held';
                    transactionStatus = 'Held';
                    break;
                case 'captured':
                    transactionType = 'Payment Completed';
                    transactionStatus = 'Completed';
                    break;
                case 'released':
                    transactionType = 'Payment Released';
                    transactionStatus = 'Completed';
                    break;
                case 'refunded':
                    transactionType = 'Refund Issued';
                    transactionStatus = 'Refunded';
                    break;
                case 'cancelled':
                case 'failed':
                    transactionType = 'Payment Cancelled';
                    transactionStatus = 'Cancelled';
                    break;
                default:
                    transactionType = 'Payment Processing';
                    transactionStatus = 'Processing';
            }

            // Get amount - use totalClientPays or fallback to other fields
            const displayAmount = payment.totalClientPays
                || payment.grossAmount
                || task.acceptedBidAmount
                || 0;

            transactions.push({
                id: task._id.toString(),
                paymentIntentId: payment.paymentIntentId,
                date: payment.authorizedAt || task.acceptedAt || task.createdAt,
                type: transactionType,
                amount: displayAmount,
                amountFormatted: `-$${displayAmount.toFixed(2)}`,
                description: task.taskTitle,
                status: transactionStatus,
                taskStatus: task.status,
                details: {
                    taskId: task._id.toString(),
                    taskTitle: task.taskTitle,
                    tasker: task.acceptedBy ? {
                        id: task.acceptedBy._id?.toString(),
                        name: taskerName,
                        email: task.acceptedBy.email,
                        profileImage: task.acceptedBy.profileImage,
                    } : null,
                    paymentMethod: 'Card',

                    // Fee breakdown
                    bidAmount: payment.bidAmount || task.acceptedBidAmount || 0,
                    clientPlatformFee: payment.clientPlatformFee || 0,
                    reservationFee: payment.reservationFee || 0,
                    clientTax: payment.clientTax || 0,
                    totalClientPays: payment.totalClientPays || displayAmount,

                    // Tasker earnings
                    taskerPlatformFee: payment.taskerPlatformFee || 0,
                    taskerTax: payment.taskerTax || 0,
                    taskerPayout: payment.taskerPayout || 0,

                    // Timestamps
                    authorizedAt: payment.authorizedAt,
                    capturedAt: payment.capturedAt,
                    releasedAt: payment.releasedAt,
                    refundedAt: payment.refundedAt,

                    currency: payment.currency || 'CAD',
                    receiptUrl: null, // Will be fetched from Stripe if needed
                }
            });
        }

        // Calculate summary
        const completedPayments = transactions.filter(t =>
            ['Completed'].includes(t.status)
        );
        const pendingPayments = transactions.filter(t =>
            ['Held', 'Pending', 'Processing'].includes(t.status)
        );
        const refundedPayments = transactions.filter(t =>
            t.status === 'Refunded'
        );

        const summary = {
            totalSpent: completedPayments.reduce((sum, t) => sum + t.amount, 0),
            pendingAmount: pendingPayments.reduce((sum, t) => sum + t.amount, 0),
            refundedAmount: refundedPayments.reduce((sum, t) => sum + t.amount, 0),
            totalTransactions: totalCount,
            completedCount: completedPayments.length,
            pendingCount: pendingPayments.length,
            refundedCount: refundedPayments.length,
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
        console.error('Error fetching client payment history:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment history',
            details: error.message
        });
    }
};

/**
 * Get payment summary for dashboard
 */
export const getClientPaymentSummary = async (req, res) => {
    try {
        const userId = req.user.id;

        // Aggregate payment data
        const result = await Task.aggregate([
            {
                $match: {
                    client: new mongoose.Types.ObjectId(userId),
                    'payment.paymentIntentId': { $exists: true, $ne: null }
                }
            },
            {
                $group: {
                    _id: '$payment.status',
                    total: {
                        $sum: {
                            $ifNull: ['$payment.totalClientPays', '$acceptedBidAmount']
                        }
                    },
                    count: { $sum: 1 }
                }
            }
        ]);

        let totalSpent = 0;
        let totalHeld = 0;
        let totalRefunded = 0;
        let completedTasks = 0;
        let inProgressTasks = 0;

        for (const item of result) {
            switch (item._id) {
                case 'captured':
                case 'released':
                    totalSpent += item.total;
                    completedTasks += item.count;
                    break;
                case 'held':
                    totalHeld += item.total;
                    inProgressTasks += item.count;
                    break;
                case 'refunded':
                    totalRefunded += item.total;
                    break;
            }
        }

        // Get saved payment methods count
        const user = await User.findById(userId);
        let savedCardsCount = 0;

        if (user?.stripeCustomerId) {
            try {
                const paymentMethods = await stripe.paymentMethods.list({
                    customer: user.stripeCustomerId,
                    type: 'card',
                });
                savedCardsCount = paymentMethods.data.length;
            } catch (e) {
                console.error('Error fetching payment methods:', e.message);
            }
        }

        return res.status(200).json({
            success: true,
            summary: {
                totalSpent: Math.round(totalSpent * 100) / 100,
                totalHeld: Math.round(totalHeld * 100) / 100,
                totalRefunded: Math.round(totalRefunded * 100) / 100,
                completedTasks,
                inProgressTasks,
                totalTasks: result.reduce((sum, r) => sum + r.count, 0),
                savedCardsCount,
            }
        });

    } catch (error) {
        console.error('Error fetching payment summary:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment summary',
            details: error.message
        });
    }
};

/**
 * Get single payment details
 */
export const getPaymentDetails = async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;

        const task = await Task.findById(taskId)
            .populate('acceptedBy', 'firstName lastName email profileImage')
            .populate('client', 'firstName lastName email')
            .lean();

        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }

        // Check authorization
        const isClient = task.client._id.toString() === userId;
        const isTasker = task.acceptedBy?._id?.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view this payment'
            });
        }

        const payment = task.payment;

        if (!payment?.paymentIntentId) {
            return res.status(404).json({
                success: false,
                error: 'No payment found for this task'
            });
        }

        // Get Stripe receipt URL if available
        let receiptUrl = null;
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
                payment.paymentIntentId,
                { expand: ['charges'] }
            );
            receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url || null;
        } catch (e) {
            console.error('Stripe retrieve error:', e.message);
        }

        const taskerName = task.acceptedBy
            ? `${task.acceptedBy.firstName} ${task.acceptedBy.lastName}`
            : 'Unknown';
        const clientName = `${task.client.firstName} ${task.client.lastName}`;

        const paymentDetails = {
            taskId: task._id.toString(),
            taskTitle: task.taskTitle,
            taskStatus: task.status,

            client: {
                id: task.client._id.toString(),
                name: clientName,
                email: task.client.email,
            },
            tasker: task.acceptedBy ? {
                id: task.acceptedBy._id.toString(),
                name: taskerName,
                email: task.acceptedBy.email,
                profileImage: task.acceptedBy.profileImage,
            } : null,

            paymentIntentId: payment.paymentIntentId,
            status: payment.status,
            currency: payment.currency || 'CAD',

            // Amounts based on role
            amounts: isClient ? {
                bidAmount: payment.bidAmount || task.acceptedBidAmount || 0,
                platformFee: payment.clientPlatformFee || 0,
                reservationFee: payment.reservationFee || 0,
                tax: payment.clientTax || 0,
                total: payment.totalClientPays || 0,
            } : {
                bidAmount: payment.bidAmount || task.acceptedBidAmount || 0,
                platformFee: payment.taskerPlatformFee || 0,
                tax: payment.taskerTax || 0,
                payout: payment.taskerPayout || 0,
            },

            // Timeline
            timeline: [
                payment.authorizedAt && {
                    event: 'Payment Authorized',
                    date: payment.authorizedAt,
                },
                payment.capturedAt && {
                    event: 'Payment Captured',
                    date: payment.capturedAt,
                },
                payment.releasedAt && {
                    event: 'Payment Released',
                    date: payment.releasedAt,
                },
                payment.refundedAt && {
                    event: 'Refund Issued',
                    date: payment.refundedAt,
                },
            ].filter(Boolean),

            receiptUrl,
        };

        return res.status(200).json({
            success: true,
            payment: paymentDetails,
            userRole: isClient ? 'client' : 'tasker',
        });

    } catch (error) {
        console.error('Error fetching payment details:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch payment details',
            details: error.message
        });
    }
};

/**
 * Download receipt
 */
export const downloadReceipt = async (req, res) => {
    try {
        const userId = req.user.id;
        const { taskId } = req.params;

        const task = await Task.findById(taskId)
            .populate('acceptedBy', 'firstName lastName email')
            .populate('client', 'firstName lastName email')
            .lean();

        if (!task) {
            return res.status(404).json({ success: false, error: 'Task not found' });
        }

        // Check authorization
        if (task.client._id.toString() !== userId && task.acceptedBy?._id?.toString() !== userId) {
            return res.status(403).json({ success: false, error: 'Not authorized' });
        }

        if (!task.payment?.paymentIntentId) {
            return res.status(404).json({ success: false, error: 'No payment found' });
        }

        // Try to get Stripe receipt URL
        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(
                task.payment.paymentIntentId,
                { expand: ['charges'] }
            );

            const receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url;

            if (receiptUrl) {
                return res.status(200).json({
                    success: true,
                    receiptUrl,
                    type: 'stripe_receipt'
                });
            }
        } catch (stripeError) {
            console.error('Stripe error:', stripeError.message);
        }

        // Generate receipt data
        const isClient = task.client._id.toString() === userId;
        const payment = task.payment;

        const receiptData = {
            receiptNumber: `RCP-${task._id.toString().slice(-8).toUpperCase()}`,
            date: payment.capturedAt || payment.authorizedAt || new Date(),

            task: {
                title: task.taskTitle,
                id: task._id.toString(),
            },

            payment: isClient ? {
                items: [
                    { description: 'Task Price', amount: payment.bidAmount || 0 },
                    { description: 'Platform Fee (10%)', amount: payment.clientPlatformFee || 0 },
                    { description: 'Reservation Fee', amount: payment.reservationFee || 0 },
                    { description: 'HST (13%)', amount: payment.clientTax || 0 },
                ],
                total: payment.totalClientPays || 0,
            } : {
                items: [
                    { description: 'Task Earnings', amount: payment.bidAmount || 0 },
                    { description: 'Platform Fee (12%)', amount: -(payment.taskerPlatformFee || 0) },
                    { description: 'Tax (13%)', amount: -(payment.taskerTax || 0) },
                ],
                total: payment.taskerPayout || 0,
            },

            currency: 'CAD',
            status: payment.status,
        };

        return res.status(200).json({
            success: true,
            receiptData,
            type: 'generated_receipt'
        });

    } catch (error) {
        console.error('Error generating receipt:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to generate receipt',
            details: error.message
        });
    }
};

// Don't forget to add mongoose import at the top


export default {
    getClientPaymentHistory,
    getPaymentDetails,
    downloadReceipt,
    getClientPaymentSummary,
};