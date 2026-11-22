import React from 'react';
import { FolderUp, Folder, Trash2, X, AlertCircle } from 'lucide-react';
import { formatFileSize, computeTotalFilesSize } from '../../utils/folderUploadUtils';
import { UploadSnackbar } from '../../../../components/common/UploadSnackbar';

export interface FolderUploadPreviewModalProps {
  isOpen: boolean;
  folderName: string;
  setFolderName: (name: string) => void;
  files: File[];
  invalidCount?: number;
  isUploading: boolean;
  uploadProgress?: { current: number; total: number };
  onRemoveFile: (index: number) => void;
  onConfirmUpload: () => void;
  onClose: () => void;
}

export const FolderUploadPreviewModal: React.FC<FolderUploadPreviewModalProps> = ({
  isOpen,
  folderName,
  setFolderName,
  files,
  invalidCount = 0,
  isUploading,
  uploadProgress,
  onRemoveFile,
  onConfirmUpload,
  onClose,
}) => {
  if (!isOpen) return null;

  const totalSize = computeTotalFilesSize(files);
  const isSubmitDisabled = isUploading || files.length === 0 || !folderName.trim();
  const progressText =
    uploadProgress && uploadProgress.total > 0
      ? `(${uploadProgress.current}/${uploadProgress.total})`
      : '';

  return (
    <div className="folder-preview-overlay" onClick={() => !isUploading && onClose()}>
      <div className="folder-preview-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="folder-preview-header">
          <div className="folder-preview-title-wrap">
            <div className="folder-preview-icon-badge">
              <FolderUp size={22} />
            </div>
            <div>
              <h3>معاينة رفع المجلد</h3>
              <p>راجع محتويات المجلد وعدّل اسمه قبل إتمام الرفع</p>
            </div>
          </div>
          <button
            type="button"
            className="folder-preview-close-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onClose();
            }}
            disabled={isUploading}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {/* Folder Name Input */}
        <div className="folder-preview-field">
          <label htmlFor="folder-name-input">اسم المجلد (التكليف)</label>
          <div className="folder-name-input-wrapper">
            <Folder size={18} className="folder-input-icon" />
            <input
              id="folder-name-input"
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              disabled={isUploading}
              placeholder="أدخل اسم المجلد..."
              className="folder-name-input"
              autoFocus
            />
          </div>
        </div>

        {/* Summary Badges */}
        <div className="folder-preview-stats">
          <span className="preview-stat-badge count">
            عدد الملفات: <strong>{files.length}</strong>
          </span>
          <span className="preview-stat-badge size">
            الحجم الإجمالي: <strong>{formatFileSize(totalSize)}</strong>
          </span>
          {invalidCount > 0 && (
            <span className="preview-stat-badge warning">
              <AlertCircle size={14} /> تم استبعاد {invalidCount} ملف غير مدعوم
            </span>
          )}
        </div>

        {/* Files List */}
        <div className="folder-preview-list-section">
          <div className="folder-preview-list-header">الملفات المختارة للرفع:</div>
          <div className="folder-preview-files-list">
            {files.length === 0 ? (
              <div className="folder-preview-empty">
                <AlertCircle size={28} />
                <p>تم استبعاد كافة الملفات أو لا توجد ملفات صالحة في هذا المجلد.</p>
              </div>
            ) : (
              files.map((file, idx) => {
                const isPdf = file.name.toLowerCase().endsWith('.pdf');
                return (
                  <div key={`${file.name}-${idx}`} className="folder-preview-file-item">
                    <span className={`file-badge ${isPdf ? 'pdf' : 'img'}`}>
                      {isPdf ? 'PDF' : 'IMG'}
                    </span>
                    <span className="file-name" title={file.name}>
                      {file.name}
                    </span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                    <button
                      type="button"
                      className="file-remove-btn"
                      disabled={isUploading}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRemoveFile(idx);
                      }}
                      title="استبعاد هذا الملف من الرفع"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="folder-preview-actions">
          <button
            type="button"
            className="folder-preview-btn cancel"
            onClick={onClose}
            disabled={isUploading}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="folder-preview-btn confirm"
            onClick={onConfirmUpload}
            disabled={isSubmitDisabled}
          >
            <FolderUp size={16} />
            <span>تأكيد الرفع ({files.length} ملف)</span>
          </button>
        </div>
      </div>

      <UploadSnackbar
        isVisible={isUploading}
        variant="Drive"
        label={
          uploadProgress && uploadProgress.total > 0
            ? `جاري رفع الملفات (${uploadProgress.current}/${uploadProgress.total})...`
            : 'جاري رفع الملفات...'
        }
      />
    </div>
  );
};
