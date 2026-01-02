// routes/clientPaymentRoutes.js

import express from 'express';
import verifyToken from '../middlewares/verifyToken.js';
import {
    createSetupIntent,
    savePaymentMethod,
    getPaymentMethods
} from '../controllers/clientPaymentController.js';

const router = express.Router();

router.post('/setup-intent', verifyToken, createSetupIntent);
router.post('/save', verifyToken, savePaymentMethod);
router.get('/methods', verifyToken, getPaymentMethods);

export default router;