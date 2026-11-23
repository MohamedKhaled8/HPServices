import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { UploadSnackbar } from '../../../components/common/UploadSnackbar';
import { UploadBatchRequest, QueuedUploadJob, InterruptedBatchMetadata } from '../types/backgroundUpload.types';
import { executeSingleUploadJob } from '../utils/jobUploadExecutor';
import { AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService';

const STORAGE_KEY = 'hp_upload_interrupted_batch';

type CompletionListener = (
  batch: UploadBatchRequest,
  folder: AssignmentFolderMeta | null,
  files: AssignmentFileMeta[],
  error?: string
) => void;

interface BackgroundUploadContextValue {
  isUploading: boolean;
  statusLabel: string;
  lastError: string | null;
  enqueueUpload: (batch: UploadBatchRequest) => Promise<boolean>;
  registerListener: (listener: CompletionListener) => () => void;
  clearError: () => void;
}

const BackgroundUploadContext = createContext<BackgroundUploadContextValue | null>(null);

const fallbackContext: BackgroundUploadContextValue = {
  isUploading: false,
  statusLabel: '',
  lastError: null,
  enqueueUpload: async () => false,
  registerListener: () => () => {},
  clearError: () => {},
};

export const useBackgroundUpload = (): BackgroundUploadContextValue => {
  const ctx = useContext(BackgroundUploadContext);
  return ctx || fallbackContext;
};

const formatProgressLabel = (folderIdx: number, totalFolders: number, name: string, fileIdx: number, totalFiles: number) =>
  `جاري رفع المجلدات (${folderIdx}/${totalFolders}) — ${name} (${fileIdx}/${totalFiles})...`;

export const BackgroundUploadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isUploading, setIsUploading] = useState(false);
  const [statusLabel, setStatusLabel] = useState('جاري رفع المجلدات والملفات...');
  const [lastError, setLastError] = useState<string | null>(null);

  const queueRef = useRef<QueuedUploadJob[]>([]);
  const isWorkerRunningRef = useRef<boolean>(false);
  const totalFoldersCountRef = useRef<number>(0);
  const completedFoldersCountRef = useRef<number>(0);
  const parentFolderCacheRef = useRef<Map<string, AssignmentFolderMeta>>(new Map());
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
    return () => { listenersRef.current.delete(listener); };
  }, []);

  const clearError = useCallback(() => setLastError(null), []);

  const updateStorageManifest = () => {
    const queue = queueRef.current;
    if (queue.length === 0) {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      return;
    }
    const current = queue[0];
    const meta: InterruptedBatchMetadata = {
      batchId: current.batchId,
      trackId: current.targetTrackId,
      scope: current.scope,
      totalSubfolders: totalFoldersCountRef.current,
      completedFolders: [],
      pendingFolders: queue.map((j) => j.folderName),
      timestamp: Date.now(),
      uploadStrategy: current.uploadStrategy,
      parentFolderName: current.parentFolderName,
    };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(meta)); } catch (_) {}
  };

  const notifyListeners = (job: QueuedUploadJob, folder: AssignmentFolderMeta | null, files: AssignmentFileMeta[], err?: string) => {
    const batchReq: UploadBatchRequest = {
      id: job.batchId,
      scope: job.scope,
      trackId: job.targetTrackId,
      parentPath: job.parentPath,
      groups: [{ folderName: job.folderName, files: job.files }],
      totalFiles: job.files.length,
      uploadStrategy: job.uploadStrategy,
      parentFolderName: job.parentFolderName,
      parentFolderId: job.parentFolderId,
    };
    listenersRef.current.forEach((fn) => {
      try { fn(batchReq, folder, files, err); } catch (_) {}
    });
  };

  const runSequentialWorker = async () => {
    if (isWorkerRunningRef.current) return;
    isWorkerRunningRef.current = true;
    setIsUploading(true);

    try {
      while (queueRef.current.length > 0) {
        const job = queueRef.current[0];
        const curIdx = completedFoldersCountRef.current + 1;
        const total = totalFoldersCountRef.current;
        setStatusLabel(formatProgressLabel(curIdx, total, job.folderName, 0, job.files.length));

        try {
          const { createdFolder, savedFiles } = await executeSingleUploadJob(job, parentFolderCacheRef.current, {
            onFileProgress: (fileIdx, totalFiles) => {
              setStatusLabel(formatProgressLabel(curIdx, totalFoldersCountRef.current, job.folderName, fileIdx, totalFiles));
            },
            onParentFolderCreated: (parentFolder) => { notifyListeners(job, parentFolder, []); },
          });

          queueRef.current.shift();
          completedFoldersCountRef.current++;
          updateStorageManifest();
          notifyListeners(job, createdFolder, savedFiles);
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'فشل رفع المجلد والملفات';
          setLastError(errMsg);
          setStatusLabel(`⚠️ ${errMsg}`);
          notifyListeners(job, null, [], errMsg);
          queueRef.current.shift();
          completedFoldersCountRef.current++;
          updateStorageManifest();
          if (errMsg.includes('Quota exceeded') || errMsg.includes('resource-exhausted')) {
            queueRef.current = [];
            break;
          }
        }
      }
    } finally {
      isWorkerRunningRef.current = false;
      totalFoldersCountRef.current = 0;
      completedFoldersCountRef.current = 0;
      parentFolderCacheRef.current.clear();
      setIsUploading(false);
      setStatusLabel('جاري رفع المجلدات والملفات...');
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    }
  };

  const enqueueUpload = useCallback(async (batch: UploadBatchRequest): Promise<boolean> => {
    setLastError(null);
    const strategy = batch.uploadStrategy || 'extract-subfolders';
    const newJobs: QueuedUploadJob[] = batch.groups.map((group, idx) => ({
      jobId: `${batch.id}_${idx}_${Date.now()}`,
      batchId: batch.id,
      scope: batch.scope,
      targetTrackId: batch.trackId,
      parentPath: batch.parentPath || '',
      uploadStrategy: strategy,
      parentFolderName: batch.parentFolderName,
      parentFolderId: batch.parentFolderId || null,
      folderName: group.folderName,
      files: [...group.files],
    }));

    queueRef.current.push(...newJobs);
    totalFoldersCountRef.current += newJobs.length;
    setIsUploading(true);
    updateStorageManifest();

    if (isWorkerRunningRef.current) {
      setStatusLabel((prev) => prev.replace(/\((\d+)\/\d+\)/, `($1/${totalFoldersCountRef.current})`));
    } else {
      runSequentialWorker();
    }
    return true;
  }, []);

  return (
    <BackgroundUploadContext.Provider value={{ isUploading, statusLabel, lastError, enqueueUpload, registerListener, clearError }}>
      {children}
      <UploadSnackbar
        isVisible={isUploading || Boolean(lastError)}
        variant="Drive"
        label={lastError || statusLabel}
        isError={Boolean(lastError)}
        onDismiss={clearError}
      />
    </BackgroundUploadContext.Provider>
  );
};
