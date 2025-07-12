import express from "express";
import multer from "multer";
import fs from "fs";
import path from "path";
import {
  createTask,
  addBidToTask,
  acceptTaskByTasker,
  getAllTasks,
  getTaskById,
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
} from "../controllers/taskController.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = express.Router();

// 🔧 Ensure uploads folder exists
const uploadPath = path.join("uploads");
if (!fs.existsSync(uploadPath)) {
  fs.mkdirSync(uploadPath, { recursive: true });
}

// 📦 Multer config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, Date.now() + "-" + file.originalname),
});
const upload = multer({ storage });

// ✅ Routes
router.post(
  "/",
  verifyToken,
  upload.fields([
    { name: "photos", maxCount: 3 },
    { name: "video", maxCount: 1 },
  ]),
  createTask
);

router.get("/", getAllTasks); // 🔹 All tasks
router.get("/urgent", getUrgentTasksByStatus); // 🔹 Urgent tasks
router.get("/client", verifyToken, getTasksByClient); // 🔹 Tasks by client
router.get("/filter", getTasksByStatus);
// In your taskRoutes.js
router.get("/filter/exclude", verifyToken, getTasksExcludingStatus);
router.get("/:id", getTaskById); // 🔹 Task by ID
router.post("/:id/bid", verifyToken, addBidToTask); // 🔹 Bid
router.post("/:id/comment", verifyToken, addCommentToTask);
router.patch("/:id/request-completion", verifyToken, requestCompletionByTasker); // 🔹 Tasker requests completion
router.patch("/:taskId/comments/:commentId/reply", verifyToken, replyToComment);
router.patch("/:taskId/status", verifyToken, updateTaskStatusByClient);
router.patch("/:id/accept", verifyToken, acceptTaskByTasker); // 🔹 Accept
router.patch("/:id", verifyToken, updateTask); // 🔹 Update task
router.delete("/:id", verifyToken, deleteTask); // 🔹 Delete task
export default router;
