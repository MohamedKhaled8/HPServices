import { useEffect } from 'react';
import {
  TrackKey,
  uploadAssignmentFilesForTrack,
  getCurrentUser,
} from '../../../services/firebaseService';

interface UseTrackFilesOptions {
  trackFiles: Record<TrackKey, any[]>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  uploadProgress: Record<TrackKey, { current: number; total: number }>;
  setUploadProgress: React.Dispatch<React.SetStateAction<Record<TrackKey, { current: number; total: number }>>>;
  isUploadingAssignments: Record<TrackKey, boolean>;
  setIsUploadingAssignments: React.Dispatch<React.SetStateAction<Record<TrackKey, boolean>>>;
  trackCurrentPath: Record<TrackKey, string>;
  setAssignmentsMessage: (msg: string | null) => void;
}

export const useTrackFiles = ({
  trackFiles,
  setTrackFiles,
  uploadProgress,
  setUploadProgress,
  isUploadingAssignments,
  setIsUploadingAssignments,
  trackCurrentPath,
  setAssignmentsMessage,
}: UseTrackFilesOptions) => {
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

  const getVisibleTrackFiles = (track: TrackKey) => {
    const current = trackCurrentPath[track] || '';
    return (trackFiles[track] || []).filter((f) => (f.folderPath || '') === current);
  };

  return {
    handleFileUpload,
    getVisibleTrackFiles,
  };
};
