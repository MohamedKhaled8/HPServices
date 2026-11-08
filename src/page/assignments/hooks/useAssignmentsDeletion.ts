import { useState } from 'react';
import {
  TrackKey,
  deleteAssignmentFilesForTrack,
  delete130UnifiedFiles,
  removeAssignedFilesFromAllStudents,
} from '../../../services/firebaseService';
import { DeleteConfirmModalState } from '../types/assignments.types';

interface UseAssignmentsDeletionOptions {
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setAssignmentsMessage: (msg: string | null) => void;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useAssignmentsDeletion = ({
  selectedFileIds,
  setSelectedFileIds,
  selected130FileIds,
  setSelected130FileIds,
  setTrackFiles,
  setUnified130Files,
  setAssignmentsMessage,
  showSnackbarNotification,
}: UseAssignmentsDeletionOptions) => {
  const [isDeletingAssignments, setIsDeletingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false
  });
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set()
  });
  const [isDeleting130, setIsDeleting130] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DeleteConfirmModalState>({
    open: false,
    fileIds: [],
    source: 'track'
  });
  const [isRemovingFromUsers, setIsRemovingFromUsers] = useState(false);

  /** أثناء حذف فولدر (قد ياخد وقتًا بسبب Firestore والتخزين + تنظيف الطلاب) */
  const [folderDeleteLoading, setFolderDeleteLoading] = useState<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>(null);

  const handle130Delete = () => {
    const ids = Array.from(selected130FileIds);
    if (ids.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, source: 'unified130' });
  };

  const handleDeleteSelected = (track: TrackKey) => {
    const ids = Array.from(selectedFileIds[track] || []);
    if (ids.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, source: 'track', track });
  };

  // حذف ملف واحد من track مع modal
  const handleDeleteSingleTrackFile = (track: TrackKey, fileId: string) => {
    setDeleteConfirmModal({ open: true, fileIds: [fileId], source: 'single-track', track, singleFileId: fileId });
  };

  /**
   * تنفيذ الحذف الفعلي بعد التأكيد
   * @param alsoRemoveFromUsers - هل نحذف الملفات من حسابات الطلاب أيضاً
   */
  const executeDelete = async (alsoRemoveFromUsers: boolean) => {
    const { fileIds, source, track } = deleteConfirmModal;
    setDeleteConfirmModal(prev => ({ ...prev, open: false }));

    try {
      if (source === 'unified130') {
        // === حذف ملفات الـ 130 الموحدة ===
        setIsDeleting130(true);

        if (alsoRemoveFromUsers) {
          setIsRemovingFromUsers(true);
          try {
            const removedCount = await removeAssignedFilesFromAllStudents(fileIds);
            showSnackbarNotification(`تم حذف الملفات من ${removedCount} طالب`, 'success');
          } catch (err: any) {
            showSnackbarNotification('حدث خطأ أثناء حذف الملفات من الطلاب', 'error');
          } finally {
            setIsRemovingFromUsers(false);
          }
        }

        await delete130UnifiedFiles(fileIds);
        setUnified130Files(prev => prev.filter(f => !fileIds.includes(f.id)));
        setSelected130FileIds(new Set());
        showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');
        setIsDeleting130(false);

      } else if (source === 'track' || source === 'single-track') {
        // === حذف ملفات من المسار ===
        const targetTrack = track!;
        setIsDeletingAssignments(prev => ({ ...prev, [targetTrack]: true }));
        setAssignmentsMessage(null);

        if (alsoRemoveFromUsers) {
          setIsRemovingFromUsers(true);
          try {
            const removedCount = await removeAssignedFilesFromAllStudents(fileIds);
            showSnackbarNotification(`تم حذف الملفات من ${removedCount} طالب`, 'success');
          } catch (err: any) {
            showSnackbarNotification('حدث خطأ أثناء حذف الملفات من الطلاب', 'error');
          } finally {
            setIsRemovingFromUsers(false);
          }
        }

        // أنيميشن الحذف
        setAnimatingDeleteIds(prev => ({
          ...prev,
          [targetTrack]: new Set(fileIds)
        }));
        await new Promise(resolve => setTimeout(resolve, 600));

        // حذف من الواجهة فوراً
        setTrackFiles(prev => ({
          ...prev,
          [targetTrack]: (prev[targetTrack] || []).filter(file => !fileIds.includes(file.id))
        }));
        if (source === 'track') {
          setSelectedFileIds(prev => ({
            ...prev,
            [targetTrack]: new Set()
          }));
        }

        // حذف من السيرفر (نضمن إيقاف حالة التحميل دائماً)
        try {
          await deleteAssignmentFilesForTrack(targetTrack, fileIds);
          showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');
        } catch (err) {
          showSnackbarNotification('حدث خطأ أثناء الحذف من السيرفر', 'error');
        } finally {
          setIsDeletingAssignments(prev => ({ ...prev, [targetTrack]: false }));
          setAnimatingDeleteIds(prev => ({
            ...prev,
            [targetTrack]: new Set()
          }));
        }
      }
    } catch (error: any) {
      showSnackbarNotification('حدث خطأ غير متوقع', 'error');
    }
  };

  return {
    isDeletingAssignments,
    setIsDeletingAssignments,
    animatingDeleteIds,
    setAnimatingDeleteIds,
    isDeleting130,
    setIsDeleting130,
    deleteConfirmModal,
    setDeleteConfirmModal,
    isRemovingFromUsers,
    setIsRemovingFromUsers,
    folderDeleteLoading,
    setFolderDeleteLoading,
    handle130Delete,
    handleDeleteSelected,
    handleDeleteSingleTrackFile,
    executeDelete,
  };
};

