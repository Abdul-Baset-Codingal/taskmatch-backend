import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";

// Import your routes
import serviceRoutes from "../routes/serviceRoutes.js";
import taskRoutes from "../routes/taskRoutes.js";
import authRoutes from "../routes/authRoutes.js";
import bookingRoutes from "../routes/bookingRoutes.js";

const app = express();

// Middleware
app.use(cors({
    origin: [
        "http://localhost:3000",
        "https://taskmatch-five.vercel.app",
        "https://your-frontend-domain.vercel.app" // Add your actual frontend domain
    ],
    credentials: true,
}));

app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
    res.json({
        message: "🎉 TaskMatch API is running on Vercel!",
        timestamp: new Date().toISOString()
    });
});

// API Routes
app.use("/api/services", serviceRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);

// Error handling
app.use((error, req, res, next) => {
    console.error("Error:", error);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

export default app;