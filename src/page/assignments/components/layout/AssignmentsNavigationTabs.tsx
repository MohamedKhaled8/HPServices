import React from 'react';
import { TrackKey } from '../../../../services/firebaseService';

interface AssignmentsNavigationTabsProps {
  activeTab: 'assignments' | 'tracks' | 'unified130';
  setActiveTab: (tab: 'assignments' | 'tracks' | 'unified130') => void;
  setTrackView: React.Dispatch<React.SetStateAction<'overview' | 'details'>>;
  setOpenedTrack: React.Dispatch<React.SetStateAction<TrackKey | null>>;
}

export const AssignmentsNavigationTabs: React.FC<AssignmentsNavigationTabsProps> = ({
  activeTab,
  setActiveTab,
  setTrackView,
  setOpenedTrack,
}) => {
  return (
      <div className="assignments-inner-tabs">
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('assignments');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة التكليفات
        </button>
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'unified130' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('unified130');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          ملفات الـ 130 (موحد)
        </button>
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tracks');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة تكاليف المسارات الدراسية
        </button>
      </div>
  );
};
