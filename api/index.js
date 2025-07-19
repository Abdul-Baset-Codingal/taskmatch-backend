import serverless from "serverless-http";
import app from "./app.js";
import connectToDatabase from "./db.js";

let isConnected = false;

async function initialize() {
    if (!isConnected) {
        await connectToDatabase(process.env.MONGODB_URI);
        isConnected = true;
    }
}

await initialize();

export const handler = serverless(app);
