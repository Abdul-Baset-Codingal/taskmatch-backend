// middleware/protectRoute.js   ←←← CREATE THIS FILE
import jwt from "jsonwebtoken";

const protectRoute = async (req, res, next) => {
  try {
    const token = req.cookies.token;

    if (!token) {
      return res.status(401).json({ message: "Not authorized, no token" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // This is the key line — sets req.user so your controller can use it
    req.user = { id: decoded.id };

    next(); // continue to controller
  } catch (error) {
    console.error(error);
    res.status(401).json({ message: "Not authorized, token failed" });
  }
};

export default protectRoute;