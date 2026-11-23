import React from 'react';
import { X, RotateCcw, Loader2 } from 'lucide-react';
import { AssignmentFolderMeta } from '../../../../../services/firebaseService';

interface Unified130FolderRowProps {
  folder: AssignmentFolderMeta;
  deletingThis: boolean;
  folderDeleteLoading: any;
  isDeleting130: boolean;
  onNavigateToFolder: (path: string) => void;
  onDeleteFolder: (path: string) => void;
  onRevokeFolder?: (path: string) => void;
  aggregateCounts?: { subfoldersCount: number; totalFilesCount: number; isParent: boolean };
}

export const Unified130FolderRow: React.FC<Unified130FolderRowProps> = ({
  folder,
  deletingThis,
  folderDeleteLoading,
  isDeleting130,
  onNavigateToFolder,
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
  const fileCount = aggregateCounts?.totalFilesCount ?? folder.totalFilesCount ?? 0;

  return (
    <tr key={`folder-${folder.id}`}>
      <td>{/* Folder checkbox placeholder */}</td>
      <td>
        <button
          type="button"
          disabled={!!folderDeleteLoading || isDeleting130}
          onClick={() => onNavigateToFolder(folder.path)}
          style={{
            border: 'none',
            background: 'none',
            cursor: 'pointer',
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
              disabled={!!folderDeleteLoading || isDeleting130}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onRevokeFolder(folder.path);
              }}
              title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            type="button"
            className="icon-button delete"
            disabled={!!folderDeleteLoading || isDeleting130}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onDeleteFolder(folder.path);
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
