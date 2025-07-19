// authRoutes.js
import express from "express";
import { signup, login, logout, getAllUsers, deleteUser } from "../controllers/authController.js";

const router = express.Router();
router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.get('/users', getAllUsers);          
router.delete('/users/:id', deleteUser);

export default router;
