import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { getCurrentUser, TrackKey, AssignmentFolderMeta, AssignmentFileMeta, createAssignmentFolderForTrack, create130UnifiedFolder } from '../../../services/firebaseService';
import { uploadToCloudStorage } from '../../../services/cloudStorageService';
import { FolderUploadGroup } from './folderHierarchyParser';
import { UploadBatchRequest, UploadProgressState } from '../types/backgroundUpload.types';

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
    } catch (err: any) {
      attempt++;
      if (attempt >= maxRetries) {
        throw new Error(`فشل رفع الملف "${file.name}": ${err?.message || 'خطأ غير معروف'}`);
      }
      const delayMs = Math.min(500 * Math.pow(2, attempt - 1), 3000);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
};

const uploadFilesConcurrently = async (
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
      const file = files[idx];
      const res = await uploadFileWithRetry(file);
      results[idx] = res;
      onFileDone?.(file, idx);
    }
  });

  await Promise.all(workers);
  return results;
};

const createFolderForScope = async (
  batch: UploadBatchRequest,
  groupName: string
): Promise<AssignmentFolderMeta> => {
  const parentPath = batch.parentPath || '';
  if (batch.scope === 'unified130') {
    return await create130UnifiedFolder(groupName, parentPath);
  }
  const track = batch.trackId || ('track1' as TrackKey);
  return await createAssignmentFolderForTrack(track, groupName, parentPath);
};

const saveCompletedFilesToFirestore = async (
  batch: UploadBatchRequest,
  folder: AssignmentFolderMeta,
  results: UploadResult[],
  adminId: string
): Promise<AssignmentFileMeta[]> => {
  const collectionName = batch.scope === 'unified130' ? 'unified130' : (batch.trackId || 'track1');
  const filesCol = collection(db, 'assignments', collectionName, 'files');
  const savedFiles: AssignmentFileMeta[] = [];

  for (const res of results) {
    const fileRef = doc(filesCol);
    const meta: AssignmentFileMeta = {
      id: fileRef.id,
      name: res.fileName,
      url: res.url,
      track: batch.scope === 'unified130' ? undefined : batch.trackId,
      storagePath: res.fileId || res.url,
      folderPath: folder.path,
      uploadedAt: serverTimestamp(),
    };
    await setDoc(fileRef, {
      ...meta,
      adminId,
      provider: res.provider,
      bucket: 'cloud-storage',
      folderPath: folder.path,
      uploadedAt: serverTimestamp(),
    });
    savedFiles.push(meta);
  }

  return savedFiles;
};

export interface BatchExecutionCallbacks {
  onProgress: (state: UploadProgressState) => void;
  onSubfolderComplete: (folder: AssignmentFolderMeta, files: AssignmentFileMeta[]) => void;
}

export const executeBatchUpload = async (
  batch: UploadBatchRequest,
  callbacks: BatchExecutionCallbacks
): Promise<void> => {
  const user = getCurrentUser();
  if (!user) {
    throw new Error('يجب تسجيل الدخول كمسؤول لرفع المجلدات');
  }

  const { groups } = batch;
  let overallProcessedFiles = 0;

  for (let sIdx = 0; sIdx < groups.length; sIdx++) {
    const group = groups[sIdx];
    const createdFolder = await createFolderForScope(batch, group.folderName);
    let filesInFolderDone = 0;

    callbacks.onProgress({
      currentSubfolderIndex: sIdx + 1,
      totalSubfolders: groups.length,
      currentSubfolderName: createdFolder.name,
      currentFileIndex: 0,
      totalFilesInSubfolder: group.files.length,
      overallProcessedFiles,
      totalFiles: batch.totalFiles,
    });

    const uploadResults = await uploadFilesConcurrently(group.files, 2, () => {
      filesInFolderDone++;
      overallProcessedFiles++;
      callbacks.onProgress({
        currentSubfolderIndex: sIdx + 1,
        totalSubfolders: groups.length,
        currentSubfolderName: createdFolder.name,
        currentFileIndex: filesInFolderDone,
        totalFilesInSubfolder: group.files.length,
        overallProcessedFiles,
        totalFiles: batch.totalFiles,
      });
    });

    const savedFiles = await saveCompletedFilesToFirestore(
      batch,
      createdFolder,
      uploadResults,
      user.uid
    );

    callbacks.onSubfolderComplete(createdFolder, savedFiles);
  }
};
