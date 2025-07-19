import serverless from "serverless-http";
import mongoose from "mongoose";
import app from "./app.js";

// Database connection for serverless
let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection && mongoose.connections[0].readyState === 1) {
        return cachedConnection;
    }

    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MONGODB_URI is required");
        }

        const connection = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
        });

        cachedConnection = connection;
        console.log("✅ MongoDB connected");
        return connection;
    } catch (error) {
        console.error("❌ Database connection failed:", error);
        throw error;
    }
}

// Connect to database
await connectToDatabase();

// Export serverless handler
export default serverless(app);