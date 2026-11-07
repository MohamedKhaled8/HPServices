import React from 'react';
import { X } from 'lucide-react';
import { AssignmentsServiceConfig } from '../../../../types';
import { ServiceTier, DistributeTargetOptions } from '../../../../services/firebaseService';
import { classifyAssignment } from '../../../../utils/assignmentClassifier';

export interface TierSelectionModalProps {
  showTierModal: boolean;
  setShowTierModal: (show: boolean) => void;
  assignmentsConfig: AssignmentsServiceConfig;
  handleDistribute: (tierOrTarget: ServiceTier | DistributeTargetOptions) => void;
}

export const TierSelectionModal: React.FC<TierSelectionModalProps> = ({
  showTierModal,
  setShowTierModal,
  assignmentsConfig,
  handleDistribute
}) => {
  if (!showTierModal) {
    return null;
  }

  return (
        <div className="tier-modal-overlay" onClick={() => setShowTierModal(false)}>
          <div className="tier-modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <h3 style={{ margin: 0 }}>اختر باقة التوزيع لإرسال الملفات</h3>
              <button
                type="button"
                onClick={() => setShowTierModal(false)}
                style={{
                  background: '#f1f5f9',
                  border: 'none',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#64748b'
                }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ color: '#64748B', fontSize: '13px', marginBottom: '14px', textAlign: 'right' }}>
              اختر الخدمة المستهدفة وسيتم إسناد الملفات المحددة للطلاب المشتركين فيها تلقائياً.
            </p>

            {/* الخيارات السريعة المفصولة تماماً لمنع أي خلط بين الفئات */}
            {(() => {
              const personalizedItem = assignmentsConfig?.assignments?.find(a => classifyAssignment(a) === 'personalized');
              const plainItem = assignmentsConfig?.assignments?.find(a => classifyAssignment(a) === 'plain');
              const personalizedPrice = personalizedItem ? `${personalizedItem.price} ج.م` : '300 ج.م';
              const plainPrice = plainItem ? `${plainItem.price} ج.م` : '200 ج.م';

              return (
                <div className="tier-modal-buttons">
                  <button
                    type="button"
                    className="tier-button tier-personalized"
                    onClick={() => handleDistribute({ category: 'personalized', namingMode: 'personalized' })}
                  >
                    <span className="tier-btn-badge personalized">👤 بالاسم والبيانات</span>
                    <strong>حل وتسليم التكليفات ({personalizedPrice})</strong>
                    <span>يُرسل حصراً للطلاب المشتركين في باقة الحل والتسليم (باسم وبيانات الطالب)</span>
                  </button>
                  <button
                    type="button"
                    className="tier-button tier-plain"
                    onClick={() => handleDistribute({ category: 'plain', namingMode: 'plain' })}
                  >
                    <span className="tier-btn-badge plain">📄 باسم الملف فقط</span>
                    <strong>حل PDF فقط ({plainPrice})</strong>
                    <span>يُرسل حصراً للطلاب المشتركين في باقة PDF (باسم الملف الأصلي بدون اسم الطالب)</span>
                  </button>
                </div>
              );
            })()}

            {/* التكليفات المضافة حالياً في إعدادات الخدمة (ديناميكية لأي تكليف جديد) */}
            {assignmentsConfig?.assignments && assignmentsConfig.assignments.length > 0 && (
              <div className="tier-dynamic-section">
                <div className="tier-dynamic-title">
                  أو حدد تكليفاً معيناً لإرسال الملفات لمشتركيه فقط:
                </div>
                <div className="tier-dynamic-list">
                  {assignmentsConfig.assignments.map((assignment) => {
                    const cat = classifyAssignment(assignment);
                    const isPersonalized = cat === 'personalized';
                    const isPlain = cat === 'plain';

                    return (
                      <div key={assignment.id} className="tier-dynamic-item">
                        <div className="tier-item-info">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span className="tier-item-name" title={assignment.name}>{assignment.name}</span>
                            <span className={`tier-badge-pill ${cat}`}>
                              {isPersonalized ? 'حل وتسليم' : isPlain ? 'حل PDF' : 'عملي'}
                            </span>
                          </div>
                          <span className="tier-item-price">{assignment.price} ج.م</span>
                        </div>
                        <div className="tier-item-actions">
                          {isPersonalized ? (
                            <button
                              type="button"
                              className="tier-action-btn personalized"
                              onClick={() => handleDistribute({
                                assignmentId: assignment.id,
                                assignmentName: assignment.name,
                                price: assignment.price,
                                category: 'personalized',
                                namingMode: 'personalized'
                              })}
                              title="إرسال مخصصاً بالاسم والبيانات لمشتركي هذا التكليف فقط"
                            >
                              إرسال بالاسم والبيانات
                            </button>
                          ) : isPlain ? (
                            <button
                              type="button"
                              className="tier-action-btn plain"
                              onClick={() => handleDistribute({
                                assignmentId: assignment.id,
                                assignmentName: assignment.name,
                                price: assignment.price,
                                category: 'plain',
                                namingMode: 'plain'
                              })}
                              title="إرسال باسم الملف الأصلي (بدون اسم) لمشتركي هذا التكليف فقط"
                            >
                              إرسال كـ PDF (بدون اسم)
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="tier-action-btn unified"
                              onClick={() => handleDistribute({
                                assignmentId: assignment.id,
                                assignmentName: assignment.name,
                                price: assignment.price,
                                category: 'unified',
                                namingMode: 'plain'
                              })}
                              title="إرسال موحد لمشتركي هذا التكليف"
                            >
                              إرسال موحد
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <button className="tier-cancel" onClick={() => setShowTierModal(false)}>
              إغلاق النافذة
            </button>
          </div>
        </div>
  );
};
