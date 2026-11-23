import { useState } from 'react';
import {
  TrackKey,
  AssignmentFolderMeta,
  createAssignmentFolderForTrack,
  deleteAssignmentFolderForTrack,
  removeAssignedFilesFromAllStudents,
} from '../../../services/firebaseService';
import {
  mergeFoldersByPath,
  getParentPath,
  getPathLastName,
  filterOutFolderAndDescendants,
} from '../utils/folderUtils';
import { getVisibleFoldersAtLevel } from '../utils/folderTreeUtils';
import { writeCachedTrackFolders } from '../storage/assignmentsCache';

interface UseTrackFoldersOptions {
  trackFiles: Record<TrackKey, any[]>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setFolderDeleteLoading: React.Dispatch<React.SetStateAction<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>>;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useTrackFolders = ({
  trackFiles,
  setTrackFiles,
  setSelectedFileIds,
  setFolderDeleteLoading,
  showSnackbarNotification,
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
    } catch (error: any) {
      // fallback local-only folder حتى لا يختفي عند إعادة فتح الصفحة
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
      showSnackbarNotification(error.message ? `${error.message} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleDeleteTrackFolder = async (track: TrackKey, folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;

    // Snapshot previous state for instant rollback if deletion fails
    let prevFoldersSnapshot: Record<TrackKey, AssignmentFolderMeta[]> = trackFolders;
    let prevFilesSnapshot: Record<TrackKey, any[]> = trackFiles;

    // Optimistic removal: remove folder and nested items from UI and cache immediately
    setTrackFolders((prev) => {
      prevFoldersSnapshot = prev;
      const currentList = prev[track] || [];
      const updatedList = filterOutFolderAndDescendants(currentList, folderPath);
      const next = { ...prev, [track]: updatedList };
      writeCachedTrackFolders(next);
      return next;
    });

    setTrackFiles((prev) => {
      prevFilesSnapshot = prev;
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

    setFolderDeleteLoading({ scope: 'track', track, folderPath });
    try {
      const result = await deleteAssignmentFolderForTrack(track, folderPath);

      const removedIds = new Set(result.deletedFiles);
      if (removedIds.size > 0) {
        setSelectedFileIds((prev) => {
          const s = new Set(prev[track] || []);
          removedIds.forEach((id) => s.delete(id));
          return { ...prev, [track]: s };
        });
      }

      if (result.deletedFiles.length > 0) {
        // Non-blocking secondary student records cleanup
        removeAssignedFilesFromAllStudents(result.deletedFiles).catch(() => {});
      }
      showSnackbarNotification('تم حذف المجلد وكل محتوياته بنجاح', 'success');
    } catch (error: any) {
      // Rollback on genuine failure
      setTrackFolders(prevFoldersSnapshot);
      writeCachedTrackFolders(prevFoldersSnapshot);
      setTrackFiles(prevFilesSnapshot);
      showSnackbarNotification(error.message || 'فشل حذف المجلد من الخادم، تم استعادة البيانات', 'error');
    } finally {
      setFolderDeleteLoading(null);
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
    getVisibleTrackFolders,
    handleCreateTrackFolder,
    handleDeleteTrackFolder,
  };
};

