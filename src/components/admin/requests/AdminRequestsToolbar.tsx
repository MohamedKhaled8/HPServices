import React from 'react';
import { FileText, CheckSquare, X } from 'lucide-react';

export interface AdminRequestsToolbarProps {
  displayCount: number;
  totalCount?: number | null;
  requestsSort: { colId: string; dir: 'asc' | 'desc' } | null;
  handleRequestsSort: (colId: string, dir: 'asc' | 'desc') => void;
  hasUnsavedLayout: boolean;
  handleSaveLayout: () => void;
  onShowDefaultColumnsModal: () => void;
  handleExportRequestsToExcel: () => void;
  selectedRequestKeys: Set<string>;
  quickSelectCount: string;
  setQuickSelectCount: (val: string) => void;
  handleSelectFirstN: (count: number) => void;
  handleSelectAllVisible: () => void;
  handleDeselectAll: () => void;
}

export const AdminRequestsToolbar: React.FC<AdminRequestsToolbarProps> = ({
  displayCount,
  totalCount,
  requestsSort,
  handleRequestsSort,
  hasUnsavedLayout,
  handleSaveLayout,
  onShowDefaultColumnsModal,
  handleExportRequestsToExcel,
  selectedRequestKeys,
  quickSelectCount,
  setQuickSelectCount,
  handleSelectFirstN,
  handleSelectAllVisible,
  handleDeselectAll
}) => {
  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          padding: '0 8px',
          gap: '12px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="pagination-info" style={{ color: '#64748b', fontSize: '14px', fontWeight: 600 }}>
            {totalCount != null && totalCount > 0
              ? `المعروض ${displayCount} من أصل ${totalCount} طلب`
              : totalCount === 0 && displayCount === 0
                ? 'المعروض 0 من أصل 0 طلب'
                : `المعروض ${displayCount} طلب`}
          </div>
          {requestsSort ? (
            <button
              type="button"
              onClick={() => handleRequestsSort('', 'asc')}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                color: '#dc2626',
                background: '#fef2f2',
                border: '1px solid #fee2e2',
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 600
              }}
              title="اضغط للرجوع للترتيب الافتراضي (الجديدة والأحدث أولاً)"
            >
              ↩️ إرجاع للترتيب الافتراضي (الجديدة والأحدث أولاً)
            </button>
          ) : null}
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {hasUnsavedLayout && (
            <button
              type="button"
              onClick={handleSaveLayout}
              style={{
                padding: '8px 14px',
                borderRadius: '8px',
                border: 'none',
                background: '#22c55e',
                color: 'white',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                boxShadow: '0 0 12px rgba(34, 197, 94, 0.4)'
              }}
              title="اضغط لحفظ التغييرات التي قمت بها في ترتيب الجدول"
            >
              💾 حفظ الترتيب الجديد
            </button>
          )}
          <button
            type="button"
            onClick={onShowDefaultColumnsModal}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#475569',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="اضغط لعرض الترتيب الأصلي لأعمدة الجدول للرجوع إليه إذا نسيته"
          >
            📋 عرض ترتيب الجدول القديم
          </button>
          <button
            type="button"
            onClick={handleExportRequestsToExcel}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#f8fafc',
              color: '#0f172a',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            <FileText size={14} />
            تحميل الجدول كملف Excel
          </button>
        </div>
      </div>

      {/* شريط أدوات التحديد السريع للطلبات */}
      <div
        className="requests-bulk-quick-toolbar"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          flexWrap: 'wrap',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          padding: '8px 12px',
          marginBottom: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <CheckSquare size={16} color="#2563eb" />
            تحديد جماعي سريع:
          </span>
          {[5, 6, 10, 20].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => handleSelectFirstN(n)}
              style={{
                padding: '4px 10px',
                background: selectedRequestKeys.size === n ? '#dbeafe' : '#ffffff',
                color: selectedRequestKeys.size === n ? '#1d4ed8' : '#475569',
                border: selectedRequestKeys.size === n ? '1px solid #93c5fd' : '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
              title={`تحديد أول ${n} طلب`}
            >
              أول {n}
            </button>
          ))}

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginRight: '4px' }}>
            <input
              type="number"
              min={1}
              max={displayCount || 100}
              value={quickSelectCount}
              onChange={(e) => setQuickSelectCount(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = parseInt(quickSelectCount, 10);
                  if (!Number.isNaN(num) && num > 0) handleSelectFirstN(num);
                }
              }}
              placeholder="عدد"
              style={{
                width: '54px',
                padding: '4px 6px',
                fontSize: '12px',
                borderRadius: '6px',
                border: '1px solid #cbd5e1',
                textAlign: 'center',
                fontWeight: 600
              }}
              title="أدخل أي عدد تريده واضغط تحديد"
            />
            <button
              type="button"
              onClick={() => {
                const num = parseInt(quickSelectCount, 10);
                if (!Number.isNaN(num) && num > 0) handleSelectFirstN(num);
              }}
              style={{
                padding: '4px 9px',
                background: '#ffffff',
                color: '#2563eb',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              تحديد
            </button>
          </div>

          <button
            type="button"
            onClick={handleSelectAllVisible}
            style={{
              padding: '4px 10px',
              background: '#ffffff',
              color: '#334155',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
            title="تحديد جميع الطلبات المعروضة في الصفحة"
          >
            تحديد كل المعروض ({displayCount})
          </button>
        </div>

        {selectedRequestKeys.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 800,
                background: '#eff6ff',
                color: '#1d4ed8',
                padding: '3px 8px',
                borderRadius: '12px',
                border: '1px solid #bfdbfe'
              }}
            >
              تم تحديد {selectedRequestKeys.size} طلب
            </span>
            <button
              type="button"
              onClick={handleDeselectAll}
              style={{
                padding: '4px 8px',
                background: '#fef2f2',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="إلغاء تحديد كل الطلبات"
            >
              <X size={13} />
              إلغاء التحديد
            </button>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminRequestsToolbar;
