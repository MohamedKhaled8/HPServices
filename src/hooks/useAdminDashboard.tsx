import { useState, useEffect, useRef, useCallback, startTransition } from 'react';
import React from 'react';
import { useStudent } from '../context';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import {
  checkIsAdmin,
  getStudentsByIds,
  getAllServicesCountsSummary,
  subscribeToServiceRequestsPageLimited,
  deleteElectronicPaymentCode
} from '../services/firebaseService';
import { ServiceRequest, StudentData } from '../types';
import { logger } from '../utils/logger';
import { AdminAlertConfig } from '../components/admin/modals/AdminAlertModal';
import type { AdminTabId } from '../constants/adminNavigation';
import {
  CheckCircle,
  XCircle,
  FileCheck,
  FileText,
  Clock
} from 'lucide-react';
import { normalizeWorkflowStatus } from '../utils/adminRequestsUtils';
import {
  buildRestoredRequestData,
  mergeEnrichedRequestData,
  isPlaceholderOrderData,
  orderNeedsAutoFix
} from '../services/cloudinaryRestoreService';
import { useAdminStatsLock } from './useAdminStatsLock';
import { useAdminRowFlags } from './useAdminRowFlags';
import { useAdminConfigs } from './useAdminConfigs';
import { useAdminUsers } from './useAdminUsers';
import { useRequestsStats } from './useRequestsStats';
import { useHybridRequestsPagination } from './useHybridRequestsPagination';
import { executeAutoFixPlaceholderOrders } from '../services/adminAutoFixService';

interface UseAdminDashboardOptions {
  onBack?: () => void;
}

export function useAdminDashboard({ onBack }: UseAdminDashboardOptions = {}) {
  const { student } = useStudent();
  const [serviceRequests, setServiceRequests] = useState<ServiceRequest[]>([]);
  const [dataReady, setDataReady] = useState(false);
  const dataReadyRef = useRef(false);
  useEffect(() => {
    dataReadyRef.current = dataReady;
  }, [dataReady]);

  const [students, setStudents] = useState<Record<string, StudentData>>({});
  const studentsRef = useRef<Record<string, StudentData>>({});
  const latestServiceRequestsRef = useRef<ServiceRequest[]>([]);
  const studentIdsInFlightRef = useRef<Set<string>>(new Set());
  const fixedRequestIdsRef = useRef<Set<string>>(new Set());
  const [isAutoFixingOrders, setIsAutoFixingOrders] = useState(false);

  useEffect(() => {
    studentsRef.current = students;
  }, [students]);

  const [activeTab, setActiveTab] = useState<AdminTabId>('requests');
  const [dtCodes] = useState<any[]>([]);
  const [epCodes, setEpCodes] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);
  const [serviceTotalCounts, setServiceTotalCounts] = useState<Record<string, number>>({});
  const [restoreToolsUnlocked, setRestoreToolsUnlocked] = useState(false);

  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' ? window.innerWidth <= 900 : false
  );

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [toastState, setToastState] = useState<{
    message: string;
    type: 'loading' | 'success' | 'error' | 'info';
    duration?: number;
  } | null>(null);

  // Server Automation Health State
  const [serverHealth, setServerHealth] = useState<{
    status: 'checking' | 'online' | 'offline';
    buildTag?: string;
    details?: string;
  }>({ status: 'checking' });

  const checkServerHealth = useCallback(async () => {
    setServerHealth((prev) => ({ ...prev, status: 'checking' }));
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
      const res = await fetch(`${apiUrl}/api/automation-health`, {
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        const data = await res.json();
        setServerHealth({
          status: 'online',
          buildTag: data.buildTag || data.dtApi || 'جاهز',
          details: `السيرفر متصل بنجاح | الاصدار: ${data.buildTag || '2.1'}`
        });
      } else {
        setServerHealth({
          status: 'offline',
          details: 'السيرفر لا يجيب بشكل صحيح'
        });
      }
    } catch (err: any) {
      setServerHealth({
        status: 'offline',
        details: 'تعذر الاتصال بالسيرفر: ' + (err.message || 'خطأ شبكة')
      });
    }
  }, []);

  useEffect(() => {
    checkServerHealth();
    const interval = setInterval(checkServerHealth, 35000);
    return () => clearInterval(interval);
  }, [checkServerHealth]);

  // Alert Modal State & Actions
  const [alertConfig, setAlertConfig] = useState<AdminAlertConfig>({
    isOpen: false,
    title: '',
    message: '',
    type: 'info'
  });

  const showAlert = useCallback(
    (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') => {
      setAlertConfig({
        isOpen: true,
        title,
        message,
        type
      });
    },
    []
  );

  const showConfirm = useCallback(
    (title: string, message: string, onConfirm: () => void, confirmLabel?: string) => {
      setAlertConfig({
        isOpen: true,
        title,
        message,
        type: 'warning',
        onConfirm,
        confirmLabel
      });
    },
    []
  );

  // Extracted Custom Hooks
  const stats = useAdminStatsLock({ setToastState });
  const rowFlags = useAdminRowFlags();
  const configs = useAdminConfigs({ dataReady, isLoading });
  const users = useAdminUsers({
    isLoading,
    activeTab,
    studentsRef,
    setStudents,
    serviceRequests,
    bookConfig: configs.bookConfig,
    assignmentsConfig: configs.assignmentsConfig,
    finalReviewConfig: configs.finalReviewConfig,
    showAlert,
    setToastState
  });

  // Verify Admin Permissions
  useEffect(() => {
    if (!student?.id) return;

    const checkAdmin = async () => {
      const isAdmin = await checkIsAdmin(student.id || '');
      if (!isAdmin) {
        if (onBack) onBack();
        return;
      }
      setIsLoading(false);
    };

    checkAdmin();
  }, [student, onBack]);

  // Safety watchdog: ensure dataReady is NEVER stuck in a loading state
  useEffect(() => {
    const watchdog = setTimeout(() => {
      if (!dataReadyRef.current) {
        setDataReady(true);
      }
    }, 1500);
    return () => clearTimeout(watchdog);
  }, []);

  // Single real-time live counter document listener (1 read total, zero full-collection scans)
  const requestsStats = useRequestsStats();

  useEffect(() => {
    if (requestsStats.stats?.byService) {
      const countsMap: Record<string, number> = {};
      Object.entries(requestsStats.stats.byService).forEach(([svcId, data]) => {
        countsMap[svcId] = data.total;
      });
      setServiceTotalCounts(countsMap);
      if (!dataReadyRef.current) {
        setDataReady(true);
      }
    }
  }, [requestsStats.stats]);

  const handleInitialBatchLoaded = useCallback(() => {
    if (!dataReadyRef.current) {
      setDataReady(true);
    }
  }, []);

  // Hybrid live-head (top 25 onSnapshot) + one-time cursor pagination for older requests
  const targetServiceId = selectedServiceId || '1';
  const {
    combinedRequests: hybridRequests,
    isLoadingMore: isLoadingMoreServiceRequests,
    hasMore: hasMoreServiceRequests,
    loadMore: handleLoadMoreServiceRequests,
    updateLocalRequest,
    deleteLocalRequest
  } = useHybridRequestsPagination({
    serviceId: isLoading ? null : targetServiceId,
    pageSize: 25,
    onInitialBatchLoaded: handleInitialBatchLoaded
  });

  useEffect(() => {
    setServiceRequests(hybridRequests);
    latestServiceRequestsRef.current = hybridRequests;
    if (!dataReadyRef.current) {
      setDataReady(true);
    }
  }, [hybridRequests]);

  // Student details enrichment for loaded requests
  useEffect(() => {
    if (isLoading || hybridRequests.length === 0) return;
    let cancelled = false;

    const timer = window.setTimeout(() => {
      if (cancelled) return;
      const reqs = latestServiceRequestsRef.current;
      const uniqueStudentIds = [
        ...new Set(reqs.map((r) => r.studentId).filter(Boolean))
      ] as string[];
      const prev = studentsRef.current;
      const missingIds = uniqueStudentIds.filter(
        (id) => id && !prev[id] && !studentIdsInFlightRef.current.has(id)
      );
      if (missingIds.length === 0) return;
      missingIds.forEach((id) => studentIdsInFlightRef.current.add(id));
      void getStudentsByIds(missingIds)
        .then(async (fetched) => {
          if (cancelled) return;
          missingIds.forEach((id) => studentIdsInFlightRef.current.delete(id));
          if (Object.keys(fetched).length === 0) return;
          setStudents((current) => ({ ...current, ...fetched }));

          if (!restoreToolsUnlocked) return;

          const currentReqs = latestServiceRequestsRef.current;
          const enrichWrites: Promise<void>[] = [];
          for (const req of currentReqs) {
            if (!req.studentId || !fetched[req.studentId]) continue;
            if (!orderNeedsAutoFix(req)) continue;
            const studentData = fetched[req.studentId] as unknown as Record<string, unknown>;
            const serviceId = String(req.serviceId || '');
            if (!serviceId) continue;
            const merged = mergeEnrichedRequestData(
              (req.data || {}) as Record<string, unknown>,
              buildRestoredRequestData(studentData, serviceId)
            );
            enrichWrites.push(
              setDoc(
                doc(db, `serviceRequests_${serviceId}`, req.id!),
                { data: merged, updatedAt: serverTimestamp() },
                { merge: true }
              )
            );
          }
          for (let i = 0; i < enrichWrites.length; i += 15) {
            await Promise.all(enrichWrites.slice(i, i + 15));
          }
          for (const req of currentReqs) {
            if (!req.id || !req.studentId || !fetched[req.studentId]) continue;
            if (!isPlaceholderOrderData(req.data as Record<string, unknown>)) {
              fixedRequestIdsRef.current.add(req.id);
            }
          }
        })
        .catch(() => {
          missingIds.forEach((id) => studentIdsInFlightRef.current.delete(id));
        });
    }, 550);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isLoading, hybridRequests, restoreToolsUnlocked]);

  // Auto-fix orders with placeholder names
  const runAutoFixPlaceholderOrders = useCallback(async (scopeServiceId?: string | null) => {
    if (!dataReadyRef.current) return;
    setIsAutoFixingOrders(true);
    try {
      await executeAutoFixPlaceholderOrders({
        scopeServiceId,
        allRequests: latestServiceRequestsRef.current,
        studentsRef,
        fixedRequestIdsRef,
        setStudents,
        onToast: (toast) => setToastState(toast as any)
      });
    } catch (err: any) {
      logger.warn('Auto-fix placeholder orders:', err?.message || err);
    } finally {
      setIsAutoFixingOrders(false);
    }
  }, []);

  const getStatusBadge = useCallback((status: string | undefined) => {
    const n = normalizeWorkflowStatus(status);
    switch (n) {
      case 'completed':
        return (
          <span className="status-badge status-completed">
            <CheckCircle size={14} /> مكتمل
          </span>
        );
      case 'rejected':
        return (
          <span className="status-badge status-rejected">
            <XCircle size={14} /> مرفوض
          </span>
        );
      case 'submitted':
        return (
          <span
            style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '12px',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold',
              fontSize: '12px',
              width: 'fit-content',
              margin: '0 auto'
            }}
          >
            <FileCheck size={14} /> تم التقديم
          </span>
        );
      case 'receipt_sent':
        return (
          <span
            style={{
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #6ee7b7',
              borderRadius: '12px',
              padding: '4px 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold',
              fontSize: '12px',
              width: 'fit-content',
              margin: '0 auto'
            }}
          >
            <FileText size={14} /> تم إرسال الإيصال
          </span>
        );
      default:
        return (
          <span
            style={{
              background: '#fffbeb',
              color: '#d97706',
              border: '1px solid #fcd34d',
              borderRadius: '12px',
              padding: '4px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold',
              fontSize: '12px',
              width: 'fit-content',
              margin: '0 auto'
            }}
          >
            <Clock size={14} /> قيد الانتظار
          </span>
        );
    }
  }, []);

  const handleDeleteEPCode = useCallback(async (id: string) => {
    if (!id) return;
    try {
      await deleteElectronicPaymentCode(id);
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
    }
  }, [showAlert]);

  const copyEPColumn = useCallback(
    (columnName: string, columnIndex: number) => {
      const columnData = epCodes
        .map((code) => {
          const values = [
            code.name,
            code.mobile,
            code.email,
            code.nationalID,
            code.entity,
            code.serviceType,
            code.createdAt?.seconds
              ? new Date(code.createdAt.seconds * 1000).toLocaleString('ar-EG')
              : code.createdAt || 'الان',
            code.orderNumber
          ];
          return values[columnIndex];
        })
        .join('\n');

      navigator.clipboard.writeText(columnData);
      setToastState({
        message: `تم نسخ عمود "${columnName}" بنجاح!`,
        type: 'success',
        duration: 2000
      });
    },
    [epCodes]
  );

  return {
    isLoading,
    activeTab,
    setActiveTab,
    serviceRequests,
    setServiceRequests,
    dataReady,
    students,
    setStudents,
    studentsRef,
    latestServiceRequestsRef,
    dtCodes,
    epCodes,
    setEpCodes,
    selectedServiceId,
    setSelectedServiceId,
    serviceTotalCounts,
    setServiceTotalCounts,
    restoreToolsUnlocked,
    setRestoreToolsUnlocked,
    isMobile,
    toastState,
    setToastState,
    serverHealth,
    checkServerHealth,
    alertConfig,
    setAlertConfig,
    showAlert,
    showConfirm,
    stats,
    rowFlags,
    configs,
    users,
    runAutoFixPlaceholderOrders,
    isAutoFixingOrders,
    getStatusBadge,
    handleDeleteEPCode,
    copyEPColumn,
    isLoadingMoreServiceRequests,
    hasMoreServiceRequests,
    handleLoadMoreServiceRequests,
    updateLocalRequest,
    deleteLocalRequest,
    requestsStats,
    totalRequestsCount: requestsStats.totalRequestsCount
  };
}

export type AdminDashboardContextType = ReturnType<typeof useAdminDashboard>;
