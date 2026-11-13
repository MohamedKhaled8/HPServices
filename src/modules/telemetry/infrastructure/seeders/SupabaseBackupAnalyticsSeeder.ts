import { SERVICES } from '../../../../constants/services';
import {
  fetchSupabaseBackupPayload,
  listSupabaseBackups
} from '../../../../services/backupService';
import type { SeedMetricInput } from '../../domain/entities/ServiceMetric';
import { HttpTelemetryQueryRepository } from '../repositories/HttpTelemetryRepositories';

function extractRevenue(data: Record<string, unknown> | undefined): number {
  if (!data) return 0;
  const raw = data.price ?? data.totalPrice ?? data.amount ?? data.cost ?? data.fees;
  if (raw === undefined || raw === null) return 0;
  const parsed = parseFloat(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseTimestampMs(rawDate: unknown): number {
  if (typeof rawDate === 'number' && Number.isFinite(rawDate)) return rawDate;
  if (typeof rawDate === 'string') {
    const parsed = Date.parse(rawDate);
    if (!Number.isNaN(parsed)) return parsed;
  }
  if (typeof rawDate === 'object' && rawDate !== null) {
    const obj = rawDate as { seconds?: number; _seconds?: number };
    const sec = obj.seconds ?? obj._seconds;
    if (typeof sec === 'number') return sec * 1000;
  }
  return Date.now();
}

export class SupabaseBackupAnalyticsSeeder {
  static async importLatestBackup(
    repo: HttpTelemetryQueryRepository
  ): Promise<{ backupName: string; importedCount: number }> {
    const backups = await Promise.race([
      listSupabaseBackups(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('انتهت مهلة الاتصال بمخزن النسخ الاحتياطية في Supabase')), 8000)
      )
    ]);
    if (backups.length === 0) {
      throw new Error('لا توجد ملفات نسخ احتياطية في Supabase Storage حالياً');
    }

    const latest = backups[0];
    const payload = await fetchSupabaseBackupPayload(latest.path);
    if (!payload || !payload.collections) {
      throw new Error('تعذر قراءة محتوى النسخة الاحتياطية من Supabase');
    }

    return this.importFromPayload(latest.name, payload.collections, repo);
  }

  static async importFromPayload(
    sourceName: string,
    collections: Record<string, unknown>,
    repo: HttpTelemetryQueryRepository
  ): Promise<{ backupName: string; importedCount: number }> {
    const serviceNameById = new Map<string, string>(
      SERVICES.map((s) => [s.id, s.nameAr])
    );

    const rawRequests = Array.isArray(collections.serviceRequests)
      ? (collections.serviceRequests as Array<Record<string, unknown>>)
      : [];

    if (rawRequests.length === 0) {
      throw new Error('ملف النسخة الاحتياطية لا يحتوي على سجل طلبات خدمات');
    }

    // Group by serviceId + day bucket so large backups stay well within 500 aggregated metric batches
    const grouped = new Map<string, SeedMetricInput>();

    for (const req of rawRequests) {
      const serviceId = String(req.serviceId || 'unknown');
      const serviceName = serviceNameById.get(serviceId) || `خدمة #${serviceId}`;
      const tsMs = parseTimestampMs(req.createdAt);
      const dayBucket = new Date(tsMs).toISOString().slice(0, 10);
      const isSale = String(req.status || '').toLowerCase() === 'completed';
      const revenue = isSale ? extractRevenue(req.data as Record<string, unknown> | undefined) : 0;
      const key = `${serviceId}:${dayBucket}:${isSale ? 'sale' : 'traffic'}`;

      const prev = grouped.get(key);
      if (prev) {
        grouped.set(key, {
          ...prev,
          count: prev.count + 1,
          revenue: prev.revenue + revenue,
          tokenUnits: prev.tokenUnits + (isSale ? 15 : 5)
        });
      } else {
        grouped.set(key, {
          kind: isSale ? 'service_sale' : 'service_traffic',
          serviceId,
          serviceName,
          count: 1,
          revenue,
          tokenUnits: isSale ? 15 : 5,
          timestampMs: Date.parse(`${dayBucket}T12:00:00Z`) || tsMs,
          source: `supabase_backup:${sourceName}`
        });
      }
    }

    const items = Array.from(grouped.values()).slice(0, 500);
    const res = await repo.seedBackupMetrics(items);
    return { backupName: sourceName, importedCount: res.importedCount };
  }
}
