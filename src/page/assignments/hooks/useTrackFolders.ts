import { useState } from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
  createAssignmentFolderForTrack,
  deleteAssignmentFolderForTrack,
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
  writeCachedTrackFolders,
  removeCachedTrackFolders,
  renameCachedTrackFolder,
} from '../storage/assignmentsCache';
import {
  validateFolderName,
  computeRenamedPath,
  resolveRenameTargets,
  cascadeFolderRenameState,
} from '../utils/folderRenameExecutor';

interface UseTrackFoldersOptions {
  trackFiles: Record<TrackKey, any[]>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selectedFolderPaths?: Record<TrackKey, Set<string>>;
  setFolderDeleteLoading: React.Dispatch<React.SetStateAction<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>>;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
  setDeletingFolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export const useTrackFolders = ({
  trackFiles,
  setTrackFiles,
  setSelectedFileIds,
  setSelectedFolderPaths,
  selectedFolderPaths,
  setFolderDeleteLoading,
  showSnackbarNotification,
  setDeletingFolderPaths,
}: UseTrackFoldersOptions) => {
  const [activeTrackFolder, setActiveTrackFolder] = useState<TrackKey>('track1');
  const [trackFolders, setTrackFolders] = useState<Record<TrackKey, AssignmentFolderMeta[]>>({
    track1: [],
    track2: [],
    track3: []
  });
  const [trackCurrentPath, setTrackCurrentPath] = useState<Record<TrackKey, string>>({
    track1: '',
    track2: '',
    track3: ''
  });
  const [newTrackFolderName, setNewTrackFolderName] = useState('');
  const [renamingFolderPaths, setRenamingFolderPaths] = useState<Set<string>>(new Set());

  const getVisibleTrackFolders = (track: TrackKey) => {
    const current = trackCurrentPath[track] || '';
    return getVisibleFoldersAtLevel(trackFolders[track] || [], current);
  };

  const handleCreateTrackFolder = async (track: TrackKey) => {
    const folderName = newTrackFolderName.trim();
    if (!folderName) return;
    try {
      const created = await createAssignmentFolderForTrack(track, folderName, trackCurrentPath[track] || '');
      setTrackFolders((prev) => {
        const next = { ...prev, [track]: mergeFoldersByPath(prev[track] || [], [created]) };
        writeCachedTrackFolders(next);
        return next;
      });
      setNewTrackFolderName('');
      showSnackbarNotification('تم إنشاء المجلد بنجاح', 'success');
    } catch (error: unknown) {
      const fallback: AssignmentFolderMeta = {
        id: `local_${Date.now()}`,
        name: folderName.replace(/[\\/:*?"<>|]/g, '_').trim(),
        path: (trackCurrentPath[track] ? `${trackCurrentPath[track]}/` : '') + folderName.replace(/[\\/:*?"<>|]/g, '_').trim(),
        parentPath: trackCurrentPath[track] || ''
      };
      setTrackFolders((prev) => {
        const next = { ...prev, [track]: mergeFoldersByPath(prev[track] || [], [fallback]) };
        writeCachedTrackFolders(next);
        return next;
      });
      setNewTrackFolderName('');
      const msg = error instanceof Error ? error.message : '';
      showSnackbarNotification(msg ? `${msg} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleDeleteTrackFolder = async (track: TrackKey, folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;

    setFolderDeleteLoading({ scope: 'track', track, folderPath });
    setDeletingFolderPaths?.((prev) => new Set(prev).add(folderPath));

    try {
      const knownFolderIds = getFolderAndDescendantIds(trackFolders[track] || [], folderPath);
      const knownFiles = getFilesInsideFolderPath(trackFiles[track] || [], folderPath);
      const preloadedStorage = knownFiles
        .filter((f) => f.storagePath)
        .map((f) => ({ storagePath: f.storagePath, provider: f.provider }));

      const result = await deleteAssignmentFolderForTrack(
        track,
        folderPath,
        preloadedStorage,
        knownFolderIds,
        knownFiles
      );

      setTrackFolders((prev) => {
        const currentList = prev[track] || [];
        const updatedList = filterOutFolderAndDescendants(currentList, folderPath);
        const next = { ...prev, [track]: updatedList };
        writeCachedTrackFolders(next);
        return next;
      });
      removeCachedTrackFolders(track, [folderPath]);

      setTrackFiles((prev) => {
        const currentFiles = prev[track] || [];
        const updatedFiles = filterOutFolderAndDescendants(currentFiles, folderPath);
        return { ...prev, [track]: updatedFiles };
      });

      setTrackCurrentPath((p) => {
        const cur = p[track] || '';
        if (cur === folderPath || cur.startsWith(`${folderPath}/`)) {
          return { ...p, [track]: getParentPath(folderPath) };
        }
        return p;
      });

      const removedIds = new Set(result.deletedFiles);
      if (removedIds.size > 0) {
        setSelectedFileIds((prev) => {
          const s = new Set(prev[track] || []);
          removedIds.forEach((id) => s.delete(id));
          return { ...prev, [track]: s };
        });
      }

      if (result.deletedFiles.length > 0) {
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

  const handleRenameTrackFolder = async (track: TrackKey, folder: AssignmentFolderMeta, newName: string): Promise<boolean> => {
    const siblings = trackFolders[track] || [];
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
      const currentTrackFiles = trackFiles[track] || [];
      const { descendantFolders, affectedFiles } = resolveRenameTargets(folder, siblings, currentTrackFiles);

      await renameAssignmentFolderInFirestore({
        scope: 'track',
        track,
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
        files: currentTrackFiles,
        selectedFolderPaths: selectedFolderPaths ? (selectedFolderPaths[track] || new Set()) : undefined,
        currentPath: trackCurrentPath[track] || '',
      });

      setTrackFolders((prev) => {
        const next = { ...prev, [track]: updatedFolders };
        writeCachedTrackFolders(next);
        return next;
      });
      renameCachedTrackFolder(track, oldPath, newPath, cleanName);

      setTrackFiles((prev) => ({ ...prev, [track]: updatedFiles }));

      if (setSelectedFolderPaths && updatedSelectedFolderPaths) {
        setSelectedFolderPaths((prev) => ({
          ...prev,
          [track]: updatedSelectedFolderPaths,
        }));
      }

      if (updatedCurrentPath !== undefined) {
        setTrackCurrentPath((prev) => ({
          ...prev,
          [track]: updatedCurrentPath,
        }));
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
    activeTrackFolder,
    setActiveTrackFolder,
    trackFolders,
    setTrackFolders,
    trackCurrentPath,
    setTrackCurrentPath,
    newTrackFolderName,
    setNewTrackFolderName,
    renamingFolderPaths,
    getVisibleTrackFolders,
    handleCreateTrackFolder,
    handleDeleteTrackFolder,
    handleRenameTrackFolder,
  };
};
