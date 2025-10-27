import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../utils/cloudinary.js';

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'taskmatch_Uploads',
        allowed_formats: ['jpg', 'png', 'jpeg', 'mp4', 'mov', 'avi'],
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024, fields: 20 },
});

export default upload;