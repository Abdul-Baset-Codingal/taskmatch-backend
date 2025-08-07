import jwt from "jsonwebtoken";
import User from "../models/user.js"; // your User model

const verifyToken = async (req, res, next) => {
  console.log("Cookies:", req.cookies); // 👈 See if token is present
  console.log("Authorization header:", req.headers.authorization);

  let token = req.cookies.token;

  if (!token && req.headers.authorization?.startsWith("Bearer ")) {
    token = req.headers.authorization.split(" ")[1];
  }

  if (!token) {
    return res.status(401).json({ message: "Access Denied. No token provided." });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({ message: "User not found." });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Invalid token." });
  }
};

export default verifyToken;
