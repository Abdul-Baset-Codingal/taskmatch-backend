// controllers/booking.controller.js
import Booking from "../models/booking.js";
import BookingTasker from '../models/bookingTasker.js';
import { createNotification } from "./notificationHelper.js";
// Create

export const createBooking = async (req, res) => {
    try {
        console.log('Raw Request Body:', JSON.stringify(req.body, null, 2)); // Debug raw body
        const { taskerId, service, date } = req.body;
        const clientId = req.user?.id;

        if (!clientId) {
            console.log('No clientId found in req.user');
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
            return res.status(400).json({ message: "Service details are required" });
        }

        if (!date) {
            console.log('Date missing in request body');
            return res.status(400).json({ message: "Booking date and time are required" });
        }

        const bookingDate = new Date(date);
        console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString()); // Debug
        if (isNaN(bookingDate.getTime())) {
            console.log('Invalid date format:', date);
            return res.status(400).json({ message: "Invalid date format" });
        }

        const tasker = await mongoose.models.User.findById(taskerId);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.role !== "client") {
            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        // Validate date and time against tasker's availability
        const dayName = bookingDate.toLocaleString('en-US', { weekday: 'long' });
        const hours = bookingDate.getHours();
        const minutes = bookingDate.getMinutes();
        const availability = tasker.availability.find(slot => slot.day === dayName);

        if (!availability) {
            return res.status(400).json({ message: `Tasker is not available on ${dayName}` });
        }

        const [startHour, startMinute] = availability.from.split(':').map(Number);
        const [endHour, endMinute] = availability.to.split(':').map(Number);
        const bookingTimeInMinutes = hours * 60 + minutes;
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;

        if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
            return res.status(400).json({ message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}` });
        }

        console.log('Creating Booking with:', { tasker: taskerId, client: clientId, service, date: bookingDate, status: "pending" }); // Debug
        const booking = new BookingTasker({
            tasker: taskerId,
            client: clientId,
            service,
            date: bookingDate,
            status: "pending",
        });

        await booking.save();

        const populatedBooking = await BookingTasker.findById(booking._id)
            .populate("tasker", "firstName lastName email phone profilePicture role")
            .populate("client", "firstName lastName phone role");

        // Create notification for the tasker (new booking request) - non-blocking
        try {
            await createNotification(
                taskerId, // Notify the tasker
                "New Booking Request",
                `"${client.firstName} ${client.lastName}" has booked "${service.title}" for ${date}. Review and confirm.`,
                "booking-request",
                booking._id // Link to booking for details
            );
            console.log("Notification created for new booking"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Booking created successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ message: "Server error" });
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

// controllers/bookingController.js
export const getBookingsByTaskerId = async (req, res) => {
    try {
        const taskerId = req.params.taskerId;
        const bookings = await Booking.find({ tasker: taskerId });
        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ message: "No bookings found for this tasker" });
        }
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};


// Update
// export const updateBooking = async (req, res) => {
//     try {
//         const updated = await Booking.findByIdAndUpdate(
//             req.params.id,
//             req.body,
//             { new: true }
//         );
//         if (!updated) return res.status(404).json({ message: "Booking not found" });
//         res.json(updated);
//     } catch (error) {
//         res.status(400).json({ error: error.message });
//     }
// };



// // controllers/bookingController.js
// export const updateBookingStatus = async (req, res) => {
//     try {
        
//         const { bookingId } = req.params;
//         const { status } = req.body;

//         // Validate status
//         const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ message: "Invalid status value" });
//         }

//         const booking = await Booking.findById(bookingId);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Optional: Ensure the tasker is authorized to update this booking
//         if (booking.tasker.toString() !== req.user._id) {
//             return res.status(403).json({ message: "Unauthorized to update this booking" });
//         }

//         booking.status = status;
//         booking.updatedAt = new Date();
//         await booking.save();

//         res.json({ message: "Booking status updated successfully", booking });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };

// // Delete
// export const deleteBooking = async (req, res) => {
//     try {
//         const deleted = await booking.findByIdAndDelete(req.params.id);
//         if (!deleted) return res.status(404).json({ message: "Booking not found" });
//         res.json({ message: "Booking deleted successfully" });
//     } catch (error) {
//         res.status(500).json({ error: error.message });
//     }
// };


// General update booking
export const updateBooking = async (req, res) => {
    try {
        const updated = await Booking.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );
        if (!updated) return res.status(404).json({ message: "Booking not found" });

        // Create notification for the update (non-blocking) - notify the other party (tasker/client)
        try {
            const updaterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = updaterRole === "client" ? updated.tasker : updated.client;
            const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
            await createNotification(
                otherPartyId,
                "Booking Updated",
                `${updaterRole === "client" ? "Client" : "Tasker"} updated the booking "${updated.service?.title || 'Booking'}". Check details.`,
                "booking-updated",
                updated._id
            );
            console.log("Notification created for booking update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.json(updated);
    } catch (error) {
        console.error("Update booking error:", error);
        res.status(400).json({ error: error.message });
    }
};

// Update booking status
export const updateBookingStatus = async (req, res) => {
    try {
        const { bookingId } = req.params;
        const { status } = req.body;

        // Validate status
        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const booking = await Booking.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Optional: Ensure the tasker is authorized to update this booking
        if (booking.tasker.toString() !== req.user._id) {
            return res.status(403).json({ message: "Unauthorized to update this booking" });
        }

        const previousStatus = booking.status;
        booking.status = status;
        booking.updatedAt = new Date();
        await booking.save();

        // Create notification based on status change (non-blocking)
        try {
            let title, message, type;
            switch (status) {
                case "confirmed":
                    title = "Booking Confirmed";
                    message = `Your booking "${booking.service?.title || 'Booking'}" has been confirmed by the tasker for ${booking.date}.`;
                    type = "booking-confirmed";
                    break;
                case "cancelled":
                    title = "Booking Cancelled";
                    message = `Booking "${booking.service?.title || 'Booking'}" has been cancelled (previous: ${previousStatus}).`;
                    type = "booking-cancelled";
                    break;
                case "completed":
                    title = "Booking Completed";
                    message = `Booking "${booking.service?.title || 'Booking'}" has been marked as completed. Please leave a review.`;
                    type = "booking-completed";
                    break;
                default:
                    title = "Booking Status Updated";
                    message = `Booking status changed from ${previousStatus} to ${status}.`;
                    type = "booking-status-changed";
            }

            // Notify the client (booking poster)
            await createNotification(
                booking.client,
                title,
                message,
                type,
                booking._id
            );
            console.log("Notification created for booking status update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.json({ message: "Booking status updated successfully", booking });
    } catch (error) {
        console.error("Update booking status error:", error);
        res.status(500).json({ error: error.message });
    }
};

// Delete booking
export const deleteBooking = async (req, res) => {
    try {
        const deleted = await Booking.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ message: "Booking not found" });

        // Create notification for the deletion (non-blocking) - notify the other party
        try {
            const deleterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = deleterRole === "client" ? deleted.tasker : deleted.client;
            const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
            await createNotification(
                otherPartyId,
                "Booking Deleted",
                `The booking "${deleted.service?.title || 'Booking'}" has been deleted by the ${otherPartyName.toLowerCase()}.`,
                "booking-deleted",
                deleted._id
            );
            console.log("Notification created for booking deletion"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Delete booking error:", error);
        res.status(500).json({ error: error.message });
    }
};