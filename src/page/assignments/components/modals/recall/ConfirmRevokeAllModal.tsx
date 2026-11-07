import React from 'react';
import { Trash2 } from 'lucide-react';
import { DistributedFileSummary } from '../../../../../services/firebaseService';

export interface ConfirmRevokeAllModalProps {
  confirmRevokeAllOpen: boolean;
  setConfirmRevokeAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recallModal: {
    files: DistributedFileSummary[];
  };
  handleRevokeAllFiles: () => Promise<void>;
}

export const ConfirmRevokeAllModal: React.FC<ConfirmRevokeAllModalProps> = ({
  confirmRevokeAllOpen,
  setConfirmRevokeAllOpen,
  recallModal,
  handleRevokeAllFiles,
}) => {
  if (!confirmRevokeAllOpen) {
    return null;
  }

  return (
        <div className="recall-modal-overlay" onClick={() => setConfirmRevokeAllOpen(false)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <Trash2 size={32} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>
              تأكيد سحب جميع ملفات المسار
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
              هل أنت متأكد تماماً من رغبتك في سحب <strong>كافة الملفات الموزعة</strong> (
              {recallModal.files.length} ملف) في هذا المسار من جميع الطلاب؟
              <br />
              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                هذا الإجراء سيقوم بحذف كافة التكليفات الموزعة في هذا المسار من عند جميع الطلاب دفعة واحدة.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="recall-all-btn"
                style={{ background: '#991b1b', padding: '10px 24px', fontSize: '14px' }}
                onClick={handleRevokeAllFiles}
              >
                نعم، اسحب كل الملفات الآن
              </button>
              <button
                type="button"
                className="tier-cancel"
                style={{ margin: 0 }}
                onClick={() => setConfirmRevokeAllOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
  );
};
