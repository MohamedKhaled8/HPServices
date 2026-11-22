import React from 'react';
import '../../styles/LoadingIndicator.css';
import MorphingSquare from './MorphingSquare';
import { LoadingDotsProps, mapLoadingDotsToProps } from './morphingSquareCore.ts';

export type { LoadingDotsProps };

export const LoadingDots: React.FC<LoadingDotsProps> = ({
  text,
  className = '',
  fullScreen = false,
  size = 'md'
}) => {
  const morphProps = mapLoadingDotsToProps({ text, className, size });

  if (fullScreen) {
    return (
      <div
        className="loading-container hp-loader-overlay"
        style={{ position: 'fixed', zIndex: 99999 }}
        dir="rtl"
        role="status"
        aria-live="polite"
      >
        <MorphingSquare {...morphProps} />
      </div>
    );
  }

  return (
    <div className="hp-loader-inline" dir="rtl">
      <MorphingSquare {...morphProps} />
    </div>
  );
};

export default LoadingDots;
