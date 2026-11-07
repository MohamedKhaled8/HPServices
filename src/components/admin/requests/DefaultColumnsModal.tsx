import React from 'react';

export interface DefaultColumnsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allColumns: { id: string; label: string; getValue: (r: any) => string }[];
  extraKeys: string[];
  translateKey: (key: string) => string;
  selectedServiceId: string | null;
  setRequestsDataColumnOrder: React.Dispatch<React.SetStateAction<number[]>>;
  setRequestsSortState: (sort: { colId: string; dir: 'asc' | 'desc' } | null) => void;
  setHasUnsavedLayout: (val: boolean) => void;
  layoutsHistory: any[];
  setLayoutsHistory: React.Dispatch<React.SetStateAction<any[]>>;
  activeLayoutDetailId: string | null;
  setActiveLayoutDetailId: React.Dispatch<React.SetStateAction<string | null>>;
  showCustomOrderInModal: boolean;
  setShowCustomOrderInModal: React.Dispatch<React.SetStateAction<boolean>>;
}

export const DefaultColumnsModal: React.FC<DefaultColumnsModalProps> = ({
  isOpen,
  onClose,
  allColumns,
  extraKeys,
  translateKey,
  selectedServiceId,
  setRequestsDataColumnOrder,
  setRequestsSortState,
  setHasUnsavedLayout,
  layoutsHistory,
  setLayoutsHistory,
  activeLayoutDetailId,
  setActiveLayoutDetailId,
  showCustomOrderInModal,
  setShowCustomOrderInModal
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div
        style={{
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
          width: '100%',
          maxWidth: '480px',
          background: 'white',
          border: '1px solid #e2e8f0',
          direction: 'rtl',
          overflow: 'hidden'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>
            📋 خيارات ترتيب الجدول
          </h3>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              color: '#64748b',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', maxHeight: '420px', overflowY: 'auto' }}>
          {/* الترتيب الأصلي */}
          <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: 800, color: '#334155' }}>
            📌 الترتيب الأصلي الافتراضي:
          </h4>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              background: '#f8fafc',
              padding: '12px',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              maxHeight: '180px',
              overflowY: 'auto'
            }}
          >
            {(() => {
              const defaultCols = [
                '#',
                'إجراءات',
                'الحالة',
                ...allColumns.map(c => c.label),
                ...extraKeys.map(k => translateKey(k)),
                'التاريخ',
                'الملفات'
              ];
              return defaultCols.map((colLabel, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '6px 10px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontSize: '13px',
                    color: '#1e293b',
                    fontWeight: 600
                  }}
                >
                  <span
                    style={{
                      background: '#3b82f6',
                      color: 'white',
                      borderRadius: '50%',
                      width: '18px',
                      height: '18px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '10px',
                      fontWeight: 800
                    }}
                  >
                    {i + 1}
                  </span>
                  <span>{colLabel}</span>
                </div>
              ));
            })()}
          </div>

          <button
            type="button"
            onClick={() => {
              setRequestsDataColumnOrder([]);
              if (selectedServiceId) {
                try {
                  localStorage.removeItem(`hp_requests_col_order_${selectedServiceId}`);
                } catch (e) {
                  console.error(e);
                }
              }
              setHasUnsavedLayout(false);
              onClose();
              alert('تم استعادة وحفظ الترتيب الأصلي الافتراضي للجدول بنجاح!');
            }}
            style={{
              marginTop: '10px',
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              width: '100%'
            }}
          >
            إعادة تطبيق الترتيب الأصلي
          </button>

          {/* الترتيب المخصص الذي قمت بحفظه */}
          <div style={{ marginTop: '20px', borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={() => setShowCustomOrderInModal(!showCustomOrderInModal)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 12px',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 700,
                color: '#1e293b'
              }}
            >
              <span>{showCustomOrderInModal ? '🔼 إخفاء الترتيبات المخصصة المحفوظة' : '🔽 عرض الترتيبات المخصصة المحفوظة'}</span>
              <span style={{ fontSize: '12px' }}>{showCustomOrderInModal ? '▲' : '▼'}</span>
            </button>

            {showCustomOrderInModal && (
              <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {layoutsHistory.length === 0 ? (
                  <div
                    style={{
                      padding: '12px',
                      textAlign: 'center',
                      color: '#94a3b8',
                      fontSize: '13px',
                      background: '#f8fafc',
                      borderRadius: '8px',
                      border: '1px dashed #cbd5e1'
                    }}
                  >
                    لا يوجد ترتيب مخصص محفوظ حالياً لهذه الخدمة.
                  </div>
                ) : (
                  layoutsHistory.map((layoutItem) => {
                    const isExpanded = activeLayoutDetailId === layoutItem.id;
                    return (
                      <div
                        key={layoutItem.id}
                        style={{
                          background: '#f0fdf4',
                          padding: '12px',
                          borderRadius: '12px',
                          border: '1px solid #bbf7d0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '8px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', fontWeight: 'bold', color: '#166534' }}>
                            {layoutItem.name}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={() => setActiveLayoutDetailId(isExpanded ? null : layoutItem.id)}
                              style={{
                                background: '#e8f5e9',
                                color: '#2e7d32',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              {isExpanded ? '🔼 إخفاء' : '🔽 التفاصيل'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذا الترتيب المحفوظ؟')) {
                                  const updated = layoutsHistory.filter(item => item.id !== layoutItem.id);
                                  const historyKey = `hp_requests_col_orders_history_${selectedServiceId}`;
                                  localStorage.setItem(historyKey, JSON.stringify(updated));
                                  setLayoutsHistory(updated);
                                }
                              }}
                              title="حذف هذا الترتيب من السجل"
                              style={{
                                background: '#ffebee',
                                color: '#c62828',
                                border: 'none',
                                borderRadius: '6px',
                                padding: '4px 8px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 'bold'
                              }}
                            >
                              🗑️ حذف
                            </button>
                          </div>
                        </div>

                        {/* تفاصيل الأعمدة */}
                        {isExpanded && (
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '6px',
                              marginTop: '6px',
                              maxHeight: '150px',
                              overflowY: 'auto',
                              background: 'white',
                              padding: '8px',
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0'
                            }}
                          >
                            {(() => {
                              const order = layoutItem.columnOrder || [];
                              const labels = order.map((localIdx: number) => {
                                const isFromColumns = localIdx < allColumns.length;
                                const col = isFromColumns ? allColumns[localIdx] : null;
                                const key = !isFromColumns ? extraKeys[localIdx - allColumns.length] : null;
                                return col ? col.label : (key ? translateKey(key) : '');
                              });
                              const fullLabelsList = [
                                '#',
                                'إجراءات',
                                'الحالة',
                                ...labels,
                                'التاريخ',
                                'الملفات'
                              ];
                              return fullLabelsList.map((colLabel, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '12px',
                                    color: '#334155'
                                  }}
                                >
                                  <span
                                    style={{
                                      background: '#22c55e',
                                      color: 'white',
                                      borderRadius: '50%',
                                      width: '16px',
                                      height: '16px',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: '9px',
                                      fontWeight: 800
                                    }}
                                  >
                                    {idx + 1}
                                  </span>
                                  <span>{colLabel}</span>
                                </div>
                              ));
                            })()}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => {
                            // Apply columns
                            setRequestsDataColumnOrder(layoutItem.columnOrder || []);

                            // Apply sort if exists
                            if (layoutItem.sort) {
                              setRequestsSortState(layoutItem.sort);
                              localStorage.setItem(`hp_requests_sort_${selectedServiceId || 'all'}`, JSON.stringify(layoutItem.sort));
                            } else {
                              setRequestsSortState(null);
                              localStorage.removeItem(`hp_requests_sort_${selectedServiceId || 'all'}`);
                            }

                            // Save active columns layout to active key
                            localStorage.setItem(`hp_requests_col_order_${selectedServiceId}`, JSON.stringify(layoutItem.columnOrder || []));

                            setHasUnsavedLayout(false);
                            onClose();
                            alert(`تم تطبيق الترتيب "${layoutItem.name}" بنجاح!`);
                          }}
                          style={{
                            marginTop: '6px',
                            padding: '8px 16px',
                            backgroundColor: '#22c55e',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 700,
                            width: '100%'
                          }}
                        >
                          تطبيق هذا الترتيب
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-start'
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 16px',
              backgroundColor: 'transparent',
              color: '#64748b',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 700,
              width: '100%',
              textAlign: 'center'
            }}
          >
            إغلاق
          </button>
        </div>
      </div>
    </div>
  );
};

export default DefaultColumnsModal;
