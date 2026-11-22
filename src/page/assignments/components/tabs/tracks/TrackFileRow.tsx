import React from 'react';
import { X, Loader2 } from 'lucide-react';
import { TrackKey } from '../../../../../services/firebaseService';

interface TrackFileRowProps {
  openedTrack: TrackKey;
  file: any;
  isSelected: boolean;
  isAnimatingDelete: boolean;
  isDeletingTrack: boolean;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  onDeleteFile: (track: TrackKey, fileId: string) => void;
}

export const TrackFileRow: React.FC<TrackFileRowProps> = ({
  openedTrack,
  file,
  isSelected,
  isAnimatingDelete,
  isDeletingTrack,
  setSelectedFileIds,
  onDeleteFile,
}) => {
  const isPdf = (file.name || '').toLowerCase().endsWith('.pdf');

  return (
    <tr
      key={file.id}
      className={`${isSelected ? 'selected-row' : ''} ${isAnimatingDelete ? 'deleting-row' : ''}`}
    >
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isSelected}
            disabled={isDeletingTrack}
            onChange={() => {
              setSelectedFileIds((prev) => {
                const currentSet = new Set(prev[openedTrack] || []);
                if (currentSet.has(file.id)) {
                  currentSet.delete(file.id);
                } else {
                  currentSet.add(file.id);
                }
                return { ...prev, [openedTrack]: currentSet };
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
          disabled={isDeletingTrack}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onDeleteFile(openedTrack, file.id);
          }}
          title="حذف الملف"
        >
          {isAnimatingDelete ? <Loader2 size={16} className="spinning-loader-small" /> : <X size={16} />}
        </button>
      </td>
    </tr>
  );
};
