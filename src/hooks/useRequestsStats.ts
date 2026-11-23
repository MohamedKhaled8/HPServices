import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  RequestsStatsDoc,
  subscribeToRequestsStats,
  recountAllServicesFromFirestore,
  loadStoredStats
} from '../services/requestsStatsService';

export function useRequestsStats() {
  const [stats, setStats] = useState<RequestsStatsDoc | null>(() => loadStoredStats());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToRequestsStats((newStats) => {
      if (newStats && newStats.total > 0) {
        setStats(newStats);
      } else {
        setStats((prev) => (prev && prev.total > 0 ? prev : newStats));
      }
    });
    return () => unsubscribe();
  }, []);

  const syncCounters = useCallback(async () => {
    setIsSyncing(true);
    try {
      const fresh = await recountAllServicesFromFirestore(true);
      if (fresh && fresh.total > 0) {
        setStats(fresh);
      }
    } catch (err) {
      console.error('Manual counters sync failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const effectiveStats = useMemo(() => {
    if (stats && stats.total > 0) return stats;
    const stored = loadStoredStats();
    if (stored && stored.total > 0) return stored;
    return stats;
  }, [stats]);

  const serviceStatsMap = useMemo(() => {
    const map: Record<string, { pending: number; total: number }> = {};
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    ids.forEach((id) => {
      const entry = effectiveStats?.byService?.[id];
      const val = {
        pending: entry?.pending ?? 0,
        total: entry?.total ?? 0
      };
      map[id] = val;
      map[Number(id)] = val;
    });
    return map;
  }, [effectiveStats]);

  const totalRequestsCount = useMemo(() => {
    if (effectiveStats?.total && effectiveStats.total > 0) return effectiveStats.total;
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    const sum = ids.reduce((acc, curr) => acc + (serviceStatsMap[curr]?.total || 0), 0);
    return sum > 0 ? sum : 0;
  }, [effectiveStats, serviceStatsMap]);

  return {
    stats,
    isSyncing,
    syncCounters,
    serviceStatsMap,
    totalRequestsCount
  };
}
