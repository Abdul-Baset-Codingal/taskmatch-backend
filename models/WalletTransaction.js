// models/WalletTransaction.js
import mongoose from "mongoose";

const walletTransactionSchema = new mongoose.Schema(
    {
        // Who owns this transaction
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Transaction type
        type: {
            type: String,
            enum: [
                "earning",           // Money earned from task/booking
                "withdrawal",        // Money withdrawn
                "withdrawal_reversed", // Withdrawal cancelled/reversed
                "refund",            // Refund to client affected tasker
                "adjustment",        // Manual adjustment by admin
                "bonus",             // Promotional bonus
            ],
            required: true,
        },

        // Amount (positive for credit, negative for debit)
        amount: {
            type: Number,
            required: true,
        },

        // Balance after this transaction
        balanceAfter: {
            type: Number,
            required: true,
        },

        // Description
        description: {
            type: String,
            required: true,
        },

        // Related references
        taskId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
        },
        bookingId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "BookingTasker",
        },
        quoteId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "RequestQuote",
        },
        withdrawalRequestId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "WithdrawalRequest",
        },

        // Metadata
        metadata: {
            type: mongoose.Schema.Types.Mixed,
        },

        // Who created (for adjustments)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

// Indexes
walletTransactionSchema.index({ user: 1, createdAt: -1 });
walletTransactionSchema.index({ user: 1, type: 1 });
walletTransactionSchema.index({ taskId: 1 });
walletTransactionSchema.index({ withdrawalRequestId: 1 });

export default mongoose.models.WalletTransaction ||
    mongoose.model("WalletTransaction", walletTransactionSchema);