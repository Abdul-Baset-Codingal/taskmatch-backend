import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "taskmatch_uploads", // Consistent folder name
        allowed_formats: ["jpg", "jpeg", "png", "gif", "mp4", "mov", "avi"],
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, fields: 20 }, // 5MB file size limit, 20 non-file fields
});

export default upload;