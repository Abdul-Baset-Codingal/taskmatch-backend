// controllers/booking.controller.js
import Booking from "../models/booking.js";

// Create
export const createBooking = async (req, res) => {
    try {
        const userId = req.user?._id;
        const {
            urgency,
            mechanic,
            date,
            time,
            serviceType,
            serviceDetails,
        } = req.body;

        console.log(req.body, userId)

        const bookings = await Booking.create({
            user: userId,
            urgency,
            mechanic,
            date,
            time,
            serviceType,
            serviceDetails,
        });

        const populatedBooking = await bookings.populate({
            path: 'user',
            select: 'fullName email phone',
        });

        res.status(201).json(populatedBooking);

    } catch (error) {
        res.status(500).json({ error: "Failed to create booking", details: error });
        console.log(error)
    }
};

// Read All
export const getAllBookings = async (req, res) => {
    try {
        const bookings = await Booking.find().sort({ createdAt: -1 });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Read One
export const getBookingById = async (req, res) => {
    try {
        const bookings = await Booking.findById(req.params.id);
        if (!bookings) return res.status(404).json({ message: "Booking not found" });
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Update
export const updateBooking = async (req, res) => {
    try {
        const updated = await Booking.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: "Booking not found" });
        res.json(updated);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

// Delete
export const deleteBooking = async (req, res) => {
    try {
        const deleted = await booking.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Booking not found" });
        res.json({ message: "Booking deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
