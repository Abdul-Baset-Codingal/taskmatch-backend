import mongoose from "mongoose";
import BookingTasker from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import User from "../models/user.js";
import { createNotification } from "./notificationHelper.js";
// Create Booking
// const createBooking = async (req, res) => {
//     try {
//         console.log('Raw Request Body:', JSON.stringify(req.body, null, 2)); // Debug raw body
//         const { taskerId, service, date } = req.body;
//         const clientId = req.user?.id;

//         if (!clientId) {
//             console.log('No clientId found in req.user');
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
//             return res.status(400).json({ message: "Service details are required" });
//         }

//         if (!date) {
//             console.log('Date missing in request body');
//             return res.status(400).json({ message: "Booking date and time are required" });
//         }

//         const bookingDate = new Date(date);
//         console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString()); // Debug
//         if (isNaN(bookingDate.getTime())) {
//             console.log('Invalid date format:', date);
//             return res.status(400).json({ message: "Invalid date format" });
//         }

//         const tasker = await mongoose.models.User.findById(taskerId);
//         if (!tasker || tasker.role !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await mongoose.models.User.findById(clientId);
//         if (!client || client.role !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         // Validate date and time against tasker's availability
//         const dayName = bookingDate.toLocaleString('en-US', { weekday: 'long' });
//         const hours = bookingDate.getHours();
//         const minutes = bookingDate.getMinutes();
//         const availability = tasker.availability.find(slot => slot.day === dayName);

//         if (!availability) {
//             return res.status(400).json({ message: `Tasker is not available on ${dayName}` });
//         }

//         const [startHour, startMinute] = availability.from.split(':').map(Number);
//         const [endHour, endMinute] = availability.to.split(':').map(Number);
//         const bookingTimeInMinutes = hours * 60 + minutes;
//         const startTimeInMinutes = startHour * 60 + startMinute;
//         const endTimeInMinutes = endHour * 60 + endMinute;

//         if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
//             return res.status(400).json({ message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}` });
//         }

//         console.log('Creating Booking with:', { tasker: taskerId, client: clientId, service, date: bookingDate, status: "pending" }); // Debug
//         const booking = new BookingTasker({
//             tasker: taskerId,
//             client: clientId,
//             service,
//             date: bookingDate,
//             status: "pending",
//         });

//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(booking._id)
//             .populate("tasker", "firstName lastName email phone profilePicture role")
//             .populate("client", "firstName lastName phone role");

//         res.status(201).json({ message: "Booking created successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error creating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

// export default createBooking;

 const createBooking = async (req, res) => {
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
        if (!tasker || tasker.currentRole !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.currentRole !== "client") {
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
                `"${client.firstName} ${client.lastName}" has booked your service "${service.title}" for ${date}. Please review and confirm.`,
                "booking-request",
                booking._id // Link to booking
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

// Get All Bookings
const getAllBookings = async (req, res) => {
    try {
        const bookings = await BookingTasker.find()
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");
        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get Booking By ID
const getBookingsByUserId = async (req, res) => {
    try {
        const { userId } = req.params;

        const bookings = await BookingTasker.find({ client: userId })
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update Booking
// const updateBooking = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, service } = req.body;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }
//         const booking = await BookingTasker.findById(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }
//         if (status) booking.status = status;
//         if (service) booking.service = service;
//         await booking.save();
//         const populatedBooking = await Booking.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");
//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


// export const addReview = async (req, res) => {
//     try {
//         const { bookingId, rating, message } = req.body;
//         const clientId = req.user._id;

//         console.log('Client ID:', clientId, 'Booking ID:', bookingId); // Debug: Log IDs
//         // Validate input
//         if (!bookingId || !rating || !message) {
//             return res.status(400).json({ message: "Booking ID, rating, and message are required" });
//         }

//         if (rating < 0 || rating > 5) {
//             return res.status(400).json({ message: "Rating must be between 0 and 5" });
//         }

//         // Find the booking

//         const booking = await BookingTasker.findById(bookingId);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         console.log(booking.client.toString())

//         console.log('Booking Client ID:', booking.client.toString()); // Debug: Log booking client ID

//         // Check if the booking is completed and the client is authorized
//         if (booking.status !== "completed") {
//             return res.status(400).json({ message: "Reviews can only be added for completed bookings" });
//         }
//         if (booking.client.toString() !== clientId.toString()
//         ) {
//             return res.status(403).json({ message: "You are not authorized to review this booking" });
//         }

//         // Check if a review already exists
//         if (booking.review) {
//             return res.status(400).json({ message: "A review has already been submitted for this booking" });
//         }

//         // Find the tasker
//         const tasker = await User.findById(booking.tasker);
//         if (!tasker || tasker.role !== "tasker") {
//             return res.status(404).json({ message: "Tasker not found" });
//         }

//         // Add the review to the booking
//         booking.review = {
//             reviewer: clientId,
//             rating,
//             message,
//             createdAt: new Date(),
//         };

//         // Add the review to the tasker's reviews array
//         tasker.reviews.push({
//             reviewer: clientId,
//             rating,
//             message,
//             bookingId, // Link review to booking
//             createdAt: new Date(),
//         });

//         // Update tasker's rating and review count
//         const totalReviews = tasker.reviews.length;
//         const averageRating =
//             tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

//         tasker.rating = parseFloat(averageRating.toFixed(2));
//         tasker.reviewCount = totalReviews;

//         await booking.save();
//         await tasker.save();

//         res.status(201).json({ message: "Review added successfully", review: booking.review });
//     } catch (error) {
//         console.error("Error adding review:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

 const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, service } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }
        const booking = await BookingTasker.findById(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        const previousStatus = booking.status; // Track for notification
        const previousService = booking.service; // Track for notification if changed

        if (status) booking.status = status;
        if (service) booking.service = service;
        await booking.save();

        const populatedBooking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // Create notification for the other party (non-blocking)
        try {
            const updaterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = updaterRole === "client" ? booking.tasker : booking.client;
            const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
            let title = "Booking Updated";
            let message = `${otherPartyName} updated the booking "${booking.service?.title || 'Booking'}"`;
            if (status && status !== previousStatus) {
                message += ` - Status changed to "${status}"`;
            }
            if (service && service.title !== previousService?.title) {
                message += ` - Service changed to "${service.title}"`;
            }
            await createNotification(
                otherPartyId,
                title,
                message,
                "booking-updated",
                booking._id // Link to booking
            );
            console.log("Notification created for booking update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Add review
export const addReview = async (req, res) => {
    try {
        const { bookingId, rating, message } = req.body;
        const clientId = req.user._id;

        console.log('Client ID:', clientId, 'Booking ID:', bookingId); // Debug: Log IDs
        // Validate input
        if (!bookingId || !rating || !message) {
            return res.status(400).json({ message: "Booking ID, rating, and message are required" });
        }

        if (rating < 0 || rating > 5) {
            return res.status(400).json({ message: "Rating must be between 0 and 5" });
        }

        // Find the booking
        const booking = await BookingTasker.findById(bookingId);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        console.log(booking.client.toString())

        console.log('Booking Client ID:', booking.client.toString()); // Debug: Log booking client ID

        // Check if the booking is completed and the client is authorized
        if (booking.status !== "completed") {
            return res.status(400).json({ message: "Reviews can only be added for completed bookings" });
        }
        if (booking.client.toString() !== clientId.toString()
        ) {
            return res.status(403).json({ message: "You are not authorized to review this booking" });
        }

        // Check if a review already exists
        if (booking.review) {
            return res.status(400).json({ message: "A review has already been submitted for this booking" });
        }

        // Find the tasker
        const tasker = await User.findById(booking.tasker);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(404).json({ message: "Tasker not found" });
        }

        // Add the review to the booking
        booking.review = {
            reviewer: clientId,
            rating,
            message,
            createdAt: new Date(),
        };

        // Add the review to the tasker's reviews array
        tasker.reviews.push({
            reviewer: clientId,
            rating,
            message,
            bookingId, // Link review to booking
            createdAt: new Date(),
        });

        // Update tasker's rating and review count
        const totalReviews = tasker.reviews.length;
        const averageRating =
            tasker.reviews.reduce((sum, rev) => sum + rev.rating, 0) / totalReviews;

        tasker.rating = parseFloat(averageRating.toFixed(2));
        tasker.reviewCount = totalReviews;

        await booking.save();
        await tasker.save();

        // Create notification for the tasker (new review) - non-blocking
        try {
            const client = await User.findById(clientId).select("firstName lastName");
            await createNotification(
                tasker._id, // Tasker ID
                "New Review Received",
                `You received a ${rating}-star review from ${client.firstName} ${client.lastName} for booking "${booking.service?.title || 'Booking'}". "${message}"`,
                "review",
                bookingId // Link to booking
            );
            console.log("Notification created for new review"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Review added successfully", review: booking.review });
    } catch (error) {
        console.error("Error adding review:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// controllers/bookingController.js
export const getBookingsByTaskerId = async (req, res) => {
    try {
        const { taskerId } = req.params;

        const bookings = await BookingTasker.find({ tasker: taskerId })
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        if (!bookings || bookings.length === 0) {
            return res.status(404).json({ message: "No bookings found for this tasker" });
        }

        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching tasker bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// controllers/bookingController.js
// export const updateBookingStatus = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status } = req.body;

//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }

//         const booking = await BookingTasker.findById(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Log for debugging
//         console.log("Request Params:", req.params);
//         console.log("Request Body:", req.body);
//         console.log("Authenticated User ID:", req.user._id.toString());
//         console.log("Booking Tasker ID:", booking.tasker.toString());

//         // Ensure only the tasker associated with the booking can update it
//         const userId = req.user._id.toString();
//         const taskerId = booking.tasker.toString();
//         if (taskerId !== userId) {
//             return res.status(403).json({ message: "Unauthorized to update this booking" });
//         }

//         // Validate status
//         const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
//         if (status && !validStatuses.includes(status)) {
//             return res.status(400).json({ message: "Invalid status value" });
//         }

//         if (status) booking.status = status;
//         booking.updatedAt = new Date();
//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


// // Delete Booking
// const deleteBooking = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }
//         const booking = await BookingTasker.findByIdAndDelete(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }
//         res.status(200).json({ message: "Booking deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

// // Create Request Quote
// const createRequestQuote = async (req, res) => {
//     try {
//         const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
//         const clientId = req.user?.id;
//         console.log(clientId)

//         if (!clientId) {
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
//             return res.status(400).json({ message: "Invalid tasker or client ID" });
//         }

//         if (!taskTitle || !taskDescription || !location) {
//             return res.status(400).json({ message: "Task title, description, and location are required" });
//         }

//         const tasker = await mongoose.models.User.findById(taskerId);
//         if (!tasker || tasker.role !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await mongoose.models.User.findById(clientId);
//         if (!client || client.role !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         const requestQuote = new RequestQuote({
//             tasker: taskerId,
//             client: clientId,
//             taskTitle,
//             taskDescription,
//             location,
//             budget: budget || null,
//             preferredDateTime: preferredDateTime ? new Date(preferredDateTime) : null,
//             urgency: urgency || "Flexible - Whenever works",
//             status: "pending",
//         });

//         await requestQuote.save();

//         const populatedRequestQuote = await RequestQuote.findById(requestQuote._id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
//     } catch (error) {
//         console.error("Error creating quote request:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

export const updateBookingStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }

        const booking = await BookingTasker.findById(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Log for debugging
        console.log("Request Params:", req.params);
        console.log("Request Body:", req.body);
        console.log("Authenticated User ID:", req.user._id.toString());
        console.log("Booking Tasker ID:", booking.tasker.toString());

        // Ensure only the tasker associated with the booking can update it
        const userId = req.user._id.toString();
        const taskerId = booking.tasker.toString();
        if (taskerId !== userId) {
            return res.status(403).json({ message: "Unauthorized to update this booking" });
        }

        // Validate status
        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const previousStatus = booking.status; // Track for notification
        if (status) booking.status = status;
        booking.updatedAt = new Date();
        await booking.save();

        const populatedBooking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // Create notification for the client (status updated) - non-blocking
        try {
            const tasker = await User.findById(req.user._id).select("firstName lastName");
            await createNotification(
                booking.client, // Client ID
                "Booking Status Updated",
                `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your booking to "${status}" (from "${previousStatus}").`,
                "booking-status-updated",
                id // Link to booking
            );
            console.log("Notification created for booking status update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete booking
 const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }
        const booking = await BookingTasker.findById(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user._id.toString();
        if (booking.client.toString() !== userId && booking.tasker.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to delete this booking" });
        }

        const deletedBooking = await BookingTasker.findByIdAndDelete(id);

        // Create notification for the other party (non-blocking)
        try {
            const deleterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = deleterRole === "client" ? booking.tasker : booking.client;
            const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
            const deleterName = req.user.firstName + " " + req.user.lastName;
            await createNotification(
                otherPartyId,
                "Booking Deleted",
                `${otherPartyName} "${deleterName}" has deleted the booking "${booking.service?.title || 'Booking'}" for ${booking.date}.`,
                "booking-deleted",
                id // Link to booking (even if deleted)
            );
            console.log("Notification created for booking deletion"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Create request quote
 const createRequestQuote = async (req, res) => {
    try {
        const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
        const clientId = req.user?.id;
        console.log(clientId)

        if (!clientId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!taskTitle || !taskDescription || !location) {
            return res.status(400).json({ message: "Task title, description, and location are required" });
        }

        const tasker = await mongoose.models.User.findById(taskerId);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.role !== "client") {
            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        const requestQuote = new RequestQuote({
            tasker: taskerId,
            client: clientId,
            taskTitle,
            taskDescription,
            location,
            budget: budget || null,
            preferredDateTime: preferredDateTime ? new Date(preferredDateTime) : null,
            urgency: urgency || "Flexible - Whenever works",
            status: "pending",
        });

        await requestQuote.save();

        const populatedRequestQuote = await RequestQuote.findById(requestQuote._id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // Create notification for the tasker (new quote request) - non-blocking
        try {
            await createNotification(
                taskerId, // Notify the tasker
                "New Quote Request",
                `Client "${client.firstName} ${client.lastName}" requested a quote for "${taskTitle}" in ${location}. Budget: $${budget || 'Negotiable'}, Preferred Date: ${preferredDateTime || 'Flexible'}.`,
                "quote-request",
                requestQuote._id // Link to quote request
            );
            console.log("Notification created for new quote request"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error creating quote request:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// ----------------------------------------------------------------

export const getQuotesByTasker = async (req, res) => {
    try {
        const taskerId = req.params.taskerId;
        const userId = req.user?.id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId)) {
            return res.status(400).json({ message: "Invalid tasker ID" });
        }

        // Verify the authenticated user is the tasker
        if (taskerId !== userId) {
            return res.status(403).json({ message: "Forbidden: You can only view your own quotes" });
        }

        const quotes = await RequestQuote.find({ tasker: taskerId })
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role")
            .sort({ createdAt: -1 }); // Sort by most recent

        if (!quotes || quotes.length === 0) {
            return res.status(404).json({ message: "No quotes found for this tasker" });
        }

        res.status(200).json({ message: "Quotes retrieved successfully", quotes });
    } catch (error) {
        console.error("Error fetching quotes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update a quote request
export const updateQuoteRequest = async (req, res) => {
    try {
        const quoteId = req.params.quoteId;
        const userId = req.user?.id;
        const { taskTitle, taskDescription, location, budget, preferredDateTime, urgency, status } = req.body;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: "Invalid quote ID" });
        }

        const quote = await RequestQuote.findById(quoteId);
        if (!quote) {
            return res.status(404).json({ message: "Quote request not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = quote.client.toString() === userId;
        const isTasker = quote.tasker.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Clients can update all fields, taskers can only update status
        if (isClient) {
            if (taskTitle) quote.taskTitle = taskTitle;
            if (taskDescription) quote.taskDescription = taskDescription;
            if (location) quote.location = location;
            if (budget !== undefined) quote.budget = budget;
            if (preferredDateTime) quote.preferredDateTime = new Date(preferredDateTime);
            if (urgency) quote.urgency = urgency;
        }

        if (status) {
            // Validate status
            const validStatuses = ["pending", "accepted", "rejected", "completed"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }
            quote.status = status;
        }

        await quote.save();

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // Create notification for the other party (non-blocking)
        try {
            const updaterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = updaterRole === "client" ? quote.tasker : quote.client;
            const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
            const updaterName = req.user.firstName + " " + req.user.lastName;
            let title = "Quote Request Updated";
            let message = `${otherPartyName} "${updaterName}" updated the quote request "${quote.taskTitle}".`;
            if (status) {
                message += ` Status changed to "${status}".`;
            } else if (taskTitle || taskDescription || location || budget !== undefined || preferredDateTime || urgency) {
                message += " Details have been modified.";
            }
            await createNotification(
                otherPartyId,
                title,
                message,
                "quote-updated",
                quoteId // Link to quote request
            );
            console.log("Notification created for quote update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Quote request updated successfully", requestQuote: populatedQuote });
    } catch (error) {
        console.error("Error updating quote request:", error);
        res.status(500).json({ message: "Server error" });
    }
};





// ---------------------------------------------------------------
// Get All Request Quotes
const getAllRequestQuotes = async (req, res) => {
    try {
        const requestQuotes = await RequestQuote.find()
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");
        res.status(200).json(requestQuotes);
    } catch (error) {
        console.error("Error fetching request quotes:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Controller function
const getRequestQuotesByClientId = async (req, res) => {
    try {
        const { clientId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid client ID" });
        }

        const quotes = await RequestQuote.find({ client: clientId })
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        res.status(200).json(quotes);
    } catch (error) {
        console.error("Error fetching request quotes by client:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get tasks by tasker ID and optional status
export const getTasksByTaskerIdAndStatus = async (req, res) => {
    try {
        const { id } = req.params; // Tasker ID
        const { status } = req.query; // Optional status (e.g., "pending")

        console.log(id, status)

        // Validate tasker ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid tasker ID' });
        }

        // Build query
        const query = { tasker: id }; // Fixed: Use tasker as ObjectId reference
        if (status) {
            if (!['pending', 'responded', 'accepted', 'declined'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status value' });
            }
            query.status = status;
        }

        // Fetch request quotes with populated tasker and client
        const tasks = await RequestQuote.find(query)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role')
            .select('_id taskTitle taskDescription status tasker client budget location preferredDateTime urgency createdAt updatedAt');

        res.status(200).json(tasks);
    } catch (error) {
        console.error('Error fetching request quotes:', error);
        res.status(500).json({ message: 'Server error while fetching request quotes', error: error.message });
    }
};
// Update task status
// export const updateQuoteStatus = async (req, res) => {
//     try {
//         const { taskId } = req.params;
//         const { status } = req.body;
//         const taskerId = req.user.id; // From auth middleware

//         // Validate inputs
//         if (!mongoose.Types.ObjectId.isValid(taskId)) {
//             return res.status(400).json({ message: 'Invalid task ID' });
//         }
//         if (!status) {
//             return res.status(400).json({ message: 'Status is required' });
//         }

//         // Valid statuses
//         const validStatuses = ['pending', 'responded', 'accepted', 'declined'];
//         if (!validStatuses.includes(status)) {
//             return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
//         }

//         // Find task
//         const task = await RequestQuote.findById(taskId);
//         if (!task) {
//             return res.status(404).json({ message: 'Task not found' });
//         }

//         // Verify tasker
//         if (task.tasker.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
//         }

//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };


// // Update Request Quote
// const updateRequestQuote = async (req, res) => {
//     try {
//         const { id } = req.params;
//         const { status, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid request quote ID" });
//         }
//         const requestQuote = await RequestQuote.findById(id);
//         if (!requestQuote) {
//             return res.status(404).json({ message: "Request quote not found" });
//         }
//         if (status) requestQuote.status = status;
//         if (taskTitle) requestQuote.taskTitle = taskTitle;
//         if (taskDescription) requestQuote.taskDescription = taskDescription;
//         if (location) requestQuote.location = location;
//         if (budget !== undefined) requestQuote.budget = budget;
//         if (preferredDateTime) requestQuote.preferredDateTime = new Date(preferredDateTime);
//         if (urgency) requestQuote.urgency = urgency;
//         await requestQuote.save();
//         const populatedRequestQuote = await RequestQuote.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");
//         res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
//     } catch (error) {
//         console.error("Error updating request quote:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

// // Delete Request Quote
// const deleteRequestQuote = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid request quote ID" });
//         }
//         const requestQuote = await RequestQuote.findByIdAndDelete(id);
//         if (!requestQuote) {
//             return res.status(404).json({ message: "Request quote not found" });
//         }
//         res.status(200).json({ message: "Request quote deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting request quote:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

export const updateQuoteStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const taskerId = req.user.id; // From auth middleware

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: 'Invalid task ID' });
        }
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        // Valid statuses
        const validStatuses = ['pending', 'responded', 'accepted', 'declined'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
        }

        // Find task
        const task = await RequestQuote.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Verify tasker
        if (task.tasker.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
        }

        const previousStatus = task.status; // Track for notification
        // Update status and updatedAt
        task.status = status;
        task.updatedAt = new Date();
        await task.save();

        // Populate tasker and client for response
        const updatedTask = await RequestQuote.findById(taskId)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role');

        // Create notification for the client (status updated) - non-blocking
        try {
            const tasker = await User.findById(taskerId).select("firstName lastName");
            await createNotification(
                task.client, // Client ID
                "Quote Status Updated",
                `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your quote request "${task.taskTitle}" to "${status}" (from "${previousStatus}").`,
                "quote-status-updated",
                taskId // Link to quote request
            );
            console.log("Notification created for quote status update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error while updating task status', error: error.message });
    }
};

// Update request quote
 const updateRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }
        const requestQuote = await RequestQuote.findById(id);
        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = requestQuote.client.toString() === req.user.id;
        const isTasker = requestQuote.tasker.toString() === req.user.id;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Clients can update all fields, taskers can only update status
        if (isClient) {
            if (taskTitle) requestQuote.taskTitle = taskTitle;
            if (taskDescription) requestQuote.taskDescription = taskDescription;
            if (location) requestQuote.location = location;
            if (budget !== undefined) requestQuote.budget = budget;
            if (preferredDateTime) requestQuote.preferredDateTime = new Date(preferredDateTime);
            if (urgency) requestQuote.urgency = urgency;
        }

        if (status) {
            // Validate status
            const validStatuses = ["pending", "accepted", "rejected", "completed"];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({ message: "Invalid status value" });
            }
            requestQuote.status = status;
        }

        await requestQuote.save();

        const populatedRequestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // Create notification for the other party (non-blocking)
        try {
            const updaterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = updaterRole === "client" ? requestQuote.tasker : requestQuote.client;
            const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
            const updaterName = req.user.firstName + " " + req.user.lastName;
            let title = "Quote Request Updated";
            let message = `${otherPartyName} "${updaterName}" updated the quote request "${requestQuote.taskTitle}".`;
            if (status) {
                message += ` Status changed to "${status}".`;
            } else if (taskTitle || taskDescription || location || budget !== undefined || preferredDateTime || urgency) {
                message += " Details have been modified (title, description, etc.).";
            }
            await createNotification(
                otherPartyId,
                title,
                message,
                "quote-updated",
                id // Link to quote request
            );
            console.log("Notification created for quote update"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error updating request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete request quote
 const deleteRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }
        const requestQuote = await RequestQuote.findById(id);
        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id;
        if (requestQuote.client.toString() !== userId && requestQuote.tasker.toString() !== userId) {
            return res.status(403).json({ message: "Unauthorized to delete this request quote" });
        }

        const deletedQuote = await RequestQuote.findByIdAndDelete(id);

        // Create notification for the other party (non-blocking)
        try {
            const deleterRole = req.user.role; // Assume req.user has role from middleware
            const otherPartyId = deleterRole === "client" ? requestQuote.tasker : requestQuote.client;
            const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
            const deleterName = req.user.firstName + " " + req.user.lastName;
            await createNotification(
                otherPartyId,
                "Quote Request Deleted",
                `${otherPartyName} "${deleterName}" has deleted the quote request "${requestQuote.taskTitle}".`,
                "quote-deleted",
                id // Link to quote request (even if deleted)
            );
            console.log("Notification created for quote deletion"); // Debug
        } catch (notifErr) {
            console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
        }

        res.status(200).json({ message: "Request quote deleted successfully" });
    } catch (error) {
        console.error("Error deleting request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export { createBooking, getAllBookings, getBookingsByUserId, updateBooking, deleteBooking, createRequestQuote, getAllRequestQuotes, getRequestQuotesByClientId, updateRequestQuote, deleteRequestQuote };