import serverless from "serverless-http";
import app from "./app.js";
import connectToDatabase from "./db.js";

const mongoUri = process.env.MONGODB_URI;

let isDbConnected = false;

async function init() {
    if (!isDbConnected) {
        await connectToDatabase(mongoUri);
        isDbConnected = true;
    }
}

await init();

export const handler = serverless(app);
