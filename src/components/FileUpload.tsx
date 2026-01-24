import React, { useState, useRef } from 'react';
import { UploadedFile } from '../types';
import { Upload, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import '../styles/FileUpload.css';

interface FileUploadProps {
  onFilesSelected: (files: UploadedFile[]) => void;
  maxFileSize?: number;
  acceptedFormats?: string[];
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  maxFileSize = 5 * 1024 * 1024,
  acceptedFormats = ['JPEG', 'PNG', 'PDF']
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
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

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.id !== fileId);
      // Notify parent immediately with updated list
      onFilesSelected(updated);
      return updated;
    });
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
      {isProcessing && (
        <div className="file-upload-overlay">
          <div className="file-upload-loading">
            <Loader2 className="spinning-loader-large" size={48} />
            <p>جاري معالجة الملفات...</p>
          </div>
        </div>
      )}
      <div className="upload-section">
        <div
          className={`drop-zone ${isProcessing ? 'processing' : ''}`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <Upload size={48} />
          <h3>أضف الصور أو المستندات</h3>
          <p>اسحب الملفات هنا أو انقر لاختيارها</p>
          <span className="file-types">
            صيغ مقبولة: {acceptedFormats.join(', ')} | الحد الأقصى: 5 ميجابايت
          </span>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={acceptedFormats.map(f => `.${f.toLowerCase()}`).join(',')}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="file-input"
            disabled={isProcessing}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="select-button"
            disabled={isProcessing}
          >
            {isProcessing ? 'جاري المعالجة...' : 'اختر الملفات'}
          </button>
        </div>
      </div>

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
        <div className="uploaded-files">
          <h4>الملفات المرفوعة ({uploadedFiles.length})</h4>
          <div className="files-list">
            {uploadedFiles.map((file) => (
              <div key={file.id} className="file-item">
                <div className="file-info">
                  {file.preview && file.type !== 'PDF' ? (
                    <img src={file.preview} alt={file.name} className="file-preview" />
                  ) : (
                    <div className="file-icon">PDF</div>
                  )}
                  <div className="file-details">
                    <span className="file-name">{file.name}</span>
                    <span className="file-size">{formatFileSize(file.size)}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeFile(file.id)}
                  className="remove-button"
                  title="حذف"
                >
                  <X size={18} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
