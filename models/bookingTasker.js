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
    },
    { timestamps: true }
);

const BookingTasker = mongoose.models.BookingTasker || mongoose.model("BookingTasker", BookingTaskerSchema);

export default BookingTasker;