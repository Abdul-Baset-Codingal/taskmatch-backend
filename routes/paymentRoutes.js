// routes/paymentRoutes.js

import express from 'express';
import {
    createPaymentIntent,
    confirmPaymentAuthorization,
    captureAndPayoutTasker,
    processManualPayout,
    refundPayment
} from '../controllers/paymentController.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();


// Client routes
router.post('/create-intent', verifyToken, createPaymentIntent);
router.post('/confirm-authorization', verifyToken , confirmPaymentAuthorization);

// Task completion - triggers auto payout
router.post('/capture/:taskId', verifyToken , captureAndPayoutTasker);

// Admin routes
router.post('/manual-payout/:transactionId', verifyToken, processManualPayout);
router.post('/refund/:transactionId', verifyToken , refundPayment);

export default router;