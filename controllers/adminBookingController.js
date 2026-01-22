// controllers/admin/adminBookingController.js
import mongoose from "mongoose";
import User from '../models/user.js';
import { createNotification } from "./notificationHelper.js";
import { calculateBookingFees } from "./taskerController.js";
import BookingTasker from "../models/bookingTasker.js";
import Stripe from "stripe";


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);


// ==================== GET ALL BOOKINGS (with filters, pagination, sorting) ====================
export const getAllBookings = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            status,
            paymentStatus,
            taskerId,
            clientId,
            startDate,
            endDate,
            minAmount,
            maxAmount,
            search,
            sortBy = 'createdAt',
            sortOrder = 'desc',
            dateRange, // 'today', 'week', 'month', 'year'
        } = req.query;

        // Build filter object
        const filter = {};

        // Status filter
        if (status) {
            if (status.includes(',')) {
                filter.status = { $in: status.split(',') };
            } else {
                filter.status = status;
            }
        }

        // Payment status filter
        if (paymentStatus) {
            filter['payment.status'] = paymentStatus;
        }

        // User filters
        if (taskerId && mongoose.Types.ObjectId.isValid(taskerId)) {
            filter.tasker = taskerId;
        }
        if (clientId && mongoose.Types.ObjectId.isValid(clientId)) {
            filter.client = clientId;
        }

        // Date range filter
        if (startDate || endDate) {
            filter.date = {};
            if (startDate) filter.date.$gte = new Date(startDate);
            if (endDate) filter.date.$lte = new Date(endDate);
        }

        // Preset date ranges
        if (dateRange) {
            const now = new Date();
            filter.date = filter.date || {};

            switch (dateRange) {
                case 'today':
                    filter.date.$gte = new Date(now.setHours(0, 0, 0, 0));
                    filter.date.$lte = new Date(now.setHours(23, 59, 59, 999));
                    break;
                case 'week':
                    const weekStart = new Date(now);
                    weekStart.setDate(now.getDate() - now.getDay());
                    weekStart.setHours(0, 0, 0, 0);
                    filter.date.$gte = weekStart;
                    break;
                case 'month':
                    filter.date.$gte = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    filter.date.$gte = new Date(now.getFullYear(), 0, 1);
                    break;
            }
        }

        // Amount filter
        if (minAmount || maxAmount) {
            filter['payment.totalClientPays'] = {};
            if (minAmount) filter['payment.totalClientPays'].$gte = parseFloat(minAmount);
            if (maxAmount) filter['payment.totalClientPays'].$lte = parseFloat(maxAmount);
        }

        // Search filter (search in service title, client/tasker names)
        if (search) {
            const searchRegex = new RegExp(search, 'i');

            // Find users matching search
            const matchingUsers = await User.find({
                $or: [
                    { firstName: searchRegex },
                    { lastName: searchRegex },
                    { email: searchRegex }
                ]
            }).select('_id');

            const userIds = matchingUsers.map(u => u._id);

            filter.$or = [
                { 'service.title': searchRegex },
                { 'service.description': searchRegex },
                { paymentIntentId: searchRegex },
                { tasker: { $in: userIds } },
                { client: { $in: userIds } }
            ];
        }

        // Build sort object
        const sort = {};
        sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

        // Calculate pagination
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Execute query
        const [bookings, totalCount] = await Promise.all([
            BookingTasker.find(filter)
                .populate('tasker', 'firstName lastName email phone profilePicture rating')
                .populate('client', 'firstName lastName email phone profilePicture')
                .sort(sort)
                .skip(skip)
                .limit(parseInt(limit))
                .lean(),
            BookingTasker.countDocuments(filter)
        ]);

        // Calculate aggregated stats for the filtered results
        const stats = await BookingTasker.aggregate([
            { $match: filter },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$payment.totalClientPays' },
                    platformFees: { $sum: '$payment.applicationFee' },
                    taskerPayouts: { $sum: '$payment.taskerPayout' },
                    avgBookingValue: { $avg: '$payment.totalClientPays' },
                    count: { $sum: 1 }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                bookings,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(totalCount / parseInt(limit)),
                    totalItems: totalCount,
                    itemsPerPage: parseInt(limit),
                    hasNextPage: skip + bookings.length < totalCount,
                    hasPrevPage: parseInt(page) > 1
                },
                stats: stats[0] || {
                    totalRevenue: 0,
                    platformFees: 0,
                    taskerPayouts: 0,
                    avgBookingValue: 0,
                    count: 0
                },
                filters: {
                    status,
                    paymentStatus,
                    taskerId,
                    clientId,
                    startDate,
                    endDate,
                    dateRange,
                    search
                }
            }
        });

    } catch (error) {
        console.error('❌ Admin getAllBookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== GET SINGLE BOOKING DETAILS ====================
export const getBookingDetails = async (req, res) => {
    try {
        const { bookingId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });
        }

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email phone profilePicture rating reviewCount stripeConnectId currentRole address')
            .populate('client', 'firstName lastName email phone profilePicture stripeCustomerId currentRole address')
            .populate('cancelledBy', 'firstName lastName email')
            .populate('refund.requestedBy', 'firstName lastName email')
            .populate('refund.processedBy', 'firstName lastName email')
            .lean();

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Get Stripe PaymentIntent details if exists
        let stripeDetails = null;
        if (booking.payment?.paymentIntentId || booking.paymentIntentId) {
            try {
                const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
                    expand: ['charges', 'payment_method', 'latest_charge.balance_transaction']
                });

                stripeDetails = {
                    id: paymentIntent.id,
                    status: paymentIntent.status,
                    amount: paymentIntent.amount,
                    amountReceived: paymentIntent.amount_received,
                    currency: paymentIntent.currency,
                    created: new Date(paymentIntent.created * 1000),
                    paymentMethod: paymentIntent.payment_method_types,
                    metadata: paymentIntent.metadata,
                    charges: paymentIntent.charges?.data?.map(charge => ({
                        id: charge.id,
                        amount: charge.amount,
                        status: charge.status,
                        refunded: charge.refunded,
                        disputed: charge.disputed,
                        created: new Date(charge.created * 1000)
                    })),
                    applicationFeeAmount: paymentIntent.application_fee_amount,
                    transferData: paymentIntent.transfer_data,
                };
            } catch (stripeError) {
                console.error('Could not fetch Stripe details:', stripeError.message);
                stripeDetails = { error: stripeError.message };
            }
        }

        // Get related bookings (same client or tasker)
        const relatedBookings = await BookingTasker.find({
            $and: [
                { _id: { $ne: booking._id } },
                {
                    $or: [
                        { client: booking.client._id },
                        { tasker: booking.tasker._id }
                    ]
                }
            ]
        })
            .select('service.title date status payment.totalClientPays')
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        // Calculate timeline
        const timeline = [];
        if (booking.createdAt) {
            timeline.push({ event: 'Booking Created', date: booking.createdAt, type: 'info' });
        }
        if (booking.confirmedAt) {
            timeline.push({ event: 'Booking Confirmed', date: booking.confirmedAt, type: 'success' });
        }
        if (booking.payment?.authorizedAt) {
            timeline.push({ event: 'Payment Authorized', date: booking.payment.authorizedAt, type: 'info' });
        }
        if (booking.startedAt) {
            timeline.push({ event: 'Work Started', date: booking.startedAt, type: 'info' });
        }
        if (booking.completedAt) {
            timeline.push({ event: 'Booking Completed', date: booking.completedAt, type: 'success' });
        }
        if (booking.payment?.capturedAt) {
            timeline.push({ event: 'Payment Captured', date: booking.payment.capturedAt, type: 'success' });
        }
        if (booking.cancelledAt) {
            timeline.push({ event: 'Booking Cancelled', date: booking.cancelledAt, type: 'error' });
        }
        if (booking.payment?.refundedAt) {
            timeline.push({ event: 'Payment Refunded', date: booking.payment.refundedAt, type: 'warning' });
        }

        // Sort timeline by date
        timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

        res.status(200).json({
            success: true,
            data: {
                booking,
                stripeDetails,
                relatedBookings,
                timeline,
                feeBreakdown: {
                    client: {
                        serviceAmount: booking.payment?.serviceAmount || booking.totalAmount,
                        platformFee: booking.payment?.clientPlatformFee || 0,
                        platformFeePercent: '10%',
                        reservationFee: booking.payment?.reservationFee || 0,
                        tax: booking.payment?.clientTax || 0,
                        taxPercent: '13%',
                        total: booking.payment?.totalClientPays || booking.totalAmount
                    },
                    tasker: {
                        serviceAmount: booking.payment?.serviceAmount || booking.totalAmount,
                        platformFee: booking.payment?.taskerPlatformFee || 0,
                        platformFeePercent: '12%',
                        tax: booking.payment?.taskerTax || 0,
                        taxPercent: '13%',
                        payout: booking.payment?.taskerPayout || 0
                    },
                    platform: {
                        totalFees: booking.payment?.applicationFee || 0
                    }
                }
            }
        });

    } catch (error) {
        console.error('❌ Admin getBookingDetails error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking details',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== UPDATE BOOKING ====================
export const updateBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const adminId = req.user.id;
        const updates = req.body;

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });
        }

        const booking = await BookingTasker.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Fields that can be updated by admin
        const allowedUpdates = [
            'service.title',
            'service.description',
            'service.hourlyRate',
            'service.estimatedDuration',
            'date',
            'duration',
            'location.address',
            'location.city',
            'location.postalCode',
            'location.notes',
            'clientNotes',
            'taskerNotes',
            'adminNotes'
        ];

        // Track changes for audit log
        const changes = [];

        // Apply updates
        for (const [key, value] of Object.entries(updates)) {
            if (allowedUpdates.includes(key)) {
                const oldValue = getNestedValue(booking, key);
                setNestedValue(booking, key, value);
                changes.push({
                    field: key,
                    oldValue,
                    newValue: value
                });
            }
        }

        // If hourlyRate changed, recalculate fees
        if (updates['service.hourlyRate'] && updates['service.hourlyRate'] !== booking.totalAmount) {
            const newServiceAmount = Math.round(updates['service.hourlyRate'] * 100);
            const fees = calculateBookingFees(newServiceAmount);

            booking.totalAmount = updates['service.hourlyRate'];
            booking.payment.serviceAmount = newServiceAmount / 100;
            booking.payment.serviceAmountCents = newServiceAmount;
            booking.payment.clientPlatformFee = fees.clientPlatformFee / 100;
            booking.payment.clientPlatformFeeCents = fees.clientPlatformFee;
            booking.payment.reservationFee = fees.reservationFee / 100;
            booking.payment.reservationFeeCents = fees.reservationFee;
            booking.payment.clientTax = fees.clientTax / 100;
            booking.payment.clientTaxCents = fees.clientTax;
            booking.payment.totalClientPays = fees.totalClientPays / 100;
            booking.payment.totalClientPaysCents = fees.totalClientPays;
            booking.payment.taskerPlatformFee = fees.taskerPlatformFee / 100;
            booking.payment.taskerPlatformFeeCents = fees.taskerPlatformFee;
            booking.payment.taskerTax = fees.taskerTax / 100;
            booking.payment.taskerTaxCents = fees.taskerTax;
            booking.payment.taskerPayout = fees.taskerPayout / 100;
            booking.payment.taskerPayoutCents = fees.taskerPayout;
            booking.payment.applicationFee = fees.applicationFee / 100;
            booking.payment.applicationFeeCents = fees.applicationFee;

            changes.push({
                field: 'payment',
                note: 'Fees recalculated due to hourlyRate change'
            });
        }

        // Add audit entry
        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'update',
            performedBy: adminId,
            performedAt: new Date(),
            changes,
            ip: req.ip,
            userAgent: req.get('User-Agent')
        });

        await booking.save();

        const updatedBooking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        res.status(200).json({
            success: true,
            message: 'Booking updated successfully',
            data: {
                booking: updatedBooking,
                changes
            }
        });

    } catch (error) {
        console.error('❌ Admin updateBooking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== UPDATE BOOKING STATUS ====================
export const updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status, reason, notifyUsers = true } = req.body;
        const adminId = req.user.id;

        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const oldStatus = booking.status;

        // Update status
        booking.status = status;

        // Set relevant timestamps
        switch (status) {
            case 'confirmed':
                booking.confirmedAt = new Date();
                break;
            case 'in_progress':
                booking.startedAt = new Date();
                break;
            case 'completed':
                booking.completedAt = new Date();
                break;
            case 'cancelled':
                booking.cancelledAt = new Date();
                booking.cancelledBy = adminId;
                booking.cancellationReason = reason || 'Cancelled by admin';
                break;
            case 'no_show':
                booking.cancelledAt = new Date();
                booking.cancellationReason = reason || 'No show';
                break;
        }

        // Add audit entry
        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'status_change',
            performedBy: adminId,
            performedAt: new Date(),
            changes: [{
                field: 'status',
                oldValue: oldStatus,
                newValue: status
            }],
            reason
        });

        await booking.save();

        // Send notifications if requested
        if (notifyUsers) {
            const statusMessages = {
                confirmed: 'Your booking has been confirmed by admin.',
                in_progress: 'Your booking is now in progress.',
                completed: 'Your booking has been marked as completed.',
                cancelled: `Your booking has been cancelled. Reason: ${reason || 'N/A'}`,
                no_show: 'The booking was marked as a no-show.'
            };

            try {
                // Notify client
                await createNotification(
                    booking.client._id,
                    `Booking Status Update`,
                    statusMessages[status],
                    'booking-status-update',
                    booking._id
                );

                // Notify tasker
                await createNotification(
                    booking.tasker._id,
                    `Booking Status Update`,
                    statusMessages[status],
                    'booking-status-update',
                    booking._id
                );
            } catch (notifError) {
                console.error('Notification error:', notifError);
            }
        }

        res.status(200).json({
            success: true,
            message: `Booking status updated to ${status}`,
            data: {
                booking,
                oldStatus,
                newStatus: status
            }
        });

    } catch (error) {
        console.error('❌ Admin updateBookingStatus error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update booking status',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== DELETE BOOKING ====================
export const deleteBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { hardDelete = false, reason } = req.body;

        // Make adminId optional - check if user exists first
        const userId = req.user?.id || req.user?._id || null;

        console.log('Delete request:', { bookingId, hardDelete, reason, userId });

        if (!bookingId) {
            return res.status(400).json({
                success: false,
                message: 'Booking ID is required'
            });
        }

        if (!mongoose.Types.ObjectId.isValid(bookingId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid booking ID'
            });
        }

        const booking = await BookingTasker.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        // Check if there's an active payment that needs to be handled
        if (booking.payment?.paymentIntentId &&
            ['held', 'authorized'].includes(booking.payment?.status)) {
            return res.status(400).json({
                success: false,
                message: 'Cannot delete booking with held payment. Cancel or refund the payment first.',
                code: 'PAYMENT_HELD'
            });
        }

        if (hardDelete) {
            // Permanently delete the booking
            await BookingTasker.findByIdAndDelete(bookingId);

            return res.status(200).json({
                success: true,
                message: 'Booking permanently deleted',
                data: { bookingId, hardDelete: true }
            });
        } else {
            // Soft delete - mark as deleted but keep record
            booking.status = 'cancelled';
            booking.cancelledAt = new Date();
            booking.cancellationReason = reason || 'Deleted by admin';
            booking.isDeleted = true;
            booking.deletedAt = new Date();

            // Only set these if we have a user
            if (userId) {
                booking.cancelledBy = userId;
                booking.deletedBy = userId;
            }

            // Initialize auditLog if it doesn't exist
            if (!booking.auditLog) {
                booking.auditLog = [];
            }

            booking.auditLog.push({
                action: 'soft_delete',
                performedBy: userId || 'system',
                performedAt: new Date(),
                reason: reason || 'Deleted'
            });

            await booking.save();

            return res.status(200).json({
                success: true,
                message: 'Booking soft deleted (marked as cancelled)',
                data: { bookingId, hardDelete: false }
            });
        }

    } catch (error) {
        console.error('❌ Admin deleteBooking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== BULK DELETE BOOKINGS ====================
export const bulkDeleteBookings = async (req, res) => {
    try {
        const { bookingIds, hardDelete = false, reason } = req.body;
        const adminId = req.user.id;

        if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of booking IDs'
            });
        }

        // Validate all IDs
        const invalidIds = bookingIds.filter(id => !mongoose.Types.ObjectId.isValid(id));
        if (invalidIds.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some booking IDs are invalid',
                invalidIds
            });
        }

        // Check for bookings with held payments
        const bookingsWithPayments = await BookingTasker.find({
            _id: { $in: bookingIds },
            'payment.status': { $in: ['held', 'authorized'] }
        }).select('_id');

        if (bookingsWithPayments.length > 0) {
            return res.status(400).json({
                success: false,
                message: 'Some bookings have held payments and cannot be deleted',
                bookingsWithPayments: bookingsWithPayments.map(b => b._id)
            });
        }

        let result;
        if (hardDelete) {
            result = await BookingTasker.deleteMany({
                _id: { $in: bookingIds }
            });
        } else {
            result = await BookingTasker.updateMany(
                { _id: { $in: bookingIds } },
                {
                    $set: {
                        status: 'cancelled',
                        cancelledAt: new Date(),
                        cancelledBy: adminId,
                        cancellationReason: reason || 'Bulk deleted by admin',
                        isDeleted: true,
                        deletedAt: new Date(),
                        deletedBy: adminId
                    },
                    $push: {
                        auditLog: {
                            action: 'bulk_soft_delete',
                            performedBy: adminId,
                            performedAt: new Date(),
                            reason
                        }
                    }
                }
            );
        }

        res.status(200).json({
            success: true,
            message: `${result.deletedCount || result.modifiedCount} bookings deleted`,
            data: {
                requestedCount: bookingIds.length,
                affectedCount: result.deletedCount || result.modifiedCount,
                hardDelete
            }
        });

    } catch (error) {
        console.error('❌ Admin bulkDeleteBookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== CANCEL BOOKING (with refund) ====================
export const cancelBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { reason, refundType = 'full', customRefundAmount, notifyUsers = true } = req.body;
        const adminId = req.user.id;

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.status === 'cancelled') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already cancelled'
            });
        }

        let refundResult = null;
        const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;

        // Handle payment refund/cancellation
        if (paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

                if (paymentIntent.status === 'requires_capture') {
                    // Cancel the hold
                    await stripe.paymentIntents.cancel(paymentIntentId);
                    refundResult = { type: 'cancelled', message: 'Payment hold cancelled' };

                    booking.payment.status = 'cancelled';
                    booking.payment.cancelledAt = new Date();

                } else if (['succeeded', 'captured'].includes(paymentIntent.status) ||
                    paymentIntent.amount_received > 0) {
                    // Issue refund
                    let refundAmount;

                    if (refundType === 'full') {
                        refundAmount = paymentIntent.amount_received;
                    } else if (refundType === 'partial' && customRefundAmount) {
                        refundAmount = Math.round(customRefundAmount * 100);
                    } else {
                        // Calculate based on cancellation policy
                        const refundCalc = booking.calculateRefundAmount();
                        refundAmount = refundCalc.clientRefund;
                    }

                    const refund = await stripe.refunds.create({
                        payment_intent: paymentIntentId,
                        amount: refundAmount,
                        reason: 'requested_by_customer',
                        metadata: {
                            bookingId: booking._id.toString(),
                            cancelledBy: 'admin',
                            adminId: adminId.toString(),
                            reason: reason || 'Cancelled by admin'
                        }
                    });

                    refundResult = {
                        type: 'refunded',
                        refundId: refund.id,
                        amount: refundAmount / 100,
                        status: refund.status
                    };

                    booking.payment.status = refundAmount === paymentIntent.amount_received ? 'refunded' : 'partial_refund';
                    booking.payment.refundedAt = new Date();
                    booking.payment.refundAmount = refundAmount / 100;
                    booking.payment.refundAmountCents = refundAmount;
                    booking.payment.refundId = refund.id;
                    booking.payment.refundReason = reason;

                    // Update refund subdocument
                    booking.refund = {
                        status: 'processed',
                        amount: refundAmount / 100,
                        amountCents: refundAmount,
                        reason: reason || 'Cancelled by admin',
                        processedAt: new Date(),
                        processedBy: adminId,
                        refundId: refund.id
                    };
                }
            } catch (stripeError) {
                console.error('Stripe refund error:', stripeError);
                return res.status(400).json({
                    success: false,
                    message: 'Failed to process refund: ' + stripeError.message,
                    code: 'REFUND_FAILED'
                });
            }
        }

        // Update booking status
        booking.status = 'cancelled';
        booking.cancelledAt = new Date();
        booking.cancelledBy = adminId;
        booking.cancellationReason = reason || 'Cancelled by admin';

        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'cancel',
            performedBy: adminId,
            performedAt: new Date(),
            reason,
            refundResult
        });

        await booking.save();

        // Send notifications
        if (notifyUsers) {
            try {
                await createNotification(
                    booking.client._id,
                    'Booking Cancelled',
                    `Your booking for "${booking.service.title}" has been cancelled. ${refundResult ? `Refund of $${refundResult.amount} has been processed.` : ''}`,
                    'booking-cancelled',
                    booking._id
                );

                await createNotification(
                    booking.tasker._id,
                    'Booking Cancelled',
                    `The booking for "${booking.service.title}" with ${booking.client.firstName} has been cancelled.`,
                    'booking-cancelled',
                    booking._id
                );
            } catch (e) {
                console.error('Notification error:', e);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Booking cancelled successfully',
            data: {
                booking,
                refund: refundResult
            }
        });

    } catch (error) {
        console.error('❌ Admin cancelBooking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to cancel booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== CAPTURE PAYMENT ====================
export const capturePayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { amount } = req.body; // Optional: for partial capture
        const adminId = req.user.id;

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'No payment intent found for this booking'
            });
        }

        // Check current payment status
        if (!['held', 'authorized'].includes(booking.payment?.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot capture payment. Current status: ${booking.payment?.status}`
            });
        }

        try {
            const captureParams = {};
            if (amount) {
                captureParams.amount_to_capture = Math.round(amount * 100);
            }

            const paymentIntent = await stripe.paymentIntents.capture(
                paymentIntentId,
                captureParams
            );

            // Update booking payment status
            booking.payment.status = 'captured';
            booking.payment.capturedAt = new Date();
            booking.paymentDetails.amountCaptured = paymentIntent.amount_received / 100;
            booking.stripeStatus = 'succeeded';

            if (!booking.auditLog) booking.auditLog = [];
            booking.auditLog.push({
                action: 'capture_payment',
                performedBy: adminId,
                performedAt: new Date(),
                amount: paymentIntent.amount_received / 100
            });

            await booking.save();

            // Send notifications
            try {
                await createNotification(
                    booking.tasker._id,
                    '💰 Payment Received!',
                    `Payment of $${(booking.payment.taskerPayout || 0).toFixed(2)} for "${booking.service.title}" has been released to your account.`,
                    'payment-captured',
                    booking._id
                );
            } catch (e) {
                console.error('Notification error:', e);
            }

            res.status(200).json({
                success: true,
                message: 'Payment captured successfully',
                data: {
                    booking,
                    paymentIntent: {
                        id: paymentIntent.id,
                        status: paymentIntent.status,
                        amountCaptured: paymentIntent.amount_received / 100
                    }
                }
            });

        } catch (stripeError) {
            console.error('Stripe capture error:', stripeError);
            return res.status(400).json({
                success: false,
                message: 'Failed to capture payment: ' + stripeError.message,
                code: 'CAPTURE_FAILED'
            });
        }

    } catch (error) {
        console.error('❌ Admin capturePayment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to capture payment',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== REFUND PAYMENT ====================
export const refundPayment = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { amount, reason, refundType = 'full' } = req.body;
        const adminId = req.user.id;

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;
        if (!paymentIntentId) {
            return res.status(400).json({
                success: false,
                message: 'No payment intent found for this booking'
            });
        }

        if (!['captured', 'released'].includes(booking.payment?.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot refund payment. Current status: ${booking.payment?.status}`
            });
        }

        try {
            const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

            let refundAmount;
            if (refundType === 'full') {
                refundAmount = paymentIntent.amount_received;
            } else if (refundType === 'partial' && amount) {
                refundAmount = Math.round(amount * 100);
                if (refundAmount > paymentIntent.amount_received) {
                    return res.status(400).json({
                        success: false,
                        message: 'Refund amount exceeds captured amount'
                    });
                }
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Please specify refund amount for partial refund'
                });
            }

            const refund = await stripe.refunds.create({
                payment_intent: paymentIntentId,
                amount: refundAmount,
                reason: 'requested_by_customer',
                metadata: {
                    bookingId: booking._id.toString(),
                    refundedBy: 'admin',
                    adminId: adminId.toString(),
                    reason: reason || 'Admin initiated refund'
                }
            });

            // Update booking
            const isFullRefund = refundAmount === paymentIntent.amount_received;
            booking.payment.status = isFullRefund ? 'refunded' : 'partial_refund';
            booking.payment.refundedAt = new Date();
            booking.payment.refundAmount = (booking.payment.refundAmount || 0) + (refundAmount / 100);
            booking.payment.refundAmountCents = (booking.payment.refundAmountCents || 0) + refundAmount;
            booking.payment.refundId = refund.id;
            booking.payment.refundReason = reason;

            booking.refund = {
                status: 'processed',
                amount: (booking.refund?.amount || 0) + (refundAmount / 100),
                amountCents: (booking.refund?.amountCents || 0) + refundAmount,
                reason: reason || 'Admin initiated refund',
                processedAt: new Date(),
                processedBy: adminId,
                refundId: refund.id
            };

            if (!booking.auditLog) booking.auditLog = [];
            booking.auditLog.push({
                action: 'refund_payment',
                performedBy: adminId,
                performedAt: new Date(),
                amount: refundAmount / 100,
                refundId: refund.id,
                reason
            });

            await booking.save();

            // Send notifications
            try {
                await createNotification(
                    booking.client._id,
                    'Refund Processed',
                    `A refund of $${(refundAmount / 100).toFixed(2)} has been processed for your booking "${booking.service.title}".`,
                    'refund-processed',
                    booking._id
                );
            } catch (e) {
                console.error('Notification error:', e);
            }

            res.status(200).json({
                success: true,
                message: `${isFullRefund ? 'Full' : 'Partial'} refund processed successfully`,
                data: {
                    booking,
                    refund: {
                        id: refund.id,
                        amount: refundAmount / 100,
                        status: refund.status,
                        type: isFullRefund ? 'full' : 'partial'
                    }
                }
            });

        } catch (stripeError) {
            console.error('Stripe refund error:', stripeError);
            return res.status(400).json({
                success: false,
                message: 'Failed to process refund: ' + stripeError.message,
                code: 'REFUND_FAILED'
            });
        }

    } catch (error) {
        console.error('❌ Admin refundPayment error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process refund',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== FORCE COMPLETE BOOKING ====================
export const forceCompleteBooking = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { capturePayment: shouldCapture = true, reason } = req.body;
        const adminId = req.user.id;

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (booking.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Booking is already completed'
            });
        }

        let captureResult = null;
        const paymentIntentId = booking.payment?.paymentIntentId || booking.paymentIntentId;

        // Capture payment if requested
        if (shouldCapture && paymentIntentId &&
            ['held', 'authorized'].includes(booking.payment?.status)) {
            try {
                const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId);

                booking.payment.status = 'captured';
                booking.payment.capturedAt = new Date();
                booking.paymentDetails.amountCaptured = paymentIntent.amount_received / 100;
                booking.stripeStatus = 'succeeded';

                captureResult = {
                    captured: true,
                    amount: paymentIntent.amount_received / 100
                };
            } catch (stripeError) {
                console.error('Failed to capture payment:', stripeError);
                captureResult = {
                    captured: false,
                    error: stripeError.message
                };
            }
        }

        // Update booking status
        booking.status = 'completed';
        booking.completedAt = new Date();

        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'force_complete',
            performedBy: adminId,
            performedAt: new Date(),
            reason,
            captureResult
        });

        await booking.save();

        // Send notifications
        try {
            await createNotification(
                booking.client._id,
                'Booking Completed',
                `Your booking for "${booking.service.title}" has been marked as completed.`,
                'booking-completed',
                booking._id
            );

            await createNotification(
                booking.tasker._id,
                'Booking Completed',
                `The booking for "${booking.service.title}" has been marked as completed.${captureResult?.captured ? ` Payment of $${booking.payment.taskerPayout.toFixed(2)} will be transferred to your account.` : ''}`,
                'booking-completed',
                booking._id
            );
        } catch (e) {
            console.error('Notification error:', e);
        }

        res.status(200).json({
            success: true,
            message: 'Booking marked as completed',
            data: {
                booking,
                captureResult
            }
        });

    } catch (error) {
        console.error('❌ Admin forceCompleteBooking error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to complete booking',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== REASSIGN TASKER ====================
export const reassignTasker = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { newTaskerId, reason, notifyUsers = true } = req.body;
        const adminId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(newTaskerId)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid tasker ID'
            });
        }

        const booking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email')
            .populate('client', 'firstName lastName email');

        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (['completed', 'cancelled'].includes(booking.status)) {
            return res.status(400).json({
                success: false,
                message: `Cannot reassign ${booking.status} booking`
            });
        }

        const newTasker = await User.findById(newTaskerId);
        if (!newTasker || newTasker.currentRole !== 'tasker') {
            return res.status(400).json({
                success: false,
                message: 'New tasker not found or invalid role'
            });
        }

        // Check if new tasker can receive payments
        if (!newTasker.stripeConnectId) {
            return res.status(400).json({
                success: false,
                message: 'New tasker has not set up payment receiving'
            });
        }

        const oldTasker = booking.tasker;
        booking.tasker = newTaskerId;

        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'reassign_tasker',
            performedBy: adminId,
            performedAt: new Date(),
            changes: [{
                field: 'tasker',
                oldValue: oldTasker._id.toString(),
                newValue: newTaskerId
            }],
            reason
        });

        await booking.save();

        const updatedBooking = await BookingTasker.findById(bookingId)
            .populate('tasker', 'firstName lastName email phone profilePicture')
            .populate('client', 'firstName lastName email');

        // Send notifications
        if (notifyUsers) {
            try {
                // Notify old tasker
                await createNotification(
                    oldTasker._id,
                    'Booking Reassigned',
                    `The booking for "${booking.service.title}" has been reassigned to another tasker.`,
                    'booking-reassigned',
                    booking._id
                );

                // Notify new tasker
                await createNotification(
                    newTaskerId,
                    '🎉 New Booking Assigned!',
                    `You have been assigned a booking for "${booking.service.title}" on ${booking.formattedDate}.`,
                    'booking-assigned',
                    booking._id
                );

                // Notify client
                await createNotification(
                    booking.client._id,
                    'Tasker Changed',
                    `Your booking for "${booking.service.title}" has been assigned to ${newTasker.firstName} ${newTasker.lastName}.`,
                    'tasker-changed',
                    booking._id
                );
            } catch (e) {
                console.error('Notification error:', e);
            }
        }

        res.status(200).json({
            success: true,
            message: 'Tasker reassigned successfully',
            data: {
                booking: updatedBooking,
                oldTasker: {
                    id: oldTasker._id,
                    name: `${oldTasker.firstName} ${oldTasker.lastName}`
                },
                newTasker: {
                    id: newTasker._id,
                    name: `${newTasker.firstName} ${newTasker.lastName}`
                }
            }
        });

    } catch (error) {
        console.error('❌ Admin reassignTasker error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reassign tasker',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== GET BOOKING STATISTICS ====================
export const getBookingStatistics = async (req, res) => {
    try {
        const { startDate, endDate, groupBy = 'day' } = req.query;

        const matchStage = {};
        if (startDate || endDate) {
            matchStage.createdAt = {};
            if (startDate) matchStage.createdAt.$gte = new Date(startDate);
            if (endDate) matchStage.createdAt.$lte = new Date(endDate);
        }

        // Overall statistics
        const overallStats = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: null,
                    totalBookings: { $sum: 1 },
                    totalRevenue: { $sum: '$payment.totalClientPays' },
                    totalPlatformFees: { $sum: '$payment.applicationFee' },
                    totalTaskerPayouts: { $sum: '$payment.taskerPayout' },
                    avgBookingValue: { $avg: '$payment.totalClientPays' },
                    completedBookings: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
                    },
                    cancelledBookings: {
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] }
                    },
                    pendingBookings: {
                        $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] }
                    },
                    confirmedBookings: {
                        $sum: { $cond: [{ $eq: ['$status', 'confirmed'] }, 1, 0] }
                    },
                }
            }
        ]);

        // Status breakdown
        const statusBreakdown = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    revenue: { $sum: '$payment.totalClientPays' }
                }
            }
        ]);

        // Payment status breakdown
        const paymentStatusBreakdown = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$payment.status',
                    count: { $sum: 1 },
                    amount: { $sum: '$payment.totalClientPays' }
                }
            }
        ]);

        // Time series data
        let dateFormat;
        switch (groupBy) {
            case 'hour':
                dateFormat = { $dateToString: { format: '%Y-%m-%d %H:00', date: '$createdAt' } };
                break;
            case 'day':
                dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
                break;
            case 'week':
                dateFormat = { $dateToString: { format: '%Y-W%V', date: '$createdAt' } };
                break;
            case 'month':
                dateFormat = { $dateToString: { format: '%Y-%m', date: '$createdAt' } };
                break;
            default:
                dateFormat = { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } };
        }

        const timeSeries = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: dateFormat,
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$payment.totalClientPays' },
                    platformFees: { $sum: '$payment.applicationFee' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        // Top taskers
        const topTaskers = await BookingTasker.aggregate([
            { $match: { ...matchStage, status: 'completed' } },
            {
                $group: {
                    _id: '$tasker',
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$payment.serviceAmount' },
                    earnings: { $sum: '$payment.taskerPayout' }
                }
            },
            { $sort: { bookings: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'taskerInfo'
                }
            },
            { $unwind: '$taskerInfo' },
            {
                $project: {
                    _id: 1,
                    bookings: 1,
                    revenue: 1,
                    earnings: 1,
                    name: { $concat: ['$taskerInfo.firstName', ' ', '$taskerInfo.lastName'] },
                    email: '$taskerInfo.email',
                    rating: '$taskerInfo.rating'
                }
            }
        ]);

        // Top clients
        const topClients = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$client',
                    bookings: { $sum: 1 },
                    totalSpent: { $sum: '$payment.totalClientPays' }
                }
            },
            { $sort: { totalSpent: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'clientInfo'
                }
            },
            { $unwind: '$clientInfo' },
            {
                $project: {
                    _id: 1,
                    bookings: 1,
                    totalSpent: 1,
                    name: { $concat: ['$clientInfo.firstName', ' ', '$clientInfo.lastName'] },
                    email: '$clientInfo.email'
                }
            }
        ]);

        // Popular services
        const popularServices = await BookingTasker.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$service.title',
                    bookings: { $sum: 1 },
                    revenue: { $sum: '$payment.totalClientPays' },
                    avgRate: { $avg: '$service.hourlyRate' }
                }
            },
            { $sort: { bookings: -1 } },
            { $limit: 10 }
        ]);

        // Calculate completion rate
        const stats = overallStats[0] || {
            totalBookings: 0,
            completedBookings: 0,
            cancelledBookings: 0
        };
        const completionRate = stats.totalBookings > 0
            ? ((stats.completedBookings / stats.totalBookings) * 100).toFixed(2)
            : 0;
        const cancellationRate = stats.totalBookings > 0
            ? ((stats.cancelledBookings / stats.totalBookings) * 100).toFixed(2)
            : 0;

        res.status(200).json({
            success: true,
            data: {
                overview: {
                    ...stats,
                    completionRate: parseFloat(completionRate),
                    cancellationRate: parseFloat(cancellationRate)
                },
                statusBreakdown,
                paymentStatusBreakdown,
                timeSeries,
                topTaskers,
                topClients,
                popularServices,
                dateRange: { startDate, endDate, groupBy }
            }
        });

    } catch (error) {
        console.error('❌ Admin getBookingStatistics error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch booking statistics',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== EXPORT BOOKINGS ====================
export const exportBookings = async (req, res) => {
    try {
        const { format = 'json', ...filters } = req.query;

        // Build filter (reuse logic from getAllBookings)
        const filter = {};
        if (filters.status) filter.status = filters.status;
        if (filters.startDate || filters.endDate) {
            filter.date = {};
            if (filters.startDate) filter.date.$gte = new Date(filters.startDate);
            if (filters.endDate) filter.date.$lte = new Date(filters.endDate);
        }

        const bookings = await BookingTasker.find(filter)
            .populate('tasker', 'firstName lastName email phone')
            .populate('client', 'firstName lastName email phone')
            .sort({ createdAt: -1 })
            .lean();

        if (format === 'csv') {
            // Generate CSV
            const csvRows = [];

            // Header
            csvRows.push([
                'Booking ID',
                'Date',
                'Status',
                'Service',
                'Client Name',
                'Client Email',
                'Tasker Name',
                'Tasker Email',
                'Service Amount',
                'Client Pays',
                'Tasker Receives',
                'Platform Fee',
                'Payment Status',
                'Created At'
            ].join(','));

            // Data rows
            for (const booking of bookings) {
                csvRows.push([
                    booking._id,
                    new Date(booking.date).toISOString(),
                    booking.status,
                    `"${booking.service.title.replace(/"/g, '""')}"`,
                    `"${booking.client?.firstName || ''} ${booking.client?.lastName || ''}"`,
                    booking.client?.email || '',
                    `"${booking.tasker?.firstName || ''} ${booking.tasker?.lastName || ''}"`,
                    booking.tasker?.email || '',
                    booking.payment?.serviceAmount || booking.totalAmount || 0,
                    booking.payment?.totalClientPays || 0,
                    booking.payment?.taskerPayout || 0,
                    booking.payment?.applicationFee || 0,
                    booking.payment?.status || 'unknown',
                    new Date(booking.createdAt).toISOString()
                ].join(','));
            }

            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=bookings-export-${Date.now()}.csv`);
            res.send(csvRows.join('\n'));

        } else {
            // JSON format
            res.status(200).json({
                success: true,
                data: {
                    bookings,
                    exportedAt: new Date(),
                    totalCount: bookings.length,
                    filters
                }
            });
        }

    } catch (error) {
        console.error('❌ Admin exportBookings error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== BULK UPDATE STATUS ====================
export const bulkUpdateStatus = async (req, res) => {
    try {
        const { bookingIds, status, reason, notifyUsers = false } = req.body;
        const adminId = req.user.id;

        const validStatuses = ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
            });
        }

        if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide an array of booking IDs'
            });
        }

        const updateData = {
            status,
            [`${status}At`]: new Date()
        };

        if (status === 'cancelled') {
            updateData.cancelledBy = adminId;
            updateData.cancellationReason = reason || 'Bulk cancelled by admin';
        }

        const result = await BookingTasker.updateMany(
            { _id: { $in: bookingIds } },
            {
                $set: updateData,
                $push: {
                    auditLog: {
                        action: 'bulk_status_update',
                        performedBy: adminId,
                        performedAt: new Date(),
                        changes: [{ field: 'status', newValue: status }],
                        reason
                    }
                }
            }
        );

        res.status(200).json({
            success: true,
            message: `${result.modifiedCount} bookings updated to ${status}`,
            data: {
                requestedCount: bookingIds.length,
                modifiedCount: result.modifiedCount
            }
        });

    } catch (error) {
        console.error('❌ Admin bulkUpdateStatus error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update bookings',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== ADD ADMIN NOTE ====================
export const addAdminNote = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { note, isPrivate = true } = req.body;
        const adminId = req.user.id;

        if (!note || note.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Note content is required'
            });
        }

        const booking = await BookingTasker.findById(bookingId);
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Booking not found'
            });
        }

        if (!booking.adminNotes) booking.adminNotes = [];
        booking.adminNotes.push({
            content: note.trim(),
            createdBy: adminId,
            createdAt: new Date(),
            isPrivate
        });

        if (!booking.auditLog) booking.auditLog = [];
        booking.auditLog.push({
            action: 'add_note',
            performedBy: adminId,
            performedAt: new Date()
        });

        await booking.save();

        res.status(200).json({
            success: true,
            message: 'Note added successfully',
            data: {
                bookingId,
                note: booking.adminNotes[booking.adminNotes.length - 1]
            }
        });

    } catch (error) {
        console.error('❌ Admin addAdminNote error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to add note',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// ==================== HELPER FUNCTIONS ====================

function getNestedValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
}

function setNestedValue(obj, path, value) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    const target = keys.reduce((current, key) => {
        if (!current[key]) current[key] = {};
        return current[key];
    }, obj);
    target[lastKey] = value;
}