// routes/booking.routes.js
import express from "express";
import {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
    getBookingsByTaskerId,
    updateBookingStatus,
} from "../controllers/bookingController.js";
import verifyToken from "../middlewares/verifyToken.js";
import protect from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post("/", verifyToken,protect, createBooking);
router.get("/", verifyToken, getAllBookings);
router.get("/:id", verifyToken, getBookingById);
router.get('/tasker/:taskerId', verifyToken, getBookingsByTaskerId);
// Update booking status
router.put('/:bookingId/status', verifyToken, updateBookingStatus);
router.patch("/:id", verifyToken, updateBooking);
router.delete("/:id", verifyToken, deleteBooking);

export default router;
