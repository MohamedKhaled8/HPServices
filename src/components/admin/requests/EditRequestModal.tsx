import React from 'react';
import { X, Save } from 'lucide-react';
import { updateServiceRequestData } from '../../../services/firebaseService';

export interface EditRequestModalProps {
  isOpen: boolean;
  requestId: string | null;
  serviceId: string | null;
  tempRequestData: Record<string, any>;
  setTempRequestData: React.Dispatch<React.SetStateAction<Record<string, any>>>;
  onClose: () => void;
  translateKey: (key: string) => string;
  setToastState: (state: { message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null) => void;
}

export const EditRequestModal: React.FC<EditRequestModalProps> = ({
  isOpen,
  requestId,
  serviceId,
  tempRequestData,
  setTempRequestData,
  onClose,
  translateKey,
  setToastState
}) => {
  if (!isOpen || !requestId || !serviceId) return null;

  const handleSave = async () => {
    try {
      await updateServiceRequestData(requestId, serviceId, tempRequestData);
      setToastState({ message: 'تم تعديل الطلب بنجاح', type: 'success', duration: 3000 });
      onClose();
    } catch (err: any) {
      setToastState({ message: 'فشل تعديل الطلب', type: 'error', duration: 3000 });
    }
  };

  return (
    <div className="request-modal-overlay" onClick={onClose}>
      <div
        className="request-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2>تعديل البيانات</h2>
          <button onClick={onClose} className="close-button" type="button">
            <X size={24} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {Object.keys(tempRequestData).map((key) => {
              const val = tempRequestData[key];
              if (key === 'receiptUrl' || (typeof val === 'object' && !Array.isArray(val) && val !== null)) return null;

              if (key === 'student_names' || key === 'names_array') {
                const names = typeof val === 'string' ? val.split('\n') : Array.isArray(val) ? val : [''];
                return (
                  <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '13px', fontWeight: 'bold' }}>{translateKey(key)}</label>
                    {names.map((n: string, i: number) => (
                      <input
                        key={i}
                        type="text"
                        value={n}
                        onChange={(e) => {
                          const newNames = [...names];
                          newNames[i] = e.target.value;
                          setTempRequestData({ ...tempRequestData, [key]: newNames.join('\n') });
                        }}
                        className="form-input"
                        placeholder={`الاسم رقم ${i + 1}`}
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newNames = [...names, ''];
                        setTempRequestData({ ...tempRequestData, [key]: newNames.join('\n') });
                      }}
                      style={{
                        padding: '6px',
                        background: '#f8fafc',
                        border: '1px dashed #cbd5e1',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      + إضافة اسم آخر
                    </button>
                  </div>
                );
              }

              if (Array.isArray(val)) return null;

              return (
                <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold' }}>{translateKey(key)}</label>
                  {key === 'wantsMalazem' ? (
                    <select
                      value={val ? 'true' : 'false'}
                      onChange={(e) => setTempRequestData({ ...tempRequestData, [key]: e.target.value === 'true' })}
                      className="form-input"
                    >
                      <option value="true">نعم</option>
                      <option value="false">لا</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={val || ''}
                      onChange={(e) => setTempRequestData({ ...tempRequestData, [key]: e.target.value })}
                      className="form-input"
                    />
                  )}
                </div>
              );
            })}
          </div>

          <div className="modal-footer" style={{ marginTop: '20px' }}>
            <button
              type="button"
              onClick={handleSave}
              className="save-button"
            >
              <Save size={18} /> حفظ التغييرات
            </button>
            <button type="button" onClick={onClose} className="cancel-button">
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EditRequestModal;
