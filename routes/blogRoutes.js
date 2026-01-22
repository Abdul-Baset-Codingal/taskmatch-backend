// routes/blogRoutes.js
import express from "express";
import {
    createBlog,
    getAllBlogs,
    getPublishedBlogs,
    getBlogById,
    getBlogBySlug,
    updateBlog,
    deleteBlog,
    toggleBlogStatus,
    toggleFeatured,
    getFeaturedBlogs,
    getBlogCategories,
    getBlogStats,
    bulkDeleteBlogs,
    bulkUpdateStatus,
} from "../controllers/blogController.js";
import { adminProtect } from "../middlewares/adminProtect.js";

const router = express.Router();

// ==========================================
// PUBLIC ROUTES
// ==========================================
router.get("/public", getPublishedBlogs);
router.get("/public/featured", getFeaturedBlogs);
router.get("/public/categories", getBlogCategories);
router.get("/public/:slug", getBlogBySlug);

// ==========================================
// ADMIN ROUTES (Protected)
// ==========================================
router.use(adminProtect); // Apply middleware to all routes below

// Stats
router.get("/stats", getBlogStats);

// CRUD
router.post("/", createBlog);
router.get("/", getAllBlogs);
router.get("/:id", getBlogById);
router.put("/:id", updateBlog);
router.delete("/:id", deleteBlog);

// Status management
router.patch("/:id/status", toggleBlogStatus);
router.patch("/:id/featured", toggleFeatured);

// Bulk operations
router.post("/bulk-delete", bulkDeleteBlogs);
router.patch("/bulk-status", bulkUpdateStatus);

export default router;