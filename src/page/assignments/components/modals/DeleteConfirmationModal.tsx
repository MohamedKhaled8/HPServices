import React from 'react';
import { Trash2, X } from 'lucide-react';
import { DeleteConfirmModalState } from '../../types/assignments.types';

export interface DeleteConfirmationModalProps {
  deleteConfirmModal: DeleteConfirmModalState;
  setDeleteConfirmModal: React.Dispatch<React.SetStateAction<DeleteConfirmModalState>>;
  executeDelete: (removeFromUsers: boolean) => void;
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
            <h3>تأكيد الحذف</h3>
            <p className="delete-confirm-count">
              سيتم حذف <strong>{deleteConfirmModal.fileIds.length}</strong> ملف
              {deleteConfirmModal.source === 'unified130' ? ' من ملفات الـ 130 الموحدة' : ' من ملفات المسار'}
            </p>
            <p className="delete-confirm-question">
              هل تريد أيضاً حذف هذه الملفات من حسابات جميع الطلاب؟
            </p>

            <div className="delete-confirm-buttons">
              <button
                className="delete-btn-both"
                onClick={() => executeDelete(true)}
                disabled={isRemovingFromUsers}
              >
                <Trash2 size={18} />
                <div>
                  <strong>حذف من الكل</strong>
                  <span>حذف الملفات + إزالتها من حسابات الطلاب</span>
                </div>
              </button>

              <button
                className="delete-btn-server-only"
                onClick={() => executeDelete(false)}
                disabled={isRemovingFromUsers}
              >
                <X size={18} />
                <div>
                  <strong>حذف من السيرفر فقط</strong>
                  <span>حذف الملفات بدون إزالتها من حسابات الطلاب</span>
                </div>
              </button>
            </div>

            <button
              className="delete-btn-cancel"
              onClick={() => setDeleteConfirmModal(prev => ({ ...prev, open: false }))}
            >
              إلغاء
            </button>
          </div>
        </div>
  );
};
