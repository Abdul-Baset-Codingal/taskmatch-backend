// taskRoutes.js
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
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
} from "../controllers/taskController.js";
import verifyToken from "../middlewares/verifyToken.js";

const router = express.Router();

// ✅ Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ✅ Cloudinary Storage Setup
const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "taskmatch_uploads",
    allowed_formats: ["jpg", "jpeg", "png", "gif", "mp4", "mov", "avi"],
  },
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

router.get("/", getAllTasks);
router.get("/urgent", getUrgentTasksByStatus);
router.get("/client", verifyToken, getTasksByClient);
router.get("/filter", getTasksByStatus);
router.get("/tasks", getAllTasks);
router.get("/tasks/filters", getTaskFilters);
router.get("/filter/exclude", verifyToken, getTasksExcludingStatus);
router.get("/:id", getTaskById);
router.post("/:id/bid", verifyToken, addBidToTask);
router.post("/:id/comment", verifyToken, addCommentToTask);
router.patch("/:id/request-completion", verifyToken, requestCompletionByTasker);
router.patch("/:taskId/comments/:commentId/reply", verifyToken, replyToComment);
router.patch("/:taskId/status", verifyToken, updateTaskStatusByClient);
router.patch("/:id/accept", verifyToken, acceptTaskByTasker);
router.patch("/:id", verifyToken, updateTask);
router.delete("/:id", verifyToken, deleteTask);
router.post("/tasks/bulk-delete", bulkDeleteTasks);
router.delete("/tasks/:id", deleteTaskAdnmin);

export default router;
