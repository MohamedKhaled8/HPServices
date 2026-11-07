import React from 'react';
import { UserX } from 'lucide-react';
import { StudentWithAssignedFiles } from '../../../../../services/firebaseService';

export interface ConfirmRevokeStudentAllModalProps {
  confirmRevokeStudentAllOpen: boolean;
  setConfirmRevokeStudentAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  recallModal: {
    selectedStudent: StudentWithAssignedFiles | null;
  };
  handleRevokeAllFilesFromStudent: (studentId: string, studentName: string) => Promise<void>;
}

export const ConfirmRevokeStudentAllModal: React.FC<ConfirmRevokeStudentAllModalProps> = ({
  confirmRevokeStudentAllOpen,
  setConfirmRevokeStudentAllOpen,
  recallModal,
  handleRevokeAllFilesFromStudent,
}) => {
  if (!confirmRevokeStudentAllOpen || !recallModal.selectedStudent) {
    return null;
  }

  return (
        <div className="recall-modal-overlay" onClick={() => setConfirmRevokeStudentAllOpen(false)}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon" style={{ background: '#fee2e2', color: '#b91c1c' }}>
              <UserX size={32} />
            </div>
            <h3 style={{ margin: '0 0 10px', fontSize: '18px', fontWeight: 800, color: '#991b1b' }}>
              سحب كافة ملفات الطالب
            </h3>
            <p style={{ margin: '0 0 20px', fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
              هل تريد بالتأكيد سحب <strong>جميع الملفات المسندة</strong> (
              {recallModal.selectedStudent.assignedFiles.length} ملف) من حساب الطالب{' '}
              <strong>"{recallModal.selectedStudent.fullNameArabic}"</strong>؟
              <br />
              <span style={{ color: '#dc2626', fontWeight: 700 }}>
                لن يتمكن الطالب من رؤية أو تحميل أي من هذه الملفات بعد الآن.
              </span>
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button
                type="button"
                className="recall-all-btn"
                style={{ background: '#991b1b', padding: '10px 24px', fontSize: '14px' }}
                onClick={() =>
                  handleRevokeAllFilesFromStudent(
                    recallModal.selectedStudent!.id,
                    recallModal.selectedStudent!.fullNameArabic
                  )
                }
              >
                تأكيد سحب كافة الملفات
              </button>
              <button
                type="button"
                className="tier-cancel"
                style={{ margin: 0 }}
                onClick={() => setConfirmRevokeStudentAllOpen(false)}
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
  );
};
