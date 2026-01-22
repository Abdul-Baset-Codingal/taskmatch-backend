// middleware/authMiddleware.js
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

export const adminProtect = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization?.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        } else if (req.cookies?.token) {
            token = req.cookies.token;
        }

        if (!token) {
            return res.status(401).json({ message: 'Not authorized, no token' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select('-password');

        if (!req.user) {
            return res.status(401).json({ message: 'User not found' });
        }

        next();
    } catch (error) {
        console.error('Auth error:', error.message);
        return res.status(401).json({ message: 'Not authorized, token failed' });
    }
};

export const adminOnly = (req, res, next) => {
    if (req.user?.role !== 'admin' && req.user?.currentRole !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};