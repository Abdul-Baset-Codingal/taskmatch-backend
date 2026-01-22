// routes/admin/adminBookingRoutes.js
import express from 'express';
// import { protect } from '../../middleware/authMiddleware.js';
// import { isAdmin, isSuperAdmin } from '../../middleware/adminMiddleware.js';
import {
    getAllBookings,
    getBookingDetails,
    updateBooking,
    updateBookingStatus,
    deleteBooking,
    bulkDeleteBookings,
    cancelBooking,
    capturePayment,
    forceCompleteBooking,
    reassignTasker,
    getBookingStatistics,
    exportBookings,
    bulkUpdateStatus,
    addAdminNote,
    refundPayment
} from '../controllers/adminBookingController.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();

// All routes require authentication and admin role
// router.use(protect);
// router.use(isAdmin);

// ==================== GET ROUTES ====================
router.get('/', getAllBookings);
router.get('/statistics', getBookingStatistics);
router.get('/export', exportBookings);
router.get('/:bookingId', getBookingDetails);

// ==================== UPDATE ROUTES ====================
router.put('/:bookingId', updateBooking);
router.patch('/:bookingId/status', updateBookingStatus);
router.patch('/bulk/status', bulkUpdateStatus);

// ==================== ACTION ROUTES ====================
router.post('/:bookingId/cancel', cancelBooking);
router.post('/:bookingId/capture', capturePayment);
router.post('/:bookingId/refund', refundPayment);
router.post('/:bookingId/complete', forceCompleteBooking);
router.post('/:bookingId/reassign', reassignTasker);
router.post('/:bookingId/note', addAdminNote);

// ==================== DELETE ROUTES ====================
router.delete('/:bookingId',verifyToken, deleteBooking);
router.delete('/bulk/delete', bulkDeleteBookings);

// ==================== SUPER ADMIN ONLY ====================
// router.delete('/:bookingId/permanent', (req, res, next) => {
//     req.body.hardDelete = true;
//     deleteBooking(req, res, next);
// });

router.delete('/:bookingId/permanent', deleteBooking );

export default router;