import mongoose from "mongoose";

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
      enum: ["Flexible", "Schedule", "Urgent"],
      required: true,
    },
    estimatedTime: {
      type: String,
      set: (v) => String(v), // Convert to string
    },
    extraCharge: { type: Boolean, default: false },
    price: { type: Number, required: true },
    additionalInfo: { type: String },
    offerDeadline: { type: Date },
    status: {
      type: String,
      enum: ["pending", "in progress", "completed", "requested", "not completed" , "declined"],
      default: "pending",
    },
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
  },
  { timestamps: true, strict: true }
);

// Clear cached model
if (mongoose.models.Task) {
  delete mongoose.models.Task;
}
export default mongoose.model("Task", TaskSchema);