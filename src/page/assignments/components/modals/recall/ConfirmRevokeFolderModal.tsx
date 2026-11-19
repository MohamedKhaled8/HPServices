import React from 'react';
import { AlertTriangle, Folder, Calendar, Clock, Users, FileText } from 'lucide-react';
import { DistributedFolderSummary } from '../../../../../services/firebaseService';

export interface ConfirmRevokeFolderModalProps {
  confirmRevokeFolder: DistributedFolderSummary | null;
  setConfirmRevokeFolder: React.Dispatch<React.SetStateAction<DistributedFolderSummary | null>>;
  handleRevokeFolder: (folder: DistributedFolderSummary) => Promise<void>;
}

export const ConfirmRevokeFolderModal: React.FC<ConfirmRevokeFolderModalProps> = ({
  confirmRevokeFolder,
  setConfirmRevokeFolder,
  handleRevokeFolder,
}) => {
  if (!confirmRevokeFolder) {
    return null;
  }

  return (
    <div className="recall-modal-overlay" onClick={() => setConfirmRevokeFolder(null)}>
      <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#ef4444' }}>
          <AlertTriangle size={32} />
        </div>
        <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800 }}>تأكيد سحب المجلد بالكامل</h3>

        <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', marginBottom: '16px', border: '1px solid #e2e8f0', textAlign: 'right' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '15px', color: '#1e293b', marginBottom: confirmRevokeFolder.subFolderName ? '2px' : '8px' }}>
            <Folder size={18} color="#e11d48" />
            <span>{confirmRevokeFolder.folderName}</span>
          </div>

          {confirmRevokeFolder.subFolderName && (
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '8px', marginRight: '26px' }}>
              المحتوى الفرعي: <strong>{confirmRevokeFolder.subFolderName}</strong>
            </div>
          )}

          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={13} />
              <span>{confirmRevokeFolder.formattedDate || confirmRevokeFolder.dateString}</span>
            </div>
            {confirmRevokeFolder.formattedTime && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={13} />
                <span>{confirmRevokeFolder.formattedTime}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Users size={13} />
              <span>{confirmRevokeFolder.studentCount} طالب مستلم</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <FileText size={13} />
              <span>{confirmRevokeFolder.filesCount} نموذج موزع</span>
            </div>
          </div>
        </div>

        <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
          سيتم سحب كافة الملفات والنماذج التابعة لهذا المجلد من حسابات جميع الـ{' '}
          <strong>{confirmRevokeFolder.studentCount} طالب</strong> الذين استلموه في هذا التاريخ.
          <br />
          لن تظهر هذه التكليفات في حسابات الطلاب بعد الآن.
        </p>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            className="recall-all-btn"
            style={{ padding: '10px 24px', fontSize: '14px', background: '#e11d48', borderColor: '#e11d48' }}
            onClick={() => handleRevokeFolder(confirmRevokeFolder)}
          >
            تأكيد سحب المجلد
          </button>
          <button
            type="button"
            className="tier-cancel"
            style={{ margin: 0 }}
            onClick={() => setConfirmRevokeFolder(null)}
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );
};
