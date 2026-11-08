import React from 'react';
import { Save, Plus, Check, X, Edit2, Trash2 } from 'lucide-react';
import { AssignmentsServiceConfig, AssignmentItem } from '../../../../types';

interface AssignmentsConfigTabProps {
  assignmentsConfig: AssignmentsServiceConfig;
  setAssignmentsConfig: React.Dispatch<React.SetStateAction<AssignmentsServiceConfig>>;
  isSaving: boolean;
  handleSaveAssignmentsConfig: () => Promise<void>;
  newAssignmentName: string;
  setNewAssignmentName: React.Dispatch<React.SetStateAction<string>>;
  newAssignmentPrice: string;
  setNewAssignmentPrice: React.Dispatch<React.SetStateAction<string>>;
  handleAddAssignment: () => void;
  editingAssignmentId: string | null;
  editAssignmentName: string;
  setEditAssignmentName: React.Dispatch<React.SetStateAction<string>>;
  editAssignmentPrice: string;
  setEditAssignmentPrice: React.Dispatch<React.SetStateAction<string>>;
  handleSaveEditAssignment: () => void;
  handleCancelEditAssignment: () => void;
  handleStartEditAssignment: (assignment: AssignmentItem) => void;
  handleRemoveAssignment: (id: string) => void;
}

export const AssignmentsConfigTab: React.FC<AssignmentsConfigTabProps> = ({
  assignmentsConfig,
  setAssignmentsConfig,
  isSaving,
  handleSaveAssignmentsConfig,
  newAssignmentName,
  setNewAssignmentName,
  newAssignmentPrice,
  setNewAssignmentPrice,
  handleAddAssignment,
  editingAssignmentId,
  editAssignmentName,
  setEditAssignmentName,
  editAssignmentPrice,
  setEditAssignmentPrice,
  handleSaveEditAssignment,
  handleCancelEditAssignment,
  handleStartEditAssignment,
  handleRemoveAssignment,
}) => {
  return (
          <div className="assignments-config-section">
            <div className="section-header">
              <h2>إعدادات خدمة التكليفات</h2>
              <button
                type="button"
                onClick={handleSaveAssignmentsConfig}
                className="save-button"
                disabled={isSaving}
              >
                <Save size={18} />
                {isSaving ? 'جاري الحفظ...' : 'حفظ'}
              </button>
            </div>

            <div className="assignments-config-form">
              {/* 1. إعدادات الخدمة والدفع */}
              <div className="config-section-block">
                <h3 className="block-title">بيانات الخدمة والدفع</h3>
                <div className="form-group">
                  <label>اسم الخدمة</label>
                  <input
                    type="text"
                    placeholder="مثال: خدمة حل التكليفات"
                    value={assignmentsConfig.serviceName}
                    onChange={e =>
                      setAssignmentsConfig({
                        ...assignmentsConfig,
                        serviceName: e.target.value
                      })
                    }
                  />
                </div>

                <div className="payment-methods-grid">
                  <div className="form-group">
                    <label>رقم InstaPay</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.instaPay}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            instaPay: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label>رقم المحفظة النقدية</label>
                    <input
                      type="text"
                      dir="ltr"
                      value={assignmentsConfig.paymentMethods.cashWallet}
                      onChange={e =>
                        setAssignmentsConfig({
                          ...assignmentsConfig,
                          paymentMethods: {
                            ...assignmentsConfig.paymentMethods,
                            cashWallet: e.target.value
                          }
                        })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="section-divider"></div>

              {/* 2. إدارة التكليفات */}
              <div className="config-section-block">
                <h3 className="block-title">إدارة التكليفات المتاحة</h3>

                <div className="assignments-management-area">
                  <div className="add-assignment-section">
                    <label className="sub-label">إضافة تكليف جديد</label>
                    <div className="add-assignment-form">
                      <input
                        type="text"
                        placeholder="اسم التكليف الجديد"
                        value={newAssignmentName}
                        onChange={e => setNewAssignmentName(e.target.value)}
                      />
                      <input
                        type="number"
                        placeholder="السعر"
                        value={newAssignmentPrice}
                        onChange={e => setNewAssignmentPrice(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={handleAddAssignment}
                        className="add-button"
                      >
                        إضافة
                      </button>
                    </div>
                  </div>

                  <div className="assignments-list-wrapper">
                    <label className="sub-label">قائمة التكليفات</label>
                    <div className="assignments-list-container">
                      <div className="assignments-list-header">
                        <div>اسم التكليف</div>
                        <div>السعر (ج.م)</div>
                        <div style={{ textAlign: 'center' }}>الإجراءات</div>
                      </div>

                      <div className="assignments-list">
                        {assignmentsConfig.assignments.length === 0 ? (
                          <div className="no-assignments-message">
                            <p>لا توجد تكليفات مضافة حتى الآن</p>
                          </div>
                        ) : (
                          assignmentsConfig.assignments.map(assignment => {
                            const isEditing = editingAssignmentId === assignment.id;
                            return (
                              <div key={assignment.id} className="assignment-item" style={{ alignItems: 'center' }}>
                                {isEditing ? (
                                  <>
                                    <div style={{ display: 'flex', gap: '8px', flex: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                                      <input
                                        type="text"
                                        value={editAssignmentName}
                                        onChange={e => setEditAssignmentName(e.target.value)}
                                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #94a3b8', flex: 2, minWidth: '130px' }}
                                        placeholder="اسم التكليف"
                                      />
                                      <input
                                        type="number"
                                        value={editAssignmentPrice}
                                        onChange={e => setEditAssignmentPrice(e.target.value)}
                                        style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #94a3b8', width: '90px' }}
                                        placeholder="السعر"
                                      />
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={handleSaveEditAssignment}
                                        style={{ background: '#10b981', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                                        title="حفظ التعديل"
                                        disabled={isSaving}
                                      >
                                        <Check size={16} />
                                        <span>حفظ</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={handleCancelEditAssignment}
                                        style={{ background: '#64748b', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}
                                        title="إلغاء التعديل"
                                      >
                                        <X size={16} />
                                        <span>إلغاء</span>
                                      </button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <div className="assignment-info">
                                      <span className="assignment-name">{assignment.name}</span>
                                      <span className="assignment-price">
                                        {assignment.price} ج.م
                                      </span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                      <button
                                        type="button"
                                        onClick={() => handleStartEditAssignment(assignment)}
                                        style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', fontWeight: '600' }}
                                        title="تعديل السعر أو الاسم"
                                      >
                                        <Edit2 size={15} />
                                        <span>تعديل السعر</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveAssignment(assignment.id)}
                                        className="remove-assignment-button"
                                        title="حذف التكليف"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    </div>
                                  </>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
  );
};
