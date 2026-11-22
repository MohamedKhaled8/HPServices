import React from 'react';
import { TrackKey } from '../../../../../services/firebaseService';
import { FolderCard } from '../../common/FolderCard';

interface TracksOverviewProps {
  trackFiles: Record<TrackKey, any[]>;
  onSelectTrack: (track: TrackKey) => void;
  onFileUpload?: (track: TrackKey, files: File[]) => void;
}

const TRACKS_CONFIG: { key: TrackKey; label: string }[] = [
  { key: 'track1', label: 'المسار الأول' },
  { key: 'track2', label: 'المسار الثاني' },
  { key: 'track3', label: 'المسار الثالث' },
];

export const TracksOverview: React.FC<TracksOverviewProps> = ({
  trackFiles,
  onSelectTrack,
  onFileUpload,
}) => {
  return (
    <>
      <div className="section-header">
        <h2>اختر المسار لتوزيع ملفات التكاليف</h2>
      </div>

      <div className="track-folders-grid">
        {TRACKS_CONFIG.map((track, index) => {
          const files = trackFiles[track.key] || [];
          return (
            <FolderCard
              key={track.key}
              className={`track-folder-item-${index + 1}`}
              title={track.label}
              count={files.length}
              files={files}
              onClick={() => onSelectTrack(track.key)}
              onFileUpload={(uploadFiles) => onFileUpload?.(track.key, uploadFiles)}
            />
          );
        })}
      </div>

      <div className="track-folder-instruction">
        HOVER TO LEAN &bull; CLICK TO OPEN &bull; + TO ADD
      </div>
    </>
  );
};
