// models/Transaction.js
import mongoose from 'mongoose';

const transactionSchema = new mongoose.Schema({
    // Transaction identification - Auto-generated
    transactionId: {
        type: String,
        unique: true,
        required: true
    },

    // Type of transaction
    type: {
        type: String,
        enum: [
            'bid_authorization',
            'bid_capture',
            'tasker_payout',
            'refund',
            'platform_fee',
            'cancellation'
        ],
        required: true
    },

    // Related entities
    taskId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Task',
        required: true
    },

    clientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    taskerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },

    // Stripe IDs
    stripePaymentIntentId: String,
    stripeTransferId: String,
    stripePayoutId: String,
    stripeCustomerId: String,

    // Amounts (all in cents for precision)
    amounts: {
        total: {
            type: Number,
            required: true,
            default: 0
        },
        platformFee: {
            type: Number,
            required: true,
            default: 0
        },
        platformFeePercentage: {
            type: Number,
            required: true,
            default: 15
        },
        taskerEarnings: {
            type: Number,
            required: true,
            default: 0
        },
        stripeFee: {
            type: Number,
            default: 0
        }
    },

    currency: {
        type: String,
        default: 'usd'
    },

    // Payment status
    status: {
        type: String,
        enum: [
            'pending',
            'authorized',
            'captured',
            'tasker_payout_pending',
            'tasker_payout_processing',
            'tasker_paid',
            'refunded',
            'cancelled',
            'failed'
        ],
        default: 'pending'
    },

    // Tasker payout details
    // models/Transaction.js

    // Find this section and update:
    taskerPayout: {
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
            default: 'pending'
        },
        scheduledDate: Date,
        processedDate: Date,
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        payoutMethod: {
            type: String,
            enum: [
                'stripe_connect',
                'bank_transfer',
                'manual_bank_transfer',  // ← ADD THIS
                'manual',
                'paypal',
                'check',
                'other'
            ]
        },
        referenceNumber: String,  // ← ADD THIS (you're using it in controller)
        notes: String,
        failureReason: String,
        bankDetails: {            // ← ADD THIS (you're using it in controller)
            accountHolder: String,
            accountLast4: String,
            routingNumber: String
        }
    },


    // Stripe IDs - Add these
    stripePaymentIntentId: String,
    stripeTransferId: String,          // For Connect transfers
    stripePayoutId: String,            // For payouts to bank
    stripeChargeId: String,
    stripeCustomerId: String,

    // Update taskerPayout section
    taskerPayout: {
        status: {
            type: String,
            enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
            default: 'pending'
        },
        scheduledDate: Date,
        processedDate: Date,
        processedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        payoutMethod: {
            type: String,
            enum: [
                'stripe_connect',       // Automatic via Stripe Connect
                'stripe_instant',       // Instant payout
                'bank_transfer',        // Direct bank transfer
                'manual',               // Manual processing
                'paypal',
                'other',
                'manual_bank_transfer'
            ]
        },
        stripeTransferId: String,
        stripePayoutId: String,
        referenceNumber: String,
        notes: String,
        failureReason: String,
        bankDetails: {
            accountHolder: String,
            accountLast4: String,
            routingNumber: String,
            bankName: String
        },
        // Transfer details
        transferDetails: {
            amount: Number,
            currency: String,
            destinationAccountId: String,
            transferGroup: String
        }
    },

    // Task details snapshot
    taskSnapshot: {
        title: String,
        description: String,
        completedAt: Date
    },

    // Client details snapshot
    clientSnapshot: {
        name: String,
        email: String
    },

    // Tasker details snapshot
    taskerSnapshot: {
        name: String,
        email: String,
        stripeConnectAccountId: String
    },

    // Metadata
    metadata: {
        type: Map,
        of: String
    },

    // Notes and history
    adminNotes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],

    statusHistory: [{
        status: String,
        changedAt: {
            type: Date,
            default: Date.now
        },
        changedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        reason: String
    }]

}, { timestamps: true });

// Indexes
transactionSchema.index({ status: 1, createdAt: -1 });
transactionSchema.index({ taskerId: 1, status: 1 });
transactionSchema.index({ clientId: 1 });
transactionSchema.index({ taskId: 1 });
transactionSchema.index({ 'taskerPayout.status': 1 });
transactionSchema.index({ stripePaymentIntentId: 1 });
transactionSchema.index({ transactionId: 1 });

// ========== AUTO-GENERATE TRANSACTION ID ==========
transactionSchema.pre('validate', async function (next) {
    if (!this.transactionId) {
        this.transactionId = generateTransactionId();
    }
    next();
});

// Also add a pre-save hook as backup
transactionSchema.pre('save', async function (next) {
    if (!this.transactionId) {
        this.transactionId = generateTransactionId();
    }
    next();
});

// Function to generate unique transaction ID
function generateTransactionId() {
    const date = new Date();
    const prefix = 'TXN';
    const year = date.getFullYear().toString().slice(-2);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();

    return `${prefix}-${year}${month}${day}-${timestamp}-${random}`;
}

// Static method to generate ID (can be called manually)
transactionSchema.statics.generateId = function () {
    return generateTransactionId();
};

// Virtual for display amounts (convert cents to dollars)
transactionSchema.virtual('displayAmounts').get(function () {
    return {
        total: (this.amounts.total / 100).toFixed(2),
        platformFee: (this.amounts.platformFee / 100).toFixed(2),
        taskerEarnings: (this.amounts.taskerEarnings / 100).toFixed(2)
    };
});

// Clear cached model if it exists
if (mongoose.models.Transaction) {
    delete mongoose.models.Transaction;
}

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;