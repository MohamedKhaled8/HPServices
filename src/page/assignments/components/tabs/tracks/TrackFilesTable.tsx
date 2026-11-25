import React from 'react';
import { TrackKey, AssignmentFolderMeta } from '../../../../../services/firebaseService';
import { TrackFolderRow } from './TrackFolderRow';
import { TrackFileRow } from './TrackFileRow';
import { computeAggregateFolderCounts } from '../../../utils/folderTreeUtils';

interface TrackFilesTableProps {
  openedTrack: TrackKey;
  visibleFolders: AssignmentFolderMeta[];
  visibleFiles: any[];
  folderFilesMap: Map<string, any[]>;
  allSelectableFileIds: string[];
  isAllChecked: boolean;
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selectedFolderPaths?: Record<TrackKey, Set<string>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  deletingFolderPaths?: Set<string>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  isDeletingAssignments: Record<TrackKey, boolean>;
  animatingDeleteIds: Record<TrackKey, Set<string>>;
  onNavigateToFolder: (folderPath: string) => void;
  onOpenFolder?: (folderPath: string) => void;
  onDeleteFolder: (track: TrackKey, folderPath: string) => void;
  onRevokeFolder?: (track: TrackKey, folderPath: string) => void;
  onRenameFolder?: (track: TrackKey, folder: AssignmentFolderMeta, newName: string) => Promise<boolean>;
  renamingFolderPaths?: Set<string>;
  onDeleteFile: (track: TrackKey, fileId: string) => void;
  allFolders?: AssignmentFolderMeta[];
  allTrackFiles?: any[];
}

export const TrackFilesTable: React.FC<TrackFilesTableProps> = ({
  openedTrack,
  visibleFolders,
  visibleFiles,
  folderFilesMap,
  allSelectableFileIds,
  isAllChecked,
  selectedFileIds,
  setSelectedFileIds,
  selectedFolderPaths,
  setSelectedFolderPaths,
  deletingFolderPaths,
  folderDeleteLoading,
  isDeletingAssignments,
  animatingDeleteIds,
  onNavigateToFolder,
  onOpenFolder,
  onDeleteFolder,
  onRevokeFolder,
  onRenameFolder,
  renamingFolderPaths,
  onDeleteFile,
  allFolders,
  allTrackFiles,
}) => {
  if (visibleFolders.length === 0 && visibleFiles.length === 0) {
    return <div className="no-items-message">لا توجد عناصر داخل هذا المجلد بعد</div>;
  }

  const isDeletingTrack = isDeletingAssignments[openedTrack];

  return (
    <table className="files-table">
      <thead>
        <tr>
          <th style={{ width: '50px' }}>
            <label className="checkbox-label" title="تحديد / إلغاء تحديد الكل">
              <input
                type="checkbox"
                checked={isAllChecked}
                onChange={(e) => {
                  const checked = e.target.checked;
                  setSelectedFolderPaths?.((prev) => {
                    const next = new Set(prev[openedTrack] || []);
                    if (checked) {
                      visibleFolders.forEach((f) => next.add(f.path));
                    } else {
                      visibleFolders.forEach((f) => next.delete(f.path));
                    }
                    return { ...prev, [openedTrack]: next };
                  });
                  setSelectedFileIds((prev) => {
                    const allIds = new Set(prev[openedTrack] || []);
                    if (checked) {
                      allSelectableFileIds.forEach((id) => allIds.add(id));
                    } else {
                      allSelectableFileIds.forEach((id) => allIds.delete(id));
                    }
                    return { ...prev, [openedTrack]: allIds };
                  });
                }}
              />
              <span className="checkbox-custom" />
            </label>
          </th>
          <th>اسم الملف</th>
          <th>الإجراءات</th>
        </tr>
      </thead>
      <tbody>
        {visibleFolders.map((folder) => {
          const filesInFolder = folderFilesMap.get(folder.path) || [];
          const isFolderChecked = Boolean(
            selectedFolderPaths?.[openedTrack]?.has(folder.path) ||
            (filesInFolder.length > 0 && filesInFolder.every((f: { id: string }) => selectedFileIds[openedTrack]?.has(f.id)))
          );

          const deletingThis =
            Boolean(deletingFolderPaths?.has(folder.path)) ||
            (!!folderDeleteLoading &&
            folderDeleteLoading.scope === 'track' &&
            folderDeleteLoading.track === openedTrack &&
            folderDeleteLoading.folderPath === folder.path);

          const agg = (allFolders && allTrackFiles)
            ? computeAggregateFolderCounts(folder, allFolders, allTrackFiles)
            : undefined;

          return (
            <TrackFolderRow
              key={`folder-${folder.id}`}
              openedTrack={openedTrack}
              folder={folder}
              filesInFolder={filesInFolder}
              isFolderChecked={isFolderChecked}
              deletingThis={deletingThis}
              deletingFolderPaths={deletingFolderPaths}
              folderDeleteLoading={folderDeleteLoading}
              isDeletingTrack={isDeletingTrack}
              setSelectedFileIds={setSelectedFileIds}
              setSelectedFolderPaths={setSelectedFolderPaths}
              onNavigateToFolder={onNavigateToFolder}
              onOpenFolder={onOpenFolder || onNavigateToFolder}
              onDeleteFolder={onDeleteFolder}
              onRevokeFolder={onRevokeFolder}
              onRenameFolder={onRenameFolder}
              renamingFolderPaths={renamingFolderPaths}
              aggregateCounts={agg}
            />
          );
        })}

        {visibleFiles.map((file: any) => {
          const isSelected = selectedFileIds[openedTrack]?.has(file.id);
          const isAnimatingDelete = animatingDeleteIds[openedTrack]?.has(file.id);

          return (
            <TrackFileRow
              key={file.id}
              openedTrack={openedTrack}
              file={file}
              isSelected={isSelected}
              isAnimatingDelete={isAnimatingDelete}
              isDeletingTrack={isDeletingTrack}
              setSelectedFileIds={setSelectedFileIds}
              onDeleteFile={onDeleteFile}
            />
          );
        })}
      </tbody>
    </table>
  );
};
