import React from 'react';
import { AssignmentFolderMeta } from '../../../../../services/firebaseService';
import { DeleteConfirmModalState } from '../../../types/assignments.types';
import { Unified130FolderRow } from './Unified130FolderRow';
import { Unified130FileRow } from './Unified130FileRow';
import { computeAggregateFolderCounts } from '../../../utils/folderTreeUtils';

interface Unified130FilesTableProps {
  visibleFolders: AssignmentFolderMeta[];
  visibleFiles: any[];
  allFilesInVisibleFolders: any[];
  isAllChecked: boolean;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  isDeleting130: boolean;
  folderDeleteLoading: {
    scope: 'track' | 'unified130';
    folderPath: string;
  } | null;
  onNavigateToFolder: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRevokeFolder?: (path: string) => void;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  allFolders?: AssignmentFolderMeta[];
  allUnifiedFiles?: any[];
}

export const Unified130FilesTable: React.FC<Unified130FilesTableProps> = ({
  visibleFolders,
  visibleFiles,
  allFilesInVisibleFolders,
  isAllChecked,
  selected130FileIds,
  setSelected130FileIds,
  isDeleting130,
  folderDeleteLoading,
  onNavigateToFolder,
  onDeleteFolder,
  onRevokeFolder,
  setDeleteConfirmModal,
  allFolders,
  allUnifiedFiles,
}) => {
  if (visibleFolders.length === 0 && visibleFiles.length === 0) {
    return <div className="no-items-message">لا توجد عناصر داخل هذا المجلد بعد</div>;
  }

  const allSelectableFiles = [...visibleFiles, ...allFilesInVisibleFolders];

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
                  if (e.target.checked) {
                    const allIds = new Set(selected130FileIds);
                    allSelectableFiles.forEach((f) => allIds.add(f.id));
                    setSelected130FileIds(allIds);
                  } else {
                    const allIds = new Set(selected130FileIds);
                    allSelectableFiles.forEach((f) => allIds.delete(f.id));
                    setSelected130FileIds(allIds);
                  }
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
          const deletingThis =
            !!folderDeleteLoading &&
            folderDeleteLoading.scope === 'unified130' &&
            folderDeleteLoading.folderPath === folder.path;

          const agg = (allFolders && allUnifiedFiles)
            ? computeAggregateFolderCounts(folder, allFolders, allUnifiedFiles)
            : undefined;

          return (
            <Unified130FolderRow
              key={`folder-${folder.id}`}
              folder={folder}
              deletingThis={deletingThis}
              folderDeleteLoading={folderDeleteLoading}
              isDeleting130={isDeleting130}
              onNavigateToFolder={onNavigateToFolder}
              onDeleteFolder={onDeleteFolder}
              onRevokeFolder={onRevokeFolder}
              aggregateCounts={agg}
            />
          );
        })}

        {visibleFiles.map((file) => {
          const isSelected = selected130FileIds.has(file.id);
          return (
            <Unified130FileRow
              key={file.id}
              file={file}
              isSelected={isSelected}
              isDeleting130={isDeleting130}
              setSelected130FileIds={setSelected130FileIds}
              setDeleteConfirmModal={setDeleteConfirmModal}
            />
          );
        })}
      </tbody>
    </table>
  );
};
