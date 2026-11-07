import React from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';

export interface ConfirmRevokeSelectedModalProps {
  confirmRevokeSelectedOpen: boolean;
  selectedRecallFileIds: Set<string>;
  isRevokingSelected: boolean;
  setConfirmRevokeSelectedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleRevokeSelectedFiles: () => Promise<void>;
}

export const ConfirmRevokeSelectedModal: React.FC<ConfirmRevokeSelectedModalProps> = ({
  confirmRevokeSelectedOpen,
  selectedRecallFileIds,
  isRevokingSelected,
  setConfirmRevokeSelectedOpen,
  handleRevokeSelectedFiles,
}) => {
  if (!confirmRevokeSelectedOpen || selectedRecallFileIds.size === 0) {
    return null;
  }

  return (
        <div className="recall-modal-overlay" onClick={() => !isRevokingSelected && setConfirmRevokeSelectedOpen(false)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#e11d48' }}>
              <RotateCcw size={32} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#be123c' }}>
              تأكيد سحب الملفات المحددة ({selectedRecallFileIds.size} ملف)
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
              هل تريد بالتأكيد سحب <strong>{selectedRecallFileIds.size} ملف محدد</strong> من حسابات كافة الطلاب الذين استلموها؟
              <br />
              <span style={{ color: '#059669', fontWeight: 700 }}>
                ✓ لن يتم المساس بباقي الملفات أو الطلاب السابقين إطلاقاً.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="recall-all-btn"
                style={{ padding: '10px 24px', fontSize: '14px' }}
                disabled={isRevokingSelected}
                onClick={handleRevokeSelectedFiles}
              >
                {isRevokingSelected ? (
                  <>
                    <Loader2 size={16} className="spinning-loader-small" />
                    جاري سحب الملفات المحددة...
                  </>
                ) : (
                  'تأكيد سحب الملفات المحددة'
                )}
              </button>
              <button
                type="button"
                className="tier-cancel"
                style={{ margin: 0 }}
                disabled={isRevokingSelected}
                onClick={() => setConfirmRevokeSelectedOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
  );
};
