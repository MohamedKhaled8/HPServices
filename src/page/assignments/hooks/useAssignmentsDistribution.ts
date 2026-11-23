import { useState, useRef } from 'react';
import {
  TrackKey,
  ServiceTier,
  DistributeTargetOptions,
  distributeAssignmentsForTrack,
  distribute130UnifiedFiles,
} from '../../../services/firebaseService';
import { DistributionReport } from '../../../types';
import { DistributionProgressInfo } from '../components/common/DistributionProgressToast';

interface UseAssignmentsDistributionOptions {
  openedTrack: TrackKey | null;
  activeTrackFolder: TrackKey;
  selectedFileIds: Record<TrackKey, Set<string>>;
  setSelectedFileIds: React.Dispatch<React.SetStateAction<Record<TrackKey, Set<string>>>>;
  selected130FileIds: Set<string>;
  setSelected130FileIds: React.Dispatch<React.SetStateAction<Set<string>>>;
  getVisibleTrackFiles: (track: TrackKey) => any[];
  getVisibleUnified130Files: () => any[];
  setAssignmentsMessage: (msg: string | null) => void;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
  trackCurrentPath?: Record<TrackKey, string>;
  unified130CurrentPath?: string;
  trackFiles?: Record<TrackKey, any[]>;
  unified130Files?: any[];
}

export const useAssignmentsDistribution = ({
  openedTrack,
  activeTrackFolder,
  selectedFileIds,
  setSelectedFileIds,
  selected130FileIds,
  setSelected130FileIds,
  getVisibleTrackFiles,
  getVisibleUnified130Files,
  setAssignmentsMessage,
  showSnackbarNotification,
  trackCurrentPath,
  unified130CurrentPath,
  trackFiles,
  unified130Files,
}: UseAssignmentsDistributionOptions) => {
  const [showTierModal, setShowTierModal] = useState(false);
  const [distributionReport, setDistributionReport] = useState<DistributionReport | null>(null);
  const [isDistributingAssignments, setIsDistributingAssignments] = useState(false);
  const [isDistributing130, setIsDistributing130] = useState(false);
  const [showPaperPlane, setShowPaperPlane] = useState(false);

  // Persistent distribution progress state (survives tab switching and navigation)
  const [distProgress, setDistProgress] = useState<DistributionProgressInfo | null>(() => {
    try {
      const raw = localStorage.getItem('hp_assignment_dist_progress_v1');
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (parsed && Date.now() - (parsed.updatedAt || 0) < 15 * 60 * 1000) {
        return parsed;
      }
      localStorage.removeItem('hp_assignment_dist_progress_v1');
      return null;
    } catch {
      return null;
    }
  });

  const lastProgressUpdateRef = useRef<number>(0);

  const updateProgress = (info: DistributionProgressInfo | null, force: boolean = false) => {
    const now = Date.now();
    const isTerminal = !info || info.status === 'completed' || info.status === 'error';

    // كبح التحديثات المتتالية (Throttling) لتفادي تجميد المتصفح والقرص
    if (!force && !isTerminal && now - lastProgressUpdateRef.current < 120) {
      return;
    }
    lastProgressUpdateRef.current = now;

    setDistProgress(info);
    try {
      if (info) {
        localStorage.setItem('hp_assignment_dist_progress_v1', JSON.stringify(info));
      } else {
        localStorage.removeItem('hp_assignment_dist_progress_v1');
      }
    } catch {
      // storage unavailable / quota exceeded
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
      let ids: string[] = [];
      if (selectedIds.length > 0) {
        ids = selectedIds;
      } else {
        const curPath = (trackCurrentPath?.[targetTrack] || '').trim().replace(/^\/+|\/+$/g, '');
        if (curPath && trackFiles?.[targetTrack]) {
          const prefix = `${curPath}/`;
          ids = trackFiles[targetTrack]
            .filter((f: any) => {
              const fp = String(f.folderPath || f.folder || '').trim().replace(/^\/+|\/+$/g, '');
              return fp === curPath || fp.startsWith(prefix);
            })
            .map((f: any) => f.id);
        } else {
          ids = getVisibleTrackFiles(targetTrack).map((f: any) => f.id);
        }
      }

      if (ids.length === 0) {
        showSnackbarNotification('المجلد المحدد فارغ ولا يحتوي على ملفات للتوزيع', 'error');
        setIsDistributingAssignments(false);
        return;
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
      }, true);

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
      if (result.report) {
        setDistributionReport(result.report);
      }

      updateProgress({
        active: true,
        status: 'completed',
        title: `${tierLabel} — ${trackName}`,
        current: result.sent,
        total: result.total,
        percent: 100,
        updatedAt: Date.now()
      }, true);

      if (result.sent === 0) {
        showSnackbarNotification(`كافة الطلاب المستهدفين (${result.total} طالب) استلموا هذه التكليفات مسبقاً (لا توجد نواقص للإرسال)`, 'success');
      } else {
        const newCount = result.report?.newStudentsCount || 0;
        const oldComp = result.report?.completedOldStudentsCount || 0;
        const details = [
          newCount > 0 ? `${newCount} طالب جديد` : '',
          oldComp > 0 ? `${oldComp} استكملوا النواقص` : ''
        ].filter(Boolean).join('، ');
        const detailsStr = details ? ` (${details})` : '';
        showSnackbarNotification(`تم إرسال التكليفات لـ ${tierLabel} بنجاح (${result.sent} تكليف تم توزيعه)${detailsStr}`, 'success');
      }

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
      }, true);
      showSnackbarNotification(error.message || 'حدث خطأ أثناء توزيع الملفات', 'error');
    } finally {
      setIsDistributingAssignments(false);
    }
  };

  const handle130Distribute = async () => {
    const label = 'ملفات موحدة (التربية العملي)';
    try {
      setIsDistributing130(true);
      setShowPaperPlane(true);
      setTimeout(() => setShowPaperPlane(false), 1500);

      const selectedIds = Array.from(selected130FileIds);
      let ids: string[] = [];
      if (selectedIds.length > 0) {
        ids = selectedIds;
      } else {
        const curPath = (unified130CurrentPath || '').trim().replace(/^\/+|\/+$/g, '');
        if (curPath && unified130Files) {
          const prefix = `${curPath}/`;
          ids = unified130Files
            .filter((f: any) => {
              const fp = String(f.folderPath || f.folder || '').trim().replace(/^\/+|\/+$/g, '');
              return fp === curPath || fp.startsWith(prefix);
            })
            .map((f: any) => f.id);
        } else {
          ids = getVisibleUnified130Files().map((f: any) => f.id);
        }
      }

      if (ids.length === 0) {
        showSnackbarNotification('المجلد المحدد فارغ ولا يحتوي على ملفات للتوزيع', 'error');
        setIsDistributing130(false);
        return;
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
      }, true);

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
      }, true);

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
      }, true);
      showSnackbarNotification(error.message || 'حدث خطأ أثناء التوزيع', 'error');
    } finally {
      setIsDistributing130(false);
    }
  };

  const currentTargetTrack = openedTrack || activeTrackFolder;
  const currentSelectedIds = Array.from(selectedFileIds[currentTargetTrack] || []);
  const currentVisibleFiles = getVisibleTrackFiles(currentTargetTrack);
  const selectedFilesCount = currentSelectedIds.length > 0 ? currentSelectedIds.length : currentVisibleFiles.length;

  return {
    showTierModal,
    setShowTierModal,
    distributionReport,
    setDistributionReport,
    selectedFilesCount,
    isDistributingAssignments,
    setIsDistributingAssignments,
    isDistributing130,
    setIsDistributing130,
    showPaperPlane,
    setShowPaperPlane,
    distProgress,
    setDistProgress,
    updateProgress,
    handleDistribute,
    handle130Distribute,
  };
};
