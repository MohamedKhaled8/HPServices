// Cloudinary configuration
// Security: Only public config here - API secret is NOT exposed in client-side code

const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dpjnaefed';

export const CLOUDINARY_CONFIG = {
  cloud_name: cloudName,
  upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/upload`
};

// Unsigned upload preset name (created in Cloudinary Dashboard)
export const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'unsigned';
export const USE_SIGNED_UPLOAD = false;
