
// models/BookingTasker.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ServiceSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    estimatedDuration: { type: String, required: true },
}, { _id: false });

// ⭐ NEW: Payment Schema with complete fee breakdown
const PaymentSchema = new Schema({
    // ─── STRIPE IDs ───
    paymentIntentId: { type: String },
    transferId: { type: String },
    chargeId: { type: String },

    // ─── STATUS ───
    status: {
        type: String,
        enum: ["pending", "held", "authorized", "captured", "released", "refunded", "partial_refund", "failed", "cancelled"],
        default: "pending",
    },

    // ─── FEE STRUCTURE TYPE ───
    feeStructure: {
        type: String,
        default: "client-10-5-13_tasker-12-13"
    },

    // ─── SERVICE AMOUNT (Base) ───
    serviceAmount: { type: Number },              // Service amount in dollars
    serviceAmountCents: { type: Number },         // Service amount in cents

    // ─── CLIENT SIDE FEES (Added to service amount) ───
    // Platform Fee: 10%
    clientPlatformFee: { type: Number },          // In dollars
    clientPlatformFeeCents: { type: Number },     // In cents

    // Reservation Fee: $5 flat
    reservationFee: { type: Number },             // In dollars
    reservationFeeCents: { type: Number },        // In cents

    // HST: 13% on service amount
    clientTax: { type: Number },                  // In dollars
    clientTaxCents: { type: Number },             // In cents

    // Total Client Pays
    totalClientPays: { type: Number },            // In dollars
    totalClientPaysCents: { type: Number },       // In cents

    // ─── TASKER SIDE FEES (Deducted from service amount) ───
    // Platform Fee: 12%
    taskerPlatformFee: { type: Number },          // In dollars
    taskerPlatformFeeCents: { type: Number },     // In cents

    // Tax: 13%
    taskerTax: { type: Number },                  // In dollars
    taskerTaxCents: { type: Number },             // In cents

    // Tasker Payout (what tasker receives)
    taskerPayout: { type: Number },               // In dollars
    taskerPayoutCents: { type: Number },          // In cents

    // ─── PLATFORM REVENUE ───
    applicationFee: { type: Number },             // Total platform keeps (dollars)
    applicationFeeCents: { type: Number },        // Total platform keeps (cents)

    // ─── LEGACY FIELDS (for backwards compatibility) ───
    grossAmount: { type: Number },                // Alias for totalClientPays
    platformFee: { type: Number },                // Alias for applicationFee
    stripeFee: { type: Number },                  // Stripe processing fee

    // ─── CURRENCY ───
    currency: { type: String, default: "cad" },

    // ─── TIMESTAMPS ───
    authorizedAt: { type: Date },
    capturedAt: { type: Date },
    releasedAt: { type: Date },
    refundedAt: { type: Date },
    cancelledAt: { type: Date },

    // ─── REFUND DETAILS ───
    refundAmount: { type: Number },
    refundAmountCents: { type: Number },
    refundReason: { type: String },
    refundId: { type: String },
}, { _id: false });

// ⭐ Extra Time Request Schema
const ExtraTimeSchema = new Schema({
    hours: { type: Number, required: true },

    // Service rate for extra time
    serviceAmount: { type: Number },
    serviceAmountCents: { type: Number },

    // Client fees
    clientPlatformFee: { type: Number },
    clientPlatformFeeCents: { type: Number },
    reservationFee: { type: Number },
    reservationFeeCents: { type: Number },
    clientTax: { type: Number },
    clientTaxCents: { type: Number },
    totalClientPays: { type: Number },
    totalClientPaysCents: { type: Number },

    // Tasker earnings
    taskerPlatformFee: { type: Number },
    taskerPlatformFeeCents: { type: Number },
    taskerTax: { type: Number },
    taskerTaxCents: { type: Number },
    taskerPayout: { type: Number },
    taskerPayoutCents: { type: Number },

    // Legacy
    amount: { type: Number },                     // Legacy: total in cents

    reason: { type: String },
    paymentIntentId: { type: String },
    status: {
        type: String,
        enum: ["pending", "approved", "paid", "rejected", "cancelled"],
        default: "pending"
    },
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    paidAt: { type: Date },
}, { _id: true });

const BookingTaskerSchema = new Schema(
    {
        // ==================== PARTIES ====================
        tasker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // ==================== SERVICE ====================
        service: ServiceSchema,

        // ==================== SCHEDULE ====================
        date: {
            type: Date,
            required: [true, "Booking date and time are required"],
        },
        duration: { type: Number, default: 1 },  // in hours
        endTime: { type: Date },

        // ==================== LOCATION ====================
        location: {
            address: { type: String },
            city: { type: String },
            postalCode: { type: String },
            notes: { type: String },
        },

        // ==================== STATUS ====================
        status: {
            type: String,
            enum: ["pending", "confirmed", "in_progress", "completed", "cancelled", "no_show"],
            default: "pending",
        },

        // ==================== ⭐ PAYMENT - NEW STRUCTURE ====================
        payment: PaymentSchema,

        // ==================== LEGACY PAYMENT FIELDS ====================
        totalAmount: { type: Number, required: true },
        paymentIntentId: { type: String, sparse: true },
        stripeStatus: {
            type: String,
            enum: ["pending", "succeeded", "failed", "canceled", "requires_payment_method", "authorized"],
            default: "pending",
        },
        paymentMethod: { type: String },
        paymentDetails: {
            amountCaptured: { type: Number, default: 0 },
            currency: { type: String, default: "cad" },
            paymentMethodType: { type: String },
            billingDetails: {
                name: { type: String },
                email: { type: String },
                phone: { type: String },
            }
        },

        // ==================== EXTRA TIME ====================
        extraTime: [ExtraTimeSchema],

        // ==================== REFUND ====================
        refund: {
            status: {
                type: String,
                enum: ["none", "requested", "approved", "processed", "rejected"],
                default: "none",
            },
            amount: { type: Number, default: 0 },
            amountCents: { type: Number, default: 0 },

            // Breakdown of refund
            clientRefund: { type: Number },           // What client gets back
            clientRefundCents: { type: Number },
            taskerDeduction: { type: Number },        // What's deducted from tasker
            taskerDeductionCents: { type: Number },
            platformKeeps: { type: Number },          // What platform keeps (if any)
            platformKeepsCents: { type: Number },

            reason: { type: String },
            requestedAt: { type: Date },
            requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            processedAt: { type: Date },
            processedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            refundId: { type: String },               // Stripe refund ID
        },
        adminNotes: [{
            content: { type: String, required: true },
            createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now },
            isPrivate: { type: Boolean, default: true }
        }],

        auditLog: [{
            action: { type: String, required: true },
            performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            performedAt: { type: Date, default: Date.now },
            changes: [{
                field: String,
                oldValue: Schema.Types.Mixed,
                newValue: Schema.Types.Mixed
            }],
            reason: String,
            ip: String,
            userAgent: String,
            metadata: Schema.Types.Mixed
        }],

        isDeleted: { type: Boolean, default: false },
        deletedAt: { type: Date },
        deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  

        // ==================== TIMESTAMPS ====================
        confirmedAt: { type: Date },
        startedAt: { type: Date },
        completedAt: { type: Date },
        cancelledAt: { type: Date },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        cancellationReason: { type: String },

        // ==================== NOTES ====================
        clientNotes: { type: String },
        taskerNotes: { type: String },

        // ==================== REVIEWS ====================
        clientReview: {
            rating: { type: Number, min: 1, max: 5 },
            message: String,
            createdAt: Date,
        },
        taskerReview: {
            rating: { type: Number, min: 1, max: 5 },
            message: String,
            createdAt: Date,
        },
    },
    { timestamps: true }
);

// ==================== INDEXES ====================
// Add index for soft deletes
BookingTaskerSchema.index({ tasker: 1, date: 1 });
BookingTaskerSchema.index({ client: 1, date: 1 });
BookingTaskerSchema.index({ status: 1 });
BookingTaskerSchema.index({ "payment.paymentIntentId": 1 });
BookingTaskerSchema.index({ "payment.status": 1 });
BookingTaskerSchema.index({ paymentIntentId: 1 }, { sparse: true });
BookingTaskerSchema.index({ createdAt: -1 });
BookingTaskerSchema.index({ isDeleted: 1 });

// ==================== VIRTUALS ====================
BookingTaskerSchema.virtual('formattedDate').get(function () {
    return this.date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// ⭐ NEW: Virtual for getting display amounts
BookingTaskerSchema.virtual('displayAmounts').get(function () {
    const payment = this.payment || {};
    return {
        serviceAmount: payment.serviceAmount || this.totalAmount || 0,
        clientPays: payment.totalClientPays || payment.grossAmount || this.totalAmount || 0,
        taskerReceives: payment.taskerPayout || 0,
        platformFee: payment.applicationFee || payment.platformFee || 0,
    };
});

// ==================== METHODS ====================
BookingTaskerSchema.methods.canBeCancelled = function () {
    const now = new Date();
    const bookingTime = new Date(this.date);
    const hoursDiff = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24 && ['pending', 'confirmed'].includes(this.status);
};

// ⭐ UPDATED: Calculate refund based on new fee structure
BookingTaskerSchema.methods.calculateRefundAmount = function () {
    if (!this.canBeCancelled()) {
        return {
            clientRefund: 0,
            taskerDeduction: 0,
            platformKeeps: 0,
            refundPercent: 0,
        };
    }

    const now = new Date();
    const bookingTime = new Date(this.date);
    const hoursDiff = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const payment = this.payment || {};
    const totalClientPaid = payment.totalClientPaysCents || payment.grossAmount || (this.totalAmount * 100);
    const taskerPayout = payment.taskerPayoutCents || 0;
    const platformFee = payment.applicationFeeCents || payment.platformFee || 0;

    let refundPercent = 0;
    if (hoursDiff > 48) {
        refundPercent = 100;  // 100% refund
    } else if (hoursDiff > 24) {
        refundPercent = 50;   // 50% refund
    }

    const clientRefund = Math.round(totalClientPaid * (refundPercent / 100));

    // Platform keeps reservation fee on partial refunds
    const reservationFee = payment.reservationFeeCents || 500;
    const platformKeeps = refundPercent === 100 ? 0 : reservationFee;

    // Tasker doesn't receive anything if cancelled
    const taskerDeduction = taskerPayout;

    return {
        clientRefund,
        clientRefundDollars: clientRefund / 100,
        taskerDeduction,
        taskerDeductionDollars: taskerDeduction / 100,
        platformKeeps,
        platformKeepsDollars: platformKeeps / 100,
        refundPercent,
    };
};

// ⭐ NEW: Get fee breakdown for display
BookingTaskerSchema.methods.getFeeBreakdown = function (userRole = 'client') {
    const payment = this.payment || {};

    if (userRole === 'client') {
        return {
            items: [
                {
                    label: 'Service Amount',
                    amount: payment.serviceAmount || this.totalAmount || 0,
                    type: 'base'
                },
                {
                    label: 'Platform Fee (10%)',
                    amount: payment.clientPlatformFee || 0,
                    type: 'fee'
                },
                {
                    label: 'Reservation Fee',
                    amount: payment.reservationFee || 0,
                    type: 'fee'
                },
                {
                    label: 'HST (13%)',
                    amount: payment.clientTax || 0,
                    type: 'tax'
                },
            ],
            total: payment.totalClientPays || payment.grossAmount || this.totalAmount || 0,
            currency: payment.currency || 'CAD',
        };
    } else {
        // Tasker view
        return {
            items: [
                {
                    label: 'Service Amount',
                    amount: payment.serviceAmount || this.totalAmount || 0,
                    type: 'base'
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
            ],
            total: payment.taskerPayout || 0,
            currency: payment.currency || 'CAD',
        };
    }
};

// ⭐ NEW: Check if payment can be captured
BookingTaskerSchema.methods.canCapturePayment = function () {
    const validStatuses = ['held', 'authorized'];
    return validStatuses.includes(this.payment?.status) &&
        this.status === 'completed' &&
        this.payment?.paymentIntentId;
};

// ⭐ NEW: Check if payment can be refunded
BookingTaskerSchema.methods.canRefundPayment = function () {
    const validStatuses = ['captured', 'released'];
    return validStatuses.includes(this.payment?.status) &&
        this.payment?.paymentIntentId;
};

// Enable virtuals in JSON
BookingTaskerSchema.set('toJSON', { virtuals: true });
BookingTaskerSchema.set('toObject', { virtuals: true });

const BookingTasker = mongoose.models.BookingTasker || mongoose.model("BookingTasker", BookingTaskerSchema);

export default BookingTasker;