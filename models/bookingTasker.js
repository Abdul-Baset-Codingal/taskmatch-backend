import mongoose from "mongoose";

const { Schema } = mongoose;

// Service Schema
const ServiceSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    estimatedDuration: { type: String, required: true },
}, { _id: false });

// BookingTasker Schema
const BookingTaskerSchema = new Schema(
    {
        tasker: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            validate: {
                validator: async function (value) {
                    const user = await mongoose.models.User.findById(value);
                    return user && user.role === "tasker";
                },
                message: "Tasker must be a user with role 'tasker'",
            },
        },
        client: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            validate: {
                validator: async function (value) {
                    const user = await mongoose.models.User.findById(value);
                    return user && user.role === "client";
                },
                message: "Client must be a user with role 'client'",
            },
        },
        service: ServiceSchema,
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },
    },
    { timestamps: true }
);

const BookingTasker = mongoose.models.BookingTasker || mongoose.model("BookingTasker", BookingTaskerSchema);

export default BookingTasker;
