import React, { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, XCircle, X } from 'lucide-react';
import { InterruptedBatchMetadata } from '../../types/backgroundUpload.types';

const STORAGE_KEY = 'hp_upload_interrupted_batch';

export const UploadRecoveryBanner: React.FC = () => {
  const [metadata, setMetadata] = useState<InterruptedBatchMetadata | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as InterruptedBatchMetadata;
        if (parsed && (parsed.completedFolders?.length > 0 || parsed.pendingFolders?.length > 0)) {
          setMetadata(parsed);
        }
      }
    } catch (_) {}
  }, []);

  const handleDismiss = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_) {}
    setMetadata(null);
  };

  if (!metadata) return null;

  return (
    <div className="upload-recovery-banner" role="alert" dir="rtl">
      <div className="upload-recovery-header">
        <div className="upload-recovery-title">
          <AlertTriangle size={18} className="recovery-warn-icon" />
          <strong>تنبيه: تم مقاطعة عملية رفع مجلدات سابقة بسبب إعادة التحميل</strong>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="recovery-dismiss-btn"
          title="تجاهل وإخفاء التنبيه"
        >
          <X size={16} />
        </button>
      </div>

      <div className="upload-recovery-details">
        {metadata.completedFolders.length > 0 && (
          <div className="recovery-item completed">
            <CheckCircle size={15} />
            <span>
              مجلدات تم اكتمالها وحفظها ({metadata.completedFolders.length}):{' '}
              {metadata.completedFolders.join('، ')}
            </span>
          </div>
        )}
        {metadata.pendingFolders.length > 0 && (
          <div className="recovery-item pending">
            <XCircle size={15} />
            <span>
              مجلدات لم تكتمل ({metadata.pendingFolders.length}):{' '}
              {metadata.pendingFolders.join('، ')}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
