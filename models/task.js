

// models/Task.js
import mongoose from "mongoose";

const MessageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    senderRole: {
      type: String,
      enum: ["client", "tasker"],
      required: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: [5000, "Message too long"],
    },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String },
    edited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const BidSchema = new mongoose.Schema({
  taskerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  offerPrice: { type: Number, required: true },
  message: { type: String },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected", "withdrawn"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
});

// ⭐ NEW: Payment Schema with full fee breakdown
const PaymentSchema = new mongoose.Schema({
  // ─── STRIPE IDs ───
  paymentIntentId: { type: String },
  transferId: { type: String },
  chargeId: { type: String },

  // ─── STATUS ───
  status: {
    type: String,
    enum: ["pending", "held", "captured", "released", "refunded", "failed", "cancelled"],
    default: "pending",
  },

  // ─── FEE STRUCTURE TYPE ───
  feeStructure: {
    type: String,
    default: "client-10-5-13_tasker-12-13"
  },

  // ─── BID AMOUNT (Base) ───
  bidAmount: { type: Number },              // Original bid amount in dollars
  bidAmountCents: { type: Number },         // Original bid amount in cents

  // ─── CLIENT SIDE FEES (Added to bid) ───
  clientPlatformFee: { type: Number },      // 10% of bid (dollars)
  clientPlatformFeeCents: { type: Number }, // 10% of bid (cents)

  reservationFee: { type: Number },         // $5 flat fee (dollars)
  reservationFeeCents: { type: Number },    // $5 flat fee (cents)

  clientTax: { type: Number },              // 13% HST (dollars)
  clientTaxCents: { type: Number },         // 13% HST (cents)

  totalClientPays: { type: Number },        // Total client pays (dollars)
  totalClientPaysCents: { type: Number },   // Total client pays (cents)

  // ─── TASKER SIDE FEES (Deducted from bid) ───
  taskerPlatformFee: { type: Number },      // 12% of bid (dollars)
  taskerPlatformFeeCents: { type: Number }, // 12% of bid (cents)

  taskerTax: { type: Number },              // 13% tax (dollars)
  taskerTaxCents: { type: Number },         // 13% tax (cents)

  taskerPayout: { type: Number },           // What tasker receives (dollars)
  taskerPayoutCents: { type: Number },      // What tasker receives (cents)

  // ─── PLATFORM REVENUE ───
  applicationFee: { type: Number },         // Total platform keeps (dollars)
  applicationFeeCents: { type: Number },    // Total platform keeps (cents)

  // ─── LEGACY FIELDS (for backwards compatibility) ───
  grossAmount: { type: Number },            // Alias for totalClientPays
  platformFee: { type: Number },            // Alias for applicationFee
  stripeFee: { type: Number },              // Stripe processing fee

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

const TaskSchema = new mongoose.Schema(
  {
    // ==================== BASIC INFO ====================
    serviceId: { type: String, required: true },
    serviceTitle: { type: String, required: true },
    taskTitle: { type: String, required: true },
    taskDescription: { type: String, required: true },
    location: { type: String, required: true },

    // ==================== MEDIA ====================
    photos: {
      type: [String],
      validate: [arr => arr.length <= 3, "Maximum 3 photos allowed"],
    },
    video: { type: String },

    // ==================== SCHEDULE ====================
    schedule: {
      type: String,
      enum: ["Flexible", "Schedule"],
      required: true,
    },
    estimatedTime: {
      type: String,
      set: (v) => String(v),
    },
    offerDeadline: { type: Date },

    // ==================== PRICING ====================
    price: { type: Number, required: true },
    extraCharge: { type: Boolean, default: false },
    additionalInfo: { type: String },

    // ==================== STATUS ====================
    status: {
      type: String,
      enum: ["pending", "in progress", "completed", "requested", "not completed", "declined", "cancelled"],
      default: "pending",
    },

    // ==================== PARTIES ====================
    client: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ==================== ACCEPTED BID ====================
    acceptedBid: {
      bidId: { type: mongoose.Schema.Types.ObjectId },
      taskerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      offerPrice: Number,
      message: String,
      acceptedAt: Date,
    },
    acceptedBidAmount: { type: Number, default: null },
    acceptedBidMessage: { type: String, default: null },
    acceptedAt: { type: Date, default: null },

    // ==================== BIDS ====================
    bids: [BidSchema],

    // ==================== ⭐ PAYMENT - NEW STRUCTURE ====================
    payment: PaymentSchema,

    // ==================== LEGACY PAYMENT FIELDS ====================
    stripeStatus: {
      type: String,
      enum: ["pending", "authorized", "captured", "canceled"],
      default: "pending",
    },
    paymentIntentId: { type: String },
    totalAmount: { type: Number },

    // ==================== COMPLETION ====================
    completedAt: { type: Date },
    completionNotes: { type: String },
    clientConfirmedAt: { type: Date },
    taskerConfirmedAt: { type: Date },

    // ==================== COMMENTS & MESSAGES ====================
    comments: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["tasker", "client"], required: true },
        firstName: { type: String },
        lastName: { type: String },
        profilePicture: { type: String },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        isBlocked: { type: Boolean, default: false },
        blockReason: { type: String },
        replies: [
          {
            userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
            role: { type: String, enum: ["tasker", "client"], required: true },
            firstName: { type: String },
            lastName: { type: String },
            profilePicture: { type: String },
            message: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            isBlocked: { type: Boolean, default: false },
            blockReason: { type: String },
          },
        ],
      },
    ],
    messages: [MessageSchema],

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
  { timestamps: true, strict: true }
);

// Indexes
TaskSchema.index({ client: 1, status: 1 });
TaskSchema.index({ acceptedBy: 1, status: 1 });
TaskSchema.index({ status: 1, createdAt: -1 });
TaskSchema.index({ "payment.paymentIntentId": 1 });
TaskSchema.index({ paymentIntentId: 1 });

if (mongoose.models.Task) {
  delete mongoose.models.Task;
}

export default mongoose.model("Task", TaskSchema);