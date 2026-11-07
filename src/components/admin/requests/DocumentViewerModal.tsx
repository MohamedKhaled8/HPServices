import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText } from 'lucide-react';

export interface DocumentViewerModalProps {
  isOpen: boolean;
  urls: string[];
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  isOpen,
  urls,
  onClose
}) => {
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setLoadedImages(new Set());
    }
  }, [isOpen]);

  if (!isOpen || urls.length === 0) return null;

  return createPortal(
    <div
      className="document-viewer-overlay"
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
      aria-label="عرض المرفقات"
    >
      <div
        className="document-viewer-sheet"
        style={{
          background: '#fff',
          borderRadius: '16px',
          maxWidth: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)',
          padding: '20px',
          direction: 'rtl'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a' }}>جميع المرفقات</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px',
              border: 'none',
              background: '#f1f5f9',
              borderRadius: '8px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            aria-label="إغلاق"
          >
            <X size={20} />
          </button>
        </div>
        <div
          className="document-viewer-grid"
          style={{ display: 'grid', gap: '16px' }}
        >
          {urls.map((url, i) => {
            const lowerUrl = (url || '').toLowerCase();
            const isPdf =
              lowerUrl.includes('.pdf') ||
              lowerUrl.includes('/raw/upload') ||
              lowerUrl.includes('application/pdf') ||
              (lowerUrl.includes('cloudinary.com') && lowerUrl.endsWith('.pdf'));
            const isImage = !isPdf && /\.(png|jpe?g|webp|gif|bmp)(\?|$)/i.test(url);
            const isImageFallback = !isPdf && !isImage && url.includes('cloudinary.com');
            const showAsImage = isImage || isImageFallback;
            const label = `مرفق ${i + 1}`;
            const loaded = loadedImages.has(i);

            const viewUrl = isPdf
              ? `https://docs.google.com/viewer?url=${encodeURIComponent(url)}&embedded=false`
              : url;

            return (
              <a
                key={url + i}
                href={viewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'block',
                  textDecoration: 'none',
                  color: '#2563eb',
                  background: '#f8fafc',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  border: '1px solid #e2e8f0',
                  minWidth: 160
                }}
              >
                {showAsImage ? (
                  <div
                    style={{
                      position: 'relative',
                      width: '100%',
                      aspectRatio: '1',
                      minHeight: 160,
                      background: '#f1f5f9'
                    }}
                  >
                    <div
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: loaded ? 'transparent' : '#e2e8f0'
                      }}
                    >
                      {!loaded && (
                        <div
                          style={{
                            width: 24,
                            height: 24,
                            border: '2px solid #cbd5e1',
                            borderTopColor: '#2563eb',
                            borderRadius: '50%',
                            animation: 'document-viewer-spin 0.7s linear infinite'
                          }}
                        />
                      )}
                    </div>
                    <img
                      src={url}
                      alt={label}
                      width={160}
                      height={160}
                      loading="eager"
                      onLoad={() => setLoadedImages(prev => new Set(prev).add(i))}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        opacity: loaded ? 1 : 0,
                        transition: 'opacity 0.2s ease-out'
                      }}
                    />
                  </div>
                ) : isPdf ? (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      minHeight: 160,
                      background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    <FileText size={40} color="#dc2626" />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#dc2626', letterSpacing: '1px' }}>PDF</span>
                    <span style={{ fontSize: '10px', color: '#ef4444', opacity: 0.8 }}>اضغط لفتح</span>
                  </div>
                ) : (
                  <div
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      minHeight: 160,
                      background: '#f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <FileText size={32} color="#94a3b8" />
                  </div>
                )}
                <span style={{ display: 'block', padding: '8px', fontSize: '12px', fontWeight: 600 }}>
                  {isPdf ? `📄 ${label}` : label}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DocumentViewerModal;
