import React from 'react';
import { Trash2, X, RotateCcw } from 'lucide-react';
import { DeleteConfirmModalState } from '../../types/assignments.types';

export type DeleteActionMode = 'both' | 'server-only' | 'students-only' | boolean;

export interface DeleteConfirmationModalProps {
  deleteConfirmModal: DeleteConfirmModalState;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  executeDelete: (mode: DeleteActionMode) => void;
  isRemovingFromUsers: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  deleteConfirmModal,
  setDeleteConfirmModal,
  executeDelete,
  isRemovingFromUsers,
}) => {
  if (!deleteConfirmModal.open) {
    return null;
  }

  return (
        <div className="delete-confirm-overlay" onClick={() => setDeleteConfirmModal(prev => ({ ...prev, open: false }))}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <Trash2 size={32} />
            </div>
            <h3>إدارة وحذف الملفات المحددة</h3>
            <p className="delete-confirm-count">
              تم تحديد <strong>{deleteConfirmModal.fileIds.length}</strong> ملف
              {deleteConfirmModal.source === 'unified130' ? ' من ملفات الـ 130 الموحدة' : ' من ملفات المسار'}
            </p>
            <p className="delete-confirm-question">
              اختر الإجراء المطلوب تنفيذه على الملفات المحددة:
            </p>

            <div className="delete-confirm-buttons">
              <button
                type="button"
                className="delete-btn-both"
                onClick={() => executeDelete('both')}
                disabled={isRemovingFromUsers}
              >
                <Trash2 size={18} />
                <div>
                  <strong>حذف نهائي من الكل (موصى به)</strong>
                  <span>حذف الملفات من الداش بورد + إزالتها من حسابات الطلاب</span>
                </div>
              </button>

              <button
                type="button"
                className="delete-btn-server-only"
                onClick={() => executeDelete('server-only')}
                disabled={isRemovingFromUsers}
              >
                <X size={18} />
                <div>
                  <strong>حذف من الداش بورد فقط</strong>
                  <span>حذف الملفات من الداش بورد مع بقائها لدى الطلاب</span>
                </div>
              </button>

              <button
                type="button"
                className="delete-btn-students-only"
                onClick={() => executeDelete('students-only')}
                disabled={isRemovingFromUsers}
              >
                <RotateCcw size={18} />
                <div>
                  <strong>سحب من حسابات الطلاب فقط</strong>
                  <span>إزالة الملفات من حسابات الطلاب مع الإبقاء عليها في الداش بورد</span>
                </div>
              </button>
            </div>

            <button
              type="button"
              className="delete-btn-cancel"
              onClick={() => setDeleteConfirmModal(prev => ({ ...prev, open: false }))}
            >
              إلغاء
            </button>
          </div>
        </div>
  );
};
