import { useState } from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
  create130UnifiedFolder,
  delete130UnifiedFolder,
  removeAssignedFilesFromAllStudents,
  renameAssignmentFolderInFirestore,
  syncStudentAssignedFilesOnFolderRename,
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
import {
  writeCachedUnified130Folders,
  removeCachedUnified130Folders,
  renameCachedUnified130Folder,
} from '../storage/assignmentsCache';
import {
  validateFolderName,
  computeRenamedPath,
  resolveRenameTargets,
  cascadeFolderRenameState,
} from '../utils/folderRenameExecutor';

interface UseUnified130FoldersOptions {
  unified130Files: any[];
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setSelected130FolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
  selected130FolderPaths?: Set<string>;
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
  setSelected130FolderPaths,
  selected130FolderPaths,
  setFolderDeleteLoading,
  showSnackbarNotification,
  setDeletingFolderPaths,
}: UseUnified130FoldersOptions) => {
  const [unified130Folders, setUnified130Folders] = useState<AssignmentFolderMeta[]>([]);
  const [unified130CurrentPath, setUnified130CurrentPath] = useState('');
  const [newUnified130FolderName, setNewUnified130FolderName] = useState('');
  const [renamingFolderPaths, setRenamingFolderPaths] = useState<Set<string>>(new Set());

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

  const handleRenameUnified130Folder = async (folder: AssignmentFolderMeta, newName: string): Promise<boolean> => {
    const siblings = unified130Folders || [];
    const validation = validateFolderName(newName, folder, siblings);
    if (!validation.isValid) {
      showSnackbarNotification(validation.error || 'اسم المجلد غير صالح', 'error');
      return false;
    }

    const cleanName = validation.cleanName;
    const oldPath = (folder.path || '').trim();
    const newPath = computeRenamedPath(cleanName, folder.parentPath);

    setRenamingFolderPaths((prev) => new Set(prev).add(oldPath));

    try {
      const currentFiles = unified130Files || [];
      const { descendantFolders, affectedFiles } = resolveRenameTargets(folder, siblings, currentFiles);

      await renameAssignmentFolderInFirestore({
        scope: 'unified130',
        targetFolder: folder,
        newName: cleanName,
        descendantFolders,
        affectedFiles,
      });

      const {
        updatedFolders,
        updatedFiles,
        updatedSelectedFolderPaths,
        updatedCurrentPath,
      } = cascadeFolderRenameState({
        oldPath,
        newPath,
        newName: cleanName,
        folders: siblings,
        files: currentFiles,
        selectedFolderPaths: selected130FolderPaths,
        currentPath: unified130CurrentPath || '',
      });

      setUnified130Folders(updatedFolders);
      writeCachedUnified130Folders(updatedFolders);
      renameCachedUnified130Folder(oldPath, newPath, cleanName);

      setUnified130Files(updatedFiles);

      if (setSelected130FolderPaths && updatedSelectedFolderPaths) {
        setSelected130FolderPaths(updatedSelectedFolderPaths);
      }

      if (updatedCurrentPath !== undefined) {
        setUnified130CurrentPath(updatedCurrentPath);
      }

      void syncStudentAssignedFilesOnFolderRename(oldPath, newPath, cleanName).catch(console.error);

      showSnackbarNotification('تمت إعادة تسمية المجلد بنجاح', 'success');
      return true;
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'فشل إعادة تسمية المجلد في الخادم';
      showSnackbarNotification(msg, 'error');
      return false;
    } finally {
      setRenamingFolderPaths((prev) => {
        const next = new Set(prev);
        next.delete(oldPath);
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
    renamingFolderPaths,
    getVisibleUnified130Folders,
    handleCreateUnified130Folder,
    handleDeleteUnified130Folder,
    handleRenameUnified130Folder,
  };
};
