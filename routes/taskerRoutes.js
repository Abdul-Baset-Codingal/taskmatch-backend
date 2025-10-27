import express from "express";
import {
    createBooking,
    getAllBookings,
    getBookingsByUserId,
    updateBooking,
    deleteBooking,
    createRequestQuote,
    getAllRequestQuotes,
    getRequestQuotesByClientId,
    updateRequestQuote,
    deleteRequestQuote,
    getBookingsByTaskerId,
    updateBookingStatus,
    addReview,
    updateQuoteStatus,
    getTasksByTaskerIdAndStatus,
    getQuotesByTasker,
    updateQuoteRequest,
} from "../controllers/taskerController.js";
import verifyToken from "../middlewares/verifyToken.js";
import { restrictTo } from "../middlewares/restrictTo.js";

const router = express.Router();

// Booking Routes
router.post("/bookings", verifyToken , createBooking);
router.get("/bookings", getAllBookings);
router.get("/bookings/user/:userId", getBookingsByUserId);
router.patch("/bookings/:id", updateBooking);
router.post("/reviews", verifyToken, restrictTo("client"), addReview);
router.delete("/bookings/:id", deleteBooking);
// Fetch bookings by tasker ID
router.get('/tasker/:taskerId', verifyToken, getBookingsByTaskerId);

// Update booking status
router.put('/:id', verifyToken, updateBookingStatus);
// Request Quote Routes
// --------------------------------------------
router.get('/quotes/tasker/:taskerId', verifyToken, getQuotesByTasker);

// Update a specific quote request
router.put('/quotes/:quoteId', verifyToken, updateQuoteRequest);
// -----------------------------------------------
router.post("/request-quotes", verifyToken, createRequestQuote);
router.get("/request-quotes", getAllRequestQuotes);
router.get('/tasker-quotes/:id', verifyToken, getTasksByTaskerIdAndStatus);

// Route: PATCH /api/request-quotes/:taskId/status
router.patch('/:taskId/status', verifyToken, updateQuoteStatus);
router.get("/request-quotes/client/:clientId", getRequestQuotesByClientId);
router.patch("/request-quotes/:id", updateRequestQuote);
router.delete("/request-quotes/:id", deleteRequestQuote);

export default router;