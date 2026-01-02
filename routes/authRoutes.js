// authRoutes.js
import express from "express";
import { signup, login, logout, verifyToken, getAllUsers, deleteUser, toggleBlockUser, getTaskersByCategory, getUserById, submitRating, getTopTaskerReviews, updateProfile, switchRole, toggleTaskerProfileCheck, submitTaskerApplication, approveRejectTasker, sendOtp, forgotPassword, verifyResetOtp, resetPassword, resendResetOtp, checkEmailExists, checkPhoneExists } from "../controllers/authController.js";
import upload from "../utils/multerConfig.js";
import { getNotifications, markAllAsRead, markAsRead } from "../controllers/notificationController.js";
import protectRoute from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/verify-token", verifyToken); 
router.get("/top-reviews", getTopTaskerReviews);
router.get('/users', getAllUsers);
router.get('/users/single/:id', getUserById);
router.get('/taskers', getTaskersByCategory);

// Add this route
router.get('/check-email', checkEmailExists);
router.get('/check-phone', checkPhoneExists);
router.post("/signup", upload.single('profilePicture'), signup);
router.post('/send-otp', sendOtp);
router.post("/login", login);
router.post("/logout", logout);
router.post("/ratings", submitRating);
router.post("/forgot-password", forgotPassword);
router.post("/verify-reset-otp", verifyResetOtp);
router.post("/reset-password", resetPassword);
router.post("/resend-reset-otp", resendResetOtp);
router.put('/updateProfile/:id', updateProfile)


router.patch('/users/:id',protectRoute,switchRole )
router.post("/submit-tasker-application", protectRoute, submitTaskerApplication);
router.patch("/users/tasker-approval/:id", approveRejectTasker);
router.patch("/users/block/:id", toggleBlockUser);
router.patch("/users/taskerProfileCheck/:id", toggleTaskerProfileCheck);
router.delete('/users/:id', deleteUser);
router.get("/notifications", getNotifications);
router.patch("/notifications/:id/read", markAsRead);
router.patch("/notifications/read-all", markAllAsRead);
router.get("/test", (req, res) => {
    res.json({ message: "Auth routes working on Vercel!" });
});
export default router;

