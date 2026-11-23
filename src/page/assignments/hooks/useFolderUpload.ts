import {
  TrackKey,
  AssignmentFolderMeta,
  createAssignmentFolderForTrack,
  create130UnifiedFolder,
  uploadAssignmentFilesForTrack,
  upload130UnifiedFile,
  getCurrentUser,
} from '../../../services/firebaseService';
import { getGoogleDriveAccessToken } from '../../../services/googleDriveService';
import { mergeFoldersByPath } from '../utils/folderUtils';
import { writeCachedTrackFolders, writeCachedUnified130Folders } from '../storage/assignmentsCache';

interface UseFolderUploadOptions {
  trackCurrentPath: Record<TrackKey, string>;
  setTrackFolders: React.Dispatch<React.SetStateAction<Record<TrackKey, AssignmentFolderMeta[]>>>;
  setTrackFiles: React.Dispatch<React.SetStateAction<Record<TrackKey, any[]>>>;
  setIsUploadingAssignments: React.Dispatch<React.SetStateAction<Record<TrackKey, boolean>>>;
  setUploadProgress: React.Dispatch<React.SetStateAction<Record<TrackKey, { current: number; total: number }>>>;
  unified130CurrentPath?: string;
  setUnified130Folders?: React.Dispatch<React.SetStateAction<AssignmentFolderMeta[]>>;
  setUnified130Files?: React.Dispatch<React.SetStateAction<any[]>>;
  setIsUploading130?: React.Dispatch<React.SetStateAction<boolean>>;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useFolderUpload = ({
  trackCurrentPath,
  setTrackFolders,
  setTrackFiles,
  setIsUploadingAssignments,
  setUploadProgress,
  unified130CurrentPath = '',
  setUnified130Folders,
  setUnified130Files,
  setIsUploading130,
  showSnackbarNotification,
}: UseFolderUploadOptions) => {
  const uploadConfirmedFolderForTrack = async (
    track: TrackKey,
    folderName: string,
    validFiles: File[]
  ): Promise<boolean> => {
    const user = getCurrentUser();
    if (!user) {
      showSnackbarNotification('يجب تسجيل الدخول كمسؤول لرفع المجلدات', 'error');
      return false;
    }

    const parentPath = trackCurrentPath[track] || '';
    const safe = folderName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';
    const targetPath = parentPath ? `${parentPath}/${safe}` : safe;

    try {
      setIsUploadingAssignments((prev) => ({ ...prev, [track]: true }));
      setUploadProgress((prev) => ({ ...prev, [track]: { current: 0, total: validFiles.length } }));

      // 1. Verify Drive token first
      await getGoogleDriveAccessToken();

      // 2. Upload files first
      const uploadedFiles = await uploadAssignmentFilesForTrack(
        track,
        validFiles,
        user.uid,
        targetPath,
        (current, total) => {
          setUploadProgress((prev) => ({ ...prev, [track]: { current, total } }));
        }
      );

      if (!uploadedFiles || uploadedFiles.length === 0) {
        throw new Error('لم يتم رفع أي ملف إلى Google Drive');
      }

      // 3. Create folder doc only after upload succeeds
      let createdFolder: AssignmentFolderMeta;
      try {
        createdFolder = await createAssignmentFolderForTrack(track, folderName, parentPath, {
          totalFilesCount: uploadedFiles.length,
        });
      } catch {
        createdFolder = {
          id: `local_${Date.now()}`,
          name: safe,
          path: targetPath,
          parentPath,
          totalFilesCount: uploadedFiles.length,
        };
      }

      setTrackFolders((prev) => {
        const next = { ...prev, [track]: mergeFoldersByPath(prev[track] || [], [createdFolder]) };
        writeCachedTrackFolders(next);
        return next;
      });

      setTrackFiles((prev) => ({ ...prev, [track]: [...(prev[tr(track)] || []), ...uploadedFiles] }));

      showSnackbarNotification(
        `تم رفع المجلد "${createdFolder.name}" بنجاح بـ (${uploadedFiles.length}) ملف`,
        'success'
      );
      return true;
    } catch (error: any) {
      showSnackbarNotification(error.message || 'حدث خطأ أثناء رفع المجلد', 'error');
      return false;
    } finally {
      setIsUploadingAssignments((prev) => ({ ...prev, [track]: false }));
    }
  };

  const tr = (track: TrackKey) => track;

  const uploadConfirmedFolderFor130 = async (
    folderName: string,
    validFiles: File[]
  ): Promise<boolean> => {
    const user = getCurrentUser();
    if (!user) {
      showSnackbarNotification('يجب تسجيل الدخول كمسؤول لرفع المجلدات', 'error');
      return false;
    }

    const safe = folderName.replace(/[\\/:*?"<>|]/g, '_').trim() || 'مجلد جديد';
    const targetPath = unified130CurrentPath ? `${unified130CurrentPath}/${safe}` : safe;

    try {
      setIsUploading130?.(true);
      await getGoogleDriveAccessToken();

      const uploadedFiles: any[] = [];
      for (const file of validFiles) {
        const uploaded = await upload130UnifiedFile(file, user.uid, targetPath);
        uploadedFiles.push(uploaded);
      }

      if (uploadedFiles.length === 0) throw new Error('لم يتم رفع أي ملف إلى Google Drive');

      let createdFolder: AssignmentFolderMeta;
      try {
        createdFolder = await create130UnifiedFolder(folderName, unified130CurrentPath, {
          totalFilesCount: uploadedFiles.length,
        });
      } catch {
        createdFolder = {
          id: `local_${Date.now()}`,
          name: safe,
          path: targetPath,
          parentPath: unified130CurrentPath,
          totalFilesCount: uploadedFiles.length,
        };
      }

      setUnified130Folders?.((prev) => {
        const next = mergeFoldersByPath(prev, [createdFolder]);
        writeCachedUnified130Folders(next);
        return next;
      });

      setUnified130Files?.((prev) => [...prev, ...uploadedFiles]);

      showSnackbarNotification(
        `تم رفع المجلد "${createdFolder.name}" بنجاح بـ (${uploadedFiles.length}) ملف`,
        'success'
      );
      return true;
    } catch (error: any) {
      showSnackbarNotification(error.message || 'حدث خطأ أثناء رفع المجلد الموحد', 'error');
      return false;
    } finally {
      setIsUploading130?.(false);
    }
  };

  return {
    uploadConfirmedFolderForTrack,
    uploadConfirmedFolderFor130,
    handleUploadFullFolderForTrack: uploadConfirmedFolderForTrack,
    handleUploadFullFolderFor130: uploadConfirmedFolderFor130,
    handleFolderUploadForTrack: uploadConfirmedFolderForTrack,
    handleFolderUploadFor130: uploadConfirmedFolderFor130,
  };
};
