import React, { useState, useRef } from 'react';
import { UploadedFile } from '../types';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import '../styles/FileUpload.css';

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
  key?: string; // Allow key prop for resetting component
  resetTrigger?: number; // Trigger reset when this changes
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFileSize = 20 * 1024 * 1024, // 20 MB
  acceptedFormats = ['JPEG', 'JPG', 'PNG', 'WEBP', 'HEIC', 'HEIF', 'BMP', 'GIF', 'PDF'],
  resetTrigger
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset component when resetTrigger changes
  React.useEffect(() => {
    if (resetTrigger !== undefined) {
      setUploadedFiles([]);
      setError('');
      setSuccess('');
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      onFilesSelected([]);
    }
  }, [resetTrigger, onFilesSelected]);

  const getFileType = (name: string): string => {
    const ext = name.split('.').pop()?.toUpperCase() || '';
    return ext;
  };

  const isValidFile = (file: File): { valid: boolean; error?: string } => {
    const fileType = getFileType(file.name);
    const acceptedFormatsLower = acceptedFormats.map(f => f.toLowerCase());

    // Security: Validate file type
    if (!acceptedFormatsLower.includes(fileType.toLowerCase())) {
      return {
        valid: false,
        error: `صيغة الملف غير مدعومة. الصيغ المقبولة: ${acceptedFormats.join(', ')}`
      };
    }

    // Security: Validate file size
    if (file.size > maxFileSize) {
      return {
        valid: false,
        error: `حجم الملف أكبر من ${(maxFileSize / (1024 * 1024)).toFixed(0)} ميجابايت`
      };
    }

    // Security: Additional validation - check MIME type
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
      'image/heic', 'image/heif', 'image/bmp', 'image/gif',
      'application/pdf'
    ];
    if (!allowedMimeTypes.includes(file.type)) {
      return {
        valid: false,
        error: `نوع الملف غير مدعوم. يرجى رفع صور (JPEG, PNG) أو ملفات PDF فقط`
      };
    }

    return { valid: true };
  };

  const handleFileSelect = (files: FileList | null) => {
    setError('');
    setSuccess('');

    if (!files) return;

    const filesArray = Array.from(files);
    const validFiles: File[] = [];

    // First, validate all files
    filesArray.forEach((file) => {
      const validation = isValidFile(file);
      if (!validation.valid) {
        setError(validation.error || 'خطأ في التحقق من الملف');
      } else {
        validFiles.push(file);
      }
    });

    if (validFiles.length === 0) {
      return;
    }

    setIsProcessing(true);
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
          url: e.target?.result as string, // base64 for preview
          preview: e.target?.result as string,
          file: file // Store actual file for upload
        };

        newFiles.push(uploadedFile);
        processedCount++;

        // Update state and notify parent with all files (existing + new)
        setUploadedFiles(prev => {
          const updated = [...prev, uploadedFile];
          // Notify parent immediately with updated list
          onFilesSelected(updated);
          return updated;
        });

        // Show success when all files are processed
        if (processedCount === validFiles.length) {
          setIsProcessing(false);
          setSuccess(`تم تحميل ${newFiles.length} ملف(ات) بنجاح`);
        }
      };

      reader.onerror = () => {
        processedCount++;
        setIsProcessing(false);
        setError('حدث خطأ أثناء قراءة الملف');
      };

      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };



  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      // Notify parent immediately with updated list
      onFilesSelected(updated);
      return updated;
    });
    // Clear success message when removing files
    setSuccess('');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="file-upload-container">
      {/* زر رفع الملفات */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={acceptedFormats.map(f => `.${f.toLowerCase()}`).join(',')}
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
        {isProcessing ? (
          <>
            <Loader2 className="spinning-icon" size={18} />
            جاري الرفع...
          </>
        ) : (
          <>
            <Upload size={18} />
            رفع الملفات
          </>
        )}
      </button>

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

      {uploadedFiles.length > 0 && (
        <div className="uploaded-files-simple">
          {uploadedFiles.map((file) => (
            <div key={file.id} className="file-item-simple">
              <div className="file-info-simple">
                <div className="file-icon-simple">
                  {file.type === 'PDF' ? 'PDF' : 'IMG'}
                </div>
                <div className="file-details-simple">
                  <span className="file-name-simple">{file.name}</span>
                  <span className="file-size-simple">{formatFileSize(file.size)}</span>
                </div>
              </div>
              <div className="file-actions-simple">
                <label className="checkbox-label-simple">
                  <input type="checkbox" />
                  <span className="checkbox-custom-simple" />
                </label>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="remove-button-simple"
                  title="حذف"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FileUpload;
