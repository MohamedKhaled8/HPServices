import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { AssignedFile } from '../../../types';

export interface AssignedFilesViewerModalProps {
  isOpen: boolean;
  studentName: string;
  files: AssignedFile[];
  onClose: () => void;
}

const AssignedFilesViewerModal: React.FC<AssignedFilesViewerModalProps> = ({
  isOpen,
  studentName,
  files,
  onClose
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10002,
        background: 'rgba(15, 23, 42, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box'
      }}
      onClick={onClose}
      role="dialog"
      aria-label="الملفات المُرسلة للطالب"
    >
      <div
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '480px',
          width: '100%',
          maxHeight: '85vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          padding: '20px',
          direction: 'rtl'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>
            تكليفات مُرسلة لـ: {studentName}
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>
        {files.length === 0 ? (
          <p style={{ color: '#64748b', margin: 0 }}>لا توجد ملفات مُرسلة لهذا الطالب.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {files.map((file, i) => (
              <li
                key={file.id || i}
                style={{
                  padding: '12px 14px',
                  background: '#f8fafc',
                  borderRadius: '10px',
                  border: '1px solid #e2e8f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '10px'
                }}
              >
                <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '14px' }}>
                  {file.customName || file.name}
                </span>
                <a
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  style={{
                    padding: '6px 12px',
                    background: '#2563eb',
                    color: '#fff',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontSize: '13px',
                    fontWeight: 600
                  }}
                >
                  تحميل
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body
  );
};

export default AssignedFilesViewerModal;

