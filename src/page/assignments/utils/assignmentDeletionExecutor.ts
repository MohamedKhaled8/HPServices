import {
  TrackKey,
  deleteAssignmentFilesForTrack,
  delete130UnifiedFiles,
  removeAssignedFilesFromAllStudents,
} from '../../../services/firebaseService';

export interface ExecuteFileDeleteOptions {
  fileIds: string[];
  source: 'track' | 'single-track' | 'unified130';
  track?: TrackKey;
  mode: 'both' | 'server-only' | 'students-only' | boolean;
  showSnackbarNotification: (msg: string, type?: 'success' | 'error') => void;
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setIsRemovingFromUsers: (val: boolean) => void;
  setIsDeleting130: (val: boolean) => void;
  setIsDeletingAssignments: React.Dispatch<React.SetStateAction<Record<TrackKey, boolean>>>;
  setAnimatingDeleteIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setAssignmentsMessage: (msg: string | null) => void;
}

export const executeFileDeletion = async ({
  fileIds,
  source,
  track,
  mode,
  showSnackbarNotification,
  setUnified130Files,
  setSelected130FileIds,
  setTrackFiles,
  setSelectedFileIds,
  setIsRemovingFromUsers,
  setIsDeleting130,
  setIsDeletingAssignments,
  setAnimatingDeleteIds,
  setAssignmentsMessage,
}: ExecuteFileDeleteOptions): Promise<void> => {
  if (!fileIds || fileIds.length === 0) return;

  // 1. الخيار: سحب من حسابات الطلاب فقط (الملف يبقى في الداش بورد)
  if (mode === 'students-only') {
    setIsRemovingFromUsers(true);
    try {
      const removedCount = await removeAssignedFilesFromAllStudents(fileIds);
      showSnackbarNotification(
        `تم سحب ${fileIds.length} ملف بنجاح من ${removedCount} طالب (الملفات محفوظة في الداش بورد)`,
        'success'
      );
      if (source === 'track' && track) {
        setSelectedFileIds((prev) => ({ ...prev, [track]: new Set() }));
      } else if (source === 'unified130') {
        setSelected130FileIds(new Set());
      }
    } catch {
      showSnackbarNotification('حدث خطأ أثناء سحب الملفات من حسابات الطلاب', 'error');
    } finally {
      setIsRemovingFromUsers(false);
    }
    return;
  }

  const alsoRemoveFromUsers = mode === true || mode === 'both';

  try {
    if (source === 'unified130') {
      const isBulk = fileIds.length > 1;
      if (isBulk) setIsDeleting130(true);

      // حذف تفاؤلي فوري من الواجهة دون انتظار الخادم
      let prevUnifiedSnapshot: any[] = [];
      setUnified130Files((prev) => {
        prevUnifiedSnapshot = prev;
        return prev.filter((f) => !fileIds.includes(f.id));
      });
      setSelected130FileIds((prev) => {
        const next = new Set(prev);
        fileIds.forEach((id) => next.delete(id));
        return next;
      });

      // حذف من السيرفر في الخلفية
      try {
        await delete130UnifiedFiles(fileIds);
        showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');

        if (alsoRemoveFromUsers) {
          removeAssignedFilesFromAllStudents(fileIds).catch(() => {});
        }
      } catch (err: any) {
        // استعادة الحالة عند فشل الخادم
        setUnified130Files(prevUnifiedSnapshot);
        showSnackbarNotification(err.message || 'فشل حذف الملف من السيرفر، تم استعادة الملف', 'error');
      } finally {
        if (isBulk) setIsDeleting130(false);
      }
    } else if (source === 'track' || source === 'single-track') {
      const targetTrack = track!;
      const isBulk = source === 'track';

      // لا نفعّل مؤشر الحذف الجماعي إلا عند المسح الجماعي فقط
      if (isBulk) {
        setIsDeletingAssignments((prev) => ({ ...prev, [targetTrack]: true }));
      }
      setAssignmentsMessage(null);

      // تفعيل أنيميشن الحذف على الصف المستهدف
      setAnimatingDeleteIds((prev) => ({
        ...prev,
        [targetTrack]: new Set(fileIds),
      }));

      // حذف تفاؤلي فوري من الواجهة دون تعليق
      let prevTrackSnapshot: any[] = [];
      setTrackFiles((prev) => {
        prevTrackSnapshot = prev[targetTrack] || [];
        return {
          ...prev,
          [targetTrack]: prevTrackSnapshot.filter((file) => !fileIds.includes(file.id)),
        };
      });

      setSelectedFileIds((prev) => {
        const nextSet = new Set(prev[targetTrack] || []);
        fileIds.forEach((id) => nextSet.delete(id));
        return { ...prev, [targetTrack]: nextSet };
      });

      // حذف من السيرفر في الخلفية
      try {
        await deleteAssignmentFilesForTrack(targetTrack, fileIds);
        showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');

        if (alsoRemoveFromUsers) {
          removeAssignedFilesFromAllStudents(fileIds).catch(() => {});
        }
      } catch (err: any) {
        // استعادة الحالة عند فشل الخادم
        setTrackFiles((prev) => ({
          ...prev,
          [targetTrack]: prevTrackSnapshot,
        }));
        showSnackbarNotification(err.message || 'فشل حذف الملف من السيرفر، تم استعادة الملف', 'error');
      } finally {
        if (isBulk) {
          setIsDeletingAssignments((prev) => ({ ...prev, [targetTrack]: false }));
        }
        setAnimatingDeleteIds((prev) => ({
          ...prev,
          [targetTrack]: new Set(),
        }));
      }
    }
  } catch {
    showSnackbarNotification('حدث خطأ غير متوقع أثناء الحذف', 'error');
  }
};
