import mongoose from "mongoose";
import BookingTasker from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import User from "../models/user.js";
import { createNotification } from "./notificationHelper.js";
// Create Booking



// const createBooking = async (req, res) => {
//     try {
//         console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));
//         const { taskerId, service, date, dayOfWeek, paymentIntentId } = req.body;
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

//         // Validate payment if paymentIntentId is provided
//         if (paymentIntentId) {
//             try {
//                 const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
//                 console.log('Payment Intent Status:', paymentIntent.status);

//                 if (paymentIntent.status !== 'succeeded') {
//                     return res.status(400).json({
//                         message: 'Payment not completed',
//                         paymentStatus: paymentIntent.status
//                     });
//                 }

//                 const expectedAmount = Math.round(service.hourlyRate * 100);
//                 if (paymentIntent.amount !== expectedAmount) {
//                     return res.status(400).json({
//                         message: 'Payment amount does not match service price',
//                         expected: expectedAmount,
//                         received: paymentIntent.amount
//                     });
//                 }
//             } catch (paymentError) {
//                 console.error('Error verifying payment:', paymentError);
//                 return res.status(400).json({
//                     message: 'Invalid payment intent',
//                     error: paymentError.message
//                 });
//             }
//         } else {
//             console.log('No payment intent provided - creating booking without payment');
//         }

//         const bookingDate = new Date(date);
//         console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString());

//         if (isNaN(bookingDate.getTime())) {
//             console.log('Invalid date format:', date);
//             return res.status(400).json({ message: "Invalid date format" });
//         }

//         const tasker = await mongoose.models.User.findById(taskerId);
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await mongoose.models.User.findById(clientId);
//         if (!client || client.currentRole !== "client") {
//             return res.status(400).json({ message: "Client not found or invalid role" });
//         }

//         // ============ FIXED DAY NAME LOGIC ============
//         // Helper function to get day name consistently
//         const getDayNameFromDate = (dateObj) => {
//             const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
//             return days[dateObj.getDay()];
//         };

//         // Use dayOfWeek from frontend if provided, otherwise calculate from date
//         // But be careful - if we calculate from date, we need to handle timezone
//         let dayName;

//         if (dayOfWeek) {
//             // Trust the frontend's day calculation (since user selected it visually)
//             dayName = dayOfWeek;
//             console.log('Using dayOfWeek from frontend:', dayName);
//         } else {
//             // Fallback: Calculate from date string directly (parse without timezone conversion)
//             // Extract date parts from ISO string to avoid timezone shift
//             const dateParts = date.split('T')[0].split('-');
//             const year = parseInt(dateParts[0]);
//             const month = parseInt(dateParts[1]) - 1; // Months are 0-indexed
//             const day = parseInt(dateParts[2]);
//             const localDate = new Date(year, month, day);
//             dayName = getDayNameFromDate(localDate);
//             console.log('Calculated dayName from date parts:', dayName);
//         }

//         console.log('Final dayName for availability check:', dayName);
//         console.log('Tasker availability:', tasker.availability.map(a => a.day));

//         // Case-insensitive comparison for availability
//         const availability = tasker.availability.find(slot =>
//             slot.day.toLowerCase() === dayName.toLowerCase()
//         );

//         if (!availability) {
//             return res.status(400).json({
//                 message: `Tasker is not available on ${dayName}`,
//                 debug: {
//                     requestedDay: dayName,
//                     availableDays: tasker.availability.map(a => a.day),
//                     receivedDate: date,
//                     receivedDayOfWeek: dayOfWeek
//                 }
//             });
//         }
//         // ============ END FIXED LOGIC ============

//         // Time validation - extract hours and minutes from the date string
//         // to avoid timezone issues
//         const timePart = date.includes('T') ? date.split('T')[1] : null;
//         let hours, minutes;

//         if (timePart) {
//             const timeMatch = timePart.match(/(\d{2}):(\d{2})/);
//             if (timeMatch) {
//                 hours = parseInt(timeMatch[1]);
//                 minutes = parseInt(timeMatch[2]);
//             } else {
//                 hours = bookingDate.getHours();
//                 minutes = bookingDate.getMinutes();
//             }
//         } else {
//             hours = bookingDate.getHours();
//             minutes = bookingDate.getMinutes();
//         }

//         console.log('Booking time:', hours, ':', minutes);

//         const [startHour, startMinute] = availability.from.split(':').map(Number);
//         const [endHour, endMinute] = availability.to.split(':').map(Number);
//         const bookingTimeInMinutes = hours * 60 + minutes;
//         const startTimeInMinutes = startHour * 60 + startMinute;
//         const endTimeInMinutes = endHour * 60 + endMinute;

//         console.log('Time check:', {
//             bookingTime: bookingTimeInMinutes,
//             startTime: startTimeInMinutes,
//             endTime: endTimeInMinutes
//         });

//         if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
//             return res.status(400).json({
//                 message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}`
//             });
//         }

//         console.log('Creating Booking with:', {
//             tasker: taskerId,
//             client: clientId,
//             service,
//             date: bookingDate,
//             paymentIntentId: paymentIntentId || null,
//             status: paymentIntentId ? "confirmed" : "pending"
//         });

//         const booking = new BookingTasker({
//             tasker: taskerId,
//             client: clientId,
//             service,
//             date: bookingDate,
//             paymentIntentId: paymentIntentId || null,
//             status: paymentIntentId ? "confirmed" : "pending",
//             totalAmount: service.hourlyRate,
//         });

//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(booking._id)
//             .populate("tasker", "firstName lastName email phone profilePicture role")
//             .populate("client", "firstName lastName phone role");

//         // Create notification for the tasker
//         try {
//             const notificationMessage = paymentIntentId
//                 ? `"${client.firstName} ${client.lastName}" has booked and paid for your service "${service.title}" for ${bookingDate.toLocaleString()}.`
//                 : `"${client.firstName} ${client.lastName}" has requested to book your service "${service.title}" for ${bookingDate.toLocaleString()}. Please review and confirm.`;

//             await createNotification(
//                 taskerId,
//                 paymentIntentId ? "New Confirmed Booking" : "New Booking Request",
//                 notificationMessage,
//                 "booking-request",
//                 booking._id
//             );
//             console.log("Notification created for new booking");
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         // Also notify the client
//         try {
//             await createNotification(
//                 clientId,
//                 paymentIntentId ? "Booking Confirmed" : "Booking Request Sent",
//                 paymentIntentId
//                     ? `Your booking for "${service.title}" with ${tasker.firstName} ${tasker.lastName} has been confirmed for ${bookingDate.toLocaleString()}.`
//                     : `Your booking request for "${service.title}" with ${tasker.firstName} ${tasker.lastName} has been sent for ${bookingDate.toLocaleString()}.`,
//                 "booking-confirmation",
//                 booking._id
//             );
//         } catch (notifErr) {
//             console.error("Failed to create client notification:", notifErr);
//         }

//         res.status(201).json({
//             message: paymentIntentId
//                 ? "Booking created and confirmed successfully"
//                 : "Booking request created successfully",
//             booking: populatedBooking
//         });
//     } catch (error) {
//         console.error("Error creating booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

const createBooking = async (req, res) => {
    try {
        console.log('Raw Request Body:', JSON.stringify(req.body, null, 2));
        const { taskerId, service, date, dayOfWeek, paymentIntentId } = req.body;
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

        // Validate payment if paymentIntentId is provided
        if (paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
                console.log('Payment Intent Status:', paymentIntent.status);

                if (paymentIntent.status !== 'succeeded') {
                    return res.status(400).json({
                        message: 'Payment not completed',
                        paymentStatus: paymentIntent.status
                    });
                }

                const expectedAmount = Math.round(service.hourlyRate * 100);
                if (paymentIntent.amount !== expectedAmount) {
                    return res.status(400).json({
                        message: 'Payment amount does not match service price',
                        expected: expectedAmount,
                        received: paymentIntent.amount
                    });
                }
            } catch (paymentError) {
                console.error('Error verifying payment:', paymentError);
                return res.status(400).json({
                    message: 'Invalid payment intent',
                    error: paymentError.message
                });
            }
        } else {
            console.log('No payment intent provided - creating booking without payment');
        }

        const bookingDate = new Date(date);
        console.log('Parsed bookingDate:', bookingDate, 'ISO:', bookingDate.toISOString());

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

        // ============ FIXED DAY NAME LOGIC ============
        const getDayNameFromDate = (dateObj) => {
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            return days[dateObj.getDay()];
        };

        let dayName;

        if (dayOfWeek) {
            dayName = dayOfWeek;
            console.log('Using dayOfWeek from frontend:', dayName);
        } else {
            const dateParts = date.split('T')[0].split('-');
            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]) - 1;
            const day = parseInt(dateParts[2]);
            const localDate = new Date(year, month, day);
            dayName = getDayNameFromDate(localDate);
            console.log('Calculated dayName from date parts:', dayName);
        }

        console.log('Final dayName for availability check:', dayName);
        console.log('Tasker availability:', tasker.availability.map(a => a.day));

        const availability = tasker.availability.find(slot =>
            slot.day.toLowerCase() === dayName.toLowerCase()
        );

        if (!availability) {
            return res.status(400).json({
                message: `Tasker is not available on ${dayName}`,
                debug: {
                    requestedDay: dayName,
                    availableDays: tasker.availability.map(a => a.day),
                    receivedDate: date,
                    receivedDayOfWeek: dayOfWeek
                }
            });
        }
        // ============ END FIXED LOGIC ============

        // Time validation
        const timePart = date.includes('T') ? date.split('T')[1] : null;
        let hours, minutes;

        if (timePart) {
            const timeMatch = timePart.match(/(\d{2}):(\d{2})/);
            if (timeMatch) {
                hours = parseInt(timeMatch[1]);
                minutes = parseInt(timeMatch[2]);
            } else {
                hours = bookingDate.getHours();
                minutes = bookingDate.getMinutes();
            }
        } else {
            hours = bookingDate.getHours();
            minutes = bookingDate.getMinutes();
        }

        console.log('Booking time:', hours, ':', minutes);

        const [startHour, startMinute] = availability.from.split(':').map(Number);
        const [endHour, endMinute] = availability.to.split(':').map(Number);
        const bookingTimeInMinutes = hours * 60 + minutes;
        const startTimeInMinutes = startHour * 60 + startMinute;
        const endTimeInMinutes = endHour * 60 + endMinute;

        console.log('Time check:', {
            bookingTime: bookingTimeInMinutes,
            startTime: startTimeInMinutes,
            endTime: endTimeInMinutes
        });

        if (bookingTimeInMinutes < startTimeInMinutes || bookingTimeInMinutes >= endTimeInMinutes) {
            return res.status(400).json({
                message: `Booking time must be between ${availability.from} and ${availability.to} on ${dayName}`
            });
        }

        console.log('Creating Booking with:', {
            tasker: taskerId,
            client: clientId,
            service,
            date: bookingDate,
            paymentIntentId: paymentIntentId || null,
            status: paymentIntentId ? "confirmed" : "pending"
        });

        const booking = new BookingTasker({
            tasker: taskerId,
            client: clientId,
            service,
            date: bookingDate,
            paymentIntentId: paymentIntentId || null,
            status: paymentIntentId ? "confirmed" : "pending",
            totalAmount: service.hourlyRate,
        });

        await booking.save();

        const populatedBooking = await BookingTasker.findById(booking._id)
            .populate("tasker", "firstName lastName email phone profilePicture role")
            .populate("client", "firstName lastName phone role");

        // FIX: Get user details safely
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "A client";

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Format date for notifications
        const formattedDate = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create notification for the tasker
        try {
            // Debug: Log notification details
            console.log("Creating booking notification for tasker:", {
                taskerId,
                clientName,
                serviceTitle: service.title,
                formattedDate,
                isPaid: !!paymentIntentId
            });

            const taskerNotificationTitle = paymentIntentId
                ? "🎉 New Confirmed Booking!"
                : "📅 New Booking Request";

            const taskerNotificationMessage = paymentIntentId
                ? `${clientName} has booked and paid for your service "${service.title}" on ${formattedDate}. Payment of $${service.hourlyRate} received.`
                : `${clientName} has requested to book your service "${service.title}" on ${formattedDate}. Please review and confirm the booking.`;

            await createNotification(
                taskerId,
                taskerNotificationTitle,
                taskerNotificationMessage,
                paymentIntentId ? "booking-confirmed" : "booking-request",
                booking._id
            );
            console.log("✅ Notification created for tasker - new booking");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Create confirmation notification for the client
        try {
            const clientNotificationTitle = paymentIntentId
                ? "✅ Booking Confirmed!"
                : "📤 Booking Request Sent";

            const clientNotificationMessage = paymentIntentId
                ? `Your booking for "${service.title}" with ${taskerName} on ${formattedDate} has been confirmed. Payment of $${service.hourlyRate} processed successfully.`
                : `Your booking request for "${service.title}" with ${taskerName} on ${formattedDate} has been sent. Waiting for tasker confirmation.`;

            await createNotification(
                clientId,
                clientNotificationTitle,
                clientNotificationMessage,
                paymentIntentId ? "booking-confirmed" : "booking-request-sent",
                booking._id
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        res.status(201).json({
            message: paymentIntentId
                ? "Booking created and confirmed successfully"
                : "Booking request created successfully",
            booking: populatedBooking
        });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get All Bookings
const getAllBookings = async (req, res) => {
    try {
        const bookings = await BookingTasker.find()
            .populate("tasker", "firstName lastName email phone role profilePicture")
            .populate("client", "firstName lastName email phone role profilePicture");
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
            .populate("tasker", "firstName lastName email phone role profilePicture")
            .populate("client", "firstName lastName email phone role profilePicture");

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

//  const updateBooking = async (req, res) => {
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

//         const previousStatus = booking.status; // Track for notification
//         const previousService = booking.service; // Track for notification if changed

//         if (status) booking.status = status;
//         if (service) booking.service = service;
//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         // Create notification for the other party (non-blocking)
//         try {
//             const updaterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = updaterRole === "client" ? booking.tasker : booking.client;
//             const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
//             let title = "Booking Updated";
//             let message = `${otherPartyName} updated the booking "${booking.service?.title || 'Booking'}"`;
//             if (status && status !== previousStatus) {
//                 message += ` - Status changed to "${status}"`;
//             }
//             if (service && service.title !== previousService?.title) {
//                 message += ` - Service changed to "${service.title}"`;
//             }
//             await createNotification(
//                 otherPartyId,
//                 title,
//                 message,
//                 "booking-updated",
//                 booking._id // Link to booking
//             );
//             console.log("Notification created for booking update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
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

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Track previous values for notification
        const previousStatus = booking.status;
        const previousService = booking.service;

        // Update booking
        if (status) booking.status = status;
        if (service) booking.service = service;
        await booking.save();

        const populatedBooking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // FIX: Get updater details from database
        const updater = await User.findById(req.user.id).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Determine who is updating and who should be notified
        const isClientUpdating = booking.client._id.toString() === req.user.id;
        const otherPartyId = isClientUpdating ? booking.tasker._id : booking.client._id;
        const otherPartyName = isClientUpdating
            ? `${booking.tasker.firstName} ${booking.tasker.lastName}`
            : `${booking.client.firstName} ${booking.client.lastName}`;

        // Format date for notifications
        const formattedDate = booking.date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Build notification message based on what changed
        let notificationTitle = "Booking Updated";
        let notificationMessage = "";
        let notificationType = "booking-updated";

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "confirmed":
                    notificationTitle = "✅ Booking Confirmed!";
                    notificationMessage = `${updaterName} has confirmed the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                    notificationType = "booking-confirmed";
                    break;
                case "cancelled":
                    notificationTitle = "❌ Booking Cancelled";
                    notificationMessage = `${updaterName} has cancelled the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                    notificationType = "booking-cancelled";
                    break;
                case "completed":
                    notificationTitle = "🎉 Booking Completed!";
                    notificationMessage = `The booking for "${booking.service?.title || 'Service'}" on ${formattedDate} has been marked as completed.`;
                    notificationType = "booking-completed";
                    break;
                case "in-progress":
                    notificationTitle = "🔄 Booking In Progress";
                    notificationMessage = `The booking for "${booking.service?.title || 'Service'}" on ${formattedDate} is now in progress.`;
                    notificationType = "booking-in-progress";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the booking status to "${status}" for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            }
        } else if (service && service.title !== previousService?.title) {
            notificationTitle = "📝 Booking Service Changed";
            notificationMessage = `${updaterName} changed the service from "${previousService?.title || 'Previous Service'}" to "${service.title}" for the booking on ${formattedDate}.`;
            notificationType = "booking-service-changed";
        } else {
            notificationMessage = `${updaterName} made updates to the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating booking update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                booking._id
            );
            console.log("✅ Notification created for booking update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Booking Update Confirmed";
            let confirmationMessage = `Your update to the booking for "${booking.service?.title || 'Service'}" has been saved.`;

            if (status === "confirmed") {
                confirmationTitle = "Booking Confirmation Sent";
                confirmationMessage = `You have confirmed the booking with ${otherPartyName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            } else if (status === "cancelled") {
                confirmationTitle = "Booking Cancellation Confirmed";
                confirmationMessage = `You have cancelled the booking with ${otherPartyName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
            }

            await createNotification(
                req.user.id,
                confirmationTitle,
                confirmationMessage,
                "booking-update-confirmed",
                booking._id
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If booking completed, prompt for review
        if (status === "completed") {
            try {
                // Prompt client to review tasker
                if (isClientUpdating || req.user.role === "client") {
                    await createNotification(
                        booking.client._id,
                        "⭐ Leave a Review",
                        `How was your experience with ${booking.tasker.firstName} ${booking.tasker.lastName} for "${booking.service?.title}"? Leave a review to help others!`,
                        "review-prompt",
                        booking._id
                    );
                    console.log("✅ Review prompt sent to client");
                }
            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification:", notifErr);
            }
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

//         const previousStatus = booking.status; // Track for notification
//         if (status) booking.status = status;
//         booking.updatedAt = new Date();
//         await booking.save();

//         const populatedBooking = await BookingTasker.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         // Create notification for the client (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(req.user._id).select("firstName lastName");
//             await createNotification(
//                 booking.client, // Client ID
//                 "Booking Status Updated",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your booking to "${status}" (from "${previousStatus}").`,
//                 "booking-status-updated",
//                 id // Link to booking
//             );
//             console.log("Notification created for booking status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
//     } catch (error) {
//         console.error("Error updating booking:", error);
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

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Log for debugging
        console.log("Request Params:", req.params);
        console.log("Request Body:", req.body);
        console.log("Authenticated User ID:", req.user._id.toString());
        console.log("Booking Tasker ID:", booking.tasker._id.toString());

        // Ensure only the tasker associated with the booking can update it
        const userId = req.user._id.toString();
        const taskerId = booking.tasker._id.toString();
        if (taskerId !== userId) {
            return res.status(403).json({ message: "Unauthorized to update this booking" });
        }

        // Validate status
        const validStatuses = ["pending", "confirmed", "cancelled", "completed"];
        if (status && !validStatuses.includes(status)) {
            return res.status(400).json({ message: "Invalid status value" });
        }

        const previousStatus = booking.status;
        if (status) booking.status = status;
        booking.updatedAt = new Date();
        await booking.save();

        const populatedBooking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email phone role")
            .populate("client", "firstName lastName email phone role");

        // FIX: Get tasker details from database
        const tasker = await User.findById(req.user._id).select("firstName lastName");
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Get client details
        const clientName = booking.client
            ? `${booking.client.firstName} ${booking.client.lastName}`
            : "The client";

        // Format date for notifications
        const formattedDate = booking.date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Build status-specific notification content
        let clientNotificationTitle = "Booking Status Updated";
        let clientNotificationMessage = "";
        let clientNotificationType = "booking-status-updated";

        let taskerNotificationTitle = "Status Update Confirmed";
        let taskerNotificationMessage = "";

        switch (status) {
            case "confirmed":
                clientNotificationTitle = "✅ Booking Confirmed!";
                clientNotificationMessage = `Great news! ${taskerName} has confirmed your booking for "${booking.service?.title || 'Service'}" on ${formattedDate}. Get ready for your appointment!`;
                clientNotificationType = "booking-confirmed";

                taskerNotificationTitle = "Booking Confirmation Sent";
                taskerNotificationMessage = `You have confirmed the booking with ${clientName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                break;

            case "cancelled":
                clientNotificationTitle = "❌ Booking Cancelled";
                clientNotificationMessage = `Unfortunately, ${taskerName} has cancelled the booking for "${booking.service?.title || 'Service'}" on ${formattedDate}. We apologize for the inconvenience.`;
                clientNotificationType = "booking-cancelled";

                taskerNotificationTitle = "Booking Cancellation Confirmed";
                taskerNotificationMessage = `You have cancelled the booking with ${clientName} for "${booking.service?.title || 'Service'}" on ${formattedDate}.`;
                break;

            case "completed":
                clientNotificationTitle = "🎉 Booking Completed!";
                clientNotificationMessage = `${taskerName} has marked your booking for "${booking.service?.title || 'Service'}" as completed. We hope you had a great experience!`;
                clientNotificationType = "booking-completed";

                taskerNotificationTitle = "Booking Marked as Completed";
                taskerNotificationMessage = `You have marked the booking with ${clientName} for "${booking.service?.title || 'Service'}" as completed. Great job!`;
                break;

            case "pending":
                clientNotificationTitle = "⏳ Booking Status Changed to Pending";
                clientNotificationMessage = `${taskerName} has changed your booking for "${booking.service?.title || 'Service'}" back to pending status.`;
                clientNotificationType = "booking-pending";

                taskerNotificationTitle = "Booking Status Changed";
                taskerNotificationMessage = `You have changed the booking with ${clientName} for "${booking.service?.title || 'Service'}" to pending status.`;
                break;

            default:
                clientNotificationMessage = `${taskerName} updated the status of your booking for "${booking.service?.title || 'Service'}" from "${previousStatus}" to "${status}".`;
                taskerNotificationMessage = `You updated the booking status with ${clientName} to "${status}".`;
        }

        // Create notification for the client
        try {
            // Debug: Log notification details
            console.log("Creating booking status update notification for client:", {
                clientId: booking.client._id,
                taskerName,
                status,
                previousStatus,
                serviceTitle: booking.service?.title
            });

            await createNotification(
                booking.client._id, // Client ID
                clientNotificationTitle,
                clientNotificationMessage,
                clientNotificationType,
                id
            );
            console.log("✅ Notification created for client - booking status update");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                req.user._id, // Tasker ID
                taskerNotificationTitle,
                taskerNotificationMessage,
                "booking-status-update-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
        }

        // If booking completed, prompt client for review
        if (status === "completed") {
            try {
                await createNotification(
                    booking.client._id, // Client ID
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerName} for "${booking.service?.title || 'Service'}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    id
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }

            // Optional: Send thank you notification to tasker
            try {
                await createNotification(
                    req.user._id, // Tasker ID
                    "💰 Earnings Update",
                    `You've completed the booking for "${booking.service?.title || 'Service'}" with ${clientName}. Your earnings of $${booking.totalAmount || booking.service?.hourlyRate || '0'} will be processed.`,
                    "earnings-update",
                    id
                );
                console.log("✅ Earnings notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create earnings notification (non-blocking):", notifErr);
            }
        }

        // If booking cancelled, handle any payment refunds
        if (status === "cancelled" && booking.paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

                if (paymentIntent.status === 'succeeded') {
                    // Create refund notification for client
                    await createNotification(
                        booking.client._id,
                        "💳 Refund Initiated",
                        `A refund for your booking "${booking.service?.title || 'Service'}" has been initiated. The amount of $${booking.totalAmount || booking.service?.hourlyRate || '0'} will be returned to your payment method within 5-10 business days.`,
                        "refund-initiated",
                        id
                    );
                    console.log("✅ Refund notification sent to client");

                    // Uncomment to auto-refund:
                    // await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
                }
            } catch (stripeErr) {
                console.error("❌ Failed to handle payment on cancellation:", stripeErr);
            }
        }

        res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete booking
//  const deleteBooking = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid booking ID" });
//         }
//         const booking = await BookingTasker.findById(id);
//         if (!booking) {
//             return res.status(404).json({ message: "Booking not found" });
//         }

//         // Ensure the authenticated user is authorized (client or tasker)
//         const userId = req.user._id.toString();
//         if (booking.client.toString() !== userId && booking.tasker.toString() !== userId) {
//             return res.status(403).json({ message: "Unauthorized to delete this booking" });
//         }

//         const deletedBooking = await BookingTasker.findByIdAndDelete(id);

//         // Create notification for the other party (non-blocking)
//         try {
//             const deleterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = deleterRole === "client" ? booking.tasker : booking.client;
//             const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
//             const deleterName = req.user.firstName + " " + req.user.lastName;
//             await createNotification(
//                 otherPartyId,
//                 "Booking Deleted",
//                 `${otherPartyName} "${deleterName}" has deleted the booking "${booking.service?.title || 'Booking'}" for ${booking.date}.`,
//                 "booking-deleted",
//                 id // Link to booking (even if deleted)
//             );
//             console.log("Notification created for booking deletion"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Booking deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting booking:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }

        const booking = await BookingTasker.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id || req.user._id.toString();
        const isClient = booking.client._id.toString() === userId;
        const isTasker = booking.tasker._id.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Unauthorized to delete this booking" });
        }

        // Store booking details before deletion for notifications
        const bookingService = booking.service;
        const bookingDate = booking.date;
        const bookingTaskerId = booking.tasker._id;
        const bookingClientId = booking.client._id;
        const taskerName = `${booking.tasker.firstName} ${booking.tasker.lastName}`;
        const clientName = `${booking.client.firstName} ${booking.client.lastName}`;

        // FIX: Cancel payment if exists before deleting
        if (booking.paymentIntentId) {
            try {
                const paymentIntent = await stripe.paymentIntents.retrieve(booking.paymentIntentId);

                // Only cancel if it's in a cancellable state
                if (['requires_payment_method', 'requires_confirmation', 'requires_action', 'processing'].includes(paymentIntent.status)) {
                    await stripe.paymentIntents.cancel(booking.paymentIntentId);
                    console.log("✅ Payment intent canceled for deleted booking");
                } else if (paymentIntent.status === 'succeeded') {
                    // If already paid, you might want to create a refund
                    console.log("⚠️ Booking was paid - consider refund process");
                    // Uncomment below to auto-refund:
                    // await stripe.refunds.create({ payment_intent: booking.paymentIntentId });
                    // console.log("✅ Refund created for deleted booking");
                }
            } catch (stripeErr) {
                console.error("❌ Failed to handle payment on deletion:", stripeErr);
                // Continue with deletion even if stripe fails
            }
        }

        // Delete the booking
        await BookingTasker.findByIdAndDelete(id);

        // FIX: Get deleter details from database
        const deleter = await User.findById(userId).select("firstName lastName");
        const deleterName = deleter
            ? `${deleter.firstName} ${deleter.lastName}`
            : "Someone";

        // Determine who should be notified (the other party)
        const otherPartyId = isClient ? bookingTaskerId : bookingClientId;
        const otherPartyType = isClient ? "Tasker" : "Client";

        // Format date for notifications
        const formattedDate = bookingDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating booking deletion notification:", {
                recipientId: otherPartyId,
                deleterName,
                serviceTitle: bookingService?.title,
                formattedDate,
                isClient
            });

            const notificationTitle = "❌ Booking Cancelled";
            const notificationMessage = `${deleterName} has cancelled the booking for "${bookingService?.title || 'Service'}" that was scheduled for ${formattedDate}.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`;

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                "booking-deleted",
                id
            );
            console.log("✅ Notification created for other party - booking deleted");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the deleter
        try {
            const otherPersonName = isClient ? taskerName : clientName;

            await createNotification(
                userId,
                "Booking Deletion Confirmed",
                `Your booking for "${bookingService?.title || 'Service'}" with ${otherPersonName} on ${formattedDate} has been cancelled successfully.${booking.paymentIntentId ? ' Any payment will be refunded.' : ''}`,
                "booking-delete-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to deleter");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// Create request quote
//  const createRequestQuote = async (req, res) => {
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
//         if (!tasker || tasker.currentRole !== "tasker") {
//             return res.status(400).json({ message: "Tasker not found or invalid role" });
//         }

//         const client = await mongoose.models.User.findById(clientId);
//         if (!client || client.currentRole !== "client") {
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
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Create notification for the tasker (new quote request) - non-blocking
//         try {
//             await createNotification(
//                 taskerId, // Notify the tasker
//                 "New Quote Request",
//                 `Client "${client.firstName} ${client.lastName}" requested a quote for "${taskTitle}" in ${location}. Budget: $${budget || 'Negotiable'}, Preferred Date: ${preferredDateTime || 'Flexible'}.`,
//                 "quote-request",
//                 requestQuote._id // Link to quote request
//             );
//             console.log("Notification created for new quote request"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
//     } catch (error) {
//         console.error("Error creating quote request:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };

const createRequestQuote = async (req, res) => {
    try {
        const { taskerId, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;
        const clientId = req.user?.id;
        console.log(clientId);

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
        if (!tasker || tasker.currentRole !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.currentRole !== "client") {
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
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get user names safely
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "A client";

        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Format preferred date for notifications
        const formattedDate = preferredDateTime
            ? new Date(preferredDateTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : "Flexible";

        // Format budget for notifications
        const formattedBudget = budget ? `$${budget}` : "Negotiable";

        // Create notification for the tasker (new quote request)
        try {
            // Debug: Log notification details
            console.log("Creating quote request notification for tasker:", {
                taskerId,
                clientName,
                taskTitle,
                location,
                budget: formattedBudget,
                preferredDateTime: formattedDate
            });

            await createNotification(
                taskerId,
                "📝 New Quote Request!",
                `${clientName} is requesting a quote for "${taskTitle}" in ${location}. Budget: ${formattedBudget}, Preferred Date: ${formattedDate}, Urgency: ${urgency || 'Flexible'}. Review and respond!`,
                "quote-request",
                requestQuote._id
            );
            console.log("✅ Notification created for tasker - new quote request");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Create confirmation notification for the client
        try {
            await createNotification(
                clientId,
                "📤 Quote Request Sent",
                `Your quote request for "${taskTitle}" has been sent to ${taskerName}. You'll be notified when they respond. Budget: ${formattedBudget}, Location: ${location}.`,
                "quote-request-sent",
                requestQuote._id
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
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

        console.log(req)

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
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole")
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
// export const updateQuoteRequest = async (req, res) => {
//     try {
//         const quoteId = req.params.quoteId;
//         const userId = req.user?.id;
//         const { taskTitle, taskDescription, location, budget, preferredDateTime, urgency, status } = req.body;

//         if (!userId) {
//             return res.status(401).json({ message: "Unauthorized: User not authenticated" });
//         }

//         if (!mongoose.Types.ObjectId.isValid(quoteId)) {
//             return res.status(400).json({ message: "Invalid quote ID" });
//         }

//         const quote = await RequestQuote.findById(quoteId);
//         if (!quote) {
//             return res.status(404).json({ message: "Quote request not found" });
//         }

//         // Allow client to update all fields, tasker to update only status
//         const isClient = quote.client.toString() === userId;
//         const isTasker = quote.tasker.toString() === userId;

//         if (!isClient && !isTasker) {
//             return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
//         }

//         // Clients can update all fields, taskers can only update status
//         if (isClient) {
//             if (taskTitle) quote.taskTitle = taskTitle;
//             if (taskDescription) quote.taskDescription = taskDescription;
//             if (location) quote.location = location;
//             if (budget !== undefined) quote.budget = budget;
//             if (preferredDateTime) quote.preferredDateTime = new Date(preferredDateTime);
//             if (urgency) quote.urgency = urgency;
//         }

//         if (status) {
//             // Validate status
//             const validStatuses = ["pending", "accepted", "rejected", "completed"];
//             if (!validStatuses.includes(status)) {
//                 return res.status(400).json({ message: "Invalid status value" });
//             }
//             quote.status = status;
//         }

//         await quote.save();

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Create notification for the other party (non-blocking)
//         try {
//             const updaterRole = req.user.currentRole; // Assume req.user has role from middleware
//             const otherPartyId = updaterRole === "client" ? quote.tasker : quote.client;
//             const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
//             const updaterName = req.user.firstName + " " + req.user.lastName;
//             let title = "Quote Request Updated";
//             let message = `${otherPartyName} "${updaterName}" updated the quote request "${quote.taskTitle}".`;
//             if (status) {
//                 message += ` Status changed to "${status}".`;
//             } else if (taskTitle || taskDescription || location || budget !== undefined || preferredDateTime || urgency) {
//                 message += " Details have been modified.";
//             }
//             await createNotification(
//                 otherPartyId,
//                 title,
//                 message,
//                 "quote-updated",
//                 quoteId // Link to quote request
//             );
//             console.log("Notification created for quote update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Quote request updated successfully", requestQuote: populatedQuote });
//     } catch (error) {
//         console.error("Error updating quote request:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };


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

        const quote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!quote) {
            return res.status(404).json({ message: "Quote request not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = quote.client._id.toString() === userId;
        const isTasker = quote.tasker._id.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Track previous values for notification
        const previousStatus = quote.status;
        const previousTaskTitle = quote.taskTitle;

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
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get updater details from database
        const updater = await User.findById(userId).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Get other party details
        const otherPartyId = isClient ? quote.tasker._id : quote.client._id;
        const otherPartyName = isClient
            ? `${quote.tasker.firstName} ${quote.tasker.lastName}`
            : `${quote.client.firstName} ${quote.client.lastName}`;

        // Build notification content based on what changed
        let notificationTitle = "Quote Request Updated";
        let notificationMessage = "";
        let notificationType = "quote-updated";

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "accepted":
                    notificationTitle = "✅ Quote Request Accepted!";
                    notificationMessage = `${updaterName} has accepted the quote request for "${quote.taskTitle}". You can now proceed with the service!`;
                    notificationType = "quote-accepted";
                    break;
                case "rejected":
                    notificationTitle = "❌ Quote Request Declined";
                    notificationMessage = `${updaterName} has declined the quote request for "${quote.taskTitle}". You may want to request a quote from another tasker.`;
                    notificationType = "quote-rejected";
                    break;
                case "completed":
                    notificationTitle = "🎉 Quote Request Completed!";
                    notificationMessage = `The quote request for "${quote.taskTitle}" has been marked as completed by ${updaterName}.`;
                    notificationType = "quote-completed";
                    break;
                case "pending":
                    notificationTitle = "⏳ Quote Request Status Changed";
                    notificationMessage = `${updaterName} has changed the status of "${quote.taskTitle}" back to pending.`;
                    notificationType = "quote-pending";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the status of "${quote.taskTitle}" to "${status}".`;
            }
        } else if (isClient) {
            // Client updated details
            let changes = [];
            if (taskTitle && taskTitle !== previousTaskTitle) changes.push(`title to "${taskTitle}"`);
            if (taskDescription) changes.push("description");
            if (location) changes.push(`location to "${location}"`);
            if (budget !== undefined) changes.push(`budget to $${budget}`);
            if (preferredDateTime) changes.push("preferred date/time");
            if (urgency) changes.push(`urgency to "${urgency}"`);

            if (changes.length > 0) {
                notificationTitle = "📝 Quote Request Details Updated";
                notificationMessage = `${updaterName} has updated the quote request for "${quote.taskTitle}". Changes: ${changes.join(', ')}.`;
                notificationType = "quote-details-updated";
            } else {
                notificationMessage = `${updaterName} made updates to the quote request for "${quote.taskTitle}".`;
            }
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating quote update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                isClient,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                quoteId
            );
            console.log("✅ Notification created for other party - quote update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Quote Update Confirmed";
            let confirmationMessage = `Your update to the quote request for "${quote.taskTitle}" has been saved.`;

            if (status === "accepted") {
                confirmationTitle = "Quote Acceptance Confirmed";
                confirmationMessage = `You have accepted the quote request for "${quote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "rejected") {
                confirmationTitle = "Quote Rejection Confirmed";
                confirmationMessage = `You have declined the quote request for "${quote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "completed") {
                confirmationTitle = "Quote Marked as Completed";
                confirmationMessage = `You have marked the quote request for "${quote.taskTitle}" as completed.`;
            }

            await createNotification(
                userId,
                confirmationTitle,
                confirmationMessage,
                "quote-update-confirmed",
                quoteId
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If completed, prompt client for review
        if (status === "completed") {
            try {
                const clientId = quote.client._id;
                const taskerFullName = `${quote.tasker.firstName} ${quote.tasker.lastName}`;

                await createNotification(
                    clientId,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerFullName} for "${quote.taskTitle}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    quoteId
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }
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
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");
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
            .populate("tasker", "firstName lastName email phone currentRole profilePicture")
            .populate("client", "firstName lastName email phone currentRole ");

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

//         const previousStatus = task.status; // Track for notification
//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         // Create notification for the client (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(taskerId).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID
//                 "Quote Status Updated",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your quote request "${task.taskTitle}" to "${status}" (from "${previousStatus}").`,
//                 "quote-status-updated",
//                 taskId // Link to quote request
//             );
//             console.log("Notification created for quote status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };


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

//         // Valid statuses (updated to match schema)
//         const validStatuses = ['accepted', 'rejected', 'completed'];
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

//         const previousStatus = task.status; // Track for notification
//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         // Create notification for the client (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(taskerId).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID
//                 "Quote Status Updated",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your quote request "${task.taskTitle}" to "${status}" (from "${previousStatus}").`,
//                 "quote-status-updated",
//                 taskId // Link to quote request
//             );
//             console.log("Notification created for quote status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };

export const updateQuoteStatus = async (req, res) => {
    try {
        const { taskId } = req.params;
        const { status } = req.body;
        const taskerId = req.user.id;

        // Validate inputs
        if (!mongoose.Types.ObjectId.isValid(taskId)) {
            return res.status(400).json({ message: 'Invalid task ID' });
        }
        if (!status) {
            return res.status(400).json({ message: 'Status is required' });
        }

        // Valid statuses (updated to match schema)
        const validStatuses = ['accepted', 'rejected', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
        }

        // Find task with populated data
        const task = await RequestQuote.findById(taskId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Verify tasker
        if (task.tasker._id.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
        }

        // Track previous status for notification
        const previousStatus = task.status;

        // Update status and updatedAt
        task.status = status;
        task.updatedAt = new Date();
        await task.save();

        // Populate tasker and client for response
        const updatedTask = await RequestQuote.findById(taskId)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role');

        // FIX: Get tasker details from database
        const tasker = await User.findById(taskerId).select("firstName lastName");
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Get client details
        const clientName = task.client
            ? `${task.client.firstName} ${task.client.lastName}`
            : "The client";

        // Build status-specific notification content
        let clientNotificationTitle = "Quote Status Updated";
        let clientNotificationMessage = "";
        let clientNotificationType = "quote-status-updated";

        let taskerNotificationTitle = "Status Update Confirmed";
        let taskerNotificationMessage = "";

        switch (status) {
            case "accepted":
                clientNotificationTitle = "🎉 Your Quote Request Was Accepted!";
                clientNotificationMessage = `Great news! ${taskerName} has accepted your quote request for "${task.taskTitle}". You can now proceed to book the service or discuss details further.`;
                clientNotificationType = "quote-accepted";

                taskerNotificationTitle = "Quote Acceptance Confirmed";
                taskerNotificationMessage = `You have accepted the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified.`;
                break;

            case "rejected":
                clientNotificationTitle = "❌ Quote Request Declined";
                clientNotificationMessage = `Unfortunately, ${taskerName} is unable to accept your quote request for "${task.taskTitle}" at this time. You may want to request a quote from another tasker.`;
                clientNotificationType = "quote-rejected";

                taskerNotificationTitle = "Quote Rejection Confirmed";
                taskerNotificationMessage = `You have declined the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified.`;
                break;

            case "completed":
                clientNotificationTitle = "🎉 Quote Request Completed!";
                clientNotificationMessage = `${taskerName} has marked your quote request for "${task.taskTitle}" as completed. We hope you had a great experience!`;
                clientNotificationType = "quote-completed";

                taskerNotificationTitle = "Quote Marked as Completed";
                taskerNotificationMessage = `You have marked the quote request for "${task.taskTitle}" with ${clientName} as completed. Great job!`;
                break;

            default:
                clientNotificationMessage = `${taskerName} updated the status of your quote request for "${task.taskTitle}" from "${previousStatus}" to "${status}".`;
                taskerNotificationMessage = `You updated the quote status for "${task.taskTitle}" to "${status}".`;
        }

        // Create notification for the client
        try {
            // Debug: Log notification details
            console.log("Creating quote status update notification for client:", {
                clientId: task.client._id,
                taskerName,
                status,
                previousStatus,
                taskTitle: task.taskTitle
            });

            await createNotification(
                task.client._id,
                clientNotificationTitle,
                clientNotificationMessage,
                clientNotificationType,
                taskId
            );
            console.log("✅ Notification created for client - quote status update");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                taskerId,
                taskerNotificationTitle,
                taskerNotificationMessage,
                "quote-status-update-confirmed",
                taskId
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
        }

        // If quote accepted, prompt to book or schedule
        if (status === "accepted") {
            try {
                await createNotification(
                    task.client._id,
                    "📅 Ready to Book?",
                    `Your quote for "${task.taskTitle}" was accepted by ${taskerName}. Book now to schedule your service!`,
                    "booking-prompt",
                    taskId
                );
                console.log("✅ Booking prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create booking prompt notification (non-blocking):", notifErr);
            }
        }

        // If quote completed, prompt client for review
        if (status === "completed") {
            try {
                await createNotification(
                    task.client._id,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerName} for "${task.taskTitle}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    taskId
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }

            // Send earnings/thank you notification to tasker
            try {
                await createNotification(
                    taskerId,
                    "💪 Great Work!",
                    `You've completed the quote request for "${task.taskTitle}" with ${clientName}. Keep up the excellent work!`,
                    "quote-work-completed",
                    taskId
                );
                console.log("✅ Work completed notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create tasker work completed notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error while updating task status', error: error.message });
    }
};



// Update request quote
//  const updateRequestQuote = async (req, res) => {
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

//         // Allow client to update all fields, tasker to update only status
//         const isClient = requestQuote.client.toString() === req.user.id;
//         const isTasker = requestQuote.tasker.toString() === req.user.id;

//         if (!isClient && !isTasker) {
//             return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
//         }

//         // Clients can update all fields, taskers can only update status
//         if (isClient) {
//             if (taskTitle) requestQuote.taskTitle = taskTitle;
//             if (taskDescription) requestQuote.taskDescription = taskDescription;
//             if (location) requestQuote.location = location;
//             if (budget !== undefined) requestQuote.budget = budget;
//             if (preferredDateTime) requestQuote.preferredDateTime = new Date(preferredDateTime);
//             if (urgency) requestQuote.urgency = urgency;
//         }

//         if (status) {
//             // Validate status
//             const validStatuses = ["pending", "accepted", "rejected", "completed"];
//             if (!validStatuses.includes(status)) {
//                 return res.status(400).json({ message: "Invalid status value" });
//             }
//             requestQuote.status = status;
//         }

//         await requestQuote.save();

//         const populatedRequestQuote = await RequestQuote.findById(id)
//             .populate("tasker", "firstName lastName email phone role")
//             .populate("client", "firstName lastName email phone role");

//         // Create notification for the other party (non-blocking)
//         try {
//             const updaterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = updaterRole === "client" ? requestQuote.tasker : requestQuote.client;
//             const otherPartyName = updaterRole === "client" ? "Tasker" : "Client";
//             const updaterName = req.user.firstName + " " + req.user.lastName;
//             let title = "Quote Request Updated";
//             let message = `${otherPartyName} "${updaterName}" updated the quote request "${requestQuote.taskTitle}".`;
//             if (status) {
//                 message += ` Status changed to "${status}".`;
//             } else if (taskTitle || taskDescription || location || budget !== undefined || preferredDateTime || urgency) {
//                 message += " Details have been modified (title, description, etc.).";
//             }
//             await createNotification(
//                 otherPartyId,
//                 title,
//                 message,
//                 "quote-updated",
//                 id // Link to quote request
//             );
//             console.log("Notification created for quote update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
//     } catch (error) {
//         console.error("Error updating request quote:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };
const updateRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, taskTitle, taskDescription, location, budget, preferredDateTime, urgency } = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }

        const requestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        // Allow client to update all fields, tasker to update only status
        const isClient = requestQuote.client._id.toString() === req.user.id;
        const isTasker = requestQuote.tasker._id.toString() === req.user.id;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Forbidden: You can only update your own quotes" });
        }

        // Track previous values for notification
        const previousStatus = requestQuote.status;
        const previousTaskTitle = requestQuote.taskTitle;
        const previousBudget = requestQuote.budget;
        const previousLocation = requestQuote.location;

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

        // FIX: Get updater details from database
        const updater = await User.findById(req.user.id).select("firstName lastName");
        const updaterName = updater
            ? `${updater.firstName} ${updater.lastName}`
            : "Someone";

        // Get other party details
        const otherPartyId = isClient ? requestQuote.tasker._id : requestQuote.client._id;
        const otherPartyName = isClient
            ? `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`
            : `${requestQuote.client.firstName} ${requestQuote.client.lastName}`;

        // Build notification content based on what changed
        let notificationTitle = "Quote Request Updated";
        let notificationMessage = "";
        let notificationType = "quote-updated";

        // Track changes for detailed notification
        let changes = [];

        if (status && status !== previousStatus) {
            // Status change notifications
            switch (status) {
                case "accepted":
                    notificationTitle = "✅ Quote Request Accepted!";
                    notificationMessage = `${updaterName} has accepted the quote request for "${requestQuote.taskTitle}". You can now proceed with the service!`;
                    notificationType = "quote-accepted";
                    break;
                case "rejected":
                    notificationTitle = "❌ Quote Request Declined";
                    notificationMessage = `${updaterName} has declined the quote request for "${requestQuote.taskTitle}".`;
                    notificationType = "quote-rejected";
                    break;
                case "completed":
                    notificationTitle = "🎉 Quote Request Completed!";
                    notificationMessage = `The quote request for "${requestQuote.taskTitle}" has been marked as completed by ${updaterName}.`;
                    notificationType = "quote-completed";
                    break;
                case "pending":
                    notificationTitle = "⏳ Quote Request Status Changed";
                    notificationMessage = `${updaterName} has changed the status of "${requestQuote.taskTitle}" back to pending.`;
                    notificationType = "quote-pending";
                    break;
                default:
                    notificationMessage = `${updaterName} updated the status of "${requestQuote.taskTitle}" to "${status}".`;
            }
        } else if (isClient) {
            // Client updated details - track specific changes
            if (taskTitle && taskTitle !== previousTaskTitle) changes.push(`title to "${taskTitle}"`);
            if (taskDescription) changes.push("description");
            if (location && location !== previousLocation) changes.push(`location to "${location}"`);
            if (budget !== undefined && budget !== previousBudget) changes.push(`budget to $${budget}`);
            if (preferredDateTime) changes.push("preferred date/time");
            if (urgency) changes.push(`urgency to "${urgency}"`);

            if (changes.length > 0) {
                notificationTitle = "📝 Quote Request Details Updated";
                notificationMessage = `${updaterName} has updated the quote request for "${requestQuote.taskTitle}". Changes: ${changes.join(', ')}.`;
                notificationType = "quote-details-updated";
            } else {
                notificationMessage = `${updaterName} made updates to the quote request for "${requestQuote.taskTitle}".`;
            }
        }

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating quote update notification:", {
                recipientId: otherPartyId,
                updaterName,
                status,
                previousStatus,
                isClient,
                changes,
                notificationType
            });

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                notificationType,
                id
            );
            console.log("✅ Notification created for other party - quote update");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the updater
        try {
            let confirmationTitle = "Quote Update Confirmed";
            let confirmationMessage = `Your update to the quote request for "${requestQuote.taskTitle}" has been saved.`;

            if (status === "accepted") {
                confirmationTitle = "Quote Acceptance Confirmed";
                confirmationMessage = `You have accepted the quote request for "${requestQuote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "rejected") {
                confirmationTitle = "Quote Rejection Confirmed";
                confirmationMessage = `You have declined the quote request for "${requestQuote.taskTitle}" from ${otherPartyName}.`;
            } else if (status === "completed") {
                confirmationTitle = "Quote Marked as Completed";
                confirmationMessage = `You have marked the quote request for "${requestQuote.taskTitle}" as completed.`;
            } else if (changes.length > 0) {
                confirmationMessage = `Your changes to "${requestQuote.taskTitle}" have been saved: ${changes.join(', ')}.`;
            }

            await createNotification(
                req.user.id,
                confirmationTitle,
                confirmationMessage,
                "quote-update-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to updater");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        // If completed, prompt client for review
        if (status === "completed") {
            try {
                const clientId = requestQuote.client._id;
                const taskerFullName = `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`;

                await createNotification(
                    clientId,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerFullName} for "${requestQuote.taskTitle}"? Leave a review to help others find great taskers!`,
                    "review-prompt",
                    id
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error updating request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};



// Delete request quote
//  const deleteRequestQuote = async (req, res) => {
//     try {
//         const { id } = req.params;
//         if (!mongoose.Types.ObjectId.isValid(id)) {
//             return res.status(400).json({ message: "Invalid request quote ID" });
//         }
//         const requestQuote = await RequestQuote.findById(id);
//         if (!requestQuote) {
//             return res.status(404).json({ message: "Request quote not found" });
//         }

//         // Ensure the authenticated user is authorized (client or tasker)
//         const userId = req.user.id;
//         if (requestQuote.client.toString() !== userId && requestQuote.tasker.toString() !== userId) {
//             return res.status(403).json({ message: "Unauthorized to delete this request quote" });
//         }

//         const deletedQuote = await RequestQuote.findByIdAndDelete(id);

//         // Create notification for the other party (non-blocking)
//         try {
//             const deleterRole = req.user.role; // Assume req.user has role from middleware
//             const otherPartyId = deleterRole === "client" ? requestQuote.tasker : requestQuote.client;
//             const otherPartyName = deleterRole === "client" ? "Tasker" : "Client";
//             const deleterName = req.user.firstName + " " + req.user.lastName;
//             await createNotification(
//                 otherPartyId,
//                 "Quote Request Deleted",
//                 `${otherPartyName} "${deleterName}" has deleted the quote request "${requestQuote.taskTitle}".`,
//                 "quote-deleted",
//                 id // Link to quote request (even if deleted)
//             );
//             console.log("Notification created for quote deletion"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: "Request quote deleted successfully" });
//     } catch (error) {
//         console.error("Error deleting request quote:", error);
//         res.status(500).json({ message: "Server error" });
//     }
// };
const deleteRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }

        const requestQuote = await RequestQuote.findById(id)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }

        // Ensure the authenticated user is authorized (client or tasker)
        const userId = req.user.id;
        const isClient = requestQuote.client._id.toString() === userId;
        const isTasker = requestQuote.tasker._id.toString() === userId;

        if (!isClient && !isTasker) {
            return res.status(403).json({ message: "Unauthorized to delete this request quote" });
        }

        // Store quote details before deletion for notifications
        const quoteTaskTitle = requestQuote.taskTitle;
        const quoteTaskerId = requestQuote.tasker._id;
        const quoteClientId = requestQuote.client._id;
        const taskerName = `${requestQuote.tasker.firstName} ${requestQuote.tasker.lastName}`;
        const clientName = `${requestQuote.client.firstName} ${requestQuote.client.lastName}`;
        const quoteBudget = requestQuote.budget;

        // Delete the quote
        await RequestQuote.findByIdAndDelete(id);

        // FIX: Get deleter details from database
        const deleter = await User.findById(userId).select("firstName lastName");
        const deleterName = deleter
            ? `${deleter.firstName} ${deleter.lastName}`
            : "Someone";

        // Determine who should be notified (the other party)
        const otherPartyId = isClient ? quoteTaskerId : quoteClientId;
        const otherPartyName = isClient ? taskerName : clientName;

        // Create notification for the other party
        try {
            // Debug: Log notification details
            console.log("Creating quote deletion notification:", {
                recipientId: otherPartyId,
                deleterName,
                quoteTaskTitle,
                isClient
            });

            const notificationTitle = "❌ Quote Request Deleted";
            const notificationMessage = isClient
                ? `${deleterName} has deleted the quote request for "${quoteTaskTitle}". This quote is no longer available.`
                : `${deleterName} has withdrawn from the quote request "${quoteTaskTitle}". You may want to request a quote from another tasker.`;

            await createNotification(
                otherPartyId,
                notificationTitle,
                notificationMessage,
                "quote-deleted",
                id
            );
            console.log("✅ Notification created for other party - quote deleted");

        } catch (notifErr) {
            console.error("❌ Failed to create notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to the deleter
        try {
            const confirmationMessage = isClient
                ? `Your quote request for "${quoteTaskTitle}" has been deleted successfully. ${taskerName} has been notified.`
                : `You have withdrawn from the quote request "${quoteTaskTitle}" by ${clientName}.`;

            await createNotification(
                userId,
                "Quote Deletion Confirmed",
                confirmationMessage,
                "quote-delete-confirmed",
                id
            );
            console.log("✅ Confirmation notification sent to deleter");

        } catch (notifErr) {
            console.error("❌ Failed to create confirmation notification (non-blocking):", notifErr);
        }

        res.status(200).json({ message: "Request quote deleted successfully" });
    } catch (error) {
        console.error("Error deleting request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// export const submitBid = async (req, res) => {
//     try {
//         const { quoteId } = req.params;
//         const { bidAmount, bidDescription, estimatedDuration } = req.body;
//         const taskerId = req.user.id;

//         if (!mongoose.Types.ObjectId.isValid(quoteId)) {
//             return res.status(400).json({ message: 'Invalid quote ID' });
//         }

//         const quote = await RequestQuote.findById(quoteId).populate('tasker', 'currentRole');
//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.tasker._id.toString() !== taskerId) {
//             return res.status(403).json({ message: 'Unauthorized: Only the assigned tasker can bid' });
//         }

//         if (quote.status === 'accepted' || quote.status === 'completed' || quote.status === 'rejected') {
//             return res.status(400).json({ message: 'Cannot bid on this quote' });
//         }

//         // Validate inputs
//         if (!bidAmount || bidAmount <= 0) {
//             return res.status(400).json({ message: 'Valid bid amount is required' });
//         }

//         const newBid = {
//             bidAmount,
//             bidDescription: bidDescription || '',
//             estimatedDuration: estimatedDuration || 1,
//             // submittedAt and status will default via schema
//         };

//         quote.bids.push(newBid);

//         // Set status to 'bidded' if this is the first bid
//         if (quote.bids.length === 1) {
//             quote.status = 'bidded';
//         }

//         await quote.save();

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Notification to client: new bid received
//         try {
//             const tasker = await User.findById(taskerId).select('firstName lastName');
//             await createNotification(
//                 quote.client,
//                 'New Bid Received',
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" submitted a bid of $${bidAmount} for your quote "${quote.taskTitle}".`,
//                 'new-bid',
//                 quoteId
//             );
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(201).json({ message: 'Bid submitted successfully', quote: populatedQuote });
//     } catch (error) {
//         console.error('Error submitting bid:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

export const submitBid = async (req, res) => {
    try {
        const { quoteId } = req.params;
        const { bidAmount, bidDescription, estimatedDuration } = req.body;
        const taskerId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId)) {
            return res.status(400).json({ message: 'Invalid quote ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('tasker', 'firstName lastName email currentRole')
            .populate('client', 'firstName lastName email currentRole');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.tasker._id.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized: Only the assigned tasker can bid' });
        }

        if (quote.status === 'accepted' || quote.status === 'completed' || quote.status === 'rejected') {
            return res.status(400).json({ message: 'Cannot bid on this quote' });
        }

        // Validate inputs
        if (!bidAmount || bidAmount <= 0) {
            return res.status(400).json({ message: 'Valid bid amount is required' });
        }

        const newBid = {
            bidAmount,
            bidDescription: bidDescription || '',
            estimatedDuration: estimatedDuration || 1,
        };

        quote.bids.push(newBid);

        // Set status to 'bidded' if this is the first bid
        const isFirstBid = quote.bids.length === 1;
        if (isFirstBid) {
            quote.status = 'bidded';
        }

        await quote.save();

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get tasker details from database
        const tasker = await User.findById(taskerId).select('firstName lastName');
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Get client details
        const clientName = quote.client
            ? `${quote.client.firstName} ${quote.client.lastName}`
            : "The client";

        // Format estimated duration
        const durationText = estimatedDuration
            ? `${estimatedDuration} hour${estimatedDuration > 1 ? 's' : ''}`
            : "1 hour";

        // Notification to client: new bid received
        try {
            // Debug: Log notification details
            console.log("Creating bid notification for client:", {
                clientId: quote.client._id,
                taskerName,
                bidAmount,
                quoteTaskTitle: quote.taskTitle,
                isFirstBid
            });

            const notificationTitle = isFirstBid
                ? "🎉 First Bid Received!"
                : "💰 New Bid Received!";

            const notificationMessage = `${taskerName} submitted a bid of $${bidAmount} for your quote request "${quote.taskTitle}". Estimated duration: ${durationText}.${bidDescription ? ` Note: "${bidDescription.substring(0, 50)}${bidDescription.length > 50 ? '...' : ''}"` : ''} Review and respond!`;

            await createNotification(
                quote.client._id,
                notificationTitle,
                notificationMessage,
                'quote-bid-received',
                quoteId
            );
            console.log("✅ Notification created for client - new bid");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                taskerId,
                "✅ Bid Submitted Successfully",
                `Your bid of $${bidAmount} for "${quote.taskTitle}" has been submitted to ${clientName}. Estimated duration: ${durationText}. You'll be notified when they respond.`,
                'quote-bid-submitted',
                quoteId
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
        }

        res.status(201).json({ message: 'Bid submitted successfully', quote: populatedQuote });
    } catch (error) {
        console.error('Error submitting bid:', error);
        res.status(500).json({ message: 'Server error' });
    }
};


// Accept Bid (Client endpoint: POST /api/requestQuotes/:quoteId/accept-bid/:bidId)
// export const acceptBid = async (req, res) => {
//     try {
//         const { quoteId, bidId } = req.params;
//         const clientId = req.user.id;

//         if (!mongoose.Types.ObjectId.isValid(quoteId) || !mongoose.Types.ObjectId.isValid(bidId)) {
//             return res.status(400).json({ message: 'Invalid quote or bid ID' });
//         }

//         const quote = await RequestQuote.findById(quoteId).populate('client', 'currentRole');
//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.client._id.toString() !== clientId) {
//             return res.status(403).json({ message: 'Unauthorized: Only the client can accept bids' });
//         }

//         if (quote.status !== 'bidded' && quote.status !== 'pending') {
//             return res.status(400).json({ message: 'Cannot accept bid on this quote' });
//         }

//         // Find and update the specific bid
//         const bid = quote.bids.id(bidId);
//         if (!bid) {
//             return res.status(404).json({ message: 'Bid not found' });
//         }

//         if (bid.status !== 'pending') {
//             return res.status(400).json({ message: 'Bid has already been decided' });
//         }

//         // Accept this bid and reject others
//         bid.status = 'accepted';
//         quote.bids.forEach(b => {
//             if (b._id.toString() !== bidId) {
//                 b.status = 'rejected';
//             }
//         });

//         quote.status = 'accepted';

//         await quote.save();

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Notification to tasker: bid accepted
//         try {
//             const client = await User.findById(clientId).select('firstName lastName');
//             await createNotification(
//                 quote.tasker,
//                 'Bid Accepted',
//                 `Client "${client.firstName} ${client.lastName}" accepted your bid of $${bid.bidAmount} for "${quote.taskTitle}".`,
//                 'bid-accepted',
//                 quoteId
//             );
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: 'Bid accepted successfully', quote: populatedQuote });
//     } catch (error) {
//         console.error('Error accepting bid:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };


export const acceptBid = async (req, res) => {
    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId) || !mongoose.Types.ObjectId.isValid(bidId)) {
            return res.status(400).json({ message: 'Invalid quote or bid ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('client', 'firstName lastName email currentRole')
            .populate('tasker', 'firstName lastName email currentRole');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.client._id.toString() !== clientId) {
            return res.status(403).json({ message: 'Unauthorized: Only the client can accept bids' });
        }

        if (quote.status !== 'bidded' && quote.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot accept bid on this quote' });
        }

        // Find and update the specific bid
        const bid = quote.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        if (bid.status !== 'pending') {
            return res.status(400).json({ message: 'Bid has already been decided' });
        }

        // Accept this bid and reject others
        bid.status = 'accepted';
        quote.bids.forEach(b => {
            if (b._id.toString() !== bidId) {
                b.status = 'rejected';
            }
        });

        quote.status = 'accepted';

        await quote.save();

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get client details from database
        const client = await User.findById(clientId).select('firstName lastName');
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Get tasker details
        const taskerName = quote.tasker
            ? `${quote.tasker.firstName} ${quote.tasker.lastName}`
            : "The tasker";

        // Format estimated duration
        const durationText = bid.estimatedDuration
            ? `${bid.estimatedDuration} hour${bid.estimatedDuration > 1 ? 's' : ''}`
            : "1 hour";

        // Notification to tasker: bid accepted
        try {
            // Debug: Log notification details
            console.log("Creating bid accepted notification for tasker:", {
                taskerId: quote.tasker._id,
                clientName,
                bidAmount: bid.bidAmount,
                quoteTaskTitle: quote.taskTitle
            });

            await createNotification(
                quote.tasker._id,
                "🎉 Congratulations! Your Bid Was Accepted!",
                `${clientName} has accepted your bid of $${bid.bidAmount} for "${quote.taskTitle}"! Estimated duration: ${durationText}. You can now proceed with the service.`,
                'quote-bid-accepted',
                quoteId
            );
            console.log("✅ Notification created for tasker - bid accepted");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            await createNotification(
                clientId,
                "✅ Bid Acceptance Confirmed",
                `You have accepted ${taskerName}'s bid of $${bid.bidAmount} for "${quote.taskTitle}". Estimated duration: ${durationText}. You can now coordinate with the tasker!`,
                'quote-bid-accept-confirmed',
                quoteId
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification (non-blocking):", notifErr);
        }

        // Prompt to book or schedule
        try {
            await createNotification(
                clientId,
                "📅 Ready to Schedule?",
                `Your bid for "${quote.taskTitle}" was accepted. Contact ${taskerName} to schedule the service or create a booking!`,
                "booking-prompt",
                quoteId
            );
            console.log("✅ Booking prompt notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create booking prompt notification (non-blocking):", notifErr);
        }

        res.status(200).json({ message: 'Bid accepted successfully', quote: populatedQuote });
    } catch (error) {
        console.error('Error accepting bid:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



// Reject Bid (Client endpoint: POST /api/requestQuotes/:quoteId/reject-bid/:bidId)
// export const rejectBid = async (req, res) => {
//     try {
//         const { quoteId, bidId } = req.params;
//         const clientId = req.user.id;

//         if (!mongoose.Types.ObjectId.isValid(quoteId) || !mongoose.Types.ObjectId.isValid(bidId)) {
//             return res.status(400).json({ message: 'Invalid quote or bid ID' });
//         }

//         const quote = await RequestQuote.findById(quoteId).populate('client', 'currentRole');
//         if (!quote) {
//             return res.status(404).json({ message: 'Quote not found' });
//         }

//         if (quote.client._id.toString() !== clientId) {
//             return res.status(403).json({ message: 'Unauthorized: Only the client can reject bids' });
//         }

//         if (quote.status !== 'bidded' && quote.status !== 'pending') {
//             return res.status(400).json({ message: 'Cannot reject bid on this quote' });
//         }

//         // Find and update the specific bid
//         const bid = quote.bids.id(bidId);
//         if (!bid) {
//             return res.status(404).json({ message: 'Bid not found' });
//         }

//         if (bid.status !== 'pending') {
//             return res.status(400).json({ message: 'Bid has already been decided' });
//         }

//         bid.status = 'rejected';
//         await quote.save();

//         // Check if all bids are rejected and no accepted; if so, set quote to 'rejected'
//         const hasPendingBids = quote.bids.some(b => b.status === 'pending');
//         const hasAcceptedBid = quote.bids.some(b => b.status === 'accepted');
//         if (!hasPendingBids && !hasAcceptedBid) {
//             quote.status = 'rejected';
//             await quote.save();
//         }

//         const populatedQuote = await RequestQuote.findById(quoteId)
//             .populate("tasker", "firstName lastName email phone currentRole")
//             .populate("client", "firstName lastName email phone currentRole");

//         // Notification to tasker: bid rejected
//         try {
//             const client = await User.findById(clientId).select('firstName lastName');
//             await createNotification(
//                 quote.tasker,
//                 'Bid Rejected',
//                 `Client "${client.firstName} ${client.lastName}" rejected your bid of $${bid.bidAmount} for "${quote.taskTitle}". You can submit another bid if desired.`,
//                 'bid-rejected',
//                 quoteId
//             );
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr);
//         }

//         res.status(200).json({ message: 'Bid rejected successfully', quote: populatedQuote });
//     } catch (error) {
//         console.error('Error rejecting bid:', error);
//         res.status(500).json({ message: 'Server error' });
//     }
// };

export const rejectBid = async (req, res) => {
    try {
        const { quoteId, bidId } = req.params;
        const clientId = req.user.id;

        if (!mongoose.Types.ObjectId.isValid(quoteId) || !mongoose.Types.ObjectId.isValid(bidId)) {
            return res.status(400).json({ message: 'Invalid quote or bid ID' });
        }

        const quote = await RequestQuote.findById(quoteId)
            .populate('client', 'firstName lastName email currentRole')
            .populate('tasker', 'firstName lastName email currentRole');

        if (!quote) {
            return res.status(404).json({ message: 'Quote not found' });
        }

        if (quote.client._id.toString() !== clientId) {
            return res.status(403).json({ message: 'Unauthorized: Only the client can reject bids' });
        }

        if (quote.status !== 'bidded' && quote.status !== 'pending') {
            return res.status(400).json({ message: 'Cannot reject bid on this quote' });
        }

        // Find and update the specific bid
        const bid = quote.bids.id(bidId);
        if (!bid) {
            return res.status(404).json({ message: 'Bid not found' });
        }

        if (bid.status !== 'pending') {
            return res.status(400).json({ message: 'Bid has already been decided' });
        }

        // Store bid amount before rejecting
        const rejectedBidAmount = bid.bidAmount;

        bid.status = 'rejected';
        await quote.save();

        // Check if all bids are rejected and no accepted; if so, set quote to 'rejected'
        const hasPendingBids = quote.bids.some(b => b.status === 'pending');
        const hasAcceptedBid = quote.bids.some(b => b.status === 'accepted');

        let allBidsRejected = false;
        if (!hasPendingBids && !hasAcceptedBid) {
            quote.status = 'rejected';
            allBidsRejected = true;
            await quote.save();
        }

        const populatedQuote = await RequestQuote.findById(quoteId)
            .populate("tasker", "firstName lastName email phone currentRole")
            .populate("client", "firstName lastName email phone currentRole");

        // FIX: Get client details from database
        const client = await User.findById(clientId).select('firstName lastName');
        const clientName = client
            ? `${client.firstName} ${client.lastName}`
            : "The client";

        // Get tasker details
        const taskerName = quote.tasker
            ? `${quote.tasker.firstName} ${quote.tasker.lastName}`
            : "The tasker";

        // Notification to tasker: bid rejected
        try {
            // Debug: Log notification details
            console.log("Creating bid rejected notification for tasker:", {
                taskerId: quote.tasker._id,
                clientName,
                bidAmount: rejectedBidAmount,
                quoteTaskTitle: quote.taskTitle,
                allBidsRejected
            });

            const notificationTitle = "❌ Bid Not Accepted";
            const notificationMessage = allBidsRejected
                ? `${clientName} has declined your bid of $${rejectedBidAmount} for "${quote.taskTitle}". The quote request has been closed. Don't be discouraged - keep bidding on other opportunities!`
                : `${clientName} has declined your bid of $${rejectedBidAmount} for "${quote.taskTitle}". You can submit a revised bid if you'd like to try again.`;

            await createNotification(
                quote.tasker._id,
                notificationTitle,
                notificationMessage,
                'quote-bid-rejected',
                quoteId
            );
            console.log("✅ Notification created for tasker - bid rejected");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to client
        try {
            const confirmationMessage = allBidsRejected
                ? `You have declined all bids for "${quote.taskTitle}". The quote request has been closed. You can create a new quote request if needed.`
                : `You have declined ${taskerName}'s bid of $${rejectedBidAmount} for "${quote.taskTitle}". ${hasPendingBids ? 'You still have pending bids to review.' : 'The tasker can submit a new bid if interested.'}`;

            await createNotification(
                clientId,
                "Bid Rejection Confirmed",
                confirmationMessage,
                'quote-bid-reject-confirmed',
                quoteId
            );
            console.log("✅ Confirmation notification sent to client");

        } catch (notifErr) {
            console.error("❌ Failed to create client confirmation notification (non-blocking):", notifErr);
        }

        // If all bids rejected, prompt client to try another tasker
        if (allBidsRejected) {
            try {
                await createNotification(
                    clientId,
                    "🔍 Find Another Tasker?",
                    `All bids for "${quote.taskTitle}" have been declined. Would you like to request a quote from another tasker?`,
                    "find-tasker-prompt",
                    quoteId
                );
                console.log("✅ Find tasker prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create find tasker prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: 'Bid rejected successfully', quote: populatedQuote });
    } catch (error) {
        console.error('Error rejecting bid:', error);
        res.status(500).json({ message: 'Server error' });
    }
};



// Update existing updateQuoteStatus to align with new statuses (tasker can still directly accept/reject without bidding)
// export const updateReqQuoteStatus = async (req, res) => {
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

//         // Valid statuses (updated to match schema)
//         const validStatuses = ['accepted', 'rejected', 'completed'];
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

//         const previousStatus = task.status; // Track for notification
//         // Update status and updatedAt
//         task.status = status;
//         task.updatedAt = new Date();
//         await task.save();

//         // Populate tasker and client for response
//         const updatedTask = await RequestQuote.findById(taskId)
//             .populate('tasker', 'firstName lastName email phone role')
//             .populate('client', 'firstName lastName email phone role');

//         // Create notification for the client (status updated) - non-blocking
//         try {
//             const tasker = await User.findById(taskerId).select("firstName lastName");
//             await createNotification(
//                 task.client, // Client ID
//                 "Quote Status Updated",
//                 `Tasker "${tasker.firstName} ${tasker.lastName}" updated the status of your quote request "${task.taskTitle}" to "${status}" (from "${previousStatus}").`,
//                 "quote-status-updated",
//                 taskId // Link to quote request
//             );
//             console.log("Notification created for quote status update"); // Debug
//         } catch (notifErr) {
//             console.error("Failed to create notification (non-blocking):", notifErr); // Log but don't crash
//         }

//         res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
//     } catch (error) {
//         console.error('Error updating task status:', error);
//         res.status(500).json({ message: 'Server error while updating task status', error: error.message });
//     }
// };

export const updateReqQuoteStatus = async (req, res) => {
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

        // Valid statuses (updated to match schema)
        const validStatuses = ['accepted', 'rejected', 'completed'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: `Invalid status value. Must be one of: ${validStatuses.join(', ')}` });
        }

        // Find task with populated data
        const task = await RequestQuote.findById(taskId)
            .populate("tasker", "firstName lastName email")
            .populate("client", "firstName lastName email");

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Verify tasker
        if (task.tasker._id.toString() !== taskerId) {
            return res.status(403).json({ message: 'Unauthorized: You are not the assigned tasker' });
        }

        // Track previous status for notification
        const previousStatus = task.status;

        // Update status and updatedAt
        task.status = status;
        task.updatedAt = new Date();
        await task.save();

        // Populate tasker and client for response
        const updatedTask = await RequestQuote.findById(taskId)
            .populate('tasker', 'firstName lastName email phone role')
            .populate('client', 'firstName lastName email phone role');

        // FIX: Get tasker details from database
        const tasker = await User.findById(taskerId).select("firstName lastName");
        const taskerName = tasker
            ? `${tasker.firstName} ${tasker.lastName}`
            : "The tasker";

        // Get client details
        const clientName = task.client
            ? `${task.client.firstName} ${task.client.lastName}`
            : "The client";

        // Format budget for notifications
        const formattedBudget = task.budget ? `$${task.budget}` : "Negotiable";

        // Format preferred date for notifications if exists
        const formattedDate = task.preferredDateTime
            ? new Date(task.preferredDateTime).toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })
            : "Flexible";

        // Build status-specific notification content
        let clientNotificationTitle = "Quote Status Updated";
        let clientNotificationMessage = "";
        let clientNotificationType = "quote-status-updated";

        let taskerNotificationTitle = "Status Update Confirmed";
        let taskerNotificationMessage = "";

        switch (status) {
            case "accepted":
                clientNotificationTitle = "🎉 Your Quote Request Was Accepted!";
                clientNotificationMessage = `Great news! ${taskerName} has accepted your quote request for "${task.taskTitle}". Budget: ${formattedBudget}, Preferred Date: ${formattedDate}. You can now proceed to book the service or discuss details further.`;
                clientNotificationType = "quote-accepted";

                taskerNotificationTitle = "✅ Quote Acceptance Confirmed";
                taskerNotificationMessage = `You have accepted the quote request for "${task.taskTitle}" from ${clientName}. Budget: ${formattedBudget}, Location: ${task.location}. The client has been notified and can now book your service.`;
                break;

            case "rejected":
                clientNotificationTitle = "❌ Quote Request Declined";
                clientNotificationMessage = `Unfortunately, ${taskerName} is unable to accept your quote request for "${task.taskTitle}" at this time. Don't worry - you can request a quote from another tasker who may be available.`;
                clientNotificationType = "quote-rejected";

                taskerNotificationTitle = "Quote Rejection Confirmed";
                taskerNotificationMessage = `You have declined the quote request for "${task.taskTitle}" from ${clientName}. The client has been notified and may seek another tasker.`;
                break;

            case "completed":
                clientNotificationTitle = "🎉 Quote Request Completed!";
                clientNotificationMessage = `${taskerName} has marked your quote request for "${task.taskTitle}" as completed. We hope you had a great experience! Please leave a review to help others find quality service.`;
                clientNotificationType = "quote-completed";

                taskerNotificationTitle = "✅ Quote Marked as Completed";
                taskerNotificationMessage = `You have successfully completed the quote request for "${task.taskTitle}" with ${clientName}. Great job! The client will be prompted to leave a review.`;
                break;

            default:
                clientNotificationMessage = `${taskerName} updated the status of your quote request for "${task.taskTitle}" from "${previousStatus}" to "${status}".`;
                taskerNotificationMessage = `You updated the quote status for "${task.taskTitle}" to "${status}".`;
        }

        // Create notification for the client
        try {
            // Debug: Log notification details
            console.log("Creating quote status update notification for client:", {
                clientId: task.client._id,
                taskerName,
                status,
                previousStatus,
                taskTitle: task.taskTitle,
                budget: formattedBudget
            });

            await createNotification(
                task.client._id, // Client ID
                clientNotificationTitle,
                clientNotificationMessage,
                clientNotificationType,
                taskId
            );
            console.log("✅ Notification created for client - quote status update");

        } catch (notifErr) {
            console.error("❌ Failed to create client notification (non-blocking):", notifErr);
        }

        // Send confirmation notification to tasker
        try {
            await createNotification(
                taskerId, // Tasker ID
                taskerNotificationTitle,
                taskerNotificationMessage,
                "quote-status-update-confirmed",
                taskId
            );
            console.log("✅ Confirmation notification sent to tasker");

        } catch (notifErr) {
            console.error("❌ Failed to create tasker confirmation notification (non-blocking):", notifErr);
        }

        // Additional status-specific prompts and notifications
        if (status === "accepted") {
            // Prompt client to book or schedule
            try {
                await createNotification(
                    task.client._id,
                    "📅 Ready to Book?",
                    `${taskerName} has accepted your quote for "${task.taskTitle}". Click here to book their service now and secure your preferred date!`,
                    "booking-prompt",
                    taskId
                );
                console.log("✅ Booking prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create booking prompt notification (non-blocking):", notifErr);
            }

            // Send availability reminder to tasker
            try {
                await createNotification(
                    taskerId,
                    "📋 Service Preparation",
                    `You've accepted the quote for "${task.taskTitle}". Make sure you're available on ${formattedDate} or coordinate with ${clientName} for scheduling.`,
                    "service-preparation",
                    taskId
                );
                console.log("✅ Service preparation notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create service preparation notification (non-blocking):", notifErr);
            }

        } else if (status === "completed") {
            // Prompt client for review
            try {
                await createNotification(
                    task.client._id,
                    "⭐ Leave a Review",
                    `How was your experience with ${taskerName} for "${task.taskTitle}"? Your feedback helps others find great taskers and helps taskers improve their services!`,
                    "review-prompt",
                    taskId
                );
                console.log("✅ Review prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create review prompt notification (non-blocking):", notifErr);
            }

            // Send thank you and earnings notification to tasker
            try {
                const earningsMessage = task.budget
                    ? `You've successfully completed "${task.taskTitle}" for ${clientName}. Your earnings of ${formattedBudget} will be processed. Thank you for providing excellent service!`
                    : `You've successfully completed "${task.taskTitle}" for ${clientName}. Thank you for providing excellent service!`;

                await createNotification(
                    taskerId,
                    "💪 Great Work Completed!",
                    earningsMessage,
                    "quote-work-completed",
                    taskId
                );
                console.log("✅ Work completed notification sent to tasker");

            } catch (notifErr) {
                console.error("❌ Failed to create work completed notification (non-blocking):", notifErr);
            }

        } else if (status === "rejected") {
            // Prompt client to find another tasker
            try {
                await createNotification(
                    task.client._id,
                    "🔍 Find Another Tasker",
                    `Your quote request for "${task.taskTitle}" was declined. Would you like to browse other available taskers or post your request to multiple taskers?`,
                    "find-tasker-prompt",
                    taskId
                );
                console.log("✅ Find tasker prompt notification sent to client");

            } catch (notifErr) {
                console.error("❌ Failed to create find tasker prompt notification (non-blocking):", notifErr);
            }
        }

        res.status(200).json({ message: 'Task status updated successfully', task: updatedTask });
    } catch (error) {
        console.error('Error updating task status:', error);
        res.status(500).json({ message: 'Server error while updating task status', error: error.message });
    }
};



// ... (rest of existing code remains unchanged)

export { createBooking, getAllBookings, getBookingsByUserId, updateBooking, deleteBooking, createRequestQuote, getAllRequestQuotes, getRequestQuotesByClientId, updateRequestQuote, deleteRequestQuote, };