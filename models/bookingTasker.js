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
        service: ServiceSchema,
        date: {
            type: Date,
            required: [true, "Booking date and time are required"],
            validate: {
                validator: async function (value) {
                    const tasker = await mongoose.models.User.findById(this.tasker);
                    if (!tasker || !tasker.availability) return false;

                    const bookingDate = new Date(value);
                    const dayName = bookingDate.toLocaleString('en-US', { weekday: 'long' });
                    const hours = bookingDate.getHours();
                    const minutes = bookingDate.getMinutes();

                    const availability = tasker.availability.find(slot => slot.day === dayName);
                    if (!availability) return false;

                    const [startHour, startMinute] = availability.from.split(':').map(Number);
                    const [endHour, endMinute] = availability.to.split(':').map(Number);
                    const bookingTimeInMinutes = hours * 60 + minutes;
                    const startTimeInMinutes = startHour * 60 + startMinute;
                    const endTimeInMinutes = endHour * 60 + endMinute;

                    return bookingTimeInMinutes >= startTimeInMinutes && bookingTimeInMinutes < endTimeInMinutes;
                },
                message: "Booking date and time must be within tasker's availability",
            },
        },
        status: {
            type: String,
            enum: ["pending", "confirmed", "cancelled", "completed"],
            default: "pending",
        },
        // Payment Fields - ADD THESE
        paymentIntentId: {
            type: String,
            default: null,
            sparse: true, // Allows null values but ensures uniqueness for non-null values
        },
        totalAmount: {
            type: Number,
            required: true,
            min: [0, "Total amount cannot be negative"],
        },
        stripeStatus: {
            type: String,
            enum: ["pending", "succeeded", "failed", "canceled", "requires_payment_method"],
            default: "pending",
        },
        paymentMethod: {
            type: String,
            default: null,
        },
        // Optional: Store payment details for records
        paymentDetails: {
            amountCaptured: { type: Number, default: 0 },
            currency: { type: String, default: "usd" },
            paymentMethodType: { type: String },
            billingDetails: {
                name: { type: String },
                email: { type: String },
                phone: { type: String },
            }
        },
        // Optional: Refund information
        refundStatus: {
            type: String,
            enum: ["none", "requested", "processed", "failed"],
            default: "none",
        },
        refundAmount: {
            type: Number,
            default: 0,
        },
    },
    { timestamps: true }
);

// Index for better query performance
BookingTaskerSchema.index({ tasker: 1, date: 1 });
BookingTaskerSchema.index({ client: 1, date: 1 });
BookingTaskerSchema.index({ status: 1 });
BookingTaskerSchema.index({ paymentIntentId: 1 }, { sparse: true });

// Virtual for formatted date
BookingTaskerSchema.virtual('formattedDate').get(function () {
    return this.date.toLocaleString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
});

// Virtual for duration (if you want to calculate based on estimatedDuration)
BookingTaskerSchema.virtual('durationInHours').get(function () {
    const duration = this.service.estimatedDuration;
    const match = duration.match(/(\d+)\s*hour/);
    return match ? parseInt(match[1]) : 1; // Default to 1 hour if not specified
});

// Method to check if booking can be cancelled
BookingTaskerSchema.methods.canBeCancelled = function () {
    const now = new Date();
    const bookingTime = new Date(this.date);
    const timeDiff = bookingTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    // Allow cancellation up to 24 hours before booking
    return hoursDiff > 24 && this.status === 'confirmed';
};

// Method to calculate refund amount
BookingTaskerSchema.methods.calculateRefundAmount = function () {
    if (!this.canBeCancelled()) {
        return 0; // No refund if cancellation is too late
    }

    const now = new Date();
    const bookingTime = new Date(this.date);
    const timeDiff = bookingTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);

    if (hoursDiff > 48) {
        return this.totalAmount; // Full refund if more than 48 hours
    } else if (hoursDiff > 24) {
        return this.totalAmount * 0.5; // 50% refund if 24-48 hours
    } else {
        return 0; // No refund if less than 24 hours
    }
};

// Pre-save middleware to set totalAmount from service
BookingTaskerSchema.pre('save', function (next) {
    if (this.service && this.service.hourlyRate && !this.totalAmount) {
        this.totalAmount = this.service.hourlyRate;
    }
    next();
});

const BookingTasker = mongoose.models.BookingTasker || mongoose.model("BookingTasker", BookingTaskerSchema);

export default BookingTasker;