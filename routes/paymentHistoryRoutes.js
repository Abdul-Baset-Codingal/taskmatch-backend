// routes/paymentRoutes.js

import express from 'express';
import {
    getClientPaymentHistory,
    getPaymentDetails,
    downloadReceipt,
    getClientPaymentSummary,
} from '../controllers/paymentHistoryController.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();

// Client payment routes
router.get('/client/history', verifyToken, getClientPaymentHistory);
router.get('/client/summary', verifyToken, getClientPaymentSummary);
router.get('/details/:taskId', verifyToken, getPaymentDetails);
router.get('/receipt/:taskId', verifyToken, downloadReceipt);

export default router;