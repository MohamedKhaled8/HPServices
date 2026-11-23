import React, { useState } from 'react';
import { Folder, Trash2, ChevronDown, ChevronUp, AlertCircle, FileText } from 'lucide-react';
import { FolderUploadGroup } from '../../utils/folderHierarchyParser';
import { formatFileSize, computeTotalFilesSize } from '../../utils/folderUploadUtils';

export interface NestedFolderPreviewListProps {
  groups: FolderUploadGroup[];
  excludedCount: number;
  onUpdateGroupName: (index: number, newName: string) => void;
  onRemoveGroup: (index: number) => void;
  onRemoveFileFromGroup: (groupIndex: number, fileIndex: number) => void;
  disabled?: boolean;
}

export const NestedFolderPreviewList: React.FC<NestedFolderPreviewListProps> = ({
  groups,
  excludedCount,
  onUpdateGroupName,
  onRemoveGroup,
  onRemoveFileFromGroup,
  disabled = false,
}) => {
  const [expandedIndices, setExpandedIndices] = useState<Record<number, boolean>>({ 0: true });

  const toggleExpand = (idx: number) => {
    setExpandedIndices((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const totalFiles = groups.reduce((acc, g) => acc + g.files.length, 0);
  const totalBytes = groups.reduce((acc, g) => acc + computeTotalFilesSize(g.files), 0);

  return (
    <div className="nested-folder-preview-container">
      <div className="folder-preview-stats">
        <span className="preview-stat-badge count">
          {groups.length} مجلدات فرعية
        </span>
        <span className="preview-stat-badge count">
          إجمالي الملفات: <strong>{totalFiles}</strong>
        </span>
        <span className="preview-stat-badge size">
          الحجم الإجمالي: <strong>{formatFileSize(totalBytes)}</strong>
        </span>
        {excludedCount > 0 && (
          <span className="preview-stat-badge warning">
            <AlertCircle size={14} /> تم استبعاد {excludedCount} ملف غير مدعوم
          </span>
        )}
      </div>

      <div className="nested-groups-scroll-list">
        {groups.map((group, groupIdx) => {
          const isExpanded = !!expandedIndices[groupIdx];
          const groupSize = computeTotalFilesSize(group.files);

          return (
            <div key={`group-${groupIdx}`} className="nested-group-card">
              <div className="nested-group-header">
                <button
                  type="button"
                  className="nested-expand-toggle-btn"
                  onClick={() => toggleExpand(groupIdx)}
                  title={isExpanded ? 'طي المحتويات' : 'عرض المحتويات'}
                >
                  {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>
                <Folder size={18} className="folder-icon-accent" />
                <input
                  type="text"
                  value={group.folderName}
                  onChange={(e) => onUpdateGroupName(groupIdx, e.target.value)}
                  disabled={disabled}
                  className="nested-group-name-input"
                  placeholder="اسم المجلد الفرعي..."
                  dir="auto"
                />
                <span className="nested-group-badge">
                  {group.files.length} ملفات ({formatFileSize(groupSize)})
                </span>
                <button
                  type="button"
                  className="nested-group-remove-btn"
                  onClick={() => onRemoveGroup(groupIdx)}
                  disabled={disabled}
                  title="استبعاد هذا المجلد بالكامل"
                >
                  <Trash2 size={15} />
                </button>
              </div>

              {isExpanded && (
                <div className="nested-group-files-list">
                  {group.files.length === 0 ? (
                    <div className="nested-group-empty-hint">لا توجد ملفات في هذا المجلد.</div>
                  ) : (
                    group.files.map((file, fileIdx) => {
                      const isPdf = file.name.toLowerCase().endsWith('.pdf');
                      return (
                        <div key={`${file.name}-${fileIdx}`} className="folder-preview-file-item">
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
                            disabled={disabled}
                            onClick={() => onRemoveFileFromGroup(groupIdx, fileIdx)}
                            title="استبعاد هذا الملف"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
