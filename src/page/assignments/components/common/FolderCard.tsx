import React, { useRef, useState, useId } from 'react';
import { Plus, MoreHorizontal } from 'lucide-react';
import { FolderCardProps } from './FolderCardTypes';
import { FolderPreviewStack } from './FolderPreviewStack';

export const FolderCard: React.FC<FolderCardProps> = ({
  title,
  count,
  files = [],
  onClick,
  onFileUpload,
  className = '',
  showAddButton = true,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const rawId = useId();
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, '');

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0 && onFileUpload) {
      onFileUpload(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    onClick?.();
  };

  return (
    <div
      className={`frosted-folder-container solid-folder-theme ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        onChange={handleFileChange}
      />

      {/* Full-card accessible click button */}
      <button
        type="button"
        className="folder-card-hitbox"
        onClick={handleCardClick}
        aria-label={`فتح ${title}`}
      />

      <div className="frosted-folder-card">
        {/* Layer 1: Solid Back Plate */}
        <div className="folder-back-plate">
          <svg viewBox="0 0 260 180" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`solidBackGrad-${cleanId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#334155" />
                <stop offset="100%" stopColor="#1e293b" />
              </linearGradient>
            </defs>
            <path
              d="M 0,36 C 0,25 9,16 20,16 L 86,16 C 98,16 106,9 116,2 C 120,0 125,0 132,0 L 240,0 C 251,0 260,9 260,20 L 260,160 C 260,171 251,180 240,180 L 20,180 C 9,180 0,171 0,160 L 0,36 Z"
              fill={`url(#solidBackGrad-${cleanId})`}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="1.2"
            />
          </svg>
        </div>

        {/* Layer 2: Stacked Peeking Preview Cards */}
        <FolderPreviewStack files={files} titleId={cleanId} />

        {/* Layer 3: Solid Front Flap */}
        <div className="folder-front-pocket solid-front-pocket">
          <svg className="front-pocket-rim-svg" viewBox="0 0 260 180" width="100%" height="100%" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`solidFrontGrad-${cleanId}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="100%" stopColor="#0f172a" />
              </linearGradient>
            </defs>
            <path
              d="M 0,80 C 0,70 9,62 20,62 L 88,62 C 102,62 110,74 120,84 C 124,88 129,88 136,88 L 242,88 C 252,88 260,96 260,106 L 260,160 C 260,171 251,180 240,180 L 20,180 C 9,180 0,171 0,160 L 0,80 Z"
              fill={`url(#solidFrontGrad-${cleanId})`}
              stroke="rgba(255,255,255,0.18)"
              strokeWidth="1.2"
            />
          </svg>

          {/* Front Flap Content: Title, Real File Count, and Squircle Action Button */}
          <div className="front-pocket-content">
            <div className="folder-text-group">
              <div className="folder-card-title">{title}</div>
              <div className="folder-card-count">{count} {count === 1 ? 'ملف' : 'ملفات'}</div>
            </div>

            {showAddButton && (
              <button
                type="button"
                className={`folder-action-btn-squircle ${isHovered ? 'hovered' : ''}`}
                onClick={handleActionClick}
                title="إضافة ملفات إلى هذا المسار"
              >
                {isHovered ? <Plus size={18} strokeWidth={2.6} /> : <MoreHorizontal size={18} strokeWidth={2.4} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
