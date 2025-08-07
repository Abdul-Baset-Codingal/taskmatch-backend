import mongoose from "mongoose";

// Service Schema (to match User schema's service structure)
const ServiceSchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    hourlyRate: { type: Number, required: true },
    estimatedDuration: { type: String, required: true },
});

// Booking Schema
const BookingSchema = new Schema(
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

// RequestQuote Schema
const RequestQuoteSchema = new Schema(
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
        taskTitle: { type: String, required: true },
        taskDescription: { type: String, required: true },
        location: { type: String, required: true },
        budget: { type: Number, default: null },
        preferredDateTime: { type: Date, default: null },
        urgency: {
            type: String,
            enum: ["Flexible - Whenever works", "Within a week", "As soon as possible"],
            default: "Flexible - Whenever works",
        },
        status: {
            type: String,
            enum: ["pending", "responded", "accepted", "declined"],
            default: "pending",
        },
    },
    { timestamps: true }
);

// Export Mongoose models
module.exports = {
    Booking: mongoose.models.Booking || mongoose.model("Booking", BookingSchema),
    RequestQuote: mongoose.models.RequestQuote || mongoose.model("RequestQuote", RequestQuoteSchema),
};