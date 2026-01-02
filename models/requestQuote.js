// // models/requestQuote.js
// import mongoose from "mongoose";

// const { Schema } = mongoose;

// const RequestQuoteSchema = new Schema(
//     {
//         tasker: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//             required: true,
//         },
//         client: {
//             type: mongoose.Schema.Types.ObjectId,
//             ref: "User",
//             required: true,
//         },
//         taskTitle: { type: String, required: true },
//         taskDescription: { type: String, required: true },
//         location: { type: String, required: true },
//         budget: { type: Number, default: null },
//         preferredDateTime: { type: Date, default: null },
//         urgency: {
//             type: String,
//             enum: ["Flexible - Whenever works", "Within a week", "As soon as possible"],
//             default: "Flexible - Whenever works",
//         },
//         status: {
//             type: String,
//             enum: ["pending", "bidded", "accepted", "rejected", "completed"],
//             default: "pending",
//         },
//         bids: [{
//             tasker: {  // optional: also store tasker ID in each bid for easier queries
//                 type: mongoose.Schema.Types.ObjectId,
//                 ref: "User",
//             },
//             bidAmount: {
//                 type: Number,
//                 required: true,
//                 min: 0
//             },
//             bidDescription: {
//                 type: String,
//                 default: ''
//             },
//             estimatedDuration: {
//                 type: Number,
//                 default: 1, // in hours
//                 min: 0
//             },
//             submittedAt: {
//                 type: Date,
//                 default: Date.now
//             },
//             status: {
//                 type: String,
//                 enum: ['pending', 'accepted', 'rejected'],
//                 default: 'pending'
//             }
//         }]
//     },
//     { timestamps: true }
// );

// const RequestQuote = mongoose.model("RequestQuote", RequestQuoteSchema);
// export default RequestQuote;

// models/RequestQuote.js
import mongoose from "mongoose";

const { Schema } = mongoose;

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

    // ⭐ NEW: Fee breakdown stored with each bid
    feeBreakdown: {
        bidAmountCents: Number,
        clientPlatformFeeCents: Number,
        taxOnClientFeeCents: Number,
        totalClientPaysCents: Number,
        taskerPlatformFeeCents: Number,
        taskerPayoutCents: Number,
        platformTotalCents: Number,
    },

    // Existing fields...
    breakdown: [{
        item: String,
        description: String,
        amount: Number,
    }],
    hasMilestones: { type: Boolean, default: false },
    milestones: [{
        name: String,
        description: String,
        percentage: Number,
        amount: Number,
        order: Number,
    }],
    validUntil: { type: Date },
    submittedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'rejected', 'expired', 'withdrawn'],
        default: 'pending'
    }
});
const MilestonePaymentSchema = new Schema({
    milestoneIndex: { type: Number, required: true },
    name: { type: String },
    amount: { type: Number },

    paymentIntentId: { type: String },
    status: {
        type: String,
        enum: ["pending", "held", "captured", "refunded"],
        default: "pending"
    },

    submittedAt: { type: Date },
    approvedAt: { type: Date },
    paidAt: { type: Date },
});

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
            bidAmount: Number,
            bidDescription: String,
            acceptedAt: Date,
        },

        // ==================== PAYMENT - STRIPE CONNECT ====================
        payment: {
            // For single payment (no milestones)
            paymentIntentId: { type: String },
            transferId: { type: String },
            chargeId: { type: String },

            status: {
                type: String,
                enum: ["pending", "held", "captured", "refunded", "failed", "cancelled"],
                default: "pending",
            },

            // Amounts (in cents)
            grossAmount: { type: Number },
            platformFee: { type: Number },
            taskerPayout: { type: Number },

            currency: { type: String, default: "cad" },

            authorizedAt: { type: Date },
            capturedAt: { type: Date },
            refundedAt: { type: Date },
        },

        // ==================== MILESTONE PAYMENTS ====================
        hasMilestones: { type: Boolean, default: false },
        milestonePayments: [MilestonePaymentSchema],

        // Track overall milestone progress
        milestonesProgress: {
            total: { type: Number, default: 0 },
            completed: { type: Number, default: 0 },
            totalAmount: { type: Number, default: 0 },
            paidAmount: { type: Number, default: 0 },
        },

        // ==================== TIMESTAMPS ====================
        acceptedAt: { type: Date },
        startedAt: { type: Date },
        completedAt: { type: Date },
        cancelledAt: { type: Date },
        expiresAt: { type: Date },

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

// Indexes
RequestQuoteSchema.index({ client: 1, status: 1 });
RequestQuoteSchema.index({ tasker: 1, status: 1 });
RequestQuoteSchema.index({ status: 1, createdAt: -1 });
RequestQuoteSchema.index({ "payment.paymentIntentId": 1 });

const RequestQuote = mongoose.models.RequestQuote || mongoose.model("RequestQuote", RequestQuoteSchema);

export default RequestQuote;