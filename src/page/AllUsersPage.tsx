import React, { useCallback, useEffect, useMemo, useState, useTransition, useDeferredValue } from 'react';
import { StudentData } from '../types';
import { subscribeToAllStudents, updateStudentData, deleteStudentData } from '../services/firebaseService';
import { ArrowRight, Eye, EyeOff, RefreshCw, Search, Trash2 } from 'lucide-react';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { List } from 'react-window';
import '../styles/AllUsersPage.css';

interface AllUsersPageProps {
  onBack: () => void;
}

const AllUsersPage: React.FC<AllUsersPageProps> = ({ onBack }) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingStudent, setEditingStudent] = useState<StudentData | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const deferredSearch = useDeferredValue(searchTerm);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllStudents((allStudents) => {
      // Avoid blocking UI thread on big snapshots
      startTransition(() => {
        setStudents(allStudents);
      });
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const togglePasswordVisibility = useCallback((studentId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  }, []);

  const handleEditPassword = useCallback((student: StudentData) => {
    setEditingStudent(student);
    setNewPassword(student.password || '');
  }, []);

  const handleSavePassword = useCallback(async (studentId: string) => {
    if (!newPassword.trim()) {
      alert('الرجاء إدخال كلمة مرور صالحة');
      return;
    }

    try {
      setIsUpdating(true);
      // Directly call updateStudentData since subscribeToAllStudents is just the listener function
      await updateStudentData(studentId, { password: newPassword });
      setEditingStudent(null);
      alert('تم تحديث كلمة المرور بنجاح');
    } catch (error: any) {
      alert('حدث خطأ أثناء التحديث: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  }, [newPassword]);

  const handleDeleteSubscriber = useCallback(async (studentId: string) => {
    if (!window.confirm("هل أنت متأكد من حذف هذا المشترك نهائياً من المنصة؟")) return;
    try {
      setIsUpdating(true);
      await deleteStudentData(studentId);
      alert('تم حذف المشترك بنجاح');
    } catch (error: any) {
      alert('حدث خطأ أثناء الحذف: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  }, []);

  const filteredStudents = useMemo(() => {
    const t = deferredSearch.trim();
    if (!t) return students;
    const searchLower = t.toLowerCase();
    return students.filter(student => (
      student.fullNameArabic?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower) ||
      student.whatsappNumber?.includes(t) ||
      student.id?.toLowerCase().includes(searchLower) ||
      student.nationalID?.includes(t)
    ));
  }, [students, deferredSearch]);

  const formatDate = useCallback((dateString?: string) => {
    if (!dateString) return 'غير متاح';
    try {
      return new Date(dateString).toLocaleString('ar-EG', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  }, []);

  const Row = useCallback(({ index, style, data }: { index: number; style: React.CSSProperties; data: any }) => {
    const { items } = data as { items: StudentData[] };
    const student = items[index];
    const id = student.id || '';
    const isPasswordVisible = !!showPasswords[id];

    return (
      <div style={style}>
        <div className="user-card" style={{ margin: '0 0 16px 0' }}>
          <div className="user-card-header">
            <div className="user-avatar">
              {student.fullNameArabic?.charAt(0) || 'U'}
            </div>
            <div className="user-name">
              <h3>{student.fullNameArabic || 'بدون اسم'}</h3>
              <p className="user-email">{student.email}</p>
            </div>
          </div>

          <div className="user-details">
            <div className="detail-row id-row">
              <span className="detail-label">ID:</span>
              <span className="detail-value">{student.id}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">Vehicle Name:</span>
              <span className="detail-value">{student.vehicleNameEnglish || 'غير متاح'}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">رقم الواتس:</span>
              <span className="detail-value">{student.whatsappNumber || 'غير متاح'}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">رقم الهوية:</span>
              <span className="detail-value">{student.nationalID || 'غير متاح'}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">التخصص:</span>
              <span className="detail-value">{student.track || 'غير متاح'}</span>
            </div>

            <div className="detail-row">
              <span className="detail-label">المقرر:</span>
              <span className="detail-value">{student.course || 'غير متاح'}</span>
            </div>

            <div className="detail-row password-row">
              <div style={{ width: '100%' }}>
                <div className="password-display" style={{ justifyContent: 'space-between' }}>
                  <span className="detail-label">كلمة المرور:</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="detail-value password-value">
                      {isPasswordVisible ? (student.password || 'غير متاح') : '••••••••'}
                    </span>
                    <button
                      type="button"
                      onClick={() => togglePasswordVisibility(id)}
                      className="toggle-password-btn"
                      title={isPasswordVisible ? 'إخفاء' : 'إظهار'}
                    >
                      {isPasswordVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                    <button
                      onClick={() => handleEditPassword(student)}
                      className="edit-password-btn"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => handleDeleteSubscriber(id)}
                      className="delete-btn"
                      disabled={isUpdating}
                      style={{ background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px', marginLeft: '5px' }}
                      title="حذف المشترك"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="detail-row">
              <span className="detail-label">تاريخ التسجيل:</span>
              <span className="detail-value">{formatDate(student.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }, [formatDate, handleDeleteSubscriber, handleEditPassword, isUpdating, showPasswords, togglePasswordVisibility]);

  if (isLoading) {
    return (
      <div className="all-users-page">
        <div className="loading-container">
          <RefreshCw className="spinning" size={32} />
          <p>جاري تحميل البيانات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="all-users-page">
      <div className="users-header">
        <button onClick={onBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
        <h1>جميع المستخدمين المسجلين</h1>
        <div className="header-info">
          <span className="count-badge">إجمالي المستخدمين: {students.length}</span>
        </div>
      </div>

      <div className="users-controls">
        <div className="search-box">
          <div className="search-input-wrapper">
            <Search className="search-icon" size={18} />
            <input
              type="text"
              placeholder="ابحث بالاسم، البريد الإلكتروني، رقم الواتس، أو رقم الهوية..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
              aria-label="بحث المستخدمين"
            />
          </div>
        </div>
      </div>

      <div className="users-container">
        {filteredStudents.length === 0 ? (
          <div className="empty-state">
            <p>{searchTerm ? 'لم يتم العثور على نتائج' : 'لا يوجد مستخدمين مسجلين بعد'}</p>
          </div>
        ) : (
          <div style={{ height: 'calc(100vh - 220px)' }}>
            <AutoSizer>
              {({ height, width }) => (
                <List
                  height={height}
                  width={width}
                  itemCount={filteredStudents.length}
                  // Fixed height keeps virtualization fast; editing is done via modal now
                  itemSize={360}
                  itemData={{ items: filteredStudents }}
                  overscanCount={6}
                >
                  {Row}
                </List>
              )}
            </AutoSizer>
          </div>
        )}
      </div>

      {/* Password edit modal (keeps list rows fixed-size & fast) */}
      {editingStudent && (
        <div
          className="tier-modal-overlay"
          onClick={() => !isUpdating && setEditingStudent(null)}
          style={{ zIndex: 9999 }}
        >
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <h3>تعديل كلمة المرور</h3>
            <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '12px' }}>
              {editingStudent.fullNameArabic || editingStudent.email || editingStudent.id}
            </p>

            <div className="password-edit-form" style={{ marginTop: 0 }}>
              <input
                type="text"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="password-edit-input"
                placeholder="كلمة المرور الجديدة"
                disabled={isUpdating}
              />
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button
                  onClick={() => handleSavePassword(editingStudent.id!)}
                  className="save-password-btn"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'جاري..' : 'حفظ'}
                </button>
                <button
                  onClick={() => setEditingStudent(null)}
                  className="cancel-password-btn"
                  disabled={isUpdating}
                >
                  إلغاء
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AllUsersPage;

