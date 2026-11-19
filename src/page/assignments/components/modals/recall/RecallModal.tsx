import React from 'react';
import { RotateCcw, X, Clock, Users, FolderSync } from 'lucide-react';
import { DistributedFileSummary, DistributedFolderSummary } from '../../../../../services/firebaseService';
import { RecallModalState } from '../../../types/assignments.types';
import { RecallByFileTab } from './RecallByFileTab';
import { RecallByStudentTab } from './RecallByStudentTab';
import { RecallByFolderTab } from './RecallByFolderTab';

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
  setConfirmRevokeFolder: React.Dispatch<React.SetStateAction<DistributedFolderSummary | null>>;
  setConfirmRevokeDateOpen: React.Dispatch<React.SetStateAction<boolean>>;
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
  setConfirmRevokeFolder,
  setConfirmRevokeDateOpen,
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
          onClick={() => !recallModal.isRevokingAll && !recallModal.isRevokingDateAll && setRecallModal((prev) => ({ ...prev, open: false }))}
        >
          <div className="recall-modal" onClick={(e) => e.stopPropagation()}>
            <div className="recall-modal-header">
              <div className="recall-modal-title-wrap">
                <div className="recall-modal-icon-badge">
                  <RotateCcw size={20} />
                </div>
                <div>
                  <h3>
                    سحب الملفات والمجلدات الموزعة —{' '}
                    {recallModal.track === 'unified130'
                      ? 'ملفات التربية العملي (130)'
                      : recallModal.track === 'track1'
                      ? 'المسار الأول'
                      : recallModal.track === 'track2'
                      ? 'المسار الثاني'
                      : 'المسار الثالث'}
                  </h3>
                  <span>عرض تاريخ وساعة إرسال كل مجلد وملف وسحبه من حسابات الطلاب</span>
                </div>
              </div>
              <button
                type="button"
                className="recall-close-btn"
                disabled={recallModal.isRevokingAll || recallModal.isRevokingStudentAll || recallModal.isRevokingDateAll}
                onClick={() => setRecallModal((prev) => ({ ...prev, open: false }))}
              >
                <X size={18} />
              </button>
            </div>

            {/* التبويبات العلوية */}
            <div className="recall-modal-tabs">
              <button
                type="button"
                className={`recall-tab-btn ${recallModal.tab === 'by_folder' ? 'active' : ''}`}
                onClick={() => setRecallModal((prev) => ({ ...prev, tab: 'by_folder' }))}
              >
                <FolderSync size={16} />
                <span>المجلدات والتواريخ ({recallModal.folders?.length || 0})</span>
              </button>
              <button
                type="button"
                className={`recall-tab-btn ${recallModal.tab === 'by_file' ? 'active' : ''}`}
                onClick={() => setRecallModal((prev) => ({ ...prev, tab: 'by_file' }))}
              >
                <Clock size={16} />
                <span>التكليفات الفردية ({recallModal.files.length})</span>
              </button>
              <button
                type="button"
                className={`recall-tab-btn ${recallModal.tab === 'by_student' ? 'active' : ''}`}
                onClick={() => setRecallModal((prev) => ({ ...prev, tab: 'by_student' }))}
              >
                <Users size={16} />
                <span>حسب الطالب ({recallModal.students.length})</span>
              </button>
            </div>

            {/* محتوى تبويب 1: سحب حسب المجلدات والتواريخ (سحب فولدر كامل بتاريخ معين) */}
            {recallModal.tab === 'by_folder' && (
              <RecallByFolderTab
                recallModal={recallModal}
                setRecallModal={setRecallModal}
                setConfirmRevokeFolder={setConfirmRevokeFolder}
                setConfirmRevokeDateOpen={setConfirmRevokeDateOpen}
              />
            )}

            {/* محتوى تبويب 2: سحب حسب التكليفات الفردية (بالتاريخ والساعة) */}
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

            {/* محتوى تبويب 3: سحب من طالب محدد (بحث بالاسم) */}
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
