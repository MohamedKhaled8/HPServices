import React from 'react';
import {
  Search,
  X,
  Loader2,
  ArrowRight,
  UserX,
  CheckCircle,
  FileText,
  Clock,
  RotateCcw,
  User,
} from 'lucide-react';
import { RecallModalState } from '../../../types/assignments.types';

export interface RecallByStudentTabProps {
  recallModal: RecallModalState;
  setRecallModal: React.Dispatch<React.SetStateAction<RecallModalState>>;
  setConfirmRevokeStudentAllOpen: React.Dispatch<React.SetStateAction<boolean>>;
  handleRevokeSingleFileFromStudent: (studentId: string, fileId: string, fileName: string) => Promise<void>;
}

export const RecallByStudentTab: React.FC<RecallByStudentTabProps> = ({
  recallModal,
  setRecallModal,
  setConfirmRevokeStudentAllOpen,
  handleRevokeSingleFileFromStudent,
}) => {
  return (
              <div className="recall-modal-body" style={{ paddingTop: '16px' }}>
                {/* شريط البحث بالاسم أو الهاتف */}
                <div className="recall-student-search-box">
                  <Search size={18} color="#94a3b8" />
                  <input
                    type="text"
                    placeholder="اكتب اسم الطالب أو رقم الهاتف أو الرقم القومي للبحث..."
                    value={recallModal.studentSearchQuery}
                    onChange={(e) =>
                      setRecallModal((prev) => ({
                        ...prev,
                        studentSearchQuery: e.target.value,
                        selectedStudent: null
                      }))
                    }
                  />
                  {recallModal.studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() =>
                        setRecallModal((prev) => ({ ...prev, studentSearchQuery: '', selectedStudent: null }))
                      }
                      style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#94a3b8' }}
                    >
                      <X size={16} />
                    </button>
                  )}
                </div>

                {recallModal.loading ? (
                  <div className="recall-loading-wrap">
                    <Loader2 className="spinning-loader-large" size={36} color="#e11d48" />
                    <p>جاري تحميل قائمة الطلاب وتكليفاتهم...</p>
                  </div>
                ) : recallModal.selectedStudent ? (
                  /* عرض تفاصيل الطالب المحدد وملفاته */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div className="recall-selected-student-header">
                      <div>
                        <button
                          type="button"
                          className="recall-back-link"
                          onClick={() => setRecallModal((prev) => ({ ...prev, selectedStudent: null }))}
                        >
                          <ArrowRight size={14} />
                          رجوع لقائمة الطلاب
                        </button>
                        <h4 style={{ margin: '4px 0 2px', fontSize: '15px', color: '#0f172a' }}>
                          {recallModal.selectedStudent.fullNameArabic}
                        </h4>
                        <span style={{ fontSize: '12px', color: '#64748b' }}>
                          {recallModal.selectedStudent.phone && `هاتف: ${recallModal.selectedStudent.phone} • `}
                          إجمالي الملفات: {recallModal.selectedStudent.assignedFiles.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="recall-all-btn"
                        disabled={
                          recallModal.isRevokingStudentAll ||
                          Boolean(recallModal.revokingStudentFileId) ||
                          recallModal.selectedStudent.assignedFiles.length === 0
                        }
                        onClick={() => setConfirmRevokeStudentAllOpen(true)}
                      >
                        <UserX size={15} />
                        سحب كافة ملفات الطالب
                      </button>
                    </div>

                    {recallModal.selectedStudent.assignedFiles.length === 0 ? (
                      <div className="recall-empty-wrap">
                        <CheckCircle size={36} color="#10b981" />
                        <p style={{ margin: 0, fontSize: '14px' }}>تم سحب كافة الملفات من هذا الطالب بنجاح.</p>
                      </div>
                    ) : (
                      recallModal.selectedStudent.assignedFiles.map((f, idx) => {
                        let dateStr = '';
                        let timeStr = '';
                        try {
                          if (f.assignedAt) {
                            const d = new Date(f.assignedAt);
                            dateStr = d.toLocaleDateString('ar-EG', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric'
                            });
                            timeStr = d.toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                              hour12: true
                            });
                          }
                        } catch {
                          // ignore
                        }

                        return (
                          <div key={f.id || idx} className="recall-file-card">
                            <div className="recall-file-main">
                              <div className="recall-file-icon">
                                <FileText size={20} />
                              </div>
                              <div className="recall-file-details">
                                <span className="recall-file-name" title={f.customName || f.name}>
                                  {f.customName || f.name}
                                </span>
                                {f.customName && f.name && f.customName !== f.name && (
                                  <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    الملف الأصلي: {f.name}
                                  </span>
                                )}
                                {f.assignedAt && (
                                  <div className="recall-file-meta-badges">
                                    <span className="recall-badge time">
                                      <Clock size={12} />
                                      {dateStr} {timeStr ? `— ${timeStr}` : ''}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <button
                              type="button"
                              className="recall-single-btn"
                              disabled={
                                recallModal.isRevokingStudentAll ||
                                recallModal.revokingStudentFileId === f.id
                              }
                              onClick={() =>
                                handleRevokeSingleFileFromStudent(
                                  recallModal.selectedStudent!.id,
                                  f.id,
                                  f.customName || f.name
                                )
                              }
                            >
                              {recallModal.revokingStudentFileId === f.id ? (
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
                ) : (
                  /* عرض قائمة الطلاب مع التصفية */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(() => {
                      const queryText = recallModal.studentSearchQuery.trim().toLowerCase();
                      const filtered = recallModal.students.filter((s) => {
                        if (!queryText) return true;
                        return (
                          s.fullNameArabic.toLowerCase().includes(queryText) ||
                          (s.phone && s.phone.includes(queryText)) ||
                          (s.nationalID && s.nationalID.includes(queryText))
                        );
                      });

                      if (filtered.length === 0) {
                        return (
                          <div className="recall-empty-wrap">
                            <Search size={36} color="#94a3b8" />
                            <h4>لا يوجد طلاب مطابقين للبحث</h4>
                            <p style={{ fontSize: '13px', margin: 0 }}>
                              {queryText
                                ? `لم نجد طالباً يحمل الاسم "${recallModal.studentSearchQuery}" ولديه ملفات مسندة.`
                                : 'لا يوجد طلاب لديهم ملفات مسندة في هذا المسار حالياً.'}
                            </p>
                          </div>
                        );
                      }

                      return filtered.map((s) => (
                        <div
                          key={s.id}
                          className="recall-student-item"
                          onClick={() => setRecallModal((prev) => ({ ...prev, selectedStudent: s }))}
                        >
                          <div className="recall-student-info-main">
                            <div className="recall-student-avatar">
                              <User size={18} />
                            </div>
                            <div className="recall-student-names">
                              <span className="recall-student-name">{s.fullNameArabic}</span>
                              <span className="recall-student-meta">
                                {s.phone && `📱 ${s.phone} `}
                                {s.nationalID && `• بطاقة: ${s.nationalID}`}
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span className="recall-badge students">
                              {s.assignedFiles.length} ملف
                            </span>
                            <span style={{ fontSize: '12px', color: '#e11d48', fontWeight: 700 }}>
                              عرض الملفات ←
                            </span>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
  );
};
