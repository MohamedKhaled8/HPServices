import React from 'react';
import { FolderCardFile } from './FolderCardTypes';

interface FolderPreviewStackProps {
  files?: FolderCardFile[];
  titleId: string;
}

const truncateName = (name: string, maxLen = 16) => {
  if (!name) return '';
  return name.length > maxLen ? `${name.substring(0, maxLen - 1)}…` : name;
};

const formatSize = (bytes?: number, fallback = 'FILE') => {
  if (!bytes || typeof bytes !== 'number') return fallback;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export const FolderPreviewStack: React.FC<FolderPreviewStackProps> = ({ files = [], titleId }) => {
  const file0 = files[0];
  const file1 = files[1];
  const file2 = files[2];

  const card1Title = file0?.name ? truncateName(file0.name) : 'Cover — final';
  const card1Meta = file0 ? formatSize(file0.size, 'PNG') : 'PNG • 4.8 MB';

  const card2Title = file1?.name ? truncateName(file1.name) : 'Moodboard';
  const card2Meta = file1 ? formatSize(file1.size, 'IMG') : '24 images';

  const card3Title = file2?.name
    ? truncateName(file2.name)
    : file0?.name
    ? truncateName(file0.name)
    : 'Brief.pdf';
  const card3Meta = file2 ? formatSize(file2.size, 'PDF') : 'PDF • 1.2 MB';

  return (
    <div className="folder-cards-stack">
      {/* Card 1: Backmost, leans left with solid dark artwork */}
      <div className="folder-preview-card card-1">
        <svg className="card-artwork-svg" viewBox="0 0 165 105" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`solidSwirl1-${titleId}`} cx="35%" cy="40%" r="75%">
              <stop offset="0%" stopColor="#ea580c" />
              <stop offset="40%" stopColor="#dc2626" />
              <stop offset="70%" stopColor="#7f1d1d" />
              <stop offset="100%" stopColor="#18181b" />
            </radialGradient>
            <linearGradient id={`solidWave1-${titleId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#b91c1c" />
              <stop offset="100%" stopColor="#09090b" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill={`url(#solidSwirl1-${titleId})`} />
          <path d="M-20,40 Q30,10 70,50 T180,40 L180,110 L-20,110 Z" fill={`url(#solidWave1-${titleId})`} />
          <path d="M-10,80 Q50,30 110,70 T190,60" fill="none" stroke="rgba(255,210,160,0.4)" strokeWidth="8" />
          <path d="M10,20 Q60,70 120,30 T180,80" fill="none" stroke="rgba(0,0,0,0.6)" strokeWidth="10" />
        </svg>
        <div className="card-header">
          <span className="card-title">{card1Title}</span>
          <span className="card-meta">{card1Meta}</span>
        </div>
      </div>

      {/* Card 2: Middle, solid deep slate artwork */}
      <div className="folder-preview-card card-2">
        <svg className="card-artwork-svg" viewBox="0 0 165 105" preserveAspectRatio="none">
          <defs>
            <radialGradient id={`solidSwirl2-${titleId}`} cx="60%" cy="30%" r="80%">
              <stop offset="0%" stopColor="#c2410c" />
              <stop offset="40%" stopColor="#991b1b" />
              <stop offset="75%" stopColor="#450a0a" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
            <linearGradient id={`solidWave2-${titleId}`} x1="100%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#fb923c" />
              <stop offset="50%" stopColor="#ef4444" />
              <stop offset="100%" stopColor="#020617" />
            </linearGradient>
          </defs>
          <rect width="100%" height="100%" fill={`url(#solidSwirl2-${titleId})`} />
          <path d="M-10,30 Q40,65 95,30 T185,55 L185,110 L-10,110 Z" fill={`url(#solidWave2-${titleId})`} />
          <path d="M0,60 Q65,15 125,55 T185,45" fill="none" stroke="rgba(254,205,150,0.35)" strokeWidth="7" />
        </svg>
        <div className="card-header">
          <span className="card-title">{card2Title}</span>
          <span className="card-meta">{card2Meta}</span>
        </div>
      </div>

      {/* Card 3: Frontmost Crisp White Document Card */}
      <div className="folder-preview-card card-3">
        <div className="card-header card-header-doc">
          <span className="card-title card-title-doc">{card3Title}</span>
          <span className="card-meta card-meta-doc">{card3Meta}</span>
        </div>
        <div className="card-doc-skeleton">
          <div className="skeleton-line" style={{ width: '84%' }} />
          <div className="skeleton-line" style={{ width: '96%' }} />
          <div className="skeleton-line" style={{ width: '68%' }} />
        </div>
      </div>
    </div>
  );
};
