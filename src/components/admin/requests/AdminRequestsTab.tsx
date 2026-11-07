import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Loader2 } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import { SERVICES } from '../../../constants/services';
import { logger } from '../../../utils/logger';
import { useSpreadsheetGrid } from '../../../hooks/useSpreadsheetGrid';
import SpreadsheetContextMenu, { type SpreadsheetMenuAction } from '../../SpreadsheetContextMenu';
import AdminServicesFilesGrid from '../AdminServicesFilesGrid';
import AssignedFilesViewerModal from '../modals/AssignedFilesViewerModal';
import AdminRequestsToolbar from './AdminRequestsToolbar';
import AdminRequestsTable from './AdminRequestsTable';
import AdminRequestsBulkActions from './AdminRequestsBulkActions';
import EditRequestModal from './EditRequestModal';
import DocumentViewerModal from './DocumentViewerModal';
import DefaultColumnsModal from './DefaultColumnsModal';
import {
  REQUEST_SPREADSHEET_STANDARD_KEYS,
  workflowStatusLabelAr,
  workflowStatusRank,
  getStatusBadge,
  translateKey,
  getServiceNameHelper,
  normPhone
} from './requestsHelpers';
import {
  updateServiceRequestStatus,
  updateServiceRequestData,
  deleteServiceRequest,
  getStudentData,
  saveDigitalTransformationCode,
  saveElectronicPaymentCode,
  normalizeArabicText,
  getServiceRequestsCount,
  fetchServiceRequestsPage
} from '../../../services/firebaseService';
import { normalizeTrackName } from '../../../utils/trackUtils';
import {
  buildAdminCodesLookup,
  computeRequestDuplicateCounts,
  normalizeWorkflowStatus
} from '../../../utils/adminRequestsUtils';
import {
  getAutomationApiBaseUrl,
  automationApiMissingMessage,
  getAutomationAuthHeaders,
  prepareAutomationPostBody,
  parseAutomationApiJsonResponse
} from '../../../utils/automationApi';
import { dedupeRequestsByStudent } from '../../../services/cloudinaryRestoreService';
import { triggerWhatsAppNotification } from '../../../utils/whatsapp';
import type {
  ServiceRequest,
  ServiceRequestWorkflowStatus,
  StudentData,
  AssignedFile,
  BookServiceConfig,
  AssignmentsServiceConfig,
  FinalReviewConfig,
  StatementEnrollmentConfig
} from '../../../types';

export interface AdminRequestsTabProps {
  // Global data & state
  serviceRequests: ServiceRequest[];
  setServiceRequests: React.Dispatch<React.SetStateAction<ServiceRequest[]>>;
  dataReady: boolean;
  students: Record<string, StudentData>;
  studentsRef?: React.MutableRefObject<Record<string, StudentData>>;
  dtCodes: any[];
  epCodes: any[];

  // Selected Service
  selectedServiceId: string | null;
  setSelectedServiceId: (id: string | null) => void;
  serviceTotalCounts: Record<string, number>;
  setServiceTotalCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>;

  // Configurations for AdminServicesFilesGrid
  bookConfig: BookServiceConfig | null;
  assignmentsConfig: AssignmentsServiceConfig | null;
  finalReviewConfig?: FinalReviewConfig | null;
  statementEnrollmentConfig: StatementEnrollmentConfig | null;

  // Stats Lock
  statsUnlocked: boolean;
  statsPasswordOpen: boolean;
  setStatsPasswordOpen: React.Dispatch<React.SetStateAction<boolean>>;
  statsPasswordInput: string;
  setStatsPasswordInput: React.Dispatch<React.SetStateAction<string>>;
  tryUnlockStats: () => void;
  handleStatsLockIndicatorClick: (e: React.MouseEvent) => void;
  handleStatsLockIndicatorKeyDown: (e: React.KeyboardEvent) => void;

  // Preferences & Feedback
  adminPrefs?: any;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => void;
  setToastState: React.Dispatch<React.SetStateAction<{ message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null>>;
}

export const AdminRequestsTab: React.FC<AdminRequestsTabProps> = ({
  serviceRequests,
  setServiceRequests,
  dataReady,
  students,
  dtCodes,
  epCodes,
  selectedServiceId,
  setSelectedServiceId,
  serviceTotalCounts,
  setServiceTotalCounts,
  bookConfig,
  assignmentsConfig,
  finalReviewConfig,
  statementEnrollmentConfig,
  statsUnlocked,
  statsPasswordOpen,
  setStatsPasswordOpen,
  statsPasswordInput,
  setStatsPasswordInput,
  tryUnlockStats,
  handleStatsLockIndicatorClick,
  handleStatsLockIndicatorKeyDown,
  adminPrefs,
  showAlert,
  setToastState
}) => {
  // Local state for search & pagination
  const [serviceSearchTerm, setServiceSearchTerm] = useState<string>('');
  const [requestVisibleLimits, setRequestVisibleLimits] = useState<Record<string, number>>({});
  const [serviceLastSnapshots, setServiceLastSnapshots] = useState<Record<string, any>>({});
  const [serviceHasMore, setServiceHasMore] = useState<Record<string, boolean>>({});
  const [isLoadingMoreServiceRequests, setIsLoadingMoreServiceRequests] = useState<boolean>(false);

  // Bulk selection & processing
  const [selectedRequestKeys, setSelectedRequestKeys] = useState<Set<string>>(new Set());
  const [lastSelectedRequestRowIndex, setLastSelectedRequestRowIndex] = useState<number | null>(null);
  const [isBulkProcessingRequests, setIsBulkProcessingRequests] = useState<boolean>(false);
  const [bulkActionProgress, setBulkActionProgress] = useState<{ current: number; total: number; label: string } | null>(null);
  const [quickSelectCount, setQuickSelectCount] = useState<string>('6');
  const isDraggingRowSelectionRef = useRef<boolean>(false);
  const dragRowStartRef = useRef<number | null>(null);
  const initialSelectedKeysAtDragRef = useRef<Set<string>>(new Set());
  const displayRequestsRef = useRef<ServiceRequest[]>([]);

  // Spreadsheet table & layout state
  const gridApi = useSpreadsheetGrid();
  const requestsTableRef = useRef<HTMLDivElement>(null);
  const requestsScrollContainerRef = useRef<HTMLDivElement>(null);
  const requestsSectionRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef<{ tableId: string; row: number; col: number } | null>(null);

  const [requestsDataColumnOrder, setRequestsDataColumnOrder] = useState<number[]>([]);
  const [requestsSort, setRequestsSortState] = useState<{ colId: string; dir: 'asc' | 'desc' } | null>(null);
  const [showDefaultColumnsModal, setShowDefaultColumnsModal] = useState(false);
  const [hasUnsavedLayout, setHasUnsavedLayout] = useState(false);
  const [showCustomOrderInModal, setShowCustomOrderInModal] = useState(false);
  const [layoutsHistory, setLayoutsHistory] = useState<any[]>([]);
  const [activeLayoutDetailId, setActiveLayoutDetailId] = useState<string | null>(null);

  // Context menus
  const [spreadsheetMenu, setSpreadsheetMenu] = useState<{
    open: boolean; x: number; y: number; tableId: string;
    columnLabel?: string; columnIndex?: number;
  }>({ open: false, x: 0, y: 0, tableId: '' });
  const [spreadsheetDropdownColumn, setSpreadsheetDropdownColumn] = useState<number | null>(null);
  const [cellContextMenu, setCellContextMenu] = useState<{ open: boolean; x: number; y: number; row?: number; col?: number }>({ open: false, x: 0, y: 0 });
  const cellContextMenuRef = useRef<HTMLDivElement>(null);

  const requestsGridDataRef = useRef<{
    rowCount: number; colCount: number;
    getCellText: (row: number, col: number) => string;
    setCellValue?: (row: number, col: number, value: string) => void;
  } | null>(null);

  // Modals state
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [tempRequestData, setTempRequestData] = useState<any>({});
  const [isEditingRequestModalOpen, setIsEditingRequestModalOpen] = useState(false);

  const [documentViewer, setDocumentViewer] = useState<{ open: boolean; urls: string[] }>({
    open: false,
    urls: []
  });

  const [assignedFilesViewer, setAssignedFilesViewer] = useState<{
    open: boolean;
    studentName: string;
    files: AssignedFile[];
  }>({ open: false, studentName: '', files: [] });

  // Electronic Payment Automation Queue
  const epAutomationQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const epAutomationQueueDepthRef = useRef(0);

  const enqueueElectronicPaymentAutomation = <T,>(task: (meta: { queuePosition: number }) => Promise<T>): Promise<T> => {
    epAutomationQueueDepthRef.current += 1;
    const queuePosition = epAutomationQueueDepthRef.current;

    const run = () => task({ queuePosition });
    const current = epAutomationQueueRef.current.then(run, run);

    epAutomationQueueRef.current = current;

    return current.finally(() => {
      epAutomationQueueDepthRef.current = Math.max(0, epAutomationQueueDepthRef.current - 1);
    }) as Promise<T>;
  };

  /** Deferred value to keep UI responsive when switching cards */
  const deferredRequestsServiceId = useDeferredValue(selectedServiceId);
  const isRequestsTableSwitchPending = Boolean(
    selectedServiceId && dataReady && deferredRequestsServiceId !== selectedServiceId
  );

  // Service name resolution helper
  const getServiceName = useCallback((serviceId: string): string => {
    return getServiceNameHelper(
      serviceId,
      bookConfig?.serviceName,
      assignmentsConfig?.serviceName,
      finalReviewConfig?.serviceName
    );
  }, [bookConfig?.serviceName, assignmentsConfig?.serviceName, finalReviewConfig?.serviceName]);

  // Request stats & grouping
  const requestStatsByServiceId = useMemo(() => {
    const m: Record<string, { pending: number; total: number }> = {};
    for (const r of serviceRequests) {
      const sid = String(r.serviceId ?? '');
      if (!sid) continue;
      if (!m[sid]) m[sid] = { pending: 0, total: 0 };
      m[sid].total += 1;
      if (normalizeWorkflowStatus(r.status) === 'pending') m[sid].pending += 1;
    }
    return m;
  }, [serviceRequests]);

  const requestsByServiceId = useMemo(() => {
    const m: Record<string, ServiceRequest[]> = {};
    for (const r of serviceRequests) {
      const sid = String(r.serviceId ?? '');
      if (!sid) continue;
      (m[sid] ??= []).push(r);
    }
    for (const sid of Object.keys(m)) {
      m[sid] = dedupeRequestsByStudent(m[sid]);
    }
    return m;
  }, [serviceRequests]);

  // Codes indexes & lookup
  const dtCodesIndex = useMemo(() => {
    const map: Record<string, any> = {};
    dtCodes.forEach(code => {
      if (code.requestId) {
        map[String(code.requestId)] = code;
      }
    });
    return map;
  }, [dtCodes]);

  const epCodesIndex = useMemo(() => {
    const map: Record<string, any> = {};
    epCodes.forEach(code => {
      if (code.requestId) {
        map[String(code.requestId)] = code;
      }
    });
    return map;
  }, [epCodes]);

  const adminCodesLookup = useMemo(() => buildAdminCodesLookup(dtCodes, epCodes), [dtCodes, epCodes]);

  // Auto count loader effect
  useEffect(() => {
    if (!selectedServiceId) return;
    if (serviceTotalCounts[selectedServiceId] !== undefined) return;

    void getServiceRequestsCount(selectedServiceId).then(count => {
      setServiceTotalCounts(prev => ({ ...prev, [selectedServiceId]: count }));
    });
  }, [selectedServiceId, serviceTotalCounts, setServiceTotalCounts]);

  // Reset selection on service change
  useEffect(() => {
    setSelectedRequestKeys(new Set());
    setLastSelectedRequestRowIndex(null);
  }, [selectedServiceId]);

  // Auto scroll to requests section on select
  useEffect(() => {
    if (!selectedServiceId || !requestsSectionRef.current) return;
    const timer = setTimeout(() => {
      requestsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedServiceId]);

  // Load column order & history from localStorage
  useEffect(() => {
    if (!selectedServiceId) {
      setRequestsDataColumnOrder([]);
      setLayoutsHistory([]);
      return;
    }
    try {
      const key = `hp_requests_col_order_${selectedServiceId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRequestsDataColumnOrder(parsed);
        } else {
          setRequestsDataColumnOrder([]);
        }
      } else {
        setRequestsDataColumnOrder([]);
      }
    } catch (e) {
      console.error('Failed to load column order', e);
      setRequestsDataColumnOrder([]);
    }

    try {
      const historyKey = `hp_requests_col_orders_history_${selectedServiceId}`;
      const rawHistory = localStorage.getItem(historyKey);
      if (rawHistory) {
        setLayoutsHistory(JSON.parse(rawHistory));
      } else {
        setLayoutsHistory([]);
      }
    } catch (e) {
      console.error('Failed to load layouts history', e);
      setLayoutsHistory([]);
    }
  }, [selectedServiceId]);

  // Load sort from localStorage
  useEffect(() => {
    const key = `hp_requests_sort_${selectedServiceId || 'all'}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.colId === 'string' &&
          (parsed.dir === 'asc' || parsed.dir === 'desc')
        ) {
          setRequestsSortState({ colId: parsed.colId, dir: parsed.dir });
          setHasUnsavedLayout(false);
          return;
        }
      }
    } catch {
      // ignore
    }
    setRequestsSortState(null);
    setHasUnsavedLayout(false);
  }, [selectedServiceId]);

  const handleRequestsSort = useCallback(
    (colId: string, dir: 'asc' | 'desc') => {
      if (!colId) {
        setRequestsSortState(null);
        setHasUnsavedLayout(true);
        return;
      }
      setRequestsSortState({ colId, dir });
      setHasUnsavedLayout(true);
    },
    []
  );

  const handleSaveLayout = useCallback(() => {
    if (!selectedServiceId) return;
    try {
      const colKey = `hp_requests_col_order_${selectedServiceId}`;
      localStorage.setItem(colKey, JSON.stringify(requestsDataColumnOrder));

      const sortKey = `hp_requests_sort_${selectedServiceId || 'all'}`;
      if (requestsSort) {
        localStorage.setItem(sortKey, JSON.stringify(requestsSort));
      } else {
        localStorage.removeItem(sortKey);
      }

      const now = new Date();
      const timeStr = now.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      const dateStr = now.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

      const newLayout = {
        id: String(Date.now()),
        name: `ترتيب مخصص (${dateStr}، الساعة ${timeStr})`,
        columnOrder: [...requestsDataColumnOrder],
        sort: requestsSort ? { ...requestsSort } : null,
        timestamp: Date.now()
      };

      const historyKey = `hp_requests_col_orders_history_${selectedServiceId}`;
      const updatedHistory = [newLayout, ...layoutsHistory];
      localStorage.setItem(historyKey, JSON.stringify(updatedHistory));
      setLayoutsHistory(updatedHistory);

      setHasUnsavedLayout(false);
      alert('تم حفظ وترخيص ترتيب الجدول الجديد بنجاح وإضافته للمحفوظات!');
    } catch (e) {
      console.error('Failed to save layout', e);
      alert('فشل حفظ ترتيب الجدول.');
    }
  }, [selectedServiceId, requestsDataColumnOrder, requestsSort, layoutsHistory]);

  // Cell context menu close listeners
  useEffect(() => {
    if (!cellContextMenu.open) return;
    const close = () => setCellContextMenu(c => (c.open ? { ...c, open: false } : c));
    const onDown = (e: MouseEvent) => {
      if (cellContextMenuRef.current && !cellContextMenuRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const onScroll = (e: Event) => {
      if (cellContextMenuRef.current && e.target && !cellContextMenuRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [cellContextMenu.open]);

  const scrollActiveCellIntoView = useCallback(() => {
    if (!gridApi.selection) return;
    const container = requestsScrollContainerRef.current;
    if (!container) return;
    const { endRow, endCol } = gridApi.selection;
    const cell = container.querySelector<HTMLTableCellElement>(`td[data-row="${endRow}"][data-col="${endCol}"]`);
    if (!cell) return;
    const cellRect = cell.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    if (cellRect.left < containerRect.left) {
      container.scrollLeft -= (containerRect.left - cellRect.left) + 40;
    } else if (cellRect.right > containerRect.right) {
      container.scrollLeft += (cellRect.right - containerRect.right) + 40;
    }
  }, [gridApi.selection]);

  // Keyboard navigation effect
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (gridApi.activeTableId !== 'requests' || !gridApi.selection) return;

      const sel = gridApi.selection;
      const data = requestsGridDataRef.current;
      const rowCount = data?.rowCount ?? 0;
      const colCount = data?.colCount ?? 0;

      let moved = false;

      if (e.key === 'ArrowDown' && sel.endRow < rowCount - 1) {
        e.preventDefault();
        gridApi.selectCell('requests', sel.endRow + 1, sel.endCol);
        moved = true;
      } else if (e.key === 'ArrowUp' && sel.endRow > 0) {
        e.preventDefault();
        gridApi.selectCell('requests', sel.endRow - 1, sel.endCol);
        moved = true;
      } else if (e.key === 'ArrowRight' && sel.endCol > 0) {
        e.preventDefault();
        gridApi.selectCell('requests', sel.endRow, sel.endCol - 1);
        moved = true;
      } else if (e.key === 'ArrowLeft' && sel.endCol < colCount - 1) {
        e.preventDefault();
        gridApi.selectCell('requests', sel.endRow, sel.endCol + 1);
        moved = true;
      } else if (e.ctrlKey && e.code === 'KeyC') {
        e.preventDefault();
        if (!data) return;
        const sr = Math.min(sel.startRow, sel.endRow);
        const er = Math.max(sel.startRow, sel.endRow);
        const sc = Math.min(sel.startCol, sel.endCol);
        const ec = Math.max(sel.startCol, sel.endCol);
        const values: string[][] = [];
        for (let r = sr; r <= er; r++) {
          const row: string[] = [];
          for (let c = sc; c <= ec; c++) row.push(data.getCellText(r, c));
          values.push(row);
        }
        gridApi.copyToClipboard(values, false);
        try { navigator.clipboard.writeText(values.map(row => row.join('\t')).join('\n')); } catch (_) {}
        setToastState({ message: 'تم النسخ إلى الحافظة', type: 'success', duration: 1500 });
      } else if (e.ctrlKey && e.code === 'KeyV') {
        e.preventDefault();
        const { values } = gridApi.getClipboard();
        if (!values.length || !data?.setCellValue) return;
        const sr = sel.startRow;
        const sc = sel.startCol;
        for (let r = 0; r < values.length; r++) {
          const row = values[r];
          for (let c = 0; c < row.length; c++) {
            const rowIndex = sr + r;
            const colIndex = sc + c;
            if (rowIndex < rowCount && colIndex < colCount) data.setCellValue!(rowIndex, colIndex, row[c]);
          }
        }
        gridApi.clearClipboardAfterPaste();
        setToastState({ message: 'تم اللصق', type: 'success', duration: 1500 });
      } else if (e.key === 'Enter') {
        e.preventDefault();
        gridApi.startEditing('requests', sel.endRow, sel.endCol);
      } else if (e.key === 'Escape') {
        gridApi.stopEditing();
        setSpreadsheetMenu(m => (m.open ? { ...m, open: false } : m));
      }

      if (moved) {
        setTimeout(() => {
          scrollActiveCellIntoView();
        }, 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gridApi, scrollActiveCellIntoView, setToastState]);

  // Mouse drag range effect
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDraggingRowSelectionRef.current && dragRowStartRef.current !== null) {
        const tr = (e.target as HTMLElement).closest('tr[data-row-index]');
        if (tr) {
          const idx = parseInt(tr.getAttribute('data-row-index') || '', 10);
          if (!Number.isNaN(idx)) {
            const start = Math.min(dragRowStartRef.current, idx);
            const end = Math.max(dragRowStartRef.current, idx);
            const reqs = displayRequestsRef.current;
            const next = new Set(initialSelectedKeysAtDragRef.current);
            for (let i = start; i <= end; i++) {
              const r = reqs[i];
              if (r && r.id) next.add(`${r.serviceId}_${r.id}`);
            }
            setSelectedRequestKeys(next);
          }
        }
      }

      if (!dragStartRef.current) return;
      const t = (e.target as HTMLElement).closest('[data-row][data-col]');
      if (t) {
        const r = parseInt(t.getAttribute('data-row')!, 10);
        const c = parseInt(t.getAttribute('data-col')!, 10);
        const isActionsCell = t.classList.contains('spreadsheet-cell-actions');
        if (!Number.isNaN(r) && !Number.isNaN(c) && c !== 1 && !isActionsCell) {
          gridApi.selectRange(dragStartRef.current.tableId, dragStartRef.current.row, dragStartRef.current.col, r, c);
        }
      }

      const edgeThreshold = 80;
      const scrollStep = 25;
      const viewportHeight = window.innerHeight || 0;
      if (e.clientY < edgeThreshold) {
        window.scrollBy({ top: -scrollStep, behavior: 'auto' });
      } else if (e.clientY > viewportHeight - edgeThreshold) {
        window.scrollBy({ top: scrollStep, behavior: 'auto' });
      }

      const container = requestsScrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        const horizontalThreshold = 60;
        if (e.clientX < rect.left + horizontalThreshold) {
          container.scrollLeft -= scrollStep;
        } else if (e.clientX > rect.right - horizontalThreshold) {
          container.scrollLeft += scrollStep;
        }
      }
    };
    const onUp = () => {
      dragStartRef.current = null;
      if (isDraggingRowSelectionRef.current) {
        isDraggingRowSelectionRef.current = false;
        dragRowStartRef.current = null;
        document.body.style.userSelect = '';
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [gridApi.selectRange]);

  // Grid clear on outside click
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (gridApi.activeTableId !== 'requests' || !gridApi.selection) return;
      const cell = target.closest('td[data-row][data-col]');
      const col = cell ? parseInt(cell.getAttribute('data-col') ?? '', 10) : -1;
      if (col === 1 || (cell && cell.classList.contains('spreadsheet-cell-actions'))) {
        gridApi.clearSelection();
        return;
      }
      if (!cell) {
        gridApi.clearSelection();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [gridApi.activeTableId, gridApi.selection, gridApi.clearSelection]);

  // Request actions & handlers
  const handleStatusChange = async (requestId: string, status: ServiceRequestWorkflowStatus, serviceId: string) => {
    try {
      await updateServiceRequestStatus(requestId, status, serviceId);

      const request = serviceRequests.find(r => r.id === requestId);
      let studentName = '';
      let whatsappNumber = '';
      let nationalID = '';
      let serviceName = '';
      let address = '';

      if (request) {
        let studentData: StudentData | null = students[request.studentId] ?? null;
        if (!studentData) {
          try {
            studentData = await getStudentData(request.studentId);
          } catch (e) {
            logger.error('Error fetching student data', e);
          }
        }
        if (studentData) {
          studentName = studentData.fullNameArabic || '';
          whatsappNumber = studentData.whatsappNumber || '';
          nationalID = studentData.nationalID || '';
          if (studentData.address) {
            if (typeof studentData.address === 'object') {
              address = `${studentData.address.governorate || ''}, ${studentData.address.city || ''}, ${studentData.address.street || ''}, ${studentData.address.building || ''}, ${studentData.address.siteNumber || ''}${studentData.address.landmark ? `, ${studentData.address.landmark}` : ''}`.replace(/^,\s*|,\s*$/g, '').replace(/,\s*,/g, ',');
            } else {
              address = String(studentData.address);
            }
          }
        }
        if (request.data) {
          address = request.data.address || request.data.address_details || request.data.deliveryAddress || address;
        }
        const service = SERVICES.find(s => s.id === serviceId);
        if (service) {
          serviceName = service.nameAr;
        }
      }

      triggerWhatsAppNotification(requestId, serviceId, status, {
        studentName,
        whatsappNumber,
        nationalID,
        serviceName,
        address,
        wapilotToken: adminPrefs?.wapilotToken,
        wapilotInstanceId: adminPrefs?.wapilotInstanceId,
        wapilotEnabled: adminPrefs?.wapilotEnabled,
        serviceReplies: adminPrefs?.serviceReplies
      });

      // Digital Transformation automation
      if (String(serviceId) === '7' && status === 'completed') {
        const reqItem = serviceRequests.find(r => r.id === requestId);
        if (reqItem) {
          let studentData = students[reqItem.studentId];
          if (!studentData) {
            try {
              const fetchedData = await getStudentData(reqItem.studentId);
              if (fetchedData) studentData = fetchedData;
            } catch (e) {
              logger.error('Error fetching student data directly', e);
            }
          }
          const rd = reqItem.data || {};
          const sd = studentData;
          if (sd || (rd && Object.keys(rd).length > 0)) {
            setToastState({ message: 'جاري الحصول على كود التحول الرقمي… قد يستغرق دقيقة أو أكثر.', type: 'loading', duration: 3000 });

            const payload = {
              requestId: requestId,
              studentId: reqItem.studentId,
              email: rd.email || sd?.email || '',
              fullNameArabic: rd.full_name_arabic || rd.full_name || sd?.fullNameArabic || '',
              fullNameEnglish: rd.full_name_english || sd?.vehicleNameEnglish || '',
              nationalID: rd.national_id || sd?.nationalID || '',
              phone: rd.whatsapp_number || sd?.whatsappNumber || '',
              examLanguage: rd.exam_language || rd.selectedExamLanguage || 'عربي'
            };

            const API_BASE_URL = getAutomationApiBaseUrl();
            if (!API_BASE_URL) {
              setToastState({ message: automationApiMissingMessage(), type: 'error', duration: 12000 });
              return;
            }
            const apiUrl = `${API_BASE_URL}/api/digital-transformation/register`;
            const ac = new AbortController();
            const abortTimer = setTimeout(() => ac.abort(), 480000);

            const authHeaders = await getAutomationAuthHeaders();
            const preparedPost = await prepareAutomationPostBody(API_BASE_URL, payload);
            const bodyToSend = preparedPost.body;
            const sessionAesKey = preparedPost.sessionAesKey;

            fetch(apiUrl, {
              method: 'POST',
              headers: authHeaders,
              body: JSON.stringify(bodyToSend),
              signal: ac.signal
            })
              .then(async (res) => {
                clearTimeout(abortTimer);
                const ct = res.headers.get('content-type') || '';
                let data: { success?: boolean; error?: string; data?: Record<string, unknown> } = {};
                if (ct.includes('application/json')) {
                  try {
                    const rawJson = await res.json();
                    data = await parseAutomationApiJsonResponse(rawJson, sessionAesKey);
                  } catch (e) {
                    logger.error('DT: JSON parse error', e);
                    setToastState({ message: 'رد غير صالح من خادم الأتمتة (ليس JSON). تحقق من VITE_API_URL والـ CORS.', type: 'error', duration: 8000 });
                    return;
                  }
                } else {
                  const text = await res.text();
                  logger.error('DT: non-JSON response', res.status, text.slice(0, 300));
                  setToastState({
                    message: `السيرفر رد بملف HTML أو نص (HTTP ${res.status}) وليس JSON — غالبًا VITE_API_URL يشير لنطاق الواجهة وليس خادم Node. راجع الإعدادات.`,
                    type: 'error',
                    duration: 12000
                  });
                  return;
                }

                if (!res.ok) {
                  const msg = typeof data.error === 'string' && data.error ? data.error : `خطأ HTTP ${res.status} من خادم الأتمتة`;
                  logger.error('Automation HTTP error:', res.status, data);
                  setToastState({ message: `فشلت الأتمتة: ${msg}`, type: 'error', duration: 8000 });
                  return;
                }

                if (!data.success) {
                  logger.error('Automation Error:', data.error);
                  setToastState({ message: `فشلت الأتمتة: ${data.error || 'بدون تفاصيل'}`, type: 'error' });
                  return;
                }

                const row = data.data && typeof data.data === 'object' ? data.data : {};
                let fawryCode = String(row.fawryCode ?? '').trim();
                if ((!fawryCode || fawryCode === 'undefined' || fawryCode === 'null') && Array.isArray(row.allData) && row.allData[2]) {
                  fawryCode = String(row.allData[2]).trim();
                }
                if (!fawryCode || fawryCode === 'undefined' || fawryCode === 'null') {
                  const blob = [
                    typeof row.pageText === 'string' ? row.pageText : '',
                    typeof row.pageContent === 'string' ? row.pageContent.replace(/<[^>]+>/g, ' ') : ''
                  ].join('\n');
                  const candidates = blob.match(/\b\d{9,12}\b/g) ?? [];
                  for (const c of candidates) {
                    if (!/^01\d{8,10}$/.test(c)) {
                      fawryCode = c.trim();
                      break;
                    }
                  }
                }
                if (!fawryCode || fawryCode === 'undefined' || fawryCode === 'null') {
                  const meta = (data as { serverMeta?: { dtApi?: string } }).serverMeta;
                  logger.error('DT: success لكن بدون fawryCode', { rowKeys: Object.keys(row), serverMeta: meta });
                  const msg = meta?.dtApi
                    ? 'لم يُستخرج كود فوري من صفحة الجامعة رغم اتصال السيرفر. جرّب لاحقًا، وراجع بيانات الطالب (البريد والرقم القومي). إن تكرر الأمر، انظر سجلات خادم الأتمتة.'
                    : 'لم يُستخرج كود فوري في الرد. راجع بيانات الطالب (مثل صحة البريد دون أخطاء إملائية)، ثم أعد المحاولة. إن استمر الخطأ، تأكد من تحديث نشر خادم الأتمتة والواجهة ومراجعة السجلات.';
                  setToastState({ message: msg, type: 'error', duration: 16000 });
                  return;
                }

                setToastState(null);

                setTimeout(async () => {
                  try {
                    const codeData = {
                      studentId: reqItem.studentId || '',
                      requestId: requestId || '',
                      email: payload.email || '',
                      fullNameArabic: payload.fullNameArabic || '',
                      fullNameEnglish: payload.fullNameEnglish || '',
                      phone: payload.phone || '',
                      examLanguage: payload.examLanguage || '',
                      serialNumber: String(row.serialNumber ?? '') || '',
                      name: String(row.name ?? '') || payload.fullNameArabic || '',
                      fawryCode,
                      mobile: String(row.mobile ?? '') || payload.phone || '',
                      whatsapp: String(row.whatsapp ?? '') || '',
                      type: String(row.type ?? '') || rd.transformation_type || '',
                      transformationType: rd.transformation_type || '',
                      value: String(row.value ?? '') || (rd.totalPrice ? String(rd.totalPrice) : '') || '',
                      totalPrice: rd.totalPrice || '',
                      status: String(row.status ?? '') || '',
                      createdAt: new Date().toISOString()
                    };

                    await saveDigitalTransformationCode(codeData);
                    try {
                      await updateServiceRequestData(requestId, '7', { ...rd, fawryCode, serialNumber: String(row.serialNumber ?? '') });
                    } catch (e) {
                      logger.warn('Could not update request with fawryCode (non-fatal)', e);
                    }
                    setToastState({
                      message: `تم الحفظ — كود فوري: ${fawryCode || '—'}`,
                      type: 'success',
                      duration: 7000
                    });
                  } catch (saveError) {
                    logger.error('Save Error:', saveError);
                    setToastState({ message: 'نجحت الأتمتة ولكن فشل الحفظ في قاعدة البيانات', type: 'error', duration: 5000 });
                  }
                }, 500);
              })
              .catch(err => {
                clearTimeout(abortTimer);
                logger.error('Connection Error:', err);
                const aborted = err?.name === 'AbortError';
                setToastState({
                  message: aborted
                    ? 'انتهت مهلة انتظار الأتمتة (8 دقائق). جرّب مرة أخرى؛ على Hugging Face قد يحتاج الـ Space وقتًا بعد السكون.'
                    : 'لا يمكن الاتصال بخدمة الأتمتة (شبكة، CORS، أو الرابط). افتح F12 → Network وتأكد من طلب hf.space.',
                  type: 'error',
                  duration: 12000
                });
              });
          }
        }
      }

      // Electronic Payment automation
      if (String(serviceId) === '4' && status === 'completed') {
        const reqItem = serviceRequests.find(r => r.id === requestId);
        if (reqItem) {
          let studentData = students[reqItem.studentId];
          if (!studentData) {
            try {
              const fetchedData = await getStudentData(reqItem.studentId);
              if (fetchedData) studentData = fetchedData;
            } catch (e) {
              logger.error('Error fetching student data directly', e);
            }
          }
          const rdEp = reqItem.data || {};
          const sdEp = studentData;
          if (sdEp || (rdEp && Object.keys(rdEp).length > 0)) {
            await enqueueElectronicPaymentAutomation(async ({ queuePosition }) => {
              setToastState({
                message: queuePosition > 1
                  ? `طلب الدفع في انتظار الدور (رقم ${queuePosition})...`
                  : 'جاري استخراج الرقم المرجعي لفوري من بوابة الدفع...',
                type: 'loading',
                duration: 60000
              });

              const payload = {
                requestId: requestId,
                studentId: reqItem.studentId,
                email: rdEp.email || sdEp?.email || '',
                fullNameArabic: rdEp.full_name_arabic || rdEp.full_name || sdEp?.fullNameArabic || '',
                nationalID: rdEp.national_id || sdEp?.nationalID || '',
                phone: rdEp.whatsapp_number || sdEp?.whatsappNumber || ''
              };

              if (!payload.fullNameArabic || !payload.nationalID || !payload.phone) {
                setToastState({
                  message: 'بيانات الطالب غير مكتملة (الاسم أو الرقم القومي أو الموبايل مفقود).',
                  type: 'error',
                  duration: 8000
                });
                return;
              }

              const API_BASE_URL_EP = getAutomationApiBaseUrl();
              if (!API_BASE_URL_EP) {
                setToastState({ message: automationApiMissingMessage(), type: 'error', duration: 12000 });
                return;
              }
              const apiUrl = `${API_BASE_URL_EP}/api/electronic-payment/create`;
              const acEp = new AbortController();
              const abortTimerEp = setTimeout(() => acEp.abort(), 480000);

              try {
                const authHeadersEp = await getAutomationAuthHeaders();
                const preparedEp = await prepareAutomationPostBody(API_BASE_URL_EP, payload);
                const bodyToSendEp = preparedEp.body;
                const sessionAesKeyEp = preparedEp.sessionAesKey;

                const res = await fetch(apiUrl, {
                  method: 'POST',
                  headers: authHeadersEp,
                  body: JSON.stringify(bodyToSendEp),
                  signal: acEp.signal,
                  keepalive: true
                });

                const ct = res.headers.get('content-type') || '';
                let data: { success?: boolean; error?: string; data?: Record<string, unknown> } = {};
                if (ct.includes('application/json')) {
                  try {
                    const rawJsonEp = await res.json();
                    data = await parseAutomationApiJsonResponse(rawJsonEp, sessionAesKeyEp);
                  } catch (e) {
                    logger.error('[EP] JSON parse error', e);
                    setToastState({ message: 'رد غير صالح من خادم الأتمتة (ليس JSON).', type: 'error', duration: 8000 });
                    return;
                  }
                } else {
                  const text = await res.text();
                  logger.error('[EP] non-JSON', res.status, text.slice(0, 300));
                  setToastState({
                    message: `رد غير JSON (HTTP ${res.status}). تحقق من VITE_API_URL.`,
                    type: 'error',
                    duration: 12000
                  });
                  return;
                }

                if (!res.ok) {
                  const msg = typeof data.error === 'string' && data.error ? data.error : `خطأ HTTP ${res.status}`;
                  logger.error('[EP] HTTP error', res.status, data);
                  setToastState({ message: `فشلت الأتمتة: ${msg}`, type: 'error', duration: 8000 });
                  return;
                }

                if (!data.success) {
                  logger.error('[EP] Automation Error:', data.error);
                  setToastState({ message: `فشلت الأتمتة: ${data.error || 'بدون تفاصيل'}`, type: 'error' });
                  return;
                }

                const ep = data.data && typeof data.data === 'object' ? data.data : {};
                const isValidRefNum = (num: string) => {
                  const s = String(num || '').trim().replace(/\D/g, '');
                  return s.length >= 9 && s.length <= 11 && !s.startsWith('2024') && !s.startsWith('2025') && !s.startsWith('2026');
                };

                let orderNumber = String(ep.referenceNumber || ep.orderNumber || '').trim();
                if (!isValidRefNum(orderNumber) && typeof ep.rawText === 'string') {
                  const m =
                    ep.rawText.match(/الرقم\s*المرجعي[\s\S]*?([98][0-9]{9})/) ||
                    ep.rawText.match(/في\s*انتظار\s*الدفع[\s\S]*?([98][0-9]{9})/) ||
                    ep.rawText.match(/([98][0-9]{9})\s*[\r\n\s]*\[?فتح\]?/) ||
                    ep.rawText.match(/\b(9[0-9]{9})\b/);
                  if (m?.[1] && isValidRefNum(m[1])) {
                    orderNumber = m[1].trim();
                  }
                }
                if (!orderNumber || orderNumber === 'undefined' || orderNumber === 'null') {
                  setToastState({ message: 'رد السيرفر لا يحتوي على رقم مرجعي صالح من فوري. راجع سجلات خادم الأتمتة.', type: 'error', duration: 8000 });
                  return;
                }

                setToastState(null);
                await new Promise((resolve) => setTimeout(resolve, 500));
                try {
                  const codeData = {
                    studentId: String(ep.studentId || reqItem.studentId || ''),
                    requestId: String(ep.requestId || requestId || ''),
                    name: String(ep.name || ''),
                    email: String(ep.email || ''),
                    nationalID: String(ep.nationalID || ''),
                    mobile: String(ep.mobile || ''),
                    entity: String(ep.entity || 'كلية التربية'),
                    serviceType: String(ep.serviceType || 'دبلوم (2025 - 2026)'),
                    orderNumber,
                    referenceNumber: orderNumber,
                    status: String(ep.status || 'NEW'),
                    rawText: String(ep.rawText || ''),
                    createdAt: new Date().toISOString()
                  };

                  await saveElectronicPaymentCode(codeData);
                  setToastState({
                    message: `تم الحفظ — الرقم المرجعي: ${orderNumber || '—'}`,
                    type: 'success',
                    duration: 7000
                  });
                } catch (saveError) {
                  logger.error('[EP] Save Error:', saveError);
                  setToastState({ message: 'نجحت الأتمتة ولكن فشل الحفظ', type: 'error', duration: 5000 });
                }
              } catch (err: any) {
                logger.error('[EP] Connection Error:', err);
                const aborted = err?.name === 'AbortError';
                setToastState({
                  message: aborted
                    ? 'انتهت مهلة انتظار أتمتة الدفع (8 دقائق). جرّب مرة أخرى.'
                    : 'لا يمكن الاتصال بخدمة الأتمتة. افتح F12 → Network.',
                  type: 'error',
                  duration: 12000
                });
              } finally {
                clearTimeout(abortTimerEp);
              }
            });
          }
        }
      }

    } catch (error: any) {
      setToastState({ message: error.message || 'حدث خطأ أثناء تحديث حالة الطلب', type: 'error' });
    }
  };

  const handleDeleteRequest = async (requestId: string, serviceId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) {
      return;
    }
    try {
      await deleteServiceRequest(requestId, serviceId);
      setToastState({ message: 'تم حذف الطلب بنجاح', type: 'success' });
    } catch (error: any) {
      setToastState({ message: error.message || 'حدث خطأ أثناء حذف الطلب', type: 'error' });
    }
  };

  const handleBulkStatusChange = async (targetStatus: ServiceRequestWorkflowStatus, reqsToProcess: ServiceRequest[]) => {
    if (!reqsToProcess.length) return;

    const statusLabels: Record<ServiceRequestWorkflowStatus, string> = {
      pending: 'قيد الانتظار',
      submitted: 'تم التقديم',
      receipt_sent: 'تم إرسال الإيصال',
      completed: 'مكتمل (قبول)',
      rejected: 'مرفوض (إلغاء)'
    };
    const targetLabel = statusLabels[targetStatus] || targetStatus;

    if (!window.confirm(`هل أنت متأكد من تغيير حالة ${reqsToProcess.length} طلب إلى "${targetLabel}"؟`)) {
      return;
    }

    setIsBulkProcessingRequests(true);
    setBulkActionProgress({ current: 0, total: reqsToProcess.length, label: `جاري تحويل الطلبات إلى "${targetLabel}"...` });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < reqsToProcess.length; i++) {
      const req = reqsToProcess[i];
      setBulkActionProgress({
        current: i + 1,
        total: reqsToProcess.length,
        label: `جاري تحديث طلب ${i + 1} من ${reqsToProcess.length}...`
      });

      try {
        if (req.id && req.serviceId) {
          await handleStatusChange(req.id, targetStatus, req.serviceId);
          successCount++;
        }
      } catch (err) {
        logger.error('Bulk status update error for request:', req.id, err);
        failCount++;
      }
      await new Promise(r => setTimeout(r, 60));
    }

    setIsBulkProcessingRequests(false);
    setBulkActionProgress(null);
    setSelectedRequestKeys(new Set());
    setLastSelectedRequestRowIndex(null);

    if (failCount === 0) {
      setToastState({
        message: `تم بنجاح تحديث ${successCount} طلب إلى "${targetLabel}" 🎉`,
        type: 'success',
        duration: 4000
      });
    } else {
      setToastState({
        message: `تم تحديث ${successCount} طلب، وتعذر تحديث ${failCount} طلب.`,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleBulkDelete = async (reqsToProcess: ServiceRequest[]) => {
    if (!reqsToProcess.length) return;

    if (!window.confirm(`⚠️ تحذير: هل أنت متأكد من حذف ${reqsToProcess.length} طلب نهائياً من قاعدة البيانات؟ لا يمكن التراجع عن هذا الإجراء.`)) {
      return;
    }

    setIsBulkProcessingRequests(true);
    setBulkActionProgress({ current: 0, total: reqsToProcess.length, label: 'جاري حذف الطلبات المحددة...' });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < reqsToProcess.length; i++) {
      const req = reqsToProcess[i];
      setBulkActionProgress({
        current: i + 1,
        total: reqsToProcess.length,
        label: `جاري حذف طلب ${i + 1} من ${reqsToProcess.length}...`
      });

      try {
        if (req.id && req.serviceId) {
          await deleteServiceRequest(req.id, req.serviceId);
          successCount++;
        }
      } catch (err) {
        logger.error('Bulk delete error for request:', req.id, err);
        failCount++;
      }
      await new Promise(r => setTimeout(r, 50));
    }

    setIsBulkProcessingRequests(false);
    setBulkActionProgress(null);
    setSelectedRequestKeys(new Set());
    setLastSelectedRequestRowIndex(null);

    if (failCount === 0) {
      setToastState({
        message: `تم حذف ${successCount} طلب بنجاح نهائياً`,
        type: 'success',
        duration: 4000
      });
    } else {
      setToastState({
        message: `تم حذف ${successCount} طلب، وتعذر حذف ${failCount} طلب.`,
        type: 'error',
        duration: 5000
      });
    }
  };

  const handleBulkDownloadZip = async (reqsToProcess: ServiceRequest[]) => {
    if (!reqsToProcess.length) return;

    setIsBulkProcessingRequests(true);
    setBulkActionProgress({ current: 0, total: reqsToProcess.length, label: 'جاري جمع الصور والملفات للطلبات المحددة...' });

    try {
      const zip = new JSZip();
      let totalFilesFound = 0;

      for (let i = 0; i < reqsToProcess.length; i++) {
        const req = reqsToProcess[i];
        setBulkActionProgress({
          current: i + 1,
          total: reqsToProcess.length,
          label: `جاري تجهيز مرفقات طلب ${i + 1} من ${reqsToProcess.length}...`
        });

        const rawName: string = String(
          req.data?.full_name_arabic ||
          req.data?.full_name ||
          req.data?.student_names ||
          ''
        ).trim();
        const rawPhone: string = String(
          req.data?.whatsapp_number ||
          req.data?.phone_whatsapp ||
          req.data?.phone ||
          ''
        ).replace(/\D/g, '').trim();

        const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_') || `request_${req.id || i + 1}`;
        const folderName = `${i + 1}_${rawPhone ? `${safeName} - ${rawPhone}` : safeName}`;
        const folder = zip.folder(folderName) || zip;

        const imagesToDownload: { url: string; name: string }[] = [];
        if (req.data?.receiptUrl) {
          imagesToDownload.push({ url: req.data.receiptUrl, name: `receipt_${req.id}.jpg` });
        }
        if (req.documents && req.documents.length > 0) {
          req.documents.forEach((doc, idx) => {
            if (doc.type !== 'PDF') {
              imagesToDownload.push({
                url: doc.url,
                name: `${doc.name || 'attachment'}_${idx + 1}.jpg`
              });
            }
          });
        }

        for (const img of imagesToDownload) {
          try {
            let blob: Blob;
            if (img.url.startsWith('data:')) {
              const parts = img.url.split(',');
              const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
              const binStr = atob(parts[1]);
              const u8 = new Uint8Array(binStr.length);
              for (let j = 0; j < binStr.length; j++) u8[j] = binStr.charCodeAt(j);
              blob = new Blob([u8], { type: mime });
            } else {
              const response = await fetch(img.url);
              blob = await response.blob();
            }
            folder.file(img.name, blob);
            totalFilesFound++;
          } catch (e) {
            logger.error('Error fetching image for bulk zip', img.url, e);
          }
        }
      }

      if (totalFilesFound === 0) {
        setToastState({ message: 'لم يتم العثور على أي صور أو إيصالات في الطلبات المحددة', type: 'error' });
        setIsBulkProcessingRequests(false);
        setBulkActionProgress(null);
        return;
      }

      setBulkActionProgress({ current: reqsToProcess.length, total: reqsToProcess.length, label: 'جاري إنشاء ملف ZIP وتنزيله...' });
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `ملفات_الطلبات_المحددة_${reqsToProcess.length}_طلب.zip`);
      setToastState({ message: `تم تنزيل ${totalFilesFound} ملف بنجاح في ملف مضغوط`, type: 'success' });
    } catch (err) {
      logger.error('Error in bulk download zip', err);
      setToastState({ message: 'حدث خطأ أثناء تنزيل الملفات المضغوطة', type: 'error' });
    } finally {
      setIsBulkProcessingRequests(false);
      setBulkActionProgress(null);
    }
  };

  const handleDownloadAll = async (request: ServiceRequest) => {
    const imagesToDownload: { url: string; name: string }[] = [];

    if (request.data?.receiptUrl) {
      imagesToDownload.push({ url: request.data.receiptUrl, name: `receipt_${request.id}.jpg` });
    }

    if (request.documents && request.documents.length > 0) {
      request.documents.forEach((doc, idx) => {
        if (doc.type !== 'PDF') {
          imagesToDownload.push({
            url: doc.url,
            name: `${doc.name || 'attachment'}_${idx + 1}.jpg`
          });
        }
      });
    }

    if (imagesToDownload.length === 0) {
      setToastState({ message: 'لا توجد صور للتحميل', type: 'error' });
      return;
    }

    try {
      setToastState({ message: 'جاري تجهيز ملف الصور المضغوط...', type: 'loading', duration: 4000 });

      const rawName: string = String(
        request.data?.full_name_arabic ||
        request.data?.full_name ||
        request.data?.student_names ||
        ''
      ).trim();
      const rawPhone: string = String(
        request.data?.whatsapp_number ||
        request.data?.phone_whatsapp ||
        request.data?.phone ||
        ''
      ).replace(/\D/g, '').trim();

      const safeName = rawName.replace(/[\\/:*?"<>|]/g, '_') || `request_${request.id || 'unknown'}`;
      const zipBaseName = rawPhone ? `${safeName} - ${rawPhone}` : safeName;

      const zip = new JSZip();
      const folder = zip.folder(zipBaseName) || zip;

      for (const img of imagesToDownload) {
        try {
          let blob: Blob;
          if (img.url.startsWith('data:')) {
            const parts = img.url.split(',');
            const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
            const binStr = atob(parts[1]);
            const u8 = new Uint8Array(binStr.length);
            for (let j = 0; j < binStr.length; j++) u8[j] = binStr.charCodeAt(j);
            blob = new Blob([u8], { type: mime });
          } else {
            const response = await fetch(img.url);
            blob = await response.blob();
          }
          folder.file(img.name, blob);
        } catch (error) {
          console.error('Download error (skipped in zip):', error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const zipName = `${zipBaseName}.zip`;
      saveAs(content, zipName);

      setToastState({ message: 'تم تجهيز ملف الصور المضغوط للتحميل', type: 'success', duration: 3000 });
    } catch (error: any) {
      console.error('ZIP build error:', error);
      setToastState({ message: 'حدث خطأ أثناء تجهيز ملف الصور', type: 'error', duration: 3000 });
    }
  };

  const handleLoadMoreServiceRequests = async (serviceId: string) => {
    const currentVisLimit = requestVisibleLimits[serviceId] || 50;
    const pool = requestsByServiceId[serviceId] ?? [];

    if (pool.length > currentVisLimit) {
      setRequestVisibleLimits(prev => ({
        ...prev,
        [serviceId]: currentVisLimit + 50
      }));
      return;
    }

    if (isLoadingMoreServiceRequests) return;
    setIsLoadingMoreServiceRequests(true);
    try {
      const lastSnap = serviceLastSnapshots[serviceId] || null;
      const res = await fetchServiceRequestsPage(serviceId, 50, lastSnap);

      if (res.requests.length > 0) {
        setServiceRequests(prev => {
          const existingIds = new Set(prev.map(r => r.id));
          const newRequests = res.requests.filter(r => !existingIds.has(r.id));
          return [...prev, ...newRequests];
        });
        setServiceLastSnapshots(prev => ({ ...prev, [serviceId]: res.lastSnapshot }));
      }
      setServiceHasMore(prev => ({ ...prev, [serviceId]: res.hasMore }));
      setRequestVisibleLimits(prev => ({
        ...prev,
        [serviceId]: currentVisLimit + 50
      }));
    } catch (e: any) {
      logger.error('Error fetching more service requests:', e);
    } finally {
      setIsLoadingMoreServiceRequests(false);
    }
  };

  const copyRequestsColumn = (columnName: string, filteredRequests: any[], getValue: (req: any) => string) => {
    try {
      const columnData = filteredRequests.map(req => getValue(req)).join('\n');
      navigator.clipboard.writeText(columnData);
      setToastState({ message: `تم نسخ عمود "${columnName}" بنجاح!`, type: 'success', duration: 2000 });
    } catch (err) {
      logger.error('Error copying column:', err);
      showAlert('خطأ', 'فشل نسخ العمود', 'error');
    }
  };

  const viewDocuments = (request: ServiceRequest) => {
    const urls: string[] = [];
    if (request.data?.receiptUrl) urls.push(request.data.receiptUrl);
    if (request.documents && request.documents.length > 0) {
      request.documents.forEach(doc => urls.push(doc.url));
    }

    if (urls.length === 0) {
      setToastState({ message: 'لا توجد مرفقات لهذا الطلب', type: 'error', duration: 3000 });
      return;
    }

    const safeUrls = Array.from(new Set(urls.map(u => u || '').filter(Boolean)));
    if (!safeUrls.length) {
      setToastState({ message: 'لا توجد روابط صالحة للمرفقات', type: 'error', duration: 3000 });
      return;
    }

    setDocumentViewer({ open: true, urls: safeUrls });
  };

  const handleServiceFileSelect = useCallback((serviceId: string, alreadySelected: boolean) => {
    if (alreadySelected) {
      setSelectedServiceId(null);
    } else {
      setSelectedServiceId(serviceId);
    }
  }, [setSelectedServiceId]);

  // Memoized filter and sort for requests
  const adminRequestsFilteredSorted = useMemo(() => {
    if (!dataReady || !selectedServiceId) return [];
    if (selectedServiceId !== deferredRequestsServiceId) return [];
    const pool = requestsByServiceId[selectedServiceId] ?? [];
    const term = serviceSearchTerm.toLowerCase().trim();

    const filtered = pool.filter((request) => {
      if (!term) return true;
      const termNorm = normalizeArabicText(term);
      const studentData = students[request.studentId];

      const fullNameAr = (
        request.data?.full_name_arabic ||
        request.data?.full_name ||
        studentData?.fullNameArabic ||
        ''
      );
      const fullNameArNorm = normalizeArabicText(fullNameAr);

      const fullNameEn = (
        request.data?.full_name_english ||
        studentData?.vehicleNameEnglish ||
        (studentData as any)?.fullNameEnglish ||
        ''
      ).toLowerCase();

      if (fullNameArNorm && fullNameArNorm.includes(termNorm)) return true;
      if (fullNameEn && fullNameEn.includes(term)) return true;

      const natId = String(request.data?.national_id || studentData?.nationalID || '');
      if (natId && natId.includes(term)) return true;

      const whatsapp = String(request.data?.whatsapp_number || request.data?.phone_whatsapp || studentData?.whatsappNumber || '');
      if (whatsapp && whatsapp.includes(term)) return true;

      const email = String(request.data?.email || studentData?.email || '').toLowerCase();
      if (email && email.includes(term)) return true;

      const statusAr = workflowStatusLabelAr(request.status);
      if (statusAr.includes(term)) return true;

      if (request.createdAt) {
        const dateStr = new Date(request.createdAt).toLocaleDateString('ar-EG');
        if (dateStr.includes(term)) return true;
      }

      return false;
    });

    const mapped = filtered.map((req) => {
      const name = (
        req.data?.full_name_arabic ||
        req.data?.full_name ||
        students[req.studentId]?.fullNameArabic ||
        ''
      ).toLowerCase();
      const isCompleted = normalizeWorkflowStatus(req.status) === 'completed';
      const time = req.createdAt ? new Date(req.createdAt).getTime() : 0;
      return { req, name, isCompleted, time };
    });

    mapped.sort((a, b) => {
      if (a.isCompleted !== b.isCompleted) {
        return a.isCompleted ? 1 : -1;
      }
      return b.time - a.time;
    });

    return mapped.map((item) => item.req);
  }, [dataReady, selectedServiceId, deferredRequestsServiceId, requestsByServiceId, serviceSearchTerm, students]);

  return (
    <div className="admin-content">
      <div className="requests-section">
        <h2 className="requests-section-heading">
          <span className="requests-section-heading-title">جميع الطلبات</span>
          {!dataReady && serviceRequests.length === 0 ? (
            <span className="requests-section-heading-sync" aria-live="polite">
              <span className="requests-section-heading-sync-dot" aria-hidden />
              <span className="requests-section-heading-sync-text">جاري تحميل البيانات من السيرفر</span>
            </span>
          ) : (
            <span className="requests-section-heading-count" title="إجمالي الطلبات عبر كل الخدمات">
              {serviceRequests.length}
            </span>
          )}
        </h2>

        <AdminServicesFilesGrid
          selectedServiceId={selectedServiceId}
          onSelectService={handleServiceFileSelect}
          requestStatsByServiceId={requestStatsByServiceId}
          bookConfig={bookConfig}
          assignmentsConfig={assignmentsConfig}
          statementEnrollmentConfig={statementEnrollmentConfig}
          statsUnlocked={statsUnlocked}
          onToggleStatsLockClick={handleStatsLockIndicatorClick}
          onToggleStatsLockKeyDown={handleStatsLockIndicatorKeyDown}
        />

        {statsPasswordOpen && !statsUnlocked && (
          <div
            style={{
              position: 'sticky',
              top: 10,
              zIndex: 5,
              marginTop: 12,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              justifyContent: 'center',
              padding: 12,
              borderRadius: 12,
              background: '#0b1220',
              color: '#e2e8f0',
              border: '1px solid rgba(148,163,184,0.2)'
            }}
          >
            <span style={{ fontWeight: 700 }}>إظهار الأرقام:</span>
            <input
              type="password"
              value={statsPasswordInput}
              onChange={(e) => setStatsPasswordInput(e.target.value)}
              placeholder="أدخل كلمة المرور"
              style={{
                width: 260,
                padding: '10px 12px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)',
                background: '#0f172a',
                color: '#e2e8f0',
                outline: 'none'
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  tryUnlockStats();
                } else if (e.key === 'Escape') {
                  setStatsPasswordOpen(false);
                  setStatsPasswordInput('');
                }
              }}
              autoFocus
            />
            <button
              onClick={tryUnlockStats}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)',
                background: '#1e293b',
                color: '#e2e8f0',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              فتح
            </button>
            <button
              onClick={() => {
                setStatsPasswordOpen(false);
                setStatsPasswordInput('');
              }}
              style={{
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(148,163,184,0.25)',
                background: 'transparent',
                color: '#e2e8f0',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              إلغاء
            </button>
          </div>
        )}

        {/* Display requests for selected service */}
        {selectedServiceId && (
          <div className="selected-service-requests" ref={requestsSectionRef}>
            <div className="selected-service-header">
              <h3>
                {getServiceName(selectedServiceId)}
                {serviceTotalCounts[selectedServiceId] != null && (
                  <span style={{ fontSize: '14px', backgroundColor: '#e2e8f0', color: '#0f172a', padding: '4px 12px', borderRadius: '12px', marginRight: '12px', fontWeight: 700 }}>
                    إجمالي طلبات الخدمة: {serviceTotalCounts[selectedServiceId]} طلب
                  </span>
                )}
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  onClick={() => setSelectedServiceId(null)}
                  className="close-service-button"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="requests-list-container">
              <div className="search-bar" style={{ marginBottom: '25px' }}>
                <div className="search-input-wrapper">
                  <Search size={20} className="search-icon" />
                  <input
                    type="text"
                    placeholder="ابحث في جميع بيانات الطلبات (الاسم، الرقم القومي، الهاتف، العنوان، الحالة...)"
                    value={serviceSearchTerm}
                    onChange={(e) => setServiceSearchTerm(e.target.value)}
                    className="search-input"
                  />
                </div>
              </div>

              {(() => {
                const filteredRequests = adminRequestsFilteredSorted;

                if (!dataReady) {
                  return (
                    <div className="no-requests-message" style={{ textAlign: 'center', padding: '40px 20px' }}>
                      <div className="loader-spinner" style={{ margin: '0 auto 16px', width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                      <p style={{ color: '#64748b' }}>جاري تحميل البيانات...</p>
                    </div>
                  );
                }

                if (isRequestsTableSwitchPending) {
                  return (
                    <div className="admin-requests-table-switching" role="status" aria-live="polite">
                      <div className="loader-spinner admin-requests-table-switching-spinner" />
                      <p className="admin-requests-table-switching-text">جاري تحضير الجدول…</p>
                    </div>
                  );
                }

                if (filteredRequests.length === 0) {
                  return (
                    <div className="no-requests-message">
                      <p>لا توجد طلبات لهذه الخدمة</p>
                    </div>
                  );
                }

                const allDataKeys = new Set<string>();
                filteredRequests.forEach(req => {
                  Object.entries(req.data || {}).forEach(([key, value]) => {
                    const stringValue = String(value || '').trim();
                    if (
                      !REQUEST_SPREADSHEET_STANDARD_KEYS.has(key) &&
                      typeof value !== 'object' &&
                      stringValue &&
                      stringValue !== 'undefined' &&
                      stringValue !== 'null'
                    ) {
                      allDataKeys.add(key);
                    }
                  });
                });

                const hasAddress = filteredRequests.some(r => r.data?.address || r.data?.address_details || r.data?.deliveryAddress);
                const hasDiploma = filteredRequests.some(r => r.data?.diploma_type || r.data?.diplomaType || r.data?.diploma_year || r.data?.diplomaYear);
                const hasTrack = filteredRequests.some(r => r.data?.track || r.data?.track_category || r.data?.track_name || r.data?.track_other || r.data?.educational_specialization || r.data?.faculty || r.data?.department);

                // Define columns based on Service ID
                let columns: { id: string; label: string; getValue: (r: any) => string }[] = [];

                const colName = { id: 'name', label: 'الاسم', getValue: (r: any) => r.data?.full_name_arabic || r.data?.full_name || students[r.studentId]?.fullNameArabic || '-' };
                const colNationalId = { id: 'national_id', label: 'الرقم القومي', getValue: (r: any) => r.data?.national_id || students[r.studentId]?.nationalID || '-' };
                const colWhatsapp = { id: 'whatsapp', label: 'الواتساب', getValue: (r: any) => r.data?.whatsapp_number || r.data?.phone_whatsapp || students[r.studentId]?.whatsappNumber || '-' };
                const colEmail = { id: 'email', label: 'الإيميل', getValue: (r: any) => r.data?.email || students[r.studentId]?.email || '-' };
                const colAddress = { id: 'address', label: 'العنوان', getValue: (r: any) => r.data?.address || r.data?.address_details || r.data?.deliveryAddress || '-' };
                const colDiplomaType = { id: 'diploma_type', label: 'نوع الدبلومة', getValue: (r: any) => r.data?.diploma_type || r.data?.diplomaType || '-' };
                const colDiplomaYear = { id: 'diploma_year', label: 'سنة الدبلومة', getValue: (r: any) => r.data?.diploma_year || r.data?.diplomaYear || '-' };
                const colTrack = { id: 'track', label: 'المسار', getValue: (r: any) => normalizeTrackName(r.data?.track || r.data?.track_category || r.data?.track_name || '') };
                const colCopies = { id: 'copies', label: 'عدد النسخ', getValue: (r: any) => String(r.data?.number_of_copies || '-') };
                const colStudentNames = { id: 'student_names', label: 'الأسماء', getValue: (r: any) => { const v = r.data?.student_names || r.data?.names || r.data?.names_array || r.data?.student_names_array; return Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v.replace(/\n/g, ', ') : '-'); } };
                const colSpecialization = { id: 'specialization', label: 'التخصص', getValue: (r: any) => r.data?.educational_specialization || '-' };
                const colDestination = { id: 'destination', label: 'المكان الموجه له', getValue: (r: any) => r.data?.destination || '-' };
                const colRequestType = { id: 'request_type', label: 'نوع الطلب', getValue: (r: any) => r.data?.request_type || '-' };
                const colTotalPrice = { id: 'total_price', label: 'السعر الإجمالي', getValue: (r: any) => String(r.data?.totalPrice || '-') };
                const colNameEn = { id: 'name_en', label: 'الاسم بالإنجليزية', getValue: (r: any) => r.data?.full_name_english || '-' };
                const colServiceType = { id: 'service_type', label: 'نوع الخدمة', getValue: (r: any) => typeof r.data?.selectedCertificate === 'object' ? r.data?.selectedCertificate?.name : (r.data?.selectedCertificate || '-') };
                const colTransType = { id: 'trans_type', label: 'نوع التحول الرقمي', getValue: (r: any) => r.data?.transformation_type || '-' };
                const colExamLang = { id: 'exam_lang', label: 'لغة الامتحان', getValue: (r: any) => r.data?.selectedExamLanguage || '-' };
                const colProjectTitle = { id: 'project_title', label: 'عنوان المشروع', getValue: (r: any) => r.data?.project_title || '-' };
                const colGroupLink = { id: 'group_link', label: 'لينك الجروب', getValue: (r: any) => r.data?.group_link || '-' };
                const colLeaderWhatsapp = { id: 'leader_whatsapp', label: 'واتساب الليدر', getValue: (r: any) => r.data?.leader_whatsapp || '-' };
                const colDtFawryCode = {
                  id: 'dt_fawry_code',
                  label: 'رقم فوري',
                  getValue: (r: any) => {
                    const direct = r.data?.fawryCode || r.data?.serialNumber || r.data?.fawry_code || r.data?.fawry_number;
                    if (direct && String(direct).trim() !== '' && String(direct).trim() !== '-') return String(direct).trim();

                    let code = r.id ? dtCodesIndex[String(r.id)] : undefined;
                    if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;

                    if (r.studentId) {
                      code = adminCodesLookup.dtLatestByStudent?.get(r.studentId);
                      if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                    }

                    const studentData = students[r.studentId];
                    const nat = String(r.data?.national_id || r.data?.nationalID || studentData?.nationalID || '').replace(/\D/g, '');
                    if (nat.length >= 6) {
                      code = adminCodesLookup.dtLatestByNational?.get(nat);
                      if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                    }

                    const phone = String(r.data?.whatsapp_number || r.data?.phone_whatsapp || studentData?.whatsappNumber || '').replace(/\D/g, '');
                    const ph10 = phone.length >= 10 ? phone.slice(-10) : phone;
                    if (ph10.length >= 10) {
                      code = adminCodesLookup.dtLatestByPhone?.get(ph10);
                      if (code?.fawryCode || code?.serialNumber) return code.fawryCode || code.serialNumber;
                    }

                    return '-';
                  }
                };
                const colEpOrderNumber = {
                  id: 'ep_order_number',
                  label: 'الرقم المرجعي',
                  getValue: (r: any) => {
                    const studentData = students[r.studentId];
                    let code = r.id ? epCodesIndex[String(r.id)] : undefined;
                    if (!code && r.studentId) code = adminCodesLookup.epLatestByStudent?.get(r.studentId);
                    if (!code) {
                      const nat = String(r.data?.national_id || studentData?.nationalID || '').replace(/\D/g, '');
                      if (nat.length >= 6) code = adminCodesLookup.epLatestByNational?.get(nat);
                    }
                    if (!code) {
                      const phone = String(r.data?.whatsapp_number || r.data?.phone_whatsapp || studentData?.whatsappNumber || '').replace(/\D/g, '');
                      const ph10 = phone.length >= 10 ? phone.slice(-10) : phone;
                      if (ph10.length >= 10) code = adminCodesLookup.epLatestByPhone?.get(ph10);
                    }
                    return code?.orderNumber || '-';
                  }
                };

                switch (selectedServiceId) {
                  case '2':
                    columns = [colName, colWhatsapp, colDiplomaType];
                    break;
                  case '3':
                    columns = [colCopies, colStudentNames, colWhatsapp, colAddress, colDiplomaType];
                    break;
                  case '4':
                    columns = [colName, colNationalId, colWhatsapp, colDiplomaType, colDiplomaYear, colTrack, colEpOrderNumber];
                    break;
                  case '5':
                    columns = [colName, colWhatsapp, colTrack, colTotalPrice, colSpecialization];
                    break;
                  case '6':
                    columns = [colName, colNameEn, colNationalId, colEmail, colWhatsapp, colServiceType, colAddress, colTotalPrice];
                    break;
                  case '7':
                    columns = [colName, colNameEn, colNationalId, colEmail, colWhatsapp, colTransType, colExamLang, colTotalPrice, colDtFawryCode];
                    break;
                  case '8':
                    columns = [colName, colWhatsapp, colAddress, colTrack];
                    break;
                  case '9':
                    columns = [colStudentNames, colLeaderWhatsapp, colTrack, colProjectTitle, colGroupLink];
                    break;
                  case '10':
                    columns = [colName, colWhatsapp, colDiplomaYear, colTrack, colDiplomaType, colTotalPrice];
                    break;
                  case '11':
                    columns = [colName, colWhatsapp, colNationalId, colAddress, colTotalPrice];
                    break;
                  case '12':
                    columns = [colName, colWhatsapp, colRequestType, colDestination, colTotalPrice];
                    break;
                  default:
                    columns = [colName, colNationalId, colWhatsapp, colEmail];
                    if (hasAddress) columns.push(colAddress);
                    if (hasDiploma) columns.push(colDiplomaType);
                    if (hasTrack) columns.push(colTrack);
                }

                const allColumns = columns;
                const fixedKeys = new Set([
                  'full_name',
                  'full_name_arabic',
                  'full_name_english',
                  'national_id',
                  'whatsapp_number',
                  'phone_whatsapp',
                  'leader_whatsapp',
                  'email',
                  'address',
                  'address_details',
                  'deliveryAddress',
                  'diploma_type',
                  'diplomaType',
                  'diploma_year',
                  'diplomaYear',
                  'track',
                  'track_category',
                  'track_name',
                  'number_of_copies',
                  'student_names',
                  'names',
                  'names_array',
                  'student_names_array',
                  'tracks_array',
                  'receiptUrl',
                  'educational_specialization',
                  'totalPrice',
                  'selectedCertificate',
                  'transformation_type',
                  'selectedExamLanguage',
                  'project_title',
                  'group_link'
                ]);
                const extraKeys = Array.from(allDataKeys).filter(k => !fixedKeys.has(k));

                const dataColumnCount = allColumns.length + extraKeys.length;
                const orderedDataIndices =
                  requestsDataColumnOrder.length === dataColumnCount
                    ? requestsDataColumnOrder
                    : Array.from({ length: dataColumnCount }, (_, i) => i);

                const sortedRequests = !requestsSort
                  ? filteredRequests
                  : [...filteredRequests].sort((a, b) => {
                      const id = requestsSort.colId;
                      const dirSign = requestsSort.dir === 'asc' ? 1 : -1;

                      if (id === 'status') {
                        const ra = workflowStatusRank(a.status);
                        const rb = workflowStatusRank(b.status);
                        return (ra - rb) * dirSign;
                      }

                      if (id === 'date') {
                        const va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                        const vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                        return (va - vb) * dirSign;
                      }

                      const col = allColumns.find(c => c.id === id);
                      if (col) {
                        const v = col.getValue;
                        return (v(a) || '').localeCompare(v(b) || '', 'ar') * dirSign;
                      }

                      if (id.startsWith('extra_key_')) {
                        const key = id.replace('extra_key_', '');
                        const va = String(a.data?.[key] ?? '');
                        const vb = String(b.data?.[key] ?? '');
                        return va.localeCompare(vb, 'ar') * dirSign;
                      }

                      if (id.startsWith('label_')) {
                        const label = id.replace('label_', '');
                        const colByLabel = allColumns.find(c => c.label === label);
                        if (colByLabel) {
                          return (colByLabel.getValue(a) || '').localeCompare(colByLabel.getValue(b) || '', 'ar') * dirSign;
                        }
                        const matchedKey = extraKeys.find(k => translateKey(k) === label);
                        if (matchedKey) {
                          const va = String(a.data?.[matchedKey] ?? '');
                          const vb = String(b.data?.[matchedKey] ?? '');
                          return va.localeCompare(vb, 'ar') * dirSign;
                        }
                      }

                      return 0;
                    });

                const currentLimit = selectedServiceId ? (requestVisibleLimits[selectedServiceId] || 50) : 50;
                const displayRequests = serviceSearchTerm.trim() ? sortedRequests : sortedRequests.slice(0, currentLimit);

                const duplicateCountByRow = computeRequestDuplicateCounts(displayRequests, students);
                const requestsColCount = 3 + dataColumnCount + 2;

                const phoneCounts = new Map<string, number>();
                displayRequests.forEach((req) => {
                  const sData = students[req.studentId];
                  const phones = new Set<string>();
                  [
                    req.data?.whatsapp_number,
                    req.data?.phone_whatsapp,
                    req.data?.leader_whatsapp,
                    sData?.whatsappNumber
                  ].filter(Boolean).forEach(p => {
                    const n = normPhone(String(p));
                    if (n.length >= 10) phones.add(n);
                  });
                  phones.forEach(n => {
                    phoneCounts.set(n, (phoneCounts.get(n) ?? 0) + 1);
                  });
                });

                const getRequestsCellText = (row: number, col: number): string => {
                  const request = displayRequests[row];
                  if (!request) return '';
                  if (col === 0) return String(row + 1);
                  if (col === 1) return '';
                  if (col === 2) return workflowStatusLabelAr(request.status);
                  if (col >= 3 && col < 3 + dataColumnCount) {
                    const visualPos = col - 3;
                    const localIdx = orderedDataIndices[visualPos];
                    if (localIdx < allColumns.length) {
                      return String(allColumns[localIdx].getValue(request));
                    }
                    const key = extraKeys[localIdx - allColumns.length];
                    return request.data?.[key] != null ? String(request.data[key]) : '-';
                  }
                  if (col === 3 + dataColumnCount)
                    return request.createdAt ? new Date(request.createdAt).toLocaleDateString('ar-EG') : '-';
                  if (col === 3 + dataColumnCount + 1) {
                    const files = students[request.studentId]?.assignedFiles;
                    return Array.isArray(files) && files.length > 0 ? `${files.length} ملف` : 'مافيش';
                  }
                  return '';
                };

                requestsGridDataRef.current = {
                  rowCount: displayRequests.length,
                  colCount: requestsColCount,
                  getCellText: getRequestsCellText,
                  setCellValue: undefined
                };

                const handleExportRequestsToExcel = () => {
                  if (!displayRequests.length) {
                    showAlert('تنبيه', 'لا توجد بيانات في الجدول للتصدير', 'info');
                    return;
                  }
                  const rows: any[][] = [];

                  const header: string[] = ['#', 'الحالة'];
                  orderedDataIndices.forEach(localIdx => {
                    const isFromColumns = localIdx < allColumns.length;
                    const col = isFromColumns ? allColumns[localIdx] : null;
                    const key = !isFromColumns ? extraKeys[localIdx - allColumns.length] : null;
                    const label = col ? col.label : (key ? translateKey(key) : '');
                    header.push(label);
                  });
                  header.push('التاريخ', 'الملفات');
                  rows.push(header);

                  displayRequests.forEach((req, rowIdx) => {
                    const row: any[] = [];
                    row.push(rowIdx + 1);
                    row.push(workflowStatusLabelAr(req.status));
                    orderedDataIndices.forEach(localIdx => {
                      if (localIdx < allColumns.length) {
                        row.push(allColumns[localIdx].getValue(req));
                      } else if (localIdx < allColumns.length + extraKeys.length) {
                        const key = extraKeys[localIdx - allColumns.length];
                        row.push(req.data?.[key] ?? '');
                      } else {
                        row.push('');
                      }
                    });
                    row.push(req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG') : '');
                    const files = students[req.studentId]?.assignedFiles;
                    const count = Array.isArray(files) ? files.length : 0;
                    row.push(count ? `${count} ملف` : 'لا يوجد');
                    rows.push(row);
                  });

                  const worksheet = XLSX.utils.aoa_to_sheet(rows);
                  const workbook = XLSX.utils.book_new();
                  XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبات');
                  const fileName = `طلبات_الخدمة_${selectedServiceId || 'all'}.xlsx`;
                  XLSX.writeFile(workbook, fileName);
                };

                const allVisibleKeys = displayRequests.map(r => `${r.serviceId}_${r.id}`);
                const visibleSelectedCount = allVisibleKeys.filter(k => selectedRequestKeys.has(k)).length;
                const isAllVisibleSelected = allVisibleKeys.length > 0 && visibleSelectedCount === allVisibleKeys.length;
                const isSomeVisibleSelected = visibleSelectedCount > 0 && !isAllVisibleSelected;

                const handleMasterCheckboxChange = () => {
                  if (isAllVisibleSelected) {
                    const next = new Set(selectedRequestKeys);
                    allVisibleKeys.forEach(k => next.delete(k));
                    setSelectedRequestKeys(next);
                  } else {
                    const next = new Set(selectedRequestKeys);
                    allVisibleKeys.forEach(k => next.add(k));
                    setSelectedRequestKeys(next);
                  }
                };

                const toggleSelectRequest = (reqKey: string, index: number, isShift: boolean) => {
                  const next = new Set(selectedRequestKeys);
                  if (isShift && lastSelectedRequestRowIndex !== null) {
                    const start = Math.min(lastSelectedRequestRowIndex, index);
                    const end = Math.max(lastSelectedRequestRowIndex, index);
                    for (let i = start; i <= end; i++) {
                      const r = displayRequests[i];
                      if (r && r.id) {
                        next.add(`${r.serviceId}_${r.id}`);
                      }
                    }
                  } else {
                    if (next.has(reqKey)) {
                      next.delete(reqKey);
                    } else {
                      next.add(reqKey);
                    }
                    setLastSelectedRequestRowIndex(index);
                  }
                  setSelectedRequestKeys(next);
                };

                const handleSelectAllVisible = () => {
                  const next = new Set(selectedRequestKeys);
                  displayRequests.forEach(r => {
                    if (r.id) next.add(`${r.serviceId}_${r.id}`);
                  });
                  setSelectedRequestKeys(next);
                  setLastSelectedRequestRowIndex(displayRequests.length - 1);
                };

                const handleDeselectAll = () => {
                  setSelectedRequestKeys(new Set());
                  setLastSelectedRequestRowIndex(null);
                };

                const handleSelectFirstN = (count: number) => {
                  const n = Math.max(1, Math.min(count, displayRequests.length));
                  const next = new Set<string>();
                  for (let i = 0; i < n; i++) {
                    const r = displayRequests[i];
                    if (r && r.id) {
                      next.add(`${r.serviceId}_${r.id}`);
                    }
                  }
                  setSelectedRequestKeys(next);
                  setLastSelectedRequestRowIndex(n - 1);
                };

                displayRequestsRef.current = displayRequests;
                const selectedReqsList = serviceRequests.filter(r => selectedRequestKeys.has(`${r.serviceId}_${r.id}`));

                return (
                  <>
                    <AdminRequestsToolbar
                      displayCount={displayRequests.length}
                      requestsSort={requestsSort}
                      handleRequestsSort={handleRequestsSort}
                      hasUnsavedLayout={hasUnsavedLayout}
                      handleSaveLayout={handleSaveLayout}
                      onShowDefaultColumnsModal={() => setShowDefaultColumnsModal(true)}
                      handleExportRequestsToExcel={handleExportRequestsToExcel}
                      selectedRequestKeys={selectedRequestKeys}
                      quickSelectCount={quickSelectCount}
                      setQuickSelectCount={setQuickSelectCount}
                      handleSelectFirstN={handleSelectFirstN}
                      handleSelectAllVisible={handleSelectAllVisible}
                      handleDeselectAll={handleDeselectAll}
                    />

                    <AdminRequestsTable
                      displayRequests={displayRequests}
                      students={students}
                      selectedServiceId={selectedServiceId}
                      hasAddress={hasAddress}
                      hasDiploma={hasDiploma}
                      hasTrack={hasTrack}
                      allColumns={allColumns}
                      extraKeys={extraKeys}
                      orderedDataIndices={orderedDataIndices}
                      dataColumnCount={dataColumnCount}
                      requestsDataColumnOrder={requestsDataColumnOrder}
                      setRequestsDataColumnOrder={setRequestsDataColumnOrder}
                      requestsSort={requestsSort}
                      handleRequestsSort={handleRequestsSort}
                      setHasUnsavedLayout={setHasUnsavedLayout}
                      selectedRequestKeys={selectedRequestKeys}
                      setSelectedRequestKeys={setSelectedRequestKeys}
                      lastSelectedRequestRowIndex={lastSelectedRequestRowIndex}
                      setLastSelectedRequestRowIndex={setLastSelectedRequestRowIndex}
                      toggleSelectRequest={toggleSelectRequest}
                      handleMasterCheckboxChange={handleMasterCheckboxChange}
                      isAllVisibleSelected={isAllVisibleSelected}
                      isSomeVisibleSelected={isSomeVisibleSelected}
                      duplicateCountByRow={duplicateCountByRow}
                      phoneCounts={phoneCounts}
                      normPhone={normPhone}
                      dtCodesIndex={dtCodesIndex}
                      epCodesIndex={epCodesIndex}
                      adminCodesLookup={adminCodesLookup}
                      gridApi={gridApi}
                      requestsTableRef={requestsTableRef}
                      requestsScrollContainerRef={requestsScrollContainerRef}
                      dragStartRef={dragStartRef}
                      isDraggingRowSelectionRef={isDraggingRowSelectionRef}
                      dragRowStartRef={dragRowStartRef}
                      initialSelectedKeysAtDragRef={initialSelectedKeysAtDragRef}
                      displayRequestsRef={displayRequestsRef}
                      setSpreadsheetMenu={setSpreadsheetMenu}
                      setSpreadsheetDropdownColumn={setSpreadsheetDropdownColumn}
                      setCellContextMenu={setCellContextMenu}
                      copyRequestsColumn={copyRequestsColumn}
                      handleStatusChange={handleStatusChange}
                      viewDocuments={viewDocuments}
                      handleDownloadAll={handleDownloadAll}
                      handleDeleteRequest={handleDeleteRequest}
                      onEditRequest={(request) => {
                        setEditingRequestId(request.id || null);
                        setEditingServiceId(request.serviceId || null);
                        setTempRequestData({ ...request.data });
                        setIsEditingRequestModalOpen(true);
                      }}
                      onViewAssignedFiles={(studentName, files) => {
                        setAssignedFilesViewer({
                          open: true,
                          studentName,
                          files
                        });
                      }}
                      getStatusBadge={getStatusBadge}
                      translateKey={translateKey}
                    />

                    <AdminRequestsBulkActions
                      selectedCount={selectedReqsList.length}
                      isBulkProcessingRequests={isBulkProcessingRequests}
                      bulkActionProgress={bulkActionProgress}
                      handleDeselectAll={handleDeselectAll}
                      handleBulkStatusChange={handleBulkStatusChange}
                      handleBulkDownloadZip={handleBulkDownloadZip}
                      handleBulkDelete={handleBulkDelete}
                      selectedReqsList={selectedReqsList}
                    />

                    <DefaultColumnsModal
                      isOpen={showDefaultColumnsModal}
                      onClose={() => setShowDefaultColumnsModal(false)}
                      allColumns={allColumns}
                      extraKeys={extraKeys}
                      translateKey={translateKey}
                      selectedServiceId={selectedServiceId}
                      setRequestsDataColumnOrder={setRequestsDataColumnOrder}
                      setRequestsSortState={setRequestsSortState}
                      setHasUnsavedLayout={setHasUnsavedLayout}
                      layoutsHistory={layoutsHistory}
                      setLayoutsHistory={setLayoutsHistory}
                      activeLayoutDetailId={activeLayoutDetailId}
                      setActiveLayoutDetailId={setActiveLayoutDetailId}
                      showCustomOrderInModal={showCustomOrderInModal}
                      setShowCustomOrderInModal={setShowCustomOrderInModal}
                    />

                    {selectedServiceId && !serviceSearchTerm.trim() && (
                      (serviceTotalCounts[selectedServiceId] != null && displayRequests.length < serviceTotalCounts[selectedServiceId]) ||
                      (serviceHasMore[selectedServiceId] !== false) ||
                      (sortedRequests.length > displayRequests.length)
                    ) && (
                      <div style={{ textAlign: 'center', margin: '24px 0 16px', display: 'flex', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleLoadMoreServiceRequests(selectedServiceId)}
                          disabled={isLoadingMoreServiceRequests}
                          style={{
                            padding: '12px 28px',
                            backgroundColor: isLoadingMoreServiceRequests ? '#94a3b8' : '#2563eb',
                            color: '#ffffff',
                            border: 'none',
                            borderRadius: '12px',
                            fontSize: '15px',
                            fontWeight: 700,
                            cursor: isLoadingMoreServiceRequests ? 'not-allowed' : 'pointer',
                            boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '10px',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <span>{isLoadingMoreServiceRequests ? 'جاري تحميل الدفعة التالية...' : 'تحميل المزيد (+50 طلب)'}</span>
                          <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.2)', padding: '2px 8px', borderRadius: '20px' }}>
                            المعروض {displayRequests.length} {serviceTotalCounts[selectedServiceId] != null ? `من أصل ${serviceTotalCounts[selectedServiceId]}` : `من أصل ${sortedRequests.length}`}
                          </span>
                        </button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>

      {/* Edit Request Modal */}
      <EditRequestModal
        isOpen={isEditingRequestModalOpen}
        requestId={editingRequestId}
        serviceId={editingServiceId}
        tempRequestData={tempRequestData}
        setTempRequestData={setTempRequestData}
        onClose={() => setIsEditingRequestModalOpen(false)}
        translateKey={translateKey}
        setToastState={setToastState}
      />

      {/* Document Viewer Sheet Modal */}
      <DocumentViewerModal
        isOpen={documentViewer.open}
        urls={documentViewer.urls}
        onClose={() => setDocumentViewer({ open: false, urls: [] })}
      />

      {/* Assigned Files Viewer Modal */}
      <AssignedFilesViewerModal
        isOpen={assignedFilesViewer.open}
        studentName={assignedFilesViewer.studentName}
        files={assignedFilesViewer.files}
        onClose={() => setAssignedFilesViewer({ open: false, studentName: '', files: [] })}
      />

      {/* Spreadsheet Column Context Menu */}
      {spreadsheetMenu.open && (
        <SpreadsheetContextMenu
          x={spreadsheetMenu.x}
          y={spreadsheetMenu.y}
          columnLabel={spreadsheetMenu.columnLabel}
          columnIndex={spreadsheetMenu.columnIndex}
          canPaste={gridApi.getClipboard().values.length > 0}
          hasFilter={!!serviceSearchTerm.trim()}
          onAction={(action: SpreadsheetMenuAction) => {
            if (action === 'copy' && requestsGridDataRef.current) {
              const d = requestsGridDataRef.current;
              const sel = gridApi.selection;
              if (sel && sel.tableId === 'requests' && sel.startRow >= 0 && sel.startCol >= 0) {
                const sr = Math.min(sel.startRow, sel.endRow);
                const er = Math.max(sel.startRow, sel.endRow);
                const sc = Math.min(sel.startCol, sel.endCol);
                const ec = Math.max(sel.startCol, sel.endCol);
                const values: string[][] = [];
                for (let r = sr; r <= er; r++) {
                  const row: string[] = [];
                  for (let c = sc; c <= ec; c++) row.push(d.getCellText(r, c));
                  values.push(row);
                }
                gridApi.copyToClipboard(values, false);
                try { navigator.clipboard.writeText(values.map(row => row.join('\t')).join('\n')); } catch (_) {}
                setToastState({ message: 'تم نسخ التحديد', type: 'success', duration: 2000 });
              } else if (spreadsheetMenu.columnLabel != null && spreadsheetMenu.columnIndex != null) {
                const values = [];
                for (let r = 0; r < d.rowCount; r++) values.push([d.getCellText(r, spreadsheetMenu.columnIndex!)]);
                gridApi.copyToClipboard(values, false);
                try { navigator.clipboard.writeText(values.map(row => row[0]).join('\n')); } catch (_) {}
                setToastState({ message: `تم نسخ عمود "${spreadsheetMenu.columnLabel}"`, type: 'success', duration: 2000 });
              }
            } else if (action === 'sortAtoZ' && spreadsheetMenu.columnIndex != null) {
              const menuColIdx = spreadsheetMenu.columnIndex;
              const menuColLabel = spreadsheetMenu.columnLabel ?? '';
              let resolvedColId: string | null =
                menuColIdx === 2 ? 'status' :
                menuColLabel === 'التاريخ' ? 'date' : null;
              if (!resolvedColId) resolvedColId = `label_${menuColLabel}`;
              handleRequestsSort(resolvedColId, 'asc');
              setToastState({ message: 'ترتيب من أ إلى ي', type: 'success', duration: 1500 });
            } else if (action === 'sortZtoA' && spreadsheetMenu.columnIndex != null) {
              const menuColIdx = spreadsheetMenu.columnIndex;
              const menuColLabel = spreadsheetMenu.columnLabel ?? '';
              let resolvedColId: string | null =
                menuColIdx === 2 ? 'status' :
                menuColLabel === 'التاريخ' ? 'date' : null;
              if (!resolvedColId) resolvedColId = `label_${menuColLabel}`;
              handleRequestsSort(resolvedColId, 'desc');
              setToastState({ message: 'ترتيب من ي إلى أ', type: 'success', duration: 1500 });
            } else if (action === 'removeFilter') {
              setServiceSearchTerm('');
              setToastState({ message: 'تم إزالة الفلتر', type: 'success', duration: 1500 });
            } else if (['clearColumn', 'deleteColumn', 'insertColumnLeft', 'insertColumnRight', 'resizeColumn', 'conditionalFormatting', 'dataValidation'].includes(action)) {
              setToastState({ message: 'هذا الخيار غير مفعّل حالياً لهذا الجدول', type: 'success', duration: 2000 });
            }
          }}
          onClose={() => { setSpreadsheetMenu(m => ({ ...m, open: false })); setSpreadsheetDropdownColumn(null); }}
          disabledActions={['insertColumnLeft', 'insertColumnRight', 'deleteColumn', 'resizeColumn']}
        />
      )}

      {/* Cell right click context menu portal */}
      {cellContextMenu.open && createPortal(
        <div
          ref={cellContextMenuRef}
          className="spreadsheet-context-menu spreadsheet-cell-context-menu"
          style={{
            position: 'fixed',
            left: Math.min(cellContextMenu.x, typeof window !== 'undefined' ? window.innerWidth - 120 : cellContextMenu.x),
            top: cellContextMenu.y,
            zIndex: 10000,
            minWidth: 140,
          }}
          role="menu"
        >
          <button
            type="button"
            className="spreadsheet-context-menu-item"
            onClick={() => {
              const d = requestsGridDataRef.current;
              const sel = gridApi.selection;
              if (sel && sel.tableId === 'requests' && sel.startRow >= 0 && sel.startCol >= 0 && d) {
                const sr = Math.min(sel.startRow, sel.endRow);
                const er = Math.max(sel.startRow, sel.endRow);
                const sc = Math.min(sel.startCol, sel.endCol);
                const ec = Math.max(sel.startCol, sel.endCol);
                const values: string[][] = [];
                for (let r = sr; r <= er; r++) {
                  const row: string[] = [];
                  for (let c = sc; c <= ec; c++) row.push(d.getCellText(r, c));
                  values.push(row);
                }
                gridApi.copyToClipboard(values, false);
                try { navigator.clipboard.writeText(values.map(row => row.join('\t')).join('\n')); } catch (_) {}
                setToastState({ message: 'تم نسخ التحديد', type: 'success', duration: 2000 });
              } else if (cellContextMenu.row != null && cellContextMenu.col != null && d) {
                const text = d.getCellText(cellContextMenu.row, cellContextMenu.col);
                gridApi.copyToClipboard([[text]], false);
                try { navigator.clipboard.writeText(text); } catch (_) {}
                setToastState({ message: 'تم نسخ الخلية', type: 'success', duration: 2000 });
              }
              setCellContextMenu(c => ({ ...c, open: false }));
            }}
            role="menuitem"
          >
            نسخ
          </button>
        </div>,
        document.body
      )}
    </div>
  );
};

export default AdminRequestsTab;
