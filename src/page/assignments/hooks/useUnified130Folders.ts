import { useState } from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
  create130UnifiedFolder,
  delete130UnifiedFolder,
  removeAssignedFilesFromAllStudents,
} from '../../../services/firebaseService';
import {
  mergeFoldersByPath,
  getParentPath,
  getPathLastName,
  filterOutFolderAndDescendants,
  getFolderAndDescendantIds,
  getFilesInsideFolderPath,
} from '../utils/folderUtils';
import { getVisibleFoldersAtLevel } from '../utils/folderTreeUtils';
import { writeCachedUnified130Folders, removeCachedUnified130Folders } from '../storage/assignmentsCache';

interface UseUnified130FoldersOptions {
  unified130Files: any[];
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setFolderDeleteLoading: React.Dispatch<React.SetStateAction<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>>;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
  setDeletingFolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useUnified130Folders = ({
  unified130Files,
  setUnified130Files,
  setSelected130FileIds,
  setFolderDeleteLoading,
  showSnackbarNotification,
  setDeletingFolderPaths,
}: UseUnified130FoldersOptions) => {
  const [unified130Folders, setUnified130Folders] = useState<AssignmentFolderMeta[]>([]);
  const [unified130CurrentPath, setUnified130CurrentPath] = useState('');
  const [newUnified130FolderName, setNewUnified130FolderName] = useState('');

  const getVisibleUnified130Folders = () => {
    const current = unified130CurrentPath || '';
    return getVisibleFoldersAtLevel(unified130Folders || [], current);
  };

  const handleCreateUnified130Folder = async () => {
    const folderName = newUnified130FolderName.trim();
    if (!folderName) return;
    try {
      const created = await create130UnifiedFolder(folderName, unified130CurrentPath || '');
      setUnified130Folders((prev) => {
        const next = mergeFoldersByPath(prev, [created]);
        writeCachedUnified130Folders(next);
        return next;
      });
      setNewUnified130FolderName('');
      showSnackbarNotification('تم إنشاء المجلد بنجاح', 'success');
    } catch (error: unknown) {
      const safe = folderName.replace(/[\\/:*?"<>|]/g, '_').trim();
      const fallback: AssignmentFolderMeta = {
        id: `local_${Date.now()}`,
        name: safe,
        path: (unified130CurrentPath ? `${unified130CurrentPath}/` : '') + safe,
        parentPath: unified130CurrentPath || ''
      };
      setUnified130Folders((prev) => {
        const next = mergeFoldersByPath(prev, [fallback]);
        writeCachedUnified130Folders(next);
        return next;
      });
      setNewUnified130FolderName('');
      const msg = error instanceof Error ? error.message : '';
      showSnackbarNotification(msg ? `${msg} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleDeleteUnified130Folder = async (folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;

    setFolderDeleteLoading({ scope: 'unified130', folderPath });
    setDeletingFolderPaths?.((prev) => new Set(prev).add(folderPath));

    try {
      const knownFolderIds = getFolderAndDescendantIds(unified130Folders, folderPath);
      const knownFiles = getFilesInsideFolderPath(unified130Files, folderPath);
      const preloadedStorage = knownFiles
        .filter((f) => f.storagePath)
        .map((f) => ({ storagePath: f.storagePath, provider: f.provider }));

      const result = await delete130UnifiedFolder(
        folderPath,
        preloadedStorage,
        knownFolderIds,
        knownFiles
      );

      // REAL COMMIT-FIRST: Remove from state & LocalStorage ONLY AFTER Firestore succeeds
      setUnified130Folders((prev) => {
        const nextFolders = filterOutFolderAndDescendants(prev, folderPath);
        writeCachedUnified130Folders(nextFolders);
        return nextFolders;
      });
      removeCachedUnified130Folders([folderPath]);

      setUnified130Files((prev) => filterOutFolderAndDescendants(prev, folderPath));

      setUnified130CurrentPath((cur) => {
        const c = cur || '';
        if (c === folderPath || c.startsWith(`${folderPath}/`)) {
          return getParentPath(folderPath);
        }
        return c;
      });

      if (result.deletedFiles.length > 0) {
        setSelected130FileIds((prev) => {
          const s = new Set(prev);
          result.deletedFiles.forEach((id) => s.delete(id));
          return s;
        });
        void removeAssignedFilesFromAllStudents(result.deletedFiles).catch(console.error);
      }
      showSnackbarNotification('تم حذف المجلد وكل محتوياته بنجاح', 'success');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'فشل حذف المجلد من الخادم';
      showSnackbarNotification(msg, 'error');
    } finally {
      setFolderDeleteLoading(null);
      setDeletingFolderPaths?.((prev) => {
        const next = new Set(prev);
        next.delete(folderPath);
        return next;
      });
    }
  };

  return {
    unified130Folders,
    setUnified130Folders,
    unified130CurrentPath,
    setUnified130CurrentPath,
    newUnified130FolderName,
    setNewUnified130FolderName,
    getVisibleUnified130Folders,
    handleCreateUnified130Folder,
    handleDeleteUnified130Folder,
  };
};

