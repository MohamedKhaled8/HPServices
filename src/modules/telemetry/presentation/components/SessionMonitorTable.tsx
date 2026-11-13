import React, { useState } from 'react';
import {
  Monitor,
  Smartphone,
  Tablet,
  Globe,
  Clock,
  RefreshCw,
  LogOut,
  ShieldAlert,
  Copy,
  Check,
  Network
} from 'lucide-react';
import type { TelemetrySession } from '../../domain/entities/TelemetrySession';
import { AggregateTimeSeriesUseCase } from '../../domain/usecases/AggregateTimeSeriesUseCase';
import { ManageSessionUseCase } from '../../domain/usecases/ManageSessionUseCase';

interface SessionMonitorTableProps {
  readonly sessions: readonly TelemetrySession[];
  readonly activeActionSessionId: string | null;
  readonly onKeepAlive: (sessionId: string) => Promise<void>;
  readonly onRevoke: (sessionId: string, revokeAllTokens: boolean) => Promise<void>;
}

function renderDeviceIcon(type: TelemetrySession['device']['deviceType']) {
  switch (type) {
    case 'Mobile':
      return <Smartphone size={18} color="var(--tel-accent)" />;
    case 'Tablet':
      return <Tablet size={18} color="var(--tel-success)" />;
    default:
      return <Monitor size={18} color="var(--tel-accent)" />;
  }
}

function deviceTypeAr(type: TelemetrySession['device']['deviceType']): string {
  switch (type) {
    case 'Mobile':
      return 'موبايل';
    case 'Tablet':
      return 'تابلت';
    case 'Desktop':
      return 'كمبيوتر';
    default:
      return 'جهاز';
  }
}

export const SessionMonitorTable: React.FC<SessionMonitorTableProps> = ({
  sessions,
  activeActionSessionId,
  onKeepAlive,
  onRevoke
}) => {
  const [copiedSessionId, setCopiedSessionId] = useState<string | null>(null);
  const nowMs = Date.now();

  const handleCopyIp = (sessionId: string, ip: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(ip).catch(() => {});
    }
    setCopiedSessionId(sessionId);
    window.setTimeout(() => {
      setCopiedSessionId((prev) => (prev === sessionId ? null : prev));
    }, 1800);
  };

  return (
    <section className="tel-card" aria-label="الأجهزة المتصلة بلوحة الإدارة">
      <div className="tel-card-header">
        <h2 className="tel-card-title">
          <Monitor size={19} color="var(--tel-accent)" />
          الأجهزة المتصلة بلوحة الإدارة ({sessions.length})
        </h2>
        <span className="tel-pill info">تحكم مباشر عن بُعد</span>
      </div>

      <div className="tel-helper-box">
        يظهر هنا كل جهاز دخل لوحة الإدارة مع عنوان IP الدقيق الخاص به، نوع الجهاز، المتصفح، المدينة، والوقت بالثانية مع إمكانية التمديد أو الطرد الفوري.
      </div>

      {sessions.length === 0 ? (
        <p style={{ color: 'var(--tel-text-muted)', fontSize: '0.88rem', margin: '12px 0' }}>
          لا توجد أجهزة مسجلة بعد. بمجرد دخولك أو دخول المشرف الرئيسي سيظهر الجهاز وعنوان IP الخاص به هنا تلقائياً.
        </p>
      ) : (
        <div className="tel-session-grid">
          {sessions.map((session) => {
            const isBusy = activeActionSessionId === session.sessionId;
            const remSec = ManageSessionUseCase.computeRemainingLeaseSeconds(session, nowMs);
            const remMins = Math.floor(remSec / 60);
            const remRemSec = remSec % 60;
            const isCopied = copiedSessionId === session.sessionId;

            return (
              <article key={session.sessionId} className="tel-session-card">
                <div className="tel-session-top">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: 10,
                        background: 'var(--tel-accent-soft)',
                        border: '1px solid var(--tel-border-strong)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0
                      }}
                    >
                      {renderDeviceIcon(session.device.deviceType)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.94rem', color: 'var(--tel-text)' }}>
                        {session.device.deviceName} ({deviceTypeAr(session.device.deviceType)})
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--tel-text-muted)' }}>
                        {session.device.os} • {session.device.browser}
                        {session.device.screenResolution
                          ? ` • ${session.device.screenResolution}`
                          : ''}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`tel-pill ${
                      session.status === 'active'
                        ? 'ok'
                        : session.status === 'revoked'
                          ? 'danger'
                          : 'warn'
                    }`}
                  >
                    {session.status === 'active'
                      ? 'متصل الآن'
                      : session.status === 'revoked'
                        ? 'تم إخراجه'
                        : 'منتهي'}
                  </span>
                </div>

                {/* Prominent IP Banner */}
                <div className="tel-ip-banner">
                  <span className="tel-ip-label">
                    <Network size={15} />
                    عنوان IP الجهاز:
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="tel-ip-value">{session.geo.ip || 'غير متاح'}</span>
                    <button
                      type="button"
                      className="tel-btn sm"
                      onClick={() => handleCopyIp(session.sessionId, session.geo.ip || '')}
                      title="نسخ عنوان IP"
                      aria-label={`نسخ عنوان IP ${session.geo.ip}`}
                    >
                      {isCopied ? <Check size={13} color="var(--tel-success)" /> : <Copy size={13} />}
                      {isCopied ? 'تم النسخ' : 'نسخ'}
                    </button>
                  </div>
                </div>

                <div className="tel-session-meta-grid">
                  <div>
                    <strong>نوع الحساب:</strong>{' '}
                    {session.role === 'telemetry_admin' ? 'مشرف المتابعة' : 'الإدارة الرئيسية'}
                  </div>
                  <div>
                    <strong>المدة المتبقية:</strong>{' '}
                    {session.status === 'active'
                      ? `${remMins} دقيقة و ${remRemSec} ثانية`
                      : 'غير متصل'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Globe size={13} color="var(--tel-accent)" />
                    <span>
                      {session.geo.city}, {session.geo.country}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <Clock size={13} color="var(--tel-text-muted)" />
                    <span className="tel-mono">
                      {AggregateTimeSeriesUseCase.formatExactTimestamp(session.lastSeenAtMs)}
                    </span>
                  </div>
                </div>

                <div className="tel-session-actions">
                  <button
                    type="button"
                    className="tel-btn sm success"
                    disabled={isBusy || session.status === 'revoked'}
                    onClick={() => void onKeepAlive(session.sessionId)}
                  >
                    <RefreshCw size={13} />
                    إبقاء الجلسة نشطة (+30 د)
                  </button>

                  <button
                    type="button"
                    className="tel-btn sm danger"
                    disabled={isBusy || session.status === 'revoked'}
                    onClick={() => void onRevoke(session.sessionId, false)}
                  >
                    <LogOut size={13} />
                    إخراج الجهاز فوراً
                  </button>

                  <button
                    type="button"
                    className="tel-btn sm danger"
                    disabled={isBusy}
                    onClick={() => void onRevoke(session.sessionId, true)}
                    title="إلغاء كل جلسات هذا الحساب من كافة الأجهزة"
                  >
                    <ShieldAlert size={13} />
                    تسجيل خروج شامل
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
