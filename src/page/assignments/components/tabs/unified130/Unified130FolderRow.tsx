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
}

export const Unified130FolderRow: React.FC<Unified130FolderRowProps> = ({
  folder,
  deletingThis,
  folderDeleteLoading,
  isDeleting130,
  onNavigateToFolder,
  onDeleteFolder,
  onRevokeFolder,
}) => {
  return (
    <tr key={`folder-${folder.id}`}>
      <td>{/* Folder checkbox placeholder */}</td>
      <td>
        <button
          type="button"
          disabled={!!folderDeleteLoading || isDeleting130}
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
