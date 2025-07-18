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
      enum: ["Today", "Schedule", "Urgent"],
      required: true,
    },
    extraCharge: { type: Boolean, default: false },
    price: { type: Number },
    additionalInfo: { type: String },
    offerDeadline: { type: Date, required: true },
    status: {
      type: String,
      enum: ["pending", "in progress", "completed", "requested" , "not completed"],
      default: "pending",
    },

    // ✅ Updated client field
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
  { timestamps: true }
);

const Task = mongoose.model("Task", TaskSchema);
export default Task;
