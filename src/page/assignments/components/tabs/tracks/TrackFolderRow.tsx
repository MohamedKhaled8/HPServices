import React from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import { TrackKey, AssignmentFolderMeta } from '../../../../../services/firebaseService';

interface TrackFolderRowFileItem {
  id: string;
  name?: string;
  folderPath?: string;
}

interface TrackFolderRowProps {
  openedTrack: TrackKey;
  folder: AssignmentFolderMeta;
  filesInFolder: TrackFolderRowFileItem[];
  isFolderChecked: boolean;
  deletingThis?: boolean;
  deletingFolderPaths?: Set<string>;
  folderDeleteLoading?: {
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null;
  isDeletingTrack?: boolean;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  onNavigateToFolder?: (folderPath: string) => void;
  onOpenFolder?: (folderPath: string) => void;
  onDeleteFolder: (track: TrackKey, folderPath: string) => void;
  onRevokeFolder?: (track: TrackKey, folderPath: string) => void;
  aggregateCounts?: { subfoldersCount: number; totalFilesCount: number; isParent: boolean };
}

export const TrackFolderRow: React.FC<TrackFolderRowProps> = ({
  openedTrack,
  folder,
  filesInFolder,
  isFolderChecked,
  deletingThis = false,
  deletingFolderPaths,
  setSelectedFileIds,
  setSelectedFolderPaths,
  onNavigateToFolder,
  onOpenFolder,
  onDeleteFolder,
  onRevokeFolder,
  aggregateCounts,
}) => {
  const isParent = Boolean(
    folder.isParentFolder ||
    (typeof folder.subfoldersCount === 'number' && folder.subfoldersCount > 0) ||
    aggregateCounts?.isParent
  );
  const subCount = aggregateCounts?.subfoldersCount ?? folder.subfoldersCount ?? 0;
  const fileCount = aggregateCounts?.totalFilesCount ?? filesInFolder.length ?? folder.totalFilesCount ?? 0;

  const handleOpen = onOpenFolder || onNavigateToFolder;
  const isDeletingThis = Boolean(deletingThis || deletingFolderPaths?.has(folder.path));

  return (
    <tr
      key={`folder-${folder.id}`}
      style={{
        opacity: isDeletingThis ? 0.5 : 1,
        transition: 'opacity 0.2s ease',
      }}
    >
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isFolderChecked}
            disabled={isDeletingThis}
            onChange={(e) => {
              const checked = e.target.checked;
              setSelectedFolderPaths?.((prev) => {
                const next = new Set(prev[openedTrack] || []);
                if (checked) next.add(folder.path);
                else next.delete(folder.path);
                return { ...prev, [openedTrack]: next };
              });
              setSelectedFileIds((prev) => {
                const allIds = new Set(prev[openedTrack] || []);
                if (checked) {
                  filesInFolder.forEach((f) => allIds.add(f.id));
                } else {
                  filesInFolder.forEach((f) => allIds.delete(f.id));
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
          disabled={isDeletingThis}
          onClick={(e) => {
            e.stopPropagation();
            if (!isDeletingThis && handleOpen) {
              handleOpen(folder.path);
            }
          }}
          style={{
            border: 'none',
            background: 'none',
            cursor: isDeletingThis ? 'not-allowed' : 'pointer',
            color: '#2563eb',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span>📁 {folder.name}</span>
          <span
            style={{
              fontSize: '11px',
              fontWeight: 500,
              color: isParent ? '#1d4ed8' : '#64748b',
              background: isParent ? '#eff6ff' : '#f1f5f9',
              padding: '2px 8px',
              borderRadius: '999px',
              border: isParent ? '1px solid #bfdbfe' : '1px solid #e2e8f0',
            }}
          >
            {isParent
              ? `${subCount > 0 ? `${subCount} مجلدات • ` : ''}${fileCount} ملف`
              : `${fileCount} ملف`}
          </span>
        </button>
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRevokeFolder && (
            <button
              type="button"
              className="icon-button revoke"
              disabled={isDeletingThis}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!isDeletingThis) {
                  onRevokeFolder(openedTrack, folder.path);
                }
              }}
              title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            type="button"
            className="icon-button delete"
            disabled={isDeletingThis}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              if (!isDeletingThis) {
                onDeleteFolder(openedTrack, folder.path);
              }
            }}
            title="حذف المجلد نهائياً"
          >
            {isDeletingThis ? <Loader2 size={16} className="spinning-loader-small" /> : <X size={16} />}
          </button>
        </div>
      </td>
    </tr>
  );
};
