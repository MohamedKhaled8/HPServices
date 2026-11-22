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
      setStats(newStats);
    });
    return () => unsubscribe();
  }, []);

  const syncCounters = useCallback(async () => {
    setIsSyncing(true);
    try {
      const fresh = await recountAllServicesFromFirestore(true);
      setStats(fresh);
    } catch (err) {
      console.error('Manual counters sync failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const serviceStatsMap = useMemo(() => {
    const map: Record<string, { pending: number; total: number }> = {};
    const ids = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
    ids.forEach((id) => {
      const entry = stats?.byService?.[id];
      map[id] = {
        pending: entry?.pending ?? 0,
        total: entry?.total ?? 0
      };
    });
    return map;
  }, [stats]);

  const totalRequestsCount = useMemo(() => {
    if (stats?.total && stats.total > 0) return stats.total;
    const sum = Object.values(serviceStatsMap).reduce((acc, curr) => acc + curr.total, 0);
    return sum > 0 ? sum : 0;
  }, [stats, serviceStatsMap]);

  return {
    stats,
    isSyncing,
    syncCounters,
    serviceStatsMap,
    totalRequestsCount
  };
}
