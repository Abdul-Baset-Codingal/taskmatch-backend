import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser"; // ✅ Add this

import serviceRoutes from "./routes/serviceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";

const app = express();

// ✅ Enable CORS and cookies
app.use(cors({
  origin: ["http://localhost:3000", "https://taskmatch-five.vercel.app"],
  credentials: true,
}));

// ✅ Middleware
app.use(cookieParser()); // ✅ Very important!
app.use(express.json());
app.use("/uploads", express.static("uploads"));

// ✅ Base Route
app.get("/", (req, res) => {
  res.send("🎉 Welcome to TaskMatch API");
});

// ✅ API Routes
app.use("/api/services", serviceRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
export default app;
