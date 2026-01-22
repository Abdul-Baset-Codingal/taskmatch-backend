// routes/taskerPaymentRoutes.js

import express from 'express';
import {
    getTaskerPaymentHistory,
    getTaskerEarningsSummary,
    getTaskerPaymentDetails,
    downloadTaskerReceipt,
} from '../controllers/paymentHistoryControllerTasker.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();

// Tasker payment/earnings routes
router.get('/history', verifyToken, getTaskerPaymentHistory);
router.get('/summary', verifyToken, getTaskerEarningsSummary);
router.get('/details/:taskId', verifyToken, getTaskerPaymentDetails);
router.get('/receipt/:taskId', verifyToken, downloadTaskerReceipt);

export default router;