import { useState, useMemo } from 'react';
import {
  TrackKey,
  DistributedFileSummary,
  DistributedFolderSummary,
  StudentWithAssignedFiles,
  getDistributedFilesForTrack,
  getDistributedFoldersForTrack,
  getStudentsWithAssignedFiles,
  revokeDistributedFileFromStudents,
  revokeDistributedFolderFromStudents,
  revokeAllFoldersForDate,
  revokeMultipleDistributedFilesFromStudents,
  revokeAllDistributedFilesForTrack,
  revokeSingleFileFromStudent,
  revokeAllFilesFromStudent,
} from '../../../services/firebaseService';
import { RecallModalState } from '../types/assignments.types';

interface UseAssignmentsRecallOptions {
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useAssignmentsRecall = ({
  showSnackbarNotification,
}: UseAssignmentsRecallOptions) => {
  // File Recall Modal state (سحب الملفات الموزعة)
  const [recallModal, setRecallModal] = useState<RecallModalState>({
    open: false,
    track: 'track1',
    tab: 'by_folder',
    loading: false,
    files: [],
    folders: [],
    students: [],
    selectedStudent: null,
    studentSearchQuery: '',
    selectedDateFilter: 'all',
    revokingId: null,
    revokingFolderKey: null,
    isRevokingAll: false,
    isRevokingDateAll: false,
    revokingStudentFileId: null,
    isRevokingStudentAll: false
  });

  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);
  const [confirmRevokeSingle, setConfirmRevokeSingle] = useState<DistributedFileSummary | null>(null);
  const [confirmRevokeFolder, setConfirmRevokeFolder] = useState<DistributedFolderSummary | null>(null);
  const [confirmRevokeDateOpen, setConfirmRevokeDateOpen] = useState(false);
  const [confirmRevokeStudentAllOpen, setConfirmRevokeStudentAllOpen] = useState(false);
  const [selectedRecallFileIds, setSelectedRecallFileIds] = useState<Set<string>>(new Set());
  const [confirmRevokeSelectedOpen, setConfirmRevokeSelectedOpen] = useState(false);
  const [isRevokingSelected, setIsRevokingSelected] = useState(false);

  const handleOpenRecallModal = async (track: TrackKey | 'unified130') => {
    setSelectedRecallFileIds(new Set());
    setRecallModal({
      open: true,
      track,
      tab: 'by_folder',
      loading: true,
      files: [],
      folders: [],
      students: [],
      selectedStudent: null,
      studentSearchQuery: '',
      selectedDateFilter: 'all',
      revokingId: null,
      revokingFolderKey: null,
      isRevokingAll: false,
      isRevokingDateAll: false,
      revokingStudentFileId: null,
      isRevokingStudentAll: false
    });

    try {
      const [distributed, distributedFolders, students] = await Promise.all([
        getDistributedFilesForTrack(track),
        getDistributedFoldersForTrack(track),
        getStudentsWithAssignedFiles(track)
      ]);

      const todayDateString = new Date().toISOString().split('T')[0];
      const hasToday = distributedFolders.some((f) => f.dateString === todayDateString || f.isToday);
      const initialDateFilter = hasToday ? 'today' : 'all';

      setRecallModal((prev) => ({
        ...prev,
        loading: false,
        files: distributed,
        folders: distributedFolders,
        selectedDateFilter: initialDateFilter,
        students
      }));
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, loading: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء فحص الملفات الموزعة', 'error');
    }
  };

  const handleRevokeSingleFile = async (item: DistributedFileSummary) => {
    try {
      setConfirmRevokeSingle(null);
      setRecallModal((prev) => ({ ...prev, revokingId: item.fileId }));

      const count = await revokeDistributedFileFromStudents(item.fileId, item.studentIds);

      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        next.delete(item.fileId);
        return next;
      });

      setRecallModal((prev) => ({
        ...prev,
        revokingId: null,
        files: prev.files.filter((f) => f.fileId !== item.fileId),
        students: prev.students.map((s) => ({
          ...s,
          assignedFiles: s.assignedFiles.filter((f) => f.id !== item.fileId)
        })).filter((s) => s.assignedFiles.length > 0)
      }));

      showSnackbarNotification(`تم سحب ملف "${item.fileName}" بنجاح من حسابات ${count} طالب`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, revokingId: null }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملف', 'error');
    }
  };

  const handleRevokeAllFiles = async () => {
    try {
      setConfirmRevokeAllOpen(false);
      setRecallModal((prev) => ({ ...prev, isRevokingAll: true }));

      const result = await revokeAllDistributedFilesForTrack(recallModal.track);

      setSelectedRecallFileIds(new Set());
      setRecallModal((prev) => ({
        ...prev,
        isRevokingAll: false,
        files: [],
        students: [],
        selectedStudent: null
      }));

      showSnackbarNotification(`تم سحب كافة ملفات المسار بنجاح من ${result.updatedStudents} طالب`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, isRevokingAll: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب جميع الملفات', 'error');
    }
  };

  // أحدث دفعة تم إرسالها (أي ملفات أُرسلت في نافذة 10 دقائق من أحدث ملف)
  const latestBatchFiles = useMemo(() => {
    if (!recallModal.files || recallModal.files.length === 0) return [];
    const firstTime = new Date(recallModal.files[0].assignedAt).getTime();
    if (isNaN(firstTime)) return [recallModal.files[0]];
    const WINDOW_MS = 10 * 60 * 1000;
    return recallModal.files.filter((f) => {
      const t = new Date(f.assignedAt).getTime();
      return !isNaN(t) && firstTime - t <= WINDOW_MS;
    });
  }, [recallModal.files]);

  const isLatestBatchSelected = useMemo(() => {
    if (latestBatchFiles.length === 0) return false;
    return latestBatchFiles.every((f) => selectedRecallFileIds.has(f.fileId));
  }, [latestBatchFiles, selectedRecallFileIds]);

  const isAllFilesSelected = useMemo(() => {
    if (recallModal.files.length === 0) return false;
    return recallModal.files.every((f) => selectedRecallFileIds.has(f.fileId));
  }, [recallModal.files, selectedRecallFileIds]);

  const handleToggleSelectFile = (fileId: string) => {
    setSelectedRecallFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiles = () => {
    if (isAllFilesSelected) {
      setSelectedRecallFileIds(new Set());
    } else {
      setSelectedRecallFileIds(new Set(recallModal.files.map((f) => f.fileId)));
    }
  };

  const handleToggleSelectLatestBatch = () => {
    if (isLatestBatchSelected) {
      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        latestBatchFiles.forEach((f) => next.delete(f.fileId));
        return next;
      });
    } else {
      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        latestBatchFiles.forEach((f) => next.add(f.fileId));
        return next;
      });
    }
  };

  const handleRevokeSelectedFiles = async () => {
    try {
      const fileIdsToRevoke = Array.from(selectedRecallFileIds);
      if (fileIdsToRevoke.length === 0) return;

      setConfirmRevokeSelectedOpen(false);
      setIsRevokingSelected(true);

      const targetStudentIdSet = new Set<string>();
      recallModal.files
        .filter((f) => selectedRecallFileIds.has(f.fileId))
        .forEach((f) => f.studentIds.forEach((id) => targetStudentIdSet.add(id)));

      const result = await revokeMultipleDistributedFilesFromStudents(
        fileIdsToRevoke,
        Array.from(targetStudentIdSet)
      );

      const revokedSet = new Set(fileIdsToRevoke);

      setRecallModal((prev) => ({
        ...prev,
        files: prev.files.filter((f) => !revokedSet.has(f.fileId)),
        students: prev.students
          .map((s) => ({
            ...s,
            assignedFiles: s.assignedFiles.filter((f) => !revokedSet.has(f.id))
          }))
          .filter((s) => s.assignedFiles.length > 0)
      }));

      setSelectedRecallFileIds(new Set());
      setIsRevokingSelected(false);

      showSnackbarNotification(
        `تم سحب ${fileIdsToRevoke.length} ملف بنجاح من حسابات ${result.updatedStudentsCount} طالب`,
        'success'
      );
    } catch (err: any) {
      setIsRevokingSelected(false);
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملفات المحددة', 'error');
    }
  };

  const handleRevokeSingleFileFromStudent = async (studentId: string, fileId: string, fileName: string) => {
    try {
      setRecallModal((prev) => ({ ...prev, revokingStudentFileId: fileId }));
      await revokeSingleFileFromStudent(studentId, fileId);

      setRecallModal((prev) => {
        const updatedStudents = prev.students
          .map((s) => {
            if (s.id !== studentId) return s;
            return {
              ...s,
              assignedFiles: s.assignedFiles.filter((f) => f.id !== fileId)
            };
          })
          .filter((s) => s.assignedFiles.length > 0);

        let updatedSelected = prev.selectedStudent;
        if (updatedSelected && updatedSelected.id === studentId) {
          const newFiles = updatedSelected.assignedFiles.filter((f) => f.id !== fileId);
          updatedSelected = newFiles.length > 0 ? { ...updatedSelected, assignedFiles: newFiles } : null;
        }

        return {
          ...prev,
          revokingStudentFileId: null,
          students: updatedStudents,
          selectedStudent: updatedSelected
        };
      });

      showSnackbarNotification(`تم سحب ملف "${fileName}" من الطالب بنجاح`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, revokingStudentFileId: null }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملف من الطالب', 'error');
    }
  };

  const handleRevokeAllFilesFromStudent = async (studentId: string, studentName: string) => {
    try {
      setConfirmRevokeStudentAllOpen(false);
      setRecallModal((prev) => ({ ...prev, isRevokingStudentAll: true }));
      const removedCount = await revokeAllFilesFromStudent(studentId, recallModal.track);

      setRecallModal((prev) => {
        const updatedStudents = prev.students.filter((s) => s.id !== studentId);
        return {
          ...prev,
          isRevokingStudentAll: false,
          students: updatedStudents,
          selectedStudent: null
        };
      });

      showSnackbarNotification(`تم سحب كافة ملفات الطالب (${studentName}) بنجاح (${removedCount} ملف)`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, isRevokingStudentAll: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب ملفات الطالب', 'error');
    }
  };

  const handleRevokeFolder = async (folder: DistributedFolderSummary) => {
    try {
      setConfirmRevokeFolder(null);
      setRecallModal((prev) => ({ ...prev, revokingFolderKey: folder.folderKey }));

      const result = await revokeDistributedFolderFromStudents({
        track: recallModal.track,
        folderPath: folder.folderPath,
        dateString: folder.dateString,
        studentIds: folder.studentIds,
        fileIds: folder.fileIds
      });

      const revokedFileIdSet = new Set(folder.fileIds);

      // Refresh distributed list and update state
      setRecallModal((prev) => ({
        ...prev,
        revokingFolderKey: null,
        folders: prev.folders.filter((f) => f.folderKey !== folder.folderKey),
        files: prev.files.filter((f) => !revokedFileIdSet.has(f.fileId)),
        students: prev.students
          .map((s) => ({
            ...s,
            assignedFiles: s.assignedFiles.filter((f) => !revokedFileIdSet.has(f.id))
          }))
          .filter((s) => s.assignedFiles.length > 0)
      }));

      showSnackbarNotification(
        `تم سحب مجلد "${folder.folderName}" بنجاح من حسابات ${result.updatedStudentsCount} طالب (${result.revokedFilesCount} ملف)`,
        'success'
      );
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, revokingFolderKey: null }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب المجلد من الطلاب', 'error');
    }
  };

  const handleRevokeAllFoldersForDate = async (dateString: string) => {
    try {
      setConfirmRevokeDateOpen(false);
      setRecallModal((prev) => ({ ...prev, isRevokingDateAll: true }));

      const result = await revokeAllFoldersForDate(recallModal.track, dateString);

      // Refresh full lists for track
      const [distributed, distributedFolders, students] = await Promise.all([
        getDistributedFilesForTrack(recallModal.track),
        getDistributedFoldersForTrack(recallModal.track),
        getStudentsWithAssignedFiles(recallModal.track)
      ]);

      setRecallModal((prev) => ({
        ...prev,
        isRevokingDateAll: false,
        files: distributed,
        folders: distributedFolders,
        students
      }));

      showSnackbarNotification(
        `تم سحب كافة مجلدات يوم ${dateString} بنجاح من حسابات ${result.updatedStudentsCount} طالب`,
        'success'
      );
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, isRevokingDateAll: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب مجلدات هذا اليوم', 'error');
    }
  };

  return {
    recallModal,
    setRecallModal,
    confirmRevokeAllOpen,
    setConfirmRevokeAllOpen,
    confirmRevokeSingle,
    setConfirmRevokeSingle,
    confirmRevokeFolder,
    setConfirmRevokeFolder,
    confirmRevokeDateOpen,
    setConfirmRevokeDateOpen,
    confirmRevokeStudentAllOpen,
    setConfirmRevokeStudentAllOpen,
    selectedRecallFileIds,
    setSelectedRecallFileIds,
    confirmRevokeSelectedOpen,
    setConfirmRevokeSelectedOpen,
    isRevokingSelected,
    setIsRevokingSelected,
    handleOpenRecallModal,
    handleRevokeSingleFile,
    handleRevokeFolder,
    handleRevokeAllFoldersForDate,
    handleRevokeAllFiles,
    latestBatchFiles,
    isLatestBatchSelected,
    isAllFilesSelected,
    handleToggleSelectAllFiles,
    handleToggleSelectLatestBatch,
    handleToggleSelectFile,
    handleRevokeSelectedFiles,
    handleRevokeSingleFileFromStudent,
    handleRevokeAllFilesFromStudent,
  };
};
