import { ref, deleteObject } from 'firebase/storage';
import { storage } from '../config/firebase.ts';
import { supabase, ASSIGNMENTS_BUCKET } from '../config/supabaseClient.ts';
import { deleteFromGoogleDrive } from './googleDriveService.ts';
import { logger } from '../utils/logger.ts';

export interface StorageFileTarget {
  storagePath?: string;
  provider?: string;
}

export const deleteCloudStorageFile = async (
  storagePath?: string,
  provider?: string,
  timeoutMs = 8000
): Promise<boolean> => {
  if (!storagePath) return true;
  try {
    const isDrive =
      provider === 'google-drive' ||
      (!provider && (storagePath.includes('drive.google.com') || !storagePath.includes('/')));

    if (isDrive) {
      return await deleteFromGoogleDrive(storagePath, timeoutMs);
    }

    if (provider === 'supabase') {
      const { error } = await supabase.storage.from(ASSIGNMENTS_BUCKET).remove([storagePath]);
      if (error) logger.warn('Supabase file delete warning:', error);
      return !error;
    }

    // Default: Firebase Storage
    try {
      await deleteObject(ref(storage, storagePath));
      return true;
    } catch (err: any) {
      if (err?.code === 'storage/object-not-found') return true;
      logger.warn('Firebase Storage delete warning:', err);
      return false;
    }
  } catch (err) {
    logger.warn('Storage file deletion error caught:', err);
    return false;
  }
};

export const deleteCloudStorageFilesBackground = (
  files: StorageFileTarget[],
  maxConcurrency = 3,
  timeoutMs = 8000
): void => {
  if (!files || files.length === 0) return;
  (async () => {
    let index = 0;
    const workerCount = Math.min(Math.max(1, maxConcurrency), files.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (index < files.length) {
        const item = files[index++];
        if (!item?.storagePath) continue;
        try {
          await deleteCloudStorageFile(item.storagePath, item.provider, timeoutMs);
        } catch (err) {
          logger.warn('Background storage file deletion caught:', err);
        }
      }
    });
    await Promise.all(workers);
  })().catch((err) => {
    logger.warn('Background storage deletion error:', err);
  });
};
