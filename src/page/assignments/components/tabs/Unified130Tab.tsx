import React, { useMemo } from 'react';
import { TrackKey, AssignmentFolderMeta } from '../../../../services/firebaseService';
import { DeleteConfirmModalState } from '../../types/assignments.types';
import { Unified130Breadcrumbs } from './unified130/Unified130Breadcrumbs';
import { Unified130Actions } from './unified130/Unified130Actions';
import { Unified130FilesTable } from './unified130/Unified130FilesTable';

export interface Unified130TabProps {
  unified130Files: any[];
  unified130Folders?: AssignmentFolderMeta[];
  unified130CurrentPath: string;
  setUnified130CurrentPath: React.Dispatch<React.SetStateAction<string>>;
  newUnified130FolderName: string;
  setNewUnified130FolderName: React.Dispatch<React.SetStateAction<string>>;
  isUploading130: boolean;
  isDistributing130: boolean;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  selected130FolderPaths?: Set<string>;
  setSelected130FolderPaths?: React.Dispatch<React.SetStateAction<Set<string>>>;
  deletingFolderPaths?: Set<string>;
  isDeleting130: boolean;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  getVisibleUnified130Files: () => any[];
  getVisibleUnified130Folders: () => AssignmentFolderMeta[];
  handle130Delete: () => void;
  handle130Distribute: () => Promise<void>;
  handle130FileUpload: (file: File) => Promise<void>;
  handleFolderUpload?: (files: File[]) => Promise<void>;
  handleCreateUnified130Folder: () => Promise<void>;
  handleDeleteUnified130Folder: (folderPath: string) => Promise<void>;
  handleRevoke130FolderFromStudents?: (folderPath: string) => void;
  handleOpenRecallModal: (track: TrackKey | 'unified130') => Promise<void>;
}

export const Unified130Tab: React.FC<Unified130TabProps> = ({
  unified130Files,
  unified130Folders,
  unified130CurrentPath,
  setUnified130CurrentPath,
  newUnified130FolderName,
  setNewUnified130FolderName,
  isUploading130,
  isDistributing130,
  selected130FileIds,
  setSelected130FileIds,
  selected130FolderPaths,
  setSelected130FolderPaths,
  deletingFolderPaths,
  isDeleting130,
  setDeleteConfirmModal,
  folderDeleteLoading,
  getVisibleUnified130Files,
  getVisibleUnified130Folders,
  handle130Delete,
  handle130Distribute,
  handle130FileUpload,
  handleFolderUpload,
  handleCreateUnified130Folder,
  handleDeleteUnified130Folder,
  handleRevoke130FolderFromStudents,
  handleOpenRecallModal,
}) => {
  const visibleFiles = useMemo(() => getVisibleUnified130Files(), [getVisibleUnified130Files]);
  const visibleFolders = useMemo(() => getVisibleUnified130Folders(), [getVisibleUnified130Folders]);

  const { allFilesInVisibleFolders, isAllChecked } = useMemo(() => {
    const allFilesInFolders: any[] = [];
    for (const folder of visibleFolders) {
      const fPath = folder.path;
      const fPathPrefix = `${fPath}/`;
      const matching = (unified130Files || []).filter((f: any) => {
        const fp = String(f.folderPath || '');
        return fp === fPath || fp.startsWith(fPathPrefix);
      });
      allFilesInFolders.push(...matching);
    }

    const allSelectable = [...visibleFiles, ...allFilesInFolders];
    const hasAny = allSelectable.length > 0 || visibleFolders.length > 0;
    const allFilesChecked = allSelectable.length === 0 || allSelectable.every((f) => selected130FileIds.has(f.id));
    const allFoldersChecked = visibleFolders.length === 0 || (selected130FolderPaths ? visibleFolders.every((f) => selected130FolderPaths.has(f.path)) : false);
    const isChecked = hasAny && allFilesChecked && (visibleFolders.length === 0 || allFoldersChecked);

    return { allFilesInVisibleFolders: allFilesInFolders, isAllChecked: isChecked };
  }, [visibleFolders, visibleFiles, unified130Files, selected130FileIds, selected130FolderPaths]);

  return (
    <div className="track-files-panel">
      <div className="track-files-header">
        <Unified130Breadcrumbs
          currentPath={unified130CurrentPath}
          onNavigatePath={setUnified130CurrentPath}
        />

        <Unified130Actions
          newUnified130FolderName={newUnified130FolderName}
          setNewUnified130FolderName={setNewUnified130FolderName}
          isUploading130={isUploading130}
          isDistributing130={isDistributing130}
          isDeleting130={isDeleting130}
          hasSelectionOrVisible={visibleFiles.length > 0 || allFilesInVisibleFolders.length > 0}
          hasSelectedFiles={selected130FileIds.size > 0 || (selected130FolderPaths?.size || 0) > 0}
          onFileUpload={handle130FileUpload}
          onFolderUpload={handleFolderUpload}
          onCreateFolder={handleCreateUnified130Folder}
          onDistribute={handle130Distribute}
          onDeleteSelected={handle130Delete}
          onOpenRecallModal={() => handleOpenRecallModal('unified130')}
        />
      </div>

      <div className="track-files-body">
        <div className="files-table-wrapper">
          <Unified130FilesTable
            visibleFolders={visibleFolders}
            visibleFiles={visibleFiles}
            allFilesInVisibleFolders={allFilesInVisibleFolders}
            isAllChecked={isAllChecked}
            selected130FileIds={selected130FileIds}
            setSelected130FileIds={setSelected130FileIds}
            selected130FolderPaths={selected130FolderPaths}
            setSelected130FolderPaths={setSelected130FolderPaths}
            deletingFolderPaths={deletingFolderPaths}
            isDeleting130={isDeleting130}
            folderDeleteLoading={folderDeleteLoading}
            onNavigateToFolder={setUnified130CurrentPath}
            onOpenFolder={setUnified130CurrentPath}
            onDeleteFolder={handleDeleteUnified130Folder}
            onRevokeFolder={handleRevoke130FolderFromStudents}
            setDeleteConfirmModal={setDeleteConfirmModal}
            allFolders={unified130Folders}
            allUnifiedFiles={unified130Files}
          />
        </div>
      </div>
    </div>
  );
};
