import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

// Avatar upload storage (used by auth routes)
export const avatarStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'pioneers_avatars',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
    }
});

// Marketplace image upload storage — compressed for space saving
export const marketplaceStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'pioneers_marketplace',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
        transformation: [
            { width: 800, height: 800, crop: 'limit', quality: 'auto', fetch_format: 'auto' }
        ]
    }
});

// Birthday source picture storage (user's raw photo)
export const birthdayStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'pioneers_birthdays',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
        transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
    }
});

// Admin-designed birthday shoutout card storage
export const shoutoutStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: 'pioneers_shoutouts',
        allowed_formats: ['jpeg', 'png', 'jpg', 'webp'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }]
    }
});

export const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadMarketplace = multer({ storage: marketplaceStorage, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadBirthdayPic = multer({ storage: birthdayStorage, limits: { fileSize: 5 * 1024 * 1024 } });
export const uploadShoutout = multer({ storage: shoutoutStorage, limits: { fileSize: 10 * 1024 * 1024 } });

export { cloudinary };
