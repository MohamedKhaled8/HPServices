import React from 'react';
import { X } from 'lucide-react';
import { UploadedFile } from '../types';
import { formatFileSize } from './fileUploadValidation';

interface FileUploadListProps {
  files: UploadedFile[];
  onRemoveFile: (fileId: string) => void;
}

export const FileUploadList: React.FC<FileUploadListProps> = ({ files, onRemoveFile }) => {
  if (files.length === 0) return null;

  return (
    <div className="uploaded-files-simple">
      {files.map((file) => (
        <div key={file.id} className="file-item-simple">
          <div className="file-info-simple">
            <div className="file-icon-simple">IMG</div>
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
              onClick={() => onRemoveFile(file.id)}
              className="remove-button-simple"
              title="حذف"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FileUploadList;
