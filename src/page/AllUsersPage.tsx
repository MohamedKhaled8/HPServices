import React, { useState, useEffect } from 'react';
import { StudentData } from '../types';
import { subscribeToAllStudents, updateStudentData } from '../services/firebaseService';
import { ArrowRight, Eye, EyeOff, RefreshCw, Search } from 'lucide-react';
import '../styles/AllUsersPage.css';

interface AllUsersPageProps {
  onBack: () => void;
}

const AllUsersPage: React.FC<AllUsersPageProps> = ({ onBack }) => {
  const [students, setStudents] = useState<StudentData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState<{ [key: string]: boolean }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [editingPassword, setEditingPassword] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setIsLoading(true);
    const unsubscribe = subscribeToAllStudents((allStudents) => {
      setStudents(allStudents);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const togglePasswordVisibility = (studentId: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [studentId]: !prev[studentId]
    }));
  };

  const handleEditPassword = (student: StudentData) => {
    setEditingPassword(student.id || null);
    setNewPassword(student.password || '');
  };

  const handleSavePassword = async (studentId: string) => {
    if (!newPassword.trim()) {
      alert('الرجاء إدخال كلمة مرور صالحة');
      return;
    }

    try {
      setIsUpdating(true);
      // Directly call updateStudentData since subscribeToAllStudents is just the listener function
      await updateStudentData(studentId, { password: newPassword });
      setEditingPassword(null);
      alert('تم تحديث كلمة المرور بنجاح');
    } catch (error: any) {
      alert('حدث خطأ أثناء التحديث: ' + error.message);
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredStudents = students.filter(student => {
    const searchLower = searchTerm.toLowerCase();
    return (
      student.fullNameArabic?.toLowerCase().includes(searchLower) ||
      student.email?.toLowerCase().includes(searchLower) ||
      student.whatsappNumber?.includes(searchTerm) ||
      student.id?.toLowerCase().includes(searchLower) ||
      student.nationalID?.includes(searchTerm)
    );
  });

  const formatDate = (dateString?: string) => {
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
  };

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
          <div className="users-grid">
            {filteredStudents.map((student) => (
              <div key={student.id} className="user-card">
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
                            {showPasswords[student.id || ''] ? (student.password || 'غير متاح') : '••••••••'}
                          </span>
                          <button
                            type="button"
                            onClick={() => togglePasswordVisibility(student.id || '')}
                            className="toggle-password-btn"
                            title={showPasswords[student.id || ''] ? 'إخفاء' : 'إظهار'}
                          >
                            {showPasswords[student.id || ''] ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                          <button
                            onClick={() => handleEditPassword(student)}
                            className="edit-password-btn"
                          >
                            تعديل
                          </button>
                        </div>
                      </div>

                      {editingPassword === student.id && (
                        <div className="password-edit-form">
                          <input
                            type="text"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="password-edit-input"
                            placeholder="كلمة المرور الجديدة"
                            disabled={isUpdating}
                          />
                          <button
                            onClick={() => handleSavePassword(student.id!)}
                            className="save-password-btn"
                            disabled={isUpdating}
                          >
                            {isUpdating ? 'جاري..' : 'حفظ'}
                          </button>
                          <button
                            onClick={() => setEditingPassword(null)}
                            className="cancel-password-btn"
                            disabled={isUpdating}
                          >
                            إلغاء
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="detail-row">
                    <span className="detail-label">تاريخ التسجيل:</span>
                    <span className="detail-value">{formatDate(student.createdAt)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AllUsersPage;

