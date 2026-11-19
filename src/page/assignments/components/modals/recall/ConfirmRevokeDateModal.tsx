import React from 'react';
import { AlertTriangle, Calendar, Layers, Users } from 'lucide-react';
import { DistributedFolderSummary } from '../../../../../services/firebaseService';

export interface ConfirmRevokeDateModalProps {
  confirmRevokeDateOpen: boolean;
  setConfirmRevokeDateOpen: React.Dispatch<React.SetStateAction<boolean>>;
  dateString: string;
  foldersForDate: DistributedFolderSummary[];
  handleRevokeAllFoldersForDate: (dateString: string) => Promise<void>;
  isRevokingDateAll: boolean;
}

export const ConfirmRevokeDateModal: React.FC<ConfirmRevokeDateModalProps> = ({
  confirmRevokeDateOpen,
  setConfirmRevokeDateOpen,
  dateString,
  foldersForDate,
  handleRevokeAllFoldersForDate,
  isRevokingDateAll,
}) => {
  if (!confirmRevokeDateOpen || foldersForDate.length === 0) {
    return null;
  }

  const totalUniqueStudents = new Set(foldersForDate.flatMap((f) => f.studentIds)).size;
  const sampleDateLabel = foldersForDate[0]?.formattedDate || dateString;

  return (
    <div className="recall-modal-overlay" onClick={() => !isRevokingDateAll && setConfirmRevokeDateOpen(false)}>
      <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
        <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
          <AlertTriangle size={32} />
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800 }}>تأكيد سحب كافة مجلدات اليوم</h3>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: '8px' }}>
            <Calendar size={18} color="#e11d48" />
            <span>تاريخ الإرسال: {sampleDateLabel}</span>
          </div>

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Layers size={13} />
              <span>{foldersForDate.length} مجلد سيتم سحبه</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={13} />
              <span>يشمل {totalUniqueStudents} طالب مستلم</span>
            </div>
          </div>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
          سيتم سحب جميع التكليفات في المجلدات التالية التي أُرسلت في هذا اليوم:
          <br />
          <span style={{ fontWeight: 600, color: '#334155', display: 'block', marginTop: '6px' }}>
            {foldersForDate.map((f) => f.folderName).join(' ، ')}
          </span>
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            className="recall-all-btn"
            disabled={isRevokingDateAll}
            style={{ padding: '10px 24px', fontSize: '14px', background: '#e11d48', borderColor: '#e11d48' }}
            onClick={() => handleRevokeAllFoldersForDate(dateString)}
          >
            {isRevokingDateAll ? 'جاري السحب...' : `تأكيد سحب كافة مجلدات اليوم (${foldersForDate.length})`}
          </button>
          <button
            type="button"
            className="tier-cancel"
            style={{ margin: 0 }}
            disabled={isRevokingDateAll}
            onClick={() => setConfirmRevokeDateOpen(false)}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
