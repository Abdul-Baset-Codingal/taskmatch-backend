import mongoose from "mongoose";
import BookingTaskerSchema from "../models/bookingTasker.js";
import RequestQuote from "../models/requestQuote.js";
import User from "../models/user.js";
// Create Booking
const createBooking = async (req, res) => {
    try {
        const { taskerId, service } = req.body;
        const clientId = req.user?.id;
        console.log(req.body)
        if (!clientId) {
            return res.status(401).json({ message: "Unauthorized: User not authenticated" });
        }

        if (!mongoose.Types.ObjectId.isValid(taskerId) || !mongoose.Types.ObjectId.isValid(clientId)) {
            return res.status(400).json({ message: "Invalid tasker or client ID" });
        }

        if (!service || !service.title || !service.description || !service.hourlyRate || !service.estimatedDuration) {
            return res.status(400).json({ message: "Service details are required" });
        }

        const tasker = await mongoose.models.User.findById(taskerId);
        if (!tasker || tasker.role !== "tasker") {
            return res.status(400).json({ message: "Tasker not found or invalid role" });
        }

        const client = await mongoose.models.User.findById(clientId);
        if (!client || client.role !== "client") {
            return res.status(400).json({ message: "Client not found or invalid role" });
        }

        const booking = new BookingTaskerSchema({
            tasker: taskerId,
            client: clientId,
            service,
            status: "pending",
        });

        await booking.save();

        const populatedBooking = await BookingTaskerSchema.findById(booking._id)
            .populate("tasker", "fullName email phone profilePicture role")
            .populate("client", "fullName email phone role");

        res.status(201).json({ message: "Booking created successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error creating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get All Bookings
const getAllBookings = async (req, res) => {
    try {
        const bookings = await BookingTaskerSchema.find()
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");
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

        const bookings = await BookingTaskerSchema.find({ client: userId })
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");

        res.status(200).json(bookings);
    } catch (error) {
        console.error("Error fetching user bookings:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Update Booking
const updateBooking = async (req, res) => {
    try {
        const { id } = req.params;
        const { status, service } = req.body;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }
        const booking = await BookingTaskerSchema.findById(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        if (status) booking.status = status;
        if (service) booking.service = service;
        await booking.save();
        const populatedBooking = await Booking.findById(id)
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");
        res.status(200).json({ message: "Booking updated successfully", booking: populatedBooking });
    } catch (error) {
        console.error("Error updating booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete Booking
const deleteBooking = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid booking ID" });
        }
        const booking = await BookingTaskerSchema.findByIdAndDelete(id);
        if (!booking) {
            return res.status(404).json({ message: "Booking not found" });
        }
        res.status(200).json({ message: "Booking deleted successfully" });
    } catch (error) {
        console.error("Error deleting booking:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Create Request Quote
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
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");

        res.status(201).json({ message: "Quote request created successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error creating quote request:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Get All Request Quotes
const getAllRequestQuotes = async (req, res) => {
    try {
        const requestQuotes = await RequestQuote.find()
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");
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
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");

        res.status(200).json(quotes);
    } catch (error) {
        console.error("Error fetching request quotes by client:", error);
        res.status(500).json({ message: "Server error" });
    }
};


// Update Request Quote
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
        if (status) requestQuote.status = status;
        if (taskTitle) requestQuote.taskTitle = taskTitle;
        if (taskDescription) requestQuote.taskDescription = taskDescription;
        if (location) requestQuote.location = location;
        if (budget !== undefined) requestQuote.budget = budget;
        if (preferredDateTime) requestQuote.preferredDateTime = new Date(preferredDateTime);
        if (urgency) requestQuote.urgency = urgency;
        await requestQuote.save();
        const populatedRequestQuote = await RequestQuote.findById(id)
            .populate("tasker", "fullName email phone role")
            .populate("client", "fullName email phone role");
        res.status(200).json({ message: "Request quote updated successfully", requestQuote: populatedRequestQuote });
    } catch (error) {
        console.error("Error updating request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};

// Delete Request Quote
const deleteRequestQuote = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: "Invalid request quote ID" });
        }
        const requestQuote = await RequestQuote.findByIdAndDelete(id);
        if (!requestQuote) {
            return res.status(404).json({ message: "Request quote not found" });
        }
        res.status(200).json({ message: "Request quote deleted successfully" });
    } catch (error) {
        console.error("Error deleting request quote:", error);
        res.status(500).json({ message: "Server error" });
    }
};

export { createBooking, getAllBookings, getBookingsByUserId, updateBooking, deleteBooking, createRequestQuote, getAllRequestQuotes, getRequestQuotesByClientId, updateRequestQuote, deleteRequestQuote };