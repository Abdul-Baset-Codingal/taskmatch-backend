
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
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: { type: Date },
    // Optional: for moderation / reporting abusive messages
    isBlocked: { type: Boolean, default: false },
    blockReason: { type: String },
    edited: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);



const TaskSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true },
    serviceTitle: { type: String, required: true },
    taskTitle: { type: String, required: true },
    taskDescription: { type: String, required: true },

    location: { type: String, required: true },
    photos: {
      type: [String],
      validate: [arr => arr.length <= 3, "Maximum 3 photos allowed"],
    },
    video: { type: String },
    schedule: {
      type: String,
      enum: ["Flexible", "Schedule"],
      required: true,
    },
    estimatedTime: {
      type: String,
      set: (v) => String(v), // Convert to string
    },
    extraCharge: { type: Boolean, default: false },
    price: { type: Number, required: true },
    totalAmount: { type: Number },
    additionalInfo: { type: String },
    offerDeadline: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in progress", "completed", "requested", "not completed", "declined"],
      default: "pending",
    },
    stripeStatus: { // New: Track Stripe state
      type: String,
      enum: ["pending", "authorized", "captured", "canceled"],
      default: "pending",
    },
    paymentIntentId: { type: String },
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
    comments: [
      {
        userId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        role: {
          type: String,
          enum: ["tasker", "client"],
          required: true,
        },
        message: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        isBlocked: { type: Boolean, default: false }, // ← ADD THIS
        blockReason: { type: String },
        replies: [
          {
            userId: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            role: {
              type: String,
              enum: ["tasker", "client"],
              required: true,
            },
            message: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
            isBlocked: { type: Boolean, default: false }, // ← ADD THIS TOO
            blockReason: { type: String },
          },
        ],
      },
    ],
    bids: [
      {
        taskerId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        offerPrice: { type: Number },
        message: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    messages: [MessageSchema],
  },

  { timestamps: true, strict: true }
);

// Clear cached model
if (mongoose.models.Task) {
  delete mongoose.models.Task;
}
export default mongoose.model("Task", TaskSchema);