import dotenv from "dotenv";
dotenv.config(); // ← Add this at the very top

import app from "./app.js";
import connectToDatabase from "./db.js";
import { v2 as cloudinary } from "cloudinary";
import { startTaskCleanupJob } from "./utils/taskScheduler.js"; // ← Add this

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PORT = process.env.PORT || 5000;

async function startServer() {
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI); // Debug log
    await connectToDatabase();

    // ✅ Start the cron job after database connects
    startTaskCleanupJob();

    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);