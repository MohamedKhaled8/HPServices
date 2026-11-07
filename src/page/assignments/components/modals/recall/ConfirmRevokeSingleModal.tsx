import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { DistributedFileSummary } from '../../../../../services/firebaseService';

export interface ConfirmRevokeSingleModalProps {
  confirmRevokeSingle: DistributedFileSummary | null;
  setConfirmRevokeSingle: React.Dispatch<React.SetStateAction<DistributedFileSummary | null>>;
  handleRevokeSingleFile: (item: DistributedFileSummary) => Promise<void>;
}

export const ConfirmRevokeSingleModal: React.FC<ConfirmRevokeSingleModalProps> = ({
  confirmRevokeSingle,
  setConfirmRevokeSingle,
  handleRevokeSingleFile,
}) => {
  if (!confirmRevokeSingle) {
    return null;
  }

  return (
        <div className="recall-modal-overlay" onClick={() => setConfirmRevokeSingle(null)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
              <AlertTriangle size={32} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800 }}>تأكيد سحب الملف</h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
              هل تريد بالتأكيد سحب ملف <strong>"{confirmRevokeSingle.fileName}"</strong> من حسابات{' '}
              <strong>{confirmRevokeSingle.studentCount} طالب</strong>؟
              <br />
              لن يتمكن الطلاب من رؤية هذا التكليف أو تحميله بعد الآن.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="recall-all-btn"
                style={{ padding: '10px 24px', fontSize: '14px' }}
                onClick={() => handleRevokeSingleFile(confirmRevokeSingle)}
              >
                تأكيد سحب الملف
              </button>
              <button
                type="button"
                className="tier-cancel"
                style={{ margin: 0 }}
                onClick={() => setConfirmRevokeSingle(null)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
  );
};
