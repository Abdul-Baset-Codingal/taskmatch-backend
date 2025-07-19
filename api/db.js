import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config(); // 👈 IMPORTANT

const connectToDatabase = async () => {
    try {
        const uri = process.env.MONGODB_URI; // 👈 This must not be undefined
        if (!uri) throw new Error("MongoDB URI is not defined in environment variables");

        await mongoose.connect(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("MongoDB connected successfully");
    } catch (err) {
        console.error("MongoDB connection error:", err);
        process.exit(1);
    }
};

export default connectToDatabase;
