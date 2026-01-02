// routes/stripeConnectRoutes.js

import express from 'express';
import {
    getOnboardingLink,
    checkConnectStatus,
    getDashboardLink,
    createConnectAccount
} from '../utils/stripeConnect.js';
import verifyToken from '../middlewares/verifyToken.js';

const router = express.Router();

// ==================== TASKER ONBOARDING ====================

/**
 * Start Stripe Connect onboarding
 * POST /api/stripe/connect/onboard
 */
router.post('/onboard', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const url = await getOnboardingLink(userId);
        res.json({
            success: true,
            url,
            message: 'Redirect the user to this URL to complete Stripe onboarding'
        });
    } catch (error) {
        console.error('Stripe Connect onboard error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Check Connect account status
 * GET /api/stripe/connect/status
 */
router.get('/status', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const status = await checkConnectStatus(userId);
        res.json({
            success: true,
            ...status
        });
    } catch (error) {
        console.error('Stripe Connect status error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Get Stripe Express Dashboard link
 * GET /api/stripe/connect/dashboard
 */
router.get('/dashboard', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const url = await getDashboardLink(userId);
        res.json({
            success: true,
            url,
            message: 'Redirect the user to this URL to view their Stripe dashboard'
        });
    } catch (error) {
        console.error('Stripe Connect dashboard error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Create Connect account (alternative to onboard)
 * POST /api/stripe/connect/create-account
 */
router.post('/create-account', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const accountId = await createConnectAccount(userId);
        res.json({
            success: true,
            accountId,
            message: 'Stripe Connect account created. Complete onboarding to activate.'
        });
    } catch (error) {
        console.error('Stripe Connect create account error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * Refresh onboarding link (if previous one expired)
 * POST /api/stripe/connect/refresh-onboarding
 */
router.post('/refresh-onboarding', verifyToken, async (req, res) => {
    try {
        const userId = req.user._id || req.user.id;
        const url = await getOnboardingLink(userId);
        res.json({
            success: true,
            url,
            message: 'New onboarding link generated'
        });
    } catch (error) {
        console.error('Stripe Connect refresh error:', error);
        res.status(400).json({
            success: false,
            error: error.message
        });
    }
});

// ✅ IMPORTANT: Export the router as default
export default router;