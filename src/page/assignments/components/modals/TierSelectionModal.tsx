import React, { useState } from 'react';
import { X, Check, Users, Sparkles, Filter, CheckSquare, Square, FileText, Layers, FolderCheck } from 'lucide-react';
import { AssignmentsServiceConfig } from '../../../../types';
import { ServiceTier, DistributeTargetOptions } from '../../../../services/firebaseService';
import { classifyAssignment, STANDARD_SPECIALIZATIONS } from '../../../../utils/assignmentClassifier';

export interface TierSelectionModalProps {
  showTierModal: boolean;
  setShowTierModal: (show: boolean) => void;
  assignmentsConfig: AssignmentsServiceConfig;
  handleDistribute: (tierOrTarget: ServiceTier | DistributeTargetOptions) => void;
  selectedFilesCount?: number;
  isDistributing?: boolean;
  currentFolderName?: string;
}

export const TierSelectionModal: React.FC<TierSelectionModalProps> = ({
  showTierModal,
  setShowTierModal,
  assignmentsConfig,
  handleDistribute,
  selectedFilesCount,
  isDistributing = false,
  currentFolderName,
}) => {
  const [isAllSpecializations, setIsAllSpecializations] = useState<boolean>(true);
  const [selectedSpecializations, setSelectedSpecializations] = useState<string[]>([]);
  const [distributionMode, setDistributionMode] = useState<'smart_all_missing' | 'single_variant_rotation'>('smart_all_missing');

  if (!showTierModal) {
    return null;
  }

  // مطابقة المجلد الحالي تلقائياً مع تكليف من قائمة التكليفات
  const matchedAssignment = assignmentsConfig?.assignments?.find((a) => {
    if (!currentFolderName) return false;
    const aName = a.name.trim().toLowerCase();
    const fName = currentFolderName.trim().toLowerCase();
    return aName === fName || aName.includes(fName) || fName.includes(aName);
  });

  const handleToggleAllSpecializations = () => {
    setIsAllSpecializations(true);
    setSelectedSpecializations([]);
  };

  const handleToggleSpecialization = (spec: string) => {
    if (isAllSpecializations) {
      setIsAllSpecializations(false);
      setSelectedSpecializations([spec]);
    } else {
      const exists = selectedSpecializations.includes(spec);
      let updated: string[];
      if (exists) {
        updated = selectedSpecializations.filter((s) => s !== spec);
      } else {
        updated = [...selectedSpecializations, spec];
      }

      if (updated.length === 0 || updated.length === STANDARD_SPECIALIZATIONS.length) {
        setIsAllSpecializations(true);
        setSelectedSpecializations([]);
      } else {
        setSelectedSpecializations(updated);
      }
    }
  };

  const handleSelectAllSpecs = () => {
    setIsAllSpecializations(true);
    setSelectedSpecializations([]);
  };

  const handleClearAllSpecs = () => {
    setIsAllSpecializations(false);
    setSelectedSpecializations([]);
  };

  const triggerDistribute = (baseTarget: DistributeTargetOptions) => {
    const effectiveSpecs =
      isAllSpecializations || selectedSpecializations.length === 0
        ? undefined
        : selectedSpecializations;

    handleDistribute({
      ...baseTarget,
      mode: distributionMode,
      targetSpecializations: effectiveSpecs,
    });
  };

  const isSelectionInvalid = !isAllSpecializations && selectedSpecializations.length === 0;

  return (
    <div className="tier-modal-overlay" onClick={() => !isDistributing && setShowTierModal(false)}>
      <div
        className="tier-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '640px', padding: '24px 22px' }}
      >
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#e0e7ff',
                color: '#4338ca',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sparkles size={18} />
            </div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>توزيع التكليفات الذكي للطلاب</h3>
          </div>
          <button
            type="button"
            onClick={() => !isDistributing && setShowTierModal(false)}
            disabled={isDistributing}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDistributing ? 'not-allowed' : 'pointer',
              color: '#64748b',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Info Banner & Files Count */}
        <div
          style={{
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '10px',
            padding: '10px 14px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
            textAlign: 'right',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#475569', fontSize: '13px' }}>
            <FileText size={16} color="#6366f1" />
            <span>
              الملفات المحددة للإرسال:{' '}
              <strong style={{ color: '#1e293b' }}>
                {selectedFilesCount !== undefined ? `${selectedFilesCount} ملف` : 'جميع ملفات المجلد'}
              </strong>
              {currentFolderName && (
                <span style={{ marginRight: '6px', color: '#4f46e5', fontWeight: 600 }}>
                  ({currentFolderName})
                </span>
              )}
            </span>
          </div>
          <span
            style={{
              fontSize: '11px',
              background: '#ecfdf5',
              color: '#047857',
              padding: '3px 8px',
              borderRadius: '6px',
              fontWeight: 600,
            }}
          >
            ⚡ استكمال الناقص تلقائياً وبدون تكرار
          </span>
        </div>

        {/* Section 1: Specialization Selector */}
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            padding: '14px',
            marginBottom: '16px',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 700, color: '#1e293b' }}>
              <Filter size={15} color="#4f46e5" />
              <span>تحديد التخصصات المستهدفة:</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={handleSelectAllSpecs}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#4f46e5',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                تحديد الكل
              </button>
              <span style={{ color: '#cbd5e1' }}>|</span>
              <button
                type="button"
                onClick={handleClearAllSpecs}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 6px',
                }}
              >
                تخصيص يدوي
              </button>
            </div>
          </div>

          {/* Quick All-Specializations Pill */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
            <button
              type="button"
              onClick={handleToggleAllSpecializations}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: isAllSpecializations ? 700 : 500,
                border: isAllSpecializations ? '1.5px solid #4f46e5' : '1px solid #cbd5e1',
                background: isAllSpecializations ? '#eef2ff' : '#ffffff',
                color: isAllSpecializations ? '#4338ca' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {isAllSpecializations ? <CheckSquare size={13} /> : <Square size={13} />}
              <span>جميع التخصصات ({STANDARD_SPECIALIZATIONS.length})</span>
            </button>
          </div>

          {/* Individual Specialization Pills */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
              maxHeight: '140px',
              overflowY: 'auto',
              padding: '4px',
              background: '#f8fafc',
              borderRadius: '8px',
              border: '1px solid #f1f5f9',
            }}
          >
            {STANDARD_SPECIALIZATIONS.map((spec) => {
              const isSelected = isAllSpecializations || selectedSpecializations.includes(spec);
              return (
                <button
                  key={spec}
                  type="button"
                  onClick={() => handleToggleSpecialization(spec)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '8px',
                    fontSize: '11px',
                    fontWeight: isSelected ? 600 : 400,
                    border: isSelected ? '1px solid #818cf8' : '1px solid #e2e8f0',
                    background: isSelected ? '#ffffff' : '#f1f5f9',
                    color: isSelected ? '#3730a3' : '#64748b',
                    boxShadow: isSelected ? '0 1px 2px rgba(99, 102, 241, 0.15)' : 'none',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSelected && <Check size={11} color="#4f46e5" />}
                  <span>{spec}</span>
                </button>
              );
            })}
          </div>

          {/* Selected Specs Counter */}
          <div style={{ marginTop: '8px', fontSize: '11px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Users size={12} />
            {isAllSpecializations ? (
              <span>مستهدف: <strong>جميع التخصصات</strong> (بدون استثناء)</span>
            ) : selectedSpecializations.length > 0 ? (
              <span>
                مستهدف: <strong>{selectedSpecializations.length}</strong> تخصص (
                {selectedSpecializations.slice(0, 3).join('، ')}
                {selectedSpecializations.length > 3 ? ` و${selectedSpecializations.length - 3} أخرى` : ''})
              </span>
            ) : (
              <span style={{ color: '#dc2626', fontWeight: 600 }}>⚠️ يرجى اختيار تخصص واحد على الأقل أو اختيار الكل</span>
            )}
          </div>
        </div>

        {/* Section: Distribution Mode (نمط تصفية وتوزيع الملفات) */}
        <div
          style={{
            marginBottom: '16px',
            padding: '12px 14px',
            background: '#f8fafc',
            borderRadius: '10px',
            border: '1px solid #e2e8f0',
            textAlign: 'right',
          }}
        >
          <div
            style={{
              fontSize: '12px',
              fontWeight: 700,
              color: '#1e293b',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} color="#4f46e5" />
            <span>طريقة توزيع الملفات على الطلاب (تصفية النماذج):</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
            {/* Mode 1: Smart Distribution (All files / complete missing without duplicates) - RECOMMENDED */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '9px 10px',
                borderRadius: '8px',
                border:
                  distributionMode === 'smart_all_missing'
                    ? '1.5px solid #4f46e5'
                    : '1px solid #cbd5e1',
                background:
                  distributionMode === 'smart_all_missing' ? '#eef2ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="distributionMode"
                checked={distributionMode === 'smart_all_missing'}
                onChange={() => setDistributionMode('smart_all_missing')}
                style={{ marginTop: '3px' }}
              />
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color:
                      distributionMode === 'smart_all_missing' ? '#4338ca' : '#1e293b',
                  }}
                >
                  📦 استكمال وتوزيع كافة التكليفات (الذكي)
                </div>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: '#64748b',
                    marginTop: '2px',
                    lineHeight: 1.4,
                  }}
                >
                  يستلم كل طالب كافة التكليفات المستحقة، ويستكمل الناقص فقط للطلاب الحاليين والجدد بدون تكرار.
                </div>
              </div>
            </label>

            {/* Mode 2: Variant Rotation (1 variant per student) */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '8px',
                padding: '9px 10px',
                borderRadius: '8px',
                border:
                  distributionMode === 'single_variant_rotation'
                    ? '1.5px solid #4f46e5'
                    : '1px solid #cbd5e1',
                background:
                  distributionMode === 'single_variant_rotation' ? '#eef2ff' : '#ffffff',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <input
                type="radio"
                name="distributionMode"
                checked={distributionMode === 'single_variant_rotation'}
                onChange={() => setDistributionMode('single_variant_rotation')}
                style={{ marginTop: '3px' }}
              />
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    fontWeight: 700,
                    color:
                      distributionMode === 'single_variant_rotation' ? '#4338ca' : '#1e293b',
                  }}
                >
                  🎯 نموذج واحد فقط (تدوير البدائل)
                </div>
                <div
                  style={{
                    fontSize: '10.5px',
                    color: '#64748b',
                    marginTop: '2px',
                    lineHeight: 1.4,
                  }}
                >
                  لحالات النماذج الامتحانية البديلة: يأخذ كل طالب نموذجاً واحداً فقط بالتناوب العشوائي.
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Matched Assignment Banner if folder matches an assignment */}
        {matchedAssignment && (
          <div
            style={{
              marginBottom: '14px',
              padding: '12px 14px',
              background: '#ecfdf5',
              border: '1.5px solid #10b981',
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              textAlign: 'right',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '12px',
                  fontWeight: 800,
                  color: '#065f46',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <FolderCheck size={16} />
                <span>مجلد مطابق لتكليف: "{matchedAssignment.name}"</span>
              </div>
              <div style={{ fontSize: '11px', color: '#047857', marginTop: '3px' }}>
                تصفية دقيقة: إرسال حصرياً للطلاب الذين اختاروا هذا التكليف في طلباتهم المرسلة.
              </div>
            </div>
            <button
              type="button"
              disabled={isDistributing || isSelectionInvalid}
              onClick={() =>
                triggerDistribute({
                  assignmentId: matchedAssignment.id,
                  assignmentName: matchedAssignment.name,
                  price: matchedAssignment.price,
                  category: classifyAssignment(matchedAssignment),
                  namingMode:
                    classifyAssignment(matchedAssignment) === 'personalized'
                      ? 'personalized'
                      : 'plain',
                })
              }
              style={{
                background: '#059669',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                opacity: isDistributing || isSelectionInvalid ? 0.6 : 1,
              }}
            >
              إرسال لمشتركي هذا التكليف فقط ⚡
            </button>
          </div>
        )}

        {/* Section 2: Delivery Package Selection */}
        <div style={{ textAlign: 'right', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
            <span>📌 الخيار الأول: إرسال شامل للباقة كاملة (يصل لجميع مشتركي الفئة)</span>
          </div>
          <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#64748b' }}>
            استخدم هذا الخيار عندما تريد إرسال ملفات المسار لجميع الطلاب المشتركين في الباقة دفعة واحدة:
          </p>
        </div>

        {/* Quick Main Tiers */}
        {(() => {
          const personalizedItem = assignmentsConfig?.assignments?.find((a) => classifyAssignment(a) === 'personalized');
          const plainItem = assignmentsConfig?.assignments?.find((a) => classifyAssignment(a) === 'plain');
          const personalizedPrice = personalizedItem ? `${personalizedItem.price} ج.م` : '300 ج.م';
          const plainPrice = plainItem ? `${plainItem.price} ج.م` : '200 ج.م';

          return (
            <div className="tier-modal-buttons">
              <button
                type="button"
                className="tier-button tier-personalized"
                disabled={isDistributing || isSelectionInvalid}
                onClick={() =>
                  triggerDistribute({
                    category: 'personalized',
                    namingMode: 'personalized',
                  })
                }
                style={{ opacity: isDistributing || isSelectionInvalid ? 0.6 : 1 }}
              >
                <span className="tier-btn-badge personalized">👤 بالاسم والبيانات</span>
                <strong>حل وتسليم التكليفات ({personalizedPrice})</strong>
                <span>يُرسل لكل الطلاب المشتركين في باقة الحل والتسليم (باسم وبيانات الطالب)</span>
              </button>

              <button
                type="button"
                className="tier-button tier-plain"
                disabled={isDistributing || isSelectionInvalid}
                onClick={() =>
                  triggerDistribute({
                    category: 'plain',
                    namingMode: 'plain',
                  })
                }
                style={{ opacity: isDistributing || isSelectionInvalid ? 0.6 : 1 }}
              >
                <span className="tier-btn-badge plain">📄 باسم الملف فقط</span>
                <strong>حل PDF فقط ({plainPrice})</strong>
                <span>يُرسل لكل الطلاب المشتركين في باقة PDF (باسم الملف الأصلي بدون اسم الطالب)</span>
              </button>
            </div>
          );
        })()}

        {/* Section 3: Dynamic Assignment Tiers (if defined in config) */}
        {assignmentsConfig?.assignments && assignmentsConfig.assignments.length > 0 && (
          <div className="tier-dynamic-section" style={{ marginTop: '16px', background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
            <div style={{ textAlign: 'right', marginBottom: '8px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>
                🎯 الخيار الثاني: إرسال مخصص لتكليف معين فقط (وليس كل الباقة)
              </div>
              <p style={{ margin: '3px 0 0 0', fontSize: '11px', color: '#64748b' }}>
                استخدم هذا الخيار إذا كان الملف يخص تكليفاً مفرداً فقط (مثل التربية العملي) وتريد حصره بمن اختاره تحديداً:
              </p>
            </div>
            <div className="tier-dynamic-list" style={{ maxHeight: '160px', overflowY: 'auto' }}>
              {assignmentsConfig.assignments.map((assignment) => {
                const cat = classifyAssignment(assignment);
                const isPersonalized = cat === 'personalized';
                const isPlain = cat === 'plain';

                return (
                  <div key={assignment.id} className="tier-dynamic-item">
                    <div className="tier-item-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="tier-item-name" title={assignment.name}>
                          {assignment.name}
                        </span>
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
                          disabled={isDistributing || isSelectionInvalid}
                          onClick={() =>
                            triggerDistribute({
                              assignmentId: assignment.id,
                              assignmentName: assignment.name,
                              price: assignment.price,
                              category: 'personalized',
                              namingMode: 'personalized',
                            })
                          }
                          title="إرسال مخصصاً بالاسم والبيانات لمشتركي هذا التكليف فقط"
                          style={{ opacity: isDistributing || isSelectionInvalid ? 0.6 : 1 }}
                        >
                          إرسال بالاسم والبيانات
                        </button>
                      ) : isPlain ? (
                        <button
                          type="button"
                          className="tier-action-btn plain"
                          disabled={isDistributing || isSelectionInvalid}
                          onClick={() =>
                            triggerDistribute({
                              assignmentId: assignment.id,
                              assignmentName: assignment.name,
                              price: assignment.price,
                              category: 'plain',
                              namingMode: 'plain',
                            })
                          }
                          title="إرسال باسم الملف الأصلي (بدون اسم) لمشتركي هذا التكليف فقط"
                          style={{ opacity: isDistributing || isSelectionInvalid ? 0.6 : 1 }}
                        >
                          إرسال كـ PDF (بدون اسم)
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="tier-action-btn unified"
                          disabled={isDistributing || isSelectionInvalid}
                          onClick={() =>
                            triggerDistribute({
                              assignmentId: assignment.id,
                              assignmentName: assignment.name,
                              price: assignment.price,
                              category: 'unified',
                              namingMode: 'plain',
                            })
                          }
                          title="إرسال موحد لمشتركي هذا التكليف"
                          style={{ opacity: isDistributing || isSelectionInvalid ? 0.6 : 1 }}
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

        {/* Close Button */}
        <button
          className="tier-cancel"
          disabled={isDistributing}
          onClick={() => setShowTierModal(false)}
          style={{ opacity: isDistributing ? 0.6 : 1, marginTop: '12px' }}
        >
          {isDistributing ? 'جاري التوزيع الآن...' : 'إغلاق النافذة'}
        </button>
      </div>
    </div>
  );
};
