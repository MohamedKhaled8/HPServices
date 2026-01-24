// Cloudinary configuration
// Security: Only public config here - API secret is NOT exposed in client-side code
// We use unsigned upload preset which doesn't require API secret
export const CLOUDINARY_CONFIG = {
  cloud_name: 'dpjnaefed',
  upload_url: 'https://api.cloudinary.com/v1_1/dpjnaefed/upload'
};

// Unsigned upload preset name (created in Cloudinary Dashboard)
// This preset allows uploads without exposing API secret
export const UPLOAD_PRESET = 'unsigned';
export const USE_SIGNED_UPLOAD = false; // Using unsigned preset - no API secret needed

