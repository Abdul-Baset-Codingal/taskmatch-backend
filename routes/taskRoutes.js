import express from "express";
import {
  createTask,
  addBidToTask,
  acceptTaskByTasker,
  getAllTasks,
  getTaskById,
  getTaskFilters,
  getUrgentTasksByStatus,
  getTasksByClient,
  requestCompletionByTasker,
  getTasksByStatus,
  getTasksExcludingStatus,
  replyToComment,
  updateTaskStatusByClient,
  addCommentToTask,
  updateTask,
  deleteTask,
  deleteTaskAdnmin,
  bulkDeleteTasks,
  getScheduledTasksByStatus,
  getCompletedAndInProgressTasks,
  acceptBidByClient,
  addTaskReview,
  getTasksByTaskerIdAndStatus,
  getFlexibleTasksByStatus,
  declineByTasker,
} from "../controllers/taskController.js";
import verifyToken from "../middlewares/verifyToken.js";
import upload from "../utils/multerConfig.js";
import { restrictTo } from "../middlewares/restrictTo.js";

const router = express.Router();

router.get("/schedule", getScheduledTasksByStatus);
router.get("/urgent", getUrgentTasksByStatus);
router.get("/flexible", getFlexibleTasksByStatus);
router.get("/completedAndInProgress", getCompletedAndInProgressTasks);
router.get("/filter", getTasksByStatus);
router.get("/filter/exclude", verifyToken, getTasksExcludingStatus);
router.get("/client", verifyToken, getTasksByClient);
router.get("/", getAllTasks);
router.get("/taskertasks/:id", getTasksByTaskerIdAndStatus)

router.post(
  "/",
  (req, res, next) => {
    console.log("POST /api/tasks route hit at", new Date().toISOString());
    console.log("Raw request body:", req.body);
    console.log("Raw headers:", req.headers);
    next();
  },
  upload.fields([
    { name: "photos", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]), // Remove { name: "estimatedTime" }
  (req, res, next) => {
    console.log("After multer, req.body:", JSON.stringify(req.body, null, 2));
    console.log("After multer, req.body.estimatedTime:", req.body.estimatedTime);
    console.log("Type of req.body.estimatedTime:", typeof req.body.estimatedTime);
    next();
  },verifyToken,
  createTask
);

router.post("/tasks/bulk-delete", bulkDeleteTasks);
router.post("/:id/bid", verifyToken, addBidToTask);
router.post("/:id/comment", verifyToken, addCommentToTask);
router.post("/reviews", verifyToken, restrictTo("client"), addTaskReview);

router.patch("/:id/request-completion", verifyToken, requestCompletionByTasker);
router.patch("/:id/decline", verifyToken, declineByTasker);

router.patch("/:taskId/comments/:commentId/reply", verifyToken, replyToComment);
router.patch("/:taskId/status", verifyToken, updateTaskStatusByClient);
router.patch("/:id/accept", verifyToken, acceptTaskByTasker);
router.patch('/:id/accept-bid', verifyToken, acceptBidByClient);
router.patch("/:id", verifyToken, updateTask);


router.delete("/:id", verifyToken, deleteTask);
router.delete("/tasks/:id", deleteTaskAdnmin);

router.get("/:id", getTaskById);

export default router;