import React, { useDeferredValue } from 'react';
import { Search, Loader2, Copy, EyeOff, Eye, ClipboardList, Edit2, Trash2, CheckSquare, Square } from 'lucide-react';
import { StudentData } from '../../types';

interface AdminUsersTabProps {
  searchTerm: string;
  setSearchTerm: React.Dispatch<React.SetStateAction<string>>;
  filteredAdminStudents: StudentData[];
  usersDirectoryLoading: boolean;
  studentsTotalCount: number | null;
  studentsRestLoading: boolean;
  usersListPage: number;
  setUsersListPage: React.Dispatch<React.SetStateAction<number>>;
  adminUsersTotalPages: number;
  displayedAdminStudents: StudentData[];
  requestCountByStudentId: Map<string, number>;
  toggledFlags: Record<string, { f1: boolean; f2: boolean; f3: boolean }>;
  toggleFlag: (key: string, flagIndex: 1 | 2 | 3) => void;
  showPasswords: Record<string, boolean>;
  setShowPasswords: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setViewingStudentRequests: (student: StudentData | null) => void;
  handleEditStudent: (student: StudentData) => void;
  deleteStudentData: (studentId: string) => Promise<void>;
  showAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  setToastState: React.Dispatch<React.SetStateAction<any>>;
  ADMIN_USERS_PAGE_SIZE: number;
}

const AdminUsersTab: React.FC<AdminUsersTabProps> = ({
  searchTerm,
  setSearchTerm,
  filteredAdminStudents,
  usersDirectoryLoading,
  studentsTotalCount,
  studentsRestLoading,
  usersListPage,
  setUsersListPage,
  adminUsersTotalPages,
  displayedAdminStudents,
  requestCountByStudentId,
  toggledFlags,
  toggleFlag,
  showPasswords,
  setShowPasswords,
  setViewingStudentRequests,
  handleEditStudent,
  deleteStudentData,
  showAlert,
  setToastState,
  ADMIN_USERS_PAGE_SIZE,
}) => {
  return (
    <div className="admin-content">
      <div className="section-header">
        <h2 style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span>إدارة المستخدمين</span>
          {searchTerm.trim() ? (
            <span style={{ color: '#64748b', fontWeight: 700 }}>({filteredAdminStudents.length})</span>
          ) : usersDirectoryLoading && filteredAdminStudents.length === 0 ? (
            <span style={{ color: '#64748b', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '15px' }}>
              <Loader2 size={18} className="spinning-loader-small" style={{ flexShrink: 0, color: '#64748b' }} />
              جاري التحميل
              {typeof studentsTotalCount === 'number' && (
                <span style={{ color: '#94a3b8' }}>({(studentsTotalCount as number).toLocaleString('ar-EG')})</span>
              )}
            </span>
          ) : (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ color: '#64748b', fontWeight: 700 }}>({filteredAdminStudents.length})</span>
              {studentsRestLoading &&
                typeof studentsTotalCount === 'number' &&
                studentsTotalCount > filteredAdminStudents.length && (
                  <span style={{ color: '#94a3b8', fontWeight: 600, fontSize: '0.9em' }}>
                    — {filteredAdminStudents.length.toLocaleString('ar-EG')} / {(studentsTotalCount as number).toLocaleString('ar-EG')}
                  </span>
                )}
            </span>
          )}
        </h2>
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="ابحث عن مستخدم بالإسم أو الرقم القومي أو الهاتف..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="requests-list-container">
        {searchTerm.trim() && filteredAdminStudents.length === 0 ? (
          <div className="no-requests-message">
            <p>لا يوجد مستخدمين يطابقون بحثك</p>
          </div>
        ) : !searchTerm.trim() && !usersDirectoryLoading && filteredAdminStudents.length === 0 ? (
          <div className="no-requests-message">
            <p>لا يوجد مستخدمين مسجلين حالياً</p>
          </div>
        ) : (
          <>
            <div className="pagination-info" style={{ marginBottom: '16px', color: '#64748b', fontSize: '14px', padding: '0 8px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', justifyContent: 'space-between' }}>
              {usersDirectoryLoading && !searchTerm.trim() && filteredAdminStudents.length === 0 ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
                  <Loader2 size={16} strokeWidth={2.2} className="spinning-loader-small" style={{ color: '#64748b', flexShrink: 0 }} />
                  <span>جاري تحميل المستخدمين…</span>
                  {typeof studentsTotalCount === 'number' && (
                    <span style={{ color: '#94a3b8', fontSize: '13px' }}>
                      ({(studentsTotalCount as number).toLocaleString('ar-EG')} في السحابة)
                    </span>
                  )}
                </span>
              ) : (
                <span>
                  إجمالي المستخدمين المعروضين: {filteredAdminStudents.length.toLocaleString('ar-EG')}
                  {typeof studentsTotalCount === 'number' &&
                    studentsRestLoading &&
                    (studentsTotalCount as number) > filteredAdminStudents.length && (
                      <span style={{ color: '#94a3b8', marginRight: '8px', fontSize: '13px' }}>
                        — جاري إكمال القائمة ({filteredAdminStudents.length.toLocaleString('ar-EG')} /{' '}
                        {(studentsTotalCount as number).toLocaleString('ar-EG')})
                      </span>
                    )}
                  {typeof studentsTotalCount === 'number' &&
                    !(studentsRestLoading && (studentsTotalCount as number) > filteredAdminStudents.length) &&
                    (studentsTotalCount as number) !== filteredAdminStudents.length &&
                    !searchTerm.trim() && (
                      <span style={{ color: '#94a3b8', marginRight: '8px', fontSize: '13px' }}>
                        — في السحابة: {(studentsTotalCount as number).toLocaleString('ar-EG')}
                      </span>
                    )}
                  {filteredAdminStudents.length > ADMIN_USERS_PAGE_SIZE && (
                    <span style={{ color: '#94a3b8', fontSize: '13px', marginRight: '8px' }}>
                      — عرض {usersListPage * ADMIN_USERS_PAGE_SIZE + 1}–{Math.min((usersListPage + 1) * ADMIN_USERS_PAGE_SIZE, filteredAdminStudents.length)}
                    </span>
                  )}
                </span>
              )}
              {!(usersDirectoryLoading && !searchTerm.trim() && filteredAdminStudents.length === 0) &&
                filteredAdminStudents.length > ADMIN_USERS_PAGE_SIZE && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={usersListPage <= 0}
                    onClick={() => setUsersListPage(p => Math.max(0, p - 1))}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: usersListPage <= 0 ? '#f1f5f9' : '#fff',
                      cursor: usersListPage <= 0 ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    السابق
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#475569' }}>
                    صفحة {usersListPage + 1} / {adminUsersTotalPages}
                  </span>
                  <button
                    type="button"
                    disabled={usersListPage >= adminUsersTotalPages - 1}
                    onClick={() => setUsersListPage(p => Math.min(adminUsersTotalPages - 1, p + 1))}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: usersListPage >= adminUsersTotalPages - 1 ? '#f1f5f9' : '#fff',
                      cursor: usersListPage >= adminUsersTotalPages - 1 ? 'not-allowed' : 'pointer',
                      fontWeight: 700,
                      fontSize: '13px'
                    }}
                  >
                    التالي
                  </button>
                </span>
              )}
            </div>

            <div className="excel-table-wrapper" style={{
              maxHeight: 'none',
              overflowY: 'visible',
              overflowX: 'auto',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'auto' }}>
                <thead>
                  <tr style={{ background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)', position: 'sticky', top: 0, zIndex: 10 }}>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', width: '50px' }}>#</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', width: '40px' }}>✓</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '180px' }}>الاسم</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '140px' }}>الرقم القومي</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '180px' }}>البريد الإلكتروني</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '120px' }}>رقم الواتساب</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '120px' }}>نوع الدبلومة</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>سنة الدبلومة</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '80px' }}>المسار</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '150px' }}>العنوان</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'right', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>كلمة المرور</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '100px' }}>تاريخ الانضمام</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap', minWidth: '60px' }}>الطلبات</th>
                    <th style={{ padding: '16px 12px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: '800', fontSize: '12px', whiteSpace: 'nowrap' }}>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {usersDirectoryLoading && !searchTerm.trim() && filteredAdminStudents.length === 0
                    ? Array.from({ length: 6 }).map((_, skRow) => (
                        <tr key={`u-sk-${skRow}`} style={{ background: skRow % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
                          {Array.from({ length: 14 }).map((__, skCol) => (
                            <td
                              key={skCol}
                              style={{
                                padding: '14px 10px',
                                border: '1px solid #e2e8f0',
                                verticalAlign: 'middle'
                              }}
                            >
                              <div
                                style={{
                                  height: 10,
                                  width: skCol === 0 ? 20 : skCol < 4 ? '70%' : '45%',
                                  maxWidth: skCol >= 4 ? 120 : undefined,
                                  background: '#e2e8f0',
                                  borderRadius: 5,
                                  margin: skCol >= 3 ? '0 auto' : skCol === 0 ? '0 auto' : undefined
                                }}
                              />
                            </td>
                          ))}
                        </tr>
                      ))
                    : displayedAdminStudents.map((student, index) => {
                    const globalIndex = usersListPage * ADMIN_USERS_PAGE_SIZE + index;
                    const studentRequestCount = requestCountByStudentId.get(student.id || '') ?? 0;
                    const flagKey = `student-${student.id}`;
                    const studentFlags = toggledFlags[flagKey] || { f1: false, f2: false, f3: false };
                    const isFlagged = studentFlags.f1 || studentFlags.f2 || studentFlags.f3;
                    const addressStr = [student.address?.governorate, student.address?.city, student.address?.street].filter(Boolean).join(' - ') || '';

                    return (
                      <tr key={student.id} style={{
                        background: isFlagged ? '#eff6ff' : (globalIndex % 2 === 0 ? '#ffffff' : '#f8fafc'),
                        borderLeft: isFlagged ? '3px solid #2563eb' : 'none',
                        transition: 'background-color 0.2s'
                      }}>
                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center', fontSize: '13px', color: '#64748b', fontWeight: '700' }}>
                          {globalIndex + 1}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <button
                            type="button"
                            onClick={() => toggleFlag(flagKey, 1)}
                            style={{ background: 'none', border: 'none', padding: '0', cursor: 'pointer', color: isFlagged ? '#2563eb' : '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}
                          >
                            {isFlagged ? <CheckSquare size={20} strokeWidth={2.5} /> : <Square size={20} strokeWidth={1.5} />}
                          </button>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '14px', color: '#1e293b', fontWeight: '700', minWidth: '180px' }}>
                          {student.fullNameArabic || 'بدون اسم'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', fontWeight: '600', direction: 'ltr', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {student.nationalID || '-'}
                            {student.nationalID && (
                              <Copy
                                size={14}
                                style={{ cursor: 'pointer', color: '#3b82f6', opacity: 0.6 }}
                                onClick={() => {
                                  navigator.clipboard.writeText(student.nationalID!);
                                  setToastState({ message: 'تم نسخ الرقم القومي', type: 'success', duration: 2000 });
                                }}
                              />
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', direction: 'ltr', textAlign: 'right', maxWidth: '200px', wordBreak: 'break-all' }}>
                          {student.email || '-'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', direction: 'ltr', textAlign: 'right' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'flex-end' }}>
                            {student.whatsappNumber || '-'}
                            {student.whatsappNumber && (
                              <Copy
                                size={14}
                                style={{ cursor: 'pointer', color: '#10b981', opacity: 0.6 }}
                                onClick={() => {
                                  navigator.clipboard.writeText(student.whatsappNumber!);
                                  setToastState({ message: 'تم نسخ رقم الواتساب', type: 'success', duration: 2000 });
                                }}
                              />
                            )}
                          </div>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                          {student.diplomaType || '-'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569', textAlign: 'center' }}>
                          {student.diplomaYear || '-'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                          {student.track || '-'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#475569', maxWidth: '200px' }}>
                          <div style={{ maxHeight: '60px', overflowY: 'auto', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                            {addressStr || '-'}
                          </div>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '13px', color: '#475569' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
                              {showPasswords[student.id || ''] ? (student.password || '-') : '••••••••'}
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowPasswords(prev => ({ ...prev, [student.id || '']: !prev[student.id || ''] }))}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3b82f6', padding: 0, display: 'flex' }}
                            >
                              {showPasswords[student.id || ''] ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', fontSize: '12px', color: '#64748b', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {student.createdAt ? new Date(student.createdAt as any).toLocaleDateString('ar-EG') : '-'}
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                          <span style={{
                            background: studentRequestCount > 0 ? '#dbeafe' : '#f1f5f9',
                            color: studentRequestCount > 0 ? '#1d4ed8' : '#94a3b8',
                            padding: '4px 10px',
                            borderRadius: '12px',
                            fontSize: '13px',
                            fontWeight: '700'
                          }}>
                            {studentRequestCount}
                          </span>
                        </td>

                        <td style={{ padding: '14px 10px', border: '1px solid #e2e8f0', textAlign: 'center', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                            <button
                              onClick={() => setViewingStudentRequests(student)}
                              title="عرض جميع الطلبات"
                              style={{ padding: '8px', background: '#f5f3ff', color: '#6d28d9', border: '1px solid #c4b5fd', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <ClipboardList size={16} />
                            </button>
                            <button
                              onClick={() => handleEditStudent(student)}
                              title="تعديل البيانات"
                              style={{ padding: '8px', background: '#eff6ff', color: '#2563eb', border: '1px solid #93c5fd', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <Edit2 size={16} />
                            </button>
                            <button
                              onClick={async () => {
                                if (!window.confirm("هل أنت متأكد من حذف هذا المشترك نهائياً من المنصة؟")) return;
                                try {
                                  await deleteStudentData(student.id!);
                                  showAlert('نجاح', 'تم حذف المشترك بنجاح', 'success');
                                } catch (error: any) {
                                  showAlert('خطأ', error.message || 'حدث خطأ أثناء الحذف', 'error');
                                }
                              }}
                              title="حذف المشترك"
                              style={{ padding: '8px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: '8px', cursor: 'pointer' }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminUsersTab;
