export const HERO_BACKGROUND_PREF_KEY = 'heroBackgroundImages';

export const DEFAULT_HERO_BACKGROUND_URLS: string[] = [
  '/images/optimized/0T8A9628.JPG',
  '/images/optimized/0T8A9638.JPG',
  '/images/optimized/0T8A9717.JPG',
  '/images/optimized/0T8A9748.JPG',
  '/images/optimized/0T8A9887.JPG',
  '/images/optimized/0T8A9970.JPG',
  '/images/optimized/4W3A0163.JPG',
  '/images/optimized/4W3A0166.JPG',
  '/images/optimized/4W3A0167.JPG',
  '/images/optimized/4W3A0215.JPG',
  '/images/optimized/4W3A0388.JPG',
  '/images/optimized/4W3A0410.JPG',
  '/images/optimized/4W3A0434.JPG'
];

export const BACKGROUND_UPLOAD_MAX_MB = 8;
export const BACKGROUND_MAX_EDGE_PX = 1920;
export const ALLOWED_BACKGROUND_MIME_PREFIX = 'image/';
export const ALLOWED_BACKGROUND_EXTENSIONS = [
  'jpg', 'jpeg', 'jfif', 'png', 'webp', 'gif', 'bmp', 'heic', 'heif', 'avif', 'tif', 'tiff', 'ico', 'svg', 'jxl'
] as const;

export interface HeroBackgroundImage {
  id: string;
  url: string;
  publicId?: string;
}

export function defaultHeroBackgroundImages(): HeroBackgroundImage[] {
  return DEFAULT_HERO_BACKGROUND_URLS.map((url, index) => ({
    id: `default-hero-${index}`,
    url
  }));
}

export function parseHeroBackgroundImages(raw: unknown): HeroBackgroundImage[] | undefined {
  if (!Array.isArray(raw)) {
    return undefined;
  }

  return raw
    .map((item, index) => {
      if (typeof item === 'string' && item.trim()) {
        return { id: `hero-${index}`, url: item.trim() };
      }
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>;
        const url = typeof record.url === 'string' ? record.url.trim() : '';
        if (!url) return null;
        const id = typeof record.id === 'string' && record.id.trim() ? record.id.trim() : `hero-${index}`;
        const publicId = typeof record.publicId === 'string' && record.publicId.trim()
          ? record.publicId.trim()
          : undefined;
        return { id, url, publicId };
      }
      return null;
    })
    .filter((item): item is HeroBackgroundImage => item !== null);
}

export function resolveHeroBackgroundImages(raw: unknown): HeroBackgroundImage[] {
  const parsed = parseHeroBackgroundImages(raw);
  if (parsed === undefined) {
    return defaultHeroBackgroundImages();
  }
  return parsed;
}

export function resolveHeroBackgroundUrls(raw: unknown): string[] {
  return resolveHeroBackgroundImages(raw).map((image) => image.url);
}

export function validateBackgroundImageFile(file: { type?: string; size?: number; name?: string }): string | null {
  const type = (file.type || '').toLowerCase();
  const name = (file.name || '').toLowerCase();
  const ext = name.includes('.') ? name.split('.').pop() || '' : '';
  const typeOk = type.startsWith(ALLOWED_BACKGROUND_MIME_PREFIX);
  const extOk = ALLOWED_BACKGROUND_EXTENSIONS.includes(ext as (typeof ALLOWED_BACKGROUND_EXTENSIONS)[number]);

  if (!typeOk && !extOk) {
    return 'الملف ليس صورة. ارفع ملفات صور بأي صيغة شائعة.';
  }

  const size = file.size ?? 0;
  if (size <= 0) {
    return 'الملف غير صالح';
  }

  if (size > BACKGROUND_UPLOAD_MAX_MB * 1024 * 1024) {
    return `حجم الملف كبير جداً. الحد الأقصى هو ${BACKGROUND_UPLOAD_MAX_MB} ميجابايت.`;
  }

  return null;
}

export function appendHeroBackgroundImages(
  current: HeroBackgroundImage[],
  images: HeroBackgroundImage[]
): HeroBackgroundImage[] {
  return [...current, ...images];
}

export function assertCanManageBackgroundImages(isAdmin: boolean): void {
  if (!isAdmin) {
    throw new Error('غير مصرح بتنفيذ هذا الإجراء');
  }
}

export function appendHeroBackgroundImage(
  current: HeroBackgroundImage[],
  image: HeroBackgroundImage
): HeroBackgroundImage[] {
  return [...current, image];
}

export function removeHeroBackgroundImage(
  current: HeroBackgroundImage[],
  imageId: string
): { next: HeroBackgroundImage[]; removed?: HeroBackgroundImage } {
  const removed = current.find((image) => image.id === imageId);
  return {
    next: current.filter((image) => image.id !== imageId),
    removed
  };
}

export function optimizedCloudinaryUrl(publicId: string, cloudName: string): string {
  return `https://res.cloudinary.com/${cloudName}/image/upload/c_limit,w_${BACKGROUND_MAX_EDGE_PX},q_auto:good,f_auto/${publicId}`;
}

export function extractCloudinaryPublicId(url: string): string | undefined {
  const match = url.match(/\/upload\/(?:[^/]+\/)*((?:uiBackgrounds|backgrounds)\/[^/.]+)/);
  if (match?.[1]) {
    return match[1];
  }
  const generic = url.match(/\/upload\/(?:(?:[^/]+,)*[^/]+\/)?(?:v\d+\/)?(.+?)(?:\.[a-zA-Z0-9]+)?(?:\?.*)?$/);
  if (!generic?.[1]) {
    return undefined;
  }
  const cleaned = generic[1].replace(/^.*?(uiBackgrounds\/)/, 'uiBackgrounds/');
  return cleaned || undefined;
}
