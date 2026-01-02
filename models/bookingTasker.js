

// models/BookingTasker.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const ServiceSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    estimatedDuration: { type: String, required: true },
}, { _id: false });

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

        // ==================== PAYMENT - STRIPE CONNECT ====================
        payment: {
            // Stripe IDs
            paymentIntentId: { type: String },
            transferId: { type: String },
            chargeId: { type: String },

            // Status
            status: {
                type: String,
                enum: ["pending", "held", "captured", "refunded", "partial_refund", "failed", "cancelled" , "authorized"],
                default: "pending",
            },

            // Amounts (in cents)
            grossAmount: { type: Number },          // Total charged to client
            platformFee: { type: Number },          // 15% to Taskallo
            taskerPayout: { type: Number },         // 85% to Tasker
            stripeFee: { type: Number },

            currency: { type: String, default: "cad" },

            // Timestamps
            authorizedAt: { type: Date },
            capturedAt: { type: Date },
            refundedAt: { type: Date },

            // Refund
            refundAmount: { type: Number },
            refundReason: { type: String },
        },

        // Keep for backwards compatibility
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
        extraTime: [{
            hours: Number,
            amount: Number,           // in cents
            reason: String,
            paymentIntentId: String,
            status: {
                type: String,
                enum: ["pending", "approved", "paid", "rejected"],
                default: "pending"
            },
            requestedAt: { type: Date, default: Date.now },
            approvedAt: Date,
        }],

        // ==================== REFUND ====================
        refund: {
            status: {
                type: String,
                enum: ["none", "requested", "approved", "processed", "rejected"],
                default: "none",
            },
            amount: { type: Number, default: 0 },
            reason: { type: String },
            requestedAt: { type: Date },
            processedAt: { type: Date },
        },

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

// Indexes
BookingTaskerSchema.index({ tasker: 1, date: 1 });
BookingTaskerSchema.index({ client: 1, date: 1 });
BookingTaskerSchema.index({ status: 1 });
BookingTaskerSchema.index({ "payment.paymentIntentId": 1 });
BookingTaskerSchema.index({ paymentIntentId: 1 }, { sparse: true });

// Virtuals
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

// Methods
BookingTaskerSchema.methods.canBeCancelled = function () {
    const now = new Date();
    const bookingTime = new Date(this.date);
    const hoursDiff = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    return hoursDiff > 24 && ['pending', 'confirmed'].includes(this.status);
};

BookingTaskerSchema.methods.calculateRefundAmount = function () {
    if (!this.canBeCancelled()) return 0;

    const now = new Date();
    const bookingTime = new Date(this.date);
    const hoursDiff = (bookingTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    const amount = this.payment?.grossAmount || this.totalAmount * 100;

    if (hoursDiff > 48) return amount;           // 100% refund
    if (hoursDiff > 24) return amount * 0.5;     // 50% refund
    return 0;
};

const BookingTasker = mongoose.models.BookingTasker || mongoose.model("BookingTasker", BookingTaskerSchema);

export default BookingTasker;