// Cloudinary configuration
// Security: Only public config here - API secret is NOT exposed in client-side code

const cloudName = "dpjnaefed";

export const CLOUDINARY_CONFIG = {
  cloud_name: cloudName,
  upload_url: `https://api.cloudinary.com/v1_1/${cloudName}/upload`
};

export const UPLOAD_PRESET = "unsigned";
export const USE_SIGNED_UPLOAD = false;
