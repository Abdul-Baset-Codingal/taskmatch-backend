import dotenv from "dotenv";
dotenv.config(); // Load environment variables first

import app from "./app.js";
import connectToDatabase from "./db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI); // Debug log
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);