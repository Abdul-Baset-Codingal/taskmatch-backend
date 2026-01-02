// models/PasswordReset.js
import mongoose from "mongoose";

const passwordResetSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    otp: {
        type: String,
        required: true
    },
    resetToken: String,
    expires: {
        type: Date,
        required: true
    },
    tokenExpires: Date,
    attempts: {
        type: Number,
        default: 0
    },
    otpVerified: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

// Auto-delete documents after 1 hour
passwordResetSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

const PasswordReset = mongoose.model("PasswordReset", passwordResetSchema);

export default PasswordReset;