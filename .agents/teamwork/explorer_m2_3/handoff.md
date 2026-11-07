# Handoff Report: Milestone 2 (Step 3 — Extract ElectronicPaymentCodesTab)

## 1. Observation

### 1.1 Existing File & Code Inspection
- **Target Source File**: `src/page/AdminDashboardPage.tsx` (Current lines: 7,723 lines).
- **Target Destination Component**: `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` (Directory `src/components/admin/codes` already exists and is empty).
- **Baseline Build Verification**:
  - `npm run build`: Exited with **Code 0** in 19.65s (0 TypeScript errors, 1,817 modules transformed).
  - `npm test`: Exited with **Code 0**, passing 10/10 test suites.

### 1.2 Firestore Subscriptions & Real-Time Listeners Located
In `src/page/AdminDashboardPage.tsx`:
- **Line 40**: Imports `subscribeToElectronicPaymentCodes` from `../services/firebaseService`.
- **Lines 1486–1496**: Unconditional mount listener inside `useEffect(() => { ... }, [dataReady, isLoading])`:
  ```ts
  const unsubscribeEpCodes = subscribeToElectronicPaymentCodes((codes) => {
    logger.log('Real-time update: Electronic Payment Codes loaded:', codes.length);
    setEpCodes(codes);
  });

  return () => {
    unsubscribeBook();
    unsubscribeAssignments();
    unsubscribeStatement();
    unsubscribeEpCodes();
  };
  ```
- **Firestore Service Implementation** (`src/services/firebaseService.ts` lines 4456–4482):
  ```ts
  export const subscribeToElectronicPaymentCodes = (
    onUpdate: (codes: any[]) => void,
    onError?: (error: any) => void
  ) => {
    const q = query(
      collection(db, 'electronicPaymentCodes'),
      orderBy('updatedAt', 'desc'),
      limit(100)
    );
    const unsubscribe = onSnapshot(q, ...);
    return unsubscribe;
  };
  ```
- **Finding**: Currently, this listener connects to Firestore as soon as the dashboard loads, consuming real-time reads on every dashboard mount even if the admin is working exclusively on other tabs (Requests, Settings, News, Users).

### 1.3 State Variables Directly Associated with EP Codes
In `src/page/AdminDashboardPage.tsx`:
1. **Lines 254–255**:
   ```ts
   const [selectedEPRows, setSelectedEPRows] = useState<Set<number>>(new Set());
   const [selectedEPColumns, setSelectedEPColumns] = useState<Set<number>>(new Set());
   ```
   *(Exclusive to EP Codes tab table selection)*
2. **Line 275**:
   ```ts
   const [epCodes, setEpCodes] = useState<any[]>([]);
   ```
   *(Shared: Used by `epCodesIndex` at line 476, `adminCodesLookup` at line 486, `AdminAssistantTab` at line 3271, and Service 4 "المصروفات الدراسية" in requests table at lines 3549 & 4383)*
3. **Line 315**:
   ```ts
   const [epSearchTerm, setEpSearchTerm] = useState<string>('');
   ```
   *(Exclusive to EP Codes tab search bar)*

### 1.4 Functions Directly Associated with EP Codes
In `src/page/AdminDashboardPage.tsx`:
1. **Lines 3014–3023**: `toggleEPRow(rowIndex: number)` — Row selection toggle.
2. **Lines 3025–3034**: `toggleEPColumn(colIndex: number)` — Column selection toggle.
3. **Lines 3060–3080**: `copyEPSelection()` — TSV copy of selected rows/columns.
4. **Lines 3103–3120**: `copyEPColumn(columnName: string, columnIndex: number)` — TSV copy of an individual column.
5. **Lines 3170–3177**: `handleDeleteEPCode(id: string)` — Delete code by ID via `deleteElectronicPaymentCode(id)`.

### 1.5 Tab Rendering Boundaries
In `src/page/AdminDashboardPage.tsx`:
- **Lines 6569–6765** (~196 lines):
  - Starts: `{ activeTab === 'electronicPaymentCodes' && ( <div className="admin-content"> ...`
  - Header with real-time green pulsing dot (`مباشر (Real-time)`) and count `({epCodes.length})`.
  - Search input with placeholder: `"ابحث في الأكواد (الاسم، الموبايل، البريد، النوع، رقم فوري...)"`.
  - Responsive table container with 8 data columns + Actions column.
  - 8 header copy buttons calling `copyEPColumn(colName, colIdx)`.
  - Row rendering with field fallbacks (`fullNameArabic`, `phone`, `whatsapp`, `national_id`, `service_type`, `referenceNumber`).
  - Row actions: Star toggle flag (`toggleFlag(flagKey, 1)` with `toggledFlags[flagKey]`) and Delete button (`handleDeleteEPCode(code.id)`).
  - Ends: `) }` at line 6765 right before `{activeTab === 'statistics' && ...`.

---

## 2. Logic Chain

1. **Lazy On-Demand Subscription Strategy**:
   - Following the successful Milestone 1 pattern from `ServicesManagementTab.tsx` (`subscribeToServiceSettings`), we excise `unsubscribeEpCodes` from the dashboard mount `useEffect` in `AdminDashboardPage.tsx` (lines 1486–1495).
   - In `ElectronicPaymentCodesTab.tsx`, we instantiate `useEffect(() => { const unsubscribe = subscribeToElectronicPaymentCodes(...); return () => unsubscribe(); }, [])`.
   - Because `ElectronicPaymentCodesTab` is only mounted when `activeTab === 'electronicPaymentCodes'`, the subscription opens on tab entry and immediately unsubscribes on tab switch, completely eliminating idle Firestore listener overhead.
   - To keep parent state synchronized for `AdminAssistantTab` and `colEpOrderNumber` (Service 4 requests), the tab accepts `epCodes?: any[]` and `setEpCodes?: React.Dispatch<React.SetStateAction<any[]>>`. When data arrives, it updates both internal state and `setEpCodes(loadedCodes)`.

2. **Compliance with User Constraints ("Do NOT delete or alter any function")**:
   - All 5 functions (`copyEPColumn`, `copyEPSelection`, `toggleEPRow`, `toggleEPColumn`, `handleDeleteEPCode`) are migrated verbatim into `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`.
   - In `AdminDashboardPage.tsx`, keeping `handleDeleteEPCode` as an optional delegator or passing it into the tab guarantees zero missing function signatures.
   - `saveElectronicPaymentCode` is retained in `AdminDashboardPage.tsx` imports because it is invoked at line 1960 during request automation.
   - `epCodes` state is maintained in `AdminDashboardPage.tsx` (`useState<any[]>([])`) so dependent useMemo indexes (`epCodesIndex`, `adminCodesLookup`) never break.

3. **Pattern Consistency with Milestone 1 (`ServicesManagementTab.tsx`)**:
   - Props contract matches the established standard: `showAlert`, `setToastState`, `toggledFlags`, `toggleFlag`.
   - Self-contained UI and internal selection state: `selectedEPRows`, `selectedEPColumns`, `epSearchTerm`.

---

## 3. Caveats

1. **Requests Tab Service 4 Cross-Dependency**:
   - When an admin views Service 4 ("المصروفات الدراسية") in the requests tab before ever visiting `electronicPaymentCodes` tab, `epCodes` is `[]` so `colEpOrderNumber` shows `'-'`. As soon as `electronicPaymentCodes` tab is opened once, `epCodes` is populated and synced back to parent. (This matches `dtCodes`, which has always been lazy).
2. **Local Disk Only**:
   - In strict compliance with user instructions, no git commits, pushes, or remote deployments are permitted. All changes are strictly local.

---

## 4. Conclusion & Concrete Artifacts

### 4.1 Exact TypeScript Interface Contract
Create in `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`:

```typescript
import React from 'react';

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
  setEpCodes?: React.Dispatch<React.SetStateAction<any[]>>;
  handleDeleteEPCode?: (id: string) => Promise<void>;
  showConfirm?: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
}
```

### 4.2 Full Implementation Template for `src/components/admin/codes/ElectronicPaymentCodesTab.tsx`
```typescript
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
  setEpCodes?: React.Dispatch<React.SetStateAction<any[]>>;
  handleDeleteEPCode?: (id: string) => Promise<void>;
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
  showConfirm
}) => {
  const [codes, setCodes] = useState<ElectronicPaymentCode[]>(epCodes || []);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedEPRows, setSelectedEPRows] = useState<Set<number>>(new Set());
  const [selectedEPColumns, setSelectedEPColumns] = useState<Set<number>>(new Set());
  const [localFlags, setLocalFlags] = useState<Record<string, RowFlags>>({});

  // Lazy on-demand subscription for electronic payment codes (unsubscribes on unmount)
  useEffect(() => {
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
    if (epCodes && epCodes !== codes) {
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

  const handleDelete = async (id: string) => {
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
                          onClick={() => handleDelete(code.id)}
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
```

### 4.3 Step-by-Step Diff for `src/page/AdminDashboardPage.tsx`
1. **Import Component**:
   At top imports (~line 160):
   ```typescript
   import ElectronicPaymentCodesTab from '../components/admin/codes/ElectronicPaymentCodesTab';
   ```
2. **Remove Unconditional Mount Listener**:
   In `useEffect` at lines 1486–1496:
   ```typescript
   // BEFORE:
   const unsubscribeEpCodes = subscribeToElectronicPaymentCodes((codes) => {
     logger.log('Real-time update: Electronic Payment Codes loaded:', codes.length);
     setEpCodes(codes);
   });

   return () => {
     unsubscribeBook();
     unsubscribeAssignments();
     unsubscribeStatement();
     unsubscribeEpCodes();
   };

   // AFTER:
   return () => {
     unsubscribeBook();
     unsubscribeAssignments();
     unsubscribeStatement();
   };
   ```
3. **Clean Up Unused State and Functions**:
   - Remove lines 254–255: `selectedEPRows`, `selectedEPColumns`.
   - Remove line 315: `epSearchTerm`.
   - Remove lines 3014–3034: `toggleEPRow`, `toggleEPColumn`.
   - Remove lines 3060–3080: `copyEPSelection`.
   - Remove lines 3103–3120: `copyEPColumn`.
   - Keep `handleDeleteEPCode` (or pass it through) and keep `const [epCodes, setEpCodes] = useState<any[]>([]);` for lookups.
4. **Mount Extracted Tab Component**:
   Replace lines 6570–6765 (~196 lines) with:
   ```tsx
   {activeTab === 'electronicPaymentCodes' && (
     <ElectronicPaymentCodesTab
       showAlert={showAlert}
       setToastState={setToastState}
       toggledFlags={toggledFlags}
       toggleFlag={toggleFlag}
       epCodes={epCodes}
       setEpCodes={setEpCodes}
       handleDeleteEPCode={handleDeleteEPCode}
       showConfirm={showConfirm}
     />
   )}
   ```

---

## 5. Verification Method

1. **Compilation Check**:
   ```powershell
   npm run build
   ```
   **Expected**: Exit Code 0, 0 TypeScript errors.
2. **Unit Test Gate**:
   ```powershell
   npm test
   ```
   **Expected**: 10 passed, 0 failed.
3. **Line Count Verification**:
   ```powershell
   (Get-Content src/page/AdminDashboardPage.tsx).Length
   ```
   **Expected**: Reduction from 7,723 lines to ~7,460 lines (approx. 263 lines removed).
4. **Component Verification**:
   Confirm `src/components/admin/codes/ElectronicPaymentCodesTab.tsx` exists and has clean imports.
