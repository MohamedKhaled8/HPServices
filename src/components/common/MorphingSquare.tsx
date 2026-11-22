import React from 'react';
import '../../styles/LoadingIndicator.css';
import {
  MorphingSquareProps,
  DEFAULT_PLACEMENT,
  DEFAULT_SIZE,
  getPlacementClass,
  getSizeClass,
  getAriaLabel
} from './morphingSquareCore.ts';

export type { MorphingSquareProps };

export const MorphingSquare: React.FC<MorphingSquareProps> = ({
  message,
  messagePlacement = DEFAULT_PLACEMENT,
  size = DEFAULT_SIZE,
  className = ''
}) => {
  const placementClass = getPlacementClass(messagePlacement);
  const sizeClass = getSizeClass(size);
  const ariaLabel = getAriaLabel(message);

  return (
    <div
      className={`hp-morph-container ${placementClass} ${sizeClass} ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
      dir="rtl"
    >
      <div className="hp-morphing-square" aria-hidden="true" />
      {message && <span className="hp-morph-message">{message}</span>}
    </div>
  );
};

export default MorphingSquare;
