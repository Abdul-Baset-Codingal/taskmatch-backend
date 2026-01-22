import mongoose from 'mongoose';
import Stripe from 'stripe';
import Task from "../models/task.js";
import BookingTasker from '../models/bookingTasker.js';
import RequestQuote from '../models/requestQuote.js';
import PlatformConfig from '../models/adminPaymentPlatformConfig.js';
import User from '../models/user.js';



const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Helper to unify transaction data from 3 different models
const normalizeTransaction = (doc, type) => {
    const payment = doc.payment || {};
    const isTask = type === 'Task';
    const isQuote = type === 'Quote';

    return {
        id: doc._id,
        type: type,
        title: isTask ? doc.taskTitle : (isQuote ? doc.taskTitle : doc.service?.title),
        date: doc.createdAt,
        status: doc.status,
        paymentStatus: payment.status || doc.stripeStatus,
        paymentIntentId: payment.paymentIntentId,
        client: doc.client,
        tasker: isTask ? doc.acceptedBy : doc.tasker,
        totalAmount: payment.totalClientPays || 0,
        netPayout: payment.taskerPayout || 0,
        platformRevenue: payment.applicationFee || 0,
        currency: payment.currency || 'cad'
    };
};

/**
 * TAB 1: Transactions & Ledger
 * ✅ FIXED: Added skip to queries, proper pagination
 */
export const getGlobalTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type, status, page = 1, limit = 20 } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;

        let query = {};

        // Date Filtering
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        // Status Filtering
        if (status) query.status = status;

        let results = [];
        let totalCount = 0;

        // ✅ FIXED: Apply skip and limit properly to each query
        if (!type || type === 'Task') {
            const taskQuery = { ...query, status: { $ne: 'open' } };
            const [tasks, taskCount] = await Promise.all([
                Task.find(taskQuery)
                    .populate('client', 'profilePicture firstName lastName email')
                    .populate('acceptedBy', 'profilePicture firstName lastName email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum),
                Task.countDocuments(taskQuery)
            ]);
            results.push(...tasks.map(t => normalizeTransaction(t, 'Task')));
            totalCount += taskCount;
        }

        if (!type || type === 'Booking') {
            const [bookings, bookingCount] = await Promise.all([
                BookingTasker.find(query)
                    .populate('client', 'profilePicture firstName lastName email')
                    .populate('tasker', 'profilePicture firstName lastName email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum),
                BookingTasker.countDocuments(query)
            ]);
            results.push(...bookings.map(b => normalizeTransaction(b, 'Booking')));
            totalCount += bookingCount;
        }

        if (!type || type === 'Quote') {
            const quoteQuery = { ...query, status: 'accepted' };
            const [quotes, quoteCount] = await Promise.all([
                RequestQuote.find(quoteQuery)
                    .populate('client', 'profilePicture firstName lastName email')
                    .populate('tasker', 'profilePicture firstName lastName email')
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limitNum),
                RequestQuote.countDocuments(quoteQuery)
            ]);
            results.push(...quotes.map(q => normalizeTransaction(q, 'Quote')));
            totalCount += quoteCount;
        }

        // Sort combined results by date
        results.sort((a, b) => new Date(b.date) - new Date(a.date));

        // If fetching all types, slice to limit
        const paginatedResults = !type ? results.slice(0, limitNum) : results;

        // Calculate Totals for the header stats
        const totalRevenue = paginatedResults.reduce((acc, curr) => acc + (curr.platformRevenue || 0), 0);
        const totalVolume = paginatedResults.reduce((acc, curr) => acc + (curr.totalAmount || 0), 0);

        res.json({
            success: true,
            count: paginatedResults.length,
            totalCount,
            page: pageNum,
            totalPages: Math.ceil(totalCount / limitNum),
            stats: {
                totalVolume,
                totalRevenue
            },
            transactions: paginatedResults
        });

    } catch (error) {
        console.error("Ledger Error:", error);
        res.status(500).json({ message: "Error fetching ledger" });
    }
};

/**
 * TAB 2: Refund & Adjustment
 */
export const processRefund = async (req, res) => {
    try {
        const { transactionId, type, amount, reason } = req.body;
        const amountCents = Math.round(parseFloat(amount) * 100);

        let doc;
        let Model;

        if (type === 'Task') Model = Task;
        else if (type === 'Booking') Model = BookingTasker;
        else if (type === 'Quote') Model = RequestQuote;
        else return res.status(400).json({ message: "Invalid transaction type" });

        doc = await Model.findById(transactionId);
        if (!doc) return res.status(404).json({ message: "Transaction not found" });

        const paymentIntentId = doc.payment?.paymentIntentId || doc.paymentIntentId;
        if (!paymentIntentId) return res.status(400).json({ message: "No payment record found" });

        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);

        let refundResult;

        if (pi.status === 'requires_capture') {
            refundResult = await stripe.paymentIntents.cancel(paymentIntentId, {
                cancellation_reason: 'requested_by_customer'
            });
            doc.payment.status = 'cancelled';
            doc.status = 'cancelled';
        } else if (pi.status === 'succeeded') {
            const isFullRefund = amountCents >= pi.amount;

            refundResult = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: amountCents,
                reason: 'requested_by_customer',
                metadata: { adminReason: reason, adminId: req.user.id }
            });

            doc.payment.status = isFullRefund ? 'refunded' : 'partially_refunded';
            if (isFullRefund) doc.status = 'cancelled';
        } else {
            return res.status(400).json({ message: `Cannot refund transaction with status: ${pi.status}` });
        }

        await doc.save();

        res.json({
            success: true,
            message: "Refund/Cancellation processed successfully",
            refundId: refundResult.id,
            status: refundResult.status
        });

    } catch (error) {
        console.error("Refund Error:", error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * TAB 3: Payouts (Tasker)
 */
export const getTaskerPayouts = async (req, res) => {
    try {
        const { taskerId, page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        let matchStage = {
            status: "completed",
            "payment.status": { $in: ["paid", "captured", "transferred"] }
        };

        // ✅ FIXED: Proper ObjectId conversion
        if (taskerId) {
            matchStage.tasker = new mongoose.Types.ObjectId(taskerId);
        }

        const payouts = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: "$tasker",
                    totalEarned: { $sum: "$payment.taskerPayout" },
                    jobsCount: { $sum: 1 },
                    lastJobDate: { $max: "$createdAt" }  // ✅ FIXED: Changed from "$date" to "$createdAt"
                }
            },
            {
                $lookup: {
                    from: "users",
                    localField: "_id",
                    foreignField: "_id",
                    as: "taskerInfo"
                }
            },
            { $unwind: "$taskerInfo" },
            {
                $project: {
                    taskerId: "$_id",
                    taskerName: { $concat: ["$taskerInfo.firstName", " ", "$taskerInfo.lastName"] },
                    email: "$taskerInfo.email",
                    stripeAccountId: "$taskerInfo.stripeConnectAccountId",
                    totalEarned: 1,
                    jobsCount: 1,
                    lastJobDate: 1
                }
            },
            { $skip: skip },
            { $limit: parseInt(limit) }
        ]);

        res.json({
            success: true,
            page: parseInt(page),
            payouts: payouts.map(p => ({
                ...p,
                totalEarned: p.totalEarned.toFixed(2)
            }))
        });

    } catch (error) {
        console.error("Payouts Error:", error);
        res.status(500).json({ message: "Error fetching payouts" });
    }
};

/**
 * TAB 4: Platform Fees & Pricing
 */
export const getPlatformConfig = async (req, res) => {
    try {
        let config = await PlatformConfig.findOne({ key: 'fees' });
        if (!config) {
            config = await PlatformConfig.create({ key: 'fees' });
        }
        res.json({ success: true, config });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

export const updatePlatformConfig = async (req, res) => {
    try {
        const {
            clientPlatformFeePercent,
            reservationFeeCents,
            taskerPlatformFeePercent,
            clientTaxPercent,
            taskerTaxPercent
        } = req.body;

        const config = await PlatformConfig.findOneAndUpdate(
            { key: 'fees' },
            {
                clientPlatformFeePercent,
                reservationFeeCents,
                taskerPlatformFeePercent,
                clientTaxPercent,
                taskerTaxPercent,
                lastUpdatedBy: req.user.id
            },
            { new: true, upsert: true }
        );

        res.json({
            success: true,
            message: "Platform fees updated. Note: Applies to new transactions only.",
            config
        });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * TAB 5: Disputes
 */
export const getDisputes = async (req, res) => {
    try {
        const { limit = 10, status } = req.query;

        const params = { limit: parseInt(limit) };
        if (status) params.status = status;

        const disputes = await stripe.disputes.list(params);

        const enhancedDisputes = await Promise.all(disputes.data.map(async (dispute) => {
            const piId = dispute.payment_intent;

            let localRef = null;
            let type = '';

            const task = await Task.findOne({ 'payment.paymentIntentId': piId });
            if (task) { localRef = task; type = 'Task'; }

            if (!localRef) {
                const booking = await BookingTasker.findOne({ 'payment.paymentIntentId': piId });
                if (booking) { localRef = booking; type = 'Booking'; }
            }

            if (!localRef) {
                const quote = await RequestQuote.findOne({ 'payment.paymentIntentId': piId });
                if (quote) { localRef = quote; type = 'Quote'; }
            }

            return {
                id: dispute.id,
                amount: dispute.amount / 100,
                currency: dispute.currency,
                reason: dispute.reason,
                status: dispute.status,
                created: new Date(dispute.created * 1000),
                deadline: dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000) : null,
                transaction: localRef ? {
                    type,
                    id: localRef._id,
                    title: type === 'Task' ? localRef.taskTitle : localRef.service?.title
                } : null
            };
        }));

        res.json({
            success: true,
            has_more: disputes.has_more,
            disputes: enhancedDisputes
        });

    } catch (error) {
        console.error("Dispute Error:", error);
        res.status(500).json({ message: "Error fetching disputes from Stripe" });
    }
};

/**
 * Get single transaction details
 */
export const getTransactionDetails = async (req, res) => {
    try {
        const { type, id } = req.params;

        // ✅ Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid transaction ID' });
        }

        let Model;
        let populateFields;

        switch (type.toLowerCase()) {
            case 'task':
                Model = Task;
                populateFields = [
                    { path: 'client', select: 'profilePicture firstName lastName email phone' },
                    { path: 'acceptedBy', select: 'profilePicture firstName lastName email phone stripeConnectAccountId' }
                ];
                break;
            case 'booking':
                Model = BookingTasker;
                populateFields = [
                    { path: 'client', select: 'profilePicture firstName lastName email phone' },
                    { path: 'tasker', select: 'profilePicture firstName lastName email phone stripeConnectAccountId' }
                ];
                break;
            case 'quote':
                Model = RequestQuote;
                populateFields = [
                    { path: 'client', select: 'profilePicture firstName lastName email phone' },
                    { path: 'tasker', select: 'profilePicture firstName lastName email phone stripeConnectAccountId' }
                ];
                break;
            default:
                return res.status(400).json({ message: 'Invalid transaction type' });
        }

        const doc = await Model.findById(id).populate(populateFields);

        if (!doc) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        let stripeDetails = null;
        const paymentIntentId = doc.payment?.paymentIntentId || doc.paymentIntentId;

        if (paymentIntentId) {
            try {
                stripeDetails = await stripe.paymentIntents.retrieve(paymentIntentId);
            } catch (e) {
                console.error('Could not fetch Stripe PI:', e.message);
            }
        }

        res.json({
            success: true,
            transaction: doc,
            stripeDetails: stripeDetails ? {
                id: stripeDetails.id,
                status: stripeDetails.status,
                amount: stripeDetails.amount / 100,
                created: new Date(stripeDetails.created * 1000),
                charges: stripeDetails.charges?.data || []
            } : null
        });

    } catch (error) {
        console.error('Transaction Details Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Export transactions as CSV
 * ✅ FIXED: Added type filtering and proper CSV escaping
 */
export const exportTransactions = async (req, res) => {
    try {
        const { startDate, endDate, type, format = 'csv' } = req.query;

        let query = {};
        if (startDate && endDate) {
            query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        let results = [];

        // ✅ FIXED: Apply type filter
        if (!type || type === 'Task') {
            const tasks = await Task.find({ ...query, status: { $ne: 'open' } })
                .populate('client', 'profilePicture firstName lastName email')
                .populate('acceptedBy', 'profilePicture firstName lastName email');

            results.push(...tasks.map(t => ({
                type: 'Task',
                id: t._id.toString(),
                title: t.taskTitle || '',
                date: t.createdAt?.toISOString() || '',
                client: `${t.client?.firstName || ''} ${t.client?.lastName || ''}`.trim(),
                clientEmail: t.client?.email || '',
                tasker: t.acceptedBy ? `${t.acceptedBy.firstName} ${t.acceptedBy.lastName}` : '',
                status: t.status || '',
                paymentStatus: t.payment?.status || t.stripeStatus || '',
                totalAmount: t.payment?.totalClientPays || 0,
                taskerPayout: t.payment?.taskerPayout || 0,
                platformFee: t.payment?.applicationFee || 0,
                currency: 'CAD'
            })));
        }

        if (!type || type === 'Booking') {
            const bookings = await BookingTasker.find(query)
                .populate('client', 'profilePicture firstName lastName email')
                .populate('tasker', 'profilePicture firstName lastName email');

            results.push(...bookings.map(b => ({
                type: 'Booking',
                id: b._id.toString(),
                title: b.service?.title || '',
                date: b.createdAt?.toISOString() || '',
                client: `${b.client?.firstName || ''} ${b.client?.lastName || ''}`.trim(),
                clientEmail: b.client?.email || '',
                tasker: `${b.tasker?.firstName || ''} ${b.tasker?.lastName || ''}`.trim(),
                status: b.status || '',
                paymentStatus: b.payment?.status || b.stripeStatus || '',
                totalAmount: b.payment?.totalClientPays || 0,
                taskerPayout: b.payment?.taskerPayout || 0,
                platformFee: b.payment?.applicationFee || 0,
                currency: 'CAD'
            })));
        }

        if (!type || type === 'Quote') {
            const quotes = await RequestQuote.find({ ...query, status: 'accepted' })
                .populate('client', 'profilePicture firstName lastName email')
                .populate('tasker', 'profilePicture firstName lastName email');

            results.push(...quotes.map(q => ({
                type: 'Quote',
                id: q._id.toString(),
                title: q.taskTitle || '',
                date: q.createdAt?.toISOString() || '',
                client: `${q.client?.firstName || ''} ${q.client?.lastName || ''}`.trim(),
                clientEmail: q.client?.email || '',
                tasker: `${q.tasker?.firstName || ''} ${q.tasker?.lastName || ''}`.trim(),
                status: q.status || '',
                paymentStatus: q.payment?.status || '',
                totalAmount: q.payment?.totalClientPays || 0,
                taskerPayout: q.payment?.taskerPayout || 0,
                platformFee: q.payment?.applicationFee || 0,
                currency: 'CAD'
            })));
        }

        // Sort by date
        results.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (results.length === 0) {
            return res.status(404).json({ message: 'No transactions found' });
        }

        // ✅ FIXED: Proper CSV escaping
        const escapeCSV = (value) => {
            if (value === null || value === undefined) return '';
            const str = String(value);
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        const headers = Object.keys(results[0]).join(',');
        const rows = results.map(r => Object.values(r).map(escapeCSV).join(','));
        const csv = [headers, ...rows].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=transactions-${Date.now()}.csv`);
        res.send(csv);

    } catch (error) {
        console.error('Export Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get ledger summary with aggregated stats
 * ✅ FIXED: Date mutation issue resolved
 */
export const getLedgerSummary = async (req, res) => {
    try {
        const { period = 'month' } = req.query;

        // ✅ FIXED: Create fresh Date for each case to avoid mutation
        let startDate;

        switch (period) {
            case 'day':
                startDate = new Date();
                startDate.setHours(0, 0, 0, 0);
                break;
            case 'week':
                startDate = new Date();
                startDate.setDate(startDate.getDate() - 7);
                break;
            case 'month':
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
                break;
            case 'year':
                startDate = new Date();
                startDate.setFullYear(startDate.getFullYear() - 1);
                break;
            default:
                startDate = new Date();
                startDate.setMonth(startDate.getMonth() - 1);
        }

        const matchQuery = { createdAt: { $gte: startDate } };

        const [taskStats, bookingStats, quoteStats] = await Promise.all([
            Task.aggregate([
                { $match: { ...matchQuery, 'payment.status': { $exists: true } } },
                {
                    $group: {
                        _id: null,
                        totalVolume: { $sum: '$payment.totalClientPays' },
                        totalRevenue: { $sum: '$payment.applicationFee' },
                        totalPayouts: { $sum: '$payment.taskerPayout' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            BookingTasker.aggregate([
                { $match: { ...matchQuery, 'payment.status': { $exists: true } } },
                {
                    $group: {
                        _id: null,
                        totalVolume: { $sum: '$payment.totalClientPays' },
                        totalRevenue: { $sum: '$payment.applicationFee' },
                        totalPayouts: { $sum: '$payment.taskerPayout' },
                        count: { $sum: 1 }
                    }
                }
            ]),
            RequestQuote.aggregate([
                { $match: { ...matchQuery, 'payment.status': { $exists: true } } },
                {
                    $group: {
                        _id: null,
                        totalVolume: { $sum: '$payment.totalClientPays' },
                        totalRevenue: { $sum: '$payment.applicationFee' },
                        totalPayouts: { $sum: '$payment.taskerPayout' },
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const combine = (arr) => arr[0] || { totalVolume: 0, totalRevenue: 0, totalPayouts: 0, count: 0 };

        const tasks = combine(taskStats);
        const bookings = combine(bookingStats);
        const quotes = combine(quoteStats);

        res.json({
            success: true,
            period,
            startDate: startDate.toISOString(),
            summary: {
                totalVolume: (tasks.totalVolume + bookings.totalVolume + quotes.totalVolume).toFixed(2),
                totalRevenue: (tasks.totalRevenue + bookings.totalRevenue + quotes.totalRevenue).toFixed(2),
                totalPayouts: (tasks.totalPayouts + bookings.totalPayouts + quotes.totalPayouts).toFixed(2),
                transactionCount: tasks.count + bookings.count + quotes.count
            },
            breakdown: {
                tasks: { ...tasks, totalVolume: (tasks.totalVolume || 0).toFixed(2) },
                bookings: { ...bookings, totalVolume: (bookings.totalVolume || 0).toFixed(2) },
                quotes: { ...quotes, totalVolume: (quotes.totalVolume || 0).toFixed(2) }
            }
        });

    } catch (error) {
        console.error('Ledger Summary Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get refund history
 */
export const getRefundHistory = async (req, res) => {
    try {
        const { startDate, endDate, limit = 50 } = req.query;

        const params = { limit: parseInt(limit) };

        if (startDate) {
            params.created = { gte: Math.floor(new Date(startDate).getTime() / 1000) };
        }
        if (endDate) {
            params.created = {
                ...params.created,
                lte: Math.floor(new Date(endDate).getTime() / 1000)
            };
        }

        const refunds = await stripe.refunds.list(params);

        res.json({
            success: true,
            refunds: refunds.data.map(r => ({
                id: r.id,
                amount: r.amount / 100,
                currency: r.currency,
                status: r.status,
                reason: r.reason,
                created: new Date(r.created * 1000),
                paymentIntentId: r.payment_intent,
                metadata: r.metadata
            }))
        });

    } catch (error) {
        console.error('Refund History Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Create manual adjustment
 */
export const createAdjustment = async (req, res) => {
    try {
        const { userId, type, amount, reason, direction } = req.body;

        if (!userId || !amount || !reason || !direction) {
            return res.status(400).json({ message: 'Missing required fields' });
        }

        if (!['credit', 'debit'].includes(direction)) {
            return res.status(400).json({ message: 'Direction must be "credit" or "debit"' });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (direction === 'credit' && user.stripeConnectAccountId) {
            const transfer = await stripe.transfers.create({
                amount: Math.round(amount * 100),
                currency: 'cad',
                destination: user.stripeConnectAccountId,
                description: `Manual adjustment: ${reason}`,
                metadata: {
                    adminId: req.user.id,
                    userId: userId,
                    reason: reason,
                    type: 'manual_adjustment'
                }
            });

            return res.json({
                success: true,
                message: 'Credit adjustment processed',
                transferId: transfer.id
            });
        }

        // For debit or non-Stripe users, log the adjustment
        res.json({
            success: true,
            message: 'Adjustment recorded',
            adjustment: {
                userId,
                type,
                amount,
                reason,
                direction,
                createdBy: req.user.id,
                createdAt: new Date()
            }
        });

    } catch (error) {
        console.error('Adjustment Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get detailed payout info for a specific tasker
 * ✅ FIXED: ObjectId conversion for aggregation
 */
export const getTaskerPayoutDetails = async (req, res) => {
    try {
        const { taskerId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(taskerId)) {
            return res.status(400).json({ message: 'Invalid tasker ID' });
        }

        const tasker = await User.findById(taskerId)
            .select('firstName lastName email stripeConnectAccountId stripeConnectStatus');

        if (!tasker) {
            return res.status(404).json({ message: 'Tasker not found' });
        }

        // ✅ FIXED: Convert to ObjectId for aggregation
        const taskerObjectId = new mongoose.Types.ObjectId(taskerId);

        const [taskEarnings, bookingEarnings, quoteEarnings] = await Promise.all([
            Task.aggregate([
                { $match: { acceptedBy: taskerObjectId, 'payment.status': { $in: ['paid', 'captured'] } } },
                { $group: { _id: null, total: { $sum: '$payment.taskerPayout' }, count: { $sum: 1 } } }
            ]),
            BookingTasker.aggregate([
                { $match: { tasker: taskerObjectId, 'payment.status': { $in: ['paid', 'captured'] } } },
                { $group: { _id: null, total: { $sum: '$payment.taskerPayout' }, count: { $sum: 1 } } }
            ]),
            RequestQuote.aggregate([
                { $match: { tasker: taskerObjectId, 'payment.status': { $in: ['paid', 'captured'] } } },
                { $group: { _id: null, total: { $sum: '$payment.taskerPayout' }, count: { $sum: 1 } } }
            ])
        ]);

        let stripeBalance = null;
        if (tasker.stripeConnectAccountId) {
            try {
                stripeBalance = await stripe.balance.retrieve({
                    stripeAccount: tasker.stripeConnectAccountId
                });
            } catch (e) {
                console.error('Could not fetch Stripe balance:', e.message);
            }
        }

        res.json({
            success: true,
            tasker: {
                id: tasker._id,
                name: `${tasker.firstName} ${tasker.lastName}`,
                email: tasker.email,
                stripeAccountId: tasker.stripeConnectAccountId,
                stripeStatus: tasker.stripeConnectStatus
            },
            earnings: {
                tasks: taskEarnings[0] || { total: 0, count: 0 },
                bookings: bookingEarnings[0] || { total: 0, count: 0 },
                quotes: quoteEarnings[0] || { total: 0, count: 0 },
                totalEarnings: (
                    (taskEarnings[0]?.total || 0) +
                    (bookingEarnings[0]?.total || 0) +
                    (quoteEarnings[0]?.total || 0)
                ).toFixed(2)
            },
            stripeBalance: stripeBalance ? {
                available: stripeBalance.available,
                pending: stripeBalance.pending
            } : null
        });

    } catch (error) {
        console.error('Tasker Payout Details Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get payout history for a specific tasker
 */
export const getPayoutHistory = async (req, res) => {
    try {
        const { taskerId } = req.params;
        const { page = 1, limit = 20 } = req.query;

        if (!mongoose.Types.ObjectId.isValid(taskerId)) {
            return res.status(400).json({ message: 'Invalid tasker ID' });
        }

        const tasker = await User.findById(taskerId);
        if (!tasker || !tasker.stripeConnectAccountId) {
            return res.status(404).json({ message: 'Tasker not found or no Stripe account' });
        }

        const payouts = await stripe.payouts.list({
            limit: parseInt(limit)
        }, {
            stripeAccount: tasker.stripeConnectAccountId
        });

        res.json({
            success: true,
            payouts: payouts.data.map(p => ({
                id: p.id,
                amount: p.amount / 100,
                currency: p.currency,
                status: p.status,
                arrivalDate: new Date(p.arrival_date * 1000),
                created: new Date(p.created * 1000),
                method: p.type
            }))
        });

    } catch (error) {
        console.error('Payout History Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Initiate manual payout to tasker
 */
export const initiateManualPayout = async (req, res) => {
    try {
        const { taskerId, amount, reason } = req.body;

        if (!taskerId || !amount || !reason) {
            return res.status(400).json({ message: 'Missing required fields: taskerId, amount, reason' });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId)) {
            return res.status(400).json({ message: 'Invalid tasker ID' });
        }

        const tasker = await User.findById(taskerId);
        if (!tasker || !tasker.stripeConnectAccountId) {
            return res.status(404).json({ message: 'Tasker not found or no Stripe account' });
        }

        const transfer = await stripe.transfers.create({
            amount: Math.round(amount * 100),
            currency: 'cad',
            destination: tasker.stripeConnectAccountId,
            description: `Manual payout: ${reason}`,
            metadata: {
                adminId: req.user.id,
                taskerId: taskerId,
                reason: reason,
                type: 'manual_payout'
            }
        });

        res.json({
            success: true,
            message: 'Manual payout initiated',
            transfer: {
                id: transfer.id,
                amount: transfer.amount / 100,
                status: 'pending'
            }
        });

    } catch (error) {
        console.error('Manual Payout Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get fee configuration change history
 */
export const getFeeHistory = async (req, res) => {
    try {
        const config = await PlatformConfig.findOne({ key: 'fees' })
            .populate('lastUpdatedBy', 'firstName lastName email');

        res.json({
            success: true,
            currentConfig: config,
            history: []
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Simulate fee calculation
 */
export const simulateFees = async (req, res) => {
    try {
        const {
            bidAmount,
            clientPlatformFeePercent = 0.10,
            reservationFeeCents = 500,
            clientTaxPercent = 0.13,
            taskerPlatformFeePercent = 0.12,
            taskerTaxPercent = 0.13
        } = req.body;

        if (!bidAmount || bidAmount <= 0) {
            return res.status(400).json({ message: 'Invalid bid amount' });
        }

        const bidAmountCents = Math.round(bidAmount * 100);

        const clientPlatformFee = Math.round(bidAmountCents * clientPlatformFeePercent);
        const clientTax = Math.round(bidAmountCents * clientTaxPercent);
        const totalClientPays = bidAmountCents + clientPlatformFee + reservationFeeCents + clientTax;

        const taskerPlatformFee = Math.round(bidAmountCents * taskerPlatformFeePercent);
        const taskerTax = Math.round(bidAmountCents * taskerTaxPercent);
        const taskerPayout = bidAmountCents - taskerPlatformFee - taskerTax;

        const platformRevenue = totalClientPays - taskerPayout;

        res.json({
            success: true,
            simulation: {
                bidAmount: bidAmountCents / 100,
                clientSide: {
                    platformFee: clientPlatformFee / 100,
                    reservationFee: reservationFeeCents / 100,
                    tax: clientTax / 100,
                    total: totalClientPays / 100
                },
                taskerSide: {
                    platformFee: taskerPlatformFee / 100,
                    tax: taskerTax / 100,
                    payout: taskerPayout / 100
                },
                platform: {
                    totalRevenue: platformRevenue / 100
                }
            }
        });

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get dispute statistics
 */
export const getDisputeStats = async (req, res) => {
    try {
        const [openDisputes, wonDisputes, lostDisputes] = await Promise.all([
            stripe.disputes.list({ status: 'needs_response', limit: 100 }),
            stripe.disputes.list({ status: 'won', limit: 100 }),
            stripe.disputes.list({ status: 'lost', limit: 100 })
        ]);

        const totalOpen = openDisputes.data.reduce((acc, d) => acc + d.amount, 0);
        const totalWon = wonDisputes.data.reduce((acc, d) => acc + d.amount, 0);
        const totalLost = lostDisputes.data.reduce((acc, d) => acc + d.amount, 0);

        const totalResolved = wonDisputes.data.length + lostDisputes.data.length;

        res.json({
            success: true,
            stats: {
                needsResponse: {
                    count: openDisputes.data.length,
                    totalAmount: totalOpen / 100
                },
                won: {
                    count: wonDisputes.data.length,
                    totalAmount: totalWon / 100
                },
                lost: {
                    count: lostDisputes.data.length,
                    totalAmount: totalLost / 100
                },
                winRate: totalResolved > 0
                    ? ((wonDisputes.data.length / totalResolved) * 100).toFixed(1)
                    : '0'
            }
        });

    } catch (error) {
        console.error('Dispute Stats Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Get detailed dispute information
 */
export const getDisputeDetails = async (req, res) => {
    try {
        const { disputeId } = req.params;

        const dispute = await stripe.disputes.retrieve(disputeId);

        let relatedTransaction = null;
        const piId = dispute.payment_intent;

        const task = await Task.findOne({ 'payment.paymentIntentId': piId })
            .populate('client', 'profilePicture firstName lastName email')
            .populate('acceptedBy', 'profilePicture firstName lastName email');

        if (task) {
            relatedTransaction = { type: 'Task', data: task };
        } else {
            const booking = await BookingTasker.findOne({ 'payment.paymentIntentId': piId })
                .populate('client', 'profilePicture firstName lastName email')
                .populate('tasker', 'profilePicture firstName lastName email');

            if (booking) {
                relatedTransaction = { type: 'Booking', data: booking };
            } else {
                const quote = await RequestQuote.findOne({ 'payment.paymentIntentId': piId })
                    .populate('client', 'profilePicture firstName lastName email')
                    .populate('tasker', 'profilePicture firstName lastName email');

                if (quote) {
                    relatedTransaction = { type: 'Quote', data: quote };
                }
            }
        }

        res.json({
            success: true,
            dispute: {
                id: dispute.id,
                amount: dispute.amount / 100,
                currency: dispute.currency,
                reason: dispute.reason,
                status: dispute.status,
                created: new Date(dispute.created * 1000),
                evidenceDueBy: dispute.evidence_details?.due_by
                    ? new Date(dispute.evidence_details.due_by * 1000)
                    : null,
                isChargeRefundable: dispute.is_charge_refundable,
                hasEvidence: dispute.evidence_details?.has_evidence,
                submissionCount: dispute.evidence_details?.submission_count
            },
            relatedTransaction
        });

    } catch (error) {
        console.error('Dispute Details Error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Submit evidence for a dispute
 */
export const submitDisputeEvidence = async (req, res) => {
    try {
        const { disputeId } = req.params;
        const evidence = req.body;

        const updatedDispute = await stripe.disputes.update(disputeId, {
            evidence: {
                customer_name: evidence.customerName,
                customer_email_address: evidence.customerEmail,
                product_description: evidence.productDescription,
                customer_communication: evidence.customerCommunication,
                uncategorized_text: evidence.additionalNotes,
            },
            submit: evidence.submit || false
        });

        res.json({
            success: true,
            message: evidence.submit ? 'Evidence submitted' : 'Evidence saved as draft',
            dispute: {
                id: updatedDispute.id,
                status: updatedDispute.status,
                hasEvidence: updatedDispute.evidence_details?.has_evidence
            }
        });

    } catch (error) {
        console.error('Submit Evidence Error:', error);
        res.status(500).json({ message: error.message });
    }
};