
import express from "express";
import cookieParser from "cookie-parser";

// Import your routes
import serviceRoutes from "./routes/serviceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import taskerRoutes from "./routes/taskerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";

const app = express();


const allowedOrigins = [
    "https://www.taskallo.com",
    "https://taskallo.com",
    "http://localhost:3000",
];

app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
    }

    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
        return res.sendStatus(200);
    }

    next();
});


// ------------------------------
// Other Middlewares
// ------------------------------
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ------------------------------
// Routes
// ------------------------------
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
app.use("/api/taskerBookings", taskerRoutes);

app.get('/api/test', (req, res) => {
    res.json({ message: "Test route working!" });
});

// ------------------------------
// Error Handling
// ------------------------------
app.use((error, req, res, next) => {
    console.error("Error:", error);
    res.status(500).json({
        error: "Internal server error",
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

export default app;
