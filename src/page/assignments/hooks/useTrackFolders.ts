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
} from '../utils/folderUtils';
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
    return (trackFolders[track] || []).filter((f) => f.parentPath === current);
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
    setFolderDeleteLoading({ scope: 'track', track, folderPath });
    try {
      const result = await deleteAssignmentFolderForTrack(track, folderPath);

      const nextFolders = {
        ...trackFolders,
        [track]: (trackFolders[track] || []).filter((f) => !(f.path === folderPath || f.path.startsWith(`${folderPath}/`)))
      };
      const nextFiles = {
        ...trackFiles,
        [track]: (trackFiles[track] || []).filter((f: any) => {
          const fp = String(f.folderPath || '');
          return !(fp === folderPath || fp.startsWith(`${folderPath}/`));
        })
      };
      setTrackFolders(nextFolders);
      setTrackFiles(nextFiles);
      writeCachedTrackFolders(nextFolders);

      const cur = trackCurrentPath[track] || '';
      if (cur === folderPath || cur.startsWith(`${folderPath}/`)) {
        setTrackCurrentPath((p) => ({ ...p, [track]: getParentPath(folderPath) }));
      }

      const removedIds = new Set(result.deletedFiles);
      if (removedIds.size > 0) {
        setSelectedFileIds((prev) => {
          const s = new Set(prev[track] || []);
          removedIds.forEach((id) => s.delete(id));
          return { ...prev, [track]: s };
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

