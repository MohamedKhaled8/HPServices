import { useState, useCallback } from 'react';
import { TrackKey } from '../../../services/firebaseService';
import {
  parseFolderHierarchy,
  FolderUploadGroup,
  HierarchyParseResult,
} from '../utils/folderHierarchyParser';

interface UseFolderUploadPreviewOptions {
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useFolderUploadPreview = ({
  showSnackbarNotification,
}: UseFolderUploadPreviewOptions) => {
  const [isOpen, setIsOpen] = useState(false);
  const [scope, setScope] = useState<'track' | 'unified130'>('track');
  const [track, setTrack] = useState<TrackKey | undefined>(undefined);
  const [mode, setMode] = useState<'single' | 'nested'>('single');
  const [groups, setGroups] = useState<FolderUploadGroup[]>([]);
  const [folderName, setFolderName] = useState('');
  const [invalidCount, setInvalidCount] = useState(0);

  const openPreview = useCallback(
    (targetScope: 'track' | 'unified130', rawFiles: File[], targetTrack?: TrackKey) => {
      if (!rawFiles || rawFiles.length === 0) {
        showSnackbarNotification('المجلد المختار فارغ ولا يحتوي على أي ملفات', 'error');
        return;
      }

      const parsed: HierarchyParseResult = parseFolderHierarchy(rawFiles);
      if (parsed.groups.length === 0) {
        showSnackbarNotification(
          'المجلد لا يحتوي على أي ملفات مدعومة (الصيغ المدعومة: PDF والصور)',
          'error'
        );
        return;
      }

      setScope(targetScope);
      setTrack(targetTrack);
      setMode(parsed.mode);
      setGroups(parsed.groups);
      setFolderName(parsed.groups[0]?.folderName || '');
      setInvalidCount(parsed.excludedCount);
      setIsOpen(true);
    },
    [showSnackbarNotification]
  );

  const closePreview = useCallback(() => {
    setIsOpen(false);
    setFolderName('');
    setGroups([]);
    setInvalidCount(0);
    setTrack(undefined);
    setMode('single');
  }, []);

  const updateGroupName = useCallback((index: number, newName: string) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, folderName: newName } : g))
    );
    if (index === 0) setFolderName(newName);
  }, []);

  const removeGroup = useCallback((index: number) => {
    setGroups((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const removeFileFromGroup = useCallback((groupIndex: number, fileIndex: number) => {
    setGroups((prev) =>
      prev
        .map((g, i) => {
          if (i !== groupIndex) return g;
          return { ...g, files: g.files.filter((_, fi) => fi !== fileIndex) };
        })
        .filter((g) => g.files.length > 0)
    );
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    removeFileFromGroup(0, index);
  }, [removeFileFromGroup]);

  const handleConfirm = useCallback(
    (
      onConfirm: (
        scope: 'track' | 'unified130',
        confirmedGroups: FolderUploadGroup[],
        targetTrack?: TrackKey
      ) => void
    ) => {
      const activeGroups = mode === 'single'
        ? [{ folderName: folderName.trim() || 'مجلد جديد', files: groups[0]?.files || [] }]
        : groups;

      const validGroups = activeGroups.filter(
        (g) => g.folderName.trim().length > 0 && g.files.length > 0
      );

      if (validGroups.length === 0) {
        showSnackbarNotification('يرجى التأكد من وجود مجلدات صالحة وغير فارغة للرفع', 'error');
        return;
      }

      // Capture exact targetTrack & scope, pass to background queue, close modal immediately
      onConfirm(scope, validGroups, track);
      closePreview();
    },
    [mode, folderName, groups, scope, track, closePreview, showSnackbarNotification]
  );

  const singleFiles = groups[0]?.files || [];

  return {
    isOpen,
    scope,
    track,
    mode,
    groups,
    folderName,
    setFolderName,
    files: singleFiles,
    invalidCount,
    openPreview,
    closePreview,
    updateGroupName,
    removeGroup,
    removeFileFromGroup,
    handleRemoveFile,
    handleConfirm,
  };
};
