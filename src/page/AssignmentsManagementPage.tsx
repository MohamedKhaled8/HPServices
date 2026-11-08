import React, { useState, useEffect, useMemo } from 'react';

import {
  uploadAssignmentFilesForTrack,
  getAssignmentFilesForTrack,
  createAssignmentFolderForTrack,
  getAssignmentFoldersForTrack,
  distributeAssignmentsForTrack,
  deleteAssignmentFilesForTrack,
  getAssignmentsServiceConfig,
  updateAssignmentsServiceConfig,
  getCurrentUser,
  TrackKey,
  ServiceTier,
  DistributeTargetOptions,
  upload130UnifiedFile,
  get130UnifiedFiles,
  create130UnifiedFolder,
  get130UnifiedFolders,
  deleteAssignmentFolderForTrack,
  delete130UnifiedFolder,
  delete130UnifiedFiles,
  distribute130UnifiedFiles,
  removeAssignedFilesFromAllStudents,
  AssignmentFolderMeta,
  getDistributedFilesForTrack,
  revokeDistributedFileFromStudents,
  revokeMultipleDistributedFilesFromStudents,
  revokeAllDistributedFilesForTrack,
  DistributedFileSummary,
  getStudentsWithAssignedFiles,
  revokeSingleFileFromStudent,
  revokeAllFilesFromStudent,
  StudentWithAssignedFiles
} from '../services/firebaseService';
import { AssignmentsServiceConfig, AssignmentItem } from '../types';
import { classifyAssignment, AssignmentCategory } from '../utils/assignmentClassifier';
import {
  ArrowRight,
  Folder,
  Send,
  Loader2,
  Save,
  X,
  Upload,
  AlertCircle,
  CheckCircle,
  Trash2,
  Edit2,
  Check,
  RotateCcw,
  Clock,
  Calendar,
  Users,
  FileText,
  AlertTriangle,
  Search,
  User,
  UserX
} from 'lucide-react';
import '../styles/AssignmentsManagementPage.css';

import { AssignmentsManagementPageProps } from './assignments/types/assignments.types';
import { TRACK_FOLDERS_CACHE_KEY, UNIFIED130_FOLDERS_CACHE_KEY } from './assignments/constants/assignments.constants';
import {
  mergeFoldersByPath,
  getPathParts,
  getParentPath,
  getPathLastName
} from './assignments/utils/folderUtils';
import {
  readCachedTrackFolders,
  writeCachedTrackFolders,
  readCachedUnified130Folders,
  writeCachedUnified130Folders
} from './assignments/storage/assignmentsCache';
import { DistributionProgressToast } from './assignments/components/common/DistributionProgressToast';
import { AssignmentsSnackbar } from './assignments/components/common/AssignmentsSnackbar';
import { FullscreenLoadingOverlays } from './assignments/components/common/FullscreenLoadingOverlays';
import { RevokeAllLoadingOverlay } from './assignments/components/common/RevokeAllLoadingOverlay';
import { AssignmentsHeader } from './assignments/components/layout/AssignmentsHeader';
import { AssignmentsNavigationTabs } from './assignments/components/layout/AssignmentsNavigationTabs';
import { AssignmentsConfigTab } from './assignments/components/tabs/AssignmentsConfigTab';
import { TracksManagementTab } from './assignments/components/tabs/TracksManagementTab';
import { Unified130Tab } from './assignments/components/tabs/Unified130Tab';
import { TierSelectionModal } from './assignments/components/modals/TierSelectionModal';
import { DeleteConfirmationModal } from './assignments/components/modals/DeleteConfirmationModal';
import { ConfirmRevokeSingleModal } from './assignments/components/modals/recall/ConfirmRevokeSingleModal';
import { ConfirmRevokeSelectedModal } from './assignments/components/modals/recall/ConfirmRevokeSelectedModal';
import { ConfirmRevokeAllModal } from './assignments/components/modals/recall/ConfirmRevokeAllModal';
import { ConfirmRevokeStudentAllModal } from './assignments/components/modals/recall/ConfirmRevokeStudentAllModal';
import { RecallModal } from './assignments/components/modals/recall/RecallModal';

const AssignmentsManagementPage: React.FC<AssignmentsManagementPageProps> = ({ onBack }) => {


  // Tabs: إدارة التكليفات / إدارة تكاليف المسارات
  const [activeTab, setActiveTab] = useState<'assignments' | 'tracks' | 'unified130'>('assignments');

  // Tracks view state
  const [activeTrackFolder, setActiveTrackFolder] = useState<TrackKey>('track1');
  const [trackView, setTrackView] = useState<'overview' | 'details'>('overview');
  const [openedTrack, setOpenedTrack] = useState<TrackKey | null>(null);
  const [trackFiles, setTrackFiles] = useState<Record<TrackKey, any[]>>({
    track1: [],
    track2: [],
    track3: []
  });
  const [selectedFileIds, setSelectedFileIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set()
  });

  const [uploadProgress, setUploadProgress] = useState<Record<TrackKey, { current: number; total: number }>>({
    track1: { current: 0, total: 0 },
    track2: { current: 0, total: 0 },
    track3: { current: 0, total: 0 }
  });

  const [isUploadingAssignments, setIsUploadingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false
  });
  const [isDeletingAssignments, setIsDeletingAssignments] = useState<Record<TrackKey, boolean>>({
    track1: false,
    track2: false,
    track3: false
  });
  const [animatingDeleteIds, setAnimatingDeleteIds] = useState<Record<TrackKey, Set<string>>>({
    track1: new Set(),
    track2: new Set(),
    track3: new Set()
  });

  const [isDistributingAssignments, setIsDistributingAssignments] = useState(false);
  const [assignmentsMessage, setAssignmentsMessage] = useState<string | null>(null);
  const [trackFolders, setTrackFolders] = useState<Record<TrackKey, AssignmentFolderMeta[]>>({
    track1: [],
    track2: [],
    track3: []
  });
  const [trackCurrentPath, setTrackCurrentPath] = useState<Record<TrackKey, string>>({
    track1: '',
    track2: '',
    track3: ''
  });
  const [newTrackFolderName, setNewTrackFolderName] = useState('');

  // Tier selection modal state
  const [showTierModal, setShowTierModal] = useState(false);

  // 130 unified files state
  const [unified130Files, setUnified130Files] = useState<any[]>([]);
  const [unified130Folders, setUnified130Folders] = useState<AssignmentFolderMeta[]>([]);
  const [unified130CurrentPath, setUnified130CurrentPath] = useState('');
  const [newUnified130FolderName, setNewUnified130FolderName] = useState('');

  // Persistent distribution progress state (survives tab switching and navigation)
  const [distProgress, setDistProgress] = useState<{
    active: boolean;
    status: 'running' | 'completed' | 'error';
    title: string;
    current: number;
    total: number;
    percent: number;
    studentName?: string;
    updatedAt: number;
    error?: string;
  } | null>(() => {
    try {
      const raw = localStorage.getItem('hp_assignment_dist_progress_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Date.now() - (parsed.updatedAt || 0) < 15 * 60 * 1000) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  });

  const updateProgress = (info: {
    active: boolean;
    status: 'running' | 'completed' | 'error';
    title: string;
    current: number;
    total: number;
    percent: number;
    studentName?: string;
    updatedAt: number;
    error?: string;
  } | null) => {
    setDistProgress(info);
    try {
      if (info) {
        localStorage.setItem('hp_assignment_dist_progress_v1', JSON.stringify(info));
      } else {
        localStorage.removeItem('hp_assignment_dist_progress_v1');
      }
    } catch {
      // ignore
    }
  };


  const [isUploading130, setIsUploading130] = useState(false);
  const [isDistributing130, setIsDistributing130] = useState(false);
  const [selected130FileIds, setSelected130FileIds] = useState<Set<string>>(new Set());
  const [isDeleting130, setIsDeleting130] = useState(false);
  const [assignmentsConfig, setAssignmentsConfig] = useState<AssignmentsServiceConfig>({
    serviceName: 'حل وتسليم تكليفات',
    assignments: [],
    paymentMethods: {
      instaPay: 'raoufpk97@instapay',
      cashWallet: '01050889591'
    }
  });
  const [newAssignmentName, setNewAssignmentName] = useState<string>('');
  const [newAssignmentPrice, setNewAssignmentPrice] = useState<string>('');
  const [editingAssignmentId, setEditingAssignmentId] = useState<string | null>(null);
  const [editAssignmentName, setEditAssignmentName] = useState<string>('');
  const [editAssignmentPrice, setEditAssignmentPrice] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Delete confirmation modal state
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    fileIds: string[];
    source: 'track' | 'unified130' | 'single-track';
    track?: TrackKey;
    singleFileId?: string;
  }>({ open: false, fileIds: [], source: 'track' });
  const [isRemovingFromUsers, setIsRemovingFromUsers] = useState(false);

  /** أثناء حذف فولدر (قد ياخد وقتًا بسبب Firestore والتخزين + تنظيف الطلاب) */
  const [folderDeleteLoading, setFolderDeleteLoading] = useState<{
    scope: 'track' | 'unified130';
    track?: TrackKey;
    folderPath: string;
  } | null>(null);

  // File Recall Modal state (سحب الملفات الموزعة)
  const [recallModal, setRecallModal] = useState<{
    open: boolean;
    track: TrackKey | 'unified130';
    tab: 'by_file' | 'by_student';
    loading: boolean;
    files: DistributedFileSummary[];
    students: StudentWithAssignedFiles[];
    selectedStudent: StudentWithAssignedFiles | null;
    studentSearchQuery: string;
    revokingId: string | null;
    isRevokingAll: boolean;
    revokingStudentFileId: string | null;
    isRevokingStudentAll: boolean;
  }>({
    open: false,
    track: 'track1',
    tab: 'by_file',
    loading: false,
    files: [],
    students: [],
    selectedStudent: null,
    studentSearchQuery: '',
    revokingId: null,
    isRevokingAll: false,
    revokingStudentFileId: null,
    isRevokingStudentAll: false
  });

  const [confirmRevokeAllOpen, setConfirmRevokeAllOpen] = useState(false);
  const [confirmRevokeSingle, setConfirmRevokeSingle] = useState<DistributedFileSummary | null>(null);
  const [confirmRevokeStudentAllOpen, setConfirmRevokeStudentAllOpen] = useState(false);
  const [selectedRecallFileIds, setSelectedRecallFileIds] = useState<Set<string>>(new Set());
  const [confirmRevokeSelectedOpen, setConfirmRevokeSelectedOpen] = useState(false);
  const [isRevokingSelected, setIsRevokingSelected] = useState(false);

  // Animation states
  const [showSnackbar, setShowSnackbar] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarType, setSnackbarType] = useState<'success' | 'error'>('success');
  const [showPaperPlane, setShowPaperPlane] = useState(false);

  // Load assignments config
  useEffect(() => {
    const loadAssignmentsConfig = async () => {
      try {
        const config = await getAssignmentsServiceConfig();
        if (config) {
          setAssignmentsConfig(config);
        }
      } catch (error) {
        console.error('Error loading assignments config:', error);
      }
    };
    loadAssignmentsConfig();
  }, []);

  // Load files only when a track is opened (Lazy Loading for better performance)
  useEffect(() => {
    const loadAllTracks = async () => {
      try {
        const [files1, files2, files3, folders1, folders2, folders3] = await Promise.all([
          getAssignmentFilesForTrack('track1'),
          getAssignmentFilesForTrack('track2'),
          getAssignmentFilesForTrack('track3'),
          getAssignmentFoldersForTrack('track1'),
          getAssignmentFoldersForTrack('track2'),
          getAssignmentFoldersForTrack('track3')
        ]);

        setTrackFiles({
          track1: files1,
          track2: files2,
          track3: files3
        });
        const cached = readCachedTrackFolders();
        const merged = {
          track1: mergeFoldersByPath(folders1, cached.track1),
          track2: mergeFoldersByPath(folders2, cached.track2),
          track3: mergeFoldersByPath(folders3, cached.track3)
        };
        setTrackFolders(merged);
        writeCachedTrackFolders(merged);
      } catch (error) {
        console.error('Error loading track files:', error);
        const cached = readCachedTrackFolders();
        setTrackFolders(cached);
      }
    };

    loadAllTracks();
  }, []);

  // Load 130 unified files
  useEffect(() => {
    const load130Files = async () => {
      try {
        const [files, folders] = await Promise.all([get130UnifiedFiles(), get130UnifiedFolders()]);
        setUnified130Files(files);
        const cached = readCachedUnified130Folders();
        const merged = mergeFoldersByPath(folders, cached);
        setUnified130Folders(merged);
        writeCachedUnified130Folders(merged);
      } catch (error) {
        console.error('Error loading 130 unified files:', error);
        setUnified130Folders(readCachedUnified130Folders());
      }
    };
    load130Files();
  }, []);

  // Prevent closing tab/browser while uploading
  useEffect(() => {
    const isUploading = Object.values(isUploadingAssignments).some(uploading => uploading);

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isUploading) {
        e.preventDefault();
        e.returnValue = 'هناك ملفات قيد الرفع. هل تريد المغادرة؟';
        return e.returnValue;
      }
    };

    if (isUploading) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isUploadingAssignments]);

  const handleSaveAssignmentsConfig = async () => {
    if (!assignmentsConfig || isSaving) return;
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(assignmentsConfig);
      setAssignmentsMessage('تم حفظ إعدادات التكليفات بنجاح');
      setTimeout(() => setAssignmentsMessage(null), 3000);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddAssignment = async () => {
    if (!newAssignmentName.trim() || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }
    const cleanName = newAssignmentName.trim();
    const inferredType = classifyAssignment({ name: cleanName, price });

    const newAssignment: AssignmentItem = {
      id: `assignment_${Date.now()}`,
      name: cleanName,
      price: price,
      deliveryType: inferredType
    };
    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: [...assignmentsConfig.assignments, newAssignment]
    };
    setAssignmentsConfig(updatedConfig);
    setNewAssignmentName('');
    setNewAssignmentPrice('');

    // حفظ فوري في قاعدة البيانات حتى لا يضيع التكليف عند إعادة التحميل
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم إضافة وحفظ التكليف بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التكليف');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveAssignment = async (id: string) => {
    if (!assignmentsConfig) return;
    const target = assignmentsConfig.assignments.find(a => a.id === id);
    if (!window.confirm(`هل أنت متأكد من حذف تكليف "${target?.name || ''}"؟`)) return;

    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    };
    setAssignmentsConfig(updatedConfig);

    // حفظ فوري في قاعدة البيانات
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم حذف التكليف وحفظ التغييرات بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التغييرات');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEditAssignment = (assignment: AssignmentItem) => {
    setEditingAssignmentId(assignment.id);
    setEditAssignmentName(assignment.name);
    setEditAssignmentPrice(String(assignment.price));
  };

  const handleCancelEditAssignment = () => {
    setEditingAssignmentId(null);
    setEditAssignmentName('');
    setEditAssignmentPrice('');
  };

  const handleSaveEditAssignment = async () => {
    if (!editingAssignmentId || !assignmentsConfig) return;
    if (!editAssignmentName.trim()) {
      setAssignmentsMessage('يرجى إدخال اسم التكليف');
      return;
    }
    const price = parseFloat(editAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }

    const cleanName = editAssignmentName.trim();
    const inferredType = classifyAssignment({ name: cleanName, price });

    const updatedAssignments = assignmentsConfig.assignments.map(a =>
      a.id === editingAssignmentId
        ? { ...a, name: cleanName, price: price, deliveryType: inferredType }
        : a
    );
    const updatedConfig: AssignmentsServiceConfig = {
      ...assignmentsConfig,
      assignments: updatedAssignments
    };

    setAssignmentsConfig(updatedConfig);
    setEditingAssignmentId(null);

    // حفظ فوري للتعديل في قاعدة البيانات
    setIsSaving(true);
    try {
      await updateAssignmentsServiceConfig(updatedConfig);
      setAssignmentsMessage('تم تعديل وحفظ بيانات وسعر التكليف بنجاح ✅');
      setTimeout(() => setAssignmentsMessage(null), 3500);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء حفظ التعديل');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (track: TrackKey, files: File[]) => {
    const user = getCurrentUser();
    // التحقق من وجود مستخدم (أدمن) وليس طالب
    if (!user || files.length === 0) {
      console.error('No user found or no files selected');
      return;
    }

    try {
      setIsUploadingAssignments(prev => ({ ...prev, [track]: true }));
      setAssignmentsMessage(null);

      // تهيئة العداد قبل البدء
      setUploadProgress(prev => ({
        ...prev,
        [track]: { current: 0, total: files.length }
      }));

      // الرفع المباشر وتحديث الواجهة فورياً
      const uploadedFiles = await uploadAssignmentFilesForTrack(
        track,
        files,
        user.uid,
        trackCurrentPath[track] || '',
        (current, total) => {
          setUploadProgress(prev => ({
            ...prev,
            [track]: { current, total }
          }));
        }
      );

      // تحديث الحالة محلياً وفورياً (Optimistic UI Update)
      setTrackFiles(prev => ({
        ...prev,
        [track]: [...(prev[track] || []), ...uploadedFiles]
      }));

      setAssignmentsMessage(
        `تم رفع الملفات بنجاح للمسار ${track === 'track1' ? 'الأول' : track === 'track2' ? 'الثاني' : 'الثالث'
        }`
      );
      setTimeout(() => setAssignmentsMessage(null), 3000);
    } catch (error: any) {
      setAssignmentsMessage(error.message || 'حدث خطأ أثناء رفع الملفات');
    } finally {
      setIsUploadingAssignments(prev => ({ ...prev, [track]: false }));
    }
  };

  const handleDistribute = async (tierOrTarget: ServiceTier | DistributeTargetOptions) => {
    const targetTrack = openedTrack || activeTrackFolder;
    const trackName = targetTrack === 'track1' ? 'المسار الأول' : targetTrack === 'track2' ? 'المسار الثاني' : 'المسار الثالث';

    let tierLabel = 'الخدمة المختارة';
    if (typeof tierOrTarget === 'string') {
      if (tierOrTarget === 'personalized' || tierOrTarget === '500') {
        tierLabel = 'مشتركي باقة حل وتسليم التكليفات';
      } else if (tierOrTarget === 'plain' || tierOrTarget === '300') {
        tierLabel = 'مشتركي باقة حل PDF فقط';
      } else if (tierOrTarget === 'unified' || tierOrTarget === '130') {
        tierLabel = 'مشتركي التربية العملي (الملف الموحد)';
      } else {
        tierLabel = `مشتركي (${tierOrTarget})`;
      }
    } else if (tierOrTarget.assignmentName) {
      const modeStr = tierOrTarget.namingMode === 'plain' ? 'حل PDF (بدون اسم)' : 'حل وتسليم (بالاسم)';
      tierLabel = `"${tierOrTarget.assignmentName}" (${modeStr})`;
    } else if (tierOrTarget.category === 'personalized' || tierOrTarget.tier === '500') {
      tierLabel = 'مشتركي باقة حل وتسليم التكليفات';
    } else if (tierOrTarget.category === 'plain' || tierOrTarget.tier === '300') {
      tierLabel = 'مشتركي باقة حل PDF فقط';
    } else if (tierOrTarget.category === 'unified' || tierOrTarget.tier === '130') {
      tierLabel = 'مشتركي التربية العملي (الملف الموحد)';
    }

    try {
      setShowTierModal(false);
      setAssignmentsMessage(null);
      setIsDistributingAssignments(true);

      // Show paper plane animation
      setShowPaperPlane(true);
      setTimeout(() => setShowPaperPlane(false), 1500);

      const selectedIds = Array.from(selectedFileIds[targetTrack] || []);
      const visibleIds = getVisibleTrackFiles(targetTrack).map((f: any) => f.id);
      const ids = selectedIds.length > 0 ? selectedIds : visibleIds;
      if (ids.length === 0) {
        throw new Error('لا توجد ملفات داخل المجلد الحالي للإرسال');
      }

      // Initial progress banner
      updateProgress({
        active: true,
        status: 'running',
        title: `${tierLabel} — ${trackName}`,
        current: 0,
        total: 0,
        percent: 0,
        studentName: 'جاري فحص الطلبات...',
        updatedAt: Date.now()
      });

      const result = await distributeAssignmentsForTrack(
        targetTrack,
        ids,
        tierOrTarget,
        (current, total, studentName) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          updateProgress({
            active: true,
            status: 'running',
            title: `${tierLabel} — ${trackName}`,
            current,
            total,
            percent,
            studentName: `جاري الإرسال لـ: ${studentName}`,
            updatedAt: Date.now()
          });
        }
      );

      // Completed successfully
      updateProgress({
        active: true,
        status: 'completed',
        title: `${tierLabel} — ${trackName}`,
        current: result.sent,
        total: result.total,
        percent: 100,
        updatedAt: Date.now()
      });

      showSnackbarNotification(`تم إرسال ${ids.length} ملف لـ ${tierLabel} بنجاح (${result.sent} طالب)`, 'success');

      // Clear selection
      setSelectedFileIds(prev => ({
        ...prev,
        [targetTrack]: new Set()
      }));
    } catch (error: any) {
      updateProgress({
        active: true,
        status: 'error',
        title: `${tierLabel} — ${trackName}`,
        current: 0,
        total: 0,
        percent: 0,
        error: error.message || 'حدث خطأ أثناء التوزيع',
        updatedAt: Date.now()
      });
      showSnackbarNotification(error.message || 'حدث خطأ أثناء توزيع الملفات', 'error');
    } finally {
      setIsDistributingAssignments(false);
    }
  };

  // 130 Unified File Handlers
  const handle130FileUpload = async (file: File) => {
    const user = getCurrentUser();
    if (!user) return;
    try {
      setIsUploading130(true);
      const uploaded = await upload130UnifiedFile(file, user.uid, unified130CurrentPath || '');
      setUnified130Files(prev => [...prev, uploaded]);
      showSnackbarNotification('تم رفع الملف الموحد بنجاح', 'success');
    } catch (error: any) {
      showSnackbarNotification(error.message || 'حدث خطأ أثناء رفع الملف', 'error');
    } finally {
      setIsUploading130(false);
    }
  };

  const handle130Distribute = async () => {
    const label = 'ملفات موحدة (التربية العملي)';
    try {
      setIsDistributing130(true);
      setShowPaperPlane(true);
      setTimeout(() => setShowPaperPlane(false), 1500);

      const selectedIds = Array.from(selected130FileIds);
      const visibleIds = getVisibleUnified130Files().map((f: any) => f.id);
      const ids = selectedIds.length > 0 ? selectedIds : visibleIds;
      if (ids.length === 0) {
        throw new Error('لا توجد ملفات داخل المجلد الحالي للإرسال');
      }

      updateProgress({
        active: true,
        status: 'running',
        title: label,
        current: 0,
        total: 0,
        percent: 0,
        studentName: 'جاري فحص الطلبات...',
        updatedAt: Date.now()
      });

      const result = await distribute130UnifiedFiles(
        ids.length > 0 ? ids : undefined,
        undefined,
        (current, total, studentName) => {
          const percent = total > 0 ? Math.round((current / total) * 100) : 0;
          updateProgress({
            active: true,
            status: 'running',
            title: label,
            current,
            total,
            percent,
            studentName: `جاري الإرسال لـ: ${studentName}`,
            updatedAt: Date.now()
          });
        }
      );

      updateProgress({
        active: true,
        status: 'completed',
        title: label,
        current: result.sent,
        total: result.total,
        percent: 100,
        updatedAt: Date.now()
      });

      showSnackbarNotification(`تم إرسال الملفات الموحدة بنجاح (${result.sent} طالب)`, 'success');
      setSelected130FileIds(new Set());
    } catch (error: any) {
      updateProgress({
        active: true,
        status: 'error',
        title: label,
        current: 0,
        total: 0,
        percent: 0,
        error: error.message || 'حدث خطأ أثناء التوزيع',
        updatedAt: Date.now()
      });
      showSnackbarNotification(error.message || 'حدث خطأ أثناء التوزيع', 'error');
    } finally {
      setIsDistributing130(false);
    }
  };

  const handle130Delete = () => {
    const ids = Array.from(selected130FileIds);
    if (ids.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, source: 'unified130' });
  };

  // Helper function to show snackbar
  const showSnackbarNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setSnackbarMessage(message);
    setSnackbarType(type);
    setShowSnackbar(true);

    setTimeout(() => {
      setShowSnackbar(false);
    }, 3000);
  };

  const handleDeleteSelected = (track: TrackKey) => {
    const ids = Array.from(selectedFileIds[track] || []);
    if (ids.length === 0) return;
    setDeleteConfirmModal({ open: true, fileIds: ids, source: 'track', track });
  };

  // ============================================
  // سحب وإلغاء توزيع الملفات من الطلاب (Recall Handlers)
  // ============================================

  const handleOpenRecallModal = async (track: TrackKey | 'unified130') => {
    setSelectedRecallFileIds(new Set());
    setRecallModal({
      open: true,
      track,
      tab: 'by_file',
      loading: true,
      files: [],
      students: [],
      selectedStudent: null,
      studentSearchQuery: '',
      revokingId: null,
      isRevokingAll: false,
      revokingStudentFileId: null,
      isRevokingStudentAll: false
    });

    try {
      const [distributed, students] = await Promise.all([
        getDistributedFilesForTrack(track),
        getStudentsWithAssignedFiles(track)
      ]);
      setRecallModal((prev) => ({
        ...prev,
        loading: false,
        files: distributed,
        students
      }));
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, loading: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء فحص الملفات الموزعة', 'error');
    }
  };

  const handleRevokeSingleFile = async (item: DistributedFileSummary) => {
    try {
      setConfirmRevokeSingle(null);
      setRecallModal((prev) => ({ ...prev, revokingId: item.fileId }));

      const count = await revokeDistributedFileFromStudents(item.fileId, item.studentIds);

      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        next.delete(item.fileId);
        return next;
      });

      setRecallModal((prev) => ({
        ...prev,
        revokingId: null,
        files: prev.files.filter((f) => f.fileId !== item.fileId),
        students: prev.students.map((s) => ({
          ...s,
          assignedFiles: s.assignedFiles.filter((f) => f.id !== item.fileId)
        })).filter((s) => s.assignedFiles.length > 0)
      }));

      showSnackbarNotification(`تم سحب ملف "${item.fileName}" بنجاح من حسابات ${count} طالب`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, revokingId: null }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملف', 'error');
    }
  };

  const handleRevokeAllFiles = async () => {
    try {
      setConfirmRevokeAllOpen(false);
      setRecallModal((prev) => ({ ...prev, isRevokingAll: true }));

      const result = await revokeAllDistributedFilesForTrack(recallModal.track);

      setSelectedRecallFileIds(new Set());
      setRecallModal((prev) => ({
        ...prev,
        isRevokingAll: false,
        files: [],
        students: [],
        selectedStudent: null
      }));

      showSnackbarNotification(`تم سحب كافة ملفات المسار بنجاح من ${result.updatedStudents} طالب`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, isRevokingAll: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب جميع الملفات', 'error');
    }
  };

  // أحدث دفعة تم إرسالها (أي ملفات أُرسلت في نافذة 10 دقائق من أحدث ملف)
  const latestBatchFiles = useMemo(() => {
    if (!recallModal.files || recallModal.files.length === 0) return [];
    const firstTime = new Date(recallModal.files[0].assignedAt).getTime();
    if (isNaN(firstTime)) return [recallModal.files[0]];
    const WINDOW_MS = 10 * 60 * 1000;
    return recallModal.files.filter((f) => {
      const t = new Date(f.assignedAt).getTime();
      return !isNaN(t) && firstTime - t <= WINDOW_MS;
    });
  }, [recallModal.files]);

  const isLatestBatchSelected = useMemo(() => {
    if (latestBatchFiles.length === 0) return false;
    return latestBatchFiles.every((f) => selectedRecallFileIds.has(f.fileId));
  }, [latestBatchFiles, selectedRecallFileIds]);

  const isAllFilesSelected = useMemo(() => {
    if (recallModal.files.length === 0) return false;
    return recallModal.files.every((f) => selectedRecallFileIds.has(f.fileId));
  }, [recallModal.files, selectedRecallFileIds]);

  const handleToggleSelectFile = (fileId: string) => {
    setSelectedRecallFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(fileId)) {
        next.delete(fileId);
      } else {
        next.add(fileId);
      }
      return next;
    });
  };

  const handleToggleSelectAllFiles = () => {
    if (isAllFilesSelected) {
      setSelectedRecallFileIds(new Set());
    } else {
      setSelectedRecallFileIds(new Set(recallModal.files.map((f) => f.fileId)));
    }
  };

  const handleToggleSelectLatestBatch = () => {
    if (isLatestBatchSelected) {
      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        latestBatchFiles.forEach((f) => next.delete(f.fileId));
        return next;
      });
    } else {
      setSelectedRecallFileIds((prev) => {
        const next = new Set(prev);
        latestBatchFiles.forEach((f) => next.add(f.fileId));
        return next;
      });
    }
  };

  const handleRevokeSelectedFiles = async () => {
    try {
      const fileIdsToRevoke = Array.from(selectedRecallFileIds);
      if (fileIdsToRevoke.length === 0) return;

      setConfirmRevokeSelectedOpen(false);
      setIsRevokingSelected(true);

      const targetStudentIdSet = new Set<string>();
      recallModal.files
        .filter((f) => selectedRecallFileIds.has(f.fileId))
        .forEach((f) => f.studentIds.forEach((id) => targetStudentIdSet.add(id)));

      const result = await revokeMultipleDistributedFilesFromStudents(
        fileIdsToRevoke,
        Array.from(targetStudentIdSet)
      );

      const revokedSet = new Set(fileIdsToRevoke);

      setRecallModal((prev) => ({
        ...prev,
        files: prev.files.filter((f) => !revokedSet.has(f.fileId)),
        students: prev.students
          .map((s) => ({
            ...s,
            assignedFiles: s.assignedFiles.filter((f) => !revokedSet.has(f.id))
          }))
          .filter((s) => s.assignedFiles.length > 0)
      }));

      setSelectedRecallFileIds(new Set());
      setIsRevokingSelected(false);

      showSnackbarNotification(
        `تم سحب ${fileIdsToRevoke.length} ملف بنجاح من حسابات ${result.updatedStudentsCount} طالب`,
        'success'
      );
    } catch (err: any) {
      setIsRevokingSelected(false);
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملفات المحددة', 'error');
    }
  };

  const handleRevokeSingleFileFromStudent = async (studentId: string, fileId: string, fileName: string) => {
    try {
      setRecallModal((prev) => ({ ...prev, revokingStudentFileId: fileId }));
      await revokeSingleFileFromStudent(studentId, fileId);

      setRecallModal((prev) => {
        const updatedStudents = prev.students
          .map((s) => {
            if (s.id !== studentId) return s;
            return {
              ...s,
              assignedFiles: s.assignedFiles.filter((f) => f.id !== fileId)
            };
          })
          .filter((s) => s.assignedFiles.length > 0);

        let updatedSelected = prev.selectedStudent;
        if (updatedSelected && updatedSelected.id === studentId) {
          const newFiles = updatedSelected.assignedFiles.filter((f) => f.id !== fileId);
          updatedSelected = newFiles.length > 0 ? { ...updatedSelected, assignedFiles: newFiles } : null;
        }

        return {
          ...prev,
          revokingStudentFileId: null,
          students: updatedStudents,
          selectedStudent: updatedSelected
        };
      });

      showSnackbarNotification(`تم سحب ملف "${fileName}" من الطالب بنجاح`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, revokingStudentFileId: null }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب الملف من الطالب', 'error');
    }
  };

  const handleRevokeAllFilesFromStudent = async (studentId: string, studentName: string) => {
    try {
      setConfirmRevokeStudentAllOpen(false);
      setRecallModal((prev) => ({ ...prev, isRevokingStudentAll: true }));
      const removedCount = await revokeAllFilesFromStudent(studentId, recallModal.track);

      setRecallModal((prev) => {
        const updatedStudents = prev.students.filter((s) => s.id !== studentId);
        return {
          ...prev,
          isRevokingStudentAll: false,
          students: updatedStudents,
          selectedStudent: null
        };
      });

      showSnackbarNotification(`تم سحب كافة ملفات الطالب (${studentName}) بنجاح (${removedCount} ملف)`, 'success');
    } catch (err: any) {
      setRecallModal((prev) => ({ ...prev, isRevokingStudentAll: false }));
      showSnackbarNotification(err.message || 'حدث خطأ أثناء سحب ملفات الطالب', 'error');
    }
  };

  // حذف ملف واحد من track مع modal
  const handleDeleteSingleTrackFile = (track: TrackKey, fileId: string) => {
    setDeleteConfirmModal({ open: true, fileIds: [fileId], source: 'single-track', track, singleFileId: fileId });
  };

  /**
   * تنفيذ الحذف الفعلي بعد التأكيد
   * @param alsoRemoveFromUsers - هل نحذف الملفات من حسابات الطلاب أيضاً
   */
  const executeDelete = async (alsoRemoveFromUsers: boolean) => {
    const { fileIds, source, track } = deleteConfirmModal;
    setDeleteConfirmModal(prev => ({ ...prev, open: false }));

    try {
      if (source === 'unified130') {
        // === حذف ملفات الـ 130 الموحدة ===
        setIsDeleting130(true);

        if (alsoRemoveFromUsers) {
          setIsRemovingFromUsers(true);
          try {
            const removedCount = await removeAssignedFilesFromAllStudents(fileIds);
            showSnackbarNotification(`تم حذف الملفات من ${removedCount} طالب`, 'success');
          } catch (err: any) {
            showSnackbarNotification('حدث خطأ أثناء حذف الملفات من الطلاب', 'error');
          } finally {
            setIsRemovingFromUsers(false);
          }
        }

        await delete130UnifiedFiles(fileIds);
        setUnified130Files(prev => prev.filter(f => !fileIds.includes(f.id)));
        setSelected130FileIds(new Set());
        showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');
        setIsDeleting130(false);

      } else if (source === 'track' || source === 'single-track') {
        // === حذف ملفات من المسار ===
        const targetTrack = track!;
        setIsDeletingAssignments(prev => ({ ...prev, [targetTrack]: true }));
        setAssignmentsMessage(null);

        if (alsoRemoveFromUsers) {
          setIsRemovingFromUsers(true);
          try {
            const removedCount = await removeAssignedFilesFromAllStudents(fileIds);
            showSnackbarNotification(`تم حذف الملفات من ${removedCount} طالب`, 'success');
          } catch (err: any) {
            showSnackbarNotification('حدث خطأ أثناء حذف الملفات من الطلاب', 'error');
          } finally {
            setIsRemovingFromUsers(false);
          }
        }

        // أنيميشن الحذف
        setAnimatingDeleteIds(prev => ({
          ...prev,
          [targetTrack]: new Set(fileIds)
        }));
        await new Promise(resolve => setTimeout(resolve, 600));

        // حذف من الواجهة فوراً
        setTrackFiles(prev => ({
          ...prev,
          [targetTrack]: (prev[targetTrack] || []).filter(file => !fileIds.includes(file.id))
        }));
        if (source === 'track') {
          setSelectedFileIds(prev => ({
            ...prev,
            [targetTrack]: new Set()
          }));
        }

        // حذف من السيرفر (نضمن إيقاف حالة التحميل دائماً)
        try {
          await deleteAssignmentFilesForTrack(targetTrack, fileIds);
          showSnackbarNotification(`تم مسح ${fileIds.length} ملف بنجاح`, 'success');
        } catch (err) {
          showSnackbarNotification('حدث خطأ أثناء الحذف من السيرفر', 'error');
        } finally {
          setIsDeletingAssignments(prev => ({ ...prev, [targetTrack]: false }));
          setAnimatingDeleteIds(prev => ({
            ...prev,
            [targetTrack]: new Set()
          }));
        }
      }
    } catch (error: any) {
      showSnackbarNotification('حدث خطأ غير متوقع', 'error');
    }
  };

  const handleBack = () => {
    // التحقق من وجود رفع جاري
    const isUploading = Object.values(isUploadingAssignments).some(uploading => uploading);

    if (isUploading) {
      const confirmLeave = window.confirm(
        'هناك ملفات قيد الرفع حالياً. إذا غادرت الصفحة الآن، سيتم إيقاف عملية الرفع. هل تريد المتابعة؟'
      );
      if (!confirmLeave) {
        return; // لا تغادر
      }
    }

    onBack();
  };


  const getVisibleTrackFiles = (track: TrackKey) => {
    const current = trackCurrentPath[track] || '';
    return (trackFiles[track] || []).filter((f) => (f.folderPath || '') === current);
  };

  const getVisibleTrackFolders = (track: TrackKey) => {
    const current = trackCurrentPath[track] || '';
    return (trackFolders[track] || []).filter((f) => f.parentPath === current);
  };

  const getVisibleUnified130Files = () => {
    const current = unified130CurrentPath || '';
    return (unified130Files || []).filter((f) => (f.folderPath || '') === current);
  };

  const getVisibleUnified130Folders = () => {
    const current = unified130CurrentPath || '';
    return (unified130Folders || []).filter((f) => f.parentPath === current);
  };

  const handleCreateTrackFolder = async (track: TrackKey) => {
    const folderName = newTrackFolderName.trim();
    if (!folderName) return;
    try {
      const created = await createAssignmentFolderForTrack(track, folderName, trackCurrentPath[track] || '');
      setTrackFolders((prev) => {
        const next = { ...prev, [track]: mergeFoldersByPath(prev[track] || [], [created]) };
        writeCachedTrackFolders(next);
        return next;
      });
      setNewTrackFolderName('');
      showSnackbarNotification('تم إنشاء المجلد بنجاح', 'success');
    } catch (error: any) {
      // fallback local-only folder حتى لا يختفي عند إعادة فتح الصفحة
      const fallback: AssignmentFolderMeta = {
        id: `local_${Date.now()}`,
        name: folderName.replace(/[\\/:*?"<>|]/g, '_').trim(),
        path: (trackCurrentPath[track] ? `${trackCurrentPath[track]}/` : '') + folderName.replace(/[\\/:*?"<>|]/g, '_').trim(),
        parentPath: trackCurrentPath[track] || ''
      };
      setTrackFolders((prev) => {
        const next = { ...prev, [track]: mergeFoldersByPath(prev[track] || [], [fallback]) };
        writeCachedTrackFolders(next);
        return next;
      });
      setNewTrackFolderName('');
      showSnackbarNotification(error.message ? `${error.message} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleCreateUnified130Folder = async () => {
    const folderName = newUnified130FolderName.trim();
    if (!folderName) return;
    try {
      const created = await create130UnifiedFolder(folderName, unified130CurrentPath || '');
      setUnified130Folders((prev) => {
        const next = mergeFoldersByPath(prev, [created]);
        writeCachedUnified130Folders(next);
        return next;
      });
      setNewUnified130FolderName('');
      showSnackbarNotification('تم إنشاء المجلد بنجاح', 'success');
    } catch (error: any) {
      const safe = folderName.replace(/[\\/:*?"<>|]/g, '_').trim();
      const fallback: AssignmentFolderMeta = {
        id: `local_${Date.now()}`,
        name: safe,
        path: (unified130CurrentPath ? `${unified130CurrentPath}/` : '') + safe,
        parentPath: unified130CurrentPath || ''
      };
      setUnified130Folders((prev) => {
        const next = mergeFoldersByPath(prev, [fallback]);
        writeCachedUnified130Folders(next);
        return next;
      });
      setNewUnified130FolderName('');
      showSnackbarNotification(error.message ? `${error.message} — تم حفظ المجلد محلياً.` : 'تم حفظ المجلد محلياً.', 'error');
    }
  };

  const handleDeleteTrackFolder = async (track: TrackKey, folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;
    setFolderDeleteLoading({ scope: 'track', track, folderPath });
    try {
      const result = await deleteAssignmentFolderForTrack(track, folderPath);

      const nextFolders = {
        ...trackFolders,
        [track]: (trackFolders[track] || []).filter((f) => !(f.path === folderPath || f.path.startsWith(`${folderPath}/`)))
      };
      const nextFiles = {
        ...trackFiles,
        [track]: (trackFiles[track] || []).filter((f: any) => {
          const fp = String(f.folderPath || '');
          return !(fp === folderPath || fp.startsWith(`${folderPath}/`));
        })
      };
      setTrackFolders(nextFolders);
      setTrackFiles(nextFiles);
      writeCachedTrackFolders(nextFolders);

      const cur = trackCurrentPath[track] || '';
      if (cur === folderPath || cur.startsWith(`${folderPath}/`)) {
        setTrackCurrentPath((p) => ({ ...p, [track]: getParentPath(folderPath) }));
      }

      const removedIds = new Set(result.deletedFiles);
      if (removedIds.size > 0) {
        setSelectedFileIds((prev) => {
          const s = new Set(prev[track] || []);
          removedIds.forEach((id) => s.delete(id));
          return { ...prev, [track]: s };
        });
      }

      if (result.deletedFiles.length > 0) {
        try {
          await removeAssignedFilesFromAllStudents(result.deletedFiles);
        } catch {
          // ignore secondary cleanup failure
        }
      }
      showSnackbarNotification('تم حذف المجلد وكل محتوياته', 'success');
    } catch (error: any) {
      showSnackbarNotification(error.message || 'فشل حذف المجلد', 'error');
    } finally {
      setFolderDeleteLoading(null);
    }
  };

  const handleDeleteUnified130Folder = async (folderPath: string) => {
    const folderName = getPathLastName(folderPath) || folderPath;
    const ok = window.confirm(`سيتم حذف المجلد "${folderName}" وكل ما بداخله. هل أنت متأكد؟`);
    if (!ok) return;
    setFolderDeleteLoading({ scope: 'unified130', folderPath });
    try {
      const result = await delete130UnifiedFolder(folderPath);
      const nextFolders = unified130Folders.filter((f) => !(f.path === folderPath || f.path.startsWith(`${folderPath}/`)));
      const nextFiles = unified130Files.filter((f: any) => {
        const fp = String(f.folderPath || '');
        return !(fp === folderPath || fp.startsWith(`${folderPath}/`));
      });
      setUnified130Folders(nextFolders);
      setUnified130Files(nextFiles);
      writeCachedUnified130Folders(nextFolders);

      const cur = unified130CurrentPath || '';
      if (cur === folderPath || cur.startsWith(`${folderPath}/`)) {
        setUnified130CurrentPath(getParentPath(folderPath));
      }

      if (result.deletedFiles.length > 0) {
        setSelected130FileIds((prev) => {
          const s = new Set(prev);
          result.deletedFiles.forEach((id) => s.delete(id));
          return s;
        });
      }

      if (result.deletedFiles.length > 0) {
        try {
          await removeAssignedFilesFromAllStudents(result.deletedFiles);
        } catch {
          // ignore secondary cleanup failure
        }
      }
      showSnackbarNotification('تم حذف المجلد وكل محتوياته', 'success');
    } catch (error: any) {
      showSnackbarNotification(error.message || 'فشل حذف المجلد', 'error');
    } finally {
      setFolderDeleteLoading(null);
    }
  };

  return (
    <div className="assignments-management-page">
      <AssignmentsHeader
        handleBack={handleBack}
        assignmentsMessage={assignmentsMessage}
      />

      {/* Secondary tabs inside assignments page (same style as admin tabs) */}
      <AssignmentsNavigationTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        setTrackView={setTrackView}
        setOpenedTrack={setOpenedTrack}
      />

      <div className="assignments-content">
        {/* TAB: إدارة التكليفات */}
        {activeTab === 'assignments' && (
          <AssignmentsConfigTab
            assignmentsConfig={assignmentsConfig}
            setAssignmentsConfig={setAssignmentsConfig}
            isSaving={isSaving}
            handleSaveAssignmentsConfig={handleSaveAssignmentsConfig}
            newAssignmentName={newAssignmentName}
            setNewAssignmentName={setNewAssignmentName}
            newAssignmentPrice={newAssignmentPrice}
            setNewAssignmentPrice={setNewAssignmentPrice}
            handleAddAssignment={handleAddAssignment}
            editingAssignmentId={editingAssignmentId}
            editAssignmentName={editAssignmentName}
            setEditAssignmentName={setEditAssignmentName}
            editAssignmentPrice={editAssignmentPrice}
            setEditAssignmentPrice={setEditAssignmentPrice}
            handleSaveEditAssignment={handleSaveEditAssignment}
            handleCancelEditAssignment={handleCancelEditAssignment}
            handleStartEditAssignment={handleStartEditAssignment}
            handleRemoveAssignment={handleRemoveAssignment}
          />
        )}

        {/* TAB: إدارة تكاليف المسارات الدراسية */}
        {activeTab === 'tracks' && (
          <TracksManagementTab
            trackView={trackView}
            setTrackView={setTrackView}
            openedTrack={openedTrack}
            setOpenedTrack={setOpenedTrack}
            setActiveTrackFolder={setActiveTrackFolder}
            trackFiles={trackFiles}
            selectedFileIds={selectedFileIds}
            setSelectedFileIds={setSelectedFileIds}
            uploadProgress={uploadProgress}
            isUploadingAssignments={isUploadingAssignments}
            isDeletingAssignments={isDeletingAssignments}
            animatingDeleteIds={animatingDeleteIds}
            isDistributingAssignments={isDistributingAssignments}
            trackCurrentPath={trackCurrentPath}
            setTrackCurrentPath={setTrackCurrentPath}
            newTrackFolderName={newTrackFolderName}
            setNewTrackFolderName={setNewTrackFolderName}
            setShowTierModal={setShowTierModal}
            folderDeleteLoading={folderDeleteLoading}
            getVisibleTrackFiles={getVisibleTrackFiles}
            getVisibleTrackFolders={getVisibleTrackFolders}
            handleCreateTrackFolder={handleCreateTrackFolder}
            handleDeleteSelected={handleDeleteSelected}
            handleDeleteSingleTrackFile={handleDeleteSingleTrackFile}
            handleDeleteTrackFolder={handleDeleteTrackFolder}
            handleFileUpload={handleFileUpload}
            handleOpenRecallModal={handleOpenRecallModal}
          />
        )}

        {/* TAB: ملفات الـ 130 الموحدة */}
        {activeTab === 'unified130' && (
          <Unified130Tab
            unified130Files={unified130Files}
            unified130CurrentPath={unified130CurrentPath}
            setUnified130CurrentPath={setUnified130CurrentPath}
            newUnified130FolderName={newUnified130FolderName}
            setNewUnified130FolderName={setNewUnified130FolderName}
            isUploading130={isUploading130}
            isDistributing130={isDistributing130}
            selected130FileIds={selected130FileIds}
            setSelected130FileIds={setSelected130FileIds}
            isDeleting130={isDeleting130}
            setDeleteConfirmModal={setDeleteConfirmModal}
            folderDeleteLoading={folderDeleteLoading}
            getVisibleUnified130Files={getVisibleUnified130Files}
            getVisibleUnified130Folders={getVisibleUnified130Folders}
            handle130Delete={handle130Delete}
            handle130Distribute={handle130Distribute}
            handle130FileUpload={handle130FileUpload}
            handleCreateUnified130Folder={handleCreateUnified130Folder}
            handleDeleteUnified130Folder={handleDeleteUnified130Folder}
            handleOpenRecallModal={handleOpenRecallModal}
          />
        )}
      </div>

      {/* Snackbar Notification */}
      <AssignmentsSnackbar
        showSnackbar={showSnackbar}
        snackbarMessage={snackbarMessage}
        snackbarType={snackbarType}
      />

      {/* Paper Plane Animation */}
      {showPaperPlane && (
        <div className="paper-plane-container">
          <div className="paper-plane">✈️</div>
        </div>
      )}

      {/* Tier Selection Modal */}
      <TierSelectionModal
        showTierModal={showTierModal}
        setShowTierModal={setShowTierModal}
        assignmentsConfig={assignmentsConfig}
        handleDistribute={handleDistribute}
      />

      {/* نافذة سحب الملفات الموزعة على الطلاب */}
      {/* نافذة سحب الملفات الموزعة على الطلاب */}
      <RecallModal
        recallModal={recallModal}
        setRecallModal={setRecallModal}
        selectedRecallFileIds={selectedRecallFileIds}
        isAllFilesSelected={isAllFilesSelected}
        isLatestBatchSelected={isLatestBatchSelected}
        latestBatchFiles={latestBatchFiles}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        handleToggleSelectAllFiles={handleToggleSelectAllFiles}
        handleToggleSelectLatestBatch={handleToggleSelectLatestBatch}
        handleToggleSelectFile={handleToggleSelectFile}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        handleRevokeSingleFileFromStudent={handleRevokeSingleFileFromStudent}
      />

      {/* تأكيد سحب ملف واحد */}
      <ConfirmRevokeSingleModal
        confirmRevokeSingle={confirmRevokeSingle}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        handleRevokeSingleFile={handleRevokeSingleFile}
      />

      {/* تأكيد سحب الملفات المحددة */}
      <ConfirmRevokeSelectedModal
        confirmRevokeSelectedOpen={confirmRevokeSelectedOpen}
        selectedRecallFileIds={selectedRecallFileIds}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        handleRevokeSelectedFiles={handleRevokeSelectedFiles}
      />

      {/* تأكيد سحب كافة الملفات للمسار */}
      <ConfirmRevokeAllModal
        confirmRevokeAllOpen={confirmRevokeAllOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        recallModal={recallModal}
        handleRevokeAllFiles={handleRevokeAllFiles}
      />

      {/* تأكيد سحب كافة ملفات طالب واحد */}
      <ConfirmRevokeStudentAllModal
        confirmRevokeStudentAllOpen={confirmRevokeStudentAllOpen}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        recallModal={recallModal}
        handleRevokeAllFilesFromStudent={handleRevokeAllFilesFromStudent}
      />


      {/* شاشة تحميل أثناء السحب الشامل */}
      <RevokeAllLoadingOverlay isRevokingAll={recallModal.isRevokingAll} />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        deleteConfirmModal={deleteConfirmModal}
        setDeleteConfirmModal={setDeleteConfirmModal}
        executeDelete={executeDelete}
        isRemovingFromUsers={isRemovingFromUsers}
      />

      {/* Removing from users and folder delete overlays */}
      <FullscreenLoadingOverlays
        isRemovingFromUsers={isRemovingFromUsers}
        folderDeleteLoading={folderDeleteLoading}
      />

      {/* Floating live progress bar for assignments distribution */}
      <DistributionProgressToast distProgress={distProgress} updateProgress={updateProgress} />
    </div>
  );
};

export default AssignmentsManagementPage;
