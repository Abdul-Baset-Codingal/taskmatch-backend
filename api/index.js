import serverless from "serverless-http";
import app from "./app.js";
import mongoose from "mongoose";

// Database connection
const connectDB = async () => {
    if (mongoose.connections[0].readyState === 1) return;

    await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });
    console.log("MongoDB connected");
};

// Connect to database
await connectDB();

// Export serverless handler
export default serverless(app);