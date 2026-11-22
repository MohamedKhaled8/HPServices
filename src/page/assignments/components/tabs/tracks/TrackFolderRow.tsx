import React from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import { TrackKey, AssignmentFolderMeta } from '../../../../../services/firebaseService';

interface TrackFolderRowProps {
  openedTrack: TrackKey;
  folder: AssignmentFolderMeta;
  filesInFolder: any[];
  isFolderChecked: boolean;
  deletingThis: boolean;
  folderDeleteLoading: any;
  isDeletingTrack: boolean;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  onNavigateToFolder: (folderPath: string) => void;
  onDeleteFolder: (track: TrackKey, folderPath: string) => void;
  onRevokeFolder?: (track: TrackKey, folderPath: string) => void;
}

export const TrackFolderRow: React.FC<TrackFolderRowProps> = ({
  openedTrack,
  folder,
  filesInFolder,
  isFolderChecked,
  deletingThis,
  folderDeleteLoading,
  isDeletingTrack,
  setSelectedFileIds,
  onNavigateToFolder,
  onDeleteFolder,
  onRevokeFolder,
}) => {
  return (
    <tr key={`folder-${folder.id}`}>
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isFolderChecked}
            onChange={(e) => {
              setSelectedFileIds((prev) => {
                const allIds = new Set(prev[openedTrack] || []);
                if (e.target.checked) {
                  filesInFolder.forEach((f: any) => allIds.add(f.id));
                } else {
                  filesInFolder.forEach((f: any) => allIds.delete(f.id));
                }
                return { ...prev, [openedTrack]: allIds };
              });
            }}
          />
          <span className="checkbox-custom" />
        </label>
      </td>
      <td>
        <button
          type="button"
          disabled={!!folderDeleteLoading || isDeletingTrack}
          onClick={() => onNavigateToFolder(folder.path)}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
        >
          📁 {folder.name}
        </button>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRevokeFolder && (
            <button
              type="button"
              className="icon-button revoke"
              disabled={!!folderDeleteLoading || isDeletingTrack}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRevokeFolder(openedTrack, folder.path);
              }}
              title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            type="button"
            className="icon-button delete"
            disabled={!!folderDeleteLoading || isDeletingTrack}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteFolder(openedTrack, folder.path);
            }}
            title="حذف المجلد نهائياً"
          >
            {deletingThis ? <Loader2 size={16} className="spinning-loader-small" /> : <X size={16} />}
          </button>
        </div>
      </td>
    </tr>
  );
};
