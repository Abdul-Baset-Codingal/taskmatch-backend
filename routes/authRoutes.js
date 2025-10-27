// authRoutes.js
import express from "express";
import { signup, login, logout, verifyToken, getAllUsers, deleteUser, toggleBlockUser, getTaskersByCategory, getUserById, submitRating, getTopTaskerReviews, updateProfile, switchRole } from "../controllers/authController.js";
import upload from "../utils/multerConfig.js";
import { getNotifications, markAllAsRead, markAsRead } from "../controllers/notificationController.js";

const router = express.Router();
router.post("/signup", upload.single('profilePicture'), signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/ratings", submitRating);
router.put('/updateProfile/:id', updateProfile)
router.get("/verify-token", verifyToken); 
router.get("/top-reviews", getTopTaskerReviews);
router.get('/users', getAllUsers);
router.get('/users/single/:id', getUserById);
router.get('/taskers', getTaskersByCategory);
router.patch('/users/:id',switchRole )
router.patch("/users/block/:id", toggleBlockUser);
router.delete('/users/:id', deleteUser);
router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", markAsRead);
router.patch("/notifications/read-all", markAllAsRead);
router.get("/test", (req, res) => {
    res.json({ message: "Auth routes working on Vercel!" });
});
export default router;

