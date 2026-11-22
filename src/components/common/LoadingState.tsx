import React, { useState, useEffect } from 'react';
import '../../styles/LoadingState.css';
import {
  LoadingVariant,
  computePixelCell,
  formatElapsedTime,
} from './loadingStateUtils';

export * from './loadingStateUtils';

export function useElapsedTimer(enabled: boolean = true): number {
  const [elapsedMs, setElapsedMs] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setElapsedMs(0);
      return;
    }
    const startTime = Date.now();
    const timerId = setInterval(() => {
      setElapsedMs(Date.now() - startTime);
    }, 100);

    return () => clearInterval(timerId);
  }, [enabled]);

  return elapsedMs;
}

export interface LoadingStateProps {
  label?: string;
  variant?: LoadingVariant;
  showTimer?: boolean;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  label = 'جاري المعالجة...',
  variant = 'Drive',
  showTimer = true,
  className = '',
}) => {
  const elapsedMs = useElapsedTimer(showTimer);
  const formattedTime = formatElapsedTime(elapsedMs);

  return (
    <div
      className={`hp-pixel-loading-state hp-variant-${variant.toLowerCase()} ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="hp-pixel-grid" aria-hidden="true">
        {Array.from({ length: 9 }, (_, i) => {
          const cell = computePixelCell(variant, i);
          const cellStyle: React.CSSProperties = cell.isStaticDim
            ? { opacity: cell.opacity ?? 0.07, animation: 'none' }
            : {
                animationDuration: `${cell.cycleMs}ms`,
                animationDelay: `${cell.delayMs}ms`,
              };

          return (
            <span
              key={i}
              className={`hp-pixel-cell ${variant === 'Dots' ? 'hp-cell-dot' : 'hp-cell-square'}`}
              style={cellStyle}
            />
          );
        })}
      </div>

      {label && <span className="hp-pixel-label">{label}</span>}

      {showTimer && (
        <span dir="ltr" className="hp-pixel-timer">
          {formattedTime}
        </span>
      )}
    </div>
  );
};

export default LoadingState;
