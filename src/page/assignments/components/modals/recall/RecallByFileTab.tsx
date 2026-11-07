import React from 'react';
import {
  FileText,
  Check,
  Clock,
  Loader2,
  RotateCcw,
  Trash2,
  CheckCircle,
  Users,
} from 'lucide-react';
import { DistributedFileSummary } from '../../../../../services/firebaseService';
import { RecallModalState } from '../../../types/assignments.types';

export interface RecallByFileTabProps {
  recallModal: RecallModalState;
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
}

export const RecallByFileTab: React.FC<RecallByFileTabProps> = ({
  recallModal,
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
}) => {
  return (
    <>
                <div className="recall-top-bar">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <div className="recall-stats-badge">
                      <FileText size={15} />
                      <span>الملفات المسندة حالياً: {recallModal.files.length}</span>
                    </div>

                    {recallModal.files.length > 0 && (
                      <>
                        <button
                          type="button"
                          className={`recall-quick-btn ${isAllFilesSelected ? 'active' : ''}`}
                          onClick={handleToggleSelectAllFiles}
                          title="تحديد كل الملفات المعروضة"
                        >
                          <Check size={14} />
                          {isAllFilesSelected ? 'إلغاء تحديد الكل' : `تحديد الكل (${recallModal.files.length})`}
                        </button>

                        {latestBatchFiles.length > 0 && latestBatchFiles.length < recallModal.files.length && (
                          <button
                            type="button"
                            className={`recall-quick-btn ${isLatestBatchSelected ? 'active' : ''}`}
                            onClick={handleToggleSelectLatestBatch}
                            title="تحديد الملفات التي تم إرسالها في آخر عملية توزيع"
                          >
                            <Clock size={14} />
                            {isLatestBatchSelected
                              ? 'إلغاء تحديد آخر دفعة'
                              : `تحديد آخر دفعة أُرسلت (${latestBatchFiles.length} ملف)`}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    {selectedRecallFileIds.size > 0 && (
                      <button
                        type="button"
                        className="recall-selected-batch-btn"
                        disabled={recallModal.loading || isRevokingSelected || Boolean(recallModal.revokingId)}
                        onClick={() => setConfirmRevokeSelectedOpen(true)}
                      >
                        {isRevokingSelected ? (
                          <>
                            <Loader2 size={15} className="spinning-loader-small" />
                            جاري السحب...
                          </>
                        ) : (
                          <>
                            <RotateCcw size={15} />
                            سحب الملفات المحددة ({selectedRecallFileIds.size})
                          </>
                        )}
                      </button>
                    )}

                    <button
                      type="button"
                      className="recall-all-btn"
                      disabled={
                        recallModal.loading ||
                        recallModal.files.length === 0 ||
                        recallModal.isRevokingAll ||
                        Boolean(recallModal.revokingId) ||
                        isRevokingSelected
                      }
                      onClick={() => setConfirmRevokeAllOpen(true)}
                    >
                      <Trash2 size={15} />
                      سحب كل ملفات المسار
                    </button>
                  </div>
                </div>

                <div className="recall-modal-body">
                  {recallModal.loading ? (
                    <div className="recall-loading-wrap">
                      <Loader2 className="spinning-loader-large" size={36} color="#e11d48" />
                      <p>جاري فحص الملفات الموزعة على الطلاب في هذا المسار...</p>
                    </div>
                  ) : recallModal.files.length === 0 ? (
                    <div className="recall-empty-wrap">
                      <CheckCircle size={44} color="#10b981" />
                      <h4>لا توجد ملفات موزعة على طلاب هذا المسار حالياً</h4>
                      <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
                        عند إرسال تكليفات للطلاب ستظهر هنا مع تواريخ وساعات الإرسال مع إمكانية سحبها بأي وقت.
                      </p>
                    </div>
                  ) : (
                    recallModal.files.map((item) => {
                      const isSelected = selectedRecallFileIds.has(item.fileId);
                      return (
                        <div
                          key={item.fileId}
                          className={`recall-file-card ${isSelected ? 'selected' : ''}`}
                          onClick={() => handleToggleSelectFile(item.fileId)}
                        >
                          <div className="recall-file-main">
                            <label
                              className="recall-checkbox-label"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleToggleSelectFile(item.fileId)}
                              />
                              <span className="checkbox-custom" />
                            </label>

                            <div className="recall-file-icon">
                              <FileText size={20} />
                            </div>
                            <div className="recall-file-details">
                              <span className="recall-file-name" title={item.fileName}>
                                {item.fileName}
                              </span>
                              <div className="recall-file-meta-badges">
                                <span className="recall-badge time" title="تاريخ ووقت الإرسال">
                                  <Clock size={12} />
                                  {item.formattedDate} — الساعة {item.formattedTime}
                                </span>
                                <span className="recall-badge students" title="عدد الطلاب المستلمين">
                                  <Users size={12} />
                                  {item.studentCount} طالب
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="recall-single-btn"
                            disabled={Boolean(recallModal.revokingId) || recallModal.isRevokingAll || isRevokingSelected}
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmRevokeSingle(item);
                            }}
                          >
                            {recallModal.revokingId === item.fileId ? (
                              <>
                                <Loader2 size={14} className="spinning-loader-small" />
                                جاري السحب...
                              </>
                            ) : (
                              <>
                                <RotateCcw size={14} />
                                سحب الملف
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
    </>
  );
};
