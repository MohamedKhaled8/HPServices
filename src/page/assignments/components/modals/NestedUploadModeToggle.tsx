import React from 'react';
import { Layers, FolderTree, Folder } from 'lucide-react';
import { UploadStrategy } from '../../types/backgroundUpload.types';

interface NestedUploadModeToggleProps {
  uploadStrategy: UploadStrategy;
  setUploadStrategy: (strategy: UploadStrategy) => void;
  parentFolderName: string;
  setParentFolderName: (name: string) => void;
  subfolderCount: number;
}

export const NestedUploadModeToggle: React.FC<NestedUploadModeToggleProps> = ({
  uploadStrategy,
  setUploadStrategy,
  parentFolderName,
  setParentFolderName,
  subfolderCount,
}) => {
  return (
    <div className="nested-upload-mode-container" style={{ marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div className="nested-mode-toggle-group" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        <button
          type="button"
          className={`nested-mode-btn ${uploadStrategy === 'extract-subfolders' ? 'active' : ''}`}
          onClick={() => setUploadStrategy('extract-subfolders')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: uploadStrategy === 'extract-subfolders' ? '2px solid #2563eb' : '1px solid #d1d5db',
            background: uploadStrategy === 'extract-subfolders' ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            color: uploadStrategy === 'extract-subfolders' ? '#1d4ed8' : '#374151',
          }}
        >
          <Layers size={18} />
          <span>استخراج المجلدات الفرعية مباشرة</span>
        </button>

        <button
          type="button"
          className={`nested-mode-btn ${uploadStrategy === 'keep-parent' ? 'active' : ''}`}
          onClick={() => setUploadStrategy('keep-parent')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '10px 12px',
            borderRadius: '8px',
            border: uploadStrategy === 'keep-parent' ? '2px solid #2563eb' : '1px solid #d1d5db',
            background: uploadStrategy === 'keep-parent' ? '#eff6ff' : '#ffffff',
            cursor: 'pointer',
            fontWeight: 600,
            fontSize: '13px',
            color: uploadStrategy === 'keep-parent' ? '#1d4ed8' : '#374151',
          }}
        >
          <FolderTree size={18} />
          <span>الاحتفاظ بالمجلد الرئيسي (متداخل)</span>
        </button>
      </div>

      {uploadStrategy === 'keep-parent' && (
        <div className="nested-parent-name-box" style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
          <label htmlFor="nested-parent-name-input" style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
            اسم المجلد الرئيسي الحاضن:
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Folder size={18} color="#2563eb" />
            <input
              id="nested-parent-name-input"
              type="text"
              value={parentFolderName}
              onChange={(e) => setParentFolderName(e.target.value)}
              placeholder="أدخل اسم المجلد الرئيسي..."
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                fontSize: '13px',
              }}
            />
          </div>
          <p style={{ margin: '6px 0 0', fontSize: '12px', color: '#64748b' }}>
            سيتم إنشاء المجلد <strong>&quot;{parentFolderName || 'مجلد رئيسي'}&quot;</strong> وتضمين <strong>{subfolderCount}</strong> مجلدات فرعية بداخله.
          </p>
        </div>
      )}
    </div>
  );
};
