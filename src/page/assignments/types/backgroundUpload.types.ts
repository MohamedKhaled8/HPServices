import { TrackKey, AssignmentFolderMeta, AssignmentFileMeta } from '../../../services/firebaseService';
import { FolderUploadGroup } from '../utils/folderHierarchyParser';

export type UploadScope = 'track' | 'unified130';
export type UploadStrategy = 'extract-subfolders' | 'keep-parent';

export interface UploadBatchRequest {
  id: string;
  scope: UploadScope;
  trackId?: TrackKey;
  parentPath?: string;
  groups: FolderUploadGroup[];
  totalFiles: number;
  uploadStrategy?: UploadStrategy;
  parentFolderName?: string;
  parentFolderId?: string | null;
}

export interface QueuedUploadJob {
  jobId: string;
  batchId: string;
  scope: UploadScope;
  targetTrackId?: TrackKey;
  parentPath?: string;
  uploadStrategy: UploadStrategy;
  parentFolderName?: string;
  parentFolderId?: string | null;
  folderName: string;
  files: File[];
  onCompleteCallback?: (folder: AssignmentFolderMeta, files: AssignmentFileMeta[]) => void;
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
  uploadStrategy?: UploadStrategy;
  parentFolderName?: string;
}
