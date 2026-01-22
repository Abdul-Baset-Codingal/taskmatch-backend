// controllers/adminQuoteController.js
import mongoose from 'mongoose';
import RequestQuote from '../models/requestQuote.js';
import User from '../models/user.js';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Get all request quotes with pagination, filtering, and search
 */
export const getAllQuotes = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            startDate,
            endDate,
            minAmount,
            maxAmount,
            taskerId,
            clientId,
            paymentStatus,
            hasPayment,
        } = req.query;

        // Build query
        const query = {};

        // Status filter
        if (status && status !== 'all') {
            query.status = status;
        }

        // Payment status filter
        if (paymentStatus) {
            query['payment.status'] = paymentStatus;
        }

        // Has payment filter
        if (hasPayment === 'true') {
            query['payment.paymentIntentId'] = { $exists: true, $ne: null };
        } else if (hasPayment === 'false') {
            query['payment.paymentIntentId'] = { $exists: false };
        }

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) {
                query.createdAt.$gte = new Date(startDate);
            }
            if (endDate) {
                query.createdAt.$lte = new Date(endDate);
            }
        }

        // Amount filter (on accepted bid amount)
        if (minAmount || maxAmount) {
            query['acceptedBid.bidAmount'] = {};
            if (minAmount) {
                query['acceptedBid.bidAmount'].$gte = Number(minAmount);
            }
            if (maxAmount) {
                query['acceptedBid.bidAmount'].$lte = Number(maxAmount);
            }
        }

        // Tasker filter
        if (taskerId && mongoose.Types.ObjectId.isValid(taskerId)) {
            query.tasker = new mongoose.Types.ObjectId(taskerId);
        }

        // Client filter
        if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
            query.client = new mongoose.Types.ObjectId(clientId);
        }

        // Search filter (task title or description)
        if (search) {
            query.$or = [
                { taskTitle: { $regex: search, $options: 'i' } },
                { taskDescription: { $regex: search, $options: 'i' } },
                { location: { $regex: search, $options: 'i' } },
            ];
        }

        // Calculate skip for pagination
        const skip = (Number(page) - 1) * Number(limit);

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Execute query with pagination
        const [quotes, totalCount] = await Promise.all([
            RequestQuote.find(query)
                .populate('tasker', 'firstName lastName email phone profilePicture stripeConnectStatus')
                .populate('client', 'firstName lastName email phone profilePicture stripeCustomerId')
                .populate('bids.tasker', 'firstName lastName email')
                .sort(sort)
                .skip(skip)
                .limit(Number(limit))
                .lean(),
            RequestQuote.countDocuments(query),
        ]);

        // Calculate pagination info
        const totalPages = Math.ceil(totalCount / Number(limit));
        const hasNextPage = Number(page) < totalPages;
        const hasPrevPage = Number(page) > 1;

        console.log(`📋 Admin fetched ${quotes.length} quotes (page ${page}/${totalPages})`);

        res.status(200).json({
            success: true,
            quotes,
            pagination: {
                currentPage: Number(page),
                totalPages,
                totalCount,
                limit: Number(limit),
                hasNextPage,
                hasPrevPage,
            },
            filters: {
                status,
                search,
                startDate,
                endDate,
                minAmount,
                maxAmount,
                paymentStatus,
            },
        });
    } catch (error) {
        console.error('Error fetching quotes for admin:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get quote statistics for dashboard
 */
export const getQuoteStatistics = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Date filter for time-based stats
        const dateFilter = {};
        if (startDate) {
            dateFilter.$gte = new Date(startDate);
        }
        if (endDate) {
            dateFilter.$lte = new Date(endDate);
        }

        const dateQuery = Object.keys(dateFilter).length > 0
            ? { createdAt: dateFilter }
            : {};

        // Get counts by status
        const statusCounts = await RequestQuote.aggregate([
            { $match: dateQuery },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                },
            },
        ]);

        // Get payment status counts
        const paymentStatusCounts = await RequestQuote.aggregate([
            { $match: { ...dateQuery, 'payment.status': { $exists: true } } },
            {
                $group: {
                    _id: '$payment.status',
                    count: { $sum: 1 },
                },
            },
        ]);

        // Get revenue statistics
        const revenueStats = await RequestQuote.aggregate([
            {
                $match: {
                    ...dateQuery,
                    'payment.status': { $in: ['captured', 'released', 'held'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalBidAmount: { $sum: '$payment.bidAmount' },
                    totalClientPaid: { $sum: '$payment.totalClientPays' },
                    totalTaskerPayout: { $sum: '$payment.taskerPayout' },
                    totalPlatformFee: { $sum: '$payment.applicationFee' },
                    totalReservationFees: { $sum: '$payment.reservationFee' },
                    totalClientTax: { $sum: '$payment.clientTax' },
                    totalTaskerTax: { $sum: '$payment.taskerTax' },
                    transactionCount: { $sum: 1 },
                },
            },
        ]);

        // Get held payments (pending release)
        const heldPayments = await RequestQuote.aggregate([
            { $match: { 'payment.status': 'held' } },
            {
                $group: {
                    _id: null,
                    totalHeldAmount: { $sum: '$payment.totalClientPaysCents' },
                    count: { $sum: 1 },
                },
            },
        ]);

        // Get quotes per day (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const quotesPerDay = await RequestQuote.aggregate([
            { $match: { createdAt: { $gte: thirtyDaysAgo } } },
            {
                $group: {
                    _id: {
                        $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                    },
                    count: { $sum: 1 },
                    totalBidAmount: { $sum: '$acceptedBid.bidAmount' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Get top taskers by completed quotes
        const topTaskers = await RequestQuote.aggregate([
            { $match: { status: 'completed', ...dateQuery } },
            {
                $group: {
                    _id: '$tasker',
                    completedCount: { $sum: 1 },
                    totalEarnings: { $sum: '$payment.taskerPayout' },
                },
            },
            { $sort: { completedCount: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'taskerInfo',
                },
            },
            { $unwind: '$taskerInfo' },
            {
                $project: {
                    _id: 1,
                    completedCount: 1,
                    totalEarnings: 1,
                    firstName: '$taskerInfo.firstName',
                    lastName: '$taskerInfo.lastName',
                    email: '$taskerInfo.email',
                },
            },
        ]);

        // Get top clients by spending
        const topClients = await RequestQuote.aggregate([
            { $match: { status: { $in: ['completed', 'accepted', 'in_progress'] }, ...dateQuery } },
            {
                $group: {
                    _id: '$client',
                    quoteCount: { $sum: 1 },
                    totalSpent: { $sum: '$payment.totalClientPays' },
                },
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'clientInfo',
                },
            },
            { $unwind: '$clientInfo' },
            {
                $project: {
                    _id: 1,
                    quoteCount: 1,
                    totalSpent: 1,
                    firstName: '$clientInfo.firstName',
                    lastName: '$clientInfo.lastName',
                    email: '$clientInfo.email',
                },
            },
        ]);

        // Calculate conversion rates
        const totalQuotes = statusCounts.reduce((acc, s) => acc + s.count, 0);
        const acceptedQuotes = statusCounts.find(s => s._id === 'accepted')?.count || 0;
        const completedQuotes = statusCounts.find(s => s._id === 'completed')?.count || 0;
        const cancelledQuotes = statusCounts.find(s => s._id === 'cancelled')?.count || 0;

        // Format status counts
        const formattedStatusCounts = {};
        statusCounts.forEach(s => {
            formattedStatusCounts[s._id] = s.count;
        });

        // Format payment status counts
        const formattedPaymentStatusCounts = {};
        paymentStatusCounts.forEach(s => {
            formattedPaymentStatusCounts[s._id] = s.count;
        });

        res.status(200).json({
            success: true,
            statistics: {
                // Overview counts
                overview: {
                    totalQuotes,
                    statusBreakdown: formattedStatusCounts,
                    paymentStatusBreakdown: formattedPaymentStatusCounts,
                },

                // Conversion metrics
                conversions: {
                    acceptanceRate: totalQuotes > 0
                        ? ((acceptedQuotes + completedQuotes) / totalQuotes * 100).toFixed(2)
                        : 0,
                    completionRate: (acceptedQuotes + completedQuotes) > 0
                        ? (completedQuotes / (acceptedQuotes + completedQuotes) * 100).toFixed(2)
                        : 0,
                    cancellationRate: totalQuotes > 0
                        ? (cancelledQuotes / totalQuotes * 100).toFixed(2)
                        : 0,
                },

                // Revenue
                revenue: revenueStats[0] || {
                    totalBidAmount: 0,
                    totalClientPaid: 0,
                    totalTaskerPayout: 0,
                    totalPlatformFee: 0,
                    totalReservationFees: 0,
                    totalClientTax: 0,
                    totalTaskerTax: 0,
                    transactionCount: 0,
                },

                // Held payments
                heldPayments: heldPayments[0] || {
                    totalHeldAmount: 0,
                    count: 0,
                },

                // Time series
                quotesPerDay,

                // Top performers
                topTaskers,
                topClients,
            },
            dateRange: {
                startDate: startDate || 'all time',
                endDate: endDate || 'now',
            },
        });
    } catch (error) {
        console.error('Error fetching quote statistics:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get single quote with full details
 */
export const getQuoteById = async (req, res) => {
    try {
        const { quoteId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email phone profilePicture stripeConnectAccountId stripeConnectStatus currentRole createdAt')
            .populate('client', 'firstName lastName email phone profilePicture stripeCustomerId currentRole createdAt address')
            .populate('bids.tasker', 'firstName lastName email profilePicture')
            .populate('cancelledBy', 'firstName lastName email')
            .lean();

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        // If there's a payment intent, fetch latest status from Stripe
        let stripePaymentDetails = null;
        if (quote.payment?.paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(
                    quote.payment.paymentIntentId
                );
                stripePaymentDetails = {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount,
                    amountReceived: paymentIntent.amount_received,
                    currency: paymentIntent.currency,
                    created: new Date(paymentIntent.created * 1000),
                    captureMethod: paymentIntent.capture_method,
                    metadata: paymentIntent.metadata,
                    charges: paymentIntent.latest_charge,
                };
            } catch (stripeError) {
                console.error('Error fetching Stripe payment:', stripeError.message);
            }
        }

        // Calculate timeline
        const timeline = [];

        if (quote.createdAt) {
            timeline.push({ event: 'Quote Created', date: quote.createdAt, status: 'completed' });
        }

        if (quote.bids && quote.bids.length > 0) {
            quote.bids.forEach((bid, index) => {
                timeline.push({
                    event: `Bid #${index + 1} Submitted ($${bid.bidAmount})`,
                    date: bid.submittedAt,
                    status: bid.status
                });
            });
        }

        if (quote.acceptedAt) {
            timeline.push({ event: 'Bid Accepted', date: quote.acceptedAt, status: 'completed' });
        }

        if (quote.payment?.authorizedAt) {
            timeline.push({ event: 'Payment Authorized', date: quote.payment.authorizedAt, status: 'completed' });
        }

        if (quote.startedAt) {
            timeline.push({ event: 'Work Started', date: quote.startedAt, status: 'completed' });
        }

        if (quote.completedAt) {
            timeline.push({ event: 'Work Completed', date: quote.completedAt, status: 'completed' });
        }

        if (quote.payment?.capturedAt) {
            timeline.push({ event: 'Payment Captured', date: quote.payment.capturedAt, status: 'completed' });
        }

        if (quote.cancelledAt) {
            timeline.push({ event: 'Quote Cancelled', date: quote.cancelledAt, status: 'cancelled' });
        }

        // Sort timeline by date
        timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            success: true,
            quote,
            stripePaymentDetails,
            timeline,
        });
    } catch (error) {
        console.error('Error fetching quote details:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Update quote status (Admin override)
 */
export const updateQuoteStatus = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { status, reason } = req.body;
        const adminId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const validStatuses = ['pending', 'bidded', 'accepted', 'in_progress', 'completed', 'rejected', 'cancelled', 'expired'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                message: 'Invalid status',
                validStatuses
            });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const previousStatus = quote.status;

        // Update status
        quote.status = status;

        // Add timestamp based on status
        switch (status) {
            case 'accepted':
                if (!quote.acceptedAt) quote.acceptedAt = new Date();
                break;
            case 'in_progress':
                if (!quote.startedAt) quote.startedAt = new Date();
                break;
            case 'completed':
                if (!quote.completedAt) quote.completedAt = new Date();
                break;
            case 'cancelled':
                quote.cancelledAt = new Date();
                quote.cancelledBy = adminId;
                quote.cancellationReason = reason || 'Cancelled by admin';
                break;
        }

        // Add admin action to a log (you might want a separate model for this)
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'status_update',
            previousStatus,
            newStatus: status,
            reason,
            adminId,
            timestamp: new Date(),
        });

        await quote.save();

        console.log(`📝 Admin ${adminId} updated quote ${quoteId} status: ${previousStatus} → ${status}`);

        res.status(200).json({
            success: true,
            message: 'Quote status updated successfully',
            quote: {
                _id: quote._id,
                previousStatus,
                newStatus: status,
                updatedAt: quote.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error updating quote status:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Cancel quote with refund (Admin action)
 */
export const adminCancelQuote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason, refundPercentage = 100 } = req.body;
        const adminId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.status === 'cancelled') {
            return res.status(400).json({ message: 'Quote is already cancelled' });
        }

        if (quote.status === 'completed') {
            return res.status(400).json({ message: 'Cannot cancel a completed quote' });
        }

        let refundResult = null;

        // Process refund if payment exists
        if (quote.payment?.paymentIntentId && quote.payment.status === 'held') {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(
                    quote.payment.paymentIntentId
                );

                if (paymentIntent.status === 'requires_capture') {
                    // Cancel the uncaptured payment intent (full refund)
                    await stripe.paymentIntents.cancel(quote.payment.paymentIntentId);
                    refundResult = {
                        type: 'cancellation',
                        status: 'success',
                        message: 'Payment authorization cancelled - full refund',
                    };
                } else if (paymentIntent.status === 'succeeded') {
                    // Payment was captured, need to refund
                    const refundAmount = Math.round(
                        quote.payment.totalClientPaysCents * (refundPercentage / 100)
                    );

                    const refund = await stripe.refunds.create({
                        payment_intent: quote.payment.paymentIntentId,
                        amount: refundAmount,
                        reason: 'requested_by_customer',
                        metadata: {
                            quoteId: quoteId,
                            adminId: adminId,
                            reason: reason || 'Admin cancellation',
                        },
                    });

                    refundResult = {
                        type: 'refund',
                        status: refund.status,
                        refundId: refund.id,
                        amount: refundAmount / 100,
                        percentage: refundPercentage,
                    };
                }

                // Update payment status
                quote.payment.status = 'refunded';
                quote.payment.refundedAt = new Date();
                quote.payment.refundAmount = refundResult?.amount || 0;
                quote.payment.refundReason = reason || 'Admin cancellation';
                if (refundResult?.refundId) {
                    quote.payment.refundId = refundResult.refundId;
                }
            } catch (stripeError) {
                console.error('Stripe refund error:', stripeError);
                return res.status(400).json({
                    message: 'Failed to process refund',
                    error: stripeError.message,
                });
            }
        }

        // Update quote status
        const previousStatus = quote.status;
        quote.status = 'cancelled';
        quote.cancelledAt = new Date();
        quote.cancelledBy = adminId;
        quote.cancellationReason = reason || 'Cancelled by admin';

        // Add admin action log
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'cancellation',
            previousStatus,
            reason,
            refundResult,
            adminId,
            timestamp: new Date(),
        });

        await quote.save();

        console.log(`🚫 Admin ${adminId} cancelled quote ${quoteId}`);

        // TODO: Send notifications to client and tasker

        res.status(200).json({
            success: true,
            message: 'Quote cancelled successfully',
            quote: {
                _id: quote._id,
                status: quote.status,
                cancelledAt: quote.cancelledAt,
                cancellationReason: quote.cancellationReason,
            },
            refund: refundResult,
        });
    } catch (error) {
        console.error('Error cancelling quote:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Manually capture payment (Admin action)
 */
export const adminCapturePayment = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason } = req.body;
        const adminId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (!quote.payment?.paymentIntentId) {
            return res.status(400).json({ message: 'No payment to capture' });
        }

        if (quote.payment.status !== 'held') {
            return res.status(400).json({
                message: `Payment cannot be captured. Current status: ${quote.payment.status}`
            });
        }

        try {
            // Capture the payment
            const paymentIntent = await stripe.paymentIntents.capture(
                quote.payment.paymentIntentId
            );

            // Update quote payment status
            quote.payment.status = 'captured';
            quote.payment.capturedAt = new Date();

            // If quote is not completed, mark it
            if (quote.status !== 'completed') {
                quote.status = 'completed';
                quote.completedAt = new Date();
            }

            // Add admin action log
            if (!quote.adminActions) quote.adminActions = [];
            quote.adminActions.push({
                action: 'payment_capture',
                reason: reason || 'Manual capture by admin',
                adminId,
                timestamp: new Date(),
            });

            await quote.save();

            console.log(`💰 Admin ${adminId} captured payment for quote ${quoteId}`);

            res.status(200).json({
                success: true,
                message: 'Payment captured successfully',
                payment: {
                    paymentIntentId: paymentIntent.id,
                    status: 'captured',
                    amount: quote.payment.totalClientPays,
                    taskerPayout: quote.payment.taskerPayout,
                    platformFee: quote.payment.applicationFee,
                    capturedAt: quote.payment.capturedAt,
                },
            });
        } catch (stripeError) {
            console.error('Stripe capture error:', stripeError);
            return res.status(400).json({
                message: 'Failed to capture payment',
                error: stripeError.message,
            });
        }
    } catch (error) {
        console.error('Error capturing payment:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Manually refund payment (Admin action)
 */
export const adminRefundPayment = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason, refundPercentage = 100, refundAmount } = req.body;
        const adminId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (!quote.payment?.paymentIntentId) {
            return res.status(400).json({ message: 'No payment to refund' });
        }

        const validStatusesForRefund = ['captured', 'released', 'held'];
        if (!validStatusesForRefund.includes(quote.payment.status)) {
            return res.status(400).json({
                message: `Payment cannot be refunded. Current status: ${quote.payment.status}`
            });
        }

        try {
            let refundResult;

            if (quote.payment.status === 'held') {
                // Cancel uncaptured payment
                await stripe.paymentIntents.cancel(quote.payment.paymentIntentId);
                refundResult = {
                    type: 'cancellation',
                    status: 'succeeded',
                    amount: quote.payment.totalClientPays,
                };
            } else {
                // Refund captured payment
                let amountToRefund;
                if (refundAmount) {
                    amountToRefund = Math.round(refundAmount * 100);
                } else {
                    amountToRefund = Math.round(
                        quote.payment.totalClientPaysCents * (refundPercentage / 100)
                    );
                }

                const refund = await stripe.refunds.create({
                    payment_intent: quote.payment.paymentIntentId,
                    amount: amountToRefund,
                    reason: 'requested_by_customer',
                    metadata: {
                        quoteId: quoteId,
                        adminId: adminId,
                        reason: reason || 'Admin refund',
                    },
                });

                refundResult = {
                    type: 'refund',
                    status: refund.status,
                    refundId: refund.id,
                    amount: amountToRefund / 100,
                };
            }

            // Update quote
            const isFullRefund = refundPercentage === 100 ||
                (refundAmount && refundAmount >= quote.payment.totalClientPays);

            quote.payment.status = isFullRefund ? 'refunded' : 'partial_refund';
            quote.payment.refundedAt = new Date();
            quote.payment.refundAmount = (quote.payment.refundAmount || 0) + refundResult.amount;
            quote.payment.refundReason = reason || 'Admin refund';
            if (refundResult.refundId) {
                quote.payment.refundId = refundResult.refundId;
            }

            // Add admin action log
            if (!quote.adminActions) quote.adminActions = [];
            quote.adminActions.push({
                action: 'refund',
                amount: refundResult.amount,
                reason: reason || 'Admin refund',
                adminId,
                timestamp: new Date(),
            });

            await quote.save();

            console.log(`💸 Admin ${adminId} refunded $${refundResult.amount} for quote ${quoteId}`);

            res.status(200).json({
                success: true,
                message: 'Refund processed successfully',
                refund: refundResult,
                payment: {
                    status: quote.payment.status,
                    originalAmount: quote.payment.totalClientPays,
                    refundedAmount: quote.payment.refundAmount,
                },
            });
        } catch (stripeError) {
            console.error('Stripe refund error:', stripeError);
            return res.status(400).json({
                message: 'Failed to process refund',
                error: stripeError.message,
            });
        }
    } catch (error) {
        console.error('Error refunding payment:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get revenue report
 */
export const getRevenueReport = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        // Validate dates
        const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const end = endDate ? new Date(endDate) : new Date();

        // Determine grouping format
        let dateFormat;
        switch (groupBy) {
            case 'hour':
                dateFormat = '%Y-%m-%d %H:00';
                break;
            case 'day':
                dateFormat = '%Y-%m-%d';
                break;
            case 'week':
                dateFormat = '%Y-W%V';
                break;
            case 'month':
                dateFormat = '%Y-%m';
                break;
            default:
                dateFormat = '%Y-%m-%d';
        }

        const revenueByPeriod = await RequestQuote.aggregate([
            {
                $match: {
                    'payment.capturedAt': { $gte: start, $lte: end },
                    'payment.status': { $in: ['captured', 'released'] },
                },
            },
            {
                $group: {
                    _id: {
                        $dateToString: { format: dateFormat, date: '$payment.capturedAt' }
                    },
                    transactionCount: { $sum: 1 },
                    totalBidAmount: { $sum: '$payment.bidAmount' },
                    totalClientPaid: { $sum: '$payment.totalClientPays' },
                    totalClientPlatformFee: { $sum: '$payment.clientPlatformFee' },
                    totalReservationFee: { $sum: '$payment.reservationFee' },
                    totalClientTax: { $sum: '$payment.clientTax' },
                    totalTaskerPlatformFee: { $sum: '$payment.taskerPlatformFee' },
                    totalTaskerTax: { $sum: '$payment.taskerTax' },
                    totalTaskerPayout: { $sum: '$payment.taskerPayout' },
                    totalPlatformRevenue: { $sum: '$payment.applicationFee' },
                },
            },
            { $sort: { _id: 1 } },
        ]);

        // Calculate totals
        const totals = revenueByPeriod.reduce((acc, period) => {
            acc.transactionCount += period.transactionCount;
            acc.totalBidAmount += period.totalBidAmount || 0;
            acc.totalClientPaid += period.totalClientPaid || 0;
            acc.totalClientPlatformFee += period.totalClientPlatformFee || 0;
            acc.totalReservationFee += period.totalReservationFee || 0;
            acc.totalClientTax += period.totalClientTax || 0;
            acc.totalTaskerPlatformFee += period.totalTaskerPlatformFee || 0;
            acc.totalTaskerTax += period.totalTaskerTax || 0;
            acc.totalTaskerPayout += period.totalTaskerPayout || 0;
            acc.totalPlatformRevenue += period.totalPlatformRevenue || 0;
            return acc;
        }, {
            transactionCount: 0,
            totalBidAmount: 0,
            totalClientPaid: 0,
            totalClientPlatformFee: 0,
            totalReservationFee: 0,
            totalClientTax: 0,
            totalTaskerPlatformFee: 0,
            totalTaskerTax: 0,
            totalTaskerPayout: 0,
            totalPlatformRevenue: 0,
        });

        // Get refund stats
        const refundStats = await RequestQuote.aggregate([
            {
                $match: {
                    'payment.refundedAt': { $gte: start, $lte: end },
                },
            },
            {
                $group: {
                    _id: null,
                    refundCount: { $sum: 1 },
                    totalRefunded: { $sum: '$payment.refundAmount' },
                },
            },
        ]);

        res.status(200).json({
            success: true,
            report: {
                dateRange: {
                    start,
                    end,
                    groupBy,
                },
                periods: revenueByPeriod,
                totals,
                refunds: refundStats[0] || { refundCount: 0, totalRefunded: 0 },
                feeBreakdown: {
                    clientFees: totals.totalClientPlatformFee + totals.totalReservationFee,
                    taskerFees: totals.totalTaskerPlatformFee,
                    totalPlatformRevenue: totals.totalPlatformRevenue,
                    taxCollected: {
                        client: totals.totalClientTax,
                        tasker: totals.totalTaskerTax,
                    },
                },
            },
        });
    } catch (error) {
        console.error('Error generating revenue report:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Export quotes data (CSV format)
 */
export const exportQuotes = async (req, res) => {
    try {
        const { startDate, endDate, status, format = 'json' } = req.query;

        // Build query
        const query = {};

        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        if (status && status !== 'all') {
            query.status = status;
        }

        const quotes = await RequestQuote.find(query)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .lean();

        if (format === 'csv') {
            // Generate CSV
            const csvHeaders = [
                'Quote ID',
                'Task Title',
                'Status',
                'Client Name',
                'Client Email',
                'Tasker Name',
                'Tasker Email',
                'Bid Amount',
                'Client Pays',
                'Tasker Payout',
                'Platform Fee',
                'Payment Status',
                'Created At',
                'Accepted At',
                'Completed At',
            ];

            const csvRows = quotes.map(quote => [
                quote._id.toString(),
                `"${quote.taskTitle?.replace(/"/g, '""') || ''}"`,
                quote.status,
                `"${quote.client?.firstName || ''} ${quote.client?.lastName || ''}"`,
                quote.client?.email || '',
                `"${quote.tasker?.firstName || ''} ${quote.tasker?.lastName || ''}"`,
                quote.tasker?.email || '',
                quote.acceptedBid?.bidAmount || quote.payment?.bidAmount || '',
                quote.payment?.totalClientPays || '',
                quote.payment?.taskerPayout || '',
                quote.payment?.applicationFee || '',
                quote.payment?.status || '',
                quote.createdAt ? new Date(quote.createdAt).toISOString() : '',
                quote.acceptedAt ? new Date(quote.acceptedAt).toISOString() : '',
                quote.completedAt ? new Date(quote.completedAt).toISOString() : '',
            ]);

            const csv = [csvHeaders.join(','), ...csvRows.map(row => row.join(','))].join('\n');

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=quotes-export-${Date.now()}.csv`);
            return res.send(csv);
        }

        // Default JSON format
        res.status(200).json({
            success: true,
            count: quotes.length,
            quotes,
        });
    } catch (error) {
        console.error('Error exporting quotes:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get quote disputes/issues
 */
export const getQuoteDisputes = async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;

        // Find quotes that might have issues
        const disputedQuotes = await RequestQuote.find({
            $or: [
                // Payment held for too long (more than 7 days)
                {
                    'payment.status': 'held',
                    'payment.authorizedAt': {
                        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    },
                },
                // Cancelled with payment
                {
                    status: 'cancelled',
                    'payment.paymentIntentId': { $exists: true },
                    'payment.status': { $nin: ['refunded', 'cancelled'] },
                },
                // Stuck in accepted status for too long
                {
                    status: 'accepted',
                    acceptedAt: {
                        $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    },
                },
            ],
        })
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email')
            .sort({ createdAt: -1 })
            .skip((Number(page) - 1) * Number(limit))
            .limit(Number(limit))
            .lean();

        const totalCount = await RequestQuote.countDocuments({
            $or: [
                {
                    'payment.status': 'held',
                    'payment.authorizedAt': {
                        $lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    },
                },
                {
                    status: 'cancelled',
                    'payment.paymentIntentId': { $exists: true },
                    'payment.status': { $nin: ['refunded', 'cancelled'] },
                },
                {
                    status: 'accepted',
                    acceptedAt: {
                        $lt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
                    },
                },
            ],
        });

        // Add issue type to each quote
        const quotesWithIssues = disputedQuotes.map(quote => {
            let issueType = 'unknown';
            let issueDescription = '';

            if (quote.payment?.status === 'held' &&
                new Date(quote.payment.authorizedAt) < new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)) {
                issueType = 'payment_held_too_long';
                issueDescription = 'Payment has been held for more than 7 days';
            } else if (quote.status === 'cancelled' &&
                quote.payment?.paymentIntentId &&
                !['refunded', 'cancelled'].includes(quote.payment.status)) {
                issueType = 'cancelled_with_payment';
                issueDescription = 'Quote cancelled but payment not refunded';
            } else if (quote.status === 'accepted' &&
                new Date(quote.acceptedAt) < new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)) {
                issueType = 'stuck_in_accepted';
                issueDescription = 'Quote stuck in accepted status for over 14 days';
            }

            return {
                ...quote,
                issue: {
                    type: issueType,
                    description: issueDescription,
                },
            };
        });

        res.status(200).json({
            success: true,
            disputes: quotesWithIssues,
            pagination: {
                currentPage: Number(page),
                totalPages: Math.ceil(totalCount / Number(limit)),
                totalCount,
            },
        });
    } catch (error) {
        console.error('Error fetching disputes:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Bulk update quote statuses
 */
export const bulkUpdateQuotes = async (req, res) => {
    try {
        const { quoteIds, action, reason } = req.body;
        const adminId = req.user.id;

        if (!Array.isArray(quoteIds) || quoteIds.length === 0) {
            return res.status(400).json({ message: 'Quote IDs array is required' });
        }

        const validActions = ['cancel', 'expire', 'mark_completed'];
        if (!validActions.includes(action)) {
            return res.status(400).json({
                message: 'Invalid action',
                validActions
            });
        }

        const results = {
            success: [],
            failed: [],
        };

        for (const quoteId of quoteIds) {
            try {
                if (!mongoose.Types.ObjectId.isValid(quoteId)) {
                    results.failed.push({ quoteId, error: 'Invalid ID format' });
                    continue;
                }

                const quote = await RequestQuote.findById(quoteId);

                if (!quote) {
                    results.failed.push({ quoteId, error: 'Quote not found' });
                    continue;
                }

                switch (action) {
                    case 'cancel':
                        if (quote.status === 'completed') {
                            results.failed.push({ quoteId, error: 'Cannot cancel completed quote' });
                            continue;
                        }
                        quote.status = 'cancelled';
                        quote.cancelledAt = new Date();
                        quote.cancelledBy = adminId;
                        quote.cancellationReason = reason || 'Bulk cancellation by admin';
                        break;

                    case 'expire':
                        if (['completed', 'accepted', 'in_progress'].includes(quote.status)) {
                            results.failed.push({ quoteId, error: 'Cannot expire active quote' });
                            continue;
                        }
                        quote.status = 'expired';
                        quote.expiresAt = new Date();
                        break;

                    case 'mark_completed':
                        if (!['accepted', 'in_progress'].includes(quote.status)) {
                            results.failed.push({ quoteId, error: 'Quote must be accepted or in progress' });
                            continue;
                        }
                        quote.status = 'completed';
                        quote.completedAt = new Date();
                        break;
                }

                // Add admin action log
                if (!quote.adminActions) quote.adminActions = [];
                quote.adminActions.push({
                    action: `bulk_${action}`,
                    reason,
                    adminId,
                    timestamp: new Date(),
                });

                await quote.save();
                results.success.push(quoteId);

            } catch (err) {
                results.failed.push({ quoteId, error: err.message });
            }
        }

        console.log(`📋 Admin ${adminId} performed bulk ${action}: ${results.success.length} success, ${results.failed.length} failed`);

        res.status(200).json({
            success: true,
            message: `Bulk ${action} completed`,
            results,
        });
    } catch (error) {
        console.error('Error in bulk update:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Get admin action history for a quote
 */
export const getQuoteAdminHistory = async (req, res) => {
    try {
        const { quoteId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .select('adminActions')
            .lean();

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        // Populate admin user info
        const history = quote.adminActions || [];

        // Get unique admin IDs
        const adminIds = [...new Set(history.map(h => h.adminId).filter(Boolean))];

        // Fetch admin info
        const admins = await User.find({ _id: { $in: adminIds } })
            .select('firstName lastName email')
            .lean();

        const adminMap = {};
        admins.forEach(admin => {
            adminMap[admin._id.toString()] = admin;
        });

        // Attach admin info to history
        const enrichedHistory = history.map(entry => ({
            ...entry,
            admin: entry.adminId ? adminMap[entry.adminId.toString()] : null,
        }));

        res.status(200).json({
            success: true,
            quoteId,
            history: enrichedHistory,
        });
    } catch (error) {
        console.error('Error fetching admin history:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};


// Add these imports at the top if not already present

/**
 * Delete a quote (Admin action)
 */
export const deleteQuote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        // Check if there's an active payment that needs handling
        if (quote.payment?.paymentIntentId &&
            ['held', 'authorized'].includes(quote.payment.status)) {
            try {
                await stripe.paymentIntents.cancel(quote.payment.paymentIntentId);
            } catch (stripeError) {
                console.error('Error canceling payment intent:', stripeError.message);
            }
        }

        await RequestQuote.findByIdAndDelete(quoteId);

        console.log(`🗑️ Admin ${adminId} deleted quote ${quoteId}`);

        res.status(200).json({
            success: true,
            message: 'Quote deleted successfully',
        });
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Send notification to client/tasker (Admin action)
 */
export const sendNotification = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { message, recipients } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        if (!message || !recipients || recipients.length === 0) {
            return res.status(400).json({ message: 'Message and recipients are required' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('client', 'firstName lastName email')
            .populate('tasker', 'firstName lastName email');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const sentTo = [];
        const errors = [];

        // Send to client
        if (recipients.includes('client') && quote.client?.email) {
            try {
                // If you have an email service, use it here
                // await sendEmail({
                //     to: quote.client.email,
                //     subject: `Update regarding your quote: ${quote.taskTitle}`,
                //     text: message,
                // });
                sentTo.push({
                    role: 'client',
                    email: quote.client.email,
                    name: `${quote.client.firstName} ${quote.client.lastName}`,
                });
                console.log(`📧 Notification sent to client: ${quote.client.email}`);
            } catch (err) {
                errors.push({ role: 'client', error: err.message });
            }
        }

        // Send to tasker
        if (recipients.includes('tasker') && quote.tasker?.email) {
            try {
                // await sendEmail({
                //     to: quote.tasker.email,
                //     subject: `Update regarding quote: ${quote.taskTitle}`,
                //     text: message,
                // });
                sentTo.push({
                    role: 'tasker',
                    email: quote.tasker.email,
                    name: `${quote.tasker.firstName} ${quote.tasker.lastName}`,
                });
                console.log(`📧 Notification sent to tasker: ${quote.tasker.email}`);
            } catch (err) {
                errors.push({ role: 'tasker', error: err.message });
            }
        }

        // Log admin action
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'note_added',
            reason: `Notification sent: ${message.substring(0, 100)}...`,
            adminId,
            timestamp: new Date(),
            metadata: { recipients: sentTo.map(s => s.role) },
        });
        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Notifications sent',
            sentTo,
            errors: errors.length > 0 ? errors : undefined,
        });
    } catch (error) {
        console.error('Error sending notification:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Force complete a quote (Admin action)
 */
export const forceCompleteQuote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.status === 'completed') {
            return res.status(400).json({ message: 'Quote is already completed' });
        }

        if (quote.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot complete a cancelled quote' });
        }

        const previousStatus = quote.status;
        quote.status = 'completed';
        quote.completedAt = new Date();

        // Capture payment if held
        if (quote.payment?.paymentIntentId && quote.payment.status === 'held') {
            try {
                await stripe.paymentIntents.capture(quote.payment.paymentIntentId);
                quote.payment.status = 'captured';
                quote.payment.capturedAt = new Date();
            } catch (stripeError) {
                console.error('Error capturing payment:', stripeError.message);
            }
        }

        // Log admin action
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'status_update',
            previousStatus,
            newStatus: 'completed',
            reason: reason || 'Force completed by admin',
            adminId,
            timestamp: new Date(),
        });

        await quote.save();

        console.log(`✅ Admin ${adminId} force completed quote ${quoteId}`);

        res.status(200).json({
            success: true,
            message: 'Quote marked as completed',
            quote: {
                _id: quote._id,
                status: quote.status,
                completedAt: quote.completedAt,
            },
        });
    } catch (error) {
        console.error('Error force completing quote:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Flag a quote for review (Admin action)
 */
export const flagQuote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        if (!reason) {
            return res.status(400).json({ message: 'Reason is required' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        // Add to admin notes
        if (!quote.adminNotes) quote.adminNotes = [];
        quote.adminNotes.push({
            note: `🚩 FLAGGED: ${reason}`,
            adminId,
            createdAt: new Date(),
        });

        // Log admin action
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'note_added',
            reason: `Quote flagged: ${reason}`,
            adminId,
            timestamp: new Date(),
        });

        // You could also add a 'flagged' field to the schema
        // quote.isFlagged = true;
        // quote.flagReason = reason;

        await quote.save();

        console.log(`🚩 Admin ${adminId} flagged quote ${quoteId}`);

        res.status(200).json({
            success: true,
            message: 'Quote flagged for review',
        });
    } catch (error) {
        console.error('Error flagging quote:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Reassign/remove tasker from quote (Admin action)
 */
export const reassignQuote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { reason } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.status === 'completed') {
            return res.status(400).json({ message: 'Cannot reassign a completed quote' });
        }

        if (quote.status === 'cancelled') {
            return res.status(400).json({ message: 'Cannot reassign a cancelled quote' });
        }

        // Cancel held payment if exists
        if (quote.payment?.paymentIntentId && quote.payment.status === 'held') {
            try {
                await stripe.paymentIntents.cancel(quote.payment.paymentIntentId);
            } catch (stripeError) {
                console.error('Error canceling payment:', stripeError.message);
            }
        }

        const previousStatus = quote.status;
        const previousTasker = quote.tasker;

        // Reset quote to pending/bidded state
        quote.status = quote.bids?.length > 0 ? 'bidded' : 'pending';
        quote.acceptedBid = undefined;
        quote.acceptedAt = undefined;
        quote.startedAt = undefined;
        quote.payment = {
            status: 'pending',
        };

        // Reset all bid statuses except withdrawn
        if (quote.bids) {
            quote.bids.forEach(bid => {
                if (bid.status === 'accepted') {
                    bid.status = 'pending';
                }
            });
        }

        // Log admin action
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'status_update',
            previousStatus,
            newStatus: quote.status,
            reason: reason || 'Tasker removed and quote reopened by admin',
            adminId,
            timestamp: new Date(),
            metadata: { previousTasker: previousTasker?.toString() },
        });

        await quote.save();

        console.log(`🔄 Admin ${adminId} reassigned quote ${quoteId}`);

        res.status(200).json({
            success: true,
            message: 'Tasker removed and quote reopened for bidding',
            quote: {
                _id: quote._id,
                status: quote.status,
            },
        });
    } catch (error) {
        console.error('Error reassigning quote:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Extend quote deadline (Admin action)
 */
export const extendDeadline = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { days } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        if (!days || isNaN(parseInt(days)) || parseInt(days) < 1) {
            return res.status(400).json({ message: 'Valid number of days is required' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        const currentExpiry = quote.expiresAt || new Date();
        const newExpiry = new Date(currentExpiry);
        newExpiry.setDate(newExpiry.getDate() + parseInt(days));

        quote.expiresAt = newExpiry;

        // If quote was expired, reopen it
        if (quote.status === 'expired') {
            quote.status = quote.bids?.length > 0 ? 'bidded' : 'pending';
        }

        // Log admin action
        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'note_added',
            reason: `Deadline extended by ${days} days to ${newExpiry.toISOString()}`,
            adminId,
            timestamp: new Date(),
        });

        await quote.save();

        console.log(`⏰ Admin ${adminId} extended deadline for quote ${quoteId} by ${days} days`);

        res.status(200).json({
            success: true,
            message: `Deadline extended by ${days} days`,
            newExpiry,
        });
    } catch (error) {
        console.error('Error extending deadline:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Add admin note to quote
 */
export const addAdminNote = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { note } = req.body;
        const adminId = req.user?.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        if (!note) {
            return res.status(400).json({ message: 'Note is required' });
        }

        const quote = await RequestQuote.findById(quoteId);

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (!quote.adminNotes) quote.adminNotes = [];
        quote.adminNotes.push({
            note,
            adminId,
            createdAt: new Date(),
        });

        if (!quote.adminActions) quote.adminActions = [];
        quote.adminActions.push({
            action: 'note_added',
            reason: note.substring(0, 100),
            adminId,
            timestamp: new Date(),
        });

        await quote.save();

        res.status(200).json({
            success: true,
            message: 'Note added successfully',
        });
    } catch (error) {
        console.error('Error adding note:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};