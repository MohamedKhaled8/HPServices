import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import {
  StudentData,
  ServiceRequest,
  BookServiceConfig,
  AssignmentsServiceConfig,
  FinalReviewConfig
} from '../types';
import {
  fetchStudentsPageByDocumentId,
  getStudentsCollectionCount,
  searchStudent,
  deleteStudentData,
  updateStudentData,
  changeOtherUserPasswordHelper
} from '../services/firebaseService';
import {
  syncStudentAssignmentsOnTrackChange,
  getTrackKey,
  type TrackSyncResult
} from '../services/studentTrackSyncService';
import { normalizeTrackName } from '../utils/trackUtils';
import { logger } from '../utils/logger';

export const ADMIN_USERS_PAGE_SIZE = 75;

interface UseAdminUsersProps {
  isLoading: boolean;
  activeTab: string;
  studentsRef: React.MutableRefObject<Record<string, StudentData>>;
  setStudents: React.Dispatch<React.SetStateAction<Record<string, StudentData>>>;
  serviceRequests: ServiceRequest[];
  bookConfig?: BookServiceConfig | null;
  assignmentsConfig?: AssignmentsServiceConfig | null;
  finalReviewConfig?: FinalReviewConfig | null;
  showAlert: (title: string, message: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
  setToastState?: (toast: { message: string; type: 'success' | 'error' | 'info' | 'loading'; duration?: number } | null) => void;
}

export function useAdminUsers({
  isLoading,
  activeTab,
  studentsRef,
  setStudents,
  serviceRequests,
  bookConfig,
  assignmentsConfig,
  finalReviewConfig,
  showAlert,
  setToastState
}: UseAdminUsersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StudentData[] | null>(null);
  const [usersListPage, setUsersListPage] = useState(0);
  const [usersDirectoryLoading, setUsersDirectoryLoading] = useState(false);
  const [studentsTotalCount, setStudentsTotalCount] = useState<number | null>(null);
  const [studentsRestLoading, setStudentsRestLoading] = useState(false);
  const [usersLastSnap, setUsersLastSnap] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [usersHasMore, setUsersHasMore] = useState(true);
  const [isLoadingMoreUsers, setIsLoadingMoreUsers] = useState(false);
  const [allStudents, setAllStudents] = useState<StudentData[]>([]);

  const [isEditingStudent, setIsEditingStudent] = useState(false);
  const [editedStudentData, setEditedStudentData] = useState<StudentData | null>(null);
  const [viewingStudentRequests, setViewingStudentRequests] = useState<StudentData | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  // Lazy load initial 50 users on first visit to 'users' tab
  useEffect(() => {
    if (isLoading || activeTab !== 'users') return;
    if (allStudents.length > 0) return; // Cached, avoid re-fetching

    if (searchTerm.trim()) {
      setUsersDirectoryLoading(false);
      setStudentsRestLoading(false);
      return;
    }

    let cancelled = false;
    const STUDENTS_PAGE = 50;
    setUsersDirectoryLoading(true);
    setStudentsRestLoading(false);
    setAllStudents([]);
    setStudentsTotalCount(null);

    void getStudentsCollectionCount()
      .then((t) => {
        if (!cancelled) setStudentsTotalCount(t);
      })
      .catch((e) => {
        logger.warn('Admin: getStudentsCollectionCount failed (non-fatal)', e);
      });

    (async () => {
      try {
        const first = await fetchStudentsPageByDocumentId(STUDENTS_PAGE, null);
        if (cancelled) return;
        setAllStudents(first.students);
        setUsersLastSnap(first.lastSnapshot);
        setUsersHasMore(first.hasMore);

        const firstMap: Record<string, StudentData> = {};
        first.students.forEach((s) => {
          if (s.id) firstMap[s.id] = s;
        });
        setStudents((prev) => ({ ...prev, ...firstMap }));
        setUsersDirectoryLoading(false);
      } catch (error: any) {
        logger.error('Admin: paginated students load failed', error);
        setUsersDirectoryLoading(false);
        setStudentsRestLoading(false);
        showAlert('خطأ', error.message || 'حدث خطأ أثناء جلب بيانات المستخدمين', 'error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoading, activeTab]);

  const handleLoadMoreUsers = async () => {
    if (!usersHasMore || !usersLastSnap || isLoadingMoreUsers) return;
    setIsLoadingMoreUsers(true);
    try {
      const STUDENTS_PAGE = 50;
      const res = await fetchStudentsPageByDocumentId(STUDENTS_PAGE, usersLastSnap);
      setAllStudents((prev) => [...prev, ...res.students]);
      setUsersLastSnap(res.lastSnapshot);
      setUsersHasMore(res.hasMore);

      const newMap: Record<string, StudentData> = {};
      res.students.forEach((s) => {
        if (s.id) newMap[s.id] = s;
      });
      setStudents((prev) => ({ ...prev, ...newMap }));
    } catch (e: any) {
      logger.error('Error loading more students:', e);
      showAlert('خطأ', 'حدث خطأ أثناء تحميل الدفعة التالية من الطلاب', 'error');
    } finally {
      setIsLoadingMoreUsers(false);
    }
  };

  const searchIdRef = useRef(0);

  const handleSearchStudent = async () => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }

    const currentSearchId = ++searchIdRef.current;

    try {
      const combinedCacheMap = new Map<string, StudentData>();
      allStudents.forEach((s) => {
        if (s?.id) combinedCacheMap.set(s.id, s);
      });
      if (studentsRef.current) {
        Object.values(studentsRef.current).forEach((s) => {
          if (s?.id) combinedCacheMap.set(s.id, s);
        });
      }
      const cacheArray = Array.from(combinedCacheMap.values());

      const results = await searchStudent(term, cacheArray);
      if (searchIdRef.current === currentSearchId) {
        logger.log('Search results:', results.length);
        setSearchResults(results);
      }
    } catch (error: any) {
      if (searchIdRef.current === currentSearchId) {
        logger.error('Search error:', error);
        showAlert('خطأ', error.message || 'حدث خطأ أثناء البحث', 'error');
      }
    }
  };

  // Auto search on searchTerm change with 350ms debounce
  useEffect(() => {
    if (activeTab !== 'users' || isLoading) return;

    if (!searchTerm.trim()) {
      setSearchResults(null);
      return;
    }

    const timeoutId = setTimeout(() => {
      handleSearchStudent();
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, activeTab, isLoading]);

  const handleEditStudent = useCallback((student: StudentData) => {
    setEditedStudentData({ ...student });
    setIsEditingStudent(true);
  }, []);

  const handleDeleteStudent = useCallback(
    async (studentId: string): Promise<void> => {
      await deleteStudentData(studentId);
      setAllStudents((prev) => prev.filter((s) => s.id !== studentId));
      setSearchResults((prev) => (prev ? prev.filter((s) => s.id !== studentId) : null));
      setStudents((prev) => {
        const updated = { ...prev };
        delete updated[studentId];
        return updated;
      });
      if (studentsTotalCount !== null) {
        setStudentsTotalCount((prev) => (prev !== null ? prev - 1 : prev));
      }
    },
    [studentsTotalCount, setStudents]
  );

  const handleSaveStudent = async () => {
    if (!editedStudentData || !editedStudentData.id || isSaving === 'student') return;
    setIsSaving('student');
    try {
      const originalStudent = allStudents.find((s) => s.id === editedStudentData.id);
      let passwordAuthUpdated = false;
      let passwordAuthError = '';

      if (
        originalStudent &&
        originalStudent.password !== editedStudentData.password &&
        editedStudentData.password
      ) {
        setToastState?.({ message: 'جاري تحديث كلمة المرور في المصادقة...', type: 'loading' });
        try {
          await changeOtherUserPasswordHelper(editedStudentData.id!, editedStudentData.password);
          passwordAuthUpdated = true;
        } catch (e: any) {
          passwordAuthError = e.message || 'فشل تحديث كلمة المرور في المصادقة';
          console.warn('Could not sync auth password:', e);
        }
      }

      // مزامنة ملفات المسار الدراسي للطالب تلقائياً إذا تم تغيير المسار
      const oldTrack = originalStudent?.track;
      const newTrack = editedStudentData.track;
      const isTrackChanged = Boolean(
        newTrack && getTrackKey(newTrack) !== getTrackKey(oldTrack)
      );

      let syncResult: TrackSyncResult | null = null;
      if (isTrackChanged && editedStudentData.id) {
        setToastState?.({ message: 'جاري مزامنة ملفات المسار الدراسي للطالب...', type: 'loading' });
        try {
          syncResult = await syncStudentAssignmentsOnTrackChange(
            editedStudentData.id,
            newTrack!,
            oldTrack
          );
        } catch (syncErr: any) {
          logger.error('Track sync failed during admin save:', syncErr);
        }
      }

      const payloadToSave: StudentData = { ...editedStudentData };
      if (syncResult && syncResult.synced) {
        payloadToSave.assignedFiles = syncResult.assignedFiles;
        payloadToSave.assignedFile = syncResult.assignedFile;
      }

      await updateStudentData(editedStudentData.id, payloadToSave);

      const updatedUser: StudentData = {
        ...(originalStudent || {}),
        ...payloadToSave
      };

      const studentId = editedStudentData.id;
      setAllStudents((prev) => prev.map((s) => (s.id === studentId ? updatedUser : s)));
      setSearchResults((prev) => (prev ? prev.map((s) => (s.id === studentId ? updatedUser : s)) : null));
      setStudents((prev) => ({
        ...prev,
        [studentId]: updatedUser
      }));
      if (studentsRef.current) {
        studentsRef.current[studentId] = updatedUser;
      }

      setIsEditingStudent(false);

      if (
        originalStudent &&
        originalStudent.password !== editedStudentData.password &&
        editedStudentData.password
      ) {
        if (passwordAuthUpdated) {
          showAlert(
            'نجاح',
            'تم تحديث بيانات المستخدم وكلمة المرور بنجاح ✅\nكلمة المرور الجديدة تعمل فوراً في تسجيل الدخول.',
            'success'
          );
        } else {
          showAlert(
            'تنبيه',
            `تم تحديث البيانات في قاعدة البيانات ✅\nلكن ${passwordAuthError}\n\nيُنصح بإرسال رابط إعادة تعيين كلمة المرور للمستخدم عبر البريد الإلكتروني.`,
            'warning'
          );
        }
      } else {
        let msg = 'تم تحديث بيانات المستخدم بنجاح';
        if (syncResult && syncResult.synced) {
          msg = `تم تحديث بيانات المستخدم ومزامنة ملفات التكليفات للمسار الجديد (${normalizeTrackName(newTrack)}) بنجاح ✅\n(تمت إزالة ${syncResult.removedFilesCount} ملف من المسار السابق وإسناد ${syncResult.addedFilesCount} ملف للمسار الجديد)`;
        } else if (syncResult && syncResult.action === 'no_new_files_preserved') {
          msg = `تم تحديث بيانات المستخدم، وتم الإبقاء على الملفات الحالية لعدم وجود ملفات مرفوعة للمسار الجديد (${normalizeTrackName(newTrack)}) ⚠️`;
        }
        showAlert('نجاح', msg, 'success');
      }
    } catch (error: any) {
      showAlert('خطأ', error.message || 'حدث خطأ أثناء تحديث البيانات', 'error');
    } finally {
      setIsSaving(null);
      setToastState?.(null);
    }
  };

  const getStudentRequests = useCallback(
    (studentId: string): ServiceRequest[] => {
      return serviceRequests.filter((r) => r.studentId === studentId);
    },
    [serviceRequests]
  );

  const getServiceName = useCallback(
    (serviceId: string): string => {
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
        '11': 'استلام و شحن التحول الرقمي',
        '12': 'التقديم علي افادة و اثبات قيد'
      };
      return serviceNames[serviceId] || `خدمة ${serviceId}`;
    },
    [bookConfig, assignmentsConfig, finalReviewConfig]
  );

  const requestCountByStudentId = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of serviceRequests) {
      const id = r.studentId;
      if (!id) continue;
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [serviceRequests]);

  const filteredAdminStudents = useMemo(() => {
    if (searchResults !== null) {
      return searchResults;
    }

    const term = searchTerm.toLowerCase().trim();
    if (!term) return allStudents;

    return allStudents.filter((student) => {
      const s = student as any;
      const arabicName = String(s.fullNameArabic || s.full_name_arabic || s.full_name || '').toLowerCase();
      const englishName = String(s.vehicleNameEnglish || s.fullNameEnglish || s.full_name_english || '').toLowerCase();
      const email = String(s.email || '').toLowerCase();
      const whatsapp = String(s.whatsappNumber || s.phone || s.phoneNumber || s.mobile || '');
      const natId = String(s.nationalID || s.national_id || '');
      const diploma = String(s.diplomaType || s.diploma_type || s.diplomaYear || s.diploma_year || '').toLowerCase();
      const course = String(s.course || s.track || s.track_name || '').toLowerCase();

      return (
        arabicName.includes(term) ||
        englishName.includes(term) ||
        email.includes(term) ||
        whatsapp.includes(term) ||
        natId.includes(term) ||
        diploma.includes(term) ||
        course.includes(term)
      );
    });
  }, [allStudents, searchTerm, searchResults]);

  const displayedAdminStudents = useMemo(() => {
    const start = usersListPage * ADMIN_USERS_PAGE_SIZE;
    return filteredAdminStudents.slice(start, start + ADMIN_USERS_PAGE_SIZE);
  }, [filteredAdminStudents, usersListPage]);

  const adminUsersTotalPages = Math.max(
    1,
    Math.ceil(filteredAdminStudents.length / ADMIN_USERS_PAGE_SIZE) || 1
  );

  useEffect(() => {
    setUsersListPage(0);
  }, [searchTerm]);

  useEffect(() => {
    const maxP = Math.max(0, Math.ceil(filteredAdminStudents.length / ADMIN_USERS_PAGE_SIZE) - 1);
    setUsersListPage((p) => (p > maxP ? maxP : p));
  }, [filteredAdminStudents.length]);

  return {
    searchTerm,
    setSearchTerm,
    searchResults,
    setSearchResults,
    usersListPage,
    setUsersListPage,
    usersDirectoryLoading,
    studentsTotalCount,
    studentsRestLoading,
    usersHasMore,
    isLoadingMoreUsers,
    allStudents,
    setAllStudents,
    filteredAdminStudents,
    displayedAdminStudents,
    adminUsersTotalPages,
    requestCountByStudentId,
    isEditingStudent,
    setIsEditingStudent,
    editedStudentData,
    setEditedStudentData,
    viewingStudentRequests,
    setViewingStudentRequests,
    isSaving,
    showPasswords,
    setShowPasswords,
    handleLoadMoreUsers,
    handleSearchStudent,
    handleEditStudent,
    handleDeleteStudent,
    handleSaveStudent,
    getStudentRequests,
    getServiceName,
    ADMIN_USERS_PAGE_SIZE
  };
}
