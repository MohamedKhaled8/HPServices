import React from 'react';
import { RotateCcw, X, Clock, Users } from 'lucide-react';
import { DistributedFileSummary } from '../../../../../services/firebaseService';
import { RecallModalState } from '../../../types/assignments.types';
import { RecallByFileTab } from './RecallByFileTab';
import { RecallByStudentTab } from './RecallByStudentTab';

export interface RecallModalProps {
  recallModal: RecallModalState;
  setRecallModal: React.Dispatch<React.SetStateAction<RecallModalState>>;
  selectedRecallFileIds: Set<string>;
  isAllFilesSelected: boolean;
  isLatestBatchSelected: boolean;
  latestBatchFiles: DistributedFileSummary[];
  isRevokingSelected: boolean;
  setConfirmRevokeSelectedOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmRevokeAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmRevokeSingle: React.Dispatch<React.SetStateAction<DistributedFileSummary | null>>;
  handleToggleSelectAllFiles: () => void;
  handleToggleSelectLatestBatch: () => void;
  handleToggleSelectFile: (fileId: string) => void;
  setConfirmRevokeStudentAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleRevokeSingleFileFromStudent: (studentId: string, fileId: string, fileName: string) => Promise<void>;
}

export const RecallModal: React.FC<RecallModalProps> = ({
  recallModal,
  setRecallModal,
  selectedRecallFileIds,
  isAllFilesSelected,
  isLatestBatchSelected,
  latestBatchFiles,
  isRevokingSelected,
  setConfirmRevokeSelectedOpen,
  setConfirmRevokeAllOpen,
  setConfirmRevokeSingle,
  handleToggleSelectAllFiles,
  handleToggleSelectLatestBatch,
  handleToggleSelectFile,
  setConfirmRevokeStudentAllOpen,
  handleRevokeSingleFileFromStudent,
}) => {
  if (!recallModal.open) {
    return null;
  }

  return (
        <div
          className="recall-modal-overlay"
          onClick={() => !recallModal.isRevokingAll && setRecallModal((prev) => ({ ...prev, open: false }))}
        >
          <div className="recall-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recall-modal-header">
              <div className="recall-modal-title-wrap">
                <div className="recall-modal-icon-badge">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3>
                    سحب الملفات الموزعة —{' '}
                    {recallModal.track === 'unified130'
                      ? 'ملفات التربية العملي (130)'
                      : recallModal.track === 'track1'
                      ? 'المسار الأول'
                      : recallModal.track === 'track2'
                      ? 'المسار الثاني'
                      : 'المسار الثالث'}
                  </h3>
                  <span>عرض تاريخ وساعة إرسال كل ملف وسحبه من حسابات الطلاب</span>
                </div>
              </div>
              <button
                type="button"
                className="recall-close-btn"
                disabled={recallModal.isRevokingAll || recallModal.isRevokingStudentAll}
                onClick={() => setRecallModal((prev) => ({ ...prev, open: false }))}
              >
                <X size={18} />
              </button>
            </div>

            {/* التبويبات العلوية */}
            <div className="recall-modal-tabs">
              <button
                type="button"
                className={`recall-tab-btn ${recallModal.tab === 'by_file' ? 'active' : ''}`}
                onClick={() => setRecallModal((prev) => ({ ...prev, tab: 'by_file' }))}
              >
                <Clock size={15} />
                سحب حسب التكليفات الموزعة ({recallModal.files.length})
              </button>
              <button
                type="button"
                className={`recall-tab-btn ${recallModal.tab === 'by_student' ? 'active' : ''}`}
                onClick={() => setRecallModal((prev) => ({ ...prev, tab: 'by_student' }))}
              >
                <Users size={15} />
                سحب من طالب محدد ({recallModal.students.length})
              </button>
            </div>

            {/* محتوى تبويب 1: سحب حسب التكليفات الموزعة (بالتاريخ والساعة) */}
            {recallModal.tab === 'by_file' && (
              <RecallByFileTab
                recallModal={recallModal}
                selectedRecallFileIds={selectedRecallFileIds}
                isAllFilesSelected={isAllFilesSelected}
                isLatestBatchSelected={isLatestBatchSelected}
                latestBatchFiles={latestBatchFiles}
                isRevokingSelected={isRevokingSelected}
                setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
                setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
                setConfirmRevokeSingle={setConfirmRevokeSingle}
                handleToggleSelectAllFiles={handleToggleSelectAllFiles}
                handleToggleSelectLatestBatch={handleToggleSelectLatestBatch}
                handleToggleSelectFile={handleToggleSelectFile}
              />
            )}

            {/* محتوى تبويب 2: سحب من طالب محدد (بحث بالاسم) */}
            {recallModal.tab === 'by_student' && (
              <RecallByStudentTab
                recallModal={recallModal}
                setRecallModal={setRecallModal}
                setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
                handleRevokeSingleFileFromStudent={handleRevokeSingleFileFromStudent}
              />
            )}
          </div>
        </div>
  );
};
