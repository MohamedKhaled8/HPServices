import { useState, useCallback } from 'react';
import { TrackKey } from '../../../services/firebaseService';
import {
  extractFolderNameFromFiles,
  filterSupportedAssignmentFiles,
} from '../utils/folderUploadUtils';

interface UseFolderUploadPreviewOptions {
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useFolderUploadPreview = ({
  showSnackbarNotification,
}: UseFolderUploadPreviewOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<'track' | 'unified130'>('track');
  const [track, setTrack] = useState<TrackKey | undefined>(undefined);
  const [folderName, setFolderName] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [invalidCount, setInvalidCount] = useState(0);

  const openPreview = useCallback(
    (targetScope: 'track' | 'unified130', rawFiles: File[], targetTrack?: TrackKey) => {
      if (!rawFiles || rawFiles.length === 0) {
        showSnackbarNotification('المجلد المختار فارغ ولا يحتوي على أي ملفات', 'error');
        return;
      }

      const initialName = extractFolderNameFromFiles(rawFiles);
      const { validFiles, invalidCount: rejectedCount } = filterSupportedAssignmentFiles(rawFiles);

      if (validFiles.length === 0) {
        showSnackbarNotification(
          'المجلد لا يحتوي على أي ملفات مدعومة (الصيغ المدعومة: PDF والصور)',
          'error'
        );
        return;
      }

      setScope(targetScope);
      setTrack(targetTrack);
      setFolderName(initialName);
      setFiles(validFiles);
      setInvalidCount(rejectedCount);
      setIsOpen(true);
    },
    [showSnackbarNotification]
  );

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setFolderName('');
    setFiles([]);
    setInvalidCount(0);
    setTrack(undefined);
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleConfirm = useCallback(
    async (
      onConfirm: (
        scope: 'track' | 'unified130',
        confirmedName: string,
        confirmedFiles: File[],
        track?: TrackKey
      ) => Promise<boolean>
    ) => {
      const cleanName = folderName.trim();
      if (!cleanName) {
        showSnackbarNotification('يرجى إدخال اسم صالح للمجلد', 'error');
        return;
      }

      if (files.length === 0) {
        showSnackbarNotification('لا توجد ملفات صالحة داخل المجلد للرفع', 'error');
        return;
      }

      const success = await onConfirm(scope, cleanName, files, track);
      if (success) {
        closePreview();
      }
    },
    [folderName, files, scope, track, closePreview, showSnackbarNotification]
  );

  return {
    isOpen,
    scope,
    track,
    folderName,
    setFolderName,
    files,
    invalidCount,
    openPreview,
    closePreview,
    handleRemoveFile,
    handleConfirm,
  };
};
