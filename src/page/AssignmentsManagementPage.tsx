import React, { useState, useEffect } from 'react';
import { TrackKey } from '../services/firebaseService';
import '../styles/AssignmentsManagementPage.css';
import { AssignmentsManagementPageProps } from './assignments/types/assignments.types';
import { AssignmentsSnackbar } from './assignments/components/common/AssignmentsSnackbar';
import { PaperPlaneAnimation } from './assignments/components/common/PaperPlaneAnimation';
import { UploadRecoveryBanner } from './assignments/components/common/UploadRecoveryBanner';
import { AssignmentsHeader } from './assignments/components/layout/AssignmentsHeader';
import { AssignmentsNavigationTabs } from './assignments/components/layout/AssignmentsNavigationTabs';
import { AssignmentsTabsContainer } from './assignments/components/tabs/AssignmentsTabsContainer';
import { AssignmentsModalsContainer } from './assignments/components/modals/AssignmentsModalsContainer';
import { useAssignmentsNotifications } from './assignments/hooks/useAssignmentsNotifications';
import { useAssignmentsConfig } from './assignments/hooks/useAssignmentsConfig';
import { useUnified130Folders } from './assignments/hooks/useUnified130Folders';
import { useTrackFolders } from './assignments/hooks/useTrackFolders';
import { useAssignmentsDistribution } from './assignments/hooks/useAssignmentsDistribution';
import { useAssignmentsDeletion } from './assignments/hooks/useAssignmentsDeletion';
import { useAssignmentsRecall } from './assignments/hooks/useAssignmentsRecall';
import { useTrackFiles } from './assignments/hooks/useTrackFiles';
import { useUnified130Files } from './assignments/hooks/useUnified130Files';
import { useFolderUpload } from './assignments/hooks/useFolderUpload';
import { useFolderUploadPreview } from './assignments/hooks/useFolderUploadPreview';
import { useAssignmentsDataLoader } from './assignments/hooks/useAssignmentsDataLoader';
import { createTrackTabProps, createUnifiedTabProps } from './assignments/hooks/useAssignmentsTabProps';
import { useBackgroundUpload } from './assignments/context/BackgroundUploadContext';
import { mergeFoldersByPath } from './assignments/utils/folderUtils';
import { writeCachedTrackFolders, writeCachedUnified130Folders } from './assignments/storage/assignmentsCache';

const AssignmentsManagementPage: React.FC<AssignmentsManagementPageProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'assignments' | 'tracks' | 'unified130'>('assignments');
  const [trackView, setTrackView] = useState<'overview' | 'details'>('overview');
  const [openedTrack, setOpenedTrack] = useState<TrackKey | null>(null);
  const [trackFiles, setTrackFiles] = useState<Record<TrackKey, any[]>>({ track1: [], track2: [], track3: [] });
  const [selectedFileIds, setSelectedFileIds] = useState<Record<TrackKey, Set<string>>>({ track1: new Set(), track2: new Set(), track3: new Set() });
  const [uploadProgress, setUploadProgress] = useState<Record<TrackKey, { current: number; total: number }>>({
    track1: { current: 0, total: 0 }, track2: { current: 0, total: 0 }, track3: { current: 0, total: 0 }
  });
  const [isUploadingAssignments, setIsUploadingAssignments] = useState<Record<TrackKey, boolean>>({ track1: false, track2: false, track3: false });
  const [unified130Files, setUnified130Files] = useState<any[]>([]);
  const [isUploading130, setIsUploading130] = useState(false);
  const [selected130FileIds, setSelected130FileIds] = useState<Set<string>>(new Set());

  const { assignmentsMessage, setAssignmentsMessage, showSnackbar, snackbarMessage, snackbarType, showSnackbarNotification } =
    useAssignmentsNotifications();
  const configProps = useAssignmentsConfig({ setAssignmentsMessage });
  const deletionProps = useAssignmentsDeletion({
    selectedFileIds, setSelectedFileIds, selected130FileIds, setSelected130FileIds,
    setTrackFiles, setUnified130Files, trackFiles, unified130Files, setAssignmentsMessage, showSnackbarNotification,
  });
  const unifiedFoldersProps = useUnified130Folders({
    unified130Files, setUnified130Files, setSelected130FileIds,
    setFolderDeleteLoading: deletionProps.setFolderDeleteLoading, showSnackbarNotification,
  });
  const trackFoldersProps = useTrackFolders({
    trackFiles, setTrackFiles, setSelectedFileIds,
    setFolderDeleteLoading: deletionProps.setFolderDeleteLoading, showSnackbarNotification,
  });
  const recallProps = useAssignmentsRecall({ showSnackbarNotification });
  const { handleFileUpload, getVisibleTrackFiles } = useTrackFiles({
    trackFiles, setTrackFiles, uploadProgress, setUploadProgress,
    isUploadingAssignments, setIsUploadingAssignments,
    trackCurrentPath: trackFoldersProps.trackCurrentPath, setAssignmentsMessage,
  });
  const { handle130FileUpload, getVisibleUnified130Files } = useUnified130Files({
    unified130Files, setUnified130Files, isUploading130, setIsUploading130,
    unified130CurrentPath: unifiedFoldersProps.unified130CurrentPath, showSnackbarNotification,
  });
  const { uploadConfirmedFolderForTrack, uploadConfirmedFolderFor130 } = useFolderUpload({
    trackCurrentPath: trackFoldersProps.trackCurrentPath, setTrackFolders: trackFoldersProps.setTrackFolders,
    setTrackFiles, setIsUploadingAssignments, setUploadProgress,
    unified130CurrentPath: unifiedFoldersProps.unified130CurrentPath,
    setUnified130Folders: unifiedFoldersProps.setUnified130Folders,
    setUnified130Files, setIsUploading130, showSnackbarNotification,
  });

  const previewProps = useFolderUploadPreview({ showSnackbarNotification });
  const { enqueueUpload, registerListener, isUploading: isBgUploading } = useBackgroundUpload();

  useEffect(() => {
    return registerListener((batch, folder, files, error) => {
      if (error) {
        showSnackbarNotification(error, 'error');
        return;
      }
      if (batch.scope === 'track' && batch.trackId) {
        const tr = batch.trackId;
        if (folder) {
          trackFoldersProps.setTrackFolders((prev) => {
            const next = { ...prev, [tr]: mergeFoldersByPath(prev[tr] || [], [folder]) };
            writeCachedTrackFolders(next);
            return next;
          });
        }
        if (files && files.length > 0) {
          setTrackFiles((prev) => ({ ...prev, [tr]: [...(prev[tr] || []), ...files] }));
          showSnackbarNotification(`تم رفع المجلد "${folder?.name || ''}" (${files.length} ملف) بنجاح`, 'success');
        } else if (folder?.isParentFolder) {
          showSnackbarNotification(`تم إنشاء المجلد الرئيسي "${folder.name}"`, 'success');
        }
      } else if (batch.scope === 'unified130') {
        if (folder) {
          unifiedFoldersProps.setUnified130Folders((prev) => {
            const next = mergeFoldersByPath(prev, [folder]);
            writeCachedUnified130Folders(next);
            return next;
          });
        }
        if (files && files.length > 0) {
          setUnified130Files((prev) => [...prev, ...files]);
          showSnackbarNotification(`تم رفع المجلد "${folder?.name || ''}" (${files.length} ملف) بنجاح`, 'success');
        } else if (folder?.isParentFolder) {
          showSnackbarNotification(`تم إنشاء المجلد الرئيسي "${folder.name}"`, 'success');
        }
      }
    });
  }, [registerListener, trackFoldersProps.setTrackFolders, unifiedFoldersProps.setUnified130Folders, showSnackbarNotification]);

  useAssignmentsDataLoader({
    setTrackFiles, setTrackFolders: trackFoldersProps.setTrackFolders,
    setUnified130Files, setUnified130Folders: unifiedFoldersProps.setUnified130Folders,
  });

  const distProps = useAssignmentsDistribution({
    openedTrack, activeTrackFolder: trackFoldersProps.activeTrackFolder,
    selectedFileIds, setSelectedFileIds, selected130FileIds, setSelected130FileIds,
    getVisibleTrackFiles, getVisibleUnified130Files, setAssignmentsMessage, showSnackbarNotification,
  });

  const handleBack = () => {
    if ((isBgUploading || Object.values(isUploadingAssignments).some(Boolean)) && !window.confirm('هناك ملفات قيد الرفع حالياً. هل تريد المغادرة؟')) {
      return;
    }
    onBack();
  };

  const handleConfirmFolderUpload = () => {
    previewProps.handleConfirm((scope, confirmedGroups, targetTrack, uploadStrategy, parentFolderName) => {
      const parentPath = scope === 'unified130'
        ? (unifiedFoldersProps.unified130CurrentPath || '')
        : (targetTrack ? (trackFoldersProps.trackCurrentPath[targetTrack] || '') : '');
      const totalFiles = confirmedGroups.reduce((acc, g) => acc + g.files.length, 0);

      enqueueUpload({
        id: `batch_${Date.now()}`,
        scope,
        trackId: targetTrack,
        parentPath,
        groups: confirmedGroups,
        totalFiles,
        uploadStrategy,
        parentFolderName,
      });

      showSnackbarNotification(`بدأ رفع (${confirmedGroups.length}) مجلدات في الخلفية بنجاح`, 'success');
    });
  };

  const trackProps = createTrackTabProps({
    trackView, setTrackView, openedTrack, setOpenedTrack, trackFoldersProps, trackFiles,
    selectedFileIds, setSelectedFileIds, uploadProgress, isUploadingAssignments, deletionProps,
    distProps, getVisibleTrackFiles, handleFileUpload,
    handleFolderUploadForTrack: (t: TrackKey, f: File[]) => previewProps.openPreview('track', f, t),
    recallProps,
  });

  const unifiedProps = createUnifiedTabProps({
    unified130Files, unifiedFoldersProps, isUploading130, distProps, selected130FileIds,
    setSelected130FileIds, deletionProps, getVisibleUnified130Files, handle130FileUpload,
    handleFolderUploadFor130: (f: File[]) => previewProps.openPreview('unified130', f),
    recallProps,
  });

  const folderUploadPreviewProps = {
    isOpen: previewProps.isOpen,
    folderName: previewProps.folderName,
    setFolderName: previewProps.setFolderName,
    files: previewProps.files,
    invalidCount: previewProps.invalidCount,
    isUploading: isBgUploading,
    uploadProgress: previewProps.track ? uploadProgress[previewProps.track] : undefined,
    onRemoveFile: previewProps.handleRemoveFile,
    onConfirmUpload: handleConfirmFolderUpload,
    onClose: previewProps.closePreview,
    mode: previewProps.mode,
    groups: previewProps.groups,
    uploadStrategy: previewProps.uploadStrategy,
    setUploadStrategy: previewProps.setUploadStrategy,
    parentFolderName: previewProps.parentFolderName,
    setParentFolderName: previewProps.setParentFolderName,
    onUpdateGroupName: previewProps.updateGroupName,
    onRemoveGroup: previewProps.removeGroup,
    onRemoveFileFromGroup: previewProps.removeFileFromGroup,
  };

  return (
    <div className="assignments-management-page" data-lenis-prevent>
      <AssignmentsHeader handleBack={handleBack} assignmentsMessage={assignmentsMessage} />
      <UploadRecoveryBanner />
      <AssignmentsNavigationTabs activeTab={activeTab} setActiveTab={setActiveTab} setTrackView={setTrackView} setOpenedTrack={setOpenedTrack} />
      <AssignmentsTabsContainer activeTab={activeTab} configProps={configProps} trackProps={trackProps} unifiedProps={unifiedProps} />
      <AssignmentsSnackbar showSnackbar={showSnackbar} snackbarMessage={snackbarMessage} snackbarType={snackbarType} />
      <PaperPlaneAnimation showPaperPlane={distProps.showPaperPlane} />
      <AssignmentsModalsContainer
        openedTrack={openedTrack} activeTrackFolder={trackFoldersProps.activeTrackFolder} activeTab={activeTab}
        trackCurrentPath={trackFoldersProps.trackCurrentPath} unified130CurrentPath={unifiedFoldersProps.unified130CurrentPath}
        selectedFileIds={selectedFileIds} trackFiles={trackFiles} showTierModal={distProps.showTierModal}
        setShowTierModal={distProps.setShowTierModal} assignmentsConfig={configProps.assignmentsConfig}
        handleDistribute={distProps.handleDistribute} selectedFilesCount={distProps.selectedFilesCount}
        isDistributingAssignments={distProps.isDistributingAssignments} distributionReport={distProps.distributionReport}
        setDistributionReport={distProps.setDistributionReport} recallProps={recallProps}
        deleteConfirmModal={deletionProps.deleteConfirmModal} setDeleteConfirmModal={deletionProps.setDeleteConfirmModal}
        executeDelete={deletionProps.executeDelete} isRemovingFromUsers={deletionProps.isRemovingFromUsers}
        folderDeleteLoading={deletionProps.folderDeleteLoading} distProgress={distProps.distProgress}
        updateProgress={distProps.updateProgress} folderUploadPreviewProps={folderUploadPreviewProps}
      />
    </div>
  );
};

export default AssignmentsManagementPage;
