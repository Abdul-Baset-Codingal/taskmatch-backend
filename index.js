import app from "./app.js";
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error(err));

// DON'T call app.listen! Instead, export app for Vercel to handle.
export default app;
