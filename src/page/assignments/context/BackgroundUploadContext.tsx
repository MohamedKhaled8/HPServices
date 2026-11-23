import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { UploadSnackbar } from '../../../components/common/UploadSnackbar';
import { UploadBatchRequest, UploadProgressState, InterruptedBatchMetadata } from '../types/backgroundUpload.types';
import { executeBatchUpload } from '../utils/batchUploadExecutor';
import { AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService';

const STORAGE_KEY = 'hp_upload_interrupted_batch';

type CompletionListener = (
  batch: UploadBatchRequest,
  folder: AssignmentFolderMeta,
  files: AssignmentFileMeta[]
) => void;

interface BackgroundUploadContextValue {
  isUploading: boolean;
  statusLabel: string;
  enqueueUpload: (batch: UploadBatchRequest) => Promise<boolean>;
  registerListener: (listener: CompletionListener) => () => void;
}

const BackgroundUploadContext = createContext<BackgroundUploadContextValue | null>(null);

const fallbackContext: BackgroundUploadContextValue = {
  isUploading: false,
  statusLabel: '',
  enqueueUpload: async () => false,
  registerListener: () => () => {},
};

export const useBackgroundUpload = (): BackgroundUploadContextValue => {
  const ctx = useContext(BackgroundUploadContext);
  return ctx || fallbackContext;
};

export const BackgroundUploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('جاري رفع المجلدات والملفات...');
  const listenersRef = useRef<Set<CompletionListener>>(new Set());

  useEffect(() => {
    if (!isUploading) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = 'جاري رفع المجلدات في الخلفية، هل أنت متأكد من مغادرة الصفحة؟';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isUploading]);

  const registerListener = useCallback((listener: CompletionListener) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const enqueueUpload = useCallback(async (batch: UploadBatchRequest): Promise<boolean> => {
    setIsUploading(true);
    const completedFolders: string[] = [];
    const pendingFolders = batch.groups.map((g) => g.folderName);

    const updateStorageMeta = () => {
      const meta: InterruptedBatchMetadata = {
        batchId: batch.id,
        trackId: batch.trackId,
        scope: batch.scope,
        totalSubfolders: batch.groups.length,
        completedFolders: [...completedFolders],
        pendingFolders: [...pendingFolders],
        timestamp: Date.now(),
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meta));
      } catch (_) {}
    };

    updateStorageMeta();

    try {
      await executeBatchUpload(batch, {
        onProgress: (state: UploadProgressState) => {
          const subfolderProgress = `(${state.currentSubfolderIndex}/${state.totalSubfolders})`;
          const fileProgress = `(${state.currentFileIndex}/${state.totalFilesInSubfolder})`;
          setStatusLabel(
            `جاري رفع المجلدات ${subfolderProgress} — ${state.currentSubfolderName} ${fileProgress}...`
          );
        },
        onSubfolderComplete: (folder: AssignmentFolderMeta, files: AssignmentFileMeta[]) => {
          completedFolders.push(folder.name);
          const idx = pendingFolders.indexOf(folder.name);
          if (idx !== -1) pendingFolders.splice(idx, 1);
          updateStorageMeta();

          listenersRef.current.forEach((fn) => {
            try {
              fn(batch, folder, files);
            } catch (_) {}
          });
        },
      });

      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (_) {}
      return true;
    } catch (err: any) {
      console.error('Background upload error:', err);
      return false;
    } finally {
      setIsUploading(false);
      setStatusLabel('جاري رفع المجلدات والملفات...');
    }
  }, []);

  return (
    <BackgroundUploadContext.Provider
      value={{
        isUploading,
        statusLabel,
        enqueueUpload,
        registerListener,
      }}
    >
      {children}
      <UploadSnackbar isVisible={isUploading} variant="Drive" label={statusLabel} />
    </BackgroundUploadContext.Provider>
  );
};
