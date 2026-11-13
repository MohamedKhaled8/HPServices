import React, { useState } from 'react';
import { TrendingUp, Activity, Cpu } from 'lucide-react';
import type { TimeBucketPoint, TimeGranularity } from '../../domain/entities/ServiceMetric';
import type { RankedMetricRow } from '../../domain/usecases/RankServiceLeaderboardsUseCase';
import { SvgTrendChart } from './charts/SvgTrendChart';

interface ServiceAnalyticsSectionProps {
  readonly topSelling: readonly RankedMetricRow[];
  readonly highestTraffic: readonly RankedMetricRow[];
  readonly tokenLeaderboard: readonly RankedMetricRow[];
  readonly timeSeries: readonly TimeBucketPoint[];
  readonly granularity: TimeGranularity;
}

interface LeaderboardPanelProps {
  readonly title: string;
  readonly subtitle: string;
  readonly icon: React.ReactNode;
  readonly rows: readonly RankedMetricRow[];
  readonly accentColor: string;
  readonly formatValue: (v: number) => string;
  readonly emptyText: string;
}

const LeaderboardPanel: React.FC<LeaderboardPanelProps> = ({
  title,
  subtitle,
  icon,
  rows,
  accentColor,
  formatValue,
  emptyText
}) => (
  <div className="tel-card" style={{ marginBottom: 0 }}>
    <div className="tel-card-header" style={{ marginBottom: 10 }}>
      <div>
        <h3 className="tel-card-title" style={{ fontSize: '0.96rem' }}>
          {icon}
          {title}
        </h3>
        <div style={{ fontSize: '0.76rem', color: 'var(--tel-text-muted)', marginTop: 3 }}>{subtitle}</div>
      </div>
      <span className="tel-pill">{rows.length} خدمة</span>
    </div>

    {rows.length === 0 ? (
      <p style={{ color: 'var(--tel-text-muted)', fontSize: '0.84rem', margin: '10px 0' }}>{emptyText}</p>
    ) : (
      <div className="tel-leaderboard-list">
        {rows.slice(0, 8).map((row) => (
          <div key={row.serviceId} className="tel-lb-row">
            <div className="tel-lb-top">
              <span className="tel-lb-name">
                <strong style={{ color: accentColor, marginLeft: 6 }}>#{row.rank}</strong>
                {row.serviceName}
              </span>
              <span className="tel-lb-val" style={{ color: accentColor }}>
                {formatValue(row.primaryValue)}
              </span>
            </div>
            <div className="tel-lb-bar-bg">
              <div
                className="tel-lb-bar-fill"
                style={{ width: `${Math.max(4, row.sharePercent)}%`, background: accentColor }}
              />
            </div>
            <div className="tel-lb-sub">{row.secondaryLabel}</div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export const ServiceAnalyticsSection: React.FC<ServiceAnalyticsSectionProps> = ({
  topSelling,
  highestTraffic,
  tokenLeaderboard,
  timeSeries,
  granularity
}) => {
  const [chartMetric, setChartMetric] = useState<'traffic' | 'revenue' | 'tokens' | 'logs'>(
    'traffic'
  );

  return (
    <>
      <section className="tel-card" aria-label="الرسم البياني لنشاط الخدمات">
        <div className="tel-card-header">
          <h2 className="tel-card-title">
            <TrendingUp size={18} color="#38bdf8" />
            الرسم البياني للحركة والمبيعات
          </h2>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(
              [
                { id: 'traffic', label: 'الطلبات' },
                { id: 'revenue', label: 'الإيرادات' },
                { id: 'tokens', label: 'استخدام الأدوات' },
                { id: 'logs', label: 'السجلات' }
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                className={`tel-gran-btn ${chartMetric === opt.id ? 'active' : ''}`}
                onClick={() => setChartMetric(opt.id)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <SvgTrendChart data={timeSeries} granularity={granularity} metric={chartMetric} />
      </section>

      <section className="tel-analytics-grid" aria-label="ترتيب الخدمات حسب الأداء">
        <LeaderboardPanel
          title="الخدمات الأعلى مبيعاً"
          subtitle="ترتيب الخدمات حسب إجمالي الإيرادات والطلبات المكتملة"
          icon={<TrendingUp size={17} color="#10b981" />}
          rows={topSelling}
          accentColor="#10b981"
          formatValue={(v) => `${v.toLocaleString('en-US')} ج.م`}
          emptyText="ستظهر هنا فور تسجيل طلبات مدفوعة أو استيراد نسخة احتياطية."
        />

        <LeaderboardPanel
          title="الخدمات الأكثر طلباً وضغطاً"
          subtitle="الخدمات التي يدخل عليها الطلاب أو يطلبونها بكثرة"
          icon={<Activity size={17} color="#38bdf8" />}
          rows={highestTraffic}
          accentColor="#38bdf8"
          formatValue={(v) => `${v.toLocaleString('en-US')} طلب`}
          emptyText="ستظهر هنا تلقائياً مع حركة الطلاب على الموقع."
        />

        <LeaderboardPanel
          title="الأكثر استهلاكاً للأدوات الآلية"
          subtitle="الاستهلاك المحسوب لأدوات استخراج الصور والشات بوت والأتمتة"
          icon={<Cpu size={17} color="#f59e0b" />}
          rows={tokenLeaderboard}
          accentColor="#f59e0b"
          formatValue={(v) => `${v.toLocaleString('en-US')} وحدة`}
          emptyText="لا يوجد استهلاك مسجل للأدوات الآلية حتى الآن."
        />
      </section>
    </>
  );
};
