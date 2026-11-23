import { useState } from 'react';
import { TrackKey, AssignmentFolderMeta } from '../../../services/firebaseService';
import { DeleteConfirmModalState } from '../types/assignments.types';
import { executeFileDeletion } from '../utils/assignmentDeletionExecutor';

interface UseAssignmentsDeletionOptions {
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selectedFolderPaths?: Record<TrackKey, Set<string>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selected130FolderPaths?: Set<string>;
  setSelected130FolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
  trackFiles?: Record<TrackKey, any[]>;
  unified130Files?: any[];
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  setTrackFolders?: React.Dispatch<React.SetStateAction<Record<TrackKey, AssignmentFolderMeta[]>>>;
  setUnified130Folders?: React.Dispatch<React.SetStateAction<AssignmentFolderMeta[]>>;
  trackFolders?: Record<TrackKey, AssignmentFolderMeta[]>;
  unified130Folders?: AssignmentFolderMeta[];
  folderDeleteLoading?: { scope: 'track' | 'unified130'; track?: TrackKey; folderPath: string } | null;
  setFolderDeleteLoading?: React.Dispatch<React.SetStateAction<{ scope: 'track' | 'unified130'; track?: TrackKey; folderPath: string } | null>>;
  deletingFolderPaths?: Set<string>;
  setDeletingFolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
  setAssignmentsMessage: (msg: string | null) => void;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useAssignmentsDeletion = ({
  selectedFileIds,
  setSelectedFileIds,
  selected130FileIds,
  setSelected130FileIds,
  selectedFolderPaths,
  setSelectedFolderPaths,
  selected130FolderPaths,
  setSelected130FolderPaths,
  trackFiles = { track1: [], track2: [], track3: [] },
  unified130Files = [],
  setTrackFiles,
  setUnified130Files,
  setTrackFolders,
  setUnified130Folders,
  trackFolders,
  unified130Folders,
  folderDeleteLoading: externalFolderDeleteLoading,
  setFolderDeleteLoading: externalSetFolderDeleteLoading,
  deletingFolderPaths: externalDeletingFolderPaths,
  setDeletingFolderPaths: externalSetDeletingFolderPaths,
  setAssignmentsMessage,
  showSnackbarNotification,
}: UseAssignmentsDeletionOptions) => {
  const [isDeletingAssignments, setIsDeletingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false, track2: false, track3: false,
  });
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(), track2: new Set(), track3: new Set(),
  });
  const [isDeleting130, setIsDeleting130] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<DeleteConfirmModalState>({
    open: false, fileIds: [], folderPaths: [], source: 'track',
  });
  const [isRemovingFromUsers, setIsRemovingFromUsers] = useState(false);

  const [internalDeletingFolderPaths, setInternalDeletingFolderPaths] = useState<Set<string>>(new Set());
  const [internalFolderDeleteLoading, setInternalFolderDeleteLoading] = useState<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>(null);

  const deletingFolderPaths = externalDeletingFolderPaths ?? internalDeletingFolderPaths;
  const setDeletingFolderPaths = externalSetDeletingFolderPaths ?? setInternalDeletingFolderPaths;
  const folderDeleteLoading = externalFolderDeleteLoading ?? internalFolderDeleteLoading;
  const setFolderDeleteLoading = externalSetFolderDeleteLoading ?? setInternalFolderDeleteLoading;

  const handle130Delete = () => {
    const ids = Array.from(selected130FileIds);
    const fPaths = Array.from(selected130FolderPaths || []);
    if (ids.length === 0 && fPaths.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, folderPaths: fPaths, source: 'unified130' });
  };

  const handleDeleteSelected = (track: TrackKey) => {
    const ids = Array.from(selectedFileIds[track] || []);
    const fPaths = Array.from(selectedFolderPaths?.[track] || []);
    if (ids.length === 0 && fPaths.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, folderPaths: fPaths, source: 'track', track });
  };

  const handleDeleteSingleTrackFile = (track: TrackKey, fileId: string) => {
    setDeleteConfirmModal({ open: true, fileIds: [fileId], source: 'single-track', track, singleFileId: fileId });
  };

  const handleRevokeFolderFromStudents = (track: TrackKey, folderPath: string) => {
    const filesInFolder = (trackFiles[track] || []).filter((f: { id: string; folderPath?: string }) => {
      const fp = String(f.folderPath || '');
      return fp === folderPath || fp.startsWith(`${folderPath}/`);
    });
    if (filesInFolder.length === 0) {
      showSnackbarNotification('هذا المجلد لا يحتوي على ملفات لسحبها', 'error');
      return;
    }
    setDeleteConfirmModal({
      open: true,
      fileIds: filesInFolder.map((f: { id: string }) => f.id),
      source: 'track',
      track,
    });
  };

  const handleRevoke130FolderFromStudents = (folderPath: string) => {
    const filesInFolder = (unified130Files || []).filter((f: { id: string; folderPath?: string }) => {
      const fp = String(f.folderPath || '');
      return fp === folderPath || fp.startsWith(`${folderPath}/`);
    });
    if (filesInFolder.length === 0) {
      showSnackbarNotification('هذا المجلد لا يحتوي على ملفات لسحبها', 'error');
      return;
    }
    setDeleteConfirmModal({
      open: true,
      fileIds: filesInFolder.map((f: { id: string }) => f.id),
      source: 'unified130',
    });
  };

  const executeDelete = async (mode: 'both' | 'server-only' | 'students-only' | boolean) => {
    const { fileIds, folderPaths = [], source, track } = deleteConfirmModal;
    setDeleteConfirmModal((prev) => ({ ...prev, open: false }));

    if (folderPaths.length > 0) {
      setDeletingFolderPaths(new Set(folderPaths));
    }

    try {
      await executeFileDeletion({
        fileIds,
        folderPaths,
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
        setTrackFolders,
        setUnified130Folders,
        setSelectedFolderPaths,
        setSelected130FolderPaths,
        trackFiles,
        unified130Files,
        trackFolders,
        unified130Folders,
        setDeletingFolderPaths,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع أثناء الحذف';
      showSnackbarNotification(msg, 'error');
    } finally {
      if (source === 'unified130') {
        setIsDeleting130(false);
      } else if (track) {
        setIsDeletingAssignments((prev) => ({ ...prev, [track]: false }));
        setAnimatingDeleteIds((prev) => ({ ...prev, [track]: new Set() }));
      }
      setDeletingFolderPaths(new Set());
    }
  };

  return {
    isDeletingAssignments, setIsDeletingAssignments,
    animatingDeleteIds, setAnimatingDeleteIds,
    isDeleting130, setIsDeleting130,
    deleteConfirmModal, setDeleteConfirmModal,
    isRemovingFromUsers, setIsRemovingFromUsers,
    folderDeleteLoading, setFolderDeleteLoading,
    deletingFolderPaths, setDeletingFolderPaths,
    handle130Delete, handleDeleteSelected, handleDeleteSingleTrackFile,
    handleRevokeFolderFromStudents, handleRevoke130FolderFromStudents, executeDelete,
  };
};
