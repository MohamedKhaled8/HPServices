import { useState } from 'react';
import {
  TrackKey,
  ServiceTier,
  DistributeTargetOptions,
  distributeAssignmentsForTrack,
  distribute130UnifiedFiles,
} from '../../../services/firebaseService';
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
}: UseAssignmentsDistributionOptions) => {
  const [showTierModal, setShowTierModal] = useState(false);
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

  const updateProgress = (info: DistributionProgressInfo | null) => {
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

  return {
    showTierModal,
    setShowTierModal,
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
