import serverless from "serverless-http";
import mongoose from "mongoose";
import app from "./app.js";

// Cache the database connection
let cachedConnection = null;

async function connectToDatabase() {
    if (cachedConnection && mongoose.connections[0].readyState === 1) {
        return cachedConnection;
    }

    try {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MongoDB URI is not defined in environment variables");
        }

        const connection = await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            bufferCommands: false, // Disable mongoose buffering for serverless
            bufferMaxEntries: 0,   // Disable mongoose buffering for serverless
        });

        cachedConnection = connection;
        console.log("MongoDB connected successfully");
        return connection;
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error;
    }
}

// Create the serverless handler
const handler = serverless(app);

// Export the main handler function
export default async function (req, res) {
    try {
        // Ensure database connection before handling request
        await connectToDatabase();

        // Handle the request
        return await handler(req, res);
    } catch (error) {
        console.error('Serverless function error:', error);

        // Return proper error response
        res.status(500).json({
            error: 'Internal Server Error',
            message: error.message
        });
    }
}