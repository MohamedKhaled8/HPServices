import React, { useMemo } from 'react';
import { TrackKey, AssignmentFolderMeta } from '../../../../services/firebaseService';
import { TracksOverview } from './tracks/TracksOverview';
import { TrackBreadcrumbs } from './tracks/TrackBreadcrumbs';
import { TrackFilesActions } from './tracks/TrackFilesActions';
import { TrackFilesTable } from './tracks/TrackFilesTable';

export interface TracksManagementTabProps {
  trackView: 'overview' | 'details';
  setTrackView: React.Dispatch<React.SetStateAction<'overview' | 'details'>>;
  openedTrack: TrackKey | null;
  setOpenedTrack: React.Dispatch<React.SetStateAction<TrackKey | null>>;
  setActiveTrackFolder: React.Dispatch<React.SetStateAction<TrackKey>>;
  trackFiles: Record<TrackKey, any[]>;
  trackFolders?: Record<TrackKey, AssignmentFolderMeta[]>;
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selectedFolderPaths?: Record<TrackKey, Set<string>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  uploadProgress: Record<TrackKey, { current: number; total: number }>;
  isUploadingAssignments: Record<TrackKey, boolean>;
  isDeletingAssignments: Record<TrackKey, boolean>;
  animatingDeleteIds: Record<TrackKey, Set<string>>;
  isDistributingAssignments: boolean;
  trackCurrentPath: Record<TrackKey, string>;
  setTrackCurrentPath: React.Dispatch<React.SetStateAction<Record<TrackKey, string>>>;
  newTrackFolderName: string;
  setNewTrackFolderName: React.Dispatch<React.SetStateAction<string>>;
  setShowTierModal: React.Dispatch<React.SetStateAction<boolean>>;
  deletingFolderPaths?: Set<string>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  getVisibleTrackFiles: (track: TrackKey) => any[];
  getVisibleTrackFolders: (track: TrackKey) => AssignmentFolderMeta[];
  handleCreateTrackFolder: (track: TrackKey) => Promise<void>;
  handleDeleteSelected: (track: TrackKey) => void;
  handleDeleteSingleTrackFile: (track: TrackKey, fileId: string) => void;
  handleDeleteTrackFolder: (track: TrackKey, folderPath: string) => Promise<void>;
  handleRevokeFolderFromStudents?: (track: TrackKey, folderPath: string) => void;
  handleFileUpload: (track: TrackKey, files: File[]) => Promise<void>;
  handleFolderUpload?: (track: TrackKey, files: File[]) => Promise<void>;
  handleOpenRecallModal: (track: TrackKey | 'unified130') => Promise<void>;
}

export const TracksManagementTab: React.FC<TracksManagementTabProps> = ({
  trackView,
  setTrackView,
  openedTrack,
  setOpenedTrack,
  setActiveTrackFolder,
  trackFiles,
  trackFolders,
  selectedFileIds,
  setSelectedFileIds,
  selectedFolderPaths,
  setSelectedFolderPaths,
  uploadProgress,
  isUploadingAssignments,
  isDeletingAssignments,
  animatingDeleteIds,
  isDistributingAssignments,
  trackCurrentPath,
  setTrackCurrentPath,
  newTrackFolderName,
  setNewTrackFolderName,
  setShowTierModal,
  deletingFolderPaths,
  folderDeleteLoading,
  getVisibleTrackFiles,
  getVisibleTrackFolders,
  handleCreateTrackFolder,
  handleDeleteSelected,
  handleDeleteSingleTrackFile,
  handleDeleteTrackFolder,
  handleRevokeFolderFromStudents,
  handleFileUpload,
  handleFolderUpload,
  handleOpenRecallModal,
}) => {
  const visibleFiles = useMemo(
    () => (openedTrack ? getVisibleTrackFiles(openedTrack) : []),
    [openedTrack, getVisibleTrackFiles]
  );

  const visibleFolders = useMemo(
    () => (openedTrack ? getVisibleTrackFolders(openedTrack) : []),
    [openedTrack, getVisibleTrackFolders]
  );

  const currentPath = openedTrack ? trackCurrentPath[openedTrack] || '' : '';

  const { folderFilesMap, allSelectableFileIds, isAllChecked } = useMemo(() => {
    if (!openedTrack) {
      return {
        folderFilesMap: new Map<string, any[]>(),
        allSelectableFileIds: [],
        isAllChecked: false,
      };
    }

    const currentTrackFiles = trackFiles[openedTrack] || [];
    const map = new Map<string, any[]>();
    const allFilesInFolders: any[] = [];

    for (const folder of visibleFolders) {
      const fPath = folder.path;
      const fPathPrefix = `${fPath}/`;
      const matching = currentTrackFiles.filter((f: any) => {
        const fp = String(f.folderPath || '');
        return fp === fPath || fp.startsWith(fPathPrefix);
      });
      map.set(folder.path, matching);
      allFilesInFolders.push(...matching);
    }

    const allSelectable = [...visibleFiles, ...allFilesInFolders];
    const selectableIds = Array.from(new Set(allSelectable.map((f: any) => f.id)));
    const hasAny = selectableIds.length > 0 || visibleFolders.length > 0;
    const allFilesChecked = selectableIds.length === 0 || selectableIds.every((id) => selectedFileIds[openedTrack]?.has(id));
    const allFoldersChecked = visibleFolders.length === 0 || (selectedFolderPaths ? visibleFolders.every((f) => selectedFolderPaths[openedTrack]?.has(f.path)) : false);
    const allChecked = hasAny && allFilesChecked && (visibleFolders.length === 0 || allFoldersChecked);

    return {
      folderFilesMap: map,
      allSelectableFileIds: selectableIds,
      isAllChecked: allChecked,
    };
  }, [openedTrack, trackFiles, visibleFolders, visibleFiles, selectedFileIds, selectedFolderPaths]);

  return (
    <div className="track-folders-section">
      {trackView === 'overview' && (
        <TracksOverview
          trackFiles={trackFiles}
          onSelectTrack={(key) => {
            setActiveTrackFolder(key);
            setOpenedTrack(key);
            setTrackView('details');
          }}
          onFileUpload={handleFileUpload}
        />
      )}

      {trackView === 'details' && openedTrack && (
        <div className="track-files-panel">
          <div className="track-files-header">
            <TrackBreadcrumbs
              openedTrack={openedTrack}
              currentPath={currentPath}
              onBackToOverview={() => {
                setTrackView('overview');
                setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: '' }));
                setOpenedTrack(null);
              }}
              onNavigatePath={(path) => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: path }))}
            />

            <TrackFilesActions
              openedTrack={openedTrack}
              newTrackFolderName={newTrackFolderName}
              setNewTrackFolderName={setNewTrackFolderName}
              isUploadingAssignments={isUploadingAssignments}
              uploadProgress={uploadProgress}
              isDistributingAssignments={isDistributingAssignments}
              isDeletingAssignments={isDeletingAssignments}
              hasSelectionOrVisible={allSelectableFileIds.length > 0}
              hasSelectedFiles={!!selectedFileIds[openedTrack]?.size || !!(selectedFolderPaths && selectedFolderPaths[openedTrack]?.size)}
              onFileUpload={handleFileUpload}
              onFolderUpload={handleFolderUpload}
              onCreateFolder={handleCreateTrackFolder}
              onOpenSendModal={() => setShowTierModal(true)}
              onDeleteSelected={handleDeleteSelected}
              onOpenRecallModal={handleOpenRecallModal}
            />
          </div>

          <div className="track-files-body">
            <div className="files-table-wrapper">
              <TrackFilesTable
                openedTrack={openedTrack}
                visibleFolders={visibleFolders}
                visibleFiles={visibleFiles}
                folderFilesMap={folderFilesMap}
                allSelectableFileIds={allSelectableFileIds}
                isAllChecked={isAllChecked}
                selectedFileIds={selectedFileIds}
                setSelectedFileIds={setSelectedFileIds}
                selectedFolderPaths={selectedFolderPaths}
                setSelectedFolderPaths={setSelectedFolderPaths}
                deletingFolderPaths={deletingFolderPaths}
                folderDeleteLoading={folderDeleteLoading}
                isDeletingAssignments={isDeletingAssignments}
                animatingDeleteIds={animatingDeleteIds}
                onNavigateToFolder={(folderPath) =>
                  setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: folderPath }))
                }
                onOpenFolder={(folderPath) =>
                  setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: folderPath }))
                }
                onDeleteFolder={handleDeleteTrackFolder}
                onRevokeFolder={handleRevokeFolderFromStudents}
                onDeleteFile={handleDeleteSingleTrackFile}
                allFolders={trackFolders && openedTrack ? trackFolders[openedTrack] : undefined}
                allTrackFiles={trackFiles && openedTrack ? trackFiles[openedTrack] : undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
