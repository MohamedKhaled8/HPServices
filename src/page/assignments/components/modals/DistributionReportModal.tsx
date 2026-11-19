import React from 'react';
import {
  CheckCircle2,
  Users,
  UserPlus,
  UserCheck,
  ShieldCheck,
  FileText,
  AlertTriangle,
  X,
  Layers,
} from 'lucide-react';
import { DistributionReport } from '../../../../types';

export interface DistributionReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DistributionReport | null;
  trackName?: string;
}

export const DistributionReportModal: React.FC<DistributionReportModalProps> = ({
  isOpen,
  onClose,
  report,
  trackName,
}) => {
  if (!isOpen || !report) {
    return null;
  }

  const breakdownEntries = Object.entries(report.specializationBreakdown || {}).sort(
    (a, b) => b[1].studentCount - a[1].studentCount
  );

  return (
    <div className="tier-modal-overlay" onClick={onClose} style={{ zIndex: 100000 }}>
      <div
        className="tier-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '720px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          textAlign: 'right',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid #f1f5f9',
            paddingBottom: '16px',
            marginBottom: '18px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={24} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: '#0f172a' }}>
                تقرير عملية توزيع التكليفات الذكية
              </h3>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                {trackName ? `نتائج التوزيع في ${trackName}` : 'نتائج التوزيع الشامل والمخصص'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: '#f1f5f9',
              border: 'none',
              borderRadius: '50%',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#64748b',
              transition: 'background 0.2s',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ overflowY: 'auto', paddingRight: '4px', flex: 1 }}>
          {/* Summary Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
              gap: '10px',
              marginBottom: '20px',
            }}
          >
            {/* Total Targeted */}
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <Users size={14} />
                <span>إجمالي المستهدفين</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e293b' }}>
                {report.totalTargeted}
              </div>
            </div>

            {/* New Students (Full Delivery) */}
            <div
              style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#166534',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <UserPlus size={14} />
                <span>طلاب جدد (كامل)</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                {report.newStudentsCount}
              </div>
            </div>

            {/* Old Students (Completed Missing) */}
            <div
              style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#1e40af',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <UserCheck size={14} />
                <span>استكمال الناقص</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#2563eb' }}>
                {report.completedOldStudentsCount}
              </div>
            </div>

            {/* Skipped Students (Already Complete) */}
            <div
              style={{
                background: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#6b21a8',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <ShieldCheck size={14} />
                <span>مكتملون (تم تجاوزهم)</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#7e22ce' }}>
                {report.skippedStudentsCount}
              </div>
            </div>

            {/* Total Sent Assignments */}
            <div
              style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '12px',
                padding: '12px',
                textAlign: 'center',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                  color: '#92400e',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginBottom: '4px',
                }}
              >
                <FileText size={14} />
                <span>إجمالي التكليفات المرسلة</span>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#b45309' }}>
                {report.totalSentAssignments}
              </div>
            </div>
          </div>

          {/* Failures Alert (if any) */}
          {report.failedCount > 0 && (
            <div
              style={{
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '18px',
                color: '#991b1b',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, marginBottom: '6px' }}>
                <AlertTriangle size={18} />
                <span>تنبيه: تعذر إرسال التكليفات لـ {report.failedCount} طالب</span>
              </div>
              {report.failureReasons && report.failureReasons.length > 0 && (
                <ul style={{ margin: 0, paddingRight: '20px', fontSize: '12px', lineHeight: 1.6 }}>
                  {report.failureReasons.slice(0, 5).map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                  {report.failureReasons.length > 5 && (
                    <li>... والمزيد ({report.failureReasons.length - 5} أخطاء أخرى)</li>
                  )}
                </ul>
              )}
            </div>
          )}

          {/* Specialization Breakdown Table */}
          <div style={{ marginBottom: '16px' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '10px',
                color: '#334155',
                fontSize: '14px',
                fontWeight: 700,
              }}
            >
              <Layers size={16} />
              <span>تفاصيل الإرسال حسب التخصصات:</span>
            </div>

            {breakdownEntries.length === 0 ? (
              <p style={{ color: '#94a3b8', fontSize: '13px', textAlign: 'center', margin: '20px 0' }}>
                لا توجد بيانات تفصيلية للتخصصات
              </p>
            ) : (
              <div
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  background: '#ffffff',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', direction: 'rtl' }}>
                  <thead>
                    <tr style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#64748b' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700 }}>التخصص</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>عدد الطلاب</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>التكليفات المرسلة</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {breakdownEntries.map(([specName, data], index) => {
                      const isEven = index % 2 === 0;
                      return (
                        <tr
                          key={specName}
                          style={{
                            background: isEven ? '#ffffff' : '#fcfcfd',
                            borderBottom: '1px solid #f1f5f9',
                          }}
                        >
                          <td style={{ padding: '10px 14px', fontWeight: 600, color: '#1e293b' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: '6px',
                                background: '#f1f5f9',
                                color: '#334155',
                                fontSize: '12px',
                              }}
                            >
                              {specName}
                            </span>
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569' }}>
                            {data.studentCount} طالب
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: '#059669' }}>
                            {data.sentCount} تكليف
                          </td>
                          <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                            {data.sentCount > 0 ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                  fontWeight: 600,
                                }}
                              >
                                تم الإرسال
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '11px',
                                  padding: '2px 8px',
                                  borderRadius: '9999px',
                                  background: '#f1f5f9',
                                  color: '#64748b',
                                  fontWeight: 600,
                                }}
                              >
                                مكتمل مسبقاً
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#f8fafc', borderTop: '2px solid #e2e8f0', fontWeight: 700 }}>
                      <td style={{ padding: '10px 14px', color: '#0f172a' }}>الإجمالي الكلي</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#0f172a' }}>
                        {report.totalTargeted} طالب
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#059669' }}>
                        {report.totalSentAssignments} تكليف
                      </td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', color: '#64748b', fontSize: '12px' }}>
                        100% تم الفحص
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            borderTop: '1px solid #f1f5f9',
            paddingTop: '14px',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            className="tier-button tier-plain"
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              width: 'auto',
              minWidth: '140px',
            }}
          >
            إغلاق التقرير
          </button>
        </div>
      </div>
    </div>
  );
};

