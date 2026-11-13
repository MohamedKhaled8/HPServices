import type { TimeBucketPoint, TimeGranularity } from '../entities/ServiceMetric.ts';

export interface GranularityMeta {
  readonly key: TimeGranularity;
  readonly labelAr: string;
  readonly labelEn: string;
  readonly defaultLookbackMs: number;
}

export const TIME_GRANULARITIES: readonly GranularityMeta[] = [
  { key: 'second', labelAr: 'ثانية', labelEn: 'Second', defaultLookbackMs: 5 * 60 * 1000 },
  { key: 'minute', labelAr: 'دقيقة', labelEn: 'Minute', defaultLookbackMs: 60 * 60 * 1000 },
  { key: 'hour', labelAr: 'ساعة', labelEn: 'Hour', defaultLookbackMs: 24 * 60 * 60 * 1000 },
  { key: 'day', labelAr: 'يوم', labelEn: 'Day', defaultLookbackMs: 30 * 24 * 60 * 60 * 1000 },
  { key: 'month', labelAr: 'شهر', labelEn: 'Month', defaultLookbackMs: 365 * 24 * 60 * 60 * 1000 },
  { key: 'year', labelAr: 'سنة', labelEn: 'Year', defaultLookbackMs: 5 * 365 * 24 * 60 * 60 * 1000 }
];

export class AggregateTimeSeriesUseCase {
  static formatExactTimestamp(timestampMs: number): string {
    if (!Number.isFinite(timestampMs) || timestampMs <= 0) return '—';
    const d = new Date(timestampMs);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }

  static getBucketLabel(bucket: string, granularity: TimeGranularity): string {
    if (!bucket) return '';
    switch (granularity) {
      case 'second':
        return bucket.slice(11); // HH:MM:SS
      case 'minute':
        return bucket.slice(11); // HH:MM
      case 'hour':
        return `${bucket.slice(5, 10)} ${bucket.slice(11, 13)}h`;
      case 'day':
        return bucket.slice(5); // MM-DD
      case 'month':
      case 'year':
        return bucket;
    }
  }

  static computePeakBucket(series: readonly TimeBucketPoint[]): TimeBucketPoint | null {
    if (series.length === 0) return null;
    return series.reduce((best, cur) => (cur.traffic > best.traffic ? cur : best), series[0]);
  }
}
