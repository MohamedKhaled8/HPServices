import React from 'react';
import { FolderUp, Folder, Trash2, X, AlertCircle } from 'lucide-react';
import { formatFileSize, computeTotalFilesSize } from '../../utils/folderUploadUtils';
import { FolderUploadGroup } from '../../utils/folderHierarchyParser';
import { NestedFolderPreviewList } from './NestedFolderPreviewList';

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
  mode?: 'single' | 'nested';
  groups?: FolderUploadGroup[];
  onUpdateGroupName?: (index: number, newName: string) => void;
  onRemoveGroup?: (index: number) => void;
  onRemoveFileFromGroup?: (groupIndex: number, fileIndex: number) => void;
}

export const FolderUploadPreviewModal: React.FC<FolderUploadPreviewModalProps> = ({
  isOpen,
  folderName,
  setFolderName,
  files,
  invalidCount = 0,
  isUploading,
  onRemoveFile,
  onConfirmUpload,
  onClose,
  mode = 'single',
  groups = [],
  onUpdateGroupName = () => {},
  onRemoveGroup = () => {},
  onRemoveFileFromGroup = () => {},
}) => {
  if (!isOpen) return null;

  const isNested = mode === 'nested';
  const totalNestedFiles = groups.reduce((acc, g) => acc + g.files.length, 0);
  const totalFiles = isNested ? totalNestedFiles : files.length;
  const isSubmitDisabled =
    isUploading ||
    totalFiles === 0 ||
    (isNested ? groups.length === 0 : !folderName.trim());

  return (
    <div className="folder-preview-overlay" onClick={() => !isUploading && onClose()}>
      <div className="folder-preview-modal" onClick={(e) => e.stopPropagation()}>
        <div className="folder-preview-header">
          <div className="folder-preview-title-wrap">
            <div className="folder-preview-icon-badge">
              <FolderUp size={22} />
            </div>
            <div>
              <h3>{isNested ? 'معاينة رفع المجلدات المتعددة' : 'معاينة رفع المجلد'}</h3>
              <p>
                {isNested
                  ? 'راجع المجلدات الفرعية وعدّل أسماءها قبل إتمام الرفع'
                  : 'راجع محتويات المجلد وعدّل اسمه قبل إتمام الرفع'}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="folder-preview-close-btn"
            onClick={onClose}
            disabled={isUploading}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>

        {isNested ? (
          <NestedFolderPreviewList
            groups={groups}
            excludedCount={invalidCount}
            onUpdateGroupName={onUpdateGroupName}
            onRemoveGroup={onRemoveGroup}
            onRemoveFileFromGroup={onRemoveFileFromGroup}
            disabled={isUploading}
          />
        ) : (
          <>
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

            <div className="folder-preview-stats">
              <span className="preview-stat-badge count">
                عدد الملفات: <strong>{files.length}</strong>
              </span>
              <span className="preview-stat-badge size">
                الحجم الإجمالي: <strong>{formatFileSize(computeTotalFilesSize(files))}</strong>
              </span>
              {invalidCount > 0 && (
                <span className="preview-stat-badge warning">
                  <AlertCircle size={14} /> تم استبعاد {invalidCount} ملف غير مدعوم
                </span>
              )}
            </div>

            <div className="folder-preview-list-section">
              <div className="folder-preview-list-header">الملفات المختارة للرفع:</div>
              <div className="folder-preview-files-list">
                {files.map((file, idx) => {
                  const isPdf = file.name.toLowerCase().endsWith('.pdf');
                  return (
                    <div key={`${file.name}-${idx}`} className="folder-preview-file-item">
                      <span className={`file-badge ${isPdf ? 'pdf' : 'img'}`}>
                        {isPdf ? 'PDF' : 'IMG'}
                      </span>
                      <span className="file-name" title={file.name} dir="auto">
                        {file.name}
                      </span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      <button
                        type="button"
                        className="file-remove-btn"
                        disabled={isUploading}
                        onClick={() => onRemoveFile(idx)}
                        title="استبعاد هذا الملف من الرفع"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

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
            <span>
              {isNested
                ? `رفع الكل (${totalFiles} ملف في ${groups.length} مجلدات)`
                : `تأكيد الرفع (${files.length} ملف)`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
