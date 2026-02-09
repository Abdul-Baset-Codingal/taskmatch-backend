// routes/walletRoutes.js
import express from "express";
import protectRoute from "../middlewares/authMiddleware.js";
import {
    getWalletBalance,
    getWalletTransactions,
    getEarningsBreakdown,
    createWithdrawalRequest,
    getMyWithdrawalRequests,
    cancelWithdrawalRequest,
    getAllWithdrawalRequests,
    approveWithdrawalRequest,
    rejectWithdrawalRequest,
} from "../controllers/walletController.js";

const router = express.Router();

// ==================== TASKER ROUTES ====================
router.get("/balance", protectRoute, getWalletBalance);
router.get("/transactions", protectRoute, getWalletTransactions);
router.get("/earnings", protectRoute, getEarningsBreakdown);
router.post("/withdraw", protectRoute, createWithdrawalRequest);
router.get("/withdrawals", protectRoute, getMyWithdrawalRequests);
router.delete("/withdraw/:id", protectRoute, cancelWithdrawalRequest);

// ==================== ADMIN ROUTES ====================
router.get("/admin/withdrawals", protectRoute, getAllWithdrawalRequests);
router.put("/admin/withdrawals/:id/approve", protectRoute, approveWithdrawalRequest);
router.put("/admin/withdrawals/:id/reject", protectRoute, rejectWithdrawalRequest);

export default router;