import React from 'react';
import { getPathParts } from '../../../utils/folderUtils';

interface Unified130BreadcrumbsProps {
  currentPath: string;
  onNavigatePath: (path: string) => void;
}

export const Unified130Breadcrumbs: React.FC<Unified130BreadcrumbsProps> = ({
  currentPath,
  onNavigatePath,
}) => {
  return (
    <div className="track-header-main">
      <h3 className="track-section-title">ملفات خدمة الـ 130 جنيه (ملف موحد للكل)</h3>
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
