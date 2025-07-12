// routes/booking.routes.js
import express from "express";
import {
    createBooking,
    getAllBookings,
    getBookingById,
    updateBooking,
    deleteBooking,
} from "../controllers/bookingController.js";
import verifyToken from "../middlewares/verifyToken.js";
import protect from '../middlewares/authMiddleware.js';

const router = express.Router();

router.post("/", verifyToken,protect, createBooking);
router.get("/", verifyToken, getAllBookings);
router.get("/:id", verifyToken, getBookingById);
router.patch("/:id", verifyToken, updateBooking);
router.delete("/:id", verifyToken, deleteBooking);

export default router;
