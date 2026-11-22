import React from 'react';
import { TrackKey } from '../../../../services/firebaseService';
import { DeleteConfirmModalState } from '../../types/assignments.types';
import { DistributionReport } from '../../../../types';
import { TierSelectionModal } from './TierSelectionModal';
import { DistributionReportModal } from './DistributionReportModal';
import { RecallModalsGroup } from './RecallModalsGroup';
import { DeleteConfirmationModal } from './DeleteConfirmationModal';
import { FolderUploadPreviewModal, FolderUploadPreviewModalProps } from './FolderUploadPreviewModal';
import { FullscreenLoadingOverlays } from '../common/FullscreenLoadingOverlays';
import { DistributionProgressToast, DistributionProgressInfo } from '../common/DistributionProgressToast';

interface AssignmentsModalsContainerProps {
  openedTrack: TrackKey | null;
  activeTrackFolder: TrackKey;
  activeTab: 'tracks' | 'unified130' | 'assignments';
  trackCurrentPath: Record<TrackKey, string>;
  unified130CurrentPath: string;
  selectedFileIds: Record<TrackKey, Set<string>>;
  trackFiles: Record<TrackKey, any[]>;
  showTierModal: boolean;
  setShowTierModal: React.Dispatch<React.SetStateAction<boolean>>;
  assignmentsConfig: any;
  handleDistribute: (tierOrTarget: any) => Promise<void>;
  selectedFilesCount: number;
  isDistributingAssignments: boolean;
  distributionReport: DistributionReport | null;
  setDistributionReport: React.Dispatch<React.SetStateAction<DistributionReport | null>>;
  recallProps: any;
  deleteConfirmModal: DeleteConfirmModalState;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  executeDelete: (mode?: any) => Promise<void>;
  isRemovingFromUsers: boolean;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  distProgress: DistributionProgressInfo | null;
  updateProgress: (info: DistributionProgressInfo | null, force?: boolean) => void;
  folderUploadPreviewProps?: FolderUploadPreviewModalProps;
}

export const AssignmentsModalsContainer: React.FC<AssignmentsModalsContainerProps> = ({
  openedTrack,
  activeTrackFolder,
  activeTab,
  trackCurrentPath,
  unified130CurrentPath,
  selectedFileIds,
  trackFiles,
  showTierModal,
  setShowTierModal,
  assignmentsConfig,
  handleDistribute,
  selectedFilesCount,
  isDistributingAssignments,
  distributionReport,
  setDistributionReport,
  recallProps,
  deleteConfirmModal,
  setDeleteConfirmModal,
  executeDelete,
  isRemovingFromUsers,
  folderDeleteLoading,
  distProgress,
  updateProgress,
  folderUploadPreviewProps,
}) => {
  const currentTargetTrack = openedTrack || activeTrackFolder;
  const currentTrackPathStr = trackCurrentPath[currentTargetTrack] || '';
  const selectedTrackIds = selectedFileIds[currentTargetTrack];

  let detectedFolderName = '';
  if (activeTab === 'unified130') {
    if (unified130CurrentPath) {
      const parts = unified130CurrentPath.split('/');
      detectedFolderName = parts[parts.length - 1];
    }
  } else if (currentTrackPathStr) {
    const parts = currentTrackPathStr.split('/');
    detectedFolderName = parts[parts.length - 1];
  } else if (selectedTrackIds && selectedTrackIds.size > 0) {
    const selectedFiles = (trackFiles[currentTargetTrack] || []).filter((f) => selectedTrackIds.has(f.id));
    const folderPaths = Array.from(new Set(selectedFiles.map((f) => f.folderPath).filter(Boolean)));
    if (folderPaths.length === 1 && typeof folderPaths[0] === 'string') {
      const parts = folderPaths[0].split('/');
      detectedFolderName = parts[parts.length - 1];
    } else if (folderPaths.length > 1) {
      detectedFolderName = `${folderPaths.length} مجلدات مختارة`;
    }
  }

  const trackName =
    currentTargetTrack === 'track1'
      ? 'المسار الأول'
      : currentTargetTrack === 'track2'
      ? 'المسار الثاني'
      : 'المسار الثالث';

  return (
    <>
      <TierSelectionModal
        showTierModal={showTierModal}
        setShowTierModal={setShowTierModal}
        assignmentsConfig={assignmentsConfig}
        handleDistribute={handleDistribute}
        selectedFilesCount={selectedFilesCount}
        isDistributing={isDistributingAssignments}
        currentFolderName={detectedFolderName}
      />
      <DistributionReportModal
        isOpen={!!distributionReport}
        onClose={() => setDistributionReport(null)}
        report={distributionReport}
        trackName={trackName}
      />
      <RecallModalsGroup recallProps={recallProps} />
      <DeleteConfirmationModal
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        executeDelete={executeDelete}
        isRemovingFromUsers={isRemovingFromUsers}
      />
      <FullscreenLoadingOverlays
        isRemovingFromUsers={isRemovingFromUsers}
        folderDeleteLoading={folderDeleteLoading}
      />
      <DistributionProgressToast distProgress={distProgress} updateProgress={updateProgress} />
      {folderUploadPreviewProps && <FolderUploadPreviewModal {...folderUploadPreviewProps} />}
    </>
  );
};
