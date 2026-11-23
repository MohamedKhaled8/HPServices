import { TrackKey } from '../../../services/firebaseService';
import { FolderUploadGroup } from '../utils/folderHierarchyParser';

export type UploadScope = 'track' | 'unified130';

export interface UploadBatchRequest {
  id: string;
  scope: UploadScope;
  trackId?: TrackKey;
  parentPath?: string;
  groups: FolderUploadGroup[];
  totalFiles: number;
}

export interface UploadProgressState {
  currentSubfolderIndex: number;
  totalSubfolders: number;
  currentSubfolderName: string;
  currentFileIndex: number;
  totalFilesInSubfolder: number;
  overallProcessedFiles: number;
  totalFiles: number;
}

export interface InterruptedBatchMetadata {
  batchId: string;
  trackId?: string;
  scope: UploadScope;
  totalSubfolders: number;
  completedFolders: string[];
  pendingFolders: string[];
  timestamp: number;
}
