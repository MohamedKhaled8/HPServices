import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useStudent } from '../context';
import {
  subscribeToAllServiceRequests,
  updateServiceRequestStatus,
  updateServiceRequestData,
  deleteServiceRequest,
  getBookServiceConfig,
  updateBookServiceConfig,
  getFeesServiceConfig,
  updateFeesServiceConfig,
  getAssignmentsServiceConfig,
  // updateAssignmentsServiceConfig, // Commented out to fix build errors
  getCertificatesServiceConfig,
  updateCertificatesServiceConfig,
  getDigitalTransformationConfig,
  updateDigitalTransformationConfig,
  getFinalReviewConfig,
  updateFinalReviewConfig,
  getGraduationProjectConfig,
  updateGraduationProjectConfig,
  checkIsAdmin,
  getStudentData,
  getStudentsByIds,
  subscribeToAllStudents,
  searchStudent,
  updateStudentData,
  deleteStudentData,
  changeOtherUserPasswordHelper,
  saveDigitalTransformationCode,
  subscribeToDigitalTransformationCodes,
  saveElectronicPaymentCode,
  subscribeToElectronicPaymentCodes,
  deleteDigitalTransformationCode,
  deleteElectronicPaymentCode,
  getLatestNews,
  updateLatestNews,
  sendQuickNotification,
  subscribeToServiceSettings,
  updateServiceSettings,
  subscribeToAdminPreferences,
  updateAdminPreferences,
  clearLatestNews,
  clearQuickNotification
} from '../services/firebaseService';
import { normalizeTrackName } from '../utils/trackUtils';
import { ServiceRequest, StudentData, AssignedFile, BookServiceConfig, FeesServiceConfig, AssignmentsServiceConfig, CertificatesServiceConfig, CertificateItem, DigitalTransformationConfig, DigitalTransformationType, FinalReviewConfig, GraduationProjectConfig, GraduationProjectPrice, ServiceSettings } from '../types';
import {
  LogOut,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  Eye,
  Edit2,
  Save,
  X,
  FileText,
  User,
  CreditCard,
  BookOpen,
  GraduationCap,
  Copy,
  FileCheck,
  Award,
  ClipboardList,
  Users,
  Search,
  Pencil,
  Zap,
  Trash2,
  Image,
  EyeOff,
  Newspaper,
  Download,
  Bell,
  Send,
  BarChart2,
  TrendingUp,
  DollarSign,
  PieChart,
  Activity,
  Settings,
  Star,
  CheckSquare,
  Square,
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  GripVertical,
  ChevronDown,
  Folder
} from 'lucide-react';
import { SERVICES } from '../constants/services';
import { logger } from '../utils/logger';
import { normalizeInstaPay } from '../utils/validation';
import CustomToast from '../components/CustomToast';
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid';
import SpreadsheetContextMenu, { type SpreadsheetMenuAction } from '../components/SpreadsheetContextMenu';
import '../styles/SpreadsheetGrid.css';
import '../styles/AdminDashboardPage.css';
import '../styles/AdminExpandableRows.css';
import '../styles/AdminNewsEditor.css';
import { motion, AnimatePresence } from 'framer-motion';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';


interface AdminDashboardPageProps {
  onLogout: () => void;
  onBack: () => void;
  onAssignmentsClick?: () => void;
}

const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onLogout, onBack, onAssignmentsClick }) => {
  const { student } = useStudent();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const [students, setStudents] = useState<Record<string, StudentData>>({});
  const [expandedRequests, setExpandedRequests] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'requests' | 'books' | 'fees' | 'certificates' | 'digitalTransformation' | 'digitalTransformationCodes' | 'electronicPaymentCodes' | 'finalReview' | 'graduationProject' | 'users' | 'news' | 'statistics' | 'services'>('requests');
  const [selectedDTRows, setSelectedDTRows] = useState<Set<number>>(new Set());
  const [selectedDTColumns, setSelectedDTColumns] = useState<Set<number>>(new Set());
  const [selectedEPRows, setSelectedEPRows] = useState<Set<number>>(new Set());
  const [selectedEPColumns, setSelectedEPColumns] = useState<Set<number>>(new Set());
  const [bookConfig, setBookConfig] = useState<BookServiceConfig | null>(null);
  const [feesConfig, setFeesConfig] = useState<FeesServiceConfig | null>(null);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig | null>(null);
  const [certificatesConfig, setCertificatesConfig] = useState<CertificatesServiceConfig | null>(null);
  const [digitalTransformationConfig, setDigitalTransformationConfig] = useState<DigitalTransformationConfig | null>(null);
  const [isEditingBooks, setIsEditingBooks] = useState(false);
  const [isEditingFees, setIsEditingFees] = useState(false);
  // const [newAssignmentName, setNewAssignmentName] = useState<string>('');
  // const [newAssignmentPrice, setNewAssignmentPrice] = useState<string>('');
  const [newCertificateName, setNewCertificateName] = useState<string>('');
  const [newCertificatePrice, setNewCertificatePrice] = useState<string>('');
  const [newCertificateDescription, setNewCertificateDescription] = useState<string>('');
  const [editingCertificate, setEditingCertificate] = useState<CertificateItem | null>(null);

  // Digital Transformation states
  const [newTransformationTypeName, setNewTransformationTypeName] = useState<string>('');
  const [newTransformationTypePrice, setNewTransformationTypePrice] = useState<string>('');
  const [newExamLanguage, setNewExamLanguage] = useState<string>('');
  const [dtCodes, setDtCodes] = useState<any[]>([]);
  const [epCodes, setEpCodes] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const requestsSectionRef = React.useRef<HTMLDivElement>(null);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [serviceSearchTerm, setServiceSearchTerm] = useState<string>('');
  const [dtSearchTerm, setDtSearchTerm] = useState<string>('');
  const [epSearchTerm, setEpSearchTerm] = useState<string>('');
  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [tempRequestData, setTempRequestData] = useState<any>({});
  const [isEditingRequestModalOpen, setIsEditingRequestModalOpen] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Admin Preferences Editor State
  const [adminPrefs, setAdminPrefs] = useState<any>({ serviceOrder: [], profitCosts: {} });
  const [statsDateRange, setStatsDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth <= 900 : false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [draggedServiceId, setDraggedServiceId] = useState<string | null>(null);
  const [editedStudentData, setEditedStudentData] = useState<StudentData | null>(null);
  const [newFeeYear, setNewFeeYear] = useState<string>('');
  const [newFeeAmount, setNewFeeAmount] = useState<string>('');
  const [latestNews, setLatestNews] = useState<string>('');
  const [isPublishingNews, setIsPublishingNews] = useState(false);
  const [isSendingQuickMessage, setIsSendingQuickMessage] = useState(false);
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings>({});
  const [toastState, setToastState] = useState<{ message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null>(null);
  const [viewingStudentRequests, setViewingStudentRequests] = useState<StudentData | null>(null);

  /* Spreadsheet-style grid: selection, clipboard, keyboard, context menu */
  const gridApi = useSpreadsheetGrid();
  const requestsTableRef = React.useRef<HTMLDivElement>(null);
  const requestsScrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [spreadsheetMenu, setSpreadsheetMenu] = useState<{
    open: boolean; x: number; y: number; tableId: string;
    columnLabel?: string; columnIndex?: number;
  }>({ open: false, x: 0, y: 0, tableId: '' });
  const [spreadsheetDropdownColumn, setSpreadsheetDropdownColumn] = useState<number | null>(null);
  const dragStartRef = React.useRef<{ tableId: string; row: number; col: number } | null>(null);
  /** ترتيب أعمدة البيانات في جدول الطلبات (إعادة ترتيب بالسحب) */
  const [requestsDataColumnOrder, setRequestsDataColumnOrder] = useState<number[]>([]);
  const [draggedColDisplayPos, setDraggedColDisplayPos] = useState<number | null>(null);
  const [dropTargetColDisplayPos, setDropTargetColDisplayPos] = useState<number | null>(null);
  /** قائمة كليك يمين على الخلية: نسخ التحديد أو الخلية */
  const [cellContextMenu, setCellContextMenu] = useState<{ open: boolean; x: number; y: number; row?: number; col?: number }>({ open: false, x: 0, y: 0 });
  const cellContextMenuRef = React.useRef<HTMLDivElement>(null);
  /** Ref updated each render with current requests grid data for copy/paste */
  const requestsGridDataRef = React.useRef<{
    rowCount: number; colCount: number;
    getCellText: (row: number, col: number) => string;
    setCellValue?: (row: number, col: number, value: string) => void;
  } | null>(null);

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

  // Custom Alert Modal State
  const [alertConfig, setAlertConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'warning';
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
    setAlertConfig({ isOpen: true, title, message, type, onConfirm: undefined });
  };

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setAlertConfig({ isOpen: true, title, message, type: 'warning', onConfirm });
  };

  const scrollActiveCellIntoView = React.useCallback(() => {
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

  /* Keyboard: arrows, Ctrl+C, Ctrl+V, Enter for spreadsheet */
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
  }, [gridApi.activeTableId, gridApi.selection, gridApi, scrollActiveCellIntoView]);

  /* Mouse drag to select range + auto-scroll while dragging */
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
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

      // Auto-scroll vertically when mouse is near viewport edges
      const edgeThreshold = 80;
      const scrollStep = 25;
      const viewportHeight = window.innerHeight || 0;
      if (e.clientY < edgeThreshold) {
        window.scrollBy({ top: -scrollStep, behavior: 'auto' });
      } else if (e.clientY > viewportHeight - edgeThreshold) {
        window.scrollBy({ top: scrollStep, behavior: 'auto' });
      }

      // Auto-scroll horizontally inside the spreadsheet scroll container
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
    const onUp = () => { dragStartRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [gridApi]);

  /* إلغاء التحديد عند النقر في أي نقطة خارج خلايا الجدول القابلة للتحديد */
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
  }, [gridApi]);

  /* إعادة تعيين / تحميل ترتيب الأعمدة عند تغيير الخدمة */
  useEffect(() => {
    if (!selectedServiceId) {
      setRequestsDataColumnOrder([]);
      return;
    }
    try {
      const key = `hp_requests_col_order_${selectedServiceId}`;
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setRequestsDataColumnOrder(parsed);
          return;
        }
      }
    } catch (e) {
      console.error('Failed to load column order', e);
    }
    setRequestsDataColumnOrder([]);
  }, [selectedServiceId]);

  /* تحميل حالة ترتيب الصفوف (الفرز) من وإلى localStorage */
  const setRequestsSort = React.useCallback(
    (colIndex: number, dir: 'asc' | 'desc') => {
      gridApi.setSort('requests', colIndex, dir);
      const key = `hp_requests_sort_${selectedServiceId || 'all'}`;
      try {
        localStorage.setItem(key, JSON.stringify({ colIndex, dir }));
      } catch {
        // ignore
      }
    },
    [gridApi, selectedServiceId]
  );

  useEffect(() => {
    const key = `hp_requests_sort_${selectedServiceId || 'all'}`;
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (
          parsed &&
          typeof parsed.colIndex === 'number' &&
          (parsed.dir === 'asc' || parsed.dir === 'desc')
        ) {
          gridApi.setSort('requests', parsed.colIndex, parsed.dir);
        }
      }
    } catch {
      // ignore
    }
  }, [gridApi, selectedServiceId]);

  /* إغلاق قائمة نسخ الخلية عند النقر خارجها أو Escape أو التمرير خارج القائمة */
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

  const translateKey = (key: string) => {
    const keys: Record<string, string> = {
      fullNameArabic: 'الاسم بالعربية',
      fullNameEnglish: 'الاسم بالإنجليزية',
      nationalID: 'رقم الهوية',
      track: 'المسار',
      whatsappNumber: 'رقم الواتساب',
      email: 'البريد الإلكتروني',
      address: 'العنوان',
      faculty: 'الكلية',
      department: 'القسم',
      level: 'المستوى الدراسي',
      universityId: 'رقم الكارنيه / الجامعي',
      serviceName: 'اسم الخدمة',
      numberOfCopies: 'عدد النسخ',
      deliveryAddress: 'عنوان التوصيل',
      paymentMethod: 'طريقة الدفع',
      paymentStatus: 'حالة الدفع',
      fawryCode: 'كود فوري',
      phoneNumber: 'رقم الهاتف',
      selectedCertificate: 'الشهادة المختارة',
      examLanguage: 'لغة الامتحان',
      transformationType: 'نوع التحول الرقمي',
      receiptUrl: 'إيصال الدفع',
      notes: 'ملاحظات إضافية',
      college_other: 'الكلية (أخرى)',
      department_other: 'القسم (أخر)',
      track_category: 'فئة المسار المختار',
      track_name: 'اسم المسار الخاص بالطالب',
      educational_specialization_other: 'التخصص التعليمي (أخر)',
      student_type: 'نوع الطالب',
      academic_year: 'العام الدراسي',
      number_of_copies: 'عدد النسخ',
      phone_whatsapp: 'رقم للتواصل والشحن',
      address_details: 'العنوان بالتفصيل',
      diploma_type: 'نوع الدبلومة',
      names: 'الأسماء',
      transfer_phone_number: 'الرقم المحول منه',
      wantsMalazem: 'تم طلب إضافة ملازم؟ (+200 ج.م)',
      selectedExamLanguage: 'لغة الامتحان المختارة',
      full_name_english: 'الاسم بالإنجليزية',
      totalPrice: 'السعر الإجمالي',
      transformation_type: 'نوع التحول الرقمي',
      exam_language: 'لغة الامتحان',
      exam_type: 'نوع الامتحان',
      total_price: 'الإجمالي',
      project_title: 'عنوان المشروع',
      group_link: 'رابط المجموعة',
      grouplink: 'رابط المجموعة',
      student_names: 'أسماء الطلاب المشتركين',
      names_array: 'أسماء أصحاب النسخ',
      leader_whatsapp: 'رقم حساب الواتساب الخاص بك',
      full_name: 'الاسم رباعي',
      full_name_arabic: 'الاسم رباعي باللغة العربية',
      diploma_year: 'سنة الدبلومة',
      track_other: 'مسار أخر',
      faculty_other: 'كلية أخرى',
      whatsapp_number: 'رقم الواتساب',
      educational_specialization: 'التخصص التعليمي',
      national_id: 'الرقم القومي',
      tracks: 'المسارات',
      tracks_array: 'المسارات'
    };
    return keys[key] || key;
  };

  // Fixed Scroll Effect when service changes
  useEffect(() => {
    if (selectedServiceId && requestsSectionRef.current) {
      // Small delay to ensure the content is rendered and height is stable
      const timer = setTimeout(() => {
        if (requestsSectionRef.current) {
          const yOffset = -20; // Slight offset to not be exactly at the top
          const element = requestsSectionRef.current;
          const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;

          window.scrollTo({ top: y, behavior: 'smooth' });
        }
      }, 400); // 400ms is very safe for layout stability
      return () => clearTimeout(timer);
    }
  }, [selectedServiceId]);

  // Final Review states
  const [finalReviewConfig, setFinalReviewConfig] = useState<FinalReviewConfig | null>(null);

  // Graduation Project states
  const [graduationProjectConfig, setGraduationProjectConfig] = useState<GraduationProjectConfig | null>(null);
  const [newGradProjectPriceAmount, setNewGradProjectPriceAmount] = useState<string>('');
  const [newGradProjectFeature, setNewGradProjectFeature] = useState<string>('');
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  // Simple visual toggle flags per-row / per-item (persists in localStorage)
  type RowFlags = { f1: boolean; f2: boolean; f3: boolean };

  const [toggledFlags, setToggledFlags] = useState<Record<string, RowFlags>>(() => {
    try {
      const saved = localStorage.getItem('admin_toggled_flags');
      const parsed = saved ? JSON.parse(saved) : {};
      const result: Record<string, RowFlags> = {};
      Object.keys(parsed || {}).forEach((key) => {
        const val = parsed[key];
        if (typeof val === 'boolean') {
          result[key] = { f1: !!val, f2: false, f3: false };
        } else if (val && typeof val === 'object') {
          result[key] = {
            f1: !!val.f1,
            f2: !!val.f2,
            f3: !!val.f3
          };
        }
      });
      return result;
    } catch {
      return {};
    }
  });

  useEffect(() => {
    localStorage.setItem('admin_toggled_flags', JSON.stringify(toggledFlags));
  }, [toggledFlags]);

  const toggleFlag = (key: string, index: 1 | 2 | 3) => {
    setToggledFlags(prev => ({
      ...prev,
      [key]: {
        f1: index === 1 ? !prev[key]?.f1 : !!prev[key]?.f1,
        f2: index === 2 ? !prev[key]?.f2 : !!prev[key]?.f2,
        f3: index === 3 ? !prev[key]?.f3 : !!prev[key]?.f3
      }
    }));
  };

  // عارض مرفقات (Sheet) لعرض كل الصور/الملفات في Overlay داخل الصفحة
  const [documentViewer, setDocumentViewer] = useState<{ open: boolean; urls: string[] }>({
    open: false,
    urls: []
  });
  const [documentViewerLoadedImages, setDocumentViewerLoadedImages] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (documentViewer.open) setDocumentViewerLoadedImages(new Set());
  }, [documentViewer.open]);

  /** عارض تكليفات الطالب (الملفات المُرسلة له) */
  const [assignedFilesViewer, setAssignedFilesViewer] = useState<{
    open: boolean;
    studentName: string;
    files: AssignedFile[];
  }>({ open: false, studentName: '', files: [] });

  const isServiceActive = (serviceId: string) => {
    const setting = serviceSettings[serviceId];
    if (typeof setting === 'boolean') return setting;
    if (typeof setting === 'object' && setting !== null) return setting.active !== false;
    return true;
  };

  const getDisabledFields = (serviceId: string) => {
    const setting = serviceSettings[serviceId];
    if (typeof setting === 'object' && setting !== null && setting.disabledFields) {
      return setting.disabledFields;
    }
    return [];
  };

  useEffect(() => {
    if (!student?.id) return;

    const checkAdmin = async () => {
      const isAdmin = await checkIsAdmin(student.id || '');
      if (!isAdmin) {
        onBack();
        return;
      }
      setIsLoading(false);
    };

    checkAdmin();
  }, [student, onBack]);

  useEffect(() => {

    if (isLoading) return;

    // Subscribe to all service requests
    const unsubscribe = subscribeToAllServiceRequests((requests) => {
      setServiceRequests(requests);
      setDataReady(true);

      // Fetch student data for each request - batch fetch (أسرع من طلب كل طالب لوحده)
      const fetchStudents = async () => {
        const uniqueStudentIds = [...new Set(requests.map(r => r.studentId))];
        setStudents(prev => {
          const missingIds = uniqueStudentIds.filter(id => !prev[id]);
          if (missingIds.length === 0) return prev;

          getStudentsByIds(missingIds).then(fetched => {
            setStudents(current => ({ ...current, ...fetched }));
          });
          return prev;
        });
      };
      fetchStudents();
    });

    return () => unsubscribe();
  }, [isLoading]);

  // تحميل إعدادات الخدمات والأكواد بعد ظهور الطلبات (حتى لا نبطئ أول رسم للجدول)
  useEffect(() => {
    if (!dataReady || isLoading) return;

    let unsubscribeDtCodes: (() => void) | undefined;
    let unsubscribeEpCodes: (() => void) | undefined;

    const loadBookConfig = async () => {
      try {
        const config = await getBookServiceConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          setBookConfig(config);
        } else {
          // Default config
          setBookConfig({
            serviceName: 'شحن الكتب الدراسية',
            prices: {
              '1': 1750,
              '2': 3440,
              '3': 5160,
              '4': 6820,
              '5': 8450,
              '6': 10200,
              '7': 11885,
              '8': 13580,
              '9': 15210,
              '10': 16900,
              '11': 18500
            },
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          });
        }
      } catch (error) {
        logger.error('Error loading book config:', error);
      }
    };
    loadBookConfig();

    // Load fees config
    const loadFeesConfig = async () => {
      try {
        const config = await getFeesServiceConfig();
        if (config) {
          if (!config.paymentMethods) {
            config.paymentMethods = {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            };
          } else if (config.paymentMethods.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          setFeesConfig(config);
        } else {
          // Default config
          setFeesConfig({
            prices: {},
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          });
        }
      } catch (error) {
        logger.error('Error loading fees config:', error);
      }
    };
    loadFeesConfig();

    // Load assignments config
    const loadAssignmentsConfig = async () => {
      try {
        const config = await getAssignmentsServiceConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          setAssignmentsConfig(config);
        } else {
          // Default config
          setAssignmentsConfig({
            serviceName: 'حل وتسليم تكاليف الترم الاول',
            assignments: [],
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          });
        }
      } catch (error) {
        logger.error('Error loading assignments config:', error);
      }
    };
    loadAssignmentsConfig();

    // Load certificates config
    const loadCertificatesConfig = async () => {
      try {
        logger.log('Loading certificates config in AdminDashboard...');
        const config = await getCertificatesServiceConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          logger.log('Setting certificates config in AdminDashboard:', config.certificates?.length || 0, 'certificates');
          setCertificatesConfig(config);
        } else {
          logger.log('No config found, using default certificates config');
          // Default config with 4 certificates
          const defaultConfig: CertificatesServiceConfig = {
            certificates: [
              {
                id: '1',
                name: 'شهادة تحول رقمي',
                price: 4000,
                imageUrl: '/certificat.jpeg',
                description: ''
              },
              {
                id: '2',
                name: 'شهادة الخدمة العامة',
                price: 5000,
                imageUrl: '/service.jpg',
                description: 'شهادة الخدمة العامة\n\nتمكنا من التعاقد مع احدي المؤسسات للحصول علي شهادة اداء الخدمة العامة بكل سهوله و يسر دون عناء حيث انه يتطلب بعض الاجراءات الروتينية و من ثم الحصول علي الشهادة',
                fields: [
                  { name: 'qualification_name', label: 'اسم المؤهل', type: 'text', required: true, placeholder: 'مثال: بكالوريوس تجارة / ليسانس اداب' },
                  { name: 'qualification_date', label: 'تاريخ الحصول علي البكالوريوس او الليسانس', type: 'date', required: true, placeholder: 'مثال: مارس 2022 / سبتمبر 2024' }
                ]
              },
              {
                id: '3',
                name: 'شهادة محو الأمية',
                price: 5000,
                imageUrl: '/omaya.jpeg',
                description: 'شهادة محو اميه\n\nتمكنا من اجراء اختبارات محو اميه بشكل سليم و سهل في احد المراكز التي تسهل الحصول علي الشهادة و تيسير عمليه الامتحان علي الطالب للحصول علي الشهادة'
              },
              {
                id: '4',
                name: 'شهادة خبرة (معلم)',
                price: 5000,
                imageUrl: '/exprince.jpg',
                description: 'شهادة خبرة ( معلم)\n\nتقدم احدي المدارس شهادة خبرة بناء علي التخصص و الوظيفه للحضول عليها خلال اشهر فقط من الاعتماد بالمدرسة',
                fields: [
                  { name: 'work_start_date', label: 'سنة بداية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                  { name: 'work_end_date', label: 'سنة نهاية العمل بالمدرسة', type: 'date' as const, required: true, placeholder: 'mm/dd/yyyy' },
                  { name: 'subject_specialization', label: 'تخصص مادة', type: 'text' as const, required: true, placeholder: 'مثال: عربي - علوم - رياضيات . الخ...' }
                ]
              }
            ],
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          };

          // Save default config to Firebase
          try {
            // Ensure all values are defined
            const cleanDefaultConfig = {
              certificates: defaultConfig.certificates.map(c => ({
                id: c.id,
                name: c.name,
                price: c.price,
                imageUrl: c.imageUrl || '',
                description: c.description || '',
                fields: c.fields || []
              })),
              paymentMethods: defaultConfig.paymentMethods
            };

            await updateCertificatesServiceConfig(cleanDefaultConfig);
            logger.log('Default certificates config saved to Firebase');
          } catch (saveError) {
            logger.error('Error saving default config:', saveError);
          }

          setCertificatesConfig(defaultConfig);
        }
      } catch (error) {
        logger.error('Error loading certificates config:', error);
      }
    };
    loadCertificatesConfig();

    // Load digital transformation config
    const loadDigitalTransformationConfig = async () => {
      try {
        logger.log('Loading digital transformation config in AdminDashboard...');
        const config = await getDigitalTransformationConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          logger.log('Setting digital transformation config in AdminDashboard:', config.transformationTypes?.length || 0, 'types');
          setDigitalTransformationConfig(config);
        } else {
          logger.log('No config found, using default digital transformation config');
          const defaultConfig: DigitalTransformationConfig = {
            transformationTypes: [],
            examLanguage: ['اللغة العربية'],
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateDigitalTransformationConfig(defaultConfig);
            logger.log('Default digital transformation config saved to Firebase');
          } catch (saveError) {
            logger.error('Error saving default config:', saveError);
          }

          setDigitalTransformationConfig(defaultConfig);
        }
      } catch (error) {
        logger.error('Error loading digital transformation config:', error);
      }
    };
    loadDigitalTransformationConfig();

    // Load final review config
    const loadFinalReviewConfig = async () => {
      try {
        logger.log('Loading final review config in AdminDashboard...');
        const config = await getFinalReviewConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          logger.log('Setting final review config in AdminDashboard:', config);
          setFinalReviewConfig(config);
        } else {
          logger.log('No config found, using default final review config');
          const defaultConfig: FinalReviewConfig = {
            serviceName: 'المراجعة النهائية',
            paymentAmount: 500,
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateFinalReviewConfig(defaultConfig);
            logger.log('Default final review config saved to Firebase');
          } catch (saveError) {
            logger.error('Error saving default config:', saveError);
          }

          setFinalReviewConfig(defaultConfig);
        }
      } catch (error) {
        logger.error('Error loading final review config:', error);
      }
    };
    loadFinalReviewConfig();

    // Load graduation project config
    const loadGraduationProjectConfig = async () => {
      try {
        logger.log('Loading graduation project config in AdminDashboard...');
        const config = await getGraduationProjectConfig();
        if (config) {
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
          logger.log('Setting graduation project config in AdminDashboard:', config);
          setGraduationProjectConfig(config);
        } else {
          logger.log('No config found, using default graduation project config');
          const defaultConfig: GraduationProjectConfig = {
            serviceName: 'مشروع التخرج',
            features: [
              'اعداد مشروع التخرج كامل',
              'شرح جميع جوانب المشروع و تفاصيله',
              'اعداد الاجزاء الاحصائية علي ارض الواقع',
              'تقسيم الادوار و التدريب علي الالقاء الشفوي',
              'احدث قائمة مراجع للمشروع',
              'اعداد العرض التقديمي PowerPoint'
            ],
            prices: [],
            paymentMethods: {
              instaPay: 'raoufpk97@instapay',
              cashWallet: '01050889591'
            }
          };

          try {
            await updateGraduationProjectConfig(defaultConfig);
            logger.log('Default graduation project config saved to Firebase');
            setGraduationProjectConfig(defaultConfig);
          } catch (saveError) {
            logger.error('Error saving default graduation project config:', saveError);
            setGraduationProjectConfig(defaultConfig);
          }
        }
      } catch (error) {
        logger.error('Error loading graduation project config:', error);
      }
    };
    loadGraduationProjectConfig();

    // Load Latest News
    const loadLatestNews = async () => {
      try {
        const news = await getLatestNews();
        if (news) {
          setLatestNews(news.content);
        }
      } catch (error) {
        logger.error('Error loading latest news:', error);
      }
    };
    loadLatestNews();

    unsubscribeDtCodes = subscribeToDigitalTransformationCodes((codes) => {
      logger.log('Real-time update: Digital Transformation Codes loaded:', codes.length);
      setDtCodes(codes);
    });
    unsubscribeEpCodes = subscribeToElectronicPaymentCodes((codes) => {
      logger.log('Real-time update: Electronic Payment Codes loaded:', codes.length);
      setEpCodes(codes);
    });

    return () => {
      if (unsubscribeDtCodes) unsubscribeDtCodes();
      if (unsubscribeEpCodes) unsubscribeEpCodes();
    };
  }, [dataReady, isLoading]);

  // Subscribe to service settings
  useEffect(() => {
    const unsubscribe = subscribeToServiceSettings((settings) => {
      setServiceSettings(settings);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to admin preferences
  useEffect(() => {
    const unsubscribe = subscribeToAdminPreferences((prefs) => {
      setAdminPrefs(prefs);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe to all students for users tab
  useEffect(() => {
    if (isLoading || activeTab !== 'users') {
      setAllStudents([]);
      return;
    }

    // Only subscribe if searchTerm is empty (showing all students)
    if (searchTerm.trim()) {
      return;
    }

    const unsubscribe = subscribeToAllStudents((students) => {
      logger.log('Students loaded:', students.length);
      setAllStudents(students);
    }, (error) => {
      logger.error('Error subscribing to students:', error);
      showAlert('خطأ', 'حدث خطأ أثناء جلب بيانات المستخدمين', 'error');
    });

    return () => unsubscribe();
  }, [isLoading, activeTab, searchTerm]);

  const handleStatusChange = async (requestId: string, status: 'pending' | 'completed' | 'rejected', serviceId: string) => {
    try {
      await updateServiceRequestStatus(requestId, status, serviceId);

      // Trigger Automation Service (Node.js Backend) - Digital Transformation
      if (serviceId === '7' && status === 'completed') {
        const request = serviceRequests.find(r => r.id === requestId);
        if (request) {
          let studentData = students[request.studentId];
          if (!studentData) {
            try {
              const fetchedData = await getStudentData(request.studentId);
              if (fetchedData) studentData = fetchedData;
            } catch (e) {
              logger.error('Error fetching student data directly', e);
            }
          }
          if (studentData || request.data) {
            setToastState({ message: 'جاري الحصول على كود التحول الرقمي...', type: 'loading', duration: 3000 });

            // استخدام البيانات المعدلة من الطلب أولاً، ثم البيانات الأصلية كاحتياطي
            const payload = {
              requestId: requestId,
              studentId: request.studentId,
              email: request.data.email || studentData.email || '',
              fullNameArabic: request.data.full_name_arabic || request.data.full_name || studentData.fullNameArabic || '',
              fullNameEnglish: request.data.full_name_english || studentData.vehicleNameEnglish || '',
              nationalID: request.data.national_id || studentData.nationalID || '',
              phone: request.data.whatsapp_number || studentData.whatsappNumber || '',
              examLanguage: request.data.exam_language || request.data.selectedExamLanguage || 'عربي'
            };

            const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
            const apiUrl = `${API_BASE_URL}/api/digital-transformation/register`;

            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
              .then(async (res) => {
                const data = await res.json();
                if (data.success) {
                  // إخفاء رسالة التحميل بعد 2 ثانية
                  setToastState(null);

                  setTimeout(async () => {
                    try {
                      const codeData = {
                        studentId: request.studentId || '',
                        requestId: requestId || '',
                        email: payload.email || '',
                        fullNameArabic: payload.fullNameArabic || '',
                        fullNameEnglish: payload.fullNameEnglish || '',
                        phone: payload.phone || '',
                        examLanguage: payload.examLanguage || '',
                        serialNumber: data.data.serialNumber || '',
                        name: data.data.name || '',
                        fawryCode: data.data.fawryCode || '',
                        mobile: data.data.mobile || '',
                        whatsapp: data.data.whatsapp || '',
                        type: data.data.type || '',
                        value: data.data.value || '',
                        status: data.data.status || '',
                        createdAt: new Date().toISOString()
                      };

                      await saveDigitalTransformationCode(codeData);
                      setToastState({ message: `تم الانتهاء مبروك رقم الطلب هو ${data.data.fawryCode}`, type: 'success', duration: 5000 });
                    } catch (saveError) {
                      logger.error('Save Error:', saveError);
                      setToastState({ message: 'نجحت الأتمتة ولكن فشل الحفظ في قاعدة البيانات', type: 'error', duration: 5000 });
                    }
                  }, 500); // تأخير بسيط لظهور رسالة النجاح بشكل منفصل
                } else {
                  logger.error('Automation Error:', data.error);
                  setToastState({ message: `فشلت الأتمتة: ${data.error}`, type: 'error' });
                }
              })
              .catch(err => {
                logger.error('Connection Error:', err);
                setToastState({ message: 'لا يمكن الاتصال بخدمة الأتمتة', type: 'error' });
              });
          }
        }
      }

      // Trigger Automation Service for Electronic Payment Codes (service 4 - دفع المصروفات الدراسية)
      if (serviceId === '4' && status === 'completed') {
        const request = serviceRequests.find(r => r.id === requestId);
        if (request) {
          let studentData = students[request.studentId];
          if (!studentData) {
            try {
              const fetchedData = await getStudentData(request.studentId);
              if (fetchedData) studentData = fetchedData;
            } catch (e) {
              logger.error('Error fetching student data directly', e);
            }
          }
          if (studentData || request.data) {
            setToastState({ message: 'جاري الحصول على رقم الطلب...', type: 'loading', duration: 3000 });

            // استخدام البيانات المعدلة من الطلب أولاً، ثم البيانات الأصلية كاحتياطي
            const payload = {
              requestId: requestId,
              studentId: request.studentId,
              email: request.data.email || studentData.email || '',
              fullNameArabic: request.data.full_name_arabic || request.data.full_name || studentData.fullNameArabic || '',
              nationalID: request.data.national_id || studentData.nationalID || '',
              phone: request.data.whatsapp_number || studentData.whatsappNumber || ''
            };

            const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;
            const apiUrl = `${API_BASE_URL}/api/electronic-payment/create`;

            fetch(apiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            })
              .then(async (res) => {
                const data = await res.json();
                if (data.success) {
                  // إخفاء رسالة التحميل بعد 2 ثانية
                  setToastState(null);

                  setTimeout(async () => {
                    const ep = data.data || {};
                    try {
                      const codeData = {
                        studentId: ep.studentId || request.studentId || '',
                        requestId: ep.requestId || requestId || '',
                        name: ep.name || '',
                        email: ep.email || '',
                        nationalID: ep.nationalID || '',
                        mobile: ep.mobile || '',
                        entity: ep.entity || 'كلية التربية',
                        serviceType: ep.serviceType || 'دبلوم (2025 - 2026)',
                        orderNumber: ep.orderNumber || '',
                        status: ep.status || 'NEW',
                        rawText: ep.rawText || '',
                        createdAt: new Date().toISOString()
                      };

                      await saveElectronicPaymentCode(codeData);
                      setToastState({ message: `تم الانتهاء مبروك رقم الطلب هو ${ep.orderNumber}`, type: 'success', duration: 5000 });
                    } catch (saveError) {
                      logger.error('[EP] Save Error:', saveError);
                      setToastState({ message: 'نجحت الأتمتة ولكن فشل الحفظ', type: 'error', duration: 5000 });
                    }
                  }, 500); // تأخير بسيط لظهور رسالة النجاح بشكل منفصل
                } else {
                  logger.error('[EP] Automation Error:', data.error);
                  setToastState({ message: `فشلت الأتمتة: ${data.error}`, type: 'error' });
                }
              })
              .catch(err => {
                logger.error('[EP] Connection Error:', err);
                setToastState({ message: 'لا يمكن الاتصال بخدمة الأتمتة', type: 'error' });
              });
          }
        }
      }

    } catch (error: any) {
      setToastState({ message: error.message || 'حدث خطأ أثناء تحديث حالة الطلب', type: 'error' });
    }
  };

  const handleDeleteRequest = async (requestId: string, serviceId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب نهائياً؟')) {
      return;
    }
    try {
      await deleteServiceRequest(requestId, serviceId);
      setToastState({ message: 'تم حذف الطلب بنجاح', type: 'success' });
    } catch (error: any) {
      setToastState({ message: error.message || 'حدث خطأ أثناء حذف الطلب', type: 'error' });
    }
  };

  const handleDownloadAll = async (request: ServiceRequest) => {
    const imagesToDownload: { url: string; name: string }[] = [];

    // إيصال الدفع الرئيسي
    if (request.data?.receiptUrl) {
      imagesToDownload.push({ url: request.data.receiptUrl, name: `receipt_${request.id}.jpg` });
    }

    // المرفقات الأخرى
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

      const zip = new JSZip();
      const folder = zip.folder(`request_${request.id || 'unknown'}`) || zip;

      for (const img of imagesToDownload) {
        try {
          const response = await fetch(img.url);
          const blob = await response.blob();
          folder.file(img.name, blob);
        } catch (error) {
          console.error('Download error (skipped in zip):', error);
        }
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const zipName = `request_${request.id || 'attachments'}.zip`;
      saveAs(content, zipName);

      setToastState({ message: 'تم تجهيز ملف الصور المضغوط للتحميل', type: 'success', duration: 3000 });
    } catch (error: any) {
      console.error('ZIP build error:', error);
      setToastState({ message: 'حدث خطأ أثناء تجهيز ملف الصور', type: 'error', duration: 3000 });
    }
  };

  const handleSaveBookConfig = async () => {
    if (!bookConfig || isSaving === 'books') return;
    setIsSaving('books');
    try {
      await updateBookServiceConfig(bookConfig);
      setIsEditingBooks(false);
      showAlert('نجاح', 'تم حفظ الإعدادات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const handleSaveFeesConfig = async () => {
    if (!feesConfig || isSaving === 'fees') return;
    setIsSaving('fees');
    try {
      await updateFeesServiceConfig(feesConfig);
      setIsEditingFees(false);
      showAlert('نجاح', 'تم حفظ إعدادات المصروفات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  /*
  const handleSaveAssignmentsConfig = async () => {
    if (!assignmentsConfig || isSaving === 'assignments') return;
    setIsSaving('assignments');
    try {
      await updateAssignmentsServiceConfig(assignmentsConfig);
      alert('تم حفظ إعدادات التكليفات بنجاح');
    } catch (error: any) {
      alert(error.message || 'حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setIsSaving(null);
    }
  };
  */

  /*
  const handleAddAssignment = () => {
    if (!newAssignmentName || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      showAlert('تنبيه', 'يرجى إدخال سعر صحيح', 'warning');
      return;
    }
    const newAssignment: AssignmentItem = {
      id: Date.now().toString(),
      name: newAssignmentName,
      price: price
    };
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: [...assignmentsConfig.assignments, newAssignment]
    });
    setNewAssignmentName('');
    setNewAssignmentPrice('');
  };
  */

  /*
  const handleRemoveAssignment = (id: string) => {
    if (!assignmentsConfig) return;
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    });
  };
  */

  const handleSaveCertificatesConfig = async () => {
    if (!certificatesConfig || isSaving === 'certificates') return;
    setIsSaving('certificates');
    try {
      await updateCertificatesServiceConfig(certificatesConfig);
      showAlert('نجاح', 'تم حفظ إعدادات الشهادات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddCertificate = () => {
    if (!newCertificateName || !newCertificatePrice || !certificatesConfig) return;
    const price = parseFloat(newCertificatePrice);
    if (isNaN(price) || price <= 0) {
      showAlert('تنبيه', 'يرجى إدخال سعر صحيح', 'warning');
      return;
    }
    const newCertificate: CertificateItem = {
      id: Date.now().toString(),
      name: newCertificateName,
      price: price,
      imageUrl: '',
      description: newCertificateDescription || undefined
    };
    setCertificatesConfig({
      ...certificatesConfig,
      certificates: [...certificatesConfig.certificates, newCertificate]
    });
    setNewCertificateName('');
    setNewCertificatePrice('');
    setNewCertificateDescription('');
  };

  const handleRemoveCertificate = (id: string) => {
    if (!certificatesConfig) return;
    if (confirm('هل أنت متأكد من حذف هذه الشهادة؟')) {
      setCertificatesConfig({
        ...certificatesConfig,
        certificates: certificatesConfig.certificates.filter(c => c.id !== id)
      });
    }
  };

  // Digital Transformation handlers
  const handleSaveDigitalTransformationConfig = async () => {
    if (!digitalTransformationConfig || isSaving === 'digitalTransformation') return;
    setIsSaving('digitalTransformation');
    try {
      await updateDigitalTransformationConfig(digitalTransformationConfig);
      showAlert('نجاح', 'تم حفظ الإعدادات بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddTransformationType = () => {
    if (!newTransformationTypeName || !newTransformationTypePrice || !digitalTransformationConfig) return;
    const price = parseFloat(newTransformationTypePrice);
    if (isNaN(price) || price <= 0) {
      showAlert('تنبيه', 'يرجى إدخال سعر صحيح', 'warning');
      return;
    }

    const newType: DigitalTransformationType = {
      id: Date.now().toString(),
      name: newTransformationTypeName,
      price: price
    };

    setDigitalTransformationConfig({
      ...digitalTransformationConfig,
      transformationTypes: [...digitalTransformationConfig.transformationTypes, newType]
    });

    setNewTransformationTypeName('');
    setNewTransformationTypePrice('');
  };

  const handleRemoveTransformationType = (id: string) => {
    if (!digitalTransformationConfig) return;
    if (confirm('هل أنت متأكد من حذف هذا النوع؟')) {
      setDigitalTransformationConfig({
        ...digitalTransformationConfig,
        transformationTypes: digitalTransformationConfig.transformationTypes.filter(t => t.id !== id)
      });
    }
  };

  const handleAddExamLanguage = () => {
    if (!newExamLanguage.trim() || !digitalTransformationConfig) return;

    setDigitalTransformationConfig({
      ...digitalTransformationConfig,
      examLanguage: [...digitalTransformationConfig.examLanguage, newExamLanguage.trim()]
    });

    setNewExamLanguage('');
  };

  const handleRemoveExamLanguage = (index: number) => {
    if (!digitalTransformationConfig) return;
    if (confirm('هل أنت متأكد من حذف هذه اللغة؟')) {
      setDigitalTransformationConfig({
        ...digitalTransformationConfig,
        examLanguage: digitalTransformationConfig.examLanguage.filter((_, i) => i !== index)
      });
    }
  };

  // Final Review handlers
  const handleSaveFinalReviewConfig = async () => {
    if (!finalReviewConfig || isSaving === 'finalReview') return;
    setIsSaving('finalReview');
    try {
      await updateFinalReviewConfig(finalReviewConfig);
      showAlert('نجاح', 'تم حفظ إعدادات المراجعة النهائية بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  // Graduation Project handlers
  const handleSaveGraduationProjectConfig = async () => {
    if (!graduationProjectConfig || isSaving === 'graduationProject') return;
    setIsSaving('graduationProject');
    try {
      await updateGraduationProjectConfig(graduationProjectConfig);
      showAlert('نجاح', 'تم حفظ إعدادات مشروع التخرج بنجاح!', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ الإعدادات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const handleAddGraduationProjectPrice = () => {
    if (!graduationProjectConfig) return;
    if (!newGradProjectPriceAmount) {
      showAlert('تنبيه', 'يرجى إدخال السعر', 'warning');
      return;
    }
    const newPrice: GraduationProjectPrice = {
      id: Date.now().toString(),
      price: parseFloat(newGradProjectPriceAmount)
    };
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      prices: [...(graduationProjectConfig.prices || []), newPrice]
    });
    setNewGradProjectPriceAmount('');
  };

  const handleRemoveGraduationProjectPrice = (priceId: string) => {
    if (!graduationProjectConfig) return;
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      prices: graduationProjectConfig.prices.filter(p => p.id !== priceId)
    });
  };

  const handleAddGraduationProjectFeature = () => {
    if (!graduationProjectConfig) return;
    if (!newGradProjectFeature.trim()) {
      showAlert('تنبيه', 'يرجى إدخال الميزة', 'warning');
      return;
    }
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      features: [...(graduationProjectConfig.features || []), newGradProjectFeature.trim()]
    });
    setNewGradProjectFeature('');
  };

  const handleRemoveGraduationProjectFeature = (index: number) => {
    if (!graduationProjectConfig) return;
    const newFeatures = [...graduationProjectConfig.features];
    newFeatures.splice(index, 1);
    setGraduationProjectConfig({
      ...graduationProjectConfig,
      features: newFeatures
    });
  };

  const handleEditCertificate = (certificate: CertificateItem) => {
    // Create a deep copy to avoid reference issues
    setEditingCertificate({
      ...certificate,
      fields: certificate.fields ? [...certificate.fields] : undefined
    });
  };

  const handleUpdateCertificate = async () => {
    if (!editingCertificate || !certificatesConfig || isSaving === 'updateCertificate') return;
    setIsSaving('updateCertificate');
    const updatedConfig = {
      ...certificatesConfig,
      certificates: certificatesConfig.certificates.map(c =>
        c.id === editingCertificate.id ? editingCertificate : c
      )
    };
    setCertificatesConfig(updatedConfig);
    setEditingCertificate(null);
    // Save to Firebase
    try {
      await updateCertificatesServiceConfig(updatedConfig);
      showAlert('نجاح', 'تم حفظ التعديلات بنجاح', 'success');
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء حفظ التعديلات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const handleImageUpload = (certificateId: string, file: File) => {
    if (!editingCertificate || editingCertificate.id !== certificateId) {
      logger.error('Certificate ID mismatch or editingCertificate is null');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showAlert('تنبيه', 'يرجى اختيار ملف صورة صحيح', 'warning');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('تنبيه', 'حجم الصورة كبير جداً. الحد الأقصى 5 ميجابايت', 'warning');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const imageUrl = reader.result as string;
      if (imageUrl) {
        setEditingCertificate({ ...editingCertificate, imageUrl });
        logger.log('Image uploaded successfully');
      }
    };
    reader.onerror = () => {
      showAlert('خطأ', 'حدث خطأ أثناء قراءة الصورة', 'error');
    };
    reader.readAsDataURL(file);
  };

  const handleAddFeeYear = () => {
    if (!newFeeYear || !newFeeAmount || !feesConfig) return;
    const amount = parseFloat(newFeeAmount);
    if (isNaN(amount) || amount <= 0) {
      showAlert('تنبيه', 'يرجى إدخال مبلغ صحيح', 'warning');
      return;
    }
    setFeesConfig({
      ...feesConfig,
      prices: {
        ...feesConfig.prices,
        [newFeeYear]: amount
      }
    });
    setNewFeeYear('');
    setNewFeeAmount('');
  };

  const handleRemoveFeeYear = (year: string) => {
    if (!feesConfig) return;
    const newPrices = { ...feesConfig.prices };
    delete newPrices[year];
    setFeesConfig({
      ...feesConfig,
      prices: newPrices
    });
  };

  const handleSearchStudent = async () => {
    if (!searchTerm.trim()) {
      // Reset to show all students - useEffect will handle this
      setAllStudents([]);
      return;
    }

    try {
      const results = await searchStudent(searchTerm);
      logger.log('Search results:', results.length);
      setAllStudents(results);
    } catch (error: any) {
      logger.error('Search error:', error);
      showAlert('خطأ', error.message || 'حدث خطأ أثناء البحث', 'error');
    }
  };

  // Auto search on searchTerm change
  useEffect(() => {
    if (activeTab !== 'users' || isLoading) return;

    // If search term is empty, let the other useEffect handle showing all students
    if (!searchTerm.trim()) {
      return;
    }

    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearchStudent();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeTab, isLoading]);

  const handleEditStudent = (student: StudentData) => {
    setEditedStudentData({ ...student });
    setIsEditingStudent(true);
  };

  const handleSaveStudent = async () => {
    if (!editedStudentData || !editedStudentData.id || isSaving === 'student') return;
    setIsSaving('student');
    try {
      const originalStudent = allStudents.find(s => s.id === editedStudentData.id);
      let passwordAuthUpdated = false;
      let passwordAuthError = '';

      // If password has changed, try to update it in Auth as well
      if (originalStudent && originalStudent.password !== editedStudentData.password && editedStudentData.password) {
        setToastState({ message: 'جاري تحديث كلمة المرور في المصادقة...', type: 'loading' });
        try {
          await changeOtherUserPasswordHelper(editedStudentData.id!, editedStudentData.password);
          passwordAuthUpdated = true;
        } catch (e: any) {
          passwordAuthError = e.message || 'فشل تحديث كلمة المرور في المصادقة';
          console.warn("Could not sync auth password:", e);
        }
      }

      // Always update Firestore data (including new password)
      await updateStudentData(editedStudentData.id, editedStudentData);
      setIsEditingStudent(false);

      if (originalStudent && originalStudent.password !== editedStudentData.password && editedStudentData.password) {
        if (passwordAuthUpdated) {
          showAlert('نجاح', 'تم تحديث بيانات المستخدم وكلمة المرور بنجاح ✅\nكلمة المرور الجديدة تعمل فوراً في تسجيل الدخول.', 'success');
        } else {
          showAlert('تنبيه', `تم تحديث البيانات في قاعدة البيانات ✅\nلكن ${passwordAuthError}\n\nيُنصح بإرسال رابط إعادة تعيين كلمة المرور للمستخدم عبر البريد الإلكتروني.`, 'warning');
        }
      } else {
        showAlert('نجاح', 'تم تحديث بيانات المستخدم بنجاح', 'success');
      }
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
      setIsSaving(null);
    }
  };

  const getStudentRequests = (studentId: string): ServiceRequest[] => {
    return serviceRequests.filter(r => r.studentId === studentId);
  };

  const getServiceName = (serviceId: string): string => {
    if (serviceId === '3' && bookConfig) {
      return bookConfig.serviceName;
    }
    if (serviceId === '5' && assignmentsConfig) {
      return assignmentsConfig.serviceName;
    }
    if (serviceId === '8' && finalReviewConfig) {
      return finalReviewConfig.serviceName;
    }
    const serviceNames: Record<string, string> = {
      '1': 'سجل بياناتك',
      '2': 'العميل المميز',
      '3': 'شحن الكتب الدراسية',
      '4': 'دفع المصروفات الدراسية',
      '5': 'حل وتسليم تكليفات',
      '6': 'شهادات اونلاين',
      '7': 'التقديم علي التحول الرقمي',
      '8': 'المراجعة النهائية',
      '9': 'مشروع التخرج',
      '10': 'استخراج مستندات',
      '11': 'استلام و شحن التحول الرقمي'
    };
    return serviceNames[serviceId] || `خدمة ${serviceId}`;
  };

  const handlePublishNews = async () => {
    if (!latestNews.trim()) {
      showAlert('تنبيه', 'يرجى كتابة خبر لنشره', 'warning');
      return;
    }

    setIsPublishingNews(true);
    try {
      await updateLatestNews(latestNews);
      showAlert('نجاح', 'تم نشر الخبر بنجاح لجميع المستخدمين', 'success');
    } catch (error: any) {
      logger.error('Error publishing news:', error);
      showAlert('خطأ', 'حدث خطأ أثناء النشر', 'error');
    } finally {
      setIsPublishingNews(false);
    }
  };

  const handleSendQuickMessage = async () => {
    if (!latestNews.trim()) {
      showAlert('تنبيه', 'يرجى كتابة نص الرسالة السريعة أولاً', 'warning');
      return;
    }

    setIsSendingQuickMessage(true);
    try {
      await sendQuickNotification(latestNews);
      showAlert('تم الإرسال', 'تم إرسال الرسالة السريعة لجميع المستخدمين الآن', 'success');
    } catch (error: any) {
      logger.error('Error sending quick notification:', error);
      showAlert('خطأ', 'حدث خطأ أثناء إرسال الرسالة السريعة', 'error');
    } finally {
      setIsSendingQuickMessage(false);
    }
  };

  const handleStopPublishing = async () => {
    showConfirm('إيقاف النشر', 'هل أنت متأكد من إيقاف نشر الأخبار والرسائل السريعة؟ سيتم إزالة الخبر الحالي والرسائل السريعة من جميع المستخدمين.', async () => {
      try {
        await clearLatestNews();
        await clearQuickNotification();
        setLatestNews('');
        showAlert('تم الإيقاف', 'تم إيقاف نشر الأخبار والرسائل السريعة بنجاح', 'success');
      } catch (error: any) {
        logger.error('Error stopping publishing:', error);
        showAlert('خطأ', 'حدث خطأ أثناء إيقاف النشر', 'error');
      }
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="status-badge status-completed"><CheckCircle size={14} /> مكتمل</span>;
      case 'rejected':
        return <span className="status-badge status-rejected"><XCircle size={14} /> مرفوض</span>;
      default:
        return <span style={{ background: '#fffbeb', color: '#d97706', border: '1px solid #fcd34d', borderRadius: '12px', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 'bold', fontSize: '12px', width: 'fit-content', margin: '0 auto' }}><Clock size={14} /> قيد الانتظار</span>;
    }
  };

  // Helper functions for table selection
  const toggleDTRow = (rowIndex: number) => {
    const newSelected = new Set(selectedDTRows);
    if (newSelected.has(rowIndex)) {
      newSelected.delete(rowIndex);
    } else {
      newSelected.add(rowIndex);
    }
    setSelectedDTRows(newSelected);
    setSelectedDTColumns(new Set()); // Clear column selection
  };

  const toggleDTColumn = (colIndex: number) => {
    const newSelected = new Set(selectedDTColumns);
    if (newSelected.has(colIndex)) {
      newSelected.delete(colIndex);
    } else {
      newSelected.add(colIndex);
    }
    setSelectedDTColumns(newSelected);
    setSelectedDTRows(new Set()); // Clear row selection
  };

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

  const copyDTSelection = () => {
    if (selectedDTRows.size === 0 && selectedDTColumns.size === 0) return;

    let textToCopy = '';
    if (selectedDTRows.size > 0) {
      // Copy selected rows
      const sortedRows = Array.from(selectedDTRows).sort((a, b) => a - b);
      textToCopy = sortedRows.map(rowIndex => {
        const code = dtCodes[rowIndex];
        return `${code.name}\t${code.mobile || code.phone}\t${code.email}\t${code.type}\t${code.value}\t${code.status}\t${code.updatedAt?.seconds ? new Date(code.updatedAt.seconds * 1000).toLocaleString('ar-EG') : 'الان'}\t${code.fawryCode}`;
      }).join('\n');
    } else if (selectedDTColumns.size > 0) {
      // Copy selected columns
      const sortedCols = Array.from(selectedDTColumns).sort((a, b) => a - b);
      textToCopy = dtCodes.map(code => {
        const values = [code.name, code.mobile || code.phone, code.email, code.type, code.value, code.status, code.updatedAt?.seconds ? new Date(code.updatedAt.seconds * 1000).toLocaleString('ar-EG') : 'الان', code.fawryCode];
        return sortedCols.map(colIndex => values[colIndex]).join('\t');
      }).join('\n');
    }

    navigator.clipboard.writeText(textToCopy);
    setToastState({ message: 'تم نسخ التحديد بنجاح!', type: 'success', duration: 2000 });
  };

  const copyEPSelection = () => {
    if (selectedEPRows.size === 0 && selectedEPColumns.size === 0) return;

    let textToCopy = '';
    if (selectedEPRows.size > 0) {
      const sortedRows = Array.from(selectedEPRows).sort((a, b) => a - b);
      textToCopy = sortedRows.map(rowIndex => {
        const code = epCodes[rowIndex];
        return `${code.name}\t${code.mobile}\t${code.email}\t${code.nationalID}\t${code.entity}\t${code.serviceType}\t${code.createdAt?.seconds ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG') : (code.createdAt || 'الان')}\t${code.orderNumber}`;
      }).join('\n');
    } else if (selectedEPColumns.size > 0) {
      const sortedCols = Array.from(selectedEPColumns).sort((a, b) => a - b);
      textToCopy = epCodes.map(code => {
        const values = [code.name, code.mobile, code.email, code.nationalID, code.entity, code.serviceType, code.createdAt?.seconds ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG') : (code.createdAt || 'الان'), code.orderNumber];
        return sortedCols.map(colIndex => values[colIndex]).join('\t');
      }).join('\n');
    }

    navigator.clipboard.writeText(textToCopy);
    setToastState({ message: 'تم نسخ التحديد بنجاح!', type: 'success', duration: 2000 });
  };

  // Copy specific column from DT table
  const copyDTColumn = (columnName: string, columnIndex: number) => {
    const columnData = dtCodes.map(code => {
      const values = [
        code.name,
        code.mobile || code.phone,
        code.email,
        code.type,
        code.value,
        code.status,
        code.updatedAt?.seconds ? new Date(code.updatedAt.seconds * 1000).toLocaleString('ar-EG') : 'الان',
        code.fawryCode
      ];
      return values[columnIndex];
    }).join('\n');

    navigator.clipboard.writeText(columnData);
    setToastState({ message: `تم نسخ عمود "${columnName}" بنجاح!`, type: 'success', duration: 2000 });
  };

  // Copy specific column from EP table
  const copyEPColumn = (columnName: string, columnIndex: number) => {
    const columnData = epCodes.map(code => {
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

  /**
   * نسخ عمود محدد من جدول طلبات الخدمات
   * @param columnName اسم العمود للعرض في التنبيه
   * @param filteredRequests قائمة الطلبات الحالية
   * @param getValue Function returns the string value for this column
   */
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

    // افتح Sheet داخل الصفحة يعرض كل المرفقات
    setDocumentViewer({ open: true, urls: safeUrls });
  };

  const moveServiceManual = async (serviceId: string, direction: 'up' | 'down') => {
    const currentOrder = (adminPrefs.serviceOrder && adminPrefs.serviceOrder.length > 0)
      ? [...adminPrefs.serviceOrder]
      : SERVICES.map(s => s.id);

    const index = currentOrder.indexOf(serviceId);
    if (index === -1) return;

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= currentOrder.length) return;

    const newOrder = [...currentOrder];
    [newOrder[index], newOrder[newIndex]] = [newOrder[newIndex], newOrder[index]];

    const updatedPrefs = { ...adminPrefs, serviceOrder: newOrder };
    setAdminPrefs(updatedPrefs);
    try {
      await updateAdminPreferences(updatedPrefs);
    } catch (e) {
      logger.error('Failed to update service order:', e);
    }
  };


  const handleDeleteDTCode = async (id: string) => {
    if (!id) return;
    try {
      await deleteDigitalTransformationCode(id);
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  const handleDeleteEPCode = async (id: string) => {
    if (!id) return;
    try {
      await deleteElectronicPaymentCode(id);
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  };

  if (isLoading) {
    return (
      <div className="admin-dashboard-page">
        <div className="loading-container">
          <div className="modern-loader">
            <div className="loader-spinner"></div>
            <p style={{ fontFamily: 'sans-serif', marginTop: '10px', color: '#64748b' }}>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-header">
        <div className="admin-header-content">
          <h1>لوحة تحكم الإدارة</h1>
          <div className="admin-actions">
            <button onClick={onBack} className="back-button">
              رجوع
            </button>
            <button onClick={onLogout} className="logout-button">
              <LogOut size={18} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      {toastState && (
        <CustomToast
          message={toastState.message}
          type={toastState.type}
          onClose={() => setToastState(null)}
          autoClose={true} // Allow auto-close for all types, as now controlled by duration/type intent
          duration={toastState.duration}
        />
      )}

      <div className="admin-tabs">
        <button
          className={`tab-button ${activeTab === 'news' ? 'active' : ''}`}
          onClick={() => setActiveTab('news')}
        >
          <Newspaper size={18} />
          أخر الأخبار
        </button>
        <button
          className={`tab-button ${activeTab === 'requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('requests')}
        >
          جميع الطلبات
        </button>
        <button
          className={`tab-button ${activeTab === 'statistics' ? 'active' : ''}`}
          onClick={() => setActiveTab('statistics')}
        >
          <BarChart2 size={18} />
          الإحصائيات والتقارير
        </button>
        <button
          className={`tab-button ${activeTab === 'books' ? 'active' : ''}`}
          onClick={() => setActiveTab('books')}
        >
          <Package size={18} />
          كتب
        </button>
        <button
          className={`tab-button ${activeTab === 'fees' ? 'active' : ''}`}
          onClick={() => setActiveTab('fees')}
        >
          <CreditCard size={18} />
          مصروفات
        </button>
        {onAssignmentsClick && (
          <button
            className="tab-button assignments-link-button"
            onClick={onAssignmentsClick}
            title="فتح صفحة إدارة التكليفات الدراسية الجزئية"
          >
            <FileCheck size={18} />
            تكليف
          </button>
        )}
        <button
          className={`tab-button ${activeTab === 'certificates' ? 'active' : ''}`}
          onClick={() => setActiveTab('certificates')}
        >
          <Award size={18} />
          اونلاين
        </button>
        <button
          className={`tab-button ${activeTab === 'digitalTransformation' ? 'active' : ''}`}
          onClick={() => setActiveTab('digitalTransformation')}
        >
          <Zap size={18} />
          تحول
        </button>
        <button
          className={`tab-button ${activeTab === 'digitalTransformationCodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('digitalTransformationCodes')}
        >
          <Zap size={18} />
          كود تحول
        </button>
        <button
          className={`tab-button ${activeTab === 'electronicPaymentCodes' ? 'active' : ''}`}
          onClick={() => setActiveTab('electronicPaymentCodes')}
        >
          <CreditCard size={18} />
          اكواد مصاريف
        </button>
        <button
          className={`tab-button ${activeTab === 'finalReview' ? 'active' : ''}`}
          onClick={() => setActiveTab('finalReview')}
        >
          <Search size={18} />
          مراجعة
        </button>
        <button
          className={`tab-button ${activeTab === 'graduationProject' ? 'active' : ''}`}
          onClick={() => setActiveTab('graduationProject')}
        >
          <GraduationCap size={18} />
          مشروع
        </button>
        <button
          className={`tab-button ${activeTab === 'services' ? 'active' : ''}`}
          onClick={() => setActiveTab('services')}
        >
          <Settings size={18} />
          إدارة الخدمات
        </button>
        <button
          className={`tab-button ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <Users size={18} />
          المستخدمين
        </button>
      </div>

      {activeTab === 'news' && (
        <div className="admin-content">
          <div className="config-section premium-news-editor">
            <div className="section-header-compact">
              <div className="header-icon-hex">
                <Bell size={24} color="#F59E0B" />
              </div>
              <div>
                <h2>إدارة أخر الأخبار</h2>
                <p>هذا النص سيظهر لجميع المستخدمين في صفحة "أخر الأخبار" بشكل مميز.</p>
              </div>
            </div>

            <div className="news-editor-container" style={{ marginTop: '24px' }}>
              <div className="form-group-full">
                <label>محتوى الخبر (يمكنك كتابة أي نص بأي طول)</label>
                <textarea
                  className="premium-textarea"
                  value={latestNews}
                  onChange={(e) => setLatestNews(e.target.value)}
                  placeholder="اكتب الخبر هنا... سوف يظهر للطلاب فور الحفظ."
                  style={{ minHeight: '300px', lineHeight: '1.8' }}
                />
              </div>

              <div className="action-row-end">
                <button
                  className="quick-message-button-premium"
                  onClick={handleSendQuickMessage}
                  disabled={isSendingQuickMessage}
                >
                  {isSendingQuickMessage ? (
                    'جاري الإرسال...'
                  ) : (
                    <>
                      <Zap size={18} />
                      إرسال رسالة سريعة
                    </>
                  )}
                </button>

                <button
                  className="publish-button-premium"
                  onClick={handlePublishNews}
                  disabled={isPublishingNews}
                >
                  {isPublishingNews ? (
                    'جاري الحفظ...'
                  ) : (
                    <>
                      <Send size={18} style={{ marginLeft: '8px' }} />
                      نشر وحفظ الخبر
                    </>
                  )}
                </button>

                <button
                  className="stop-button-premium"
                  onClick={handleStopPublishing}
                >
                  <X size={18} />
                  إيقاف النشر
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'requests' && (
        <div className="admin-content">
          <div className="requests-section">
            <h2>جميع الطلبات {dataReady ? serviceRequests.length : 'جاري التحميل...'}</h2>

            {/* Services Files Grid */}
            <div className="services-files-grid">
              {SERVICES.map(service => {
                const serviceRequestsForService = serviceRequests.filter(r => r.serviceId === service.id);
                const newRequests = serviceRequestsForService.filter(r => r.status === 'pending').length;
                const totalRequests = serviceRequestsForService.length;
                const isSelected = selectedServiceId === service.id;
                let serviceName = service.nameAr;
                if (service.id === '3' && bookConfig) {
                  serviceName = bookConfig.serviceName;
                } else if (service.id === '5' && assignmentsConfig) {
                  serviceName = assignmentsConfig.serviceName;
                }

                // Get icon component based on service icon name
                const getServiceIcon = () => {
                  const iconProps = { size: 32 };
                  switch (service.icon) {
                    case 'clipboard-list': return <ClipboardList {...iconProps} />;
                    case 'user': return <User {...iconProps} />;
                    case 'package': return <Package {...iconProps} />;
                    case 'credit-card': return <CreditCard {...iconProps} />;
                    case 'book-open': return <BookOpen {...iconProps} />;
                    case 'graduation-cap': return <GraduationCap {...iconProps} />;
                    case 'file-check': return <FileCheck {...iconProps} />;
                    case 'award': return <Award {...iconProps} />;
                    default: return <FileText {...iconProps} />;
                  }
                };

                return (
                  <div
                    key={service.id}
                    className={`service-file ${isSelected ? 'selected' : ''}`}
                    onClick={() => {
                      if (isSelected) {
                        setSelectedServiceId(null);
                      } else {
                        setSelectedServiceId(service.id);
                        setCurrentPage(1);
                      }
                    }}
                  >
                    <div className="service-file-icon" style={{ color: service.color }}>
                      {getServiceIcon()}
                    </div>
                    <div className="service-file-name">{serviceName}</div>
                    <div className="service-file-stats">
                      <div className="service-file-stat-item service-file-stat-new">
                        <span className="stat-label">جديدة</span>
                        <span className="stat-value">{newRequests}</span>
                      </div>
                      <div className="service-file-stat-item service-file-stat-total">
                        <span className="stat-label">الإجمالي</span>
                        <span className="stat-value">{totalRequests}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Display requests for selected service */}
            {selectedServiceId && (
              <div className="selected-service-requests" ref={requestsSectionRef}>
                <div className="selected-service-header">
                  <h3>
                    {getServiceName(selectedServiceId)}
                  </h3>
                  <button
                    onClick={() => setSelectedServiceId(null)}
                    className="close-service-button"
                  >
                    <X size={20} />
                  </button>
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
                    const term = serviceSearchTerm.toLowerCase().trim();
                    const filteredRequests = serviceRequests
                      .filter(r => r.serviceId === selectedServiceId)
                      .filter(request => {
                        if (!term) return true;
                        const studentData = students[request.studentId];

                        const dataMatch = Object.values(request.data || {}).some(val =>
                          val && String(val).toLowerCase().includes(term)
                        );
                        if (dataMatch) return true;

                        if (studentData) {
                          if (studentData.fullNameArabic?.toLowerCase().includes(term)) return true;
                          if (studentData.nationalID?.includes(term)) return true;
                          if (studentData.whatsappNumber?.includes(term)) return true;
                          if (studentData.email?.toLowerCase().includes(term)) return true;
                        }

                        const statusAr = request.status === 'completed' ? 'مكتمل' :
                          request.status === 'rejected' ? 'مرفوض' : 'قيد الانتظار';
                        if (statusAr.includes(term)) return true;

                        if (request.createdAt) {
                          const dateStr = new Date(request.createdAt).toLocaleDateString('ar-EG');
                          if (dateStr.includes(term)) return true;
                        }

                        return false;
                      })
                      .sort((a, b) => {
                        const nameA = (a.data.full_name_arabic || a.data.full_name || students[a.studentId]?.fullNameArabic || '').toLowerCase();
                        const nameB = (b.data.full_name_arabic || b.data.full_name || students[b.studentId]?.fullNameArabic || '').toLowerCase();
                        return nameA.localeCompare(nameB, 'ar');
                      });

                    if (!dataReady) {
                      return (
                        <div className="no-requests-message" style={{ textAlign: 'center', padding: '40px 20px' }}>
                          <div className="loader-spinner" style={{ margin: '0 auto 16px', width: 36, height: 36, border: '3px solid #e2e8f0', borderTop: '3px solid #3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                          <p style={{ color: '#64748b' }}>جاري تحميل البيانات...</p>
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

                    // Standard keys to exclude from dynamic columns
                    const STANDARD_KEYS = [
                      'full_name_arabic', 'full_name', 'student_names', 'names', 'student_names_array',
                      'national_id', 'nationalID',
                      'whatsapp_number', 'phone_whatsapp', 'leader_whatsapp', 'phone', 'whatsappNumber',
                      'email',
                      'address', 'address_details', 'deliveryAddress',
                      'diploma_type', 'diplomaType', 'diploma_year', 'diplomaYear',
                      'track', 'track_category', 'track_name', 'track_other', 'educational_specialization', 'faculty', 'department',
                      'receiptUrl', 'receipt_upload', 'selectedCertificate', 'selectedExamLanguage', 'names_array', 'tracks_array',
                      'notes', 'status', 'createdAt', 'updatedAt', 'id', 'studentId', 'serviceId'
                    ];

                    const allDataKeys = new Set<string>();
                    filteredRequests.forEach(req => {
                      Object.entries(req.data || {}).forEach(([key, value]) => {
                        const stringValue = String(value || '').trim();
                        if (
                          !STANDARD_KEYS.includes(key) &&
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
                    const hasSelectedCertificate = filteredRequests.some(r => r.data?.selectedCertificate);
                    const hasStudentNames = filteredRequests.some(r => (r.data?.student_names || r.data?.names) && (typeof (r.data.student_names || r.data.names) === 'string' || Array.isArray(r.data.student_names || r.data.names)));
                    const hasNamesArray = filteredRequests.some(r => (r.data?.names_array || r.data?.student_names_array) && (typeof (r.data.names_array || r.data.student_names_array) === 'string' || Array.isArray(r.data.names_array || r.data.student_names_array)));

                    // Define columns based on Service ID
                    let columns: { id: string, label: string, getValue: (r: any) => string }[] = [];

                    const colName = { id: 'name', label: 'الاسم', getValue: (r: any) => r.data.full_name_arabic || r.data.full_name || students[r.studentId]?.fullNameArabic || '-' };
                    const colNationalId = { id: 'national_id', label: 'الرقم القومي', getValue: (r: any) => r.data.national_id || students[r.studentId]?.nationalID || '-' };
                    const colWhatsapp = { id: 'whatsapp', label: 'الواتساب', getValue: (r: any) => r.data.whatsapp_number || r.data.phone_whatsapp || students[r.studentId]?.whatsappNumber || '-' };
                    const colEmail = { id: 'email', label: 'الإيميل', getValue: (r: any) => r.data.email || students[r.studentId]?.email || '-' };
                    const colAddress = { id: 'address', label: 'العنوان', getValue: (r: any) => r.data.address || r.data.address_details || r.data.deliveryAddress || '-' };
                    const colDiplomaType = { id: 'diploma_type', label: 'نوع الدبلومة', getValue: (r: any) => r.data.diploma_type || r.data.diplomaType || '-' };
                    const colDiplomaYear = { id: 'diploma_year', label: 'سنة الدبلومة', getValue: (r: any) => r.data.diploma_year || r.data.diplomaYear || '-' };
                    const colTrack = { id: 'track', label: 'المسار', getValue: (r: any) => normalizeTrackName(r.data.track || r.data.track_category || r.data.track_name || '') };
                    const colCopies = { id: 'copies', label: 'عدد النسخ', getValue: (r: any) => String(r.data.number_of_copies || '-') };
                    const colStudentNames = { id: 'student_names', label: 'الأسماء', getValue: (r: any) => { const v = r.data?.student_names || r.data?.names || r.data?.names_array || r.data?.student_names_array; return Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v.replace(/\n/g, ', ') : '-'); } };
                    const colTracksList = { id: 'tracks_list', label: 'tracks', getValue: (r: any) => Array.isArray(r.data.tracks_array) ? r.data.tracks_array.join(', ') : '-' };
                    const colReceipt = { id: 'receipt', label: 'الإيصال', getValue: (r: any) => r.data.receiptUrl ? 'رابط الإيصال' : '-' };
                    const colSpecialization = { id: 'specialization', label: 'التخصص', getValue: (r: any) => r.data.educational_specialization || '-' };
                    const colTotalPrice = { id: 'total_price', label: 'السعر الإجمالي', getValue: (r: any) => String(r.data.totalPrice || '-') };
                    const colNameEn = { id: 'name_en', label: 'الاسم بالإنجليزية', getValue: (r: any) => r.data.full_name_english || '-' };
                    const colServiceType = { id: 'service_type', label: 'نوع الخدمة', getValue: (r: any) => typeof r.data?.selectedCertificate === 'object' ? r.data?.selectedCertificate?.name : (r.data?.selectedCertificate || '-') };
                    const colTransType = { id: 'trans_type', label: 'نوع التحول الرقمي', getValue: (r: any) => r.data.transformation_type || '-' };
                    const colExamLang = { id: 'exam_lang', label: 'لغة الامتحان', getValue: (r: any) => r.data.selectedExamLanguage || '-' };
                    const colProjectTitle = { id: 'project_title', label: 'عنوان المشروع', getValue: (r: any) => r.data.project_title || '-' };
                    const colGroupLink = { id: 'group_link', label: 'لينك الجروب', getValue: (r: any) => r.data.group_link || '-' };
                    const colLeaderWhatsapp = { id: 'leader_whatsapp', label: 'واتساب الليدر', getValue: (r: any) => r.data.leader_whatsapp || '-' };
                    const colDtFawryCode = {
                      id: 'dt_fawry_code',
                      label: 'رقم فوري',
                      getValue: (r: any) => {
                        let code = r.id ? dtCodesIndex[String(r.id)] : undefined;
                        if (!code && r.studentId) {
                          const matches = dtCodes.filter((c: any) => c.studentId === r.studentId);
                          code = matches.sort((a: any, b: any) => {
                            const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return tb - ta;
                          })[0];
                        }
                        return code?.fawryCode || code?.serialNumber || '-';
                      }
                    };
                    const colEpOrderNumber = {
                      id: 'ep_order_number',
                      label: 'رقم الطلب',
                      getValue: (r: any) => {
                        const studentData = students[r.studentId];
                        const getTs = (v: any) => {
                          if (!v) return 0;
                          if (v?.toDate && typeof v.toDate === 'function') return v.toDate().getTime();
                          if (typeof v?.seconds === 'number') return v.seconds * 1000;
                          const d = new Date(v);
                          return isNaN(d.getTime()) ? 0 : d.getTime();
                        };
                        let code = r.id ? epCodesIndex[String(r.id)] : undefined;
                        if (!code && r.studentId) {
                          const matches = epCodes.filter((c: any) => c.studentId === r.studentId);
                          code = matches.sort((a: any, b: any) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                        }
                        if (!code) {
                          const nat = String(r.data?.national_id || studentData?.nationalID || '').replace(/\D/g, '');
                          if (nat) {
                            const matches = epCodes.filter((c: any) => String(c.nationalID || '').replace(/\D/g, '') === nat);
                            code = matches.sort((a: any, b: any) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                          }
                        }
                        if (!code) {
                          const phone = String(r.data?.whatsapp_number || r.data?.phone_whatsapp || studentData?.whatsappNumber || '').replace(/\D/g, '');
                          if (phone) {
                            const matches = epCodes.filter((c: any) => {
                              const cp = String(c.mobile || c.whatsapp || '').replace(/\D/g, '');
                              return cp && cp === phone;
                            });
                            code = matches.sort((a: any, b: any) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                          }
                        }
                        return code?.orderNumber || '-';
                      }
                    };

                    switch (selectedServiceId) {
                      case '2': // العميل المميز
                        columns = [colName, colWhatsapp, colDiplomaType];
                        break;
                      case '3': // شحن الكتب
                        columns = [colCopies, colStudentNames, colWhatsapp, colAddress, colDiplomaType];
                        break;
                      case '4': // دفع المصروفات
                        columns = [colName, colNationalId, colWhatsapp, colDiplomaType, colDiplomaYear, colTrack, colEpOrderNumber];
                        break;
                      case '5': // حل التكليفات
                        columns = [colName, colWhatsapp, colTrack, colTotalPrice, colSpecialization];
                        break;
                      case '6': // شهادات اونلاين
                        columns = [colName, colNameEn, colNationalId, colEmail, colWhatsapp, colServiceType, colAddress, colTotalPrice];
                        break;
                      case '7': // التقديم علي التحول الرقمي
                        columns = [colName, colNameEn, colNationalId, colEmail, colWhatsapp, colTransType, colExamLang, colTotalPrice, colDtFawryCode];
                        break;
                      case '8': // المراجعة النهائية
                        columns = [colName, colWhatsapp, colAddress, colTrack];
                        break;
                      case '9': // مشروع التخرج
                        columns = [colStudentNames, colLeaderWhatsapp, colTrack, colProjectTitle, colGroupLink];
                        break;
                      case '10': // استخراج مستندات
                        columns = [colName, colWhatsapp, colDiplomaYear, colTrack, colDiplomaType, colTotalPrice];
                        break;
                      case '11': // استلام و شحن التحول الرقمي
                        columns = [colName, colWhatsapp, colNationalId, colAddress, colTotalPrice];
                        break;
                      default:
                        // Default order for other services
                        columns = [colName, colNationalId, colWhatsapp, colEmail];
                        if (hasAddress) columns.push(colAddress);
                        if (hasDiploma) columns.push(colDiplomaType);
                        if (hasTrack) columns.push(colTrack);
                    }

                    // جميع الأعمدة النشطة في الجدول (بدون أعمدة إضافية يدوية)
                    const allColumns = columns;

                    // Identify which keys are "extra" (not covered by the fixed columns)
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

                    // عدد أعمدة البيانات (بعد إعادة الترتيب) وخريطة الترتيب الحالية (بدون عمود التاريخ الثابت)
                    const dataColumnCount = allColumns.length + extraKeys.length;
                    const orderedDataIndices =
                      requestsDataColumnOrder.length === dataColumnCount
                        ? requestsDataColumnOrder
                        : Array.from({ length: dataColumnCount }, (_, i) => i);

                    // تطبيق الفرز مع مراعاة ترتيب الأعمدة الظاهر
                    const sortState = gridApi.getSort('requests');
                    const displayRequests = !sortState
                      ? filteredRequests
                      : [...filteredRequests].sort((a, b) => {
                          const c = sortState.colIndex;

                          // فرز حسب الحالة (عمود الحالة رقم 2)
                          if (c === 2) {
                            const sa = a.status || '';
                            const sb = b.status || '';
                            return sa.localeCompare(sb, 'ar') * (sortState.dir === 'asc' ? 1 : -1);
                          }

                          // الأعمدة قبل رقم 3 ليست جزءاً من بيانات الطلب
                          if (c < 3) return 0;

                          // أعمدة البيانات (تشمل الأعمدة الإضافية المستخرجة من data)
                          if (c >= 3 && c < 3 + dataColumnCount) {
                            const visualPos = c - 3;
                            const localIdx = orderedDataIndices[visualPos];

                            // ضمن الأعمدة المعرفة في allColumns
                            if (localIdx < allColumns.length) {
                              const v = allColumns[localIdx].getValue;
                              return (v(a) || '').localeCompare(v(b) || '', 'ar') * (sortState.dir === 'asc' ? 1 : -1);
                            }

                            // الأعمدة القادمة من extraKeys
                            const key = extraKeys[localIdx - allColumns.length];
                            const va = String(a.data?.[key] ?? '');
                            const vb = String(b.data?.[key] ?? '');
                            return va.localeCompare(vb, 'ar') * (sortState.dir === 'asc' ? 1 : -1);
                          }

                          // فرز حسب التاريخ (آخر عمود ثابت)
                          if (c === 3 + dataColumnCount) {
                            const va = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                            const vb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                            return (va - vb) * (sortState.dir === 'asc' ? 1 : -1);
                          }

                          return 0;
                        });

                    const requestsColCount = 3 + dataColumnCount + 2;

                    // حساب تكرار أرقام الهواتف (واتساب، واتساب الليدر، إلخ) عبر الطلبات المعروضة
                    const normPhone = (s: string) => {
                      const d = String(s || '').replace(/\D/g, '');
                      return d.length >= 10 ? d.slice(-10) : d;
                    };
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
                      if (col === 2) return request.status || '';
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
                        row.push(req.status || '');
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
                        row.push(count ? `${count} ملف` : 'مافيش');
                        rows.push(row);
                      });

                      const worksheet = XLSX.utils.aoa_to_sheet(rows);
                      const workbook = XLSX.utils.book_new();
                      XLSX.utils.book_append_sheet(workbook, worksheet, 'الطلبات');
                      const fileName = `طلبات_الخدمة_${selectedServiceId || 'all'}.xlsx`;
                      XLSX.writeFile(workbook, fileName);
                    };

                    return (
                      <>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', padding: '0 8px' }}>
                          <div className="pagination-info" style={{ color: '#64748b', fontSize: '14px' }}>
                            إجمالي طلبات الخدمة: {displayRequests.length} طلب
                          </div>
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

                        <div
                          ref={requestsTableRef}
                          tabIndex={0}
                          className="spreadsheet-table-wrapper"
                          data-spreadsheet-table-id="requests"
                          onMouseDown={(e) => { if (!(e.target as HTMLElement).closest('th')) { gridApi.setActiveTableId('requests'); requestsTableRef.current?.focus(); } }}
                          onMouseUp={() => { dragStartRef.current = null; }}
                          onScroll={() => { setSpreadsheetMenu(m => (m.open ? { ...m, open: false } : m)); setSpreadsheetDropdownColumn(null); }}
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
                        }}>
                          <table className="excel-table" style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '15px', minWidth: '1200px' }}>
                            <thead onMouseDown={(e) => e.stopPropagation()}>
                              <tr style={{ position: 'sticky', top: 0, zIndex: 10, background: '#f8fafc', color: '#1e293b', borderBottom: '2px solid #e2e8f0' }}>
                                <th className="spreadsheet-header-no-menu" data-col={0} style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', color: '#475569', background: '#f1f5f9' }}>#</th>
                                <th className="spreadsheet-header-no-menu" data-col={1} style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9' }}>إجراءات</th>
                                <th
                                  className="spreadsheet-header-no-menu"
                                  data-col={2}
                                  style={{ padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: '#f1f5f9', cursor: 'pointer' }}
                                  onClick={() => {
                                    const current = gridApi.getSort('requests');
                                    const colIndex = 2;
                                    const nextDir: 'asc' | 'desc' =
                                      current && current.colIndex === colIndex && current.dir === 'asc'
                                        ? 'desc'
                                        : 'asc';
                                    setRequestsSort(colIndex, nextDir);
                                  }}
                                  title="اضغط للترتيب حسب الحالة"
                                >
                                  الحالة
                                </th>

                                {orderedDataIndices.map((localIdx, displayPos) => {
                                    const colIndex = 3 + displayPos;
                                    const isFromColumns = localIdx < allColumns.length;
                                    const col = isFromColumns ? allColumns[localIdx] : null;
                                    const key = !isFromColumns ? extraKeys[localIdx - allColumns.length] : null;
                                    const label = col ? col.label : (key ? translateKey(key) : '');
                                    const getValue = col ? col.getValue : (key ? (r: any) => String(r.data?.[key] ?? '-') : () => '-');
                                    let headerWidthStyle: React.CSSProperties = { padding: '15px 12px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '800', fontSize: '13px', whiteSpace: 'nowrap', background: dropTargetColDisplayPos === displayPos ? '#dbeafe' : draggedColDisplayPos === displayPos ? '#e0e7ff' : '#f1f5f9', color: '#475569' };
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
                                      if (selectedServiceId) {
                                        try {
                                          localStorage.setItem(
                                            `hp_requests_col_order_${selectedServiceId}`,
                                            JSON.stringify(newOrder)
                                          );
                                        } catch (e) {
                                          console.error('Failed to save column order', e);
                                        }
                                      }
                                      setDraggedColDisplayPos(null);
                                      setDropTargetColDisplayPos(null);
                                    };
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
                                          {label}
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
                                    const current = gridApi.getSort('requests');
                                    const colIndex = 3 + dataColumnCount;
                                    const nextDir: 'asc' | 'desc' =
                                      current && current.colIndex === colIndex && current.dir === 'asc'
                                        ? 'desc'
                                        : 'asc';
                                    setRequestsSort(colIndex, nextDir);
                                  }}
                                  title="اضغط للترتيب حسب التاريخ"
                                >
                                  التاريخ
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
                                const rNationalID = request.data.national_id || studentData?.nationalID;
                                const rEmail = request.data.email || studentData?.email;

                                const userRequestsCount = displayRequests.filter(
                                  r => {
                                    const rStudentData = students[r.studentId];
                                    const testNationalID = r.data.national_id || rStudentData?.nationalID;
                                    const testEmail = r.data.email || rStudentData?.email;
                                    return r.studentId === request.studentId ||
                                      (testEmail && rEmail && testEmail.toLowerCase() === rEmail.toLowerCase()) ||
                                      (testNationalID && rNationalID && testNationalID === rNationalID);
                                  }
                                ).length;
                                const isDuplicate = userRequestsCount > 1;
                                const rowKey = `req-${request.id || index}`;
                                const rowFlags = toggledFlags[rowKey] || { f1: false, f2: false, f3: false };
                                const isAnyFlagged = rowFlags.f1 || rowFlags.f2 || rowFlags.f3;
                                const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';

                                // Define values list to match headers
                                const colNameVal = request.data.full_name_arabic || request.data.full_name || studentData?.fullNameArabic || 'غير متاح';
                                const colNationalIdVal = request.data.national_id || studentData?.nationalID || '';
                                const colWhatsappVal = request.data.whatsapp_number || request.data.phone_whatsapp || studentData?.whatsappNumber || '';
                                const colEmailVal = request.data.email || studentData?.email || '';
                                const colAddressVal = request.data.address || request.data.address_details || request.data.deliveryAddress || '';
                                const colDiplomaTypeVal = `${request.data.diploma_type || request.data.diplomaType || ''} ${(request.data.diploma_year || request.data.diplomaYear) ? `(${request.data.diploma_year || request.data.diplomaYear})` : ''}`.trim();
                                const colDiplomaYearVal = request.data.diploma_year || request.data.diplomaYear || '';
                                const colTrackVal = normalizeTrackName(request.data.track || request.data.track_category || request.data.track_name || '');
                                const colCopiesVal = String(request.data.number_of_copies || '-');
                                const colReceiptVal = request.data.receiptUrl ? <a href={request.data.receiptUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>عرض الإيصال</a> : '-';
                                const colSpecializationVal = request.data.educational_specialization || '-';
                                const colTotalPriceVal = String(request.data.totalPrice || '-');
                                const colNameEnVal = request.data.full_name_english || '-';
                                const colServiceTypeVal = typeof request.data.selectedCertificate === 'object' ? request.data.selectedCertificate.name : request.data.selectedCertificate || '-';
                                const colTransTypeVal = request.data.transformation_type || '-';
                                const colExamLangVal = request.data.selectedExamLanguage || '-';
                                const colProjectTitleVal = request.data.project_title || '-';
                                const colGroupLinkVal = request.data.group_link ? <a href={request.data.group_link} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>الرابط</a> : '-';
                                const colLeaderWhatsappVal = request.data.leader_whatsapp || '-';
                                const colDtFawryCodeVal = (() => {
                                  let code = request.id ? dtCodesIndex[String(request.id)] : undefined;
                                  if (!code && request.studentId) {
                                    const matches = dtCodes.filter(c => c.studentId === request.studentId);
                                    code = matches.sort((a, b) => {
                                      const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                      const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                      return tb - ta;
                                    })[0];
                                  }
                                  return code?.fawryCode || code?.serialNumber || '-';
                                })();
                                const colEpOrderNumberVal = (() => {
                                  const getTs = (v: any) => {
                                    if (!v) return 0;
                                    if (v?.toDate && typeof v.toDate === 'function') return v.toDate().getTime();
                                    if (typeof v?.seconds === 'number') return v.seconds * 1000;
                                    const d = new Date(v);
                                    return isNaN(d.getTime()) ? 0 : d.getTime();
                                  };
                                  let code = request.id ? epCodesIndex[String(request.id)] : undefined;
                                  if (!code && request.studentId) {
                                    const matches = epCodes.filter(c => c.studentId === request.studentId);
                                    code = matches.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                                  }
                                  if (!code) {
                                    const nat = String(colNationalIdVal || '').replace(/\D/g, '');
                                    if (nat) {
                                      const matches = epCodes.filter(c => String(c.nationalID || '').replace(/\D/g, '') === nat);
                                      code = matches.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                                    }
                                  }
                                  if (!code) {
                                    const phone = String(colWhatsappVal || '').replace(/\D/g, '');
                                    if (phone) {
                                      const matches = epCodes.filter(c => {
                                        const cp = String(c.mobile || c.whatsapp || '').replace(/\D/g, '');
                                        return cp && cp === phone;
                                      });
                                      code = matches.sort((a, b) => getTs(b.createdAt) - getTs(a.createdAt))[0];
                                    }
                                  }
                                  return code?.orderNumber || '-';
                                })();

                                const colStudentNamesVal = (() => {
                                  const rawNames = request.data.student_names || request.data.names || request.data.names_array || request.data.student_names_array;
                                  // Split by newlines, commas (English/Arabic), or semicolons
                                  const names = typeof rawNames === 'string'
                                    ? rawNames.split(/[\n\r,،;]+/).map(n => n.trim()).filter(Boolean)
                                    : Array.isArray(rawNames) ? rawNames : [];

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

                                const colTracksListVal = Array.isArray(request.data.tracks_array) ? request.data.tracks_array.join(', ') : '-';

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
                                  default:
                                    rowValues = [colNameVal, colNationalIdVal, colWhatsappVal, colEmailVal];
                                    if (hasAddress) rowValues.push(colAddressVal);
                                    if (hasDiploma) rowValues.push(colDiplomaTypeVal);
                                    if (hasTrack) rowValues.push(colTrackVal);
                                }

                                return (
                                  <tr key={request.id} style={{ background: rowBg, transition: 'all 0.2s ease' }}>
                                    <td
                                      data-row={index}
                                      data-col={0}
                                      className={`spreadsheet-cell${gridApi.isCellSelected('requests', index, 0) ? ' selected' : ''}`}
                                      onMouseDown={(e) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest('button, a, input')) return; e.preventDefault(); dragStartRef.current = { tableId: 'requests', row: index, col: 0 }; gridApi.selectCell('requests', index, 0); }}
                                      style={{ padding: '12px 10px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '700', color: '#475569', fontSize: '14px', verticalAlign: 'top' }}
                                    >
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                        {index + 1}
                                      </div>
                                    </td>
                                    <td
                                      data-row={index}
                                      data-col={1}
                                      className="spreadsheet-cell spreadsheet-cell-actions"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      style={{ padding: '12px 10px', border: '1px solid #cbd5e1', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          gap: '4px',
                                          alignItems: 'center',
                                          justifyContent: 'center'
                                        }}
                                      >
                                        {/* الصف الأول: 5 عناصر (3 شيك بوكس + العين + التحميل) */}
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFlag(rowKey, 1); }}
                                            title={rowFlags.f1 ? 'إلغاء علامة (بدء بالحل)' : 'تمييز: بدء بالحل'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rowFlags.f1 ? '#2563eb' : '#94a3b8' }}
                                          >
                                            {rowFlags.f1 ? <CheckSquare size={18} /> : <Square size={18} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFlag(rowKey, 2); }}
                                            title={rowFlags.f2 ? 'إلغاء علامة (قيد المتابعة)' : 'تمييز: قيد المتابعة'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rowFlags.f2 ? '#16a34a' : '#a3a3a3' }}
                                          >
                                            {rowFlags.f2 ? <CheckSquare size={18} /> : <Square size={18} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFlag(rowKey, 3); }}
                                            title={rowFlags.f3 ? 'إلغاء علامة (تمت المراجعة)' : 'تمييز: تمت المراجعة'}
                                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: rowFlags.f3 ? '#eab308' : '#a3a3a3' }}
                                          >
                                            {rowFlags.f3 ? <CheckSquare size={18} /> : <Square size={18} />}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); viewDocuments(request); }}
                                            title="عرض المستندات"
                                            style={{ padding: '6px', background: '#fff7ed', color: '#ea580c', border: '1px solid #ffedd5', borderRadius: '6px' }}
                                          >
                                            <Eye size={16} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDownloadAll(request); }}
                                            title="تنزيل جميع الصور"
                                            style={{ padding: '6px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #dbeafe', borderRadius: '6px' }}
                                          >
                                            <Download size={16} />
                                          </button>
                                        </div>

                                        {/* الصف الثاني: 4 أيقونات (قبول، رفض، تعديل، حذف) */}
                                        <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusChange(request.id || '', 'completed', request.serviceId); }}
                                            title="قبول"
                                            style={{ padding: '6px', background: '#f0fdf4', color: '#166534', border: '1px solid #dcfce7', borderRadius: '6px' }}
                                          >
                                            <CheckCircle size={16} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleStatusChange(request.id || '', 'rejected', request.serviceId); }}
                                            title="رفض"
                                            style={{ padding: '6px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fee2e2', borderRadius: '6px' }}
                                          >
                                            <XCircle size={16} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.preventDefault();
                                              e.stopPropagation();
                                              setEditingRequestId(request.id || null);
                                              setEditingServiceId(request.serviceId || null);
                                              setTempRequestData({ ...request.data });
                                              setIsEditingRequestModalOpen(true);
                                            }}
                                            title="تعديل"
                                            style={{ padding: '6px', background: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe', borderRadius: '6px' }}
                                          >
                                            <Edit2 size={16} />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleDeleteRequest(request.id || '', request.serviceId); }}
                                            title="حذف"
                                            style={{ padding: '6px', background: '#fff1f2', color: '#e11d48', border: '1px solid #ffe4e6', borderRadius: '6px' }}
                                          >
                                            <Trash2 size={16} />
                                          </button>
                                        </div>
                                      </div>
                                    </td>
                                    <td
                                      data-row={index}
                                      data-col={2}
                                      className={`spreadsheet-cell${gridApi.isCellSelected('requests', index, 2) ? ' selected' : ''}`}
                                      onMouseDown={(e) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest('button, a, input')) return; e.preventDefault(); dragStartRef.current = { tableId: 'requests', row: index, col: 2 }; gridApi.selectCell('requests', index, 2); }}
                                      style={{ padding: '12px 10px', border: '1px solid #cbd5e1', textAlign: 'center', verticalAlign: 'top' }}
                                    >{getStatusBadge(request.status)}</td>

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
                                      let dynamicWidthStyle: React.CSSProperties = { whiteSpace: 'nowrap', paddingRight: '4px' };
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

                                      // تمييز تكرار رقم الهاتف (واتساب، واتساب الليدر، إلخ) في أي خانة تحتوي رقم
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
                                        dynamicWidthStyle = { ...dynamicWidthStyle, whiteSpace: 'normal', wordBreak: 'break-word' };
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
                                          onMouseDown={(e) => { if (e.button !== 0) return; if ((e.target as HTMLElement).closest('button, a, input')) return; e.preventDefault(); dragStartRef.current = { tableId: 'requests', row: index, col: colIndex }; gridApi.selectCell('requests', index, colIndex); }}
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
                              className={`spreadsheet-cell spreadsheet-cell-actions`}
                              onMouseDown={(e) => e.stopPropagation()}
                              style={{ padding: '8px 10px', border: '1px solid #e2e8f0', textAlign: 'center', verticalAlign: 'top' }}
                            >
                              {(() => {
                                const files = studentData?.assignedFiles;
                                const count = Array.isArray(files) ? files.length : 0;
                                if (count === 0) {
                                  return <span style={{ color: '#94a3b8', fontSize: '13px' }}>مافيش</span>;
                                }
                                return (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setAssignedFilesViewer({
                                        open: true,
                                        studentName: studentData?.fullNameArabic || request.data?.full_name_arabic || request.data?.full_name || 'طالب',
                                        files: files || []
                                      });
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
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'books' && (
        <div className="admin-content">
          <div className="books-section">
            <div className="section-header">
              <h2>إعدادات خدمة الكتب</h2>
              {!isEditingBooks ? (
                <button type="button" onClick={() => setIsEditingBooks(true)} className="edit-button">
                  <Edit2 size={18} />
                  تعديل
                </button>
              ) : (
                <div className="edit-actions">
                  <button type="button" onClick={handleSaveBookConfig} className="save-button" disabled={isSaving === 'books'}>
                    <Save size={18} />
                    {isSaving === 'books' ? 'جاري الحفظ...' : 'حفظ'}
                  </button>
                  <button type="button" onClick={() => setIsEditingBooks(false)} className="cancel-edit-button">
                    <X size={18} />
                    إلغاء
                  </button>
                </div>
              )}
            </div>

            {bookConfig && (
              <div className="book-config-form">
                <div className="form-group">
                  <label>اسم الخدمة</label>
                  {isEditingBooks ? (
                    <input
                      type="text"
                      value={bookConfig.serviceName}
                      onChange={(e) => setBookConfig({ ...bookConfig, serviceName: e.target.value })}
                      className="config-input"
                    />
                  ) : (
                    <div className="config-display">{bookConfig.serviceName}</div>
                  )}
                </div>

                <div className="form-group">
                  <label>أسعار الكتب</label>
                  <div className="prices-grid">
                    {Object.entries(bookConfig.prices).map(([copies, price]) => (
                      <div key={copies} className="price-item">
                        <label>كتب لـ {copies === '1' ? 'شخص' : `${copies} أشخاص`}</label>
                        {isEditingBooks ? (
                          <input
                            type="number"
                            value={price}
                            onChange={(e) => setBookConfig({
                              ...bookConfig,
                              prices: {
                                ...bookConfig.prices,
                                [copies]: parseInt(e.target.value) || 0
                              }
                            })}
                            className="price-input"
                          />
                        ) : (
                          <div className="price-display">{price} جنيه</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>أرقام الدفع</label>
                  <div className="payment-numbers">
                    <div className="payment-item">
                      <label>instaPay</label>
                      {isEditingBooks ? (
                        <input
                          type="text"
                          value={bookConfig.paymentMethods.instaPay}
                          onChange={(e) => setBookConfig({
                            ...bookConfig,
                            paymentMethods: {
                              ...bookConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      ) : (
                        <div className="config-display">{bookConfig.paymentMethods.instaPay}</div>
                      )}
                    </div>
                    <div className="payment-item">
                      <label>محفظة الكاش</label>
                      {isEditingBooks ? (
                        <input
                          type="text"
                          value={bookConfig.paymentMethods.cashWallet}
                          onChange={(e) => setBookConfig({
                            ...bookConfig,
                            paymentMethods: {
                              ...bookConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      ) : (
                        <div className="config-display">{bookConfig.paymentMethods.cashWallet}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'fees' && (
        <div className="admin-content">
          <div className="books-section">
            <div className="section-header">
              <h2>مصروفات السنة الدراسية للدبلومة</h2>
              <div className="edit-actions">
                {!isEditingFees ? (
                  <button type="button" onClick={() => setIsEditingFees(true)} className="edit-button">
                    <Edit2 size={18} />
                    تعديل
                  </button>
                ) : (
                  <>
                    <button type="button" onClick={handleSaveFeesConfig} className="save-button" disabled={isSaving === 'fees'}>
                      <Save size={18} />
                      {isSaving === 'fees' ? 'جاري الحفظ...' : 'حفظ'}
                    </button>
                    <button type="button" onClick={() => setIsEditingFees(false)} className="cancel-edit-button">
                      <X size={18} />
                      إلغاء
                    </button>
                  </>
                )}
              </div>
            </div>

            {feesConfig && (
              <div className="book-config-form">
                <div className="form-group">
                  <label>أسعار المصروفات حسب السنة الدراسية</label>
                  <div className="prices-grid">
                    {Object.entries(feesConfig.prices)
                      .sort(([a], [b]) => parseInt(b) - parseInt(a))
                      .map(([year, price]) => (
                        <div key={year} className="price-item">
                          <label>{year}</label>
                          {isEditingFees ? (
                            <div className="price-item-edit">
                              <input
                                type="number"
                                value={price}
                                onChange={(e) => {
                                  const newPrice = parseFloat(e.target.value);
                                  if (!isNaN(newPrice) && newPrice >= 0) {
                                    setFeesConfig({
                                      ...feesConfig,
                                      prices: {
                                        ...feesConfig.prices,
                                        [year]: newPrice
                                      }
                                    });
                                  }
                                }}
                                className="price-input"
                                min="0"
                                step="0.01"
                              />
                              <button
                                onClick={() => handleRemoveFeeYear(year)}
                                className="remove-price-button"
                                title="حذف"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <div className="price-display-bubble">{price} جنيه</div>
                          )}
                        </div>
                      ))}
                  </div>

                  {isEditingFees && (
                    <div className="add-price-section">
                      <div className="add-price-form">
                        <input
                          type="text"
                          placeholder="السنة الدراسية (مثال: 2026)"
                          value={newFeeYear}
                          onChange={(e) => setNewFeeYear(e.target.value)}
                          className="config-input"
                          style={{ width: '200px' }}
                        />
                        <input
                          type="number"
                          placeholder="المبلغ بالجنيه"
                          value={newFeeAmount}
                          onChange={(e) => setNewFeeAmount(e.target.value)}
                          className="config-input"
                          style={{ width: '200px' }}
                          min="0"
                          step="0.01"
                        />
                        <button onClick={handleAddFeeYear} className="add-price-button">
                          إضافة
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label>أرقام الدفع</label>
                  <div className="payment-numbers">
                    <div className="payment-item">
                      <label>instaPay</label>
                      {isEditingFees ? (
                        <input
                          type="text"
                          value={feesConfig.paymentMethods?.instaPay || ''}
                          onChange={(e) => setFeesConfig({
                            ...feesConfig,
                            paymentMethods: {
                              ...feesConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      ) : (
                        <div className="config-display">{feesConfig.paymentMethods?.instaPay || 'غير محدد'}</div>
                      )}
                    </div>
                    <div className="payment-item">
                      <label>محفظة الكاش</label>
                      {isEditingFees ? (
                        <input
                          type="text"
                          value={feesConfig.paymentMethods?.cashWallet || ''}
                          onChange={(e) => setFeesConfig({
                            ...feesConfig,
                            paymentMethods: {
                              ...feesConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      ) : (
                        <div className="config-display">{feesConfig.paymentMethods?.cashWallet || 'غير محدد'}</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div >
      )}

      {
        activeTab === 'certificates' && (
          <div className="admin-content">
            <div className="books-section">
              <div className="section-header">
                <h2>إعدادات خدمة الشهادات</h2>
                <button type="button" onClick={handleSaveCertificatesConfig} className="save-button" disabled={isSaving === 'certificates'}>
                  <Save size={18} />
                  {isSaving === 'certificates' ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>

              {certificatesConfig && (
                <div className="book-config-form">
                  <div className="form-group">
                    <label>الشهادات المتاحة</label>
                    <div className="certificates-list">
                      {certificatesConfig.certificates.map((certificate) => (
                        <div key={certificate.id} className="certificate-item-admin">
                          {editingCertificate?.id === certificate.id ? (
                            <div className="certificate-edit-form">
                              <div className="form-row">
                                <div className="form-group">
                                  <label>اسم الشهادة</label>
                                  <input
                                    type="text"
                                    value={editingCertificate.name}
                                    onChange={(e) => setEditingCertificate({ ...editingCertificate, name: e.target.value })}
                                    className="config-input"
                                  />
                                </div>
                                <div className="form-group">
                                  <label>السعر (جنيه)</label>
                                  <input
                                    type="number"
                                    value={editingCertificate.price}
                                    onChange={(e) => setEditingCertificate({ ...editingCertificate, price: parseFloat(e.target.value) || 0 })}
                                    className="config-input"
                                    min="0"
                                    step="0.01"
                                  />
                                </div>
                              </div>
                              <div className="form-group">
                                <label>الصورة</label>
                                <div className="image-upload-section">
                                  <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'flex-start' }}>
                                    {editingCertificate.imageUrl ? (
                                      <>
                                        <div style={{ position: 'relative', display: 'inline-block' }}>
                                          <img src={editingCertificate.imageUrl} alt={editingCertificate.name} className="certificate-preview-image" />
                                        </div>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleImageUpload(editingCertificate.id, file);
                                            }
                                            if (e.target) {
                                              (e.target as HTMLInputElement).value = '';
                                            }
                                          }}
                                          className="file-input"
                                          id={`certificate-image-input-${editingCertificate.id}`}
                                          style={{ display: 'none' }}
                                        />
                                        <label
                                          htmlFor={`certificate-image-input-${editingCertificate.id}`}
                                          className="change-image-button"
                                          title="تغيير الصورة"
                                        >
                                          <Pencil size={16} />
                                          تغيير الصورة
                                        </label>
                                      </>
                                    ) : (
                                      <>
                                        <div className="no-image-placeholder">
                                          <Image size={48} />
                                          <span>لا توجد صورة</span>
                                        </div>
                                        <input
                                          type="file"
                                          accept="image/*"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleImageUpload(editingCertificate.id, file);
                                            }
                                            if (e.target) {
                                              (e.target as HTMLInputElement).value = '';
                                            }
                                          }}
                                          className="file-input"
                                          id={`certificate-image-input-new-${editingCertificate.id}`}
                                          style={{ display: 'none' }}
                                        />
                                        <label
                                          htmlFor={`certificate-image-input-new-${editingCertificate.id}`}
                                          className="change-image-button"
                                          title="اختر صورة"
                                        >
                                          <Image size={16} />
                                          اختر صورة
                                        </label>
                                      </>
                                    )}
                                  </div>
                                  <small style={{ color: '#64748b', fontSize: '12px', marginTop: '8px', display: 'block' }}>
                                    JPEG, PNG, JPG - الحد الأقصى 5 ميجابايت
                                  </small>
                                </div>
                              </div>
                              <div className="form-group">
                                <label>النص الوصفي (اختياري)</label>
                                <textarea
                                  value={editingCertificate.description || ''}
                                  onChange={(e) => setEditingCertificate({ ...editingCertificate, description: e.target.value })}
                                  className="config-input"
                                  rows={4}
                                  placeholder="النص الذي يظهر للمستخدم عند اختيار الشهادة"
                                />
                              </div>
                              <div className="edit-actions">
                                <button type="button" onClick={handleUpdateCertificate} className="save-button" disabled={isSaving === 'updateCertificate'}>
                                  <Save size={16} />
                                  {isSaving === 'updateCertificate' ? 'جاري الحفظ...' : 'حفظ التعديلات'}
                                </button>
                                <button type="button" onClick={() => setEditingCertificate(null)} className="cancel-edit-button">
                                  <X size={16} />
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="certificate-info">
                                {certificate.imageUrl && (
                                  <img src={certificate.imageUrl} alt={certificate.name} className="certificate-thumbnail" />
                                )}
                                <div className="certificate-details">
                                  <h3>{certificate.name}</h3>
                                  <div className="certificate-price">{certificate.price} جنيه</div>
                                  {certificate.description && (
                                    <div className="certificate-description-preview">
                                      {certificate.description.substring(0, 100)}...
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="certificate-actions">
                                <button
                                  onClick={() => handleEditCertificate(certificate)}
                                  className="edit-button"
                                  title="تعديل"
                                >
                                  <Edit2 size={16} />
                                </button>
                                <button
                                  onClick={() => handleRemoveCertificate(certificate.id)}
                                  className="remove-assignment-button"
                                  title="حذف"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="add-certificate-section">
                      <h3>إضافة شهادة جديدة</h3>
                      <div className="add-certificate-form">
                        <div className="form-row">
                          <div className="form-group">
                            <label>اسم الشهادة</label>
                            <input
                              type="text"
                              placeholder="اسم الشهادة"
                              value={newCertificateName}
                              onChange={(e) => setNewCertificateName(e.target.value)}
                              className="config-input"
                            />
                          </div>
                          <div className="form-group">
                            <label>السعر (جنيه)</label>
                            <input
                              type="number"
                              placeholder="السعر"
                              value={newCertificatePrice}
                              onChange={(e) => setNewCertificatePrice(e.target.value)}
                              className="config-input"
                              min="0"
                              step="0.01"
                            />
                          </div>
                        </div>
                        <div className="form-group">
                          <label>النص الوصفي (اختياري)</label>
                          <textarea
                            placeholder="النص الذي يظهر للمستخدم"
                            value={newCertificateDescription}
                            onChange={(e) => setNewCertificateDescription(e.target.value)}
                            className="config-input"
                            rows={3}
                          />
                        </div>
                        <button onClick={handleAddCertificate} className="add-price-button">
                          إضافة شهادة
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>أرقام الدفع</label>
                    <div className="payment-numbers">
                      <div className="payment-item">
                        <label>instaPay</label>
                        <input
                          type="text"
                          value={certificatesConfig.paymentMethods.instaPay}
                          onChange={(e) => setCertificatesConfig({
                            ...certificatesConfig,
                            paymentMethods: {
                              ...certificatesConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                      <div className="payment-item">
                        <label>محفظة الكاش</label>
                        <input
                          type="text"
                          value={certificatesConfig.paymentMethods.cashWallet}
                          onChange={(e) => setCertificatesConfig({
                            ...certificatesConfig,
                            paymentMethods: {
                              ...certificatesConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'finalReview' && (
          <div className="admin-content">
            <div className="books-section">
              <div className="section-header">
                <h2>إعدادات المراجعة النهائية</h2>
                <button type="button" onClick={handleSaveFinalReviewConfig} className="save-button" disabled={isSaving === 'finalReview'}>
                  <Save size={18} />
                  {isSaving === 'finalReview' ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>

              {finalReviewConfig && (
                <div className="book-config-form">
                  <div className="form-group">
                    <label>اسم السيكشن</label>
                    <input
                      type="text"
                      value={finalReviewConfig.serviceName}
                      onChange={(e) => setFinalReviewConfig({ ...finalReviewConfig, serviceName: e.target.value })}
                      className="config-input"
                      placeholder="المراجعة النهائية"
                    />
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      يمكنك تغيير اسم السيكشن ليظهر للمستخدمين
                    </small>
                  </div>

                  <div className="form-group">
                    <label>مبلغ الدفع (جنيه)</label>
                    <input
                      type="number"
                      value={finalReviewConfig.paymentAmount}
                      onChange={(e) => setFinalReviewConfig({
                        ...finalReviewConfig,
                        paymentAmount: parseFloat(e.target.value) || 0
                      })}
                      className="config-input"
                      min="0"
                      step="0.01"
                      placeholder="500"
                    />
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                      المبلغ المطلوب دفعه للمراجعة النهائية
                    </small>
                  </div>

                  <div className="form-group">
                    <label>أرقام الدفع</label>
                    <div className="payment-numbers">
                      <div className="payment-item">
                        <label>instaPay</label>
                        <input
                          type="text"
                          value={finalReviewConfig.paymentMethods.instaPay}
                          onChange={(e) => setFinalReviewConfig({
                            ...finalReviewConfig,
                            paymentMethods: {
                              ...finalReviewConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                      <div className="payment-item">
                        <label>محفظة الكاش</label>
                        <input
                          type="text"
                          value={finalReviewConfig.paymentMethods.cashWallet}
                          onChange={(e) => setFinalReviewConfig({
                            ...finalReviewConfig,
                            paymentMethods: {
                              ...finalReviewConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '12px', color: '#1e293b' }}>
                      البيانات المطلوبة من المستخدم
                    </h3>
                    <div style={{ display: 'grid', gap: '8px', fontSize: '14px', color: '#475569' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444' }}>*</span>
                        <span>الاسم الرباعي</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444' }}>*</span>
                        <span>رقم هاتف (واتس اب)</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444' }}>*</span>
                        <span>المسار</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#ef4444' }}>*</span>
                        <span>العنوان</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e2e8f0' }}>
                        <span style={{ color: '#10b981' }}>✓</span>
                        <span>رفع إيصال الدفع</span>
                      </div>
                    </div>
                    <small style={{ color: '#64748b', fontSize: '12px', marginTop: '12px', display: 'block' }}>
                      هذه البيانات ثابتة ويتم جمعها تلقائياً من المستخدم عند التقديم
                    </small>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'graduationProject' && (
          <div className="admin-content">
            <div className="books-section">
              <div className="section-header">
                <h2>إعدادات مشروع التخرج</h2>
                <button type="button" onClick={handleSaveGraduationProjectConfig} className="save-button" disabled={isSaving === 'graduationProject'}>
                  <Save size={18} />
                  {isSaving === 'graduationProject' ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>

              {graduationProjectConfig && (
                <div className="book-config-form">
                  <div className="form-group">
                    <label>اسم السيكشن</label>
                    <input
                      type="text"
                      value={graduationProjectConfig.serviceName}
                      onChange={(e) => setGraduationProjectConfig({ ...graduationProjectConfig, serviceName: e.target.value })}
                      className="config-input"
                      placeholder="مشروع التخرج"
                    />
                  </div>

                  {/* Features Section */}
                  <div className="form-group">
                    <label>المميزات</label>
                    <div className="features-admin-list">
                      {graduationProjectConfig.features.map((feature, index) => (
                        <div key={index} className="feature-admin-item">
                          <span>{feature}</span>
                          <button
                            onClick={() => handleRemoveGraduationProjectFeature(index)}
                            className="remove-price-button"
                            title="حذف"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="add-price-form" style={{ marginTop: '12px' }}>
                      <input
                        type="text"
                        placeholder="أضف ميزة جديدة"
                        value={newGradProjectFeature}
                        onChange={(e) => setNewGradProjectFeature(e.target.value)}
                        className="config-input"
                      />
                      <button onClick={handleAddGraduationProjectFeature} className="add-price-button">
                        إضافة ميزة
                      </button>
                    </div>
                  </div>

                  {/* Prices Section */}
                  <div className="form-group">
                    <label>الأسعار</label>
                    <div className="prices-grid">
                      {(graduationProjectConfig.prices || []).map((priceItem) => (
                        <div key={priceItem.id} className="price-item">
                          <div className="price-item-info">
                            <span className="price-amount">{priceItem.price} جنيه</span>
                          </div>
                          <button
                            onClick={() => handleRemoveGraduationProjectPrice(priceItem.id)}
                            className="remove-price-button"
                            title="حذف"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="add-price-section" style={{ marginTop: '16px' }}>
                      <div className="add-price-form">
                        <input
                          type="number"
                          placeholder="السعر (جنيه)"
                          value={newGradProjectPriceAmount}
                          onChange={(e) => setNewGradProjectPriceAmount(e.target.value)}
                          className="config-input"
                          min="0"
                        />
                        <button onClick={handleAddGraduationProjectPrice} className="add-price-button">
                          إضافة سعر
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Payment Methods */}
                  <div className="form-group">
                    <label>أرقام الدفع</label>
                    <div className="payment-numbers">
                      <div className="payment-item">
                        <label>instaPay</label>
                        <input
                          type="text"
                          value={graduationProjectConfig.paymentMethods.instaPay}
                          onChange={(e) => setGraduationProjectConfig({
                            ...graduationProjectConfig,
                            paymentMethods: {
                              ...graduationProjectConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                      <div className="payment-item">
                        <label>محفظة الكاش</label>
                        <input
                          type="text"
                          value={graduationProjectConfig.paymentMethods.cashWallet}
                          onChange={(e) => setGraduationProjectConfig({
                            ...graduationProjectConfig,
                            paymentMethods: {
                              ...graduationProjectConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'users' && (
          <div className="admin-content">
            <div className="section-header">
              <h2>إدارة المستخدمين ({allStudents.length})</h2>
              <div className="search-box">
                <Search size={18} />
                <input
                  type="text"
                  placeholder="ابحث عن مستخدم بالإسم أو الرقم القومي أو الهاتف..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="requests-list-container">
              {(() => {
                const filteredStudents = allStudents.filter(student => {
                  if (!searchTerm.trim()) return true;
                  const term = searchTerm.toLowerCase().trim();
                  return (
                    student.fullNameArabic?.toLowerCase().includes(term) ||
                    student.email?.toLowerCase().includes(term) ||
                    student.nationalID?.includes(term) ||
                    student.whatsappNumber?.includes(term) ||
                    student.diplomaType?.toLowerCase().includes(term) ||
                    student.diplomaYear?.includes(term)
                  );
                });

                if (filteredStudents.length === 0) {
                  return (
                    <div className="no-requests-message">
                      <p>لا يوجد مستخدمين يطابقون بحثك</p>
                    </div>
                  );
                }

                return (
                  <>
                    <div className="pagination-info" style={{ marginBottom: '16px', color: '#64748b', fontSize: '14px', padding: '0 8px' }}>
                      إجمالي المستخدمين: {filteredStudents.length} مستخدم
                    </div>

                    <div className="excel-table-wrapper" style={{
                      maxHeight: 'none',
                      overflowY: 'visible',
                      overflowX: 'auto',
                      borderRadius: '12px',
                      border: '1px solid #e2e8f0',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                        <thead>
                          <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', width: '50px' }}>#</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', width: '40px' }}>✓</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '180px' }}>الاسم</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '140px' }}>الرقم القومي</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '180px' }}>البريد الإلكتروني</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '120px' }}>رقم الواتساب</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '120px' }}>نوع الدبلومة</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>سنة الدبلومة</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '80px' }}>المسار</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '150px' }}>العنوان</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>كلمة المرور</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>تاريخ الانضمام</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '60px' }}>الطلبات</th>
                            <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap' }}>إجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStudents.map((student, index) => {
                            const studentRequests = getStudentRequests(student.id || '');
                            const flagKey = `student-${student.id}`;
                            const studentFlags = toggledFlags[flagKey] || { f1: false, f2: false, f3: false };
                            const isFlagged = studentFlags.f1 || studentFlags.f2 || studentFlags.f3;
                            const addressStr = [student.address?.governorate, student.address?.city, student.address?.street].filter(Boolean).join(' - ') || '';

                            return (
                              <tr key={student.id} style={{
                                background: isFlagged ? '#eff6ff' : (index % 2 === 0 ? '#ffffff' : '#f8fafc'),
                                borderLeft: isFlagged ? '3px solid #2563eb' : 'none',
                                transition: 'background-color 0.2s'
                              }}>
                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
                                  {index + 1}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                  <button
                                    type="button"
                                    onClick={() => toggleFlag(flagKey, 1)}
                                    style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', color: isFlagged ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                                  >
                                    {isFlagged ? <CheckSquare size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={1.5} />}
                                  </button>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#1e293b', fontWeight: '700', minWidth: '180px' }}>
                                  {student.fullNameArabic || 'بدون اسم'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: '600', direction: 'ltr', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                    {student.nationalID || '-'}
                                    {student.nationalID && (
                                      <Copy
                                        size={14}
                                        style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.6 }}
                                        onClick={() => {
                                          navigator.clipboard.writeText(student.nationalID!);
                                          setToastState({ message: 'تم نسخ الرقم القومي', type: 'success', duration: 2000 });
                                        }}
                                      />
                                    )}
                                  </div>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', direction: 'ltr', textAlign: 'right', maxWidth: '200px', wordBreak: 'break-all' }}>
                                  {student.email || '-'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', direction: 'ltr', textAlign: 'right' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                                    {student.whatsappNumber || '-'}
                                    {student.whatsappNumber && (
                                      <Copy
                                        size={14}
                                        style={{ cursor: 'pointer', color: '#10b981', opacity: 0.6 }}
                                        onClick={() => {
                                          navigator.clipboard.writeText(student.whatsappNumber!);
                                          setToastState({ message: 'تم نسخ رقم الواتساب', type: 'success', duration: 2000 });
                                        }}
                                      />
                                    )}
                                  </div>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                                  {student.diplomaType || '-'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', textAlign: 'center' }}>
                                  {student.diplomaYear || '-'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                                  {student.track || '-'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', maxWidth: '200px' }}>
                                  <div style={{ maxHeight: '60px', overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                    {addressStr || '-'}
                                  </div>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                                      {showPasswords[student.id || ''] ? (student.password || '-') : '••••••••'}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => setShowPasswords(prev => ({ ...prev, [student.id || '']: !prev[student.id || ''] }))}
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0, display: 'flex' }}
                                    >
                                      {showPasswords[student.id || ''] ? <EyeOff size={14} /> : <Eye size={14} />}
                                    </button>
                                  </div>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  {student.createdAt ? new Date(student.createdAt).toLocaleDateString('ar-EG') : '-'}
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                  <span style={{
                                    background: studentRequests.length > 0 ? '#dbeafe' : '#f1f5f9',
                                    color: studentRequests.length > 0 ? '#1d4ed8' : '#94a3b8',
                                    padding: '4px 10px',
                                    borderRadius: '12px',
                                    fontSize: '13px',
                                    fontWeight: '700'
                                  }}>
                                    {studentRequests.length}
                                  </span>
                                </td>

                                <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                  <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                                    <button
                                      onClick={() => setViewingStudentRequests(student)}
                                      title="عرض جميع الطلبات"
                                      style={{ padding: '8px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                      <ClipboardList size={16} />
                                    </button>
                                    <button
                                      onClick={() => handleEditStudent(student)}
                                      title="تعديل البيانات"
                                      style={{ padding: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                      <Edit2 size={16} />
                                    </button>
                                    <button
                                      onClick={async () => {
                                        if (!window.confirm("هل أنت متأكد من حذف هذا المشترك نهائياً من المنصة؟")) return;
                                        try {
                                          await deleteStudentData(student.id!);
                                          showAlert('نجاح', 'تم حذف المشترك بنجاح', 'success');
                                        } catch (error: any) {
                                          showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
                                        }
                                      }}
                                      title="حذف المشترك"
                                      style={{ padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )
      }



      {
        activeTab === 'services' && (
          <div className="admin-content">
            <div className="section-header">
              <h2>إدارة الخدمات (تفعيل/تعطيل)</h2>
            </div>
            <div className="admin-services-grid" style={{
              display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: '20px',
              padding: '20px 0',
              overflowY: 'visible'
            }}>
              <AnimatePresence>
                {[...SERVICES]
                  .sort((a, b) => {
                    const orderA = adminPrefs.serviceOrder?.indexOf(a.id) ?? -1;
                    const orderB = adminPrefs.serviceOrder?.indexOf(b.id) ?? -1;
                    const rankA = orderA === -1 ? 999 : orderA;
                    const rankB = orderB === -1 ? 999 : orderB;
                    return rankA - rankB;
                  })
                  .map((service, index, arr) => {
                    const isActive = isServiceActive(service.id);
                    const disabledFields = getDisabledFields(service.id);

                    const handleToggleActive = async () => {
                      const newSettings = {
                        ...serviceSettings,
                        [service.id]: { active: !isActive, disabledFields }
                      };
                      setServiceSettings(newSettings as any);
                      try {
                        await updateServiceSettings(newSettings as any);
                      } catch (e) {
                        alert('فشل تحديث الحالة');
                      }
                    };

                    const handleToggleField = async (fieldName: string) => {
                      const isFieldDisabled = disabledFields.includes(fieldName);
                      const newDisabledFields = isFieldDisabled
                        ? disabledFields.filter(f => f !== fieldName)
                        : [...disabledFields, fieldName];
                      const newSettings = {
                        ...serviceSettings,
                        [service.id]: { active: isActive, disabledFields: newDisabledFields }
                      };
                      setServiceSettings(newSettings as any);
                      try {
                        await updateServiceSettings(newSettings as any);
                      } catch (e) {
                        alert('فشل تحديث الإعدادات');
                      }
                    };

                    const handleDragStart = (e: React.DragEvent) => {
                      setDraggedServiceId(service.id);
                      e.dataTransfer.effectAllowed = 'move';

                      if (e.currentTarget instanceof HTMLElement) {
                        const target = e.currentTarget;
                        const rect = target.getBoundingClientRect();

                        // Create a clone to act as a solid, customized drag image
                        const clone = target.cloneNode(true) as HTMLElement;
                        clone.style.width = `${rect.width}px`;
                        clone.style.height = `${rect.height}px`;
                        clone.style.position = 'absolute';
                        clone.style.top = '-9999px';
                        clone.style.left = '-9999px';
                        clone.style.backgroundColor = 'white';
                        clone.style.borderRadius = '16px';
                        clone.style.border = '2px solid #3b82f6';
                        clone.style.boxShadow = '0 25px 50px -12px rgba(59, 130, 246, 0.4)';
                        clone.style.opacity = '1';
                        clone.style.zIndex = '99999';
                        clone.style.transform = 'rotate(3deg) scale(1.02)';

                        document.body.appendChild(clone);

                        // Set the custom drag image right on the mouse cursor
                        e.dataTransfer.setDragImage(clone, rect.width / 2, 40);

                        // Cleanup clone and fade the original box out to look like it was "picked up"
                        setTimeout(() => {
                          if (document.body.contains(clone)) document.body.removeChild(clone);
                          target.style.opacity = '0.4';
                          target.style.transform = 'scale(0.98)';
                        }, 50);
                      }
                    };

                    const handleDragEnd = (e: React.DragEvent) => {
                      setDraggedServiceId(null);
                      if (e.currentTarget instanceof HTMLElement) {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'scale(1)';
                      }
                    };

                    const handleDragOver = (e: React.DragEvent) => {
                      e.preventDefault();
                      if (draggedServiceId !== service.id) {
                        e.dataTransfer.dropEffect = 'move';
                      }
                    };

                    const handleDrop = async (e: React.DragEvent) => {
                      e.preventDefault();
                      if (!draggedServiceId || draggedServiceId === service.id) return;

                      const currentOrder = adminPrefs.serviceOrder?.length > 0 ? [...adminPrefs.serviceOrder] : SERVICES.map(s => s.id);
                      const draggedIdx = currentOrder.indexOf(draggedServiceId);
                      const targetIdx = currentOrder.indexOf(service.id);

                      if (draggedIdx >= 0 && targetIdx >= 0) {
                        const newOrder = [...currentOrder];
                        const [item] = newOrder.splice(draggedIdx, 1);
                        newOrder.splice(targetIdx, 0, item);
                        await updateAdminPreferences({ ...adminPrefs, serviceOrder: newOrder });
                      }
                    };

                    return (
                      <motion.div
                        {...(isMobile ? {} : { layout: true })}
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -10 }}
                        transition={{ type: "spring", stiffness: 300, damping: 20 }}
                        key={service.id}
                        className="service-card-premium"
                        style={{ '--card-color': service.color, cursor: 'grab', touchAction: 'pan-y' } as React.CSSProperties}
                        draggable={true}
                        onDragStart={handleDragStart as any}
                        onDragEnd={handleDragEnd as any}
                        onDragOver={handleDragOver as any}
                        onDrop={handleDrop as any}
                      >
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ cursor: 'grab', color: '#94a3b8', display: 'flex', alignItems: 'center' }}>
                              <GripVertical size={20} />
                            </div>
                            <h3 style={{ margin: 0 }}>{service.nameAr}</h3>
                          </div>
                          <div className={`status-badge ${isActive ? 'status-completed' : 'status-rejected'}`}>
                            {isActive ? 'نشطة' : 'متوقفة'}
                          </div>
                        </div>

                        <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                          {service.descriptionAr}
                        </p>

                        <div className="card-actions">
                          <button
                            onClick={handleToggleActive}
                            className={`action-btn ${isActive ? 'reject-btn' : 'accept-btn'}`}
                            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
                          >
                            {isActive ? (
                              <>
                                <XCircle size={18} />
                                تعطيل الخدمة
                              </>
                            ) : (
                              <>
                                <CheckCircle size={18} />
                                تفعيل الخدمة
                              </>
                            )}
                          </button>
                        </div>

                        {/* Movement controls - Radical Solution for Reordering */}
                        <div style={{
                          marginTop: '15px',
                          display: 'flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          gap: '12px',
                          borderTop: '1px solid #e2e8f0',
                          paddingTop: '12px'
                        }}>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveServiceManual(service.id, 'up'); }}
                            title="تحريك للأعلى (الترتيب)"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#3b82f6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                          >
                            <ArrowUp size={18} />
                          </button>
                          <span style={{ fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>ترتيب الخدمة</span>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveServiceManual(service.id, 'down'); }}
                            title="تحريك للأسفل (الترتيب)"
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              borderRadius: '50%',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              color: '#3b82f6',
                              boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}
                          >
                            <ArrowDown size={18} />
                          </button>
                        </div>

                        <div style={{ marginTop: '15px', padding: '12px', background: '#f1f5f9', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: '#475569' }}>التحكم في حقول الخدمة:</h4>
                          <div style={{ display: 'grid', gap: '8px' }}>
                            {service.fields.map(field => (
                              <label key={field.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!disabledFields.includes(field.name)}
                                  onChange={() => handleToggleField(field.name)}
                                  style={{ accentColor: '#3b82f6' }}
                                />
                                {field.label}
                              </label>
                            ))}
                            {service.paymentMethods && service.paymentMethods.length > 0 && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!disabledFields.includes('payment_section')}
                                  onChange={() => handleToggleField('payment_section')}
                                  style={{ accentColor: '#3b82f6' }}
                                />
                                طرق الدفع والأسعار
                              </label>
                            )}
                            {(service.id === '2' || service.id === '3' || service.id === '4' || service.id === '5' || service.id === '6' || service.id === '7' || service.id === '8' || service.id === '9' || service.id === '10' || service.id === '11') && (
                              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                                <input
                                  type="checkbox"
                                  checked={!disabledFields.includes('receipt_upload')}
                                  onChange={() => handleToggleField('receipt_upload')}
                                  style={{ accentColor: '#3b82f6' }}
                                />
                                رفع المستندات والإيصال
                              </label>
                            )}
                          </div>
                        </div>

                        <div style={{ padding: '15px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#64748b', fontSize: '12px', marginTop: '10px' }}>
                          قم بسحب وإفلات البطاقة لتغيير الترتيب
                        </div>
                      </motion.div>
                    );
                  })}
              </AnimatePresence>
            </div>
          </div>
        )
      }

      {/* Edit Request Modal */}
      {
        isEditingRequestModalOpen && editingRequestId && editingServiceId && (
          <div className="request-modal-overlay" onClick={() => setIsEditingRequestModalOpen(false)}>
            <div className="request-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
              <div className="modal-header">
                <h2>تعديل البيانات</h2>
                <button onClick={() => setIsEditingRequestModalOpen(false)} className="close-button">
                  <X size={24} />
                </button>
              </div>

              <div className="modal-content" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {Object.keys(tempRequestData).map((key) => {
                    const val = tempRequestData[key];
                    if (key === 'receiptUrl' || typeof val === 'object' && !Array.isArray(val) && val !== null) return null;

                    if (key === 'student_names' || key === 'names_array') {
                      const names = typeof val === 'string' ? val.split('\n') : Array.isArray(val) ? val : [''];
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <label style={{ fontSize: '13px', fontWeight: 'bold' }}>{translateKey(key)}</label>
                          {names.map((n: string, i: number) => (
                            <input
                              key={i}
                              type="text"
                              value={n}
                              onChange={(e) => {
                                const newNames = [...names];
                                newNames[i] = e.target.value;
                                setTempRequestData({ ...tempRequestData, [key]: newNames.join('\n') });
                              }}
                              className="form-input"
                              placeholder={`الاسم رقم ${i + 1}`}
                            />
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              const newNames = [...names, ''];
                              setTempRequestData({ ...tempRequestData, [key]: newNames.join('\n') });
                            }}
                            style={{ padding: '6px', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontSize: '12px' }}
                          >
                            + إضافة اسم آخر
                          </button>
                        </div>
                      );
                    }

                    if (Array.isArray(val)) return null;

                    return (
                      <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', fontWeight: 'bold' }}>{translateKey(key)}</label>
                        {key === 'wantsMalazem' ? (
                          <select
                            value={val ? 'true' : 'false'}
                            onChange={(e) => setTempRequestData({ ...tempRequestData, [key]: e.target.value === 'true' })}
                            className="form-input"
                          >
                            <option value="true">نعم</option>
                            <option value="false">لا</option>
                          </select>
                        ) : (
                          <input
                            type="text"
                            value={val || ''}
                            onChange={(e) => setTempRequestData({ ...tempRequestData, [key]: e.target.value })}
                            className="form-input"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="modal-footer" style={{ marginTop: '20px' }}>
                  <button
                    onClick={async () => {
                      try {
                        await updateServiceRequestData(editingRequestId, editingServiceId, tempRequestData);
                        setToastState({ message: 'تم تعديل الطلب بنجاح', type: 'success', duration: 3000 });
                        setIsEditingRequestModalOpen(false);
                      } catch (err: any) {
                        setToastState({ message: 'فشل تعديل الطلب', type: 'error', duration: 3000 });
                      }
                    }}
                    className="save-button"
                  >
                    <Save size={18} /> حفظ التغييرات
                  </button>
                  <button onClick={() => setIsEditingRequestModalOpen(false)} className="cancel-button">
                    إلغاء
                  </button>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* Edit Student Modal */}
      {
        isEditingStudent && editedStudentData && (
          <div className="request-modal-overlay" onClick={() => {
            setIsEditingStudent(false);
          }}>
            <div className="request-modal" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2>تعديل بيانات المستخدم</h2>
                <button
                  onClick={() => {
                    setIsEditingStudent(false);
                  }}
                  className="close-button"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="modal-content">
                <div className="edit-student-form">
                  <div className="form-row">
                    <div className="form-group">
                      <label>الاسم بالعربية *</label>
                      <input
                        type="text"
                        value={editedStudentData.fullNameArabic || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          fullNameArabic: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>الاسم بالإنجليزية</label>
                      <input
                        type="text"
                        value={editedStudentData.vehicleNameEnglish || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          vehicleNameEnglish: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>رقم الواتساب *</label>
                      <input
                        type="text"
                        value={editedStudentData.whatsappNumber || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          whatsappNumber: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>الرقم القومي *</label>
                      <input
                        type="text"
                        value={editedStudentData.nationalID || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          nationalID: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>الإيميل *</label>
                      <input
                        type="email"
                        value={editedStudentData.email || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          email: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>نوع الدبلومة</label>
                      <input
                        type="text"
                        value={editedStudentData.diplomaType || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          diplomaType: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">

                    <div className="form-group">
                      <label>سنة الدبلومة</label>
                      <input
                        type="text"
                        value={editedStudentData.diplomaYear || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          diplomaYear: e.target.value
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>كلمة المرور</label>
                      <input
                        type="text"
                        value={editedStudentData.password || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          password: e.target.value
                        })}
                        className="form-input"
                        placeholder="أدخل كلمة المرور الجديدة"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>المحافظة</label>
                      <input
                        type="text"
                        value={editedStudentData.address?.governorate || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          address: {
                            ...editedStudentData.address,
                            governorate: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>المدينة</label>
                      <input
                        type="text"
                        value={editedStudentData.address?.city || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          address: {
                            ...editedStudentData.address,
                            city: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>الشارع</label>
                      <input
                        type="text"
                        value={editedStudentData.address?.street || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          address: {
                            ...editedStudentData.address,
                            street: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>رقم المبنى</label>
                      <input
                        type="text"
                        value={editedStudentData.address?.building || ''}
                        onChange={(e) => setEditedStudentData({
                          ...editedStudentData,
                          address: {
                            ...editedStudentData.address,
                            building: e.target.value
                          }
                        })}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="modal-footer">
                    <button type="button" onClick={handleSaveStudent} className="save-button" disabled={isSaving === 'student'}>
                      <Save size={18} />
                      {isSaving === 'student' ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditingStudent(false);
                      }}
                      className="cancel-button"
                    >
                      إلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      }

      {/* View Student Requests Modal */}
      {viewingStudentRequests && (() => {
        const studentReqs = getStudentRequests(viewingStudentRequests.id || '');
        return (
          <div className="request-modal-overlay" onClick={() => setViewingStudentRequests(null)}>
            <div className="request-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', maxHeight: '90vh', overflow: 'auto' }}>
              <div className="modal-header" style={{ position: 'sticky', top: 0, background: 'white', zIndex: 10, borderBottom: '2px solid #e2e8f0', paddingBottom: '15px' }}>
                <div>
                  <h2 style={{ margin: 0 }}>جميع طلبات: {viewingStudentRequests.fullNameArabic}</h2>
                  <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '14px' }}>{viewingStudentRequests.email} • {studentReqs.length} طلب</p>
                </div>
                <button onClick={() => setViewingStudentRequests(null)} className="close-button">
                  <X size={24} />
                </button>
              </div>
              <div className="modal-content" style={{ padding: '20px' }}>
                {studentReqs.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#94a3b8' }}>
                    <ClipboardList size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
                    <p style={{ fontSize: '16px' }}>لا توجد طلبات مسجلة لهذا المستخدم</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {studentReqs
                      .sort((a, b) => new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime())
                      .map((req, idx) => (
                        <div key={req.id || idx} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: 'white', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                            <div>
                              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>{getServiceName(req.serviceId)}</h3>
                              <span style={{ fontSize: '12px', color: '#64748b' }}>
                                {req.createdAt ? new Date(req.createdAt).toLocaleString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'بدون تاريخ'}
                              </span>
                            </div>
                            {getStatusBadge(req.status)}
                          </div>
                          <div style={{ padding: '16px 20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '12px' }}>
                              {Object.entries(req.data || {}).map(([key, value]) => {
                                const stringValue = String(value || '').trim();

                                // Special rendering for certificate and names
                                if (key === 'selectedCertificate') {
                                  return (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                                      <span style={{ fontSize: '14px', color: '#0f172a', fontWeight: '600' }}>
                                        {typeof value === 'object' && value !== null ? (value as any).name : stringValue}
                                      </span>
                                    </div>
                                  );
                                }

                                if (key === 'student_names' || key === 'names_array') {
                                  const names = typeof value === 'string' ? value.split('\n').filter(Boolean) : Array.isArray(value) ? value : [];
                                  if (names.length === 0) return null;
                                  return (
                                    <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                                      <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                        {names.map((name: string, i: number) => (
                                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: key === 'student_names' ? '#f8fafc' : '#f0fdf4', padding: '6px 8px', borderRadius: '6px', border: key === 'student_names' ? '1px solid #cbd5e1' : '1px solid #bbf7d0', maxWidth: '300px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: key === 'student_names' ? '#3b82f6' : '#10b981', color: 'white', width: '22px', height: '22px', borderRadius: '50%', fontSize: '12px', fontWeight: 'bold', flexShrink: 0 }}>{i + 1}</span>
                                            <span style={{ fontWeight: '600', color: key === 'student_names' ? '#1e293b' : '#166534' }}>{name || 'بدون اسم'}</span>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                }

                                if (key === 'receiptUrl' || key === 'tracks_array' || key === 'selectedAssignmentsData' || key === 'selectedTransformationType' || typeof value === 'object' || !stringValue || stringValue === 'undefined' || stringValue === 'null') return null;

                                return (
                                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontSize: '12px', color: '#64748b', fontWeight: '600' }}>{translateKey(key)}:</span>
                                    <span style={{ fontSize: '14px', color: '#0f172a' }}>
                                      {key === 'wantsMalazem' ? (value ? 'نعم ✅' : 'لا') : (key.includes('track') ? normalizeTrackName(stringValue) : stringValue)}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                            {req.paymentMethod && (
                              <div style={{ marginTop: '12px', padding: '10px 14px', background: '#f1f5f9', borderRadius: '8px', fontSize: '13px' }}>
                                <strong>طريقة الدفع:</strong> {req.paymentMethod}
                              </div>
                            )}
                            {req.documents && req.documents.length > 0 && (
                              <div style={{ marginTop: '12px' }}>
                                <span style={{ fontSize: '13px', fontWeight: '600', color: '#475569' }}>المرفقات ({req.documents.length}):</span>
                                <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                                  {req.documents.map((doc, dIdx) => (
                                    <a key={dIdx} href={doc.url} target="_blank" rel="noopener noreferrer" style={{ padding: '6px 12px', background: '#eff6ff', color: '#2563eb', borderRadius: '6px', fontSize: '12px', textDecoration: 'none', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                      <FileText size={14} />
                                      {doc.name || `مرفق ${dIdx + 1}`}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {
        activeTab === 'digitalTransformation' && (
          <div className="admin-content digital-transformation-section">
            <div className="books-section">
              <div className="section-header">
                <h2>إعدادات خدمة التحول الرقمي</h2>
                <button type="button" onClick={handleSaveDigitalTransformationConfig} className="save-button" disabled={isSaving === 'digitalTransformation'}>
                  <Save size={18} />
                  {isSaving === 'digitalTransformation' ? 'جاري الحفظ...' : 'حفظ'}
                </button>
              </div>

              {digitalTransformationConfig && (
                <div className="book-config-form">
                  <div className="form-group">
                    <label>أنواع التحول الرقمي</label>
                    <div className="transformation-types-list">
                      {digitalTransformationConfig.transformationTypes.length > 0 ? (
                        digitalTransformationConfig.transformationTypes.map((type) => (
                          <div key={type.id} className="transformation-type-item">
                            <div className="type-info">
                              <div className="type-name">{type.name}</div>
                              <div className="type-price">{type.price} جنيه</div>
                            </div>
                            <button
                              onClick={() => handleRemoveTransformationType(type.id)}
                              className="remove-assignment-button"
                              title="حذف"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="no-items-message">لا توجد أنواع مضافة</div>
                      )}
                    </div>

                    <div className="add-transformation-type-section">
                      <div className="add-transformation-type-form">
                        <div className="input-group">
                          <label>اسم المدينة أو النص المخصص</label>
                          <input
                            type="text"
                            placeholder="أدخل اسم المدينة أو النص المخصص"
                            value={newTransformationTypeName}
                            onChange={(e) => setNewTransformationTypeName(e.target.value)}
                            className="config-input-enhanced"
                          />
                        </div>
                        <div className="input-group">
                          <label>السعر بالجنيه</label>
                          <input
                            type="number"
                            placeholder="أدخل السعر"
                            value={newTransformationTypePrice}
                            onChange={(e) => setNewTransformationTypePrice(e.target.value)}
                            className="config-input-enhanced"
                            min="0"
                            step="0.01"
                          />
                        </div>
                        <button onClick={handleAddTransformationType} className="add-price-button-enhanced">
                          <span>إضافة نوع</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>أنواع التدريب المتاحة (كانت تسمى لغات الامتحان)</label>
                    <div className="exam-languages-list">
                      {digitalTransformationConfig.examLanguage.length > 0 ? (
                        digitalTransformationConfig.examLanguage.map((language, index) => (
                          <div key={index} className="exam-language-item">
                            <div className="language-name">{language}</div>
                            <button
                              onClick={() => handleRemoveExamLanguage(index)}
                              className="remove-assignment-button"
                              title="حذف"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="no-items-message">لا توجد أنواع مضافة</div>
                      )}
                    </div>

                    <div className="add-exam-language-section">
                      <div className="add-exam-language-form">
                        <div className="input-group">
                          <label>إضافة نوع تدريب جديد</label>
                          <input
                            type="text"
                            placeholder="أدخل نوع التدريب (مثال: اختبار فقط)"
                            value={newExamLanguage}
                            onChange={(e) => setNewExamLanguage(e.target.value)}
                            className="config-input-enhanced"
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                handleAddExamLanguage();
                              }
                            }}
                          />
                        </div>
                        <button onClick={handleAddExamLanguage} className="add-price-button-enhanced">
                          <span>إضافة</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>أرقام الدفع</label>
                    <div className="payment-numbers">
                      <div className="payment-item">
                        <label>instaPay</label>
                        <input
                          type="text"
                          value={digitalTransformationConfig.paymentMethods.instaPay}
                          onChange={(e) => setDigitalTransformationConfig({
                            ...digitalTransformationConfig,
                            paymentMethods: {
                              ...digitalTransformationConfig.paymentMethods,
                              instaPay: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                      <div className="payment-item">
                        <label>محفظة الكاش</label>
                        <input
                          type="text"
                          value={digitalTransformationConfig.paymentMethods.cashWallet}
                          onChange={(e) => setDigitalTransformationConfig({
                            ...digitalTransformationConfig,
                            paymentMethods: {
                              ...digitalTransformationConfig.paymentMethods,
                              cashWallet: e.target.value
                            }
                          })}
                          className="config-input"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      }

      {
        activeTab === 'digitalTransformationCodes' && (
          <div className="admin-content">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2>أكواد التحول الرقمي  ({dtCodes.length})</h2>
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
                  <span style={{ width: '18px', height: '8px', background: '#22c55e', borderRadius: '50%', display: 'inline-block' }}></span>
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
                  value={dtSearchTerm}
                  onChange={(e) => setDtSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="table-container" style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', overflowX: 'auto', maxWidth: '100%' }}>
              {(() => {
                const filteredDtCodes = dtCodes.filter(code => {
                  if (!dtSearchTerm.trim()) return true;
                  const term = dtSearchTerm.toLowerCase().trim();
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

                if (filteredDtCodes.length === 0) {
                  return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>لا توجد نتائج لمطابقة بحثك</div>;
                }

                return (
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px', userSelect: 'text', minWidth: '800px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                        <th style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            الاسم
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('الاسم', 0)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            موبايل
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('موبايل', 1)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            البريد
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('البريد', 2)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            النوع
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('النوع', 3)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            القيمة
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('القيمة', 4)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            الحالة
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('الحالة', 5)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            تاريخ الحفظ
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('تاريخ الحفظ', 6)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                            رقم فوري
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyDTColumn('رقم فوري', 7)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDtCodes.map((code, index) => (
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
                          <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', userSelect: 'text', cursor: 'text' }}>{code.mobile || code.phone}</td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', userSelect: 'text', cursor: 'text' }}>{code.email}</td>
                          <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.type}</td>
                          <td style={{ padding: '12px', textAlign: 'center', userSelect: 'text', cursor: 'text' }}>{code.value}</td>
                          <td style={{ padding: '12px', textAlign: 'center', userSelect: 'text', cursor: 'text' }}>
                            <span style={{
                              padding: '4px 8px',
                              borderRadius: '12px',
                              fontSize: '0.85rem',
                              background: code.status === 'NEW' ? '#dcfce7' : '#f1f5f9',
                              color: code.status === 'NEW' ? '#166534' : '#64748b',
                              userSelect: 'text'
                            }}>
                              {code.status}
                            </span>
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', userSelect: 'text', cursor: 'text' }}>
                            {code.updatedAt?.seconds ? new Date(code.updatedAt.seconds * 1000).toLocaleString('ar-EG') : 'الان'}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', background: '#f0f9ff', userSelect: 'text', cursor: 'text' }}>{code.fawryCode}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                              {(() => {
                                const flagKey = `dt-${code.id || index}`;
                                const flags = toggledFlags[flagKey] || { f1: false, f2: false, f3: false };
                                const isFlagged = flags.f1 || flags.f2 || flags.f3;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleFlag(flagKey, 1)}
                                    title={isFlagged ? 'إلغاء التمييز المؤقت' : 'تمييز الصف مؤقتاً'}
                                    style={{
                                      padding: '6px',
                                      background: isFlagged ? '#eef2ff' : '#f5f3ff',
                                      color: isFlagged ? '#3730a3' : '#4c1d95',
                                      border: `1px solid ${isFlagged ? '#a5b4fc' : '#c4b5fd'}`,
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center'
                                    }}
                                  >
                                    <Star size={16} fill={isFlagged ? 'currentColor' : 'none'} />
                                  </button>
                                );
                              })()}
                              <button
                                onClick={() => handleDeleteDTCode(code.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )
      }

      {
        activeTab === 'electronicPaymentCodes' && (
          <div className="admin-content">
            <div className="section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <h2>أكواد الدفع الإلكتروني ({epCodes.length})</h2>
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
                  value={epSearchTerm}
                  onChange={(e) => setEpSearchTerm(e.target.value)}
                  className="search-input"
                />
              </div>
            </div>

            <div className="table-container" style={{ userSelect: 'text', WebkitUserSelect: 'text', MozUserSelect: 'text', overflowX: 'auto', maxWidth: '100%' }}>
              {(() => {
                const filteredEpCodes = epCodes.filter(code => {
                  if (!epSearchTerm.trim()) return true;
                  const term = epSearchTerm.toLowerCase().trim();
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

                if (filteredEpCodes.length === 0) {
                  return <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>لا توجد نتائج لمطابقة بحثك</div>;
                }

                return (
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
                            رقم الطلب
                            <span title="نسخ العمود كامل">
                              <Copy size={14} style={{ cursor: 'pointer', color: '#10b981', opacity: 0.7, transition: 'opacity 0.2s' }} onClick={() => copyEPColumn('رقم الطلب', 7)} onMouseEnter={(e) => e.currentTarget.style.opacity = '1'} onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'} />
                            </span>
                          </div>
                        </th>
                        <th style={{ padding: '12px', textAlign: 'center' }}>إجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredEpCodes.map((code, index) => (
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
                          <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.name}</td>
                          <td style={{ padding: '12px', textAlign: 'center', userSelect: 'text', cursor: 'text' }}>{code.mobile}</td>
                          <td style={{ padding: '12px', fontSize: '0.85rem', userSelect: 'text', cursor: 'text' }}>{code.email}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', userSelect: 'text', cursor: 'text' }}>{code.nationalID}</td>
                          <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.entity}</td>
                          <td style={{ padding: '12px', userSelect: 'text', cursor: 'text' }}>{code.serviceType}</td>
                          <td style={{ padding: '12px', textAlign: 'center', fontSize: '0.85rem', color: '#64748b', userSelect: 'text', cursor: 'text' }}>
                            {code.createdAt?.seconds
                              ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG')
                              : (code.createdAt || 'الان')}
                          </td>
                          <td style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold', color: '#2563eb', background: '#f0f9ff', userSelect: 'text', cursor: 'text' }}>{code.orderNumber}</td>
                          <td style={{ padding: '12px', textAlign: 'center' }}>
                            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}>
                              {(() => {
                                const flagKey = `ep-${code.id || index}`;
                                const flags = toggledFlags[flagKey] || { f1: false, f2: false, f3: false };
                                const isFlagged = flags.f1 || flags.f2 || flags.f3;
                                return (
                                  <button
                                    type="button"
                                    onClick={() => toggleFlag(flagKey, 1)}
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
                                );
                              })()}
                              <button
                                onClick={() => handleDeleteEPCode(code.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}
                                title="حذف"
                              >
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                );
              })()}
            </div>
          </div>
        )
      }

      {activeTab === 'statistics' && (() => {
        // --- STATISTICS CALCULATION ENGINE ---
        let totalRevenue = 0;
        let completedCount = 0;
        let pendingCount = 0;
        let rejectedCount = 0;
        let totalProfit = 0;
        const serviceStats: Record<string, { id: string; count: number; revenue: number; profit: number; name: string; color: string }> = {};

        // Initialize Services
        SERVICES.forEach(s => {
          serviceStats[s.id] = { id: s.id, count: 0, revenue: 0, profit: 0, name: s.nameAr, color: s.color };
        });

        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        // Loop through all requests to gather data
        serviceRequests.forEach(req => {
          const reqDate = req.createdAt ? new Date(req.createdAt) : null;

          // Apply Date Filtering
          if (statsDateRange !== 'all' && (!reqDate || isNaN(reqDate.getTime()))) return;
          if (statsDateRange === 'today' && reqDate! < startOfDay) return;
          if (statsDateRange === 'week' && reqDate! < startOfWeek) return;
          if (statsDateRange === 'month' && reqDate! < startOfMonth) return;

          // Status Counts
          if (req.status === 'completed') completedCount++;
          else if (req.status === 'rejected') rejectedCount++;
          else pendingCount++;

          // Per Service Logic
          if (serviceStats[req.serviceId]) {
            serviceStats[req.serviceId].count++;

            // Revenue: Only count if COMPLETED
            if (req.status === 'completed' && req.data) {
              let amount = 0;
              // Smart parsing for various price keys
              const rawPrice = req.data.price || req.data.totalPrice || req.data.amount || req.data.cost || req.data.fees;
              if (rawPrice) {
                // Remove currency symbols if any and parse
                amount = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
              }

              const profitMarginOrCost = adminPrefs.profitCosts?.[req.serviceId] || 0;
              // If profit margin looks like a percentage (e.g., < 1), or just use as fixed cost per item
              // For simplicity: Admin inputs the EXACT profit per request (e.g. 50 means 50 EGP profit per request)
              let itemProfit = profitMarginOrCost;

              serviceStats[req.serviceId].revenue += amount;
              serviceStats[req.serviceId].profit += itemProfit;
              totalRevenue += amount;
              totalProfit += itemProfit;
            }
          }
        });

        const sortedServicesByRew = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue);
        const sortedServicesByCount = Object.values(serviceStats).sort((a, b) => b.count - a.count);
        const maxServiceCount = Math.max(...Object.values(serviceStats).map(s => s.count), 1); // avoid div by zero

        return (
          <div className="admin-content stats-dashboard" style={{ animation: 'fadeIn 0.5s ease-out' }}>
            <div className="section-header" style={{ marginBottom: '30px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <TrendingUp size={32} color="#2563eb" />
                  مركز الإحصائيات والتقارير المالية
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => setStatsDateRange('all')}
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'all' ? '#2563eb' : 'white', color: statsDateRange === 'all' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                  >الكل</button>
                  <button
                    onClick={() => setStatsDateRange('today')}
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'today' ? '#2563eb' : 'white', color: statsDateRange === 'today' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                  >اليوم</button>
                  <button
                    onClick={() => setStatsDateRange('week')}
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'week' ? '#2563eb' : 'white', color: statsDateRange === 'week' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                  >آخر أسبوع</button>
                  <button
                    onClick={() => setStatsDateRange('month')}
                    style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'month' ? '#2563eb' : 'white', color: statsDateRange === 'month' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
                  >آخر شهر</button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '15px' }}>
                <div style={{ background: '#f1f5f9', padding: '12px 24px', borderRadius: '16px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '4px' }}>إجمالي الدخل المحقق</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#10b981' }}>{totalRevenue.toLocaleString()} ج.م</div>
                </div>
                <div style={{ background: '#fef3c7', padding: '12px 24px', borderRadius: '16px', textAlign: 'center', border: '1px solid #fde68a' }}>
                  <div style={{ fontSize: '0.85rem', color: '#b45309', marginBottom: '4px' }}>إجمالي المكسب</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#d97706' }}>{totalProfit.toLocaleString()} ج.م</div>
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '40px' }}>
              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: '#eff6ff', borderRadius: '12px', color: '#2563eb' }}><Activity size={24} /></div>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>إجمالي الطلبات</span>
                </div>
                <h3 style={{ fontSize: '2rem', margin: 0, color: '#0f172a' }}>{serviceRequests.length}</h3>
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#64748b' }}>طلب مقدم على المنصة</div>
              </div>

              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: '#dcfce7', borderRadius: '12px', color: '#166534' }}><CheckCircle size={24} /></div>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>الطلبات المكتملة</span>
                </div>
                <h3 style={{ fontSize: '2rem', margin: 0, color: '#0f172a' }}>{completedCount}</h3>
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#166534', fontWeight: 'bold' }}>
                  {Math.round((completedCount / (serviceRequests.length || 1)) * 100)}% معدل القبول
                </div>
              </div>

              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: '#fef2f2', borderRadius: '12px', color: '#dc2626' }}><XCircle size={24} /></div>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>الطلبات المرفوضة</span>
                </div>
                <h3 style={{ fontSize: '2rem', margin: 0, color: '#0f172a' }}>{rejectedCount}</h3>
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#ef4444' }}>تحتاج لمراجعة السبب</div>
              </div>

              <div className="stat-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <div style={{ padding: '12px', background: '#fff7ed', borderRadius: '12px', color: '#ea580c' }}><Award size={24} /></div>
                  <span style={{ color: '#64748b', fontSize: '0.9rem' }}>الأكثر ربحاً</span>
                </div>
                <h3 style={{ fontSize: '1.2rem', margin: 0, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {sortedServicesByRew[0]?.revenue > 0 ? sortedServicesByRew[0].name : 'لا يوجد'}
                </h3>
                <div style={{ marginTop: '12px', fontSize: '0.85rem', color: '#ea580c', fontWeight: 'bold' }}>
                  {sortedServicesByRew[0]?.revenue.toLocaleString()} ج.م
                </div>
              </div>
            </div>

            <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
              {/* Service Popularity Chart */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart2 size={20} />
                  توزيع الطلبات حسب الخدمة
                </h3>
                <div className="custom-chart" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {sortedServicesByCount.map((service) => (
                    <div key={service.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '120px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{service.name}</div>
                      <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(service.count / maxServiceCount) * 100}%`,
                          height: '100%',
                          background: service.color,
                          borderRadius: '5px',
                          transition: 'width 1s ease-out'
                        }} />
                      </div>
                      <div style={{ width: '40px', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right' }}>{service.count}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Revenue Breakdown */}
              <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={20} />
                  تحليل الإيرادات (للمقبولة فقط)
                </h3>
                <div style={{ height: '300px', overflowY: 'auto', paddingRight: '10px' }}>
                  {sortedServicesByRew.map((service) => (
                    service.revenue > 0 && (
                      <div key={service.name} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #f1f5f9' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <span style={{ fontWeight: '600', color: '#334155' }}>{service.name}</span>
                          <div>
                            <span style={{ fontWeight: 'bold', color: '#10b981', marginLeft: '10px' }}>{service.revenue.toLocaleString()} ج.م</span>
                            <span style={{ fontWeight: 'bold', color: '#d97706' }}>(مكسب: {service.profit.toLocaleString()} ج.م)</span>
                          </div>
                        </div>
                        <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '10px' }}>
                          <div style={{
                            width: `${(service.revenue / (totalRevenue || 1)) * 100}%`,
                            height: '100%',
                            background: '#10b981',
                            borderRadius: '4px'
                          }} />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                          <label style={{ color: '#64748b' }}>حدد المكسب للطلب الواحد (ج.م):</label>
                          <input
                            type="number"
                            style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '80px' }}
                            value={adminPrefs.profitCosts?.[service.id] || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              const updated = { ...adminPrefs, profitCosts: { ...adminPrefs.profitCosts, [service.id]: val } };
                              setAdminPrefs(updated);
                              updateAdminPreferences(updated).catch(err => console.error(err));
                            }}
                          />
                        </div>
                      </div>
                    )
                  ))}
                  {totalRevenue === 0 && (
                    <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                      لا توجد إيرادات مسجلة حتى الآن
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="quick-actions-hint" style={{ marginTop: '20px', padding: '20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fcd34d', color: '#92400e', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Bell size={20} />
              <span>تلميح: يتم حساب الإيرادات تلقائياً فقط للطلبات التي تم تغيير حالتها إلى "مكتمل" (Completed). تأكد من قبول الطلبات المدفوعة ليتم إدراجها هنا.</span>
            </div>
          </div>
        );
      })()}

      {/* Custom Alert Modal */}
      {alertConfig.isOpen && (
        <div className="request-modal-overlay">
          <div className="request-modal" style={{ maxWidth: '450px', height: 'auto', maxHeight: '90vh', padding: '0', borderRadius: '20px', overflow: 'hidden' }}>
            <div className="modal-header" style={{
              background: alertConfig.type === 'error' ? '#fef2f2' : alertConfig.type === 'success' ? '#f0fdf4' : '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
              padding: '20px'
            }}>
              <h2 style={{
                fontSize: '18px',
                color: alertConfig.type === 'error' ? '#ef4444' : alertConfig.type === 'success' ? '#16a34a' : '#1e293b',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                {alertConfig.type === 'success' && <CheckCircle size={20} />}
                {alertConfig.type === 'error' && <XCircle size={20} />}
                {alertConfig.type === 'info' && <Bell size={20} />}
                {alertConfig.title || (alertConfig.type === 'error' ? 'تنبيه' : alertConfig.type === 'success' ? 'نجاح' : 'معلومة')}
              </h2>
              <button
                onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                className="close-button"
                style={{ width: '32px', height: '32px' }}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-content" style={{ padding: '32px 24px', textAlign: 'center' }}>
              <p style={{ fontSize: '16px', color: '#1e293b', fontWeight: '600', lineHeight: '1.6', margin: 0 }}>
                {alertConfig.message}
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'center', padding: '16px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', gap: '12px' }}>
              {alertConfig.onConfirm ? (
                <>
                  <button
                    onClick={() => {
                      alertConfig.onConfirm?.();
                      setAlertConfig(prev => ({ ...prev, isOpen: false }));
                    }}
                    style={{
                      padding: '12px 24px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      minWidth: '100px',
                      boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.2)',
                    }}
                  >
                    نعم، حذف
                  </button>
                  <button
                    onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                    style={{
                      padding: '12px 24px',
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      minWidth: '100px',
                    }}
                  >
                    تراجع
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setAlertConfig(prev => ({ ...prev, isOpen: false }))}
                  style={{
                    padding: '12px 32px',
                    background: alertConfig.type === 'error' ? '#ef4444' : '#2563eb',
                    color: 'white',
                    border: 'none',
                    borderRadius: '10px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    minWidth: '120px',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
                    transition: 'transform 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  حسناً
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Spreadsheet context menu */}
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
              setRequestsSort(spreadsheetMenu.columnIndex, 'asc');
              setToastState({ message: 'ترتيب من أ إلى ي', type: 'success', duration: 1500 });
            } else if (action === 'sortZtoA' && spreadsheetMenu.columnIndex != null) {
              setRequestsSort(spreadsheetMenu.columnIndex, 'desc');
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

      {/* قائمة كليك يمين على الخلية: نسخ التحديد أو الخلية فقط */}
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

      {/* عارض المرفقات (Sheet) - يظهر عند الضغط على العين */}
      {documentViewer.open && documentViewer.urls.length > 0 && createPortal(
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
          onClick={() => setDocumentViewer({ open: false, urls: [] })}
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
                onClick={() => setDocumentViewer({ open: false, urls: [] })}
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
              {documentViewer.urls.map((url, i) => {
                const isImage = /\.(png|jpe?g|webp|gif|bmp)$/i.test(url);
                const label = `مرفق ${i + 1}`;
                const loaded = documentViewerLoadedImages.has(i);
                return (
                  <a
                    key={url + i}
                    href={url}
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
                    {isImage ? (
                      <div
                        style={{
                          position: 'relative',
                          width: '100%',
                          aspectRatio: '1',
                          minHeight: 160,
                          background: '#f1f5f9'
                        }}
                      >
                        {/* مكان محجوز للصورة حتى لا يحدث انكماش ثم انفراج */}
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
                          onLoad={() => setDocumentViewerLoadedImages(prev => new Set(prev).add(i))}
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
                      {label}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* عارض التكليفات المُرسلة للطالب (عمود الملفات) */}
      {assignedFilesViewer.open && createPortal(
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
          onClick={() => setAssignedFilesViewer({ open: false, studentName: '', files: [] })}
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
                تكليفات مُرسلة لـ: {assignedFilesViewer.studentName}
              </h2>
              <button
                type="button"
                onClick={() => setAssignedFilesViewer({ open: false, studentName: '', files: [] })}
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
            {assignedFilesViewer.files.length === 0 ? (
              <p style={{ color: '#64748b', margin: 0 }}>لا توجد ملفات مُرسلة لهذا الطالب.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {assignedFilesViewer.files.map((file, i) => (
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
      )}

    </div>
  );
};

export default AdminDashboardPage;