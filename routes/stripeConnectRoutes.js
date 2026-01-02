// routes/stripeConnectRoutes.js

import express from 'express';
import {
    createConnectAccount,
    getConnectAccountStatus,
    createOnboardingLink,
    createDashboardLink,
    getConnectBalance,
    getPayoutHistory,
    disconnectAccount,
} from '../controllers/stripeConnectController.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();

// All routes require authentication and tasker role


router.post('/create-account',verifyToken, createConnectAccount);
router.get('/status', verifyToken, getConnectAccountStatus);
router.post('/onboarding-link', verifyToken, createOnboardingLink);
router.post('/dashboard-link', verifyToken, createDashboardLink);
router.get('/balance', verifyToken, getConnectBalance);
router.get('/payouts', verifyToken, getPayoutHistory);
router.delete('/disconnect', verifyToken, disconnectAccount);

export default router;