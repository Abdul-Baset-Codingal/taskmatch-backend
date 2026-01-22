// routes/adminLogRoutes.js
import express from "express";
import {
    getAllLogs,
    getLogStats,
    getUserLogs,
    getRecentLogs,
    deleteOldLogs,
    exportLogs,
} from "../controllers/adminLogController.js";
import { adminProtect } from '../middlewares/adminProtect.js';

const router = express.Router();

// All routes require admin authentication
router.use(adminProtect);



// Get all logs with filters and pagination
router.get("/", getAllLogs);

// Get log statistics for dashboard
router.get("/stats", getLogStats);

// Get recent logs (for live updates)
router.get("/recent", getRecentLogs);

// Get logs for a specific user
router.get("/user/:userId", getUserLogs);

// Export logs
router.get("/export", exportLogs);

// Delete old logs (cleanup)
router.delete("/cleanup", deleteOldLogs);

export default router;