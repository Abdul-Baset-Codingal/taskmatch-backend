


// models/RequestQuote.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// ⭐ Fee Breakdown Schema for bids (new structure)
const FeeBreakdownSchema = new Schema({
    feeStructure: { type: String, default: 'client-10-5-13_tasker-12-13' },

    // Bid amount
    bidAmountCents: { type: Number },

    // Client fees (added to bid)
    clientPlatformFeeCents: { type: Number },      // 10%
    reservationFeeCents: { type: Number },          // $5 flat
    clientTaxCents: { type: Number },               // 13% HST
    totalClientPaysCents: { type: Number },

    // Tasker deductions (subtracted from bid)
    taskerPlatformFeeCents: { type: Number },      // 12%
    taskerTaxCents: { type: Number },               // 13%
    taskerPayoutCents: { type: Number },

    // Platform revenue
    applicationFeeCents: { type: Number },

    // Legacy fields for backwards compatibility
    taxOnClientFeeCents: { type: Number },          // Old field name
    platformTotalCents: { type: Number },           // Old field name
}, { _id: false });

const AdminActionSchema = new Schema({
    action: {
        type: String,
        enum: [
            'status_update',
            'cancellation',
            'payment_capture',
            'refund',
            'bulk_cancel',
            'bulk_expire',
            'bulk_mark_completed',
            'note_added',
            'dispute_resolved',
        ],
        required: true,
    },
    previousStatus: { type: String },
    newStatus: { type: String },
    amount: { type: Number },
    reason: { type: String },
    refundResult: { type: Schema.Types.Mixed },
    adminId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    timestamp: {
        type: Date,
        default: Date.now,
    },
    metadata: { type: Schema.Types.Mixed },
}, { _id: true });


// ⭐ Updated Bid Schema
const BidSchema = new Schema({
    tasker: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    bidAmount: {
        type: Number,
        required: true,
        min: 0
    },
    bidDescription: {
        type: String,
        default: ''
    },
    estimatedDuration: {
        type: Number,
        default: 1,
        min: 0
    },

    // ⭐ Fee breakdown with new structure
    feeBreakdown: FeeBreakdownSchema,

    // Itemized breakdown (optional)
    breakdown: [{
        item: { type: String },
        description: { type: String },
        amount: { type: Number },
    }],

    // Milestones
    hasMilestones: { type: Boolean, default: false },
    milestones: [{
        name: { type: String },
        description: { type: String },
        percentage: { type: Number },
        amount: { type: Number },
        order: { type: Number },
    }],

    validUntil: { type: Date },
    submittedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired', 'withdrawn'],
        default: 'pending'
    }
});

// ⭐ Milestone Payment Schema (updated with fee structure)
const MilestonePaymentSchema = new Schema({
    milestoneIndex: { type: Number, required: true },
    name: { type: String },

    // Amounts
    amount: { type: Number },                       // Original milestone amount
    amountCents: { type: Number },

    // Client fees for this milestone
    clientPlatformFee: { type: Number },
    clientPlatformFeeCents: { type: Number },
    reservationFee: { type: Number },               // Only on first milestone or split
    reservationFeeCents: { type: Number },
    clientTax: { type: Number },
    clientTaxCents: { type: Number },
    totalClientPays: { type: Number },
    totalClientPaysCents: { type: Number },

    // Tasker earnings for this milestone
    taskerPlatformFee: { type: Number },
    taskerPlatformFeeCents: { type: Number },
    taskerTax: { type: Number },
    taskerTaxCents: { type: Number },
    taskerPayout: { type: Number },
    taskerPayoutCents: { type: Number },

    // Payment details
    paymentIntentId: { type: String },
    status: {
        type: String,
        enum: ["pending", "held", "authorized", "captured", "released", "refunded", "failed"],
        default: "pending"
    },

    // Timestamps
    submittedAt: { type: Date },
    authorizedAt: { type: Date },
    approvedAt: { type: Date },
    capturedAt: { type: Date },
    paidAt: { type: Date },
    refundedAt: { type: Date },
});

// ⭐ Payment Schema with complete fee breakdown
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

    // ─── FEE STRUCTURE ───
    feeStructure: { type: String, default: 'client-10-5-13_tasker-12-13' },

    // ─── BID AMOUNT (Base) ───
    bidAmount: { type: Number },
    bidAmountCents: { type: Number },

    // ─── CLIENT SIDE FEES (Added to bid) ───
    // Platform Fee: 10%
    clientPlatformFee: { type: Number },
    clientPlatformFeeCents: { type: Number },

    // Reservation Fee: $5 flat
    reservationFee: { type: Number },
    reservationFeeCents: { type: Number },

    // HST: 13% on bid amount
    clientTax: { type: Number },
    clientTaxCents: { type: Number },

    // Total Client Pays
    totalClientPays: { type: Number },
    totalClientPaysCents: { type: Number },

    // ─── TASKER SIDE FEES (Deducted from bid) ───
    // Platform Fee: 12%
    taskerPlatformFee: { type: Number },
    taskerPlatformFeeCents: { type: Number },

    // Tax: 13%
    taskerTax: { type: Number },
    taskerTaxCents: { type: Number },

    // Tasker Payout (what tasker receives)
    taskerPayout: { type: Number },
    taskerPayoutCents: { type: Number },

    // ─── PLATFORM REVENUE ───
    applicationFee: { type: Number },
    applicationFeeCents: { type: Number },

    // ─── LEGACY FIELDS (for backwards compatibility) ───
    grossAmount: { type: Number },
    platformFee: { type: Number },
    stripeFee: { type: Number },
    taxOnClientFee: { type: Number },               // Old field
    taxOnClientFeeCents: { type: Number },          // Old field

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

// ⭐ Main RequestQuote Schema
const RequestQuoteSchema = new Schema(
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

        // ==================== TASK INFO ====================
        taskTitle: { type: String, required: true },
        taskDescription: { type: String, required: true },
        location: { type: String, required: true },
        budget: { type: Number, default: null },

        // ==================== SCHEDULE ====================
        preferredDateTime: { type: Date, default: null },
        urgency: {
            type: String,
            enum: ["Flexible - Whenever works", "Within a week", "As soon as possible"],
            default: "Flexible - Whenever works",
        },

        // ==================== ATTACHMENTS ====================
        photos: [{ type: String }],
        documents: [{ type: String }],

        adminActions: [AdminActionSchema],

        adminNotes: [{
            note: { type: String },
            adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
            createdAt: { type: Date, default: Date.now },
        }],

        // ==================== STATUS ====================
        status: {
            type: String,
            enum: ["pending", "bidded", "accepted", "in_progress", "completed", "rejected", "cancelled", "expired"],
            default: "pending",
        },

        // ==================== BIDS ====================
        bids: [BidSchema],

        // ==================== ACCEPTED BID ====================
        acceptedBid: {
            bidId: { type: mongoose.Schema.Types.ObjectId },
            tasker: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            bidAmount: { type: Number },
            bidDescription: { type: String },
            estimatedDuration: { type: Number },
            acceptedAt: { type: Date },
        },

        // ==================== ⭐ PAYMENT - NEW STRUCTURE ====================
        payment: PaymentSchema,

        // ==================== MILESTONE PAYMENTS ====================
        hasMilestones: { type: Boolean, default: false },
        milestonePayments: [MilestonePaymentSchema],

        // Track overall milestone progress
        milestonesProgress: {
            total: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            totalAmount: { type: Number, default: 0 },
            paidAmount: { type: Number, default: 0 },

            // Fee totals across all milestones
            totalClientPays: { type: Number, default: 0 },
            totalTaskerPayout: { type: Number, default: 0 },
            totalPlatformFee: { type: Number, default: 0 },
        },

        // ==================== TIMESTAMPS ====================
        acceptedAt: { type: Date },
        startedAt: { type: Date },
        completedAt: { type: Date },
        cancelledAt: { type: Date },
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        cancellationReason: { type: String },
        expiresAt: { type: Date },

        // ==================== REVIEWS ====================
        clientReview: {
            rating: { type: Number, min: 1, max: 5 },
            message: { type: String },
            createdAt: { type: Date },
        },
        taskerReview: {
            rating: { type: Number, min: 1, max: 5 },
            message: { type: String },
            createdAt: { type: Date },
        },
    },
    { timestamps: true }
);

// ==================== INDEXES ====================
RequestQuoteSchema.index({ client: 1, status: 1 });
RequestQuoteSchema.index({ tasker: 1, status: 1 });
RequestQuoteSchema.index({ status: 1, createdAt: -1 });
RequestQuoteSchema.index({ "payment.paymentIntentId": 1 });
RequestQuoteSchema.index({ "payment.status": 1 });
RequestQuoteSchema.index({ createdAt: -1 });
RequestQuoteSchema.index({ expiresAt: 1 });

// ==================== VIRTUALS ====================

// Get display-friendly amounts
RequestQuoteSchema.virtual('displayAmounts').get(function () {
    const payment = this.payment || {};
    return {
        bidAmount: payment.bidAmount || this.acceptedBid?.bidAmount || 0,
        clientPays: payment.totalClientPays || payment.grossAmount || 0,
        taskerReceives: payment.taskerPayout || 0,
        platformFee: payment.applicationFee || payment.platformFee || 0,
    };
});

// ==================== METHODS ====================

/**
 * Get fee breakdown for display based on user role
 */
RequestQuoteSchema.methods.getFeeBreakdown = function (userRole = 'client') {
    const payment = this.payment || {};

    if (userRole === 'client') {
        return {
            items: [
                {
                    label: 'Bid Amount',
                    amount: payment.bidAmount || this.acceptedBid?.bidAmount || 0,
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
            total: payment.totalClientPays || 0,
            currency: payment.currency || 'CAD',
        };
    } else {
        // Tasker view
        return {
            items: [
                {
                    label: 'Bid Amount',
                    amount: payment.bidAmount || this.acceptedBid?.bidAmount || 0,
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

/**
 * Check if payment can be captured
 */
RequestQuoteSchema.methods.canCapturePayment = function () {
    const validStatuses = ['held', 'authorized'];
    return validStatuses.includes(this.payment?.status) &&
        this.status === 'completed' &&
        this.payment?.paymentIntentId;
};

/**
 * Check if payment can be refunded
 */
RequestQuoteSchema.methods.canRefundPayment = function () {
    const validStatuses = ['captured', 'released'];
    return validStatuses.includes(this.payment?.status) &&
        this.payment?.paymentIntentId;
};

/**
 * Get accepted bid with fee calculations
 */
RequestQuoteSchema.methods.getAcceptedBidWithFees = function () {
    if (!this.acceptedBid) return null;

    const bid = this.bids.find(b => b._id.toString() === this.acceptedBid.bidId?.toString());
    const payment = this.payment || {};

    return {
        ...this.acceptedBid.toObject(),
        fees: {
            clientPays: payment.totalClientPays || 0,
            taskerReceives: payment.taskerPayout || 0,
            platformFee: payment.applicationFee || 0,
        },
        feeBreakdown: bid?.feeBreakdown || null,
    };
};

/**
 * Calculate refund amounts based on timing
 */
RequestQuoteSchema.methods.calculateRefundAmount = function () {
    const payment = this.payment || {};

    if (!payment.totalClientPaysCents) {
        return {
            clientRefund: 0,
            taskerDeduction: 0,
            platformKeeps: 0,
            refundPercent: 0,
        };
    }

    const now = new Date();
    const acceptedAt = this.acceptedAt || this.payment?.authorizedAt;

    if (!acceptedAt) {
        return {
            clientRefund: payment.totalClientPaysCents,
            taskerDeduction: 0,
            platformKeeps: 0,
            refundPercent: 100,
        };
    }

    const hoursSinceAccepted = (now.getTime() - new Date(acceptedAt).getTime()) / (1000 * 60 * 60);

    let refundPercent = 0;
    if (hoursSinceAccepted < 1) {
        refundPercent = 100;  // Full refund within 1 hour
    } else if (hoursSinceAccepted < 24) {
        refundPercent = 75;   // 75% refund within 24 hours
    } else if (hoursSinceAccepted < 48) {
        refundPercent = 50;   // 50% refund within 48 hours
    }

    const clientRefund = Math.round(payment.totalClientPaysCents * (refundPercent / 100));
    const reservationFee = payment.reservationFeeCents || 500;
    const platformKeeps = refundPercent === 100 ? 0 : reservationFee;
    const taskerDeduction = payment.taskerPayoutCents || 0;

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

RequestQuoteSchema.index({ 'adminActions.timestamp': -1 });
// Enable virtuals in JSON
RequestQuoteSchema.set('toJSON', { virtuals: true });
RequestQuoteSchema.set('toObject', { virtuals: true });

const RequestQuote = mongoose.models.RequestQuote || mongoose.model("RequestQuote", RequestQuoteSchema);

export default RequestQuote;