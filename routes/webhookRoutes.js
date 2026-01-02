// routes/webhookRoutes.js

import express from 'express';
import { handleStripeWebhook } from '../controllers/webhookController.js';

const router = express.Router();

// Webhook must use raw body - no JSON parsing!
router.post(
    '/stripe',
    express.raw({ type: 'application/json' }),
    handleStripeWebhook
);

export default router;