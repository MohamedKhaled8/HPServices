import React, { useState } from 'react';
import { useStudent } from '../context';
import { StudentData, ValidationError } from '../types';
import { validateStudentData } from '../utils/validation';
import { GOVERNORATES, DIPLOMA_YEARS, TRACKS, COURSES, DIPLOMA_TYPES } from '../constants/services';
import { updateStudentData } from '../services/firebaseService';
import { ArrowRight, AlertCircle, CheckCircle } from 'lucide-react';
import '../styles/ProfilePage.css';

interface ProfilePageProps {
  onBack: () => void;
}

const ProfilePage: React.FC<ProfilePageProps> = ({ onBack }) => {
  const { student, setStudent } = useStudent();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Partial<StudentData>>(student || {});
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!student) {
    return null;
  }

  const getFieldError = (fieldName: string): string | undefined => {
    return errors.find(e => e.field === fieldName)?.message;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setErrors(prev => prev.filter(e => e.field !== field));
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      address: {
        ...prev.address!,
        [field]: value
      }
    }));
    setErrors(prev => prev.filter(e => !e.field.startsWith('address.')));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const validationErrors = validateStudentData(formData as StudentData);

    if (validationErrors.length > 0) {
      setErrors(validationErrors);
      setIsSubmitting(false);
      return;
    }

    try {
      if (!student.id) {
        setMessage({ type: 'error', text: 'معرف المستخدم غير موجود' });
        setIsSubmitting(false);
        return;
      }

      const updatedStudent: StudentData = {
        ...student,
        ...formData,
        fullNameArabic: formData.fullNameArabic || student.fullNameArabic,
        vehicleNameEnglish: formData.vehicleNameEnglish || student.vehicleNameEnglish,
        whatsappNumber: formData.whatsappNumber || student.whatsappNumber,
        email: formData.email || student.email,
        address: formData.address || student.address
      };

      // Update in Firestore
      await updateStudentData(student.id, updatedStudent);
      
      // Update local state
      setStudent(updatedStudent);
      setMessage({ type: 'success', text: 'تم تحديث البيانات بنجاح' });
      setTimeout(() => {
        setIsEditing(false);
      }, 1500);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'حدث خطأ أثناء التحديث' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayData = isEditing ? formData : student;

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button onClick={onBack} className="back-button">
          <ArrowRight size={20} />
          رجوع
        </button>
        <h1>الملف الشخصي</h1>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="edit-profile-button"
          >
            تعديل
          </button>
        )}
      </div>

      <form onSubmit={handleSave} className="profile-form">
        <div className="profile-container">
          {message && (
            <div className={`message ${message.type}`}>
              {message.type === 'success' ? (
                <CheckCircle size={18} />
              ) : (
                <AlertCircle size={18} />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <section className="profile-section">
            <h2>البيانات الشخصية</h2>

            <div className="form-group">
              <label htmlFor="fullNameArabic">الاسم الكامل (عربي)</label>
              <input
                id="fullNameArabic"
                type="text"
                dir="rtl"
                disabled={!isEditing}
                value={displayData.fullNameArabic || ''}
                onChange={(e) => handleInputChange('fullNameArabic', e.target.value)}
                className={getFieldError('fullNameArabic') ? 'error' : ''}
              />
              {getFieldError('fullNameArabic') && (
                <span className="error-message">{getFieldError('fullNameArabic')}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="vehicleNameEnglish">Vehicle Name (English)</label>
              <input
                id="vehicleNameEnglish"
                type="text"
                dir="ltr"
                disabled={!isEditing}
                value={displayData.vehicleNameEnglish || ''}
                onChange={(e) => handleInputChange('vehicleNameEnglish', e.target.value)}
                className={getFieldError('vehicleNameEnglish') ? 'error' : ''}
              />
              {getFieldError('vehicleNameEnglish') && (
                <span className="error-message">{getFieldError('vehicleNameEnglish')}</span>
              )}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="whatsappNumber">رقم الواتس</label>
                <input
                  id="whatsappNumber"
                  type="tel"
                  disabled={!isEditing}
                  value={displayData.whatsappNumber || ''}
                  onChange={(e) => handleInputChange('whatsappNumber', e.target.value)}
                  className={getFieldError('whatsappNumber') ? 'error' : ''}
                />
                {getFieldError('whatsappNumber') && (
                  <span className="error-message">{getFieldError('whatsappNumber')}</span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="nationalID">رقم الهوية</label>
                <input
                  id="nationalID"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.nationalID || ''}
                  onChange={(e) => handleInputChange('nationalID', e.target.value)}
                  className={getFieldError('nationalID') ? 'error' : ''}
                />
                {getFieldError('nationalID') && (
                  <span className="error-message">{getFieldError('nationalID')}</span>
                )}
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2>بيانات الدبلوم</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="diplomaYear">سنة الدبلوم</label>
                <select
                  id="diplomaYear"
                  disabled={!isEditing}
                  value={displayData.diplomaYear || ''}
                  onChange={(e) => handleInputChange('diplomaYear', e.target.value)}
                >
                  {DIPLOMA_YEARS.map(year => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="diplomaType">نوع الدبلوم</label>
                <select
                  id="diplomaType"
                  disabled={!isEditing}
                  value={displayData.diplomaType || ''}
                  onChange={(e) => handleInputChange('diplomaType', e.target.value)}
                >
                  <option value="">اختر نوع الدبلوم</option>
                  {DIPLOMA_TYPES.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="track">التخصص</label>
                <select
                  id="track"
                  disabled={!isEditing}
                  value={displayData.track || ''}
                  onChange={(e) => handleInputChange('track', e.target.value as any)}
                >
                  <option value="">اختر التخصص</option>
                  {TRACKS.map(track => (
                    <option key={track} value={track}>{track}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="course">المقرر</label>
                <select
                  id="course"
                  disabled={!isEditing}
                  value={displayData.course || ''}
                  onChange={(e) => handleInputChange('course', e.target.value as any)}
                >
                  <option value="">اختر المقرر</option>
                  {COURSES.map(course => (
                    <option key={course} value={course}>{course}</option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2>العنوان</h2>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="governorate">المحافظة</label>
                <select
                  id="governorate"
                  disabled={!isEditing}
                  value={displayData.address?.governorate || ''}
                  onChange={(e) => handleAddressChange('governorate', e.target.value)}
                >
                  <option value="">اختر المحافظة</option>
                  {GOVERNORATES.map(gov => (
                    <option key={gov} value={gov}>{gov}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="city">المدينة</label>
                <input
                  id="city"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.address?.city || ''}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="street">الشارع</label>
                <input
                  id="street"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.address?.street || ''}
                  onChange={(e) => handleAddressChange('street', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="building">رقم المبنى/المنزل</label>
                <input
                  id="building"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.address?.building || ''}
                  onChange={(e) => handleAddressChange('building', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="siteNumber">رقم الموقع</label>
                <input
                  id="siteNumber"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.address?.siteNumber || ''}
                  onChange={(e) => handleAddressChange('siteNumber', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="landmark">معلم قريب (اختياري)</label>
                <input
                  id="landmark"
                  type="text"
                  disabled={!isEditing}
                  value={displayData.address?.landmark || ''}
                  onChange={(e) => handleAddressChange('landmark', e.target.value)}
                />
              </div>
            </div>
          </section>

          <section className="profile-section">
            <h2>بيانات الحساب</h2>

            <div className="form-group">
              <label htmlFor="email">البريد الإلكتروني</label>
              <input
                id="email"
                type="email"
                disabled={!isEditing}
                value={displayData.email || ''}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={getFieldError('email') ? 'error' : ''}
              />
              {getFieldError('email') && (
                <span className="error-message">{getFieldError('email')}</span>
              )}
            </div>
          </section>

          {isEditing && (
            <div className="form-actions">
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setFormData(student);
                  setErrors([]);
                }}
                className="cancel-button"
                disabled={isSubmitting}
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="save-button"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
};

export default ProfilePage;
