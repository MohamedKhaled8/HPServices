import React from 'react';
import { ArrowRight } from 'lucide-react';
import { TrackKey } from '../../../../../services/firebaseService';
import { getPathParts, getParentPath } from '../../../utils/folderUtils';

interface TrackBreadcrumbsProps {
  openedTrack: TrackKey;
  currentPath: string;
  onBackToOverview: () => void;
  onNavigatePath: (path: string) => void;
}

const TRACK_TITLES: Record<TrackKey, string> = {
  track1: 'ملفات المسار الأول',
  track2: 'ملفات المسار الثاني',
  track3: 'ملفات المسار الثالث',
};

export const TrackBreadcrumbs: React.FC<TrackBreadcrumbsProps> = ({
  openedTrack,
  currentPath,
  onBackToOverview,
  onNavigatePath,
}) => {
  const handleBack = () => {
    if (currentPath) {
      onNavigatePath(getParentPath(currentPath));
    } else {
      onBackToOverview();
    }
  };

  return (
    <div className="track-header-main">
      <div className="track-title-row">
        <button
          type="button"
          className="back-to-tracks-button"
          onClick={handleBack}
          title={currentPath ? 'الرجوع للمستوى السابق' : 'جميع المسارات'}
        >
          <ArrowRight size={15} />
          <span>{currentPath ? 'المستوى السابق' : 'جميع المسارات'}</span>
        </button>
        <h3 className="track-section-title">
          {TRACK_TITLES[openedTrack] || 'ملفات المسار'}
        </h3>
      </div>
      <div className="track-breadcrumbs">
        <button
          type="button"
          className={`breadcrumb-item ${!currentPath ? 'active' : ''}`}
          onClick={() => onNavigatePath('')}
          disabled={!currentPath}
        >
          الجذر
        </button>
        {getPathParts(currentPath).map((part, idx, arr) => {
          const full = arr.slice(0, idx + 1).join('/');
          const isLast = idx === arr.length - 1;
          return (
            <React.Fragment key={full}>
              <span className="breadcrumb-separator">/</span>
              <button
                type="button"
                className={`breadcrumb-item ${isLast ? 'active' : ''}`}
                onClick={() => onNavigatePath(full)}
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
