export interface ServiceStatsCount {
  total: number;
  pending: number;
  completed?: number;
  rejected?: number;
}

export interface RequestsStatsDoc {
  total: number;
  byService: Record<string, ServiceStatsCount>;
  updatedAt?: any;
}

let quotaExhaustedUntil: number = 0;

export const isQuotaExhausted = (): boolean => Date.now() < quotaExhaustedUntil;
export const getQuotaExhaustedUntil = (): number => quotaExhaustedUntil;
export const setQuotaExhaustedCooldown = (durationMs: number = 60_000): void => {
  quotaExhaustedUntil = Date.now() + durationMs;
};
export const resetQuotaExhausted = (): void => {
  quotaExhaustedUntil = 0;
};

export const isQuotaError = (err: unknown): boolean => {
  if (!err) return false;
  const anyErr = err as { code?: string; message?: string };
  const code = String(anyErr.code || '');
  const msg = String(anyErr.message || anyErr);
  return (
    code === 'resource-exhausted' ||
    code.includes('resource-exhausted') ||
    msg.includes('resource-exhausted') ||
    msg.includes('Quota exceeded') ||
    msg.includes('quota exceeded') ||
    msg.includes('429')
  );
};

/**
 * Calculates sum total across all services and optional legacy collection.
 */
export const calculateTotalFromServices = (
  byService: Record<string, ServiceStatsCount>,
  legacyTotal: number = 0
): number => {
  const sum = Object.values(byService).reduce((acc, curr) => acc + (curr?.total || 0), 0);
  return sum + Math.max(0, legacyTotal);
};

/**
 * Resolves the display count for the header badge.
 * Guarantees that if any requests exist (in totalCount, statsMap, or local requests list),
 * the badge will NEVER be stuck at 0.
 */
export const resolveDisplayTotalCount = (
  totalCount?: number | null,
  statsMap?: Record<string, { total: number } | undefined>,
  localRequestsCount?: number
): number => {
  if (typeof totalCount === 'number' && totalCount > 0) {
    return totalCount;
  }
  if (statsMap) {
    const sum = Object.values(statsMap).reduce((acc, curr) => acc + (curr?.total || 0), 0);
    if (sum > 0) return sum;
  }
  if (typeof localRequestsCount === 'number' && localRequestsCount > 0) {
    return localRequestsCount;
  }
  return 0;
};

/**
 * Executes a stats sync operation with graceful fallback:
 * 1. Computes fresh counts from server queries.
 * 2. Attempts to persist to Firestore in a separate try/catch.
 * 3. Returns the real counts even if persisting throws permission-denied.
 */
export const executeStatsSyncWithFallback = async (
  fetchFreshCounts: () => Promise<RequestsStatsDoc>,
  persistToDoc?: (stats: RequestsStatsDoc) => Promise<void>
): Promise<{ stats: RequestsStatsDoc; persisted: boolean }> => {
  const fresh = await fetchFreshCounts();

  let persisted = false;
  if (persistToDoc) {
    try {
      await persistToDoc(fresh);
      persisted = true;
    } catch {
      // Permission-denied or network error on write must NEVER prevent UI update
      persisted = false;
    }
  }

  return { stats: fresh, persisted };
};
