import React from 'react';
import { CheckCircle, AlertCircle, X } from 'lucide-react';

export interface DistributionProgressInfo {
  active: boolean;
  status: 'running' | 'completed' | 'error';
  title: string;
  current: number;
  total: number;
  percent: number;
  studentName?: string;
  updatedAt: number;
  error?: string;
}

export interface DistributionProgressToastProps {
  distProgress: DistributionProgressInfo | null;
  updateProgress: (info: DistributionProgressInfo | null) => void;
}

export const DistributionProgressToast: React.FC<DistributionProgressToastProps> = ({
  distProgress,
  updateProgress
}) => {
  if (!distProgress || !distProgress.active) {
    return null;
  }

  return (
        <div className="distribution-progress-toast" role="status" aria-live="polite">
          <div className="dist-prog-header">
            <div className="dist-prog-title-wrap">
              {distProgress.status === 'running' && <span className="dist-prog-spinner" />}
              {distProgress.status === 'completed' && <CheckCircle size={16} color="#34d399" />}
              {distProgress.status === 'error' && <AlertCircle size={16} color="#f87171" />}
              <span className="dist-prog-title" title={distProgress.title}>
                {distProgress.status === 'running'
                  ? `جاري الإرسال: ${distProgress.title}`
                  : distProgress.status === 'completed'
                  ? `اكتمل الإرسال: ${distProgress.title}`
                  : `تعذر الإرسال: ${distProgress.title}`}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="dist-prog-pct">{distProgress.percent}%</span>
              <button
                type="button"
                className="dist-prog-close-btn"
                onClick={() => updateProgress(null)}
                title="إغلاق التنبيه"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="dist-prog-bar-track">
            <div
              className="dist-prog-bar-fill"
              style={{
                width: `${Math.min(100, Math.max(0, distProgress.percent))}%`,
                background:
                  distProgress.status === 'error'
                    ? '#ef4444'
                    : distProgress.status === 'completed'
                    ? '#10b981'
                    : undefined
              }}
            />
          </div>

          <div className={`dist-prog-subtext ${distProgress.status}`}>
            {distProgress.status === 'running' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>
                    تم إرسال {distProgress.current} من أصل {distProgress.total} طالب
                  </span>
                  <span style={{ fontSize: '10px', color: '#64748b' }}>يعمل ومحفوظ بالمتصفح</span>
                </div>
                {distProgress.studentName && (
                  <span className="dist-prog-curr-student">{distProgress.studentName}</span>
                )}
              </>
            )}

            {distProgress.status === 'completed' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>تم إرسال كافة الملفات بنجاح ({distProgress.current} طالب)</span>
                <button
                  type="button"
                  className="dist-prog-dismiss-link"
                  onClick={() => updateProgress(null)}
                >
                  تم
                </button>
              </div>
            )}

            {distProgress.status === 'error' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                <span>{distProgress.error || 'حدث خطأ أثناء الإرسال'}</span>
                <button
                  type="button"
                  className="dist-prog-dismiss-link"
                  style={{ background: '#ef4444' }}
                  onClick={() => updateProgress(null)}
                >
                  إغلاق
                </button>
              </div>
            )}
          </div>
        </div>
  );
};
