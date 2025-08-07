import mongoose from "mongoose";

const connectToDatabase = async () => {
    try {
        // Check if already connected
        if (mongoose.connections[0].readyState) {
            console.log("Already connected to MongoDB");
            return;
        }

        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error("MongoDB URI is not defined in environment variables");
        }

        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        throw err; // ❌ Don't use process.exit(1) in serverless
    }
};

export default connectToDatabase;