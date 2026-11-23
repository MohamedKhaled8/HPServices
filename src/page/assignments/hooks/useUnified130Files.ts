import {
  upload130UnifiedFile,
  getCurrentUser,
} from '../../../services/firebaseService';

interface UseUnified130FilesOptions {
  unified130Files: any[];
  setUnified130Files: React.Dispatch<React.SetStateAction<any[]>>;
  isUploading130: boolean;
  setIsUploading130: React.Dispatch<React.SetStateAction<boolean>>;
  unified130CurrentPath: string;
  showSnackbarNotification: (message: string, type?: 'success' | 'error') => void;
}

export const useUnified130Files = ({
  unified130Files,
  setUnified130Files,
  isUploading130,
  setIsUploading130,
  unified130CurrentPath,
  showSnackbarNotification,
}: UseUnified130FilesOptions) => {
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

  const getVisibleUnified130Files = () => {
    const current = (unified130CurrentPath || '').trim().replace(/^\/+|\/+$/g, '');
    return (unified130Files || []).filter((f) => {
      const fp = String(f.folderPath || f.folder || '').trim().replace(/^\/+|\/+$/g, '');
      return fp === current;
    });
  };

  return {
    handle130FileUpload,
    getVisibleUnified130Files,
  };
};
