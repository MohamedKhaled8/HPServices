import React, { useState } from 'react';
import { X, RotateCcw, Loader2, Pencil } from 'lucide-react';
import { TrackKey, AssignmentFolderMeta } from '../../../../../services/firebaseService';

interface TrackFolderRowFileItem {
  id: string;
  name?: string;
  folderPath?: string;
}

interface TrackFolderRowProps {
  openedTrack: TrackKey;
  folder: AssignmentFolderMeta;
  filesInFolder: TrackFolderRowFileItem[];
  isFolderChecked: boolean;
  deletingThis?: boolean;
  deletingFolderPaths?: Set<string>;
  folderDeleteLoading?: { scope: 'track' | 'unified130'; track?: TrackKey; folderPath: string } | null;
  isDeletingTrack?: boolean;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  setSelectedFolderPaths?: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  onNavigateToFolder?: (folderPath: string) => void;
  onOpenFolder?: (folderPath: string) => void;
  onDeleteFolder: (track: TrackKey, folderPath: string) => void;
  onRevokeFolder?: (track: TrackKey, folderPath: string) => void;
  onRenameFolder?: (track: TrackKey, folder: AssignmentFolderMeta, newName: string) => Promise<boolean>;
  renamingFolderPaths?: Set<string>;
  aggregateCounts?: { subfoldersCount: number; totalFilesCount: number; isParent: boolean };
}

export const TrackFolderRow: React.FC<TrackFolderRowProps> = ({
  openedTrack, folder, filesInFolder, isFolderChecked, deletingThis = false, deletingFolderPaths,
  setSelectedFileIds, setSelectedFolderPaths, onNavigateToFolder, onOpenFolder, onDeleteFolder,
  onRevokeFolder, onRenameFolder, renamingFolderPaths, aggregateCounts,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(folder.name);
  const [validationError, setValidationError] = useState<string | null>(null);

  const isParent = Boolean(folder.isParentFolder || (typeof folder.subfoldersCount === 'number' && folder.subfoldersCount > 0) || aggregateCounts?.isParent);
  const subCount = aggregateCounts?.subfoldersCount ?? folder.subfoldersCount ?? 0;
  const fileCount = aggregateCounts?.totalFilesCount ?? filesInFolder.length ?? folder.totalFilesCount ?? 0;

  const handleOpen = onOpenFolder || onNavigateToFolder;
  const isDeletingThis = Boolean(deletingThis || deletingFolderPaths?.has(folder.path));
  const isRenamingThis = Boolean(renamingFolderPaths?.has(folder.path));

  const handleSubmitRename = async () => {
    const trimmed = editName.trim();
    if (!trimmed) { setValidationError('اسم المجلد لا يمكن أن يكون فارغاً'); return; }
    if (trimmed.includes('/') || trimmed.includes('\\')) { setValidationError('اسم المجلد لا يمكن أن يحتوي على رموز مسارات (/ أو \\)'); return; }
    if (trimmed === folder.name.trim()) { setValidationError('لم يتم تغيير اسم المجلد'); return; }
    if (onRenameFolder) {
      const ok = await onRenameFolder(openedTrack, folder, trimmed);
      if (ok) { setIsEditing(false); setValidationError(null); }
    }
  };

  return (
    <tr key={`folder-${folder.id}`} style={{ opacity: isDeletingThis ? 0.5 : (isRenamingThis ? 0.65 : 1), transition: 'opacity 0.2s ease' }}>
      <td>
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={isFolderChecked}
            disabled={isDeletingThis || isRenamingThis}
            onChange={(e) => {
              const checked = e.target.checked;
              setSelectedFolderPaths?.((prev) => {
                const next = new Set(prev[openedTrack] || []);
                if (checked) next.add(folder.path); else next.delete(folder.path);
                return { ...prev, [openedTrack]: next };
              });
              setSelectedFileIds((prev) => {
                const allIds = new Set(prev[openedTrack] || []);
                if (checked) filesInFolder.forEach((f) => allIds.add(f.id));
                else filesInFolder.forEach((f) => allIds.delete(f.id));
                return { ...prev, [openedTrack]: allIds };
              });
            }}
          />
          <span className="checkbox-custom" />
        </label>
      </td>
      <td>
        {isEditing ? (
          <div style={{ display: 'inline-flex', flexDirection: 'column', gap: '3px' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <input
                type="text"
                value={editName}
                autoFocus
                dir="rtl"
                disabled={isRenamingThis}
                placeholder="اسم المجلد الجديد"
                onChange={(e) => { setEditName(e.target.value); setValidationError(null); }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); void handleSubmitRename(); }
                  else if (e.key === 'Escape') { e.preventDefault(); setIsEditing(false); setEditName(folder.name); setValidationError(null); }
                }}
                style={{ padding: '3px 8px', fontSize: '13px', borderRadius: '6px', border: validationError ? '1px solid #ef4444' : '1px solid #cbd5e1', outline: 'none', minWidth: '160px' }}
              />
              <button
                type="button"
                disabled={isRenamingThis}
                onClick={(e) => { e.stopPropagation(); void handleSubmitRename(); }}
                style={{ padding: '3px 9px', fontSize: '12px', fontWeight: 600, background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', cursor: isRenamingThis ? 'not-allowed' : 'pointer' }}
              >
                {isRenamingThis ? <Loader2 size={13} className="spinning-loader-small" /> : 'حفظ'}
              </button>
              <button
                type="button"
                disabled={isRenamingThis}
                onClick={(e) => { e.stopPropagation(); setIsEditing(false); setEditName(folder.name); setValidationError(null); }}
                style={{ padding: '3px 7px', fontSize: '12px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '6px', cursor: 'pointer' }}
              >
                إلغاء
              </button>
            </div>
            {validationError && <span style={{ color: '#ef4444', fontSize: '11px', textAlign: 'right' }}>{validationError}</span>}
          </div>
        ) : (
          <button
            type="button"
            disabled={isDeletingThis || isRenamingThis}
            onClick={(e) => { e.stopPropagation(); if (!isDeletingThis && !isRenamingThis && handleOpen) handleOpen(folder.path); }}
            style={{ border: 'none', background: 'none', cursor: isDeletingThis || isRenamingThis ? 'not-allowed' : 'pointer', color: '#2563eb', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '8px' }}
          >
            <span>📁 {folder.name}</span>
            <span style={{ fontSize: '11px', fontWeight: 500, color: isParent ? '#1d4ed8' : '#64748b', background: isParent ? '#eff6ff' : '#f1f5f9', padding: '2px 8px', borderRadius: '999px', border: isParent ? '1px solid #bfdbfe' : '1px solid #e2e8f0' }}>
              {isParent ? `${subCount > 0 ? `${subCount} مجلدات • ` : ''}${fileCount} ملف` : `${fileCount} ملف`}
            </span>
          </button>
        )}
      </td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {onRenameFolder && (
            <button
              type="button"
              className="icon-button rename"
              disabled={isDeletingThis || isRenamingThis}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (!isDeletingThis && !isRenamingThis) { setIsEditing((prev) => !prev); setEditName(folder.name); setValidationError(null); }
              }}
              title="إعادة تسمية المجلد"
            >
              {isRenamingThis ? <Loader2 size={16} className="spinning-loader-small" /> : <Pencil size={16} />}
            </button>
          )}
          {onRevokeFolder && (
            <button
              type="button"
              className="icon-button revoke"
              disabled={isDeletingThis || isRenamingThis}
              onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isDeletingThis && !isRenamingThis) onRevokeFolder(openedTrack, folder.path); }}
              title="سحب محتويات هذا المجلد من الطلاب (مع إبقائه في الداش بورد)"
            >
              <RotateCcw size={16} />
            </button>
          )}
          <button
            type="button"
            className="icon-button delete"
            disabled={isDeletingThis || isRenamingThis}
            onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!isDeletingThis && !isRenamingThis) onDeleteFolder(openedTrack, folder.path); }}
            title="حذف المجلد نهائياً"
          >
            {isDeletingThis ? <Loader2 size={16} className="spinning-loader-small" /> : <X size={16} />}
          </button>
        </div>
      </td>
    </tr>
  );
};
