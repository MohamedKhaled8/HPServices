import React from 'react';
import { Upload, Folder, Send, Trash2, RotateCcw, Loader2 } from 'lucide-react';
import { TrackKey } from '../../../../../services/firebaseService';
import { UploadFolderButton } from '../../common/UploadFolderButton';
import { LoadingState } from '../../../../../components/common/LoadingState';
import { UploadSnackbar } from '../../../../../components/common/UploadSnackbar';

interface TrackFilesActionsProps {
  openedTrack: TrackKey;
  newTrackFolderName: string;
  setNewTrackFolderName: React.Dispatch<React.SetStateAction<string>>;
  isUploadingAssignments: Record<TrackKey, boolean>;
  uploadProgress: Record<TrackKey, { current: number; total: number }>;
  isDistributingAssignments: boolean;
  isDeletingAssignments: Record<TrackKey, boolean>;
  hasSelectionOrVisible: boolean;
  hasSelectedFiles: boolean;
  onFileUpload: (track: TrackKey, files: File[]) => void;
  onFolderUpload?: (track: TrackKey, files: File[]) => void;
  onCreateFolder: (track: TrackKey) => void;
  onOpenSendModal: () => void;
  onDeleteSelected: (track: TrackKey) => void;
  onOpenRecallModal: (track: TrackKey) => void;
}

export const TrackFilesActions: React.FC<TrackFilesActionsProps> = ({
  openedTrack,
  newTrackFolderName,
  setNewTrackFolderName,
  isUploadingAssignments,
  uploadProgress,
  isDistributingAssignments,
  isDeletingAssignments,
  hasSelectionOrVisible,
  hasSelectedFiles,
  onFileUpload,
  onFolderUpload,
  onCreateFolder,
  onOpenSendModal,
  onDeleteSelected,
  onOpenRecallModal,
}) => {
  const isUploading = !!isUploadingAssignments[openedTrack];
  const progress = uploadProgress[openedTrack];
  const progressText = progress?.total > 0 ? `(${progress.current}/${progress.total})` : undefined;

  return (
    <div className="track-files-actions">
      {/* 1. زر الرفع المباشر اليدوي للملفات */}
      <input
        type="file"
        id={`upload-input-${openedTrack}`}
        style={{ display: 'none' }}
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFileUpload(openedTrack, Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />
      <button
        type="button"
        className="track-action-btn btn-upload"
        onClick={() => document.getElementById(`upload-input-${openedTrack}`)?.click()}
      >
        <Upload size={16} />
        <span>رفع ملفات</span>
      </button>

      <UploadSnackbar
        isVisible={isUploading}
        variant="Drive"
        label={`جاري رفع الملفات...${progressText ? ` ${progressText}` : ''}`}
      />

      {/* 2. زر رفع فولدر كامل بالـ OS Folder Picker */}
      {onFolderUpload && (
        <UploadFolderButton
          onFolderSelected={(files) => onFolderUpload(openedTrack, files)}
        />
      )}

      {/* 3. وحدة إنشاء مجلد يدوي مدمجة */}
      <div className="create-folder-combo">
        <input
          type="text"
          value={newTrackFolderName}
          onChange={(e) => setNewTrackFolderName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onCreateFolder(openedTrack);
          }}
          placeholder="اسم مجلد جديد..."
          className="create-folder-input"
        />
        <button
          type="button"
          className="create-folder-btn"
          onClick={() => onCreateFolder(openedTrack)}
          title="إنشاء المجلد"
        >
          <Folder size={15} />
          <span>إنشاء مجلد</span>
        </button>
      </div>

      {/* 4. زر الإرسال للطلاب */}
      <button
        type="button"
        className="track-action-btn btn-send"
        disabled={isDistributingAssignments || !hasSelectionOrVisible}
        onClick={onOpenSendModal}
      >
        <Send size={15} />
        <span>إرسال للطلاب</span>
      </button>

      {isDistributingAssignments && (
        <div className="track-upload-status-badge">
          <LoadingState variant="Dots" label="جاري التوزيع..." />
        </div>
      )}

      {/* 5. زر مسح المحدد */}
      <button
        type="button"
        className="track-action-btn btn-delete"
        disabled={isDeletingAssignments[openedTrack] || !hasSelectedFiles}
        onClick={() => onDeleteSelected(openedTrack)}
      >
        {isDeletingAssignments[openedTrack] ? (
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

      {/* 6. زر سحب الملفات */}
      <button
        type="button"
        className="track-action-btn btn-recall"
        onClick={() => onOpenRecallModal(openedTrack)}
        title="سحب الملفات والمجلدات التي تم إرسالها للطلاب في هذا المسار"
      >
        <RotateCcw size={15} />
        <span>سحب الملفات</span>
      </button>
    </div>
  );
};
