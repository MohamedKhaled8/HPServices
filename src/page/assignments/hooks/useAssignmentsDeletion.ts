import { useState } from 'react';
import { TrackKey } from '../../../services/firebaseService';
import { DeleteConfirmModalState } from '../types/assignments.types';
import { executeFileDeletion } from '../utils/assignmentDeletionExecutor';

interface UseAssignmentsDeletionOptions {
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  trackFiles?: Record<TrackKey, any[]>;
  unified130Files?: any[];
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
  trackFiles = { track1: [], track2: [], track3: [] },
  unified130Files = [],
  setTrackFiles,
  setUnified130Files,
  setAssignmentsMessage,
  showSnackbarNotification,
}: UseAssignmentsDeletionOptions) => {
  const [isDeletingAssignments, setIsDeletingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false,
  });
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set(),
  });
  const [isDeleting130, setIsDeleting130] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DeleteConfirmModalState>({
    open: false,
    fileIds: [],
    source: 'track',
  });
  const [isRemovingFromUsers, setIsRemovingFromUsers] = useState(false);

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

  const handleDeleteSingleTrackFile = (track: TrackKey, fileId: string) => {
    setDeleteConfirmModal({ open: true, fileIds: [fileId], source: 'single-track', track, singleFileId: fileId });
  };

  const handleRevokeFolderFromStudents = (track: TrackKey, folderPath: string) => {
    const filesInFolder = (trackFiles[track] || []).filter((f: any) => {
      const fp = String(f.folderPath || '');
      return fp === folderPath || fp.startsWith(`${folderPath}/`);
    });
    if (filesInFolder.length === 0) {
      showSnackbarNotification('هذا المجلد لا يحتوي على ملفات لسحبها', 'error');
      return;
    }
    setDeleteConfirmModal({
      open: true,
      fileIds: filesInFolder.map((f: any) => f.id),
      source: 'track',
      track,
    });
  };

  const handleRevoke130FolderFromStudents = (folderPath: string) => {
    const filesInFolder = (unified130Files || []).filter((f: any) => {
      const fp = String(f.folderPath || '');
      return fp === folderPath || fp.startsWith(`${folderPath}/`);
    });
    if (filesInFolder.length === 0) {
      showSnackbarNotification('هذا المجلد لا يحتوي على ملفات لسحبها', 'error');
      return;
    }
    setDeleteConfirmModal({
      open: true,
      fileIds: filesInFolder.map((f: any) => f.id),
      source: 'unified130',
    });
  };

  const executeDelete = async (mode: 'both' | 'server-only' | 'students-only' | boolean) => {
    const { fileIds, source, track } = deleteConfirmModal;
    setDeleteConfirmModal((prev) => ({ ...prev, open: false }));

    await executeFileDeletion({
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
    });
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
    handleRevokeFolderFromStudents,
    handleRevoke130FolderFromStudents,
    executeDelete,
  };
};
