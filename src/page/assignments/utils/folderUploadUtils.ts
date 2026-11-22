export const SUPPORTED_ASSIGNMENT_EXTENSIONS = [
  '.pdf',
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.heic',
  '.heif',
  '.bmp',
  '.gif'
] as const;

export const extractFolderNameFromFiles = (files: File[]): string => {
  if (!files || files.length === 0) return '';

  for (const file of files) {
    const relPath = (file as any).webkitRelativePath as string | undefined;
    if (relPath && relPath.includes('/')) {
      const topFolder = relPath.split('/')[0].trim();
      if (topFolder) {
        return topFolder.replace(/[\\/:*?"<>|]/g, '_').trim();
      }
    }
  }

  // Fallback: use first file name without extension
  const fallback = files[0]?.name ? files[0].name.replace(/\.[^/.]+$/, '') : 'مجلد جديد';
  return fallback.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';
};

export const isSupportedAssignmentFile = (file: File): boolean => {
  const name = (file.name || '').toLowerCase().trim();
  if (!name) return false;

  // Filter out system/hidden OS files (.DS_Store, Thumbs.db, desktop.ini)
  if (name.startsWith('.') || name === 'thumbs.db' || name === 'desktop.ini') {
    return false;
  }

  return SUPPORTED_ASSIGNMENT_EXTENSIONS.some((ext) => name.endsWith(ext));
};

export const filterSupportedAssignmentFiles = (
  files: File[]
): {
  validFiles: File[];
  invalidCount: number;
} => {
  const validFiles: File[] = [];
  let invalidCount = 0;

  for (const file of files) {
    if (isSupportedAssignmentFile(file)) {
      validFiles.push(file);
    } else {
      const name = (file.name || '').toLowerCase().trim();
      // Only count user-visible non-supported files (not OS metadata like .DS_Store)
      if (!name.startsWith('.') && name !== 'thumbs.db' && name !== 'desktop.ini') {
        invalidCount++;
      }
    }
  }

  return { validFiles, invalidCount };
};

export const formatFileSize = (bytes: number): string => {
  if (!bytes || bytes <= 0 || isNaN(bytes)) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, i);
  return `${size.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
};

export const computeTotalFilesSize = (files: File[]): number => {
  if (!files || files.length === 0) return 0;
  return files.reduce((acc, f) => acc + (f.size || 0), 0);
};
