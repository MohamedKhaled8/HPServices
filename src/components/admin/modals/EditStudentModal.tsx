import React from 'react';
import { X, Save } from 'lucide-react';
import { StudentData } from '../../../types';

interface EditStudentModalProps {
  isOpen: boolean;
  studentData: StudentData | null;
  onClose: () => void;
  onSave: () => Promise<void>;
  onChangeStudentData: (updated: StudentData) => void;
  isSaving: boolean;
}

const EditStudentModal: React.FC<EditStudentModalProps> = ({
  isOpen,
  studentData,
  onClose,
  onSave,
  onChangeStudentData,
  isSaving
}) => {
  if (!isOpen || !studentData) return null;

  return (
    <div className="request-modal-overlay" onClick={onClose}>
      <div className="request-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>تعديل بيانات المستخدم</h2>
          <button onClick={onClose} className="close-button" type="button">
            <X size={24} />
          </button>
        </div>

        <div className="modal-content">
          <div className="edit-student-form">
            <div className="form-row">
              <div className="form-group">
                <label>الاسم بالعربية *</label>
                <input
                  type="text"
                  value={studentData.fullNameArabic || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    fullNameArabic: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>الاسم بالإنجليزية</label>
                <input
                  type="text"
                  value={studentData.vehicleNameEnglish || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    vehicleNameEnglish: e.target.value
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>رقم الواتساب *</label>
                <input
                  type="text"
                  value={studentData.whatsappNumber || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    whatsappNumber: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>الرقم القومي *</label>
                <input
                  type="text"
                  value={studentData.nationalID || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    nationalID: e.target.value
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>الإيميل *</label>
                <input
                  type="email"
                  value={studentData.email || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    email: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>نوع الدبلومة</label>
                <input
                  type="text"
                  value={studentData.diplomaType || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    diplomaType: e.target.value
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>سنة الدبلومة</label>
                <input
                  type="text"
                  value={studentData.diplomaYear || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    diplomaYear: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>كلمة المرور</label>
                <input
                  type="text"
                  value={studentData.password || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    password: e.target.value
                  })}
                  className="form-input"
                  placeholder="أدخل كلمة المرور الجديدة"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>المحافظة</label>
                <input
                  type="text"
                  value={(typeof studentData.address === 'object' && studentData.address?.governorate) || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    address: {
                      ...(typeof studentData.address === 'object' && studentData.address !== null ? studentData.address : { governorate: '', city: '', street: '', building: '', siteNumber: '' }),
                      governorate: e.target.value
                    }
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>المدينة</label>
                <input
                  type="text"
                  value={(typeof studentData.address === 'object' && studentData.address?.city) || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    address: {
                      ...(typeof studentData.address === 'object' && studentData.address !== null ? studentData.address : { governorate: '', city: '', street: '', building: '', siteNumber: '' }),
                      city: e.target.value
                    }
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>الشارع</label>
                <input
                  type="text"
                  value={(typeof studentData.address === 'object' && studentData.address?.street) || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    address: {
                      ...(typeof studentData.address === 'object' && studentData.address !== null ? studentData.address : { governorate: '', city: '', street: '', building: '', siteNumber: '' }),
                      street: e.target.value
                    }
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>رقم المبنى</label>
                <input
                  type="text"
                  value={(typeof studentData.address === 'object' && studentData.address?.building) || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    address: {
                      ...(typeof studentData.address === 'object' && studentData.address !== null ? studentData.address : { governorate: '', city: '', street: '', building: '', siteNumber: '' }),
                      building: e.target.value
                    }
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>الكلية أو المعهد المتخرج منه</label>
                <input
                  type="text"
                  value={studentData.college || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    college: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>القسم أو الشعبة</label>
                <input
                  type="text"
                  value={studentData.department || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    department: e.target.value
                  })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>التقدير العام</label>
                <input
                  type="text"
                  value={studentData.grade || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    grade: e.target.value
                  })}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label>المسار الدراسي</label>
                <select
                  value={studentData.track || ''}
                  onChange={(e) => onChangeStudentData({
                    ...studentData,
                    track: e.target.value
                  })}
                  className="form-input"
                >
                  <option value="">اختر المسار</option>
                  <option value="الأول">الأول</option>
                  <option value="الثاني">الثاني</option>
                  <option value="الثالث">الثالث</option>
                </select>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" onClick={onSave} className="save-button" disabled={isSaving}>
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
              <button type="button" onClick={onClose} className="cancel-button">
                إلغاء
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditStudentModal;

