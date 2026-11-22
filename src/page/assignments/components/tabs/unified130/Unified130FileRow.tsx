import React from 'react';
import { X } from 'lucide-react';
import { DeleteConfirmModalState } from '../../../types/assignments.types';

interface Unified130FileRowProps {
  file: any;
  isSelected: boolean;
  isDeleting130: boolean;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
}

export const Unified130FileRow: React.FC<Unified130FileRowProps> = ({
  file,
  isSelected,
  isDeleting130,
  setSelected130FileIds,
  setDeleteConfirmModal,
}) => {
  const isPdf = (file.name || '').toLowerCase().endsWith('.pdf');

  return (
    <tr key={file.id} className={isSelected ? 'selected-row' : ''}>
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isDeleting130}
            onChange={() => {
              setSelected130FileIds((prev) => {
                const next = new Set(prev);
                if (next.has(file.id)) {
                  next.delete(file.id);
                } else {
                  next.add(file.id);
                }
                return next;
              });
            }}
          />
          <span className="checkbox-custom" />
        </label>
      </td>
      <td>
        <div className="file-info-cell">
          <div className={`file-icon-simple ${isPdf ? 'pdf' : 'img'}`}>
            {isPdf ? 'PDF' : 'IMG'}
          </div>
          <a href={file.url} target="_blank" rel="noreferrer" className="file-link-simple">
            {file.name}
          </a>
        </div>
      </td>
      <td>
        <button
          type="button"
          className="icon-button delete"
          disabled={isDeleting130}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setDeleteConfirmModal({
              open: true,
              fileIds: [file.id],
              source: 'unified130',
              singleFileId: file.id,
            });
          }}
          title="حذف الملف"
        >
          <X size={16} />
        </button>
      </td>
    </tr>
  );
};
