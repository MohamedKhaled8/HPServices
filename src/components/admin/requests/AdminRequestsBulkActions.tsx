import React from 'react';
import {
  CheckSquare,
  X,
  Loader2,
  CheckCircle,
  Clock,
  Send,
  FileText,
  XCircle,
  Download,
  Trash2
} from 'lucide-react';
import type { ServiceRequest, ServiceRequestWorkflowStatus } from '../../../types';

export interface AdminRequestsBulkActionsProps {
  selectedCount: number;
  isBulkProcessingRequests: boolean;
  bulkActionProgress: { current: number; total: number; label: string } | null;
  handleDeselectAll: () => void;
  handleBulkStatusChange: (status: ServiceRequestWorkflowStatus, reqs: ServiceRequest[]) => void;
  handleBulkDownloadZip: (reqs: ServiceRequest[]) => void;
  handleBulkDelete: (reqs: ServiceRequest[]) => void;
  selectedReqsList: ServiceRequest[];
}

export const AdminRequestsBulkActions: React.FC<AdminRequestsBulkActionsProps> = ({
  selectedCount,
  isBulkProcessingRequests,
  bulkActionProgress,
  handleDeselectAll,
  handleBulkStatusChange,
  handleBulkDownloadZip,
  handleBulkDelete,
  selectedReqsList
}) => {
  if (selectedCount === 0) return null;

  return (
    <div
      className="bulk-actions-floating-bar"
      style={{
        position: 'fixed',
        bottom: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        width: 'calc(100% - 32px)',
        maxWidth: '1150px',
        background: 'rgba(255, 255, 255, 0.98)',
        backdropFilter: 'blur(16px)',
        border: '1.5px solid #3b82f6',
        borderRadius: '16px',
        boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25), 0 0 25px rgba(59, 130, 246, 0.25)',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        flexWrap: 'wrap',
        direction: 'rtl'
      }}
    >
      {/* جانب العداد والإلغاء */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            background: '#eff6ff',
            color: '#1d4ed8',
            padding: '6px 12px',
            borderRadius: '10px',
            fontWeight: 800,
            fontSize: '14px',
            border: '1px solid #bfdbfe'
          }}
        >
          <CheckSquare size={16} />
          <span>تم تحديد {selectedCount} طلب</span>
        </div>

        <button
          type="button"
          onClick={handleDeselectAll}
          disabled={isBulkProcessingRequests}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isBulkProcessingRequests ? 'not-allowed' : 'pointer',
            padding: '4px 8px',
            borderRadius: '6px'
          }}
          title="إلغاء التحديد"
        >
          <X size={15} />
          <span>إلغاء التحديد</span>
        </button>
      </div>

      {/* مؤشر المعالجة أو أزرار الإجراءات */}
      {isBulkProcessingRequests ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '6px 16px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #cbd5e1'
          }}
        >
          <Loader2 size={18} className="spin-animation" style={{ color: '#2563eb' }} />
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
            {bulkActionProgress?.label || 'جاري معالجة الطلبات المحددة...'}
          </span>
          {bulkActionProgress && (
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                background: '#2563eb',
                color: 'white',
                padding: '2px 8px',
                borderRadius: '20px'
              }}
            >
              {bulkActionProgress.current} / {bulkActionProgress.total}
            </span>
          )}
        </div>
      ) : (
        <div
          className="bulk-actions-buttons-container"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexWrap: 'wrap'
          }}
        >
          {/* زر قبول (مكتمل) */}
          <button
            type="button"
            onClick={() => handleBulkStatusChange('completed', selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#16a34a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(22, 163, 74, 0.3)'
            }}
            title="تغيير حالة الطلبات المحددة إلى مكتمل (قبول)"
          >
            <CheckCircle size={15} />
            <span>قبول (مكتمل)</span>
          </button>

          {/* زر قيد الانتظار */}
          <button
            type="button"
            onClick={() => handleBulkStatusChange('pending', selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#fffbeb',
              color: '#d97706',
              border: '1px solid #fcd34d',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="تغيير حالة الطلبات المحددة إلى قيد الانتظار"
          >
            <Clock size={15} />
            <span>قيد الانتظار</span>
          </button>

          {/* زر تم التقديم */}
          <button
            type="button"
            onClick={() => handleBulkStatusChange('submitted', selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#eff6ff',
              color: '#2563eb',
              border: '1px solid #93c5fd',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="تغيير حالة الطلبات المحددة إلى تم التقديم"
          >
            <Send size={15} />
            <span>تم التقديم</span>
          </button>

          {/* زر تم إرسال الإيصال */}
          <button
            type="button"
            onClick={() => handleBulkStatusChange('receipt_sent', selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #6ee7b7',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="تغيير حالة الطلبات المحددة إلى تم إرسال الإيصال"
          >
            <FileText size={15} />
            <span>تم إرسال الإيصال</span>
          </button>

          {/* زر إلغاء (مرفوض) */}
          <button
            type="button"
            onClick={() => handleBulkStatusChange('rejected', selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#fef2f2',
              color: '#dc2626',
              border: '1px solid #fecaca',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="تغيير حالة الطلبات المحددة إلى مرفوض (إلغاء)"
          >
            <XCircle size={15} />
            <span>إلغاء (مرفوض)</span>
          </button>

          {/* زر تنزيل الصور كملف مضغوط */}
          <button
            type="button"
            onClick={() => handleBulkDownloadZip(selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#faf5ff',
              color: '#7c3aed',
              border: '1px solid #d8b4fe',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="تنزيل إيصالات ومرفقات الطلبات المحددة في ملف ZIP واحد"
          >
            <Download size={15} />
            <span>تنزيل الصور (ZIP)</span>
          </button>

          {/* زر حذف المحدد */}
          <button
            type="button"
            onClick={() => handleBulkDelete(selectedReqsList)}
            className="bulk-action-btn"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              background: '#fff1f2',
              color: '#e11d48',
              border: '1px solid #ffe4e6',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: 700,
              cursor: 'pointer'
            }}
            title="حذف جميع الطلبات المحددة نهائياً"
          >
            <Trash2 size={15} />
            <span>حذف</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default AdminRequestsBulkActions;
