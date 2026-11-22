import React, { useState, useRef, useEffect } from 'react';
import { UploadedFile } from '../types';
import { Upload, CheckCircle, AlertCircle } from 'lucide-react';
import { UploadSnackbar } from './common/UploadSnackbar';
import { isValidFile, checkImageBlankness, getFileType } from './fileUploadValidation';
import { FileUploadList } from './FileUploadList';
import '../styles/FileUpload.css';

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
  key?: string;
  resetTrigger?: number;
  buttonLabel?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFileSize = 10 * 1024 * 1024,
  acceptedFormats = ['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF'],
  resetTrigger,
  buttonLabel = 'حمل اسكرين تحويل المبلغ'
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resetTrigger !== undefined) {
      setUploadedFiles([]);
      setError('');
      setSuccess('');
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onFilesSelected([]);
    }
  }, [resetTrigger, onFilesSelected]);

  const handleFileSelect = async (files: FileList | null) => {
    setError('');
    setSuccess('');
    if (!files) return;

    const filesArray = Array.from(files);
    const validFiles: File[] = [];

    for (const file of filesArray) {
      const validation = isValidFile(file, acceptedFormats, maxFileSize);
      if (!validation.valid) {
        setError(validation.error || 'خطأ في التحقق من الملف');
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
    }

    setIsProcessing(true);

    for (const file of filesArray) {
      const blankCheck = await checkImageBlankness(file);
      if (blankCheck.isBlank) {
        setIsProcessing(false);
        const errorMsg = filesArray.length > 1
          ? `الملف "${file.name}": ${blankCheck.reason}`
          : (blankCheck.reason || 'الصورة غير واضحة، يرجى إعادة التقاط الصورة بوضوح.');
        setError(errorMsg);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
      }
      validFiles.push(file);
    }

    let processedCount = 0;
    const newFiles: UploadedFile[] = [];

    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const uploadedFile: UploadedFile = {
          id: `${Date.now()}_${Math.random()}_${processedCount}`,
          name: file.name,
          size: file.size,
          type: getFileType(file.name),
          url: e.target?.result as string,
          preview: e.target?.result as string,
          file: file
        };

        newFiles.push(uploadedFile);
        processedCount++;

        setUploadedFiles(prev => {
          const updated = [...prev, uploadedFile];
          onFilesSelected(updated);
          return updated;
        });

        if (processedCount === validFiles.length) {
          setIsProcessing(false);
          setSuccess(`تم تحميل ${newFiles.length} صورة بنجاح`);
        }
      };

      reader.onerror = () => {
        processedCount++;
        setIsProcessing(false);
        setError('حدث خطأ أثناء قراءة الملف');
      };

      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      onFilesSelected(updated);
      return updated;
    });
    setSuccess('');
  };

  return (
    <div className="file-upload-container">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,image/bmp,image/gif,image/*"
        onChange={(e) => handleFileSelect(e.target.files)}
        style={{ display: 'none' }}
        disabled={isProcessing}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="upload-simple-button"
        disabled={isProcessing}
      >
        <Upload size={18} />
        <span>{buttonLabel}</span>
      </button>

      <UploadSnackbar
        isVisible={isProcessing}
        variant="Drive"
        label="جاري رفع الصورة..."
      />

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="alert alert-success">
          <CheckCircle size={18} />
          <span>{success}</span>
        </div>
      )}

      <FileUploadList files={uploadedFiles} onRemoveFile={removeFile} />
    </div>
  );
};

export default FileUpload;
