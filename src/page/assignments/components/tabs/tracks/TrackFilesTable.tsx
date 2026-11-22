import React from 'react';
import { TrackKey, AssignmentFolderMeta } from '../../../../../services/firebaseService';
import { TrackFolderRow } from './TrackFolderRow';
import { TrackFileRow } from './TrackFileRow';

interface TrackFilesTableProps {
  openedTrack: TrackKey;
  visibleFolders: AssignmentFolderMeta[];
  visibleFiles: any[];
  folderFilesMap: Map<string, any[]>;
  allSelectableFileIds: string[];
  isAllChecked: boolean;
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  isDeletingAssignments: Record<TrackKey, boolean>;
  animatingDeleteIds: Record<TrackKey, Set<string>>;
  onNavigateToFolder: (folderPath: string) => void;
  onDeleteFolder: (track: TrackKey, folderPath: string) => void;
  onRevokeFolder?: (track: TrackKey, folderPath: string) => void;
  onDeleteFile: (track: TrackKey, fileId: string) => void;
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
  folderDeleteLoading,
  isDeletingAssignments,
  animatingDeleteIds,
  onNavigateToFolder,
  onDeleteFolder,
  onRevokeFolder,
  onDeleteFile,
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
                  setSelectedFileIds((prev) => {
                    const allIds = new Set(prev[openedTrack] || []);
                    if (e.target.checked) {
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
          const isFolderChecked =
            filesInFolder.length > 0 &&
            filesInFolder.every((f: any) => selectedFileIds[openedTrack]?.has(f.id));

          const deletingThis =
            !!folderDeleteLoading &&
            folderDeleteLoading.scope === 'track' &&
            folderDeleteLoading.track === openedTrack &&
            folderDeleteLoading.folderPath === folder.path;

          return (
            <TrackFolderRow
              key={`folder-${folder.id}`}
              openedTrack={openedTrack}
              folder={folder}
              filesInFolder={filesInFolder}
              isFolderChecked={isFolderChecked}
              deletingThis={deletingThis}
              folderDeleteLoading={folderDeleteLoading}
              isDeletingTrack={isDeletingTrack}
              setSelectedFileIds={setSelectedFileIds}
              onNavigateToFolder={onNavigateToFolder}
              onDeleteFolder={onDeleteFolder}
              onRevokeFolder={onRevokeFolder}
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
