// routes/adminTaskRoutes.js
import express from "express";
import {
    getAllTasksAdmin,
    getTaskByIdAdmin,
    updateTaskAdmin,
    deleteTaskAdmin,
    bulkDeleteTasksAdmin,
    getTaskStatistics,
    changeTaskStatusAdmin,
    refundTaskPaymentAdmin,
    exportTasksAdmin,
    toggleCommentBlock,
    deleteBidAdmin
} from "../controllers/adminTaskController.js";

const router = express.Router();

// Apply authentication and admin middleware to all routes


// Statistics
router.get("/statistics", getTaskStatistics);

// Export
router.get("/export", exportTasksAdmin);

// Tasks CRUD
router.get("/", getAllTasksAdmin);
router.get("/:taskId", getTaskByIdAdmin);
router.put("/:taskId", updateTaskAdmin);
router.delete("/:taskId", deleteTaskAdmin);

// Bulk operations
router.post("/bulk-delete", bulkDeleteTasksAdmin);

// Status management
router.patch("/:taskId/status", changeTaskStatusAdmin);

// Payment management
router.post("/:taskId/refund", refundTaskPaymentAdmin);

// Comment moderation
router.patch("/:taskId/comments/:commentId/block", toggleCommentBlock);

// Bid management
router.delete("/:taskId/bids/:bidId", deleteBidAdmin);

export default router;