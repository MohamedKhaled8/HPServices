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
  provider?: string
): Promise<boolean> => {
  if (!storagePath) return true;
  try {
    const isDrive =
      provider === 'google-drive' ||
      (!provider && (storagePath.includes('drive.google.com') || !storagePath.includes('/')));

    if (isDrive) {
      return await deleteFromGoogleDrive(storagePath);
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
  files: StorageFileTarget[]
): void => {
  if (!files || files.length === 0) return;
  Promise.allSettled(
    files.map((f) => deleteCloudStorageFile(f.storagePath, f.provider))
  ).catch((err) => {
    logger.warn('Background storage deletion error:', err);
  });
};
