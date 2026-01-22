
import express from "express";
import cookieParser from "cookie-parser";

// Import your routes
import serviceRoutes from "./routes/serviceRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import taskerRoutes from "./routes/taskerRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import adminPaymentRoutes from "./routes/adminPaymentRoutes.js";
import taskerPayoutRoutes from "./routes/taskerPayoutRoutes.js";
import webhookRoutes from "./routes/webhookRoutes.js";
import stripeConnect from "./routes/stripeConnectRoutes.js"
import paymentRoutes from "./routes/paymentRoutes.js"
import stripeConnectRoutes from './routes/stripeConnect.js';  // ✅ Import
import clientPaymentRoutes from './routes/clientPaymentRoutes.js';
import clientPaymentHistoryRoutes from './routes/paymentHistoryRoutes.js';
import taskerPaymentRoutes from './routes/paymentHistoryTaskerRoutes.js'
import adminTaskRoutes from "./routes/adminTaskRoutes.js";
import adminBookingRoutes from './routes/adminBookingRoutes.js';
import adminQuoteRoutes from './routes/adminQuoteRoutes.js';
import adminDashboardPaymentRoutes from './routes/adminDashboardPaymentRoutes.js';
import adminLogs from "./routes/adminLogRoutes.js"
import blogRoutes from "./routes/blogRoutes.js";

const app = express();


const allowedOrigins = [
    "https://www.taskallo.com",
    "https://taskallo.com",
    "http://localhost:3000",
    "https://taskmatch-tau.vercel.app",
    "https://taskmatch-backend.vercel.app"
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


app.use('/api/webhooks', webhookRoutes);

// API Routes
app.use("/api/services", serviceRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/taskerBookings", taskerRoutes);
app.use("/api/admin/payments", adminPaymentRoutes);
app.use('/api/tasker', taskerPayoutRoutes);
app.use('/api/stripe-connect', stripeConnect);
app.use('/api/payments', paymentRoutes);
app.use('/api/stripe/connect', stripeConnectRoutes);
app.use('/api/payments/client', clientPaymentRoutes);
app.use('/api/paymentsHistory', clientPaymentHistoryRoutes);
app.use('/api/paymentsHistoryTasker', taskerPaymentRoutes);
app.use("/api/admin/tasks", adminTaskRoutes);
app.use('/api/admin/bookings', adminBookingRoutes);
app.use('/api/admin/quotes', adminQuoteRoutes);
app.use('/api/admin/dashboardPayments', adminDashboardPaymentRoutes);
app.use('/api/admin/adminLogs', adminLogs);
app.use("/api/blogs", blogRoutes);


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
