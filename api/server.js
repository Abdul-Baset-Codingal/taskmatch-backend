// server.js
import app from "./app.js";
import connectToDatabase from "./db.js";

const PORT = process.env.PORT || 5000;

async function startServer() {
    await connectToDatabase(process.env.MONGODB_URI);
    app.listen(PORT, () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer();
