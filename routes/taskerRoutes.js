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
} from "../controllers/taskerController.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = express.Router();

// Booking Routes
router.post("/bookings", verifyToken , createBooking);
router.get("/bookings", getAllBookings);
router.get("/bookings/user/:userId", getBookingsByUserId);
router.patch("/bookings/:id", updateBooking);
router.delete("/bookings/:id", deleteBooking);

// Request Quote Routes
router.post("/request-quotes", verifyToken, createRequestQuote);
router.get("/request-quotes", getAllRequestQuotes);
router.get("/request-quotes/client/:clientId", getRequestQuotesByClientId);
router.patch("/request-quotes/:id", updateRequestQuote);
router.delete("/request-quotes/:id", deleteRequestQuote);

export default router;