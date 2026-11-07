// Extracted from src/page/AssignmentsManagementPage.tsx (Lines 63-65)
export interface AssignmentsManagementPageProps {
  onBack: () => void;
}

import { TrackKey } from '../../../services/firebaseService';

// Extracted from src/page/AssignmentsManagementPage.tsx (Lines 217-223)
export interface DeleteConfirmModalState {
  open: boolean;
  fileIds: string[];
  source: 'track' | 'unified130' | 'single-track';
  track?: TrackKey;
  singleFileId?: string;
}
