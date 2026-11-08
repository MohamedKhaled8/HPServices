import React, { useState, useEffect, useMemo } from 'react';

import {
  uploadAssignmentFilesForTrack,
  getAssignmentFilesForTrack,
  createAssignmentFolderForTrack,
  getAssignmentFoldersForTrack,
  distributeAssignmentsForTrack,
  deleteAssignmentFilesForTrack,
  getAssignmentsServiceConfig,
  updateAssignmentsServiceConfig,
  getCurrentUser,
  TrackKey,
  ServiceTier,
  DistributeTargetOptions,
  upload130UnifiedFile,
  get130UnifiedFiles,
  create130UnifiedFolder,
  get130UnifiedFolders,
  deleteAssignmentFolderForTrack,
  delete130UnifiedFolder,
  delete130UnifiedFiles,
  distribute130UnifiedFiles,
  removeAssignedFilesFromAllStudents,
  AssignmentFolderMeta,
  getDistributedFilesForTrack,
  revokeDistributedFileFromStudents,
  revokeMultipleDistributedFilesFromStudents,
  revokeAllDistributedFilesForTrack,
  DistributedFileSummary,
  getStudentsWithAssignedFiles,
  revokeSingleFileFromStudent,
  revokeAllFilesFromStudent,
  StudentWithAssignedFiles
} from '../services/firebaseService';
import { AssignmentsServiceConfig, AssignmentItem } from '../types';
import { classifyAssignment, AssignmentCategory } from '../utils/assignmentClassifier';
import {
  ArrowRight,
  Folder,
  Send,
  Loader2,
  Save,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Clock,
  Calendar,
  Users,
  FileText,
  AlertTriangle,
  Search,
  User,
  UserX
} from 'lucide-react';
import '../styles/AssignmentsManagementPage.css';

import { AssignmentsManagementPageProps } from './assignments/types/assignments.types';
import { TRACK_FOLDERS_CACHE_KEY, UNIFIED130_FOLDERS_CACHE_KEY } from './assignments/constants/assignments.constants';
import {
  mergeFoldersByPath,
  getPathParts,
  getParentPath,
  getPathLastName
} from './assignments/utils/folderUtils';
import {
  readCachedTrackFolders,
  writeCachedTrackFolders,
  readCachedUnified130Folders,
  writeCachedUnified130Folders
} from './assignments/storage/assignmentsCache';
import { DistributionProgressToast } from './assignments/components/common/DistributionProgressToast';
import { AssignmentsSnackbar } from './assignments/components/common/AssignmentsSnackbar';
import { PaperPlaneAnimation } from './assignments/components/common/PaperPlaneAnimation';
import { useAssignmentsNotifications } from './assignments/hooks/useAssignmentsNotifications';
import { useAssignmentsConfig } from './assignments/hooks/useAssignmentsConfig';
import { useUnified130Folders } from './assignments/hooks/useUnified130Folders';
import { useTrackFolders } from './assignments/hooks/useTrackFolders';
import { useAssignmentsDistribution } from './assignments/hooks/useAssignmentsDistribution';
import { useAssignmentsDeletion } from './assignments/hooks/useAssignmentsDeletion';
import { useAssignmentsRecall } from './assignments/hooks/useAssignmentsRecall';
import { useTrackFiles } from './assignments/hooks/useTrackFiles';
import { useUnified130Files } from './assignments/hooks/useUnified130Files';
import { FullscreenLoadingOverlays } from './assignments/components/common/FullscreenLoadingOverlays';
import { RevokeAllLoadingOverlay } from './assignments/components/common/RevokeAllLoadingOverlay';
import { AssignmentsHeader } from './assignments/components/layout/AssignmentsHeader';
import { AssignmentsNavigationTabs } from './assignments/components/layout/AssignmentsNavigationTabs';
import { AssignmentsConfigTab } from './assignments/components/tabs/AssignmentsConfigTab';
import { TracksManagementTab } from './assignments/components/tabs/TracksManagementTab';
import { Unified130Tab } from './assignments/components/tabs/Unified130Tab';
import { TierSelectionModal } from './assignments/components/modals/TierSelectionModal';
import { DeleteConfirmationModal } from './assignments/components/modals/DeleteConfirmationModal';
import { ConfirmRevokeSingleModal } from './assignments/components/modals/recall/ConfirmRevokeSingleModal';
import { ConfirmRevokeSelectedModal } from './assignments/components/modals/recall/ConfirmRevokeSelectedModal';
import { ConfirmRevokeAllModal } from './assignments/components/modals/recall/ConfirmRevokeAllModal';
import { ConfirmRevokeStudentAllModal } from './assignments/components/modals/recall/ConfirmRevokeStudentAllModal';
import { RecallModal } from './assignments/components/modals/recall/RecallModal';

const AssignmentsManagementPage: React.FC<AssignmentsManagementPageProps> = ({ onBack }) => {


  // Tabs: إدارة التكليفات / إدارة تكاليف المسارات
  const [activeTab, setActiveTab] = useState<'assignments' | 'tracks' | 'unified130'>('assignments');

  // Tracks view state
  const [trackView, setTrackView] = useState<'overview' | 'details'>('overview');
  const [openedTrack, setOpenedTrack] = useState<TrackKey | null>(null);
  const [trackFiles, setTrackFiles] = useState<Record<TrackKey, any[]>>({
    track1: [],
    track2: [],
    track3: []
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set()
  });

  const [uploadProgress, setUploadProgress] = useState<Record<TrackKey, { current: number; total: number }>>({
    track1: { current: 0, total: 0 },
    track2: { current: 0, total: 0 },
    track3: { current: 0, total: 0 }
  });

  const [isUploadingAssignments, setIsUploadingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false
  });

  const {
    assignmentsMessage,
    setAssignmentsMessage,
    showSnackbar,
    snackbarMessage,
    snackbarType,
    showSnackbarNotification,
  } = useAssignmentsNotifications();

  const {
    assignmentsConfig,
    setAssignmentsConfig,
    newAssignmentName,
    setNewAssignmentName,
    newAssignmentPrice,
    setNewAssignmentPrice,
    editingAssignmentId,
    setEditingAssignmentId,
    editAssignmentName,
    setEditAssignmentName,
    editAssignmentPrice,
    setEditAssignmentPrice,
    isSaving,
    handleSaveAssignmentsConfig,
    handleAddAssignment,
    handleRemoveAssignment,
    handleStartEditAssignment,
    handleCancelEditAssignment,
    handleSaveEditAssignment,
  } = useAssignmentsConfig({ setAssignmentsMessage });




  // 130 unified files state
  const [unified130Files, setUnified130Files] = useState<any[]>([]);


  const [isUploading130, setIsUploading130] = useState(false);
  const [selected130FileIds, setSelected130FileIds] = useState<Set<string>>(new Set());


  const {
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
  } = useAssignmentsDeletion({
    selectedFileIds,
    setSelectedFileIds,
    selected130FileIds,
    setSelected130FileIds,
    setTrackFiles,
    setUnified130Files,
    setAssignmentsMessage,
    showSnackbarNotification,
  });

  const {
    unified130Folders,
    setUnified130Folders,
    unified130CurrentPath,
    setUnified130CurrentPath,
    newUnified130FolderName,
    setNewUnified130FolderName,
    getVisibleUnified130Folders,
    handleCreateUnified130Folder,
    handleDeleteUnified130Folder,
  } = useUnified130Folders({
    unified130Files,
    setUnified130Files,
    setSelected130FileIds,
    setFolderDeleteLoading,
    showSnackbarNotification,
  });

  const {
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
  } = useTrackFolders({
    trackFiles,
    setTrackFiles,
    setSelectedFileIds,
    setFolderDeleteLoading,
    showSnackbarNotification,
  });

  const {
    recallModal,
    setRecallModal,
    confirmRevokeAllOpen,
    setConfirmRevokeAllOpen,
    confirmRevokeSingle,
    setConfirmRevokeSingle,
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
  } = useAssignmentsRecall({ showSnackbarNotification });

  const { handleFileUpload, getVisibleTrackFiles } = useTrackFiles({
    trackFiles,
    setTrackFiles,
    uploadProgress,
    setUploadProgress,
    isUploadingAssignments,
    setIsUploadingAssignments,
    trackCurrentPath,
    setAssignmentsMessage,
  });

  const { handle130FileUpload, getVisibleUnified130Files } = useUnified130Files({
    unified130Files,
    setUnified130Files,
    isUploading130,
    setIsUploading130,
    unified130CurrentPath,
    showSnackbarNotification,
  });

  // Animation states




  // Load files only when a track is opened (Lazy Loading for better performance)
  useEffect(() => {
    const loadAllTracks = async () => {
      try {
        const [files1, files2, files3, folders1, folders2, folders3] = await Promise.all([
          getAssignmentFilesForTrack('track1'),
          getAssignmentFilesForTrack('track2'),
          getAssignmentFilesForTrack('track3'),
          getAssignmentFoldersForTrack('track1'),
          getAssignmentFoldersForTrack('track2'),
          getAssignmentFoldersForTrack('track3')
        ]);

        setTrackFiles({
          track1: files1,
          track2: files2,
          track3: files3
        });
        const cached = readCachedTrackFolders();
        const merged = {
          track1: mergeFoldersByPath(folders1, cached.track1),
          track2: mergeFoldersByPath(folders2, cached.track2),
          track3: mergeFoldersByPath(folders3, cached.track3)
        };
        setTrackFolders(merged);
        writeCachedTrackFolders(merged);
      } catch (error) {
        console.error('Error loading track files:', error);
        const cached = readCachedTrackFolders();
        setTrackFolders(cached);
      }
    };

    loadAllTracks();
  }, []);

  // Load 130 unified files
  useEffect(() => {
    const load130Files = async () => {
      try {
        const [files, folders] = await Promise.all([get130UnifiedFiles(), get130UnifiedFolders()]);
        setUnified130Files(files);
        const cached = readCachedUnified130Folders();
        const merged = mergeFoldersByPath(folders, cached);
        setUnified130Folders(merged);
        writeCachedUnified130Folders(merged);
      } catch (error) {
        console.error('Error loading 130 unified files:', error);
        setUnified130Folders(readCachedUnified130Folders());
      }
    };
    load130Files();
  }, []);

  // ============================================
  // سحب وإلغاء توزيع الملفات من الطلاب (Recall Handlers)
  // ============================================

  const handleBack = () => {
    // التحقق من وجود رفع جاري
    const isUploading = Object.values(isUploadingAssignments).some(uploading => uploading);

    if (isUploading) {
      const confirmLeave = window.confirm(
        'هناك ملفات قيد الرفع حالياً. إذا غادرت الصفحة الآن، سيتم إيقاف عملية الرفع. هل تريد المتابعة؟'
      );
      if (!confirmLeave) {
        return; // لا تغادر
      }
    }

    onBack();
  };


  const {
    showTierModal,
    setShowTierModal,
    isDistributingAssignments,
    setIsDistributingAssignments,
    isDistributing130,
    setIsDistributing130,
    showPaperPlane,
    setShowPaperPlane,
    distProgress,
    setDistProgress,
    updateProgress,
    handleDistribute,
    handle130Distribute,
  } = useAssignmentsDistribution({
    openedTrack,
    activeTrackFolder,
    selectedFileIds,
    setSelectedFileIds,
    selected130FileIds,
    setSelected130FileIds,
    getVisibleTrackFiles,
    getVisibleUnified130Files,
    setAssignmentsMessage,
    showSnackbarNotification,
  });



  return (
    <div className="assignments-management-page">
      <AssignmentsHeader
        handleBack={handleBack}
        assignmentsMessage={assignmentsMessage}
      />

      {/* Secondary tabs inside assignments page (same style as admin tabs) */}
      <AssignmentsNavigationTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setTrackView={setTrackView}
        setOpenedTrack={setOpenedTrack}
      />

      <div className="assignments-content">
        {/* TAB: إدارة التكليفات */}
        {activeTab === 'assignments' && (
          <AssignmentsConfigTab
            assignmentsConfig={assignmentsConfig}
            setAssignmentsConfig={setAssignmentsConfig}
            isSaving={isSaving}
            handleSaveAssignmentsConfig={handleSaveAssignmentsConfig}
            newAssignmentName={newAssignmentName}
            setNewAssignmentName={setNewAssignmentName}
            newAssignmentPrice={newAssignmentPrice}
            setNewAssignmentPrice={setNewAssignmentPrice}
            handleAddAssignment={handleAddAssignment}
            editingAssignmentId={editingAssignmentId}
            editAssignmentName={editAssignmentName}
            setEditAssignmentName={setEditAssignmentName}
            editAssignmentPrice={editAssignmentPrice}
            setEditAssignmentPrice={setEditAssignmentPrice}
            handleSaveEditAssignment={handleSaveEditAssignment}
            handleCancelEditAssignment={handleCancelEditAssignment}
            handleStartEditAssignment={handleStartEditAssignment}
            handleRemoveAssignment={handleRemoveAssignment}
          />
        )}

        {/* TAB: إدارة تكاليف المسارات الدراسية */}
        {activeTab === 'tracks' && (
          <TracksManagementTab
            trackView={trackView}
            setTrackView={setTrackView}
            openedTrack={openedTrack}
            setOpenedTrack={setOpenedTrack}
            setActiveTrackFolder={setActiveTrackFolder}
            trackFiles={trackFiles}
            selectedFileIds={selectedFileIds}
            setSelectedFileIds={setSelectedFileIds}
            uploadProgress={uploadProgress}
            isUploadingAssignments={isUploadingAssignments}
            isDeletingAssignments={isDeletingAssignments}
            animatingDeleteIds={animatingDeleteIds}
            isDistributingAssignments={isDistributingAssignments}
            trackCurrentPath={trackCurrentPath}
            setTrackCurrentPath={setTrackCurrentPath}
            newTrackFolderName={newTrackFolderName}
            setNewTrackFolderName={setNewTrackFolderName}
            setShowTierModal={setShowTierModal}
            folderDeleteLoading={folderDeleteLoading}
            getVisibleTrackFiles={getVisibleTrackFiles}
            getVisibleTrackFolders={getVisibleTrackFolders}
            handleCreateTrackFolder={handleCreateTrackFolder}
            handleDeleteSelected={handleDeleteSelected}
            handleDeleteSingleTrackFile={handleDeleteSingleTrackFile}
            handleDeleteTrackFolder={handleDeleteTrackFolder}
            handleFileUpload={handleFileUpload}
            handleOpenRecallModal={handleOpenRecallModal}
          />
        )}

        {/* TAB: ملفات الـ 130 الموحدة */}
        {activeTab === 'unified130' && (
          <Unified130Tab
            unified130Files={unified130Files}
            unified130CurrentPath={unified130CurrentPath}
            setUnified130CurrentPath={setUnified130CurrentPath}
            newUnified130FolderName={newUnified130FolderName}
            setNewUnified130FolderName={setNewUnified130FolderName}
            isUploading130={isUploading130}
            isDistributing130={isDistributing130}
            selected130FileIds={selected130FileIds}
            setSelected130FileIds={setSelected130FileIds}
            isDeleting130={isDeleting130}
            setDeleteConfirmModal={setDeleteConfirmModal}
            folderDeleteLoading={folderDeleteLoading}
            getVisibleUnified130Files={getVisibleUnified130Files}
            getVisibleUnified130Folders={getVisibleUnified130Folders}
            handle130Delete={handle130Delete}
            handle130Distribute={handle130Distribute}
            handle130FileUpload={handle130FileUpload}
            handleCreateUnified130Folder={handleCreateUnified130Folder}
            handleDeleteUnified130Folder={handleDeleteUnified130Folder}
            handleOpenRecallModal={handleOpenRecallModal}
          />
        )}
      </div>

      {/* Snackbar Notification */}
      <AssignmentsSnackbar
        showSnackbar={showSnackbar}
        snackbarMessage={snackbarMessage}
        snackbarType={snackbarType}
      />

      {/* Paper Plane Animation */}
      <PaperPlaneAnimation showPaperPlane={showPaperPlane} />

      {/* Tier Selection Modal */}
      <TierSelectionModal
        showTierModal={showTierModal}
        setShowTierModal={setShowTierModal}
        assignmentsConfig={assignmentsConfig}
        handleDistribute={handleDistribute}
      />

      {/* نافذة سحب الملفات الموزعة على الطلاب */}
      {/* نافذة سحب الملفات الموزعة على الطلاب */}
      <RecallModal
        recallModal={recallModal}
        setRecallModal={setRecallModal}
        selectedRecallFileIds={selectedRecallFileIds}
        isAllFilesSelected={isAllFilesSelected}
        isLatestBatchSelected={isLatestBatchSelected}
        latestBatchFiles={latestBatchFiles}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        handleToggleSelectAllFiles={handleToggleSelectAllFiles}
        handleToggleSelectLatestBatch={handleToggleSelectLatestBatch}
        handleToggleSelectFile={handleToggleSelectFile}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        handleRevokeSingleFileFromStudent={handleRevokeSingleFileFromStudent}
      />

      {/* تأكيد سحب ملف واحد */}
      <ConfirmRevokeSingleModal
        confirmRevokeSingle={confirmRevokeSingle}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        handleRevokeSingleFile={handleRevokeSingleFile}
      />

      {/* تأكيد سحب الملفات المحددة */}
      <ConfirmRevokeSelectedModal
        confirmRevokeSelectedOpen={confirmRevokeSelectedOpen}
        selectedRecallFileIds={selectedRecallFileIds}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        handleRevokeSelectedFiles={handleRevokeSelectedFiles}
      />

      {/* تأكيد سحب كافة الملفات للمسار */}
      <ConfirmRevokeAllModal
        confirmRevokeAllOpen={confirmRevokeAllOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        recallModal={recallModal}
        handleRevokeAllFiles={handleRevokeAllFiles}
      />

      {/* تأكيد سحب كافة ملفات طالب واحد */}
      <ConfirmRevokeStudentAllModal
        confirmRevokeStudentAllOpen={confirmRevokeStudentAllOpen}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        recallModal={recallModal}
        handleRevokeAllFilesFromStudent={handleRevokeAllFilesFromStudent}
      />


      {/* شاشة تحميل أثناء السحب الشامل */}
      <RevokeAllLoadingOverlay isRevokingAll={recallModal.isRevokingAll} />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        executeDelete={executeDelete}
        isRemovingFromUsers={isRemovingFromUsers}
      />

      {/* Removing from users and folder delete overlays */}
      <FullscreenLoadingOverlays
        isRemovingFromUsers={isRemovingFromUsers}
        folderDeleteLoading={folderDeleteLoading}
      />

      {/* Floating live progress bar for assignments distribution */}
      <DistributionProgressToast distProgress={distProgress} updateProgress={updateProgress} />
    </div>
  );
};

export default AssignmentsManagementPage;
