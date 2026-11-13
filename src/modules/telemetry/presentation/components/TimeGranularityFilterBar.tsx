import React from 'react';
import { Calendar, Search, RotateCcw } from 'lucide-react';
import type {
  LogCategory,
  LogSeverity,
  TelemetryQueryFilter
} from '../../domain/entities/AuditLogEntry';
import type { TimeGranularity } from '../../domain/entities/ServiceMetric';
import { TIME_GRANULARITIES } from '../../domain/usecases/AggregateTimeSeriesUseCase';

interface TimeGranularityFilterBarProps {
  readonly filter: TelemetryQueryFilter;
  readonly onChange: (partial: Partial<TelemetryQueryFilter>) => void;
  readonly showLogFilters?: boolean;
}

function toDatetimeLocalValue(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export const TimeGranularityFilterBar: React.FC<TimeGranularityFilterBarProps> = ({
  filter,
  onChange,
  showLogFilters = true
}) => {
  const handleGranularity = (gran: TimeGranularity) => {
    const meta = TIME_GRANULARITIES.find((g) => g.key === gran);
    const now = Date.now();
    onChange({
      granularity: gran,
      fromMs: meta ? now - meta.defaultLookbackMs : filter.fromMs,
      toMs: now + 60_000
    });
  };

  const handleReset = () => {
    const now = Date.now();
    onChange({
      granularity: 'hour',
      fromMs: now - 30 * 24 * 60 * 60 * 1000,
      toMs: now + 60_000,
      severity: 'all',
      category: 'all',
      search: ''
    });
  };

  return (
    <div className="tel-filter-bar" role="region" aria-label="اختيار الفترة الزمنية والبحث">
      <div className="tel-granularity-group">
        {TIME_GRANULARITIES.map((g) => (
          <button
            key={g.key}
            type="button"
            className={`tel-gran-btn ${filter.granularity === g.key ? 'active' : ''}`}
            onClick={() => handleGranularity(g.key)}
          >
            {g.labelAr}
          </button>
        ))}
      </div>

      <div className="tel-filter-inputs">
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--tel-text-muted)' }}>
          <Calendar size={14} />
          من:
          <input
            type="datetime-local"
            className="tel-input"
            value={toDatetimeLocalValue(filter.fromMs)}
            onChange={(e) => {
              const parsed = Date.parse(e.target.value);
              if (!Number.isNaN(parsed)) onChange({ fromMs: parsed });
            }}
          />
        </label>

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: '0.8rem', color: 'var(--tel-text-muted)' }}>
          إلى:
          <input
            type="datetime-local"
            className="tel-input"
            value={toDatetimeLocalValue(filter.toMs)}
            onChange={(e) => {
              const parsed = Date.parse(e.target.value);
              if (!Number.isNaN(parsed)) onChange({ toMs: parsed });
            }}
          />
        </label>

        {showLogFilters && (
          <>
            <select
              className="tel-select"
              aria-label="أهمية الحدث"
              value={filter.severity}
              onChange={(e) => onChange({ severity: e.target.value as LogSeverity | 'all' })}
            >
              <option value="all">كل المستويات</option>
              <option value="info">عادي</option>
              <option value="warn">تنبيه</option>
              <option value="error">خطأ</option>
              <option value="critical">حرج</option>
            </select>

            <select
              className="tel-select"
              aria-label="نوع الحركة"
              value={filter.category}
              onChange={(e) => onChange({ category: e.target.value as LogCategory | 'all' })}
            >
              <option value="all">كل الأقسام</option>
              <option value="auth">تسجيل الدخول</option>
              <option value="session">الجلسات</option>
              <option value="security">الأمان</option>
              <option value="service">الخدمات</option>
              <option value="token">الأدوات الآلية</option>
              <option value="system">النظام</option>
            </select>

            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Search
                size={14}
                style={{ position: 'absolute', right: 10, color: 'var(--tel-text-muted)', pointerEvents: 'none' }}
              />
              <input
                type="search"
                className="tel-input"
                style={{ paddingRight: 30, minWidth: 165 }}
                placeholder="ابحث برقم IP أو كلمة..."
                value={filter.search}
                onChange={(e) => onChange({ search: e.target.value })}
              />
            </div>
          </>
        )}

        <button type="button" className="tel-btn sm" onClick={handleReset}>
          <RotateCcw size={13} />
          إعادة ضبط
        </button>
      </div>
    </div>
  );
};
