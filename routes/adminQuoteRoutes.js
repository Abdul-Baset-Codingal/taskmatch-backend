// // routes/adminQuoteRoutes.js
// import express from 'express';
// import {
//     getAllQuotes,
//     getQuoteStatistics,
//     getQuoteById,
//     updateQuoteStatus,
//     adminCancelQuote,
//     adminCapturePayment,
//     adminRefundPayment,
//     getRevenueReport,
//     exportQuotes,
//     getQuoteDisputes,
//     bulkUpdateQuotes,
//     getQuoteAdminHistory,
// } from '../controllers/adminQuoteController.js';

// const router = express.Router();

// // All routes require authentication and admin role
// // router.use(protect);
// // router.use(adminOnly);

// // ==================== GET ROUTES ====================

// // Get all quotes with pagination and filters
// // GET /api/admin/quotes?page=1&limit=20&status=pending&search=...
// router.get('/', getAllQuotes);

// // Get quote statistics for dashboard
// // GET /api/admin/quotes/statistics?startDate=...&endDate=...
// router.get('/statistics', getQuoteStatistics);

// // Get revenue report
// // GET /api/admin/quotes/revenue?startDate=...&endDate=...&groupBy=day
// router.get('/revenue', getRevenueReport);

// // Get disputed/problematic quotes
// // GET /api/admin/quotes/disputes?page=1&limit=20
// router.get('/disputes', getQuoteDisputes);

// // Export quotes data
// // GET /api/admin/quotes/export?format=csv&startDate=...
// router.get('/export', exportQuotes);

// // Get single quote with full details
// // GET /api/admin/quotes/:quoteId
// router.get('/:quoteId', getQuoteById);

// // Get admin action history for a quote
// // GET /api/admin/quotes/:quoteId/history
// router.get('/:quoteId/history', getQuoteAdminHistory);

// // ==================== POST ROUTES ====================

// // Bulk update quotes
// // POST /api/admin/quotes/bulk
// router.post('/bulk', bulkUpdateQuotes);

// // Cancel quote with refund
// // POST /api/admin/quotes/:quoteId/cancel
// router.post('/:quoteId/cancel', adminCancelQuote);

// // Manually capture payment
// // POST /api/admin/quotes/:quoteId/capture
// router.post('/:quoteId/capture', adminCapturePayment);

// // Manually refund payment
// // POST /api/admin/quotes/:quoteId/refund
// router.post('/:quoteId/refund', adminRefundPayment);

// // ==================== PATCH ROUTES ====================

// // Update quote status
// // PATCH /api/admin/quotes/:quoteId/status
// router.patch('/:quoteId/status', updateQuoteStatus);

// export default router;


// routes/adminQuoteRoutes.js
import express from 'express';
import {
    getAllQuotes,
    getQuoteStatistics,
    getQuoteById,
    updateQuoteStatus,
    adminCancelQuote,
    adminCapturePayment,
    adminRefundPayment,
    getRevenueReport,
    exportQuotes,
    getQuoteDisputes,
    bulkUpdateQuotes,
    getQuoteAdminHistory,
    // New functions
    deleteQuote,
    sendNotification,
    forceCompleteQuote,
    flagQuote,
    reassignQuote,
    extendDeadline,
    addAdminNote,
} from '../controllers/adminQuoteController.js';
import { adminProtect } from '../middlewares/adminProtect.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(adminProtect);

// ==================== GET ROUTES ====================
router.get('/', getAllQuotes);
router.get('/statistics', getQuoteStatistics);
router.get('/revenue', getRevenueReport);
router.get('/disputes', getQuoteDisputes);
router.get('/export', exportQuotes);
router.get('/:quoteId', getQuoteById);
router.get('/:quoteId/history', getQuoteAdminHistory);

// ==================== POST ROUTES ====================
router.post('/bulk', bulkUpdateQuotes);
router.post('/:quoteId/cancel', adminCancelQuote);
router.post('/:quoteId/capture', adminCapturePayment);
router.post('/:quoteId/refund', adminRefundPayment);
router.post('/:quoteId/notify', sendNotification);
router.post('/:quoteId/force-complete', forceCompleteQuote);
router.post('/:quoteId/flag', flagQuote);
router.post('/:quoteId/reassign', reassignQuote);
router.post('/:quoteId/extend-deadline', extendDeadline);
router.post('/:quoteId/notes', addAdminNote);

// ==================== PATCH ROUTES ====================
router.patch('/:quoteId/status', updateQuoteStatus);

// ==================== DELETE ROUTES ====================
router.delete('/:quoteId', deleteQuote);

export default router;