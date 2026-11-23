import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, X } from 'lucide-react';
import { LoadingState } from './LoadingState';
import { LoadingVariant } from './loadingStateUtils';

export interface UploadSnackbarProps {
  isVisible: boolean;
  label?: string;
  variant?: LoadingVariant;
  showTimer?: boolean;
  className?: string;
  isError?: boolean;
  onDismiss?: () => void;
}

export const UploadSnackbar: React.FC<UploadSnackbarProps> = ({
  isVisible,
  label = 'جاري رفع الملفات...',
  variant = 'Drive',
  showTimer = true,
  className = '',
  isError = false,
  onDismiss,
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
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      aria-atomic="true"
    >
      <div
        className="hp-upload-snackbar-pill"
        style={
          isError
            ? {
                background: '#450a0a',
                borderColor: '#ef4444',
                color: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }
            : undefined
        }
      >
        {isError ? (
          <>
            <AlertCircle size={20} color="#f87171" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: '#fecaca' }}>{label}</span>
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#fca5a5',
                  padding: '2px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  marginLeft: '4px',
                }}
                title="إغلاق"
              >
                <X size={16} />
              </button>
            )}
          </>
        ) : (
          <LoadingState
            variant={variant}
            label={label}
            showTimer={showTimer}
            className="hp-pixel-on-dark"
          />
        )}
      </div>
    </div>
  );

  return createPortal(snackbarContent, document.body);
};

export default UploadSnackbar;
