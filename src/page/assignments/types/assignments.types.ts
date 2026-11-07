// Extracted from src/page/AssignmentsManagementPage.tsx (Lines 63-65)
export interface AssignmentsManagementPageProps {
  onBack: () => void;
}

import { TrackKey, DistributedFileSummary, StudentWithAssignedFiles } from '../../../services/firebaseService';

// Extracted from src/page/AssignmentsManagementPage.tsx (Lines 217-223)
export interface DeleteConfirmModalState {
  open: boolean;
  fileIds: string[];
  source: 'track' | 'unified130' | 'single-track';
  track?: TrackKey;
  singleFileId?: string;
}

// Extracted from src/page/AssignmentsManagementPage.tsx (Lines 240-251)
export interface RecallModalState {
  open: boolean;
  track: TrackKey | 'unified130';
  tab: 'by_file' | 'by_student';
  loading: boolean;
  files: DistributedFileSummary[];
  students: StudentWithAssignedFiles[];
  selectedStudent: StudentWithAssignedFiles | null;
  studentSearchQuery: string;
  revokingId: string | null;
  isRevokingAll: boolean;
  revokingStudentFileId: string | null;
  isRevokingStudentAll: boolean;
}
