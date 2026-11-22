import React from 'react';
import { RecallModal } from './recall/RecallModal';
import { ConfirmRevokeFolderModal } from './recall/ConfirmRevokeFolderModal';
import { ConfirmRevokeDateModal } from './recall/ConfirmRevokeDateModal';
import { ConfirmRevokeSingleModal } from './recall/ConfirmRevokeSingleModal';
import { ConfirmRevokeSelectedModal } from './recall/ConfirmRevokeSelectedModal';
import { ConfirmRevokeAllModal } from './recall/ConfirmRevokeAllModal';
import { ConfirmRevokeStudentAllModal } from './recall/ConfirmRevokeStudentAllModal';
import { RevokeAllLoadingOverlay } from '../common/RevokeAllLoadingOverlay';

interface RecallModalsGroupProps {
  recallProps: any;
}

export const RecallModalsGroup: React.FC<RecallModalsGroupProps> = ({ recallProps }) => {
  const {
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
    setConfirmRevokeStudentAllOpen,
    confirmRevokeFolder,
    confirmRevokeDateOpen,
    confirmRevokeSingle,
    confirmRevokeSelectedOpen,
    confirmRevokeAllOpen,
    confirmRevokeStudentAllOpen,
    handleToggleSelectAllFiles,
    handleToggleSelectLatestBatch,
    handleToggleSelectFile,
    handleRevokeSingleFileFromStudent,
    handleRevokeFolder,
    handleRevokeAllFoldersForDate,
    handleRevokeSingleFile,
    handleRevokeSelectedFiles,
    handleRevokeAllFiles,
    handleRevokeAllFilesFromStudent,
  } = recallProps;

  return (
    <>
      <RecallModal
        recallModal={recallModal}
        setRecallModal={setRecallModal}
        selectedRecallFileIds={selectedRecallFileIds}
        isAllFilesSelected={isAllFilesSelected}
        isLatestBatchSelected={isLatestBatchSelected}
        latestBatchFiles={latestBatchFiles}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        setConfirmRevokeFolder={setConfirmRevokeFolder}
        setConfirmRevokeDateOpen={setConfirmRevokeDateOpen}
        handleToggleSelectAllFiles={handleToggleSelectAllFiles}
        handleToggleSelectLatestBatch={handleToggleSelectLatestBatch}
        handleToggleSelectFile={handleToggleSelectFile}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        handleRevokeSingleFileFromStudent={handleRevokeSingleFileFromStudent}
      />
      <ConfirmRevokeFolderModal
        confirmRevokeFolder={confirmRevokeFolder}
        setConfirmRevokeFolder={setConfirmRevokeFolder}
        handleRevokeFolder={handleRevokeFolder}
      />
      <ConfirmRevokeDateModal
        confirmRevokeDateOpen={confirmRevokeDateOpen}
        setConfirmRevokeDateOpen={setConfirmRevokeDateOpen}
        dateString={recallModal.selectedDateFilter}
        foldersForDate={recallModal.folders.filter((f: any) => f.dateString === recallModal.selectedDateFilter)}
        handleRevokeAllFoldersForDate={handleRevokeAllFoldersForDate}
        isRevokingDateAll={recallModal.isRevokingDateAll}
      />
      <ConfirmRevokeSingleModal
        confirmRevokeSingle={confirmRevokeSingle}
        setConfirmRevokeSingle={setConfirmRevokeSingle}
        handleRevokeSingleFile={handleRevokeSingleFile}
      />
      <ConfirmRevokeSelectedModal
        confirmRevokeSelectedOpen={confirmRevokeSelectedOpen}
        selectedRecallFileIds={selectedRecallFileIds}
        isRevokingSelected={isRevokingSelected}
        setConfirmRevokeSelectedOpen={setConfirmRevokeSelectedOpen}
        handleRevokeSelectedFiles={handleRevokeSelectedFiles}
      />
      <ConfirmRevokeAllModal
        confirmRevokeAllOpen={confirmRevokeAllOpen}
        setConfirmRevokeAllOpen={setConfirmRevokeAllOpen}
        recallModal={recallModal}
        handleRevokeAllFiles={handleRevokeAllFiles}
      />
      <ConfirmRevokeStudentAllModal
        confirmRevokeStudentAllOpen={confirmRevokeStudentAllOpen}
        setConfirmRevokeStudentAllOpen={setConfirmRevokeStudentAllOpen}
        recallModal={recallModal}
        handleRevokeAllFilesFromStudent={handleRevokeAllFilesFromStudent}
      />
      <RevokeAllLoadingOverlay isRevokingAll={recallModal.isRevokingAll} />
    </>
  );
};
