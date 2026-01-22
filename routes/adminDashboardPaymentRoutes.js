import express from 'express';
import {
    // Tab 1: Transactions & Ledger
    getGlobalTransactions,
    getTransactionDetails,
    exportTransactions,
    getLedgerSummary,

    // Tab 2: Refund & Adjustment
    processRefund,
    getRefundHistory,
    createAdjustment,

    // Tab 3: Payouts (Tasker)
    getTaskerPayouts,
    getTaskerPayoutDetails,
    getPayoutHistory,
    initiateManualPayout,

    // Tab 4: Platform Fees & Pricing
    getPlatformConfig,
    updatePlatformConfig,
    getFeeHistory,
    simulateFees,

    // Tab 5: Disputes
    getDisputes,
    getDisputeDetails,
    submitDisputeEvidence,
    getDisputeStats
} from '../controllers/adminDashboardPaymentController.js';
import { adminProtect } from '../middlewares/adminProtect.js';

const router = express.Router();

router.use(adminProtect);

// ============================================================
// TAB 1: TRANSACTIONS & LEDGER
// ============================================================

router.get('/transactions', getGlobalTransactions);

// ⚠️ FIXED: Static routes MUST come BEFORE parameterized routes
router.get('/transactions/export', exportTransactions);  // ✅ Moved up
router.get('/transactions/:type/:id', getTransactionDetails);

router.get('/ledger/summary', getLedgerSummary);

// ============================================================
// TAB 2: REFUNDS & ADJUSTMENTS
// ============================================================

router.post('/refund', processRefund);
router.get('/refunds', getRefundHistory);
router.post('/adjustment', createAdjustment);

// ============================================================
// TAB 3: PAYOUTS (TASKER)
// ============================================================

router.get('/payouts', getTaskerPayouts);

// ⚠️ FIXED: Static route before parameterized route
router.post('/payouts/manual', initiateManualPayout);  // ✅ Fixed typo: was "r.post"
router.get('/payouts/:taskerId', getTaskerPayoutDetails);
router.get('/payouts/:taskerId/history', getPayoutHistory);

// ============================================================
// TAB 4: PLATFORM FEES & PRICING
// ============================================================

router.get('/config', getPlatformConfig);
router.put('/config', updatePlatformConfig);
router.get('/config/history', getFeeHistory);
router.post('/config/simulate', simulateFees);

// ============================================================
// TAB 5: DISPUTES
// ============================================================

router.get('/disputes', getDisputes);

// ⚠️ FIXED: Static route before parameterized route
router.get('/disputes/stats', getDisputeStats);  // ✅ Already correct, but confirmed
router.get('/disputes/:disputeId', getDisputeDetails);
router.post('/disputes/:disputeId/evidence', submitDisputeEvidence);

export default router;