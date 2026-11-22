import React from 'react';
import { Upload, Folder, Send, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { UploadFolderButton } from '../../common/UploadFolderButton';
import { LoadingState } from '../../../../../components/common/LoadingState';
import { UploadSnackbar } from '../../../../../components/common/UploadSnackbar';

interface Unified130ActionsProps {
  newUnified130FolderName: string;
  setNewUnified130FolderName: React.Dispatch<React.SetStateAction<string>>;
  isUploading130: boolean;
  isDistributing130: boolean;
  isDeleting130: boolean;
  hasSelectionOrVisible: boolean;
  hasSelectedFiles: boolean;
  onFileUpload: (file: File) => void;
  onFolderUpload?: (files: File[]) => void;
  onCreateFolder: () => void;
  onDistribute: () => void;
  onDeleteSelected: () => void;
  onOpenRecallModal: () => void;
}

export const Unified130Actions: React.FC<Unified130ActionsProps> = ({
  newUnified130FolderName,
  setNewUnified130FolderName,
  isUploading130,
  isDistributing130,
  isDeleting130,
  hasSelectionOrVisible,
  hasSelectedFiles,
  onFileUpload,
  onFolderUpload,
  onCreateFolder,
  onDistribute,
  onDeleteSelected,
  onOpenRecallModal,
}) => {
  return (
    <div className="track-files-actions">
      {/* 1. زر الرفع اليدوي لملف واحد */}
      <input
        type="file"
        id="upload-input-130"
        style={{ display: 'none' }}
        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
        disabled={isUploading130}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFileUpload(e.target.files[0]);
            e.target.value = '';
          }
        }}
      />
      <button
        type="button"
        className="track-action-btn btn-upload"
        onClick={() => document.getElementById('upload-input-130')?.click()}
        disabled={isUploading130}
      >
        <Upload size={16} />
        <span>رفع ملف</span>
      </button>

      <UploadSnackbar
        isVisible={isUploading130}
        variant="Drive"
        label="جاري رفع الملف..."
      />

      {/* 2. زر رفع فولدر كامل */}
      {onFolderUpload && (
        <UploadFolderButton
          disabled={isUploading130 || isDeleting130}
          isLoading={isUploading130}
          onFolderSelected={onFolderUpload}
        />
      )}

      {/* 3. إنشاء مجلد يدوي */}
      <div className="create-folder-combo">
        <input
          type="text"
          value={newUnified130FolderName}
          onChange={(e) => setNewUnified130FolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreateFolder();
          }}
          placeholder="اسم مجلد جديد..."
          className="create-folder-input"
        />
        <button
          type="button"
          className="create-folder-btn"
          onClick={onCreateFolder}
          title="إنشاء المجلد"
        >
          <Folder size={15} />
          <span>إنشاء مجلد</span>
        </button>
      </div>

      {/* 4. زر التوزيع */}
      <button
        type="button"
        className="track-action-btn btn-send"
        disabled={isDistributing130 || !hasSelectionOrVisible}
        onClick={onDistribute}
      >
        <Send size={15} />
        <span>إرسال للطلاب</span>
      </button>

      {isDistributing130 && (
        <div className="track-upload-status-badge">
          <LoadingState variant="Dots" label="جاري التوزيع..." />
        </div>
      )}

      {/* 5. زر حذف المحدد */}
      <button
        type="button"
        className="track-action-btn btn-delete"
        disabled={isDeleting130 || !hasSelectedFiles}
        onClick={onDeleteSelected}
      >
        {isDeleting130 ? (
          <>
            <Loader2 className="spinning-loader-small" size={16} />
            <span>جاري المسح...</span>
          </>
        ) : (
          <>
            <Trash2 size={15} />
            <span>مسح المحدد</span>
          </>
        )}
      </button>

      {/* 6. زر استرجاع الملفات */}
      <button
        type="button"
        className="track-action-btn btn-recall"
        onClick={onOpenRecallModal}
        title="سحب الملفات والمجلدات التي تم إرسالها لطلاب باقة 130"
      >
        <RotateCcw size={15} />
        <span>سحب الملفات</span>
      </button>
    </div>
  );
};
