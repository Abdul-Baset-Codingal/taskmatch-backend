import mongoose from "mongoose";

const { Schema } = mongoose;

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
                    return user && user.currentRole === "tasker";
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
                    return user && user.currentRole === "client";
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
            enum: ["pending", "accepted", "rejected", "completed"

                
            ],
            default: "pending",
        },
    },
    { timestamps: true }
);

const RequestQuote = mongoose.model("RequestQuote", RequestQuoteSchema);
export default RequestQuote;