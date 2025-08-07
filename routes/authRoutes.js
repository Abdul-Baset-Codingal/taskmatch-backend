// authRoutes.js
import express from "express";
import { signup, login, logout, verifyToken, getAllUsers, deleteUser, toggleBlockUser, getTaskersByCategory } from "../controllers/authController.js";

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get("/verify-token", verifyToken); // <-- Add this line
router.get('/users', getAllUsers);
router.get('/taskers', getTaskersByCategory);
router.patch("/users/block/:id", toggleBlockUser);
router.delete('/users/:id', deleteUser);
router.get("/test", (req, res) => {
    res.json({ message: "Auth routes working on Vercel!" });
});
export default router;
