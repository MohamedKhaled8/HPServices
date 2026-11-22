import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LoadingState } from './LoadingState';
import { LoadingVariant } from './loadingStateUtils';

export interface UploadSnackbarProps {
  isVisible: boolean;
  label?: string;
  variant?: LoadingVariant;
  showTimer?: boolean;
  className?: string;
}

export const UploadSnackbar: React.FC<UploadSnackbarProps> = ({
  isVisible,
  label = 'جاري رفع الملفات...',
  variant = 'Drive',
  showTimer = true,
  className = '',
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isVisible || typeof document === 'undefined') {
    return null;
  }

  const snackbarContent = (
    <div
      className={`hp-upload-snackbar-floating ${className}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="hp-upload-snackbar-pill">
        <LoadingState
          variant={variant}
          label={label}
          showTimer={showTimer}
          className="hp-pixel-on-dark"
        />
      </div>
    </div>
  );

  return createPortal(snackbarContent, document.body);
};

export default UploadSnackbar;
