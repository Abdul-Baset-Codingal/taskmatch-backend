// // routes/adminPaymentRoutes.js
// import express from 'express';
// // import { authenticate, isAdmin } from '../middleware/aut';
// import {
//     getPaymentDashboard,
//     getPendingPayouts,
//     getAllTransactions,
//     getTransactionDetails,
//     getTaskerEarnings,
//     processTaskerPayout,
//     processBulkPayouts,
//     processPayoutByTasker,
//     getPlatformSettings,
//     updatePlatformSettings,
//     refundTransaction,
//     getPaymentAnalytics,
//     getStripePaymentsWithTaskerData,
//     syncStripeToDatabase,
//     getPendingPayoutsWithTaskerDetails,
//     capturePayment,
//     cancelPayment
// } from '../controllers/adminPaymentController.js';
// import verifyToken from '../middlewares/verifyToken.js';


// const router = express.Router();

// // Apply auth middleware to all routes
// // router.use(authenticate);
// // router.use(isAdmin);

// // Dashboard
// router.get('/dashboard', getPaymentDashboard);

// // Transactions
// router.get('/transactions', getAllTransactions);
// router.get('/transactions/:transactionId', getTransactionDetails);

// // Pending Payouts
// router.get('/pending-payouts', getPendingPayouts);

// // Tasker Earnings
// router.get('/tasker/:taskerId/earnings', getTaskerEarnings);

// // Process Payouts
// router.post('/payout/:transactionId', processTaskerPayout);
// router.post('/payout/tasker/:taskerId', processPayoutByTasker);

// // Capture & Cancel Payments - ADD THESE
// router.post('/capture/:taskId', capturePayment);
// router.post('/cancel/:taskId', cancelPayment);

// // Refunds
// router.post('/refund/:transactionId', refundTransaction);

// // Settings
// router.get('/settings', getPlatformSettings);
// router.put('/settings',verifyToken, updatePlatformSettings);

// // Analytics
// router.get('/analytics', getPaymentAnalytics);




// // Stripe data with enriched tasker info
// router.get('/stripe-payments', getStripePaymentsWithTaskerData);

// // Sync from Stripe to database
// router.post('/sync-stripe', syncStripeToDatabase);

// // Pending payouts with tasker details
// router.get('/pending-payouts', getPendingPayoutsWithTaskerDetails);

// export default router;


// routes/adminPaymentRoutes.js
import express from 'express';
import verifyToken from '../middlewares/verifyToken.js';
import {
    // Dashboard
    getPaymentDashboard,

    // Transactions
    getAllTransactions,
    getTransactionDetails,

    // Stripe Payments
    getStripePaymentsWithTaskerData,
    syncStripeToDatabase,

    // Pending Payouts
    getPendingPayoutsWithTaskerDetails,

    // Process Payouts
    processTaskerPayout,
    processBulkPayouts,
    completeManualPayout,

    // Capture & Cancel
    capturePayment,
    cancelPayment,

    // Refunds
    refundTransaction,

    // Tasker Earnings & Bank Details
    getTaskerEarnings,
    getTaskerBankDetails,

    // Settings
    getPlatformSettings,
    updatePlatformSettings,

    // Analytics
    getPaymentAnalytics
} from '../controllers/adminPaymentController.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==================== DASHBOARD ====================
router.get('/dashboard', getPaymentDashboard);

// ==================== STRIPE PAYMENTS ====================
router.get('/stripe-payments', getStripePaymentsWithTaskerData);
router.post('/sync-stripe', syncStripeToDatabase);

// ==================== TRANSACTIONS ====================
router.get('/transactions', getAllTransactions);
router.get('/transactions/:transactionId', getTransactionDetails);

// ==================== PENDING PAYOUTS ====================
// Note: Single route for pending payouts with bank details
router.get('/pending-payouts', getPendingPayoutsWithTaskerDetails);

// ==================== PROCESS PAYOUTS ====================
// IMPORTANT: Put specific routes BEFORE parameterized routes

// Bulk payout - MUST come before /payout/:transactionId
router.post('/payout/bulk', processBulkPayouts);

// Complete manual payout
router.post('/payout/:transactionId/complete', completeManualPayout);

// Process single payout (to bank account)
router.post('/payout/:transactionId', processTaskerPayout);

// ==================== CAPTURE & CANCEL PAYMENTS ====================
router.post('/capture/:taskId', capturePayment);
router.post('/cancel/:taskId', cancelPayment);

// ==================== REFUNDS ====================
router.post('/refund/:transactionId', refundTransaction);

// ==================== TASKER INFO ====================
router.get('/tasker/:taskerId/earnings', getTaskerEarnings);
router.get('/tasker/:taskerId/bank-details', getTaskerBankDetails);

// ==================== SETTINGS ====================
router.get('/settings', getPlatformSettings);
router.put('/settings', updatePlatformSettings);

// ==================== ANALYTICS ====================
router.get('/analytics', getPaymentAnalytics);

export default router;