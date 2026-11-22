import React from 'react';
import { AssignmentsConfigTab } from './AssignmentsConfigTab';
import { TracksManagementTab } from './TracksManagementTab';
import { Unified130Tab } from './Unified130Tab';

interface AssignmentsTabsContainerProps {
  activeTab: 'tracks' | 'unified130' | 'assignments';
  configProps: any;
  trackProps: any;
  unifiedProps: any;
}

export const AssignmentsTabsContainer: React.FC<AssignmentsTabsContainerProps> = ({
  activeTab,
  configProps,
  trackProps,
  unifiedProps,
}) => {
  return (
    <div className="assignments-content">
      {activeTab === 'assignments' && <AssignmentsConfigTab {...configProps} />}
      {activeTab === 'tracks' && <TracksManagementTab {...trackProps} />}
      {activeTab === 'unified130' && <Unified130Tab {...unifiedProps} />}
    </div>
  );
};
