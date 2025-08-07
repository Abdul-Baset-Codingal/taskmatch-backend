import app from './app.js';
import connectDB from './db.js';

// Connect to database
connectDB();

const PORT = process.env.PORT || 5000;

// For local development
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

// Export for Vercel
export default app;