import React from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
  deleteAssignmentFilesForTrack,
  delete130UnifiedFiles,
  deleteAssignmentFolderForTrack,
  delete130UnifiedFolder,
  removeAssignedFilesFromAllStudents,
} from '../../../services/firebaseService';
import {
  writeCachedTrackFolders,
  writeCachedUnified130Folders,
  removeCachedTrackFolders,
  removeCachedUnified130Folders,
} from '../storage/assignmentsCache';
import {
  filterOutFolderAndDescendants,
  getFolderAndDescendantIds,
  getFilesInsideFolderPath,
} from './folderUtils';

export interface FileItemWithStorage {
  id: string;
  name?: string;
  folderPath?: string;
  storagePath?: string;
  provider?: string;
}

export interface ExecuteFileDeleteOptions {
  fileIds: string[];
  folderPaths?: string[];
  source: 'track' | 'single-track' | 'unified130';
  track?: TrackKey;
  mode: 'both' | 'server-only' | 'students-only' | boolean;
  showSnackbarNotification: (msg: string, type?: 'success' | 'error') => void;
  setUnified130Files: React.Dispatch<React.SetStateAction<FileItemWithStorage[]>>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, FileItemWithStorage[]>>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setIsRemovingFromUsers: (val: boolean) => void;
  setIsDeleting130: (val: boolean) => void;
  setIsDeletingAssignments: React.Dispatch<React.SetStateAction<Record<TrackKey, boolean>>>;
  setAnimatingDeleteIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setAssignmentsMessage: (msg: string | null) => void;
  setTrackFolders?: React.Dispatch<React.SetStateAction<Record<TrackKey, AssignmentFolderMeta[]>>>;
  setUnified130Folders?: React.Dispatch<React.SetStateAction<AssignmentFolderMeta[]>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setSelected130FolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
  trackFiles?: Record<TrackKey, FileItemWithStorage[]>;
  unified130Files?: FileItemWithStorage[];
  trackFolders?: Record<TrackKey, AssignmentFolderMeta[]>;
  unified130Folders?: AssignmentFolderMeta[];
  setDeletingFolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const executeFileDeletion = async (opts: ExecuteFileDeleteOptions): Promise<void> => {
  const { fileIds, folderPaths = [], source, track, mode, showSnackbarNotification } = opts;
  if ((!fileIds || fileIds.length === 0) && (!folderPaths || folderPaths.length === 0)) return;

  if (mode === 'students-only') {
    opts.setIsRemovingFromUsers(true);
    try {
      const count = await removeAssignedFilesFromAllStudents(fileIds);
      showSnackbarNotification(`تم سحب ${fileIds.length} ملف بنجاح من ${count} طالب`, 'success');
      if (source === 'track' && track) {
        opts.setSelectedFileIds((prev) => ({ ...prev, [track]: new Set() }));
        opts.setSelectedFolderPaths?.((prev) => ({ ...prev, [track]: new Set() }));
      } else if (source === 'unified130') {
        opts.setSelected130FileIds(new Set());
        opts.setSelected130FolderPaths?.(new Set());
      }
    } catch (err: unknown) {
      showSnackbarNotification(err instanceof Error ? err.message : 'حدث خطأ أثناء سحب الملفات', 'error');
    } finally {
      opts.setIsRemovingFromUsers(false);
    }
    return;
  }

  const alsoRemove = mode === true || mode === 'both';
  const is130 = source === 'unified130';
  const targetTrack = track;

  if (folderPaths.length > 0) {
    opts.setDeletingFolderPaths?.((prev) => new Set([...prev, ...folderPaths]));
  }
  if (is130 && (fileIds.length > 1 || folderPaths.length > 0)) opts.setIsDeleting130(true);
  if (!is130 && targetTrack) {
    if (source === 'track') opts.setIsDeletingAssignments((prev) => ({ ...prev, [targetTrack]: true }));
    opts.setAssignmentsMessage(null);
    opts.setAnimatingDeleteIds((prev) => ({ ...prev, [targetTrack]: new Set(fileIds) }));
  }

  try {
    const deletedIds = [...fileIds];
    const foldersList = is130 ? (opts.unified130Folders || []) : (opts.trackFolders?.[targetTrack!] || []);
    const filesList = is130 ? (opts.unified130Files || []) : (opts.trackFiles?.[targetTrack!] || []);

    for (const fp of folderPaths) {
      const kIds = getFolderAndDescendantIds(foldersList, fp);
      const kFiles = getFilesInsideFolderPath(filesList, fp);
      const storage = kFiles.filter((f) => f.storagePath).map((f) => ({ storagePath: f.storagePath, provider: f.provider }));
      const res = is130
        ? await delete130UnifiedFolder(fp, storage, kIds, kFiles)
        : await deleteAssignmentFolderForTrack(targetTrack!, fp, storage, kIds, kFiles);
      deletedIds.push(...res.deletedFiles);
    }

    if (fileIds.length > 0) {
      const storage = filesList.filter((f) => fileIds.includes(f.id) && f.storagePath).map((f) => ({ storagePath: f.storagePath, provider: f.provider }));
      if (is130) await delete130UnifiedFiles(fileIds, storage);
      else await deleteAssignmentFilesForTrack(targetTrack!, fileIds, storage);
    }

    // REAL COMMIT-FIRST: Update state & cache strictly after Firestore succeeds
    if (is130) {
      opts.setUnified130Files((prev) => {
        let next = prev.filter((f) => !fileIds.includes(f.id));
        folderPaths.forEach((fp) => { next = filterOutFolderAndDescendants(next, fp); });
        return next;
      });
      if (opts.setUnified130Folders && folderPaths.length > 0) {
        opts.setUnified130Folders((prev) => {
          let next = prev;
          folderPaths.forEach((fp) => { next = filterOutFolderAndDescendants(next, fp); });
          writeCachedUnified130Folders(next);
          return next;
        });
        removeCachedUnified130Folders(folderPaths);
      }
      opts.setSelected130FileIds((prev) => {
        const next = new Set(prev);
        fileIds.forEach((id) => next.delete(id));
        return next;
      });
      opts.setSelected130FolderPaths?.((prev) => {
        const next = new Set(prev);
        folderPaths.forEach((p) => next.delete(p));
        return next;
      });
    } else if (targetTrack) {
      opts.setTrackFiles((prev) => {
        const cur = prev[targetTrack] || [];
        let next = cur.filter((f) => !fileIds.includes(f.id));
        folderPaths.forEach((fp) => { next = filterOutFolderAndDescendants(next, fp); });
        return { ...prev, [targetTrack]: next };
      });
      if (opts.setTrackFolders && folderPaths.length > 0) {
        opts.setTrackFolders((prev) => {
          const cur = prev[targetTrack] || [];
          let next = cur;
          folderPaths.forEach((fp) => { next = filterOutFolderAndDescendants(next, fp); });
          writeCachedTrackFolders({ ...prev, [targetTrack]: next });
          return { ...prev, [targetTrack]: next };
        });
        removeCachedTrackFolders(targetTrack, folderPaths);
      }
      opts.setSelectedFileIds((prev) => {
        const next = new Set(prev[targetTrack] || []);
        fileIds.forEach((id) => next.delete(id));
        return { ...prev, [targetTrack]: next };
      });
      opts.setSelectedFolderPaths?.((prev) => {
        const next = new Set(prev[targetTrack] || []);
        folderPaths.forEach((p) => next.delete(p));
        return { ...prev, [targetTrack]: next };
      });
    }

    showSnackbarNotification(`تم مسح ${folderPaths.length + fileIds.length} عنصر بنجاح`, 'success');
    if (alsoRemove && deletedIds.length > 0) {
      void removeAssignedFilesFromAllStudents(deletedIds).catch(console.error);
    }
  } catch (err: unknown) {
    showSnackbarNotification(err instanceof Error ? err.message : 'فشل حذف العناصر من السيرفر', 'error');
  } finally {
    if (is130) opts.setIsDeleting130(false);
    if (!is130 && targetTrack) {
      opts.setIsDeletingAssignments((prev) => ({ ...prev, [targetTrack]: false }));
      opts.setAnimatingDeleteIds((prev) => ({ ...prev, [targetTrack]: new Set() }));
    }
    if (folderPaths.length > 0) {
      opts.setDeletingFolderPaths?.((prev) => {
        const next = new Set(prev);
        folderPaths.forEach((p) => next.delete(p));
        return next;
      });
    }
  }
};
