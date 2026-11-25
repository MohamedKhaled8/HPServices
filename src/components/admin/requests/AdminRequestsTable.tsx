import React, { useState } from 'react';
import {
  GripVertical,
  ChevronDown,
  Copy,
  Clock,
  Send,
  FileText,
  CheckCircle,
  XCircle,
  Eye,
  Download,
  Edit2,
  Trash2,
  Folder
} from 'lucide-react';
import { normalizeTrackName } from '../../../utils/trackUtils';
import { normalizeWorkflowStatus } from '../../../utils/adminRequestsUtils';
import { getServiceNameHelper } from './requestsHelpers';
import type { useSpreadsheetGrid } from '../../../hooks/useSpreadsheetGrid';
import type {
  ServiceRequest,
  ServiceRequestWorkflowStatus,
  StudentData,
  AssignedFile
} from '../../../types';

export interface AdminRequestsTableProps {
  displayRequests: ServiceRequest[];
  students: Record<string, StudentData>;
  selectedServiceId: string | null;
  hasAddress?: boolean;
  hasDiploma?: boolean;
  hasTrack?: boolean;
  allColumns: { id: string; label: string; getValue: (r: any) => string }[];
  extraKeys: string[];
  orderedDataIndices: number[];
  dataColumnCount: number;
  requestsDataColumnOrder: number[];
  setRequestsDataColumnOrder: React.Dispatch<React.SetStateAction<number[]>>;
  requestsSort: { colId: string; dir: 'asc' | 'desc' } | null;
  handleRequestsSort: (colId: string, dir: 'asc' | 'desc') => void;
  setHasUnsavedLayout: (val: boolean) => void;
  selectedRequestKeys: Set<string>;
  setSelectedRequestKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastSelectedRequestRowIndex: number | null;
  setLastSelectedRequestRowIndex: React.Dispatch<React.SetStateAction<number | null>>;
  toggleSelectRequest: (reqKey: string, index: number, isShift: boolean) => void;
  handleMasterCheckboxChange: () => void;
  isAllVisibleSelected: boolean;
  isSomeVisibleSelected: boolean;
  duplicateCountByRow: number[];
  phoneCounts: Map<string, number>;
  normPhone: (s: string) => string;
  dtCodesIndex: Record<string, any>;
  epCodesIndex: Record<string, any>;
  adminCodesLookup: any;
  gridApi: ReturnType<typeof useSpreadsheetGrid>;
  requestsTableRef: React.RefObject<HTMLDivElement>;
  requestsScrollContainerRef: React.RefObject<HTMLDivElement>;
  dragStartRef: React.MutableRefObject<{ tableId: string; row: number; col: number } | null>;
  isDraggingRowSelectionRef: React.MutableRefObject<boolean>;
  dragRowStartRef: React.MutableRefObject<number | null>;
  initialSelectedKeysAtDragRef: React.MutableRefObject<Set<string>>;
  displayRequestsRef: React.MutableRefObject<ServiceRequest[]>;
  setSpreadsheetMenu: React.Dispatch<React.SetStateAction<{ open: boolean; x: number; y: number; tableId: string; columnLabel?: string; columnIndex?: number }>>;
  setSpreadsheetDropdownColumn: React.Dispatch<React.SetStateAction<number | null>>;
  setCellContextMenu: React.Dispatch<React.SetStateAction<{ open: boolean; x: number; y: number; row?: number; col?: number }>>;
  copyRequestsColumn: (columnName: string, filteredRequests: any[], getValue: (req: any) => string) => void;
  handleStatusChange: (requestId: string, status: ServiceRequestWorkflowStatus, serviceId: string) => Promise<void>;
  viewDocuments: (request: ServiceRequest) => void;
  handleDownloadAll: (request: ServiceRequest) => Promise<void>;
  handleDeleteRequest: (requestId: string, serviceId: string) => Promise<void>;
  onEditRequest: (request: ServiceRequest) => void;
  onViewAssignedFiles: (studentName: string, files: AssignedFile[]) => void;
  getStatusBadge: (status: string | undefined) => React.ReactNode;
  getServiceName?: (serviceId: string) => string;
  translateKey: (key: string) => string;
}

export const AdminRequestsTable: React.FC<AdminRequestsTableProps> = ({
  displayRequests,
  students,
  selectedServiceId,
  hasAddress,
  hasDiploma,
  hasTrack,
  allColumns,
  extraKeys,
  orderedDataIndices,
  dataColumnCount,
  requestsDataColumnOrder,
  setRequestsDataColumnOrder,
  requestsSort,
  handleRequestsSort,
  setHasUnsavedLayout,
  selectedRequestKeys,
  setSelectedRequestKeys,
  lastSelectedRequestRowIndex,
  setLastSelectedRequestRowIndex,
  toggleSelectRequest,
  handleMasterCheckboxChange,
  isAllVisibleSelected,
  isSomeVisibleSelected,
  duplicateCountByRow,
  phoneCounts,
  normPhone,
  dtCodesIndex,
  epCodesIndex,
  adminCodesLookup,
  gridApi,
  requestsTableRef,
  requestsScrollContainerRef,
  dragStartRef,
  isDraggingRowSelectionRef,
  dragRowStartRef,
  initialSelectedKeysAtDragRef,
  displayRequestsRef,
  setSpreadsheetMenu,
  setSpreadsheetDropdownColumn,
  setCellContextMenu,
  copyRequestsColumn,
  handleStatusChange,
  viewDocuments,
  handleDownloadAll,
  handleDeleteRequest,
  onEditRequest,
  onViewAssignedFiles,
  getStatusBadge,
  getServiceName,
  translateKey
}) => {
  const resolveServiceName = (sid: string): string =>
    getServiceName ? getServiceName(sid) : getServiceNameHelper(sid);
  const [draggedColDisplayPos, setDraggedColDisplayPos] = useState<number | null>(null);
  const [dropTargetColDisplayPos, setDropTargetColDisplayPos] = useState<number | null>(null);

  return (
    <div
      ref={requestsTableRef}
      tabIndex={0}
      className="spreadsheet-table-wrapper"
      data-spreadsheet-table-id="requests"
      onMouseDown={(e) => {
        if (!(e.target as HTMLElement).closest('th')) {
          gridApi.setActiveTableId('requests');
          requestsTableRef.current?.focus();
        }
      }}
      onMouseUp={() => {
        dragStartRef.current = null;
      }}
      onScroll={() => {
        setSpreadsheetMenu(m => (m.open ? { ...m, open: false } : m));
        setSpreadsheetDropdownColumn(null);
      }}
      role="grid"
      aria-label="جدول الطلبات"
    >
      <div
        ref={requestsScrollContainerRef}
        className="excel-table-wrapper spreadsheet-scroll-container"
        style={{
          maxHeight: 'none',
          overflowY: 'visible',
          overflowX: 'auto',
          borderRadius: '12px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)',
          position: 'relative',
          background: 'white'
        }}
      >
        <table className="excel-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '15px', minWidth: '1200px' }}>
          <thead onMouseDown={(e) => e.stopPropagation()}>
            <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', color: '#1e293b', borderBottom: '2px solid #e2e8f0' }}>
              <th className="spreadsheet-header-no-menu" data-col={0} style={{ padding: '15px 10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', color: '#475569', background: '#f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                  <input
                    type="checkbox"
                    checked={isAllVisibleSelected}
                    ref={el => { if (el) el.indeterminate = isSomeVisibleSelected; }}
                    onChange={handleMasterCheckboxChange}
                    style={{ cursor: 'pointer', width: '17px', height: '17px', accentColor: '#2563eb' }}
                    title={isAllVisibleSelected ? 'إلغاء تحديد كل الظاهر' : 'تحديد كل الظاهر في الجدول'}
                    aria-label="تحديد كل الطلبات الظاهرة"
                  />
                  <span>#</span>
                </div>
              </th>
              <th className="spreadsheet-header-no-menu" data-col={1} style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9' }}>
                إجراءات
              </th>
              <th
                className="spreadsheet-header-no-menu"
                data-col={2}
                style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9', cursor: 'pointer' }}
                onClick={() => {
                  const nextDir: 'asc' | 'desc' =
                    requestsSort && requestsSort.colId === 'status' && requestsSort.dir === 'asc'
                      ? 'desc'
                      : 'asc';
                  handleRequestsSort('status', nextDir);
                }}
                title="اضغط للترتيب حسب الحالة"
              >
                الحالة {requestsSort && requestsSort.colId === 'status' && (requestsSort.dir === 'asc' ? '▲' : '▼')}
              </th>

              {orderedDataIndices.map((localIdx, displayPos) => {
                const colIndex = 3 + displayPos;
                const isFromColumns = localIdx < allColumns.length;
                const col = isFromColumns ? allColumns[localIdx] : null;
                const key = !isFromColumns ? extraKeys[localIdx - allColumns.length] : null;
                const label = col ? col.label : (key ? translateKey(key) : '');
                const getValue = col ? col.getValue : (key ? (r: any) => String(r.data?.[key] ?? '-') : () => '-');
                const headerWidthStyle: React.CSSProperties = {
                  padding: '15px 12px',
                  border: '1px solid #cbd5e1',
                  textAlign: 'right',
                  fontWeight: '800',
                  fontSize: '13px',
                  whiteSpace: 'nowrap',
                  background: dropTargetColDisplayPos === displayPos ? '#dbeafe' : draggedColDisplayPos === displayPos ? '#e0e7ff' : '#f1f5f9',
                  color: '#475569'
                };
                if (col && ['name', 'name_en', 'address', 'project_title', 'group_link', 'student_names'].includes(col.id)) {
                  headerWidthStyle.minWidth = '220px';
                  headerWidthStyle.width = '220px';
                  headerWidthStyle.maxWidth = '350px';
                  headerWidthStyle.whiteSpace = 'normal';
                } else if (col && col.id === 'specialization') {
                  headerWidthStyle.maxWidth = '200px';
                }
                const openMenuFromHeader = (e: React.MouseEvent) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const th = (e.target as HTMLElement).closest('th');
                  const rect = th?.getBoundingClientRect();
                  setSpreadsheetMenu({ open: true, x: rect ? rect.left : e.clientX, y: rect ? rect.bottom + 4 : e.clientY, tableId: 'requests', columnLabel: label, columnIndex: colIndex });
                  setSpreadsheetDropdownColumn(colIndex);
                };
                const handleDrop = () => {
                  if (draggedColDisplayPos === null || dropTargetColDisplayPos === null) return;
                  const newOrder = [...orderedDataIndices];
                  const [removed] = newOrder.splice(draggedColDisplayPos, 1);
                  newOrder.splice(dropTargetColDisplayPos, 0, removed);
                  setRequestsDataColumnOrder(newOrder);
                  setHasUnsavedLayout(true);
                  setDraggedColDisplayPos(null);
                  setDropTargetColDisplayPos(null);
                };
                const colId = col ? col.id : (key ? `extra_key_${key}` : '');
                return (
                  <th
                    key={`data-col-${localIdx}`}
                    data-col={colIndex}
                    data-display-pos={displayPos}
                    draggable
                    onDragStart={() => setDraggedColDisplayPos(displayPos)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDropTargetColDisplayPos(displayPos); }}
                    onDrop={handleDrop}
                    onDragEnd={() => { setDraggedColDisplayPos(null); setDropTargetColDisplayPos(null); }}
                    style={headerWidthStyle}
                    onContextMenu={(e) => { e.preventDefault(); openMenuFromHeader(e); }}
                    onClick={openMenuFromHeader}
                    className="spreadsheet-header-draggable"
                    title="اسحب لتحريك العمود"
                  >
                    <div className="spreadsheet-header-cell-inner" style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <GripVertical size={12} style={{ cursor: 'grab', color: '#94a3b8', flexShrink: 0 }} />
                      <span
                        title="اضغط للترتيب حسب هذا العمود"
                        style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                        onClick={(ev) => {
                          ev.stopPropagation();
                          const nextDir: 'asc' | 'desc' =
                            requestsSort && requestsSort.colId === colId && requestsSort.dir === 'asc'
                              ? 'desc'
                              : 'asc';
                          handleRequestsSort(colId, nextDir);
                        }}
                      >
                        {label} {requestsSort && requestsSort.colId === colId && (requestsSort.dir === 'asc' ? '▲' : '▼')}
                      </span>
                      <span title="نسخ العمود" style={{ display: 'flex' }} onClick={(ev) => { ev.stopPropagation(); copyRequestsColumn(label, displayRequests, getValue); }}>
                        <Copy size={13} style={{ cursor: 'pointer', color: '#3b82f6' }} />
                      </span>
                      <button type="button" className="spreadsheet-header-dropdown-trigger" aria-label={`قائمة ${label}`} onClick={(ev) => { ev.stopPropagation(); openMenuFromHeader(ev); }}>
                        <ChevronDown size={14} />
                      </button>
                    </div>
                  </th>
                );
              })}
              <th
                className="spreadsheet-header-no-menu"
                data-col={3 + dataColumnCount}
                style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9', cursor: 'pointer' }}
                onClick={() => {
                  const nextDir: 'asc' | 'desc' =
                    requestsSort && requestsSort.colId === 'date' && requestsSort.dir === 'asc'
                      ? 'desc'
                      : 'asc';
                  handleRequestsSort('date', nextDir);
                }}
                title="اضغط للترتيب حسب التاريخ"
              >
                التاريخ {requestsSort && requestsSort.colId === 'date' && (requestsSort.dir === 'asc' ? '▲' : '▼')}
              </th>
              <th
                className="spreadsheet-header-no-menu"
                data-col={3 + dataColumnCount + 1}
                style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9' }}
              >
                الملفات
              </th>
            </tr>
          </thead>
          <tbody
            onContextMenu={(e) => {
              const el = (e.target as HTMLElement).closest?.('td[data-row][data-col]') as HTMLElement | null;
              if (el) {
                e.preventDefault();
                setSpreadsheetMenu(m => (m.open ? { ...m, open: false } : m));
                const row = parseInt(el.getAttribute('data-row') ?? '', 10);
                const col = parseInt(el.getAttribute('data-col') ?? '', 10);
                if (!Number.isNaN(row) && !Number.isNaN(col)) {
                  setCellContextMenu({ open: true, x: e.clientX, y: e.clientY, row, col });
                }
              }
            }}
          >
            {displayRequests.map((request, index) => {
              const studentData = students[request.studentId];

              const userRequestsCount = duplicateCountByRow[index];
              const reqKey = `${request.serviceId}_${request.id}`;
              const isSelected = selectedRequestKeys.has(reqKey);
              const rowBg = isSelected ? '#eff6ff' : (index % 2 === 0 ? '#ffffff' : '#f8fafc');

              // Define values list to match headers
              const studentNamesFallback = Array.isArray(request.data?.student_names)
                ? request.data.student_names.filter(Boolean).join(', ')
                : typeof request.data?.student_names === 'string'
                  ? request.data.student_names.replace(/\n/g, ', ')
                  : '';
              const colNameVal = request.data?.full_name_arabic || request.data?.full_name || studentData?.fullNameArabic || studentNamesFallback || 'غير متاح';
              const colNationalIdVal = request.data?.national_id || studentData?.nationalID || '';
              const colWhatsappVal = request.data?.whatsapp_number || request.data?.phone_whatsapp || request.data?.leader_whatsapp || studentData?.whatsappNumber || '';
              const colEmailVal = request.data?.email || studentData?.email || '';
              const colAddressVal = request.data?.address || request.data?.address_details || request.data?.deliveryAddress || '';
              const colDiplomaTypeVal = `${request.data?.diploma_type || request.data?.diplomaType || ''} ${(request.data?.diploma_year || request.data?.diplomaYear) ? `(${request.data?.diploma_year || request.data?.diplomaYear})` : ''}`.trim();
              const colDiplomaYearVal = request.data?.diploma_year || request.data?.diplomaYear || '';
              const colTrackVal = normalizeTrackName(
                request.data?.track ||
                request.data?.track_category ||
                request.data?.track_name ||
                studentData?.track ||
                studentData?.track_name ||
                studentData?.course ||
                ''
              );
              const colCopiesVal = String(request.data?.number_of_copies || '-');
              const colSpecializationVal = request.data?.educational_specialization || '-';
              const colTotalPriceVal = String(request.data?.totalPrice || '-');
              const colNameEnVal = request.data?.full_name_english || '-';
              const colServiceTypeVal = typeof request.data?.selectedCertificate === 'object' ? request.data?.selectedCertificate.name : request.data?.selectedCertificate || '-';
              const colTransTypeVal = request.data?.transformation_type || '-';
              const colExamLangVal = request.data?.selectedExamLanguage || '-';
              const colProjectTitleVal = (() => {
                const t = request.data?.project_title;
                if (t && t !== 'مشروع التخرج' && t !== 'طلب خدمة' && t !== 'طالب') return t;
                return studentData?.course || studentData?.fullNameArabic || '-';
              })();
              const colGroupLinkVal = request.data?.group_link ? <a href={request.data.group_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>الرابط</a> : '-';
              const colLeaderWhatsappVal = request.data?.leader_whatsapp || colWhatsappVal || '-';
              const colDtFawryCodeVal = (() => {
                const direct = request.data?.fawryCode || request.data?.serialNumber || request.data?.fawry_code || request.data?.fawry_number;
                if (direct && String(direct).trim() !== '' && String(direct).trim() !== '-') return String(direct).trim();

                let code = request.id ? dtCodesIndex[String(request.id)] : undefined;
                if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;

                if (request.studentId) {
                  code = adminCodesLookup.dtLatestByStudent?.get(request.studentId);
                  if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                }

                const nat = String(colNationalIdVal || '').replace(/\D/g, '');
                if (nat.length >= 6) {
                  code = adminCodesLookup.dtLatestByNational?.get(nat);
                  if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                }

                const phone = String(colWhatsappVal || '').replace(/\D/g, '');
                const ph10 = phone.length >= 10 ? phone.slice(-10) : phone;
                if (ph10.length >= 10) {
                  code = adminCodesLookup.dtLatestByPhone?.get(ph10);
                  if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                }

                return '-';
              })();
              const colEpOrderNumberVal = (() => {
                let code = request.id ? epCodesIndex[String(request.id)] : undefined;
                if (!code && request.studentId) code = adminCodesLookup.epLatestByStudent?.get(request.studentId);
                if (!code) {
                  const nat = String(colNationalIdVal || '').replace(/\D/g, '');
                  if (nat.length >= 6) code = adminCodesLookup.epLatestByNational?.get(nat);
                }
                if (!code) {
                  const phone = String(colWhatsappVal || '').replace(/\D/g, '');
                  const ph10 = phone.length >= 10 ? phone.slice(-10) : phone;
                  if (ph10.length >= 10) code = adminCodesLookup.epLatestByPhone?.get(ph10);
                }
                return code?.orderNumber || '-';
              })();

              const colStudentNamesVal = (() => {
                const rawNames = request.data?.student_names || request.data?.names || request.data?.names_array || request.data?.student_names_array;
                let names = typeof rawNames === 'string'
                  ? rawNames.split(/[\n\r,،;]+/).map(n => n.trim()).filter(Boolean)
                  : Array.isArray(rawNames) ? rawNames.filter(Boolean) : [];

                const isPlaceholderOnly =
                  names.length === 0 ||
                  (names.length === 1 && (names[0] === 'طالب' || names[0] === 'بدون اسم'));

                if (isPlaceholderOnly) {
                  const fallback =
                    studentData?.fullNameArabic ||
                    request.data?.full_name_arabic ||
                    request.data?.full_name;
                  if (fallback && fallback !== 'طالب') names = [String(fallback)];
                }

                return names.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {names.map((name: string, i: number) => (
                      <div key={i} style={{
                        fontSize: '13px',
                        display: 'flex',
                        gap: '8px',
                        lineHeight: '1.4',
                        padding: '2px 0'
                      }}>
                        <span style={{ color: '#2563eb', fontWeight: '800', minWidth: '20px' }}>{i + 1}.</span>
                        <span style={{ fontWeight: '500' }}>{name}</span>
                      </div>
                    ))}
                  </div>
                ) : '-';
              })();

              let rowValues: any[] = [];
              switch (selectedServiceId) {
                case '2': rowValues = [colNameVal, colWhatsappVal, colDiplomaTypeVal]; break;
                case '3': rowValues = [colCopiesVal, colStudentNamesVal, colWhatsappVal, colAddressVal, colDiplomaTypeVal]; break;
                case '4': rowValues = [colNameVal, colNationalIdVal, colWhatsappVal, colDiplomaTypeVal, colDiplomaYearVal, colTrackVal, colEpOrderNumberVal]; break;
                case '5': rowValues = [colNameVal, colWhatsappVal, colTrackVal, colTotalPriceVal, colSpecializationVal]; break;
                case '6': rowValues = [colNameVal, colNameEnVal, colNationalIdVal, colEmailVal, colWhatsappVal, colServiceTypeVal, colAddressVal, colTotalPriceVal]; break;
                case '7': rowValues = [colNameVal, colNameEnVal, colNationalIdVal, colEmailVal, colWhatsappVal, colTransTypeVal, colExamLangVal, colTotalPriceVal, colDtFawryCodeVal]; break;
                case '8': rowValues = [colNameVal, colWhatsappVal, colAddressVal, colTrackVal]; break;
                case '9': rowValues = [colStudentNamesVal, colLeaderWhatsappVal, colTrackVal, colProjectTitleVal, colGroupLinkVal]; break;
                case '10': rowValues = [colNameVal, colWhatsappVal, colDiplomaYearVal, colTrackVal, colDiplomaTypeVal, colTotalPriceVal]; break;
                case '11': rowValues = [colNameVal, colWhatsappVal, colNationalIdVal, colAddressVal, colTotalPriceVal]; break;
                case '12': rowValues = [colNameVal, request.data?.request_type || '-', request.data?.destination || '-', colTotalPriceVal]; break;
                default:
                  rowValues = [
                    ...(selectedServiceId === 'all'
                      ? [
                          <span
                            key={`svc-badge-${request.id || index}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '3px 10px',
                              borderRadius: '999px',
                              fontSize: '12px',
                              fontWeight: 700,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              whiteSpace: 'nowrap'
                            }}
                          >
                            {resolveServiceName(String(request.serviceId || ''))}
                          </span>
                        ]
                      : []),
                    colNameVal,
                    colNationalIdVal,
                    colWhatsappVal,
                    colEmailVal
                  ];
                  if (hasAddress) rowValues.push(colAddressVal);
                  if (hasDiploma) rowValues.push(colDiplomaTypeVal);
                  if (hasTrack) rowValues.push(colTrackVal);
              }

              return (
                <tr
                  key={request.id ? `${request.serviceId}-${request.id}` : `row-${index}-${request.studentId}-${request.createdAt || ''}`}
                  data-row-index={index}
                  className={isSelected ? 'requests-table-selected-row' : undefined}
                  onMouseEnter={() => {
                    if (isDraggingRowSelectionRef.current && dragRowStartRef.current !== null) {
                      const start = Math.min(dragRowStartRef.current, index);
                      const end = Math.max(dragRowStartRef.current, index);
                      const reqs = displayRequestsRef.current;
                      const next = new Set(initialSelectedKeysAtDragRef.current);
                      for (let i = start; i <= end; i++) {
                        const r = reqs[i];
                        if (r && r.id) next.add(`${r.serviceId}_${r.id}`);
                      }
                      setSelectedRequestKeys(next);
                    }
                  }}
                  onDoubleClick={(e) => {
                    if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                    toggleSelectRequest(reqKey, index, false);
                  }}
                  style={{ background: rowBg, transition: 'background-color 0.12s ease' }}
                >
                  <td
                    data-row={index}
                    data-col={0}
                    className={`spreadsheet-cell${isSelected ? ' bulk-selected-cell' : ''}${gridApi.isCellSelected('requests', index, 0) ? ' selected' : ''}`}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).tagName === 'INPUT') return;
                      toggleSelectRequest(reqKey, index, e.shiftKey);
                    }}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if ((e.target as HTMLElement).closest('button, a')) return;
                      e.preventDefault();
                      document.body.style.userSelect = 'none';
                      isDraggingRowSelectionRef.current = true;
                      dragRowStartRef.current = index;

                      const isCtrl = e.ctrlKey || e.metaKey;
                      const isShift = e.shiftKey;

                      if (isShift && lastSelectedRequestRowIndex !== null) {
                        const start = Math.min(lastSelectedRequestRowIndex, index);
                        const end = Math.max(lastSelectedRequestRowIndex, index);
                        const next = new Set(selectedRequestKeys);
                        for (let i = start; i <= end; i++) {
                          const r = displayRequests[i];
                          if (r && r.id) next.add(`${r.serviceId}_${r.id}`);
                        }
                        setSelectedRequestKeys(next);
                        initialSelectedKeysAtDragRef.current = next;
                      } else {
                        const base = isCtrl ? new Set(selectedRequestKeys) : new Set<string>();
                        initialSelectedKeysAtDragRef.current = base;
                        const next = new Set(base);
                        if (reqKey) {
                          if (isCtrl && selectedRequestKeys.has(reqKey)) {
                            next.delete(reqKey);
                          } else {
                            next.add(reqKey);
                          }
                        }
                        setSelectedRequestKeys(next);
                        setLastSelectedRequestRowIndex(index);
                      }

                      dragStartRef.current = { tableId: 'requests', row: index, col: 0 };
                      gridApi.selectCell('requests', index, 0);
                    }}
                    style={{
                      padding: '10px 8px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      fontWeight: '700',
                      color: isSelected ? '#1d4ed8' : '#475569',
                      fontSize: '14px',
                      verticalAlign: 'middle',
                      cursor: 'crosshair',
                      userSelect: 'none',
                      backgroundColor: isSelected ? '#dbeafe' : undefined
                    }}
                    title="انقر واسحب بالماوس لتحديد صفوف متتالية (مثل الإكسل)"
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                      <GripVertical size={12} style={{ color: isSelected ? '#2563eb' : '#94a3b8', cursor: 'grab' }} />
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          toggleSelectRequest(reqKey, index, (e.nativeEvent as MouseEvent).shiftKey);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          cursor: 'pointer',
                          width: '17px',
                          height: '17px',
                          accentColor: '#2563eb'
                        }}
                        aria-label={`تحديد الطلب رقم ${index + 1}`}
                      />
                      <span>{index + 1}</span>
                    </div>
                  </td>
                  <td
                    data-row={index}
                    data-col={1}
                    className="spreadsheet-cell spreadsheet-cell-actions"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      padding: '7px 5px',
                      border: '1px solid #cbd5e1',
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      verticalAlign: 'middle',
                      minWidth: '214px',
                      maxWidth: '240px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '5px',
                        alignItems: 'stretch',
                        justifyContent: 'center',
                        width: '100%'
                      }}
                      role="group"
                      aria-label="مرحلة الطلب والإجراءات"
                    >
                      {/* صف 1: مراحل الحالة — أفقي دون لف */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          flexWrap: 'nowrap',
                          gap: '3px',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        {(() => {
                          const cur = normalizeWorkflowStatus(request.status);
                          const rid = request.id || '';
                          const sid = request.serviceId;
                          const baseBtn: React.CSSProperties = {
                            padding: '4px',
                            borderRadius: '5px',
                            border: '1px solid',
                            cursor: rid ? 'pointer' : 'not-allowed',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto',
                            minWidth: '28px',
                            minHeight: '28px',
                            transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
                            opacity: rid ? 1 : 0.45
                          };
                          const inactive: React.CSSProperties = {
                            ...baseBtn,
                            background: '#f8fafc',
                            borderColor: '#e2e8f0',
                            color: '#94a3b8',
                            boxShadow: 'none'
                          };
                          const steps: {
                            key: ServiceRequestWorkflowStatus;
                            title: string;
                            Icon: typeof Clock;
                            active: React.CSSProperties;
                          }[] = [
                            {
                              key: 'pending',
                              title: 'قيد الانتظار',
                              Icon: Clock,
                              active: { background: '#fffbeb', borderColor: '#fcd34d', color: '#d97706', boxShadow: '0 1px 2px rgba(245, 158, 11, 0.2)' }
                            },
                            {
                              key: 'submitted',
                              title: 'تم التقديم',
                              Icon: Send,
                              active: { background: '#eff6ff', borderColor: '#93c5fd', color: '#2563eb', boxShadow: '0 1px 2px rgba(37, 99, 235, 0.15)' }
                            },
                            {
                              key: 'receipt_sent',
                              title: 'تم إرسال الإيصال',
                              Icon: FileText,
                              active: { background: '#ecfdf5', borderColor: '#6ee7b7', color: '#047857', boxShadow: '0 1px 2px rgba(5, 150, 105, 0.15)' }
                            },
                            {
                              key: 'completed',
                              title: 'مكتمل',
                              Icon: CheckCircle,
                              active: { background: '#f0fdf4', borderColor: '#86efac', color: '#166534', boxShadow: '0 1px 2px rgba(22, 101, 52, 0.12)' }
                            },
                            {
                              key: 'rejected',
                              title: 'مرفوض',
                              Icon: XCircle,
                              active: { background: '#fef2f2', borderColor: '#fecaca', color: '#dc2626', boxShadow: '0 1px 2px rgba(220, 38, 38, 0.12)' }
                            }
                          ];
                          return steps.map(({ key, title, Icon, active: activeStyle }) => {
                            const isOn = cur === key;
                            const style: React.CSSProperties = isOn ? { ...baseBtn, ...activeStyle } : inactive;
                            return (
                              <button
                                key={key}
                                type="button"
                                title={title}
                                disabled={!rid}
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  if (!rid) return;
                                  if (isOn && key !== 'pending') {
                                    handleStatusChange(rid, 'pending', sid);
                                  } else if (!isOn) {
                                    handleStatusChange(rid, key, sid);
                                  }
                                }}
                                style={style}
                              >
                                <Icon size={14} strokeWidth={isOn ? 2.25 : 1.75} />
                              </button>
                            );
                          });
                        })()}
                      </div>
                      {/* صف 2: عرض، تحميل، تعديل، حذف — صف واحد */}
                      <div
                        style={{
                          display: 'flex',
                          flexDirection: 'row',
                          flexWrap: 'nowrap',
                          gap: '3px',
                          justifyContent: 'center',
                          alignItems: 'center'
                        }}
                      >
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); viewDocuments(request); }}
                          title="عرض المستندات"
                          style={{ padding: '4px', background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', minHeight: '28px' }}
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadAll(request); }}
                          title="تنزيل جميع الصور"
                          style={{ padding: '4px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', minHeight: '28px' }}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onEditRequest(request);
                          }}
                          title="تعديل"
                          style={{ padding: '4px', background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', minHeight: '28px' }}
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteRequest(request.id || '', request.serviceId); }}
                          title="حذف"
                          style={{ padding: '4px', background: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '28px', minHeight: '28px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </td>
                  <td
                    data-row={index}
                    data-col={2}
                    className={`spreadsheet-cell${gridApi.isCellSelected('requests', index, 2) ? ' selected' : ''}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if ((e.target as HTMLElement).closest('button, a, input, select, textarea')) return;
                      if (e.shiftKey && lastSelectedRequestRowIndex !== null) {
                        e.preventDefault();
                        const start = Math.min(lastSelectedRequestRowIndex, index);
                        const end = Math.max(lastSelectedRequestRowIndex, index);
                        const next = new Set(selectedRequestKeys);
                        for (let i = start; i <= end; i++) {
                          const r = displayRequests[i];
                          if (r && r.id) next.add(`${r.serviceId}_${r.id}`);
                        }
                        setSelectedRequestKeys(next);
                        return;
                      }
                      dragStartRef.current = { tableId: 'requests', row: index, col: 2 };
                      gridApi.selectCell('requests', index, 2);
                    }}
                    style={{ padding: '12px 10px', border: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'top' }}
                  >
                    {getStatusBadge(request.status)}
                  </td>

                  {orderedDataIndices.map((localIdx, displayPos) => {
                    const colIndex = 3 + displayPos;
                    const isFromColumns = localIdx < allColumns.length;
                    let val: React.ReactNode = isFromColumns ? rowValues[localIdx] : (() => {
                      const key = extraKeys[localIdx - allColumns.length];
                      const value = request.data?.[key];
                      const stringValue = String(value || '').trim();
                      let displayValue: React.ReactNode = stringValue || '-';
                      if (key === 'wantsMalazem') displayValue = value ? 'نعم' : 'لا';
                      else if (stringValue.startsWith('http')) displayValue = <a href={stringValue} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>فتح الرابط</a>;
                      return displayValue;
                    })();
                    const currentColumn = isFromColumns ? allColumns[localIdx] : null;
                    const dynamicWidthStyle: React.CSSProperties = { whiteSpace: 'nowrap', paddingRight: '4px' };
                    let cellStyle: React.CSSProperties = isFromColumns ? { padding: '12px 10px', border: '1px solid #cbd5e1', fontSize: '14px', color: '#1e293b', textAlign: 'right', verticalAlign: 'top', lineHeight: '1.6' } : { padding: '8px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', textAlign: 'right', verticalAlign: 'top' };
                    if (currentColumn && ['name', 'name_en', 'address', 'project_title', 'group_link', 'student_names'].includes(currentColumn.id)) {
                      dynamicWidthStyle.whiteSpace = 'normal';
                      dynamicWidthStyle.wordBreak = 'break-word';
                      dynamicWidthStyle.minWidth = '220px';
                      dynamicWidthStyle.maxWidth = '350px';
                    } else if (currentColumn && currentColumn.id === 'specialization') {
                      dynamicWidthStyle.whiteSpace = 'normal';
                      dynamicWidthStyle.wordBreak = 'break-word';
                      dynamicWidthStyle.maxWidth = '200px';
                    }

                    // تمييز تكرار رقم الهاتف
                    const getPhoneForCell = () => {
                      if (currentColumn?.id === 'whatsapp') return colWhatsappVal;
                      if (currentColumn?.id === 'leader_whatsapp') return colLeaderWhatsappVal;
                      const k = !isFromColumns ? extraKeys[localIdx - allColumns.length] : null;
                      if (k === 'phone_whatsapp' || k === 'leader_whatsapp' || k === 'whatsapp_number')
                        return request.data?.[k] ?? '';
                      return null;
                    };
                    const cellPhone = getPhoneForCell();
                    const normalizedPhone = cellPhone ? normPhone(String(cellPhone)) : '';
                    const phoneCount = normalizedPhone && normalizedPhone.length >= 10 ? (phoneCounts.get(normalizedPhone) ?? 0) : 0;
                    if (phoneCount > 1) {
                      cellStyle = {
                        ...cellStyle,
                        background: '#fef2f2',
                        borderColor: '#fecaca'
                      };
                      dynamicWidthStyle.whiteSpace = 'normal';
                      dynamicWidthStyle.wordBreak = 'break-word';
                      val = (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <span>{val}</span>
                          <span style={{ fontSize: '11px', color: '#b91c1b', fontWeight: 700 }}>
                            مكرر ({phoneCount})
                          </span>
                        </div>
                      );
                    }
                    if (!isFromColumns) {
                      const key = extraKeys[localIdx - allColumns.length];
                      const stringValue = String(request.data?.[key] ?? '').trim();
                      dynamicWidthStyle.whiteSpace = stringValue.length > 40 ? 'normal' : 'nowrap';
                      dynamicWidthStyle.maxWidth = stringValue.length > 40 ? '300px' : 'none';
                      dynamicWidthStyle.wordBreak = stringValue.length > 40 ? 'break-word' : 'normal';
                    }
                    return (
                      <td
                        key={`cell-${displayPos}-${localIdx}`}
                        data-row={index}
                        data-col={colIndex}
                        className={`spreadsheet-cell${gridApi.isCellSelected('requests', index, colIndex) ? ' selected' : ''}`}
                        onMouseDown={(e) => {
                          if (e.button !== 0) return;
                          if ((e.target as HTMLElement).closest('button, a, input')) return;
                          e.preventDefault();
                          dragStartRef.current = { tableId: 'requests', row: index, col: colIndex };
                          gridApi.selectCell('requests', index, colIndex);
                        }}
                        style={cellStyle}
                      >
                        <div style={dynamicWidthStyle}>
                          {val}
                        </div>
                      </td>
                    );
                  })}

                  {/* عمود التاريخ */}
                  <td
                    data-row={index}
                    data-col={3 + dataColumnCount}
                    className={`spreadsheet-cell${gridApi.isCellSelected('requests', index, 3 + dataColumnCount) ? ' selected' : ''}`}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      if ((e.target as HTMLElement).closest('button, a, input')) return;
                      e.preventDefault();
                      dragStartRef.current = { tableId: 'requests', row: index, col: 3 + dataColumnCount };
                      gridApi.selectCell('requests', index, 3 + dataColumnCount);
                    }}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '12px', color: '#64748b', whiteSpace: 'nowrap', verticalAlign: 'top' }}
                  >
                    {request.createdAt ? new Date(request.createdAt).toLocaleDateString('ar-EG') : '-'}
                  </td>

                  {/* عمود الملفات */}
                  <td
                    data-row={index}
                    data-col={3 + dataColumnCount + 1}
                    className="spreadsheet-cell spreadsheet-cell-actions"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{ padding: '8px 10px', border: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'top' }}
                  >
                    {(() => {
                      const files = studentData?.assignedFiles;
                      const count = Array.isArray(files) ? files.length : 0;
                      if (count === 0) {
                        return <span style={{ color: '#94a3b8', fontSize: '13px' }}>لا يوجد</span>;
                      }
                      return (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onViewAssignedFiles(
                              studentData?.fullNameArabic || request.data?.full_name_arabic || request.data?.full_name || 'طالب',
                              files || []
                            );
                          }}
                          title="عرض التكليفات المُرسلة للطالب"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 10px',
                            background: '#f0f9ff',
                            color: '#0369a1',
                            border: '1px solid #bae6fd',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            fontSize: '13px',
                            fontWeight: 600
                          }}
                        >
                          <Folder size={16} />
                          {count} ملف
                        </button>
                      );
                    })()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminRequestsTable;
