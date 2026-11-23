import { doc, collection, setDoc, updateDoc, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getCurrentUser, TrackKey, AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService';
import { uploadToCloudStorage } from '../../../services/cloudStorageService';
import { getGoogleDriveAccessToken } from '../../../services/googleDriveService';
import { stripUndefined } from './folderUtils';
import { QueuedUploadJob } from '../types/backgroundUpload.types';

interface UploadResult {
  url: string;
  provider: string;
  fileId?: string;
  fileName: string;
}

const uploadFileWithRetry = async (file: File, maxRetries = 3): Promise<UploadResult> => {
  let attempt = 0;
  while (true) {
    try {
      return (await uploadToCloudStorage(file)) as UploadResult;
    } catch (err: unknown) {
      attempt++;
      const msg = err instanceof Error ? err.message : 'خطأ غير معروف';
      if (attempt >= maxRetries) throw new Error(`فشل رفع الملف "${file.name}": ${msg}`);
      await new Promise((r) => setTimeout(r, Math.min(500 * Math.pow(2, attempt - 1), 3000)));
    }
  }
};

export const uploadJobFilesConcurrently = async (
  files: File[],
  concurrency = 2,
  onFileDone?: (file: File, index: number) => void
): Promise<UploadResult[]> => {
  const results: UploadResult[] = new Array(files.length);
  let currentIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, files.length));

  const workers = Array.from({ length: workerCount }, async () => {
    while (currentIndex < files.length) {
      const idx = currentIndex++;
      results[idx] = await uploadFileWithRetry(files[idx]);
      onFileDone?.(files[idx], idx);
    }
  });

  await Promise.all(workers);
  return results;
};

export const createFirestoreFolderDoc = async (
  scope: 'track' | 'unified130',
  trackId: TrackKey | undefined,
  name: string,
  parentPath: string,
  extraMeta?: Partial<AssignmentFolderMeta>
): Promise<AssignmentFolderMeta> => {
  const colName = scope === 'unified130' ? 'unified130' : (trackId || 'track1');
  const folderRef = doc(collection(db, 'assignments', colName, 'folders'));
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';
  const path = parentPath ? `${parentPath}/${safeName}` : safeName;

  const folder: AssignmentFolderMeta = {
    id: folderRef.id,
    name: safeName,
    path,
    parentPath: extraMeta?.parentPath ?? parentPath ?? '',
    parentFolderId: extraMeta?.parentFolderId ?? null,
    isParentFolder: Boolean(extraMeta?.isParentFolder),
    subfoldersCount: typeof extraMeta?.subfoldersCount === 'number' ? extraMeta.subfoldersCount : 0,
    totalFilesCount: typeof extraMeta?.totalFilesCount === 'number' ? extraMeta.totalFilesCount : 0,
  };

  await setDoc(folderRef, stripUndefined({ ...folder, createdAt: serverTimestamp() }));
  return folder;
};

export const saveJobFilesToFirestore = async (
  job: QueuedUploadJob,
  folder: AssignmentFolderMeta,
  results: UploadResult[],
  adminId: string
): Promise<AssignmentFileMeta[]> => {
  const colName = job.scope === 'unified130' ? 'unified130' : (job.targetTrackId || 'track1');
  const filesCol = collection(db, 'assignments', colName, 'files');
  const savedFiles: AssignmentFileMeta[] = [];

  for (const res of results) {
    const fileRef = doc(filesCol);
    const meta: AssignmentFileMeta = {
      id: fileRef.id,
      name: res.fileName,
      url: res.url,
      track: job.scope === 'unified130' ? undefined : (job.targetTrackId || 'track1'),
      storagePath: res.fileId || res.url,
      folderPath: folder.path || '',
      folderId: folder.id || null,
      folderName: folder.name || '',
      folder: folder.path || '',
      uploadedAt: serverTimestamp(),
    };
    await setDoc(fileRef, stripUndefined({
      ...meta,
      adminId,
      provider: res.provider,
      bucket: 'cloud-storage',
      uploadedAt: serverTimestamp(),
    }));
    savedFiles.push(meta);
  }

  return savedFiles;
};

export interface JobExecutionCallbacks {
  onFileProgress: (fileIndex: number, totalFilesInFolder: number) => void;
  onParentFolderCreated?: (parentFolder: AssignmentFolderMeta) => void;
}

export const executeSingleUploadJob = async (
  job: QueuedUploadJob,
  parentFolderCache: Map<string, AssignmentFolderMeta>,
  callbacks: JobExecutionCallbacks
): Promise<{ createdFolder: AssignmentFolderMeta; savedFiles: AssignmentFileMeta[] }> => {
  const user = getCurrentUser();
  if (!user) throw new Error('يجب تسجيل الدخول كمسؤول لرفع المجلدات');

  // 1. Acquire & validate Google Drive token BEFORE touching Firestore
  await getGoogleDriveAccessToken();

  // 2. Upload files to Cloud Storage FIRST
  let filesDone = 0;
  callbacks.onFileProgress(0, job.files.length);
  const uploadResults = await uploadJobFilesConcurrently(job.files, 2, () => {
    filesDone++;
    callbacks.onFileProgress(filesDone, job.files.length);
  });

  if (!uploadResults || uploadResults.length === 0) {
    throw new Error(`فشل رفع ملفات المجلد "${job.folderName}" — لم يتم رفع أي ملف إلى Google Drive`);
  }

  // 3. Post-upload Firestore write step wrapped with 15-second timeout & quota detection
  const isQuotaError = (err: unknown): boolean => {
    if (!err) return false;
    const anyErr = err as { code?: string; message?: string };
    const code = String(anyErr.code || '');
    const msg = String(anyErr.message || anyErr);
    return (
      code === 'resource-exhausted' ||
      code.includes('resource-exhausted') ||
      msg.includes('resource-exhausted') ||
      msg.includes('Quota exceeded') ||
      msg.includes('quota exceeded') ||
      msg.includes('429')
    );
  };

  const withTimeout = <T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMsg)), ms);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  };

  const savePostUploadToFirestore = async (): Promise<{ createdFolder: AssignmentFolderMeta; savedFiles: AssignmentFileMeta[] }> => {
    let parentFolder: AssignmentFolderMeta | null = null;
    if (job.uploadStrategy === 'keep-parent') {
      if (parentFolderCache.has(job.batchId)) {
        parentFolder = parentFolderCache.get(job.batchId)!;
      } else {
        const parentName = (job.parentFolderName || 'مجلد رئيسي').trim();
        parentFolder = await createFirestoreFolderDoc(
          job.scope,
          job.targetTrackId,
          parentName,
          job.parentPath || '',
          { parentFolderId: null, isParentFolder: true, subfoldersCount: 0, totalFilesCount: 0 }
        );
        parentFolderCache.set(job.batchId, parentFolder);
        callbacks.onParentFolderCreated?.(parentFolder);
      }
    }

    const parentPath = parentFolder ? parentFolder.path : (job.parentPath || '');
    const parentFolderId = parentFolder ? parentFolder.id : null;

    const createdFolder = await createFirestoreFolderDoc(
      job.scope,
      job.targetTrackId,
      job.folderName,
      parentPath,
      { parentFolderId, isParentFolder: false, totalFilesCount: uploadResults.length }
    );

    const col = job.scope === 'unified130' ? 'unified130' : (job.targetTrackId || 'track1');
    try {
      const savedFiles = await saveJobFilesToFirestore(job, createdFolder, uploadResults, user.uid);

      if (parentFolder) {
        try {
          await updateDoc(doc(db, 'assignments', col, 'folders', parentFolder.id), stripUndefined({
            subfoldersCount: increment(1),
            totalFilesCount: increment(savedFiles.length),
          }));
          parentFolder.subfoldersCount = (parentFolder.subfoldersCount || 0) + 1;
          parentFolder.totalFilesCount = (parentFolder.totalFilesCount || 0) + savedFiles.length;
        } catch (_) {}
      }

      return { createdFolder, savedFiles };
    } catch (firestoreErr) {
      try { await deleteDoc(doc(db, 'assignments', col, 'folders', createdFolder.id)); } catch (_) {}
      throw firestoreErr;
    }
  };

  try {
    return await withTimeout(
      savePostUploadToFirestore(),
      15000,
      'انتهت مهلة استجابة السيرفر أثناء حفظ بيانات الملفات (15 ثانية)'
    );
  } catch (err: unknown) {
    if (isQuotaError(err)) {
      throw new Error('انتهت الحصة اليومية لـ Firebase (Quota exceeded) — تعذّر حفظ بيانات الملفات');
    }
    throw err;
  }
};
