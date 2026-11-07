import React from 'react';
import { X, CheckCircle, XCircle, Bell } from 'lucide-react';

export interface AdminAlertConfig {
  isOpen: boolean;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  onConfirm?: () => void;
  confirmLabel?: string;
}

interface AdminAlertModalProps {
  config: AdminAlertConfig;
  onClose: () => void;
}

export const AdminAlertModal: React.FC<AdminAlertModalProps> = ({ config, onClose }) => {
  if (!config.isOpen) return null;

  return (
    <div
      className="request-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '16px'
      }}
      onClick={onClose}
    >
      <div
        className="request-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '380px',
          height: 'auto',
          borderRadius: '16px',
          background: '#ffffff',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          overflow: 'hidden',
          border: '1px solid var(--border-color, #e2e8f0)'
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            background:
              config.type === 'error'
                ? '#fef2f2'
                : config.type === 'success'
                ? '#f0fdf4'
                : '#f8fafc',
            borderBottom: '1px solid var(--border-color, #f1f5f9)'
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 700,
              color:
                config.type === 'error'
                  ? '#dc2626'
                  : config.type === 'success'
                  ? '#16a34a'
                  : '#1e293b',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {config.type === 'success' && <CheckCircle size={18} color="#16a34a" />}
            {config.type === 'error' && <XCircle size={18} color="#dc2626" />}
            {config.type === 'info' && <Bell size={18} color="#4f46e5" />}
            {config.type === 'warning' && <Bell size={18} color="#d97706" />}
            {config.title ||
              (config.type === 'error'
                ? 'تنبيه'
                : config.type === 'success'
                ? 'تم بنجاح'
                : 'إشعار')}
          </h3>

          <button
            type="button"
            onClick={onClose}
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '8px',
              border: 'none',
              background: 'rgba(0, 0, 0, 0.05)',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 18px', textAlign: 'center' }}>
          <p
            style={{
              fontSize: '14px',
              color: '#334155',
              fontWeight: 600,
              lineHeight: '1.6',
              margin: 0,
              whiteSpace: 'pre-wrap'
            }}
          >
            {config.message}
          </p>
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 18px',
            background: '#f8fafc',
            borderTop: '1px solid var(--border-color, #f1f5f9)'
          }}
        >
          {config.onConfirm ? (
            <>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '8px 16px',
                  background: '#ffffff',
                  color: '#64748b',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                تراجع
              </button>
              <button
                type="button"
                onClick={() => {
                  config.onConfirm?.();
                  onClose();
                }}
                style={{
                  padding: '8px 20px',
                  background: config.type === 'error' ? '#ef4444' : '#4f46e5',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.1)'
                }}
              >
                {config.confirmLabel || 'تأكيد'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: '8px 24px',
                background:
                  config.type === 'error'
                    ? '#ef4444'
                    : 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: '13.5px',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                transition: 'all 0.15s ease'
              }}
            >
              حسناً
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminAlertModal;

