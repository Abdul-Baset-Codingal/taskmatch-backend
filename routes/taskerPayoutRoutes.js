// routes/taskerPayoutRoutes.js
import express from 'express';
import {
    createStripeConnectAccount,
    getStripeConnectStatus,
    getStripeBalance,
    getStripeDashboardLink,
    getPayoutHistory
} from '../controllers/taskerPayoutController.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();


// Stripe Connect
router.post('/stripe/connect',verifyToken, createStripeConnectAccount);
router.get('/stripe/status', verifyToken, getStripeConnectStatus);
router.get('/stripe/balance', verifyToken, getStripeBalance);
router.get('/stripe/dashboard', verifyToken, getStripeDashboardLink);

// Payouts
router.get('/payouts', getPayoutHistory);

export default router;