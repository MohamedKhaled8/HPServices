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
} from '../utils/folderUtils';
import { writeCachedUnified130Folders } from '../storage/assignmentsCache';

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
}

export const useUnified130Folders = ({
  unified130Files,
  setUnified130Files,
  setSelected130FileIds,
  setFolderDeleteLoading,
  showSnackbarNotification,
}: UseUnified130FoldersOptions) => {
  const [unified130Folders, setUnified130Folders] = useState<AssignmentFolderMeta[]>([]);
  const [unified130CurrentPath, setUnified130CurrentPath] = useState('');
  const [newUnified130FolderName, setNewUnified130FolderName] = useState('');

  const getVisibleUnified130Folders = () => {
    const current = unified130CurrentPath || '';
    return (unified130Folders || []).filter((f) => f.parentPath === current);
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
    } catch (error: any) {
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
      showSnackbarNotification(error.message ? `${error.message} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleDeleteUnified130Folder = async (folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;
    setFolderDeleteLoading({ scope: 'unified130', folderPath });
    try {
      const result = await delete130UnifiedFolder(folderPath);
      const nextFolders = unified130Folders.filter((f) => !(f.path === folderPath || f.path.startsWith(`${folderPath}/`)));
      const nextFiles = unified130Files.filter((f: any) => {
        const fp = String(f.folderPath || '');
        return !(fp === folderPath || fp.startsWith(`${folderPath}/`));
      });
      setUnified130Folders(nextFolders);
      setUnified130Files(nextFiles);
      writeCachedUnified130Folders(nextFolders);

      const cur = unified130CurrentPath || '';
      if (cur === folderPath || cur.startsWith(`${folderPath}/`)) {
        setUnified130CurrentPath(getParentPath(folderPath));
      }

      if (result.deletedFiles.length > 0) {
        setSelected130FileIds((prev) => {
          const s = new Set(prev);
          result.deletedFiles.forEach((id) => s.delete(id));
          return s;
        });
      }

      if (result.deletedFiles.length > 0) {
        try {
          await removeAssignedFilesFromAllStudents(result.deletedFiles);
        } catch {
          // ignore secondary cleanup failure
        }
      }
      showSnackbarNotification('تم حذف المجلد وكل محتوياته', 'success');
    } catch (error: any) {
      showSnackbarNotification(error.message || 'فشل حذف المجلد', 'error');
    } finally {
      setFolderDeleteLoading(null);
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

