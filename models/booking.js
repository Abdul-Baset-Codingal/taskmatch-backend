import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },

    urgency: {
        type: String,
        enum: ["urgent", "schedule"],
        required: true,
    },
    mechanic: {
        type: String,
        required: true,
    },
    date: {
        type: String,
        required: true,
    },
    time: {
        type: String,
        required: true,
    },
    serviceType: {
        type: String,
        required: true,
    },
    serviceDetails: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

export default mongoose.model("Booking", bookingSchema);
