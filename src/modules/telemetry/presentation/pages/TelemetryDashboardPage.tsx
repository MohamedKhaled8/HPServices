import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  RefreshCw,
  Database,
  LogOut,
  Users,
  DollarSign,
  Activity,
  FileText,
  Monitor,
  BarChart2,
  Sun,
  Moon,
  X
} from 'lucide-react';
import { TelemetryProvider } from '../../application/TelemetryContext';
import { useTelemetryDashboard } from '../../application/useTelemetryDashboard';
import {
  clearTrackedSessionId,
  getCurrentTrackedSessionId,
  useAdminSessionGuard
} from '../../application/useAdminSessionGuard';
import { HttpSessionRepository } from '../../infrastructure/repositories/HttpTelemetryRepositories';
import { AggregateTimeSeriesUseCase } from '../../domain/usecases/AggregateTimeSeriesUseCase';
import { SessionMonitorTable } from '../components/SessionMonitorTable';
import { TimeGranularityFilterBar } from '../components/TimeGranularityFilterBar';
import { ServiceAnalyticsSection } from '../components/ServiceAnalyticsSection';
import { AuditLogStreamPanel } from '../components/AuditLogStreamPanel';
import {
  DashBoardFlowChart,
  type NocTargetTab
} from '../components/charts/DashBoardFlowChart';
import '../styles/telemetryDashboard.css';

interface TelemetryDashboardPageProps {
  readonly onLogout: () => Promise<void> | void;
}

const THEME_STORAGE_KEY = 'hp_telemetry_theme';

const TelemetryDashboardInner: React.FC<TelemetryDashboardPageProps> = ({ onLogout }) => {
  const [activeTab, setActiveTab] = useState<NocTargetTab>('sessions');
  const [isLightMode, setIsLightMode] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem(THEME_STORAGE_KEY) === 'light';
    } catch {
      return false;
    }
  });
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const trackedSessionId = useAdminSessionGuard(true, onLogout);
  const {
    state,
    updateFilter,
    refreshNow,
    keepSessionAlive,
    revokeSession,
    seedFromSupabaseBackup,
    setAutoRefreshInterval,
    clearMessages,
    topSellingRanked,
    highestTrafficRanked,
    tokenLeaderboardRanked
  } = useTelemetryDashboard();

  const toggleTheme = () => {
    setIsLightMode((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? 'light' : 'dark');
      } catch {
        // ignore storage quota errors
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const sid = getCurrentTrackedSessionId() || trackedSessionId;
    if (sid) {
      // Non-blocking network cleanup with short timeout safeguard so logout never hangs
      void new HttpSessionRepository().logoutSession(sid).catch(() => {});
    }
    clearTrackedSessionId();
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const { snapshot } = state;

  return (
    <div
      className={isLightMode ? 'tel-shell tel-light' : 'tel-shell'}
      style={{
        backgroundColor: isLightMode ? '#f4f7fb' : '#050a14',
        color: isLightMode ? '#0f172a' : '#f8fafc',
        minHeight: '100vh'
      }}
    >
      <div className="tel-container">
        <motion.header
          className="tel-header"
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div className="tel-brand">
            <div className="tel-brand-icon">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="tel-title">مركز المتابعة والأمان NOC / SOC</h1>
              <div className="tel-subtitle">
                <span className="tel-pill ok">
                  <span className="tel-live-dot" />
                  معزول عن قاعدة البيانات الرئيسية
                </span>
                <span>لا يستهلك AI Tokens أو قراءات Firestore</span>
                {state.lastUpdatedAtMs && (
                  <span className="tel-mono">
                    آخر تحديث: {AggregateTimeSeriesUseCase.formatExactTimestamp(state.lastUpdatedAtMs)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="tel-header-actions">
            <button
              type="button"
              className="tel-btn sm"
              onClick={toggleTheme}
              title={isLightMode ? 'التبديل إلى الوضع الداكن NOC' : 'التبديل إلى الوضع الفاتح'}
            >
              {isLightMode ? <Moon size={14} /> : <Sun size={14} />}
              {isLightMode ? 'الوضع الداكن' : 'الوضع الفاتح'}
            </button>

            <select
              className="tel-select"
              aria-label="وضع التحديث"
              value={state.autoRefreshIntervalMs}
              onChange={(e) => setAutoRefreshInterval(Number(e.target.value))}
            >
              <option value={0}>تحديث يدوي (بدون استهلاك)</option>
              <option value={30000}>تحديث كل 30 ثانية</option>
              <option value={60000}>تحديث كل دقيقة</option>
            </select>

            <button
              type="button"
              className="tel-btn"
              disabled={state.isSeeding}
              onClick={() => void seedFromSupabaseBackup()}
              title="استيراد إحصائيات الطلبات القديمة من نسخة Supabase إن وُجدت"
            >
              <Database size={15} />
              {state.isSeeding ? 'جاري الاستيراد...' : 'استيراد سجل قديم'}
            </button>

            <button
              type="button"
              className="tel-btn primary"
              disabled={state.isRefreshing}
              onClick={() => void refreshNow()}
            >
              <RefreshCw size={15} />
              {state.isRefreshing ? 'جاري التحديث...' : 'تحديث الآن'}
            </button>

            <button
              type="button"
              className="tel-btn danger"
              disabled={isLoggingOut}
              onClick={() => void handleSignOut()}
            >
              <LogOut size={15} />
              {isLoggingOut ? 'جاري الخروج...' : 'تسجيل الخروج'}
            </button>
          </div>
        </motion.header>

        {state.errorMessage && (
          <div className="tel-banner error" role="alert">
            <span>{state.errorMessage}</span>
            <button type="button" className="tel-btn sm" onClick={clearMessages}>
              <X size={13} />
            </button>
          </div>
        )}

        {state.noticeMessage && (
          <div className="tel-banner notice" role="status">
            <span>{state.noticeMessage}</span>
            <button type="button" className="tel-btn sm" onClick={clearMessages}>
              <X size={13} />
            </button>
          </div>
        )}

        {/* NOC Live FlowChart & Multi-Channel Pulse Oscilloscope */}
        <DashBoardFlowChart
          summary={snapshot?.summary ?? null}
          health={snapshot?.health ?? null}
          sessions={snapshot?.sessions ?? []}
          timeSeries={snapshot?.timeSeries ?? []}
          onSelectTab={setActiveTab}
        />

        {/* Simple 4-Card Summary */}
        <section className="tel-kpi-grid" aria-label="ملخص المتابعة">
          <div className="tel-kpi-card">
            <div className="tel-kpi-head">
              <span>الأجهزة المتصلة الآن</span>
              <Users size={17} color="#38bdf8" />
            </div>
            <div className="tel-kpi-value">{snapshot?.summary.activeSessions ?? 0}</div>
            <div className="tel-kpi-foot">إجمالي المسجل: {snapshot?.summary.totalSessions ?? 0}</div>
          </div>

          <div className="tel-kpi-card">
            <div className="tel-kpi-head">
              <span>إيرادات الخدمات المسجلة</span>
              <DollarSign size={17} color="#10b981" />
            </div>
            <div className="tel-kpi-value">
              {(snapshot?.summary.totalRevenue ?? 0).toLocaleString('en-US')} ج.م
            </div>
            <div className="tel-kpi-foot">
              طلبات مكتملة: {snapshot?.summary.totalSalesCount ?? 0}
            </div>
          </div>

          <div className="tel-kpi-card">
            <div className="tel-kpi-head">
              <span>طلبات وحركة الخدمات</span>
              <Activity size={17} color="#818cf8" />
            </div>
            <div className="tel-kpi-value">
              {(snapshot?.summary.totalTraffic ?? 0).toLocaleString('en-US')}
            </div>
            <div className="tel-kpi-foot">تفاعل مسجل في الفترة المختارة</div>
          </div>

          <div className="tel-kpi-card">
            <div className="tel-kpi-head">
              <span>سجلات الأمان والعمليات</span>
              <FileText size={17} color="#f59e0b" />
            </div>
            <div className="tel-kpi-value">{snapshot?.summary.totalLogs ?? 0}</div>
            <div className="tel-kpi-foot">مسجلة بالتوقيت الدقيق</div>
          </div>
        </section>

        {/* Clean 3-Tab Navigation */}
        <nav className="tel-tabs-bar" aria-label="أقسام مركز المتابعة">
          <button
            type="button"
            className={`tel-tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
            onClick={() => setActiveTab('sessions')}
          >
            <Monitor size={16} />
            الأجهزة المتصلة الآن
            <span className="tel-tab-count">{snapshot?.sessions.length ?? 0}</span>
          </button>

          <button
            type="button"
            className={`tel-tab-btn ${activeTab === 'analytics' ? 'active' : ''}`}
            onClick={() => setActiveTab('analytics')}
          >
            <BarChart2 size={16} />
            خريطة التدفق وأداء الخدمات
          </button>

          <button
            type="button"
            className={`tel-tab-btn ${activeTab === 'logs' ? 'active' : ''}`}
            onClick={() => setActiveTab('logs')}
          >
            <FileText size={16} />
            سجل الحركات والأمان
            <span className="tel-tab-count">{snapshot?.logs.length ?? 0}</span>
          </button>
        </nav>

        {/* Tab 1: Connected Admin Devices */}
        {activeTab === 'sessions' && (
          <SessionMonitorTable
            sessions={snapshot?.sessions ?? []}
            activeActionSessionId={state.activeSessionActionId}
            onKeepAlive={keepSessionAlive}
            onRevoke={revokeSession}
          />
        )}

        {/* Tab 2: Service Analytics */}
        {activeTab === 'analytics' && (
          <>
            <TimeGranularityFilterBar
              filter={state.filter}
              onChange={updateFilter}
              showLogFilters={false}
            />
            <ServiceAnalyticsSection
              topSelling={topSellingRanked}
              highestTraffic={highestTrafficRanked}
              tokenLeaderboard={tokenLeaderboardRanked}
              timeSeries={snapshot?.timeSeries ?? []}
              granularity={state.filter.granularity}
            />
          </>
        )}

        {/* Tab 3: System Health & Audit Logs */}
        {activeTab === 'logs' && (
          <>
            <TimeGranularityFilterBar
              filter={state.filter}
              onChange={updateFilter}
              showLogFilters={true}
            />
            <AuditLogStreamPanel health={snapshot?.health ?? null} logs={snapshot?.logs ?? []} />
          </>
        )}
      </div>
    </div>
  );
};

export const TelemetryDashboardPage: React.FC<TelemetryDashboardPageProps> = ({ onLogout }) => (
  <TelemetryProvider onSelfRevoked={onLogout}>
    <TelemetryDashboardInner onLogout={onLogout} />
  </TelemetryProvider>
);

export default TelemetryDashboardPage;
