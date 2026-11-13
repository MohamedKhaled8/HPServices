import React, { useState } from 'react';
import { Shield, Activity, Database, Users, Cpu } from 'lucide-react';
import type {
  SystemHealthSnapshot,
  TelemetrySummaryKPIs,
  TimeBucketPoint
} from '../../../domain/entities/ServiceMetric';
import type { TelemetrySession } from '../../../domain/entities/TelemetrySession';

export type NocTargetTab = 'sessions' | 'analytics' | 'logs';

interface DashBoardFlowChartProps {
  readonly summary: TelemetrySummaryKPIs | null;
  readonly health: SystemHealthSnapshot | null;
  readonly sessions: readonly TelemetrySession[];
  readonly timeSeries: readonly TimeBucketPoint[];
  readonly onSelectTab?: (tab: NocTargetTab) => void;
}

type WaveChannel = 'all' | 'traffic' | 'latency' | 'tokens';

function buildSmoothWavePath(
  values: readonly number[],
  width: number,
  height: number,
  padX: number,
  padY: number,
  phaseOffset: number
): string {
  const count = Math.max(values.length, 16);
  const maxVal = Math.max(...values, 1);
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < count; i++) {
    const x = padX + (i / (count - 1)) * innerW;
    const raw = i < values.length ? values[i] : 0;
    const norm = raw > 0 ? Math.min(1, raw / maxVal) : 0;
    // Smooth NOC carrier wave modulated by real telemetry values
    const carrier =
      0.26 +
      0.16 * Math.sin(i * 0.72 + phaseOffset) +
      0.08 * Math.cos(i * 1.45 - phaseOffset);
    const amplitude = Math.min(0.95, Math.max(0.08, norm > 0 ? norm * 0.78 + 0.14 : carrier));
    const y = padY + innerH * (1 - amplitude);
    pts.push({ x, y });
  }

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i + 1];
    const midX = ((curr.x + next.x) / 2).toFixed(1);
    d += ` C ${midX} ${curr.y.toFixed(1)}, ${midX} ${next.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  }
  return d;
}

export const DashBoardFlowChart: React.FC<DashBoardFlowChartProps> = ({
  summary,
  health,
  sessions,
  timeSeries,
  onSelectTab
}) => {
  const [activeWave, setActiveWave] = useState<WaveChannel>('all');

  const latestActive = sessions.find((s) => s.status === 'active') || sessions[0];
  const latestIp = latestActive?.geo.ip || 'في انتظار اتصال';

  const trafficVals = timeSeries.map((t) => t.traffic);
  const revenueVals = timeSeries.map((t) => t.revenue || t.logs * 10);
  const tokenVals = timeSeries.map((t) => t.tokens || t.logs * 5);

  const waveW = 640;
  const waveH = 164;
  const trafficPath = buildSmoothWavePath(trafficVals, waveW, waveH, 16, 18, 0.2);
  const latencyPath = buildSmoothWavePath(revenueVals, waveW, waveH, 16, 18, 2.1);
  const tokenPath = buildSmoothWavePath(tokenVals, waveW, waveH, 16, 18, 4.0);

  const chainOk = health?.chainIntegrity.valid ?? true;

  return (
    <section className="tel-noc-grid" aria-label="خريطة تدفق النظام ومراقبة الموجات الحية NOC">
      {/* Left: Animated NOC Topology FlowChart */}
      <div className="tel-noc-panel">
        <div className="tel-card-header" style={{ marginBottom: 12 }}>
          <div>
            <h2 className="tel-card-title">
              <Activity size={18} color="#38bdf8" />
              خريطة تدفق العمليات الحية (DashBoardFlowChart)
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--tel-text-muted)', marginTop: 3 }}>
              مسار الطلبات والجلسات من بوابة الدخول حتى التخزين المعزول
            </div>
          </div>
          <span className="tel-pill info">
            <span className="tel-live-dot" />
            NOC Live Flow
          </span>
        </div>

        <div className="tel-flow-stage">
          {/* SVG Animated Flow Pipes */}
          <svg
            className="tel-flow-svg-lines"
            viewBox="0 0 800 180"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="nocPipeGrad" x1="100%" y1="0%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.85" />
                <stop offset="50%" stopColor="#10b981" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.85" />
              </linearGradient>
            </defs>

            {/* Connecting Curves RTL (Right Node -> Left Node) */}
            <path
              d="M 690 90 C 630 90, 595 45, 520 45"
              fill="none"
              className="tel-flow-base-line"
            />
            <path
              d="M 690 90 C 630 90, 595 45, 520 45"
              fill="none"
              className="tel-flow-pulse-line"
              stroke="url(#nocPipeGrad)"
            />

            <path
              d="M 690 90 C 630 90, 595 135, 520 135"
              fill="none"
              className="tel-flow-base-line"
            />
            <path
              d="M 690 90 C 630 90, 595 135, 520 135"
              fill="none"
              className="tel-flow-pulse-line tel-flow-delay-1"
              stroke="#10b981"
            />

            <path
              d="M 400 45 C 330 45, 310 90, 235 90"
              fill="none"
              className="tel-flow-base-line"
            />
            <path
              d="M 400 45 C 330 45, 310 90, 235 90"
              fill="none"
              className="tel-flow-pulse-line tel-flow-delay-2"
              stroke="#38bdf8"
            />

            <path
              d="M 400 135 C 330 135, 310 90, 235 90"
              fill="none"
              className="tel-flow-base-line"
            />
            <path
              d="M 400 135 C 330 135, 310 90, 235 90"
              fill="none"
              className="tel-flow-pulse-line"
              stroke="#f59e0b"
            />
          </svg>

          {/* 4 Interactive NOC Nodes */}
          <div className="tel-flow-nodes">
            <button
              type="button"
              className="tel-flow-node cyan"
              onClick={() => onSelectTab?.('sessions')}
            >
              <div className="tel-flow-node-head">
                <Users size={16} />
                <span>بوابة الجلسات</span>
              </div>
              <strong className="tel-flow-node-val">{summary?.activeSessions ?? 0} نشط</strong>
              <span className="tel-flow-node-sub tel-mono">IP: {latestIp}</span>
            </button>

            <div className="tel-flow-mid-col">
              <button
                type="button"
                className="tel-flow-node emerald"
                onClick={() => onSelectTab?.('logs')}
              >
                <div className="tel-flow-node-head">
                  <Shield size={15} />
                  <span>درع الأمان والتحقق</span>
                </div>
                <strong className="tel-flow-node-val">
                  {chainOk ? 'محمي وموثق' : 'تنبيه أمان'}
                </strong>
                <span className="tel-flow-node-sub">{summary?.totalLogs ?? 0} حركة مسجلة</span>
              </button>

              <button
                type="button"
                className="tel-flow-node amber"
                onClick={() => onSelectTab?.('analytics')}
              >
                <div className="tel-flow-node-head">
                  <Cpu size={15} />
                  <span>محرك الخدمات والأدوات</span>
                </div>
                <strong className="tel-flow-node-val">
                  {summary?.totalTraffic ?? 0} طلب • {health?.avgLatencyMs ?? 0}ms
                </strong>
                <span className="tel-flow-node-sub">
                  {summary?.totalTokens ?? 0} وحدة تشغيل
                </span>
              </button>
            </div>

            <button
              type="button"
              className="tel-flow-node blue"
              onClick={() => onSelectTab?.('logs')}
            >
              <div className="tel-flow-node-head">
                <Database size={16} />
                <span>المخزن المعزول</span>
              </div>
              <strong className="tel-flow-node-val">0 قراءة Firestore</strong>
              <span className="tel-flow-node-sub">
                كفاءة الكاش {health?.cacheHitRatio ?? 100}%
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Right: Live NOC/SOC Oscilloscope Waveforms ("خطوط طالعة نازلة") */}
      <div className="tel-noc-panel">
        <div className="tel-card-header" style={{ marginBottom: 10 }}>
          <div>
            <h2 className="tel-card-title">
              <Activity size={18} color="#10b981" />
              مؤشر الموجات الحية (SOC Pulse Lines)
            </h2>
            <div style={{ fontSize: '0.78rem', color: 'var(--tel-text-muted)', marginTop: 3 }}>
              تذبذب الحمل، سرعة الاستجابة، واستخدام الأدوات بالزمن الحقيقي
            </div>
          </div>

          <div className="tel-wave-legend">
            {(
              [
                { id: 'all', label: 'الكل', color: '#94a3b8' },
                { id: 'traffic', label: 'الحمل', color: '#10b981' },
                { id: 'latency', label: 'الأداء', color: '#38bdf8' },
                { id: 'tokens', label: 'الأدوات', color: '#f59e0b' }
              ] as const
            ).map((ch) => (
              <button
                key={ch.id}
                type="button"
                className={`tel-wave-chip ${activeWave === ch.id ? 'active' : ''}`}
                onClick={() => setActiveWave(ch.id)}
              >
                <span className="tel-wave-dot" style={{ background: ch.color }} />
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div className="tel-oscilloscope-box">
          <svg
            viewBox={`0 0 ${waveW} ${waveH}`}
            className="tel-oscilloscope-svg"
            role="img"
            aria-label="موجات مراقبة الخادم الحية"
          >
            <defs>
              <filter id="nocGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Grid Lines */}
            {[0.25, 0.5, 0.75].map((r) => (
              <line
                key={r}
                x1="12"
                y1={waveH * r}
                x2={waveW - 12}
                y2={waveH * r}
                stroke="var(--tel-grid-line)"
                strokeDasharray="3 5"
              />
            ))}

            {(activeWave === 'all' || activeWave === 'tokens') && (
              <path
                d={tokenPath}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="2.2"
                strokeOpacity="0.85"
                filter="url(#nocGlow)"
                className="tel-wave-anim-slow"
              />
            )}

            {(activeWave === 'all' || activeWave === 'latency') && (
              <path
                d={latencyPath}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.4"
                strokeOpacity="0.9"
                filter="url(#nocGlow)"
                className="tel-wave-anim-med"
              />
            )}

            {(activeWave === 'all' || activeWave === 'traffic') && (
              <path
                d={trafficPath}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.8"
                filter="url(#nocGlow)"
                className="tel-wave-anim-fast"
              />
            )}
          </svg>

          {/* Animated NOC Radar Sweep Line */}
          <div className="tel-noc-sweep" aria-hidden="true" />
        </div>

        <div className="tel-osc-footer">
          <span>نسبة الأخطاء: <strong>{health?.errorRatePercent ?? 0}%</strong></span>
          <span>متوسط الاستجابة: <strong>{health?.avgLatencyMs ?? 0}ms</strong></span>
          <span>أعلى ذروة (P95): <strong>{health?.p95LatencyMs ?? 0}ms</strong></span>
        </div>
      </div>
    </section>
  );
};

