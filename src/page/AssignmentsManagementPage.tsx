import React, { useState, useEffect } from 'react';

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
  upload130UnifiedFile,
  get130UnifiedFiles,
  create130UnifiedFolder,
  get130UnifiedFolders,
  deleteAssignmentFolderForTrack,
  delete130UnifiedFolder,
  delete130UnifiedFiles,
  distribute130UnifiedFiles,
  removeAssignedFilesFromAllStudents,
  AssignmentFolderMeta
} from '../services/firebaseService';
import { AssignmentsServiceConfig, AssignmentItem } from '../types';
import { normalizeInstaPay } from '../utils/validation';
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
  Trash2
} from 'lucide-react';
import '../styles/AssignmentsManagementPage.css';

interface AssignmentsManagementPageProps {
  onBack: () => void;
}

const AssignmentsManagementPage: React.FC<AssignmentsManagementPageProps> = ({ onBack }) => {
  const TRACK_FOLDERS_CACHE_KEY = 'assignments_track_folders_cache_v1';
  const UNIFIED130_FOLDERS_CACHE_KEY = 'assignments_unified130_folders_cache_v1';


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

  const readCachedTrackFolders = (): Record<TrackKey, AssignmentFolderMeta[]> => {
    try {
      const raw = localStorage.getItem(TRACK_FOLDERS_CACHE_KEY);
      if (!raw) return { track1: [], track2: [], track3: [] };
      const parsed = JSON.parse(raw) as Record<TrackKey, AssignmentFolderMeta[]>;
      return {
        track1: Array.isArray(parsed?.track1) ? parsed.track1 : [],
        track2: Array.isArray(parsed?.track2) ? parsed.track2 : [],
        track3: Array.isArray(parsed?.track3) ? parsed.track3 : []
      };
    } catch {
      return { track1: [], track2: [], track3: [] };
    }
  };

  const writeCachedTrackFolders = (folders: Record<TrackKey, AssignmentFolderMeta[]>) => {
    try {
      localStorage.setItem(TRACK_FOLDERS_CACHE_KEY, JSON.stringify(folders));
    } catch {
      // ignore localStorage quota/private mode
    }
  };

  const readCachedUnified130Folders = (): AssignmentFolderMeta[] => {
    try {
      const raw = localStorage.getItem(UNIFIED130_FOLDERS_CACHE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw) as AssignmentFolderMeta[];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };

  const writeCachedUnified130Folders = (folders: AssignmentFolderMeta[]) => {
    try {
      localStorage.setItem(UNIFIED130_FOLDERS_CACHE_KEY, JSON.stringify(folders));
    } catch {
      // ignore localStorage quota/private mode
    }
  };

  const mergeFoldersByPath = (a: AssignmentFolderMeta[], b: AssignmentFolderMeta[]) => {
    const map = new Map<string, AssignmentFolderMeta>();
    [...a, ...b].forEach((f) => {
      if (!f?.path) return;
      map.set(f.path, f);
    });
    return Array.from(map.values());
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
          if (config.paymentMethods?.instaPay) {
            config.paymentMethods = { ...config.paymentMethods, instaPay: normalizeInstaPay(config.paymentMethods.instaPay) };
          }
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

  const handleAddAssignment = () => {
    if (!newAssignmentName || !newAssignmentPrice || !assignmentsConfig) return;
    const price = parseFloat(newAssignmentPrice);
    if (isNaN(price) || price <= 0) {
      setAssignmentsMessage('يرجى إدخال سعر صحيح');
      return;
    }
    const newAssignment: AssignmentItem = {
      id: `assignment_${Date.now()}`,
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

  const handleRemoveAssignment = (id: string) => {
    if (!assignmentsConfig) return;
    setAssignmentsConfig({
      ...assignmentsConfig,
      assignments: assignmentsConfig.assignments.filter(a => a.id !== id)
    });
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

  const handleDistribute = async (tier: ServiceTier) => {
    try {
      setShowTierModal(false);
      setAssignmentsMessage(null);
      setIsDistributingAssignments(true);

      // Show paper plane animation
      setShowPaperPlane(true);
      setTimeout(() => setShowPaperPlane(false), 1500);

      const targetTrack = openedTrack || activeTrackFolder;
      const selectedIds = Array.from(selectedFileIds[targetTrack] || []);
      const visibleIds = getVisibleTrackFiles(targetTrack).map((f: any) => f.id);
      const ids = selectedIds.length > 0 ? selectedIds : visibleIds;
      if (ids.length === 0) {
        throw new Error('لا توجد ملفات داخل المجلد الحالي للإرسال');
      }
      await distributeAssignmentsForTrack(targetTrack, ids, tier);

      const tierLabel = tier === '500' ? 'مشتركي الـ 500 (حل وتسليم)' : 'مشتركي الـ 300 (حل فقط)';
      showSnackbarNotification(`تم إرسال ${ids.length} ملف لـ ${tierLabel} بنجاح`, 'success');

      // Clear selection
      setSelectedFileIds(prev => ({
        ...prev,
        [targetTrack]: new Set()
      }));
    } catch (error: any) {
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
      await distribute130UnifiedFiles(ids.length > 0 ? ids : undefined);
      showSnackbarNotification('تم إرسال الملفات الموحدة لمشتركي الـ 130 بنجاح', 'success');
      setSelected130FileIds(new Set());
    } catch (error: any) {
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

  const getPathParts = (path: string): string[] => String(path || '').split('/').filter(Boolean);
  const getParentPath = (path: string): string => {
    const parts = getPathParts(path);
    parts.pop();
    return parts.join('/');
  };
  const getPathLastName = (path: string): string => {
    const parts = getPathParts(path);
    return parts[parts.length - 1] || '';
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
      <div className="title-header">
        <h1>إعدادات خدمة التكليفات</h1>
      </div>

      <div className="assignments-header">
        <button onClick={handleBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
      </div>

      {assignmentsMessage && (
        <div
          className={`assignments-message ${assignmentsMessage.includes('نجاح') ? 'success' : 'error'
            }`}
        >
          {assignmentsMessage.includes('نجاح') ? (
            <CheckCircle size={18} />
          ) : (
            <AlertCircle size={18} />
          )}
          <span>{assignmentsMessage}</span>
        </div>
      )}

      {/* Secondary tabs inside assignments page (same style as admin tabs) */}
      <div className="assignments-inner-tabs">
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'assignments' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('assignments');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة التكليفات
        </button>
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'unified130' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('unified130');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          ملفات الـ 130 (موحد)
        </button>
        <button
          type="button"
          className={`tab-button inner-tab ${activeTab === 'tracks' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('tracks');
            setTrackView('overview');
            setOpenedTrack(null);
          }}
        >
          إدارة تكاليف المسارات الدراسية
        </button>
      </div>

      <div className="assignments-content">
        {/* TAB: إدارة التكليفات */}
        {activeTab === 'assignments' && (
          <div className="assignments-config-section">
            <div className="section-header">
              <h2>إعدادات خدمة التكليفات</h2>
              <button
                type="button"
                onClick={handleSaveAssignmentsConfig}
                className="save-button"
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>

            <div className="assignments-config-form">
              {/* 1. إعدادات الخدمة والدفع */}
              <div className="config-section-block">
                <h3 className="block-title">بيانات الخدمة والدفع</h3>
                <div className="form-group">
                  <label>اسم الخدمة</label>
                  <input
                    type="text"
                    placeholder="مثال: خدمة حل التكليفات"
                    value={assignmentsConfig.serviceName}
                    onChange={e =>
                      setAssignmentsConfig({
                        ...assignmentsConfig,
                        serviceName: e.target.value
                      })
                    }
                  />
                </div>

                <div className="payment-methods-grid">
                  <div className="form-group">
                    <label>رقم InstaPay</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.instaPay}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            instaPay: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>رقم المحفظة النقدية</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.cashWallet}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            cashWallet: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="section-divider"></div>

              {/* 2. إدارة التكليفات */}
              <div className="config-section-block">
                <h3 className="block-title">إدارة التكليفات المتاحة</h3>

                <div className="assignments-management-area">
                  <div className="add-assignment-section">
                    <label className="sub-label">إضافة تكليف جديد</label>
                    <div className="add-assignment-form">
                      <input
                        type="text"
                        placeholder="اسم التكليف الجديد"
                        value={newAssignmentName}
                        onChange={e => setNewAssignmentName(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="السعر"
                        value={newAssignmentPrice}
                        onChange={e => setNewAssignmentPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddAssignment}
                        className="add-button"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  <div className="assignments-list-wrapper">
                    <label className="sub-label">قائمة التكليفات</label>
                    <div className="assignments-list-container">
                      <div className="assignments-list-header">
                        <div>اسم التكليف</div>
                        <div>السعر (ج.م)</div>
                        <div style={{ textAlign: 'center' }}>حذف</div>
                      </div>

                      <div className="assignments-list">
                        {assignmentsConfig.assignments.length === 0 ? (
                          <div className="no-assignments-message">
                            <p>لا توجد تكليفات مضافة حتى الآن</p>
                          </div>
                        ) : (
                          assignmentsConfig.assignments.map(assignment => (
                            <div key={assignment.id} className="assignment-item">
                              <div className="assignment-info">
                                <span className="assignment-name">{assignment.name}</span>
                                <span className="assignment-price">
                                  {assignment.price}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveAssignment(assignment.id)}
                                className="remove-assignment-button"
                                title="حذف التكليف"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB: إدارة تكاليف المسارات الدراسية */}
        {activeTab === 'tracks' && (
          <div className="track-folders-section">
            {trackView === 'overview' && (
              <>
                <div className="section-header">
                  <h2>اختر المسار لتوزيع ملفات التكاليف</h2>
                </div>

                <div className="track-folders-grid">
                  {(
                    [
                      { key: 'track1', label: 'المسار الأول' },
                      { key: 'track2', label: 'المسار الثاني' },
                      { key: 'track3', label: 'المسار الثالث' }
                    ] as { key: TrackKey; label: string }[]
                  ).map((track, index) => (
                    <button
                      key={track.key}
                      type="button"
                      className={`track-folder track-folder-${index + 1}`}
                      onClick={() => {
                        setActiveTrackFolder(track.key);
                        setOpenedTrack(track.key);
                        setTrackView('details');
                      }}
                    >
                      <div className="folder-icon-wrapper">
                        <Folder size={32} />
                      </div>
                      <div className="folder-label">{track.label}</div>
                      <div className="folder-count">
                        {trackFiles[track.key]?.length || 0} ملف
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}

            {trackView === 'details' && openedTrack && (
              <div className="track-files-panel">
                {(() => {
                  const visibleFiles = getVisibleTrackFiles(openedTrack);
                  const visibleFolders = getVisibleTrackFolders(openedTrack);
                  const currentPath = trackCurrentPath[openedTrack] || '';
                  return (
                    <>
                <div className="track-files-header">
                  <div className="track-header-main">
                    <button
                      type="button"
                      className="back-to-tracks-button"
                      onClick={() => {
                        setTrackView('overview');
                        setOpenedTrack(null);
                      }}
                    >
                      <ArrowRight size={16} />
                      جميع المسارات
                    </button>
                    <h3>
                      {openedTrack === 'track1' && 'ملفات المسار الأول'}
                      {openedTrack === 'track2' && 'ملفات المسار الثاني'}
                      {openedTrack === 'track3' && 'ملفات المسار الثالث'}
                    </h3>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        className="back-to-tracks-button"
                        onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: '' }))}
                        disabled={!currentPath}
                      >
                        الجذر
                      </button>
                      {getPathParts(currentPath).map((part, idx, arr) => {
                        const full = arr.slice(0, idx + 1).join('/');
                        return (
                          <button
                            key={full}
                            type="button"
                            className="back-to-tracks-button"
                            onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: full }))}
                          >
                            {part}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="track-files-actions">
                    {/* زر الرفع المباشر المخفي */}
                    <input
                      type="file"
                      id={`upload-input-${openedTrack}`}
                      style={{ display: 'none' }}
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
                      disabled={isUploadingAssignments[openedTrack]}
                      onChange={(e) => {
                        if (e.target.files && e.target.files.length > 0) {
                          handleFileUpload(openedTrack, Array.from(e.target.files));
                          e.target.value = ''; // Reset input
                        }
                      }}
                    />

                    {/* زر الرفع الظاهر */}
                    <button
                      type="button"
                      className="add-costs-button"
                      onClick={() => document.getElementById(`upload-input-${openedTrack}`)?.click()}
                      disabled={isUploadingAssignments[openedTrack]}
                    >
                      {isUploadingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">
                            جاري الرفع...
                            {uploadProgress[openedTrack]?.total > 0 && ` (${uploadProgress[openedTrack].current}/${uploadProgress[openedTrack].total})`}
                          </span>
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          رفع ملفات
                        </>
                      )}
                    </button>
                    <input
                      type="text"
                      value={newTrackFolderName}
                      onChange={(e) => setNewTrackFolderName(e.target.value)}
                      placeholder="اسم مجلد جديد"
                      style={{ minWidth: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                    />
                    <button
                      type="button"
                      className="add-costs-button"
                      onClick={() => handleCreateTrackFolder(openedTrack)}
                    >
                      <Folder size={16} />
                      إنشاء مجلد
                    </button>

                    <button
                      type="button"
                      className="send-button"
                      disabled={isDistributingAssignments || (selectedFileIds[openedTrack]?.size === 0 && visibleFiles.length === 0)}
                      onClick={() => setShowTierModal(true)}
                    >
                      {isDistributingAssignments ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">جاري التوزيع...</span>
                        </>
                      ) : (
                        <>
                          <Send size={16} />
                          إرسال للطلاب
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="delete-button"
                      disabled={
                        isDeletingAssignments[openedTrack] ||
                        !selectedFileIds[openedTrack] ||
                        selectedFileIds[openedTrack].size === 0
                      }
                      onClick={() => handleDeleteSelected(openedTrack)}
                    >
                      {isDeletingAssignments[openedTrack] ? (
                        <>
                          <Loader2 className="spinning-loader-small" size={16} />
                          <span className="uploading-text">جاري المسح...</span>
                        </>
                      ) : (
                        <>
                          <Trash2 size={16} />
                          مسح المحدد
                        </>
                      )}
                    </button>
                  </div>
                </div>

                <div className="track-files-body">
                  <div className="files-table-wrapper">
                    {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
                      <div className="no-items-message">
                        لا توجد عناصر داخل هذا المجلد بعد
                      </div>
                    ) : (
                      <table className="files-table">
                        <thead>
                          <tr>
                            <th style={{ width: '50px' }}>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={
                                    visibleFiles.length > 0 &&
                                    visibleFiles.every((f: any) => selectedFileIds[openedTrack]?.has(f.id))
                                  }
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      const allIds = new Set(selectedFileIds[openedTrack] || []);
                                      visibleFiles.forEach((f: any) => allIds.add(f.id));
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: allIds }));
                                    } else {
                                      const allIds = new Set(selectedFileIds[openedTrack] || []);
                                      visibleFiles.forEach((f: any) => allIds.delete(f.id));
                                      setSelectedFileIds(prev => ({ ...prev, [openedTrack]: allIds }));
                                    }
                                  }}
                                />
                                <span className="checkbox-custom" />
                              </label>
                            </th>
                            <th>اسم الملف</th>
                            <th>الإجراءات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {visibleFolders.map((folder) => {
                            const deletingThis =
                              !!folderDeleteLoading &&
                              folderDeleteLoading.scope === 'track' &&
                              folderDeleteLoading.track === openedTrack &&
                              folderDeleteLoading.folderPath === folder.path;
                            return (
                            <tr key={`folder-${folder.id}`}>
                              <td />
                              <td>
                                <button
                                  type="button"
                                  disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                  onClick={() => setTrackCurrentPath((prev) => ({ ...prev, [openedTrack]: folder.path }))}
                                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
                                >
                                  📁 {folder.name}
                                </button>
                              </td>
                              <td>
                                <button
                                  className="icon-button delete"
                                  disabled={!!folderDeleteLoading || isDeletingAssignments[openedTrack]}
                                  onClick={() => handleDeleteTrackFolder(openedTrack, folder.path)}
                                  title="حذف المجلد"
                                >
                                  {deletingThis ? (
                                    <Loader2 size={16} className="spinning-loader-small" />
                                  ) : (
                                    <X size={16} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          );
                          })}
                          {visibleFiles.map((file: any) => {
                            const isSelected = selectedFileIds[openedTrack]?.has(file.id);
                            const isAnimatingDelete = animatingDeleteIds[openedTrack]?.has(file.id);
                            return (
                              <tr key={file.id} className={`${isSelected ? 'selected-row' : ''} ${isAnimatingDelete ? 'deleting-row' : ''}`}>
                                <td>
                                  <label className="checkbox-label">
                                    <input
                                      type="checkbox"
                                      checked={isSelected || false}
                                      disabled={isDeletingAssignments[openedTrack]}
                                      onChange={() => {
                                        setSelectedFileIds(prev => {
                                          const currentSet = new Set(prev[openedTrack] || []);
                                          if (currentSet.has(file.id)) {
                                            currentSet.delete(file.id);
                                          } else {
                                            currentSet.add(file.id);
                                          }
                                          return { ...prev, [openedTrack]: currentSet };
                                        });
                                      }}
                                    />
                                    <span className="checkbox-custom" />
                                  </label>
                                </td>
                                <td>
                                  <div className="file-info-cell">
                                    <div className={`file-icon-simple ${file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'img'}`}>
                                      {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
                                    </div>
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="file-link-simple"
                                    >
                                      {file.name}
                                    </a>
                                  </div>
                                </td>
                                <td>
                                  <button
                                    className="icon-button delete"
                                    disabled={isDeletingAssignments[openedTrack]}
                                    onClick={() => handleDeleteSingleTrackFile(openedTrack, file.id)}
                                    title="حذف الملف"
                                  >
                                    {animatingDeleteIds[openedTrack]?.has(file.id) ? (
                                      <Loader2 size={16} className="spinning-loader-small" />
                                    ) : (
                                      <X size={16} />
                                    )}
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* TAB: ملفات الـ 130 الموحدة */}
        {activeTab === 'unified130' && (
          <div className="track-files-panel">
            {(() => {
              const visibleFiles = getVisibleUnified130Files();
              const visibleFolders = getVisibleUnified130Folders();
              const currentPath = unified130CurrentPath || '';
              return (
                <>
            <div className="track-files-header">
              <div className="track-header-main">
                <h3>ملفات خدمة الـ 130 جنيه (ملف موحد للكل)</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    className="back-to-tracks-button"
                    onClick={() => setUnified130CurrentPath('')}
                    disabled={!currentPath}
                  >
                    الجذر
                  </button>
                  {getPathParts(currentPath).map((part, idx, arr) => {
                    const full = arr.slice(0, idx + 1).join('/');
                    return (
                      <button
                        key={full}
                        type="button"
                        className="back-to-tracks-button"
                        onClick={() => setUnified130CurrentPath(full)}
                      >
                        {part}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="track-files-actions">
                <input
                  type="file"
                  id="upload-input-130"
                  style={{ display: 'none' }}
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif,.bmp,.gif"
                  disabled={isUploading130}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handle130FileUpload(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
                <button
                  type="button"
                  className="add-costs-button"
                  onClick={() => document.getElementById('upload-input-130')?.click()}
                  disabled={isUploading130}
                >
                  {isUploading130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري الرفع...</>
                  ) : (
                    <><Upload size={16} /> رفع ملف</>
                  )}
                </button>
                <input
                  type="text"
                  value={newUnified130FolderName}
                  onChange={(e) => setNewUnified130FolderName(e.target.value)}
                  placeholder="اسم مجلد جديد"
                  style={{ minWidth: 170, padding: '8px 10px', borderRadius: 8, border: '1px solid #cbd5e1' }}
                />
                <button
                  type="button"
                  className="add-costs-button"
                  onClick={handleCreateUnified130Folder}
                >
                  <Folder size={16} />
                  إنشاء مجلد
                </button>
                <button
                  type="button"
                  className="send-button"
                  disabled={isDistributing130 || (selected130FileIds.size === 0 && visibleFiles.length === 0)}
                  onClick={handle130Distribute}
                >
                  {isDistributing130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري التوزيع...</>
                  ) : (
                    <><Send size={16} /> إرسال لمشتركي الـ 130</>
                  )}
                </button>
                <button
                  type="button"
                  className="delete-button"
                  disabled={isDeleting130 || selected130FileIds.size === 0}
                  onClick={handle130Delete}
                >
                  {isDeleting130 ? (
                    <><Loader2 className="spinning-loader-small" size={16} /> جاري المسح...</>
                  ) : (
                    <><Trash2 size={16} /> مسح المحدد</>
                  )}
                </button>
              </div>
            </div>
            <div className="track-files-body">
              <div className="files-table-wrapper">
                {visibleFolders.length === 0 && visibleFiles.length === 0 ? (
                  <div className="no-items-message">
                    لا توجد عناصر داخل هذا المجلد بعد. الملفات المرفوعة هنا ستُرسل لجميع مشتركي خدمة الـ 130 جنيه.
                  </div>
                ) : (
                  <table className="files-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>
                          <label className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={visibleFiles.length > 0 && visibleFiles.every((f: any) => selected130FileIds.has(f.id))}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelected130FileIds(prev => {
                                    const s = new Set(prev);
                                    visibleFiles.forEach((f: any) => s.add(f.id));
                                    return s;
                                  });
                                } else {
                                  setSelected130FileIds(prev => {
                                    const s = new Set(prev);
                                    visibleFiles.forEach((f: any) => s.delete(f.id));
                                    return s;
                                  });
                                }
                              }}
                            />
                            <span className="checkbox-custom" />
                          </label>
                        </th>
                        <th>اسم الملف</th>
                        <th>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleFolders.map((folder) => {
                        const deletingThis =
                          !!folderDeleteLoading &&
                          folderDeleteLoading.scope === 'unified130' &&
                          folderDeleteLoading.folderPath === folder.path;
                        return (
                        <tr key={`folder-130-${folder.id}`}>
                          <td />
                          <td>
                            <button
                              type="button"
                              disabled={!!folderDeleteLoading || isDeleting130}
                              onClick={() => setUnified130CurrentPath(folder.path)}
                              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb', fontWeight: 700 }}
                            >
                              📁 {folder.name}
                            </button>
                          </td>
                          <td>
                            <button
                              className="icon-button delete"
                              disabled={!!folderDeleteLoading || isDeleting130}
                              onClick={() => handleDeleteUnified130Folder(folder.path)}
                              title="حذف المجلد"
                            >
                              {deletingThis ? (
                                <Loader2 size={16} className="spinning-loader-small" />
                              ) : (
                                <X size={16} />
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                      })}
                      {visibleFiles.map((file: any) => {
                        const isSelected = selected130FileIds.has(file.id);
                        return (
                          <tr key={file.id} className={isSelected ? 'selected-row' : ''}>
                            <td>
                              <label className="checkbox-label">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => {
                                    setSelected130FileIds(prev => {
                                      const s = new Set(prev);
                                      if (s.has(file.id)) s.delete(file.id);
                                      else s.add(file.id);
                                      return s;
                                    });
                                  }}
                                />
                                <span className="checkbox-custom" />
                              </label>
                            </td>
                            <td>
                              <div className="file-info-cell">
                                <div className={`file-icon-simple ${file.name.toLowerCase().endsWith('.pdf') ? 'pdf' : 'img'}`}>
                                  {file.name.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMG'}
                                </div>
                                <a href={file.url} target="_blank" rel="noreferrer" className="file-link-simple">{file.name}</a>
                              </div>
                            </td>
                            <td>
                              <button
                                className="icon-button delete"
                                onClick={() => {
                                  setDeleteConfirmModal({ open: true, fileIds: [file.id], source: 'unified130' });
                                }}
                                title="حذف الملف"
                              >
                                <X size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Snackbar Notification */}
      {showSnackbar && (
        <div className={`snackbar ${snackbarType}`}>
          {snackbarType === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <span>{snackbarMessage}</span>
        </div>
      )}

      {/* Paper Plane Animation */}
      {showPaperPlane && (
        <div className="paper-plane-container">
          <div className="paper-plane">✈️</div>
        </div>
      )}

      {/* Tier Selection Modal */}
      {showTierModal && (
        <div className="tier-modal-overlay" onClick={() => setShowTierModal(false)}>
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <h3>اختر نوع الخدمة للتوزيع</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>
              سيتم إرسال الملفات المحددة للطلاب المشتركين في الخدمة المختارة فقط
            </p>
            <div className="tier-modal-buttons">
              <button
                className="tier-button tier-500"
                onClick={() => handleDistribute('500')}
              >
                <strong>500 جنيه — حل وتسليم</strong>
                <span>الملف باسم الطالب + اسم الملف</span>
              </button>
              <button
                className="tier-button tier-300"
                onClick={() => handleDistribute('300')}
              >
                <strong>300 جنيه — حل فقط</strong>
                <span>الملف باسم الملف فقط</span>
              </button>
            </div>
            <button className="tier-cancel" onClick={() => setShowTierModal(false)}>
              إلغاء
            </button>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteConfirmModal.open && (
        <div className="delete-confirm-overlay" onClick={() => setDeleteConfirmModal(prev => ({ ...prev, open: false }))}>
          <div className="delete-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="delete-confirm-icon">
              <Trash2 size={32} />
            </div>
            <h3>تأكيد الحذف</h3>
            <p className="delete-confirm-count">
              سيتم حذف <strong>{deleteConfirmModal.fileIds.length}</strong> ملف
              {deleteConfirmModal.source === 'unified130' ? ' من ملفات الـ 130 الموحدة' : ' من ملفات المسار'}
            </p>
            <p className="delete-confirm-question">
              هل تريد أيضاً حذف هذه الملفات من حسابات جميع الطلاب؟
            </p>

            <div className="delete-confirm-buttons">
              <button
                className="delete-btn-both"
                onClick={() => executeDelete(true)}
                disabled={isRemovingFromUsers}
              >
                <Trash2 size={18} />
                <div>
                  <strong>حذف من الكل</strong>
                  <span>حذف الملفات + إزالتها من حسابات الطلاب</span>
                </div>
              </button>

              <button
                className="delete-btn-server-only"
                onClick={() => executeDelete(false)}
                disabled={isRemovingFromUsers}
              >
                <X size={18} />
                <div>
                  <strong>حذف من السيرفر فقط</strong>
                  <span>حذف الملفات بدون إزالتها من حسابات الطلاب</span>
                </div>
              </button>
            </div>

            <button
              className="delete-btn-cancel"
              onClick={() => setDeleteConfirmModal(prev => ({ ...prev, open: false }))}
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Removing from users loading overlay */}
      {isRemovingFromUsers && (
        <div className="removing-users-overlay">
          <div className="removing-users-content">
            <Loader2 size={40} className="spinning-loader-large" />
            <p>جاري حذف الملفات من حسابات الطلاب...</p>
            <span>يرجى الانتظار وعدم إغلاق الصفحة</span>
          </div>
        </div>
      )}

      {folderDeleteLoading && (
        <div className="removing-users-overlay">
          <div className="removing-users-content">
            <Loader2 size={40} className="spinning-loader-large" />
            <p>
              جاري حذف المجلد{' '}
              <strong dir="ltr">{getPathLastName(folderDeleteLoading.folderPath) || folderDeleteLoading.folderPath}</strong>
              {folderDeleteLoading.scope === 'track' ? ' وكل محتوياته من المسار...' : ' وكل محتوياته من الـ 130...'}
            </p>
            <span>يرجى الانتظار — قد يستغرق ذلك بضع ثوانٍ</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignmentsManagementPage;
