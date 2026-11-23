import { doc, collection, setDoc, updateDoc, deleteDoc, increment, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getCurrentUser, TrackKey, AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService';
import { uploadToCloudStorage } from '../../../services/cloudStorageService';
import { getGoogleDriveAccessToken } from '../../../services/googleDriveService';
import { stripUndefined } from './folderUtils';
import { UploadBatchRequest, UploadProgressState } from '../types/backgroundUpload.types';

interface UploadResult { url: string; provider: string; fileId?: string; fileName: string; }

const uploadFileWithRetry = async (file: File, maxRetries = 3): Promise<UploadResult> => {
  let attempt = 0;
  while (true) {
    try {
      return (await uploadToCloudStorage(file)) as UploadResult;
    } catch (err: unknown) {
      if (++attempt >= maxRetries) {
        throw new Error(`فشل رفع الملف "${file.name}": ${err instanceof Error ? err.message : 'خطأ غير معروف'}`);
      }
      await new Promise((r) => setTimeout(r, Math.min(500 * Math.pow(2, attempt - 1), 3000)));
    }
  }
};

const uploadFilesConcurrently = async (
  files: File[], concurrency = 2, onFileDone?: (file: File, index: number) => void
): Promise<UploadResult[]> => {
  const results: UploadResult[] = new Array(files.length);
  let currentIndex = 0;
  const workerCount = Math.max(1, Math.min(concurrency, files.length));

  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (currentIndex < files.length) {
      const idx = currentIndex++;
      results[idx] = await uploadFileWithRetry(files[idx]);
      onFileDone?.(files[idx], idx);
    }
  }));
  return results;
};

const createFolderDoc = async (
  scope: 'track' | 'unified130', trackId: TrackKey | undefined, name: string, parentPath: string, extraMeta?: Partial<AssignmentFolderMeta>
): Promise<AssignmentFolderMeta> => {
  const colName = scope === 'unified130' ? 'unified130' : (trackId || 'track1');
  const folderRef = doc(collection(db, 'assignments', colName, 'folders'));
  const safeName = name.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';
  const path = parentPath ? `${parentPath}/${safeName}` : safeName;

  const folder: AssignmentFolderMeta = {
    id: folderRef.id, name: safeName, path, parentPath: extraMeta?.parentPath ?? parentPath ?? '',
    parentFolderId: extraMeta?.parentFolderId ?? null,
    isParentFolder: Boolean(extraMeta?.isParentFolder),
    subfoldersCount: typeof extraMeta?.subfoldersCount === 'number' ? extraMeta.subfoldersCount : 0,
    totalFilesCount: typeof extraMeta?.totalFilesCount === 'number' ? extraMeta.totalFilesCount : 0,
  };
  await setDoc(folderRef, stripUndefined({ ...folder, createdAt: serverTimestamp() }));
  return folder;
};

const saveCompletedFilesToFirestore = async (
  batch: UploadBatchRequest, folder: AssignmentFolderMeta, results: UploadResult[], adminId: string
): Promise<AssignmentFileMeta[]> => {
  const colName = batch.scope === 'unified130' ? 'unified130' : (batch.trackId || 'track1');
  const filesCol = collection(db, 'assignments', colName, 'files');
  const savedFiles: AssignmentFileMeta[] = [];

  for (const res of results) {
    const fileRef = doc(filesCol);
    const meta: AssignmentFileMeta = {
      id: fileRef.id, name: res.fileName, url: res.url,
      track: batch.scope === 'unified130' ? undefined : batch.trackId,
      storagePath: res.fileId || res.url, folderPath: folder.path || '',
      folderId: folder.id || null, folderName: folder.name || '', folder: folder.path || '',
      uploadedAt: serverTimestamp(),
    };
    await setDoc(fileRef, stripUndefined({ ...meta, adminId, provider: res.provider, bucket: 'cloud-storage', uploadedAt: serverTimestamp() }));
    savedFiles.push(meta);
  }
  return savedFiles;
};

export interface BatchExecutionCallbacks {
  onProgress: (state: UploadProgressState) => void;
  onSubfolderComplete: (folder: AssignmentFolderMeta, files: AssignmentFileMeta[]) => void;
  onParentFolderCreated?: (parentFolder: AssignmentFolderMeta) => void;
}

export const executeBatchUpload = async (batch: UploadBatchRequest, callbacks: BatchExecutionCallbacks): Promise<void> => {
  const user = getCurrentUser();
  if (!user) throw new Error('يجب تسجيل الدخول كمسؤول لرفع المجلدات');
  await getGoogleDriveAccessToken();

  const { groups, uploadStrategy = 'extract-subfolders' } = batch;
  let overallProcessedFiles = 0;
  let parentFolder: AssignmentFolderMeta | null = null;

  if (uploadStrategy === 'keep-parent') {
    const parentName = (batch.parentFolderName || 'مجلد رئيسي').trim();
    parentFolder = await createFolderDoc(batch.scope, batch.trackId, parentName, batch.parentPath || '', {
      parentFolderId: null, isParentFolder: true, subfoldersCount: 0, totalFilesCount: 0,
    });
    callbacks.onParentFolderCreated?.(parentFolder);
  }

  for (let sIdx = 0; sIdx < groups.length; sIdx++) {
    const group = groups[sIdx];
    let filesInFolderDone = 0;
    callbacks.onProgress({
      currentSubfolderIndex: sIdx + 1, totalSubfolders: groups.length, currentSubfolderName: group.folderName,
      currentFileIndex: 0, totalFilesInSubfolder: group.files.length, overallProcessedFiles, totalFiles: batch.totalFiles,
    });

    const uploadResults = await uploadFilesConcurrently(group.files, 2, () => {
      filesInFolderDone++;
      overallProcessedFiles++;
      callbacks.onProgress({
        currentSubfolderIndex: sIdx + 1, totalSubfolders: groups.length, currentSubfolderName: group.folderName,
        currentFileIndex: filesInFolderDone, totalFilesInSubfolder: group.files.length, overallProcessedFiles, totalFiles: batch.totalFiles,
      });
    });

    if (!uploadResults || uploadResults.length === 0) throw new Error(`لم يتم رفع ملفات المجلد "${group.folderName}"`);

    const parentPath = parentFolder ? parentFolder.path : (batch.parentPath || '');
    const parentFolderId = parentFolder ? parentFolder.id : null;
    const createdFolder = await createFolderDoc(batch.scope, batch.trackId, group.folderName, parentPath, {
      parentFolderId, isParentFolder: false, totalFilesCount: uploadResults.length,
    });

    const col = batch.scope === 'unified130' ? 'unified130' : (batch.trackId || 'track1');
    try {
      const savedFiles = await saveCompletedFilesToFirestore(batch, createdFolder, uploadResults, user.uid);
      if (parentFolder) {
        try {
          await updateDoc(doc(db, 'assignments', col, 'folders', parentFolder.id), stripUndefined({
            subfoldersCount: increment(1), totalFilesCount: increment(savedFiles.length),
          }));
        } catch (_) {}
      }
      callbacks.onSubfolderComplete(createdFolder, savedFiles);
    } catch (saveErr) {
      try { await deleteDoc(doc(db, 'assignments', col, 'folders', createdFolder.id)); } catch (_) {}
      throw saveErr;
    }
  }
};
