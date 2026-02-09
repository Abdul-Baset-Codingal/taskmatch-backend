// models/WithdrawalRequest.js
import mongoose from "mongoose";

const withdrawalRequestSchema = new mongoose.Schema(
    {
        // Who is requesting
        tasker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Amount details
        amount: {
            type: Number,
            required: true,
            min: 1, // Minimum $1
        },
        currency: {
            type: String,
            default: "CAD",
        },

        // Status tracking
        status: {
            type: String,
            enum: ["pending", "approved", "rejected", "completed", "cancelled"],
            default: "pending",
        },

        // Request details
        requestedAt: {
            type: Date,
            default: Date.now,
        },
        note: {
            type: String, // Optional note from tasker
        },

        // Admin response
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User", // Admin who processed
        },
        processedAt: Date,
        adminNote: String, // Reason for rejection or approval note

        // Payment details (filled when completed)
        paymentMethod: {
            type: String,
            enum: ["bank_transfer", "e_transfer", "cheque", "other"],
        },
        paymentReference: String, // Transaction ID or reference
        paymentDate: Date,

        // Bank account snapshot (at time of request)
        bankAccountSnapshot: {
            accountHolderName: String,
            bankName: String,
            last4: String,
            accountType: String,
        },
    },
    { timestamps: true }
);

// Indexes
withdrawalRequestSchema.index({ tasker: 1, status: 1 });
withdrawalRequestSchema.index({ status: 1, requestedAt: -1 });
withdrawalRequestSchema.index({ processedBy: 1 });

export default mongoose.models.WithdrawalRequest ||
    mongoose.model("WithdrawalRequest", withdrawalRequestSchema);