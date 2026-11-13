import React from 'react';
import { List, type RowComponentProps } from 'react-window';
import { AutoSizer } from 'react-virtualized-auto-sizer';
import { ShieldCheck, ShieldAlert, Server } from 'lucide-react';
import type { AuditLogEntry } from '../../domain/entities/AuditLogEntry';
import type { SystemHealthSnapshot } from '../../domain/entities/ServiceMetric';
import { AggregateTimeSeriesUseCase } from '../../domain/usecases/AggregateTimeSeriesUseCase';

interface AuditLogStreamPanelProps {
  readonly health: SystemHealthSnapshot | null;
  readonly logs: readonly AuditLogEntry[];
}

interface AuditRowProps {
  readonly logs: readonly AuditLogEntry[];
}

function severityLabelAr(sev: AuditLogEntry['severity']): { label: string; badgeClass: string } {
  switch (sev) {
    case 'critical':
      return { label: 'حرج', badgeClass: 'danger' };
    case 'error':
      return { label: 'خطأ', badgeClass: 'danger' };
    case 'warn':
      return { label: 'تنبيه', badgeClass: 'warn' };
    default:
      return { label: 'عادي', badgeClass: 'ok' };
  }
}

const ACTION_LABELS_AR: Record<string, string> = {
  TELEMETRY_LOGIN_SUCCESS: 'دخول مشرف المتابعة',
  TELEMETRY_LOGIN_DENIED: 'محاولة دخول مرفوضة',
  TELEMETRY_RBAC_VIOLATION: 'محاولة وصول غير مصرحة',
  ADMIN_SESSION_STARTED: 'فتح جلسة إدارة جديدة',
  ADMIN_SESSION_LOGOUT: 'تسجيل خروج من الإدارة',
  SESSION_KEPT_ALIVE: 'تمديد صلاحية جلسة',
  SESSION_FORCE_REVOKED: 'إخراج جهاز قسراً',
  CREDENTIAL_ROTATION_EXECUTED: 'تغيير بيانات الدخول السرية',
  SERVICE_REQUEST_SUBMITTED: 'تقديم طلب خدمة جديد',
  SERVICE_ORDER_COMPLETED: 'اكتمال طلب خدمة',
  OCR_EXTRACTION_OK: 'استخراج بيانات صورة بنجاح',
  OCR_EXTRACTION_FAILED: 'تعذر قراءة صورة مستند',
  CHATBOT_QA_SERVED: 'رد تلقائي من الشات بوت',
  TELEMETRY_BACKUP_SEEDED: 'استيراد سجل تاريخي من الباك أب'
};

const AuditLogRow = ({ index, style, logs }: RowComponentProps<AuditRowProps>) => {
  const entry = logs[index];
  if (!entry) return null;

  const sev = severityLabelAr(entry.severity);
  const actionTitle = ACTION_LABELS_AR[entry.action] || entry.action;

  return (
    <div style={style} className="tel-log-row">
      <span className="tel-mono" style={{ color: 'var(--tel-text-muted)' }}>
        {AggregateTimeSeriesUseCase.formatExactTimestamp(entry.timestampMs)}
      </span>
      <span className={`tel-pill ${sev.badgeClass}`} style={{ justifyContent: 'center' }}>
        {sev.label}
      </span>
      <span className="tel-log-msg" title={`${actionTitle} — ${entry.message}`}>
        <strong style={{ color: 'var(--tel-accent)' }}>{actionTitle}</strong>
        {' — '}
        <span style={{ color: 'var(--tel-text)' }}>{entry.message}</span>
      </span>
      <span className="tel-mono tel-log-hide-mobile" style={{ color: 'var(--tel-text-muted)' }}>
        {entry.ip}
      </span>
    </div>
  );
};

export const AuditLogStreamPanel: React.FC<AuditLogStreamPanelProps> = ({ health, logs }) => {
  const chainValid = health?.chainIntegrity.valid ?? true;

  return (
    <section className="tel-card" aria-label="سجل الحركات وحالة الخادم">
      <div className="tel-card-header">
        <h2 className="tel-card-title">
          <Server size={18} color="var(--tel-success)" />
          سجل الحركات والأمان وصحة النظام
        </h2>

        <span className={`tel-pill ${chainValid ? 'ok' : 'danger'}`}>
          {chainValid ? <ShieldCheck size={14} /> : <ShieldAlert size={14} />}
          {chainValid
            ? `السجلات سليمة ومحمية من التلاعب (${health?.chainIntegrity.checkedCount || 0} سجل)`
            : 'تنبيه: تم اكتشاف تعديل غير مصرح في السجل'}
        </span>
      </div>

      <div className="tel-health-strip">
        <div className="tel-health-cell">
          <div className="tel-health-label">سرعة استجابة الخادم</div>
          <div className="tel-health-val">{health?.avgLatencyMs ?? 0} مللي ثانية</div>
        </div>
        <div className="tel-health-cell">
          <div className="tel-health-label">نسبة الأخطاء</div>
          <div
            className="tel-health-val"
            style={{ color: (health?.errorRatePercent ?? 0) > 5 ? 'var(--tel-danger)' : 'var(--tel-success)' }}
          >
            {health?.errorRatePercent ?? 0}%
          </div>
        </div>
        <div className="tel-health-cell">
          <div className="tel-health-label">كفاءة الذاكرة المؤقتة</div>
          <div className="tel-health-val" style={{ color: 'var(--tel-accent)' }}>
            {health?.cacheHitRatio ?? 100}%
          </div>
        </div>
        <div className="tel-health-cell">
          <div className="tel-health-label">الضغط على Firestore الرئيسي</div>
          <div className="tel-health-val" style={{ color: 'var(--tel-success)' }}>
            {health?.firestoreReadsUsed ?? 0} قراءة
          </div>
        </div>
      </div>

      <div className="tel-log-viewport">
        {logs.length === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--tel-text-muted)',
              fontSize: '0.88rem'
            }}
          >
            لا توجد سجلات مطابقة لخيارات البحث الحالية.
          </div>
        ) : (
          <AutoSizer
            renderProp={({ height, width }) =>
              height && width ? (
                <List<AuditRowProps>
                  rowComponent={AuditLogRow}
                  rowCount={logs.length}
                  rowHeight={48}
                  rowProps={{ logs }}
                  style={{ height, width }}
                />
              ) : null
            }
          />
        )}
      </div>
    </section>
  );
};
