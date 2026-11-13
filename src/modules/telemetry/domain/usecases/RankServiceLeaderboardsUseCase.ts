import type { ServiceLeaderboardItem } from '../entities/ServiceMetric.ts';

export interface RankedMetricRow {
  readonly rank: number;
  readonly serviceId: string;
  readonly serviceName: string;
  readonly primaryValue: number;
  readonly secondaryLabel: string;
  readonly sharePercent: number;
}

export class RankServiceLeaderboardsUseCase {
  static rankTopSelling(items: readonly ServiceLeaderboardItem[]): readonly RankedMetricRow[] {
    const sorted = [...items].sort((a, b) => b.revenue - a.revenue || b.salesCount - a.salesCount);
    const maxVal = Math.max(...sorted.map((s) => s.revenue), 1);
    return sorted.map((s, idx) => ({
      rank: idx + 1,
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      primaryValue: s.revenue,
      secondaryLabel: `${s.salesCount} طلب مكتمل`,
      sharePercent: Math.round((s.revenue / maxVal) * 100)
    }));
  }

  static rankHighestTraffic(items: readonly ServiceLeaderboardItem[]): readonly RankedMetricRow[] {
    const sorted = [...items].sort((a, b) => b.trafficCount - a.trafficCount);
    const maxVal = Math.max(...sorted.map((s) => s.trafficCount), 1);
    return sorted.map((s, idx) => ({
      rank: idx + 1,
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      primaryValue: s.trafficCount,
      secondaryLabel:
        s.latencyCount > 0 ? `متوسط الاستجابة ${Math.round(s.latencySum / s.latencyCount)}ms` : 'حمل مباشر',
      sharePercent: Math.round((s.trafficCount / maxVal) * 100)
    }));
  }

  static rankTokenConsumption(items: readonly ServiceLeaderboardItem[]): readonly RankedMetricRow[] {
    const sorted = [...items].filter((s) => s.tokenUnits > 0).sort((a, b) => b.tokenUnits - a.tokenUnits);
    const maxVal = Math.max(...sorted.map((s) => s.tokenUnits), 1);
    return sorted.map((s, idx) => ({
      rank: idx + 1,
      serviceId: s.serviceId,
      serviceName: s.serviceName,
      primaryValue: s.tokenUnits,
      secondaryLabel: `${s.trafficCount} استدعاء حصة`,
      sharePercent: Math.round((s.tokenUnits / maxVal) * 100)
    }));
  }
}
