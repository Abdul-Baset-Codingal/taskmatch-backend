export const restrictTo = (...roles) => {
    return (req, res, next) => {
        console.log('User role:', req.user.role); // Debug: Log user role
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: "You do not have permission to perform this action" });
        }
        next();
    };
};