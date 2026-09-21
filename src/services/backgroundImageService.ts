import { CLOUDINARY_CONFIG, UPLOAD_PRESET } from '../config/cloudinary';
import { updateAdminPreferences } from './firebaseService';
import { destroyCloudinaryAsset } from './cloudinaryRestoreService';
import { logger } from '../utils/logger';
import {
  appendHeroBackgroundImage,
  assertCanManageBackgroundImages,
  BACKGROUND_MAX_EDGE_PX,
  extractCloudinaryPublicId,
  HERO_BACKGROUND_PREF_KEY,
  HeroBackgroundImage,
  optimizedCloudinaryUrl,
  removeHeroBackgroundImage,
  validateBackgroundImageFile
} from '../utils/backgroundImages';

async function resizeImageIfNeeded(file: File): Promise<Blob> {
  try {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') {
      return file;
    }
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      return file;
    }

    const bitmap = await createImageBitmap(file);
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    if (maxEdge <= BACKGROUND_MAX_EDGE_PX) {
      bitmap.close();
      return file;
    }

    const scale = BACKGROUND_MAX_EDGE_PX / maxEdge;
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const mime = file.type === 'image/png' || file.type === 'image/webp' ? file.type : 'image/jpeg';
    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), mime, 0.82);
    });
    return blob || file;
  } catch {
    return file;
  }
}

function serializeHeroBackgroundImages(images: HeroBackgroundImage[]): HeroBackgroundImage[] {
  return images.map((image) => {
    const item: HeroBackgroundImage = {
      id: String(image.id || ''),
      url: String(image.url || '')
    };
    if (image.publicId) {
      item.publicId = String(image.publicId);
    }
    return item;
  }).filter((image) => image.id && image.url);
}

export async function persistHeroBackgroundImages(
  isAdmin: boolean,
  images: HeroBackgroundImage[]
): Promise<void> {
  assertCanManageBackgroundImages(isAdmin);
  await updateAdminPreferences({ [HERO_BACKGROUND_PREF_KEY]: serializeHeroBackgroundImages(images) });
}

async function uploadSingleHeroFile(file: File, index: number): Promise<HeroBackgroundImage> {
  const validationError = validateBackgroundImageFile(file);
  if (validationError) {
    throw new Error(`${file.name}: ${validationError}`);
  }

  const fileToUpload = await resizeImageIfNeeded(file);
  const timestamp = Date.now() + index;
  const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\.[^.]+$/, '') || 'image';
  const publicId = `uiBackgrounds/${timestamp}_${sanitizedName}`;

  const formData = new FormData();
  formData.append('file', fileToUpload);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('public_id', publicId);
  formData.append('folder', 'uiBackgrounds');

  const response = await fetch(CLOUDINARY_CONFIG.upload_url, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as { error?: { message?: string } }));
    throw new Error(errorData.error?.message || `فشل رفع ${file.name}`);
  }

  const data = await response.json();
  const storedPublicId = typeof data.public_id === 'string' && data.public_id
    ? data.public_id
    : publicId;
  return {
    id: `cld-${timestamp}`,
    publicId: storedPublicId,
    url: optimizedCloudinaryUrl(storedPublicId, CLOUDINARY_CONFIG.cloud_name)
  };
}

export async function uploadHeroBackgroundImage(
  isAdmin: boolean,
  file: File,
  current: HeroBackgroundImage[]
): Promise<HeroBackgroundImage[]> {
  return uploadHeroBackgroundImages(isAdmin, [file], current);
}

export async function uploadHeroBackgroundImages(
  isAdmin: boolean,
  files: File[],
  current: HeroBackgroundImage[]
): Promise<HeroBackgroundImage[]> {
  assertCanManageBackgroundImages(isAdmin);
  if (files.length === 0) {
    throw new Error('لم يتم اختيار أي صورة');
  }

  let next = [...current];
  for (let i = 0; i < files.length; i++) {
    const image = await uploadSingleHeroFile(files[i], i);
    next = appendHeroBackgroundImage(next, image);
  }
  await persistHeroBackgroundImages(true, next);
  return next;
}

export async function deleteHeroBackgroundImage(
  isAdmin: boolean,
  imageId: string,
  current: HeroBackgroundImage[]
): Promise<HeroBackgroundImage[]> {
  assertCanManageBackgroundImages(isAdmin);

  const { next, removed } = removeHeroBackgroundImage(current, imageId);
  if (!removed) {
    throw new Error('الصورة غير موجودة');
  }

  await persistHeroBackgroundImages(true, next);

  const publicId = removed.publicId || extractCloudinaryPublicId(removed.url);
  if (publicId) {
    try {
      await destroyCloudinaryAsset(publicId);
    } catch (error) {
      logger.error('Cloudinary delete after local removal:', error);
    }
  }

  return next;
}
