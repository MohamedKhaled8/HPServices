import React, { useRef } from 'react';
import { FolderUp } from 'lucide-react';

interface UploadFolderButtonProps {
  onFolderSelected: (files: File[]) => void;
  disabled?: boolean;
  isLoading?: boolean;
  progressText?: string;
  className?: string;
}

export const UploadFolderButton: React.FC<UploadFolderButtonProps> = ({
  onFolderSelected,
  disabled = false,
  className = '',
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (fileList && fileList.length > 0) {
      onFolderSelected(Array.from(fileList));
    }
    e.target.value = '';
  };

  return (
    <>
      <input
        type="file"
        ref={inputRef}
        style={{ display: 'none' }}
        // @ts-expect-error webkitdirectory is standard in all modern browsers
        webkitdirectory=""
        directory=""
        multiple
        disabled={disabled}
        onChange={handleChange}
        onClick={(e) => {
          (e.target as HTMLInputElement).value = '';
        }}
      />
      <button
        type="button"
        className={`track-action-btn btn-upload-folder ${className}`}
        onClick={handleClick}
        disabled={disabled}
        title="رفع مجلد كامل بما يحتويه من ملفات وإنشاؤه تلقائياً"
      >
        <FolderUp size={16} />
        <span>رفع فولدر كامل</span>
      </button>
    </>
  );
};
