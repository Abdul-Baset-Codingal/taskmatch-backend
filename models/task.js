// // models/Task.js
// import mongoose from "mongoose";

// const MessageSchema = new mongoose.Schema(
//   {
//     sender: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     senderRole: {
//       type: String,
//       enum: ["client", "tasker"],
//       required: true,
//     },
//     message: {
//       type: String,
//       required: true,
//       trim: true,
//       maxlength: [5000, "Message too long"],
//     },
//     isRead: {
//       type: Boolean,
//       default: false,
//     },
//     readAt: { type: Date },
//     isBlocked: { type: Boolean, default: false },
//     blockReason: { type: String },
//     edited: { type: Boolean, default: false },
//     isDeleted: { type: Boolean, default: false },
//   },
//   { timestamps: true }
// );

// const TaskSchema = new mongoose.Schema(
//   {
//     serviceId: { type: String, required: true },
//     serviceTitle: { type: String, required: true },
//     taskTitle: { type: String, required: true },
//     taskDescription: { type: String, required: true },

//     location: { type: String, required: true },
//     photos: {
//       type: [String],
//       validate: [arr => arr.length <= 3, "Maximum 3 photos allowed"],
//     },
//     video: { type: String },
//     schedule: {
//       type: String,
//       enum: ["Flexible", "Schedule"],
//       required: true,
//     },
//     estimatedTime: {
//       type: String,
//       set: (v) => String(v),
//     },
//     extraCharge: { type: Boolean, default: false },
//     price: { type: Number, required: true },
//     totalAmount: { type: Number },
//     additionalInfo: { type: String },
//     offerDeadline: { type: Date },

//     status: {
//       type: String,
//       enum: ["pending", "in progress", "completed", "requested", "not completed", "declined"],
//       default: "pending",
//     },
//     stripeStatus: {
//       type: String,
//       enum: ["pending", "authorized", "captured", "canceled"],
//       default: "pending",
//     },
//     paymentIntentId: { type: String },

//     client: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       required: true,
//     },
//     acceptedBy: {
//       type: mongoose.Schema.Types.ObjectId,
//       ref: "User",
//       default: null,
//     },

//     // ✅ NEW: Accepted Bid Details
//     acceptedBidAmount: {
//       type: Number,
//       default: null,
//     },
//     acceptedBidMessage: {
//       type: String,
//       default: null,
//     },
//     acceptedAt: {
//       type: Date,
//       default: null,
//     },
//     // Full accepted bid object for reference
//     acceptedBid: {
//       taskerId: {
//         type: mongoose.Schema.Types.ObjectId,
//         ref: "User",
//       },
//       offerPrice: Number,
//       message: String,
//       acceptedAt: Date,
//     },

//     comments: [
//       {
//         userId: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "User",
//           required: true,
//         },
//         role: {
//           type: String,
//           enum: ["tasker", "client"],
//           required: true,
//         },
//         firstName: { type: String },
//         lastName: { type: String },
//         profilePicture: { type: String },
//         message: { type: String, required: true },
//         createdAt: { type: Date, default: Date.now },
//         isBlocked: { type: Boolean, default: false },
//         blockReason: { type: String },
//         replies: [
//           {
//             userId: {
//               type: mongoose.Schema.Types.ObjectId,
//               ref: "User",
//               required: true,
//             },
//             role: {
//               type: String,
//               enum: ["tasker", "client"],
//               required: true,
//             },
//             firstName: { type: String },
//             lastName: { type: String },
//             profilePicture: { type: String },
//             message: { type: String, required: true },
//             createdAt: { type: Date, default: Date.now },
//             isBlocked: { type: Boolean, default: false },
//             blockReason: { type: String },
//           },
//         ],
//       },
//     ],
//     bids: [
//       {
//         taskerId: {
//           type: mongoose.Schema.Types.ObjectId,
//           ref: "User",
//           required: true,
//         },
//         offerPrice: { type: Number },
//         message: { type: String },
//         createdAt: { type: Date, default: Date.now },
//       },
//     ],
//     messages: [MessageSchema],
//   },
//   { timestamps: true, strict: true }
// );

// // Indexes for better performance
// TaskSchema.index({ client: 1, status: 1 });
// TaskSchema.index({ acceptedBy: 1, status: 1 });
// TaskSchema.index({ status: 1, createdAt: -1 });

// // Clear cached model
// if (mongoose.models.Task) {
//   delete mongoose.models.Task;
// }

// export default mongoose.model("Task", TaskSchema);

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
    price: { type: Number, required: true },           // Client's budget
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
    acceptedAt: { type: Date, default: null },

    // ==================== BIDS ====================
    bids: [BidSchema],

    // ==================== PAYMENT - STRIPE CONNECT ====================
    payment: {
      // Stripe IDs
      paymentIntentId: { type: String },
      transferId: { type: String },           // Transfer to tasker
      chargeId: { type: String },

      // Status
      status: {
        type: String,
        enum: ["pending", "held", "captured", "refunded", "failed", "cancelled"],
        default: "pending",
      },

      // Amounts (in cents for precision)
      grossAmount: { type: Number },          // Total amount charged to client
      platformFee: { type: Number },          // 15% to Taskallo
      taskerPayout: { type: Number },         // 85% to Tasker
      stripeFee: { type: Number },            // Stripe processing fee

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