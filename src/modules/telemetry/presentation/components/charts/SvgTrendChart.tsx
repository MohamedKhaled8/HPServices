import React from 'react';
import type { TimeBucketPoint, TimeGranularity } from '../../../domain/entities/ServiceMetric';
import { AggregateTimeSeriesUseCase } from '../../../domain/usecases/AggregateTimeSeriesUseCase';

interface SvgTrendChartProps {
  readonly data: readonly TimeBucketPoint[];
  readonly granularity: TimeGranularity;
  readonly metric: 'traffic' | 'revenue' | 'tokens' | 'logs';
}

const METRIC_META: Record<
  SvgTrendChartProps['metric'],
  { label: string; color: string; fill: string }
> = {
  traffic: { label: 'عدد الطلبات والحركة', color: '#38bdf8', fill: 'rgba(56, 189, 248, 0.16)' },
  revenue: { label: 'الإيرادات (ج.م)', color: '#10b981', fill: 'rgba(16, 185, 129, 0.16)' },
  tokens: { label: 'استخدام الأدوات الآلية', color: '#f59e0b', fill: 'rgba(245, 158, 11, 0.16)' },
  logs: { label: 'سجل الحركات', color: '#818cf8', fill: 'rgba(129, 140, 248, 0.16)' }
};

export const SvgTrendChart: React.FC<SvgTrendChartProps> = ({ data, granularity, metric }) => {
  const [hoverIdx, setHoverIdx] = React.useState<number | null>(null);
  const meta = METRIC_META[metric];

  if (data.length === 0) {
    return (
      <div
        style={{
          height: 180,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--tel-text-muted)',
          fontSize: '0.88rem'
        }}
      >
        لا توجد بيانات مسجلة في هذه الفترة الزمنية حتى الآن.
      </div>
    );
  }

  const width = 920;
  const height = 210;
  const padX = 28;
  const padY = 22;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const values = data.map((d) => d[metric]);
  const maxVal = Math.max(...values, 1);

  const coords = data.map((point, idx) => {
    const x = data.length === 1 ? padX + innerW / 2 : padX + (idx / (data.length - 1)) * innerW;
    const y = padY + innerH - (point[metric] / maxVal) * innerH;
    return { x, y, point };
  });

  const linePath = coords
    .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath =
    coords.length > 0
      ? `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${coords[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`
      : '';

  const hovered = hoverIdx !== null ? coords[hoverIdx] : null;

  return (
    <div className="tel-chart-container">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 8,
          fontSize: '0.82rem',
          color: 'var(--tel-text-muted)'
        }}
      >
        <span>
          المؤشر المعروض: <strong style={{ color: meta.color }}>{meta.label}</strong>
        </span>
        {hovered ? (
          <span className="tel-mono" style={{ color: 'var(--tel-text)', fontWeight: 700 }}>
            {AggregateTimeSeriesUseCase.getBucketLabel(hovered.point.bucket, granularity)} →{' '}
            {hovered.point[metric].toLocaleString('en-US')}
          </span>
        ) : (
          <span>أعلى قيمة: {maxVal.toLocaleString('en-US')}</span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="tel-chart-svg"
        role="img"
        aria-label={meta.label}
      >
        {[0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padY + innerH * (1 - ratio);
          return (
            <line
              key={ratio}
              x1={padX}
              y1={y}
              x2={width - padX}
              y2={y}
              stroke="var(--tel-grid-line)"
              strokeDasharray="4 4"
            />
          );
        })}

        <path d={areaPath} fill={meta.fill} />
        <path d={linePath} fill="none" stroke={meta.color} strokeWidth={2.5} strokeLinejoin="round" />

        {coords.map((c, idx) => (
          <circle
            key={c.point.bucket}
            cx={c.x}
            cy={c.y}
            r={hoverIdx === idx ? 5.5 : 3.5}
            fill={hoverIdx === idx ? '#ffffff' : meta.color}
            stroke={meta.color}
            strokeWidth={2}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHoverIdx(idx)}
            onMouseLeave={() => setHoverIdx(null)}
          />
        ))}
      </svg>
    </div>
  );
};
