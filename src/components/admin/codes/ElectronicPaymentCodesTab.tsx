import React, { useState, useEffect, useMemo } from 'react';
import { Search, Copy, Star, Trash2 } from 'lucide-react';
import {
  subscribeToElectronicPaymentCodes,
  deleteElectronicPaymentCode
} from '../../../services/firebaseService';
import { logger } from '../../../utils/logger';

export interface ElectronicPaymentCode {
  id?: string;
  studentId?: string;
  requestId?: string;
  name?: string;
  fullNameArabic?: string;
  mobile?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  nationalID?: string;
  national_id?: string;
  entity?: string;
  serviceType?: string;
  service_type?: string;
  type?: string;
  value?: string | number;
  fawryCode?: string;
  orderNumber?: string;
  referenceNumber?: string;
  status?: string;
  rawText?: string;
  createdAt?: any;
  updatedAt?: any;
  [key: string]: any;
}

export interface RowFlags {
  f1: boolean;
  f2: boolean;
  f3: boolean;
}

export interface ElectronicPaymentCodesTabProps {
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setToastState: React.Dispatch<React.SetStateAction<{ message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null>> | ((state: any) => void);
  toggledFlags?: Record<string, RowFlags>;
  toggleFlag?: (key: string, index: 1 | 2 | 3) => void;
  epCodes?: ElectronicPaymentCode[];
  setEpCodes?: React.Dispatch<React.SetStateAction<any[]>> | ((codes: any[]) => void);
  handleDeleteEPCode?: (id: string) => Promise<void>;
  copyEPColumn?: (columnName: string, columnIndex: number) => void;
  showConfirm?: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}

export const ElectronicPaymentCodesTab: React.FC<ElectronicPaymentCodesTabProps> = ({
  showAlert,
  setToastState,
  toggledFlags = {},
  toggleFlag,
  epCodes,
  setEpCodes,
  handleDeleteEPCode: propHandleDeleteEPCode,
  copyEPColumn: propCopyEPColumn,
  showConfirm
}) => {
  const [codes, setCodes] = useState<ElectronicPaymentCode[]>(epCodes || []);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEPRows, setSelectedEPRows] = useState<Set<number>>(new Set());
  const [selectedEPColumns, setSelectedEPColumns] = useState<Set<number>>(new Set());
  const [localFlags, setLocalFlags] = useState<Record<string, RowFlags>>({});

  // Lazy on-demand subscription for electronic payment codes (unsubscribes on unmount)
  useEffect(() => {
    logger.log('Subscribing to electronic payment codes (lazy on-demand)...');
    const unsubscribe = subscribeToElectronicPaymentCodes(
      (loadedCodes) => {
        logger.log('Real-time update: Electronic Payment Codes loaded:', loadedCodes.length);
        setCodes(loadedCodes);
        if (setEpCodes) {
          setEpCodes(loadedCodes);
        }
      },
      (error) => {
        logger.error('Error in electronic payment codes subscription:', error);
        showAlert('خطأ', 'تعذر تحميل أكواد الدفع الإلكتروني', 'error');
      }
    );

    return () => {
      logger.log('Unsubscribing from electronic payment codes (lazy on-demand cleanup)');
      unsubscribe();
    };
  }, [setEpCodes, showAlert]);

  useEffect(() => {
    if (epCodes && epCodes.length > 0 && codes.length === 0) {
      setCodes(epCodes);
    }
  }, [epCodes]);

  const toggleEPRow = (rowIndex: number) => {
    const newSelected = new Set(selectedEPRows);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedEPRows(newSelected);
    setSelectedEPColumns(new Set());
  };

  const toggleEPColumn = (colIndex: number) => {
    const newSelected = new Set(selectedEPColumns);
    if (newSelected.has(colIndex)) {
      newSelected.delete(colIndex);
    } else {
      newSelected.add(colIndex);
    }
    setSelectedEPColumns(newSelected);
    setSelectedEPRows(new Set());
  };

  const copyEPSelection = () => {
    if (selectedEPRows.size === 0 && selectedEPColumns.size === 0) return;

    let textToCopy = '';
    if (selectedEPRows.size > 0) {
      const sortedRows = Array.from(selectedEPRows).sort((a, b) => a - b);
      textToCopy = sortedRows.map(rowIndex => {
        const code = codes[rowIndex];
        return `${code.name || ''}\t${code.mobile || ''}\t${code.email || ''}\t${code.nationalID || ''}\t${code.entity || ''}\t${code.serviceType || ''}\t${code.createdAt?.seconds ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG') : (code.createdAt || 'الان')}\t${code.orderNumber || ''}`;
      }).join('\n');
    } else if (selectedEPColumns.size > 0) {
      const sortedCols = Array.from(selectedEPColumns).sort((a, b) => a - b);
      textToCopy = codes.map(code => {
        const values = [code.name, code.mobile, code.email, code.nationalID, code.entity, code.serviceType, code.createdAt?.seconds ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG') : (code.createdAt || 'الان'), code.orderNumber];
        return sortedCols.map(colIndex => values[colIndex]).join('\t');
      }).join('\n');
    }

    navigator.clipboard.writeText(textToCopy);
    setToastState({ message: 'تم نسخ التحديد بنجاح!', type: 'success', duration: 2000 });
  };

  const copyEPColumn = (columnName: string, columnIndex: number) => {
    if (propCopyEPColumn) {
      propCopyEPColumn(columnName, columnIndex);
      return;
    }
    const columnData = codes.map(code => {
      const values = [
        code.name,
        code.mobile,
        code.email,
        code.nationalID,
        code.entity,
        code.serviceType,
        code.createdAt?.seconds ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG') : (code.createdAt || 'الان'),
        code.orderNumber
      ];
      return values[columnIndex];
    }).join('\n');

    navigator.clipboard.writeText(columnData);
    setToastState({ message: `تم نسخ عمود "${columnName}" بنجاح!`, type: 'success', duration: 2000 });
  };

  const handleDeleteEPCode = async (id: string) => {
    if (!id) return;
    if (propHandleDeleteEPCode) {
      await propHandleDeleteEPCode(id);
      return;
    }
    const doDelete = async () => {
      try {
        await deleteElectronicPaymentCode(id);
        setToastState({ message: 'تم حذف الكود بنجاح', type: 'success', duration: 2000 });
      } catch (error: any) {
        showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
      }
    };

    if (showConfirm) {
      showConfirm('تأكيد الحذف', 'هل أنت متأكد من حذف هذا الكود؟', doDelete, 'حذف');
    } else {
      await doDelete();
    }
  };

  const handleToggleFlag = (key: string) => {
    if (toggleFlag) {
      toggleFlag(key, 1);
    } else {
      setLocalFlags(prev => {
        const current = prev[key] || { f1: false, f2: false, f3: false };
        return {
          ...prev,
          [key]: { ...current, f1: !current.f1 }
        };
      });
    }
  };

  const filteredEpCodes = useMemo(() => {
    return codes.filter(code => {
      if (!searchTerm.trim()) return true;
      const term = searchTerm.toLowerCase().trim();
      return (
        code.name?.toLowerCase().includes(term) ||
        code.mobile?.includes(term) ||
        code.phone?.includes(term) ||
        code.email?.toLowerCase().includes(term) ||
        code.type?.toLowerCase().includes(term) ||
        code.status?.toLowerCase().includes(term) ||
        code.fawryCode?.includes(term) ||
        code.value?.toString().includes(term)
      );
    }).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ar'));
  }, [codes, searchTerm]);

  return (
    <div className="admin-content">
      <div className="section-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
          <h2>أكواد الدفع الإلكتروني ({codes.length})</h2>
          <span style={{
            fontSize: '0.6rem',
            background: '#dcfce7',
            color: '#166534',
            padding: '4px 8px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}>
            <span style={{ width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
            مباشر (Real-time)
          </span>
        </div>
      </div>

      <div className="search-bar" style={{ marginBottom: '25px' }}>
        <div className="search-input-wrapper">
          <Search size={20} className="search-icon" />
          <input
            type="text"
            placeholder="ابحث في الأكواد (الاسم، الموبايل، البريد، النوع، رقم فوري...)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="table-container" style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', overflowX: 'auto', maxWidth: '100%' }}>
        {filteredEpCodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>لا توجد نتائج لمطابقة بحثك</div>
        ) : (
          <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', userSelect: 'text', minWidth: '900px' }}>
            <thead>
              <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                <th style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    الاسم
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('الاسم', 0)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    الموبايل
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('الموبايل', 1)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    البريد الإلكتروني
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('البريد الإلكتروني', 2)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    الرقم القومي
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('الرقم القومي', 3)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    الجهة
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('الجهة', 4)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'right' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                    نوع الخدمة
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('نوع الخدمة', 5)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    تاريخ الإنشاء
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('تاريخ الإنشاء', 6)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                    الرقم المرجعي
                    <span title="نسخ العمود كامل">
                      <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('الرقم المرجعي', 7)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                    </span>
                  </div>
                </th>
                <th style={{ padding: '12px', textAlign: 'center' }}>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredEpCodes.map((code, index) => {
                const flagKey = `ep-${code.id || index}`;
                const flags = (toggleFlag ? toggledFlags[flagKey] : localFlags[flagKey]) || { f1: false, f2: false, f3: false };
                const isFlagged = flags.f1 || flags.f2 || flags.f3;

                return (
                  <tr
                    key={code.id || index}
                    style={{
                      borderBottom: '1px solid #e2e8f0',
                      transition: 'background 0.15s ease',
                      userSelect: 'text'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#f8fafc'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.name || code.fullNameArabic || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', userSelect: 'text', cursor: 'text' }}>{code.mobile || code.phone || code.whatsapp || '-'}</td>
                    <td style={{ padding: '12px', fontSize: '0.85rem', userSelect: 'text', cursor: 'text' }}>{code.email || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', userSelect: 'text', cursor: 'text' }}>{code.nationalID || code.national_id || '-'}</td>
                    <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.entity || '-'}</td>
                    <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.serviceType || code.service_type || '-'}</td>
                    <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', userSelect: 'text', cursor: 'text' }}>
                      {code.createdAt?.seconds
                        ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG')
                        : (code.createdAt ? new Date(code.createdAt).toLocaleString('ar-EG') : 'الان')}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', background: '#f0f9ff', userSelect: 'text', cursor: 'text' }}>
                      {code.referenceNumber || code.orderNumber}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleFlag(flagKey)}
                          title={isFlagged ? 'إلغاء التمييز المؤقت' : 'تمييز الصف مؤقتاً'}
                          style={{
                            padding: '6px',
                            background: isFlagged ? '#ecfdf5' : '#f0fdf4',
                            color: isFlagged ? '#047857' : '#15803d',
                            border: `1px solid ${isFlagged ? '#6ee7b7' : '#bbf7d0'}`,
                            borderRadius: '8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <Star size={16} fill={isFlagged ? 'currentColor' : 'none'} />
                        </button>
                        <button
                          onClick={() => {
                            if (code.id) {
                              handleDeleteEPCode(code.id);
                            }
                          }}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                          title="حذف"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ElectronicPaymentCodesTab;
