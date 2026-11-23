import {
  doc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  collection,
  getCountFromServer,
  query,
  where
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { logger } from '../utils/logger';
import {
  ServiceStatsCount,
  RequestsStatsDoc,
  calculateTotalFromServices,
  executeStatsSyncWithFallback,
  isQuotaExhausted,
  getQuotaExhaustedUntil,
  setQuotaExhaustedCooldown,
  resetQuotaExhausted,
  isQuotaError
} from '../utils/requestsStatsCore';

export type { ServiceStatsCount, RequestsStatsDoc };
export {
  isQuotaExhausted,
  getQuotaExhaustedUntil,
  setQuotaExhaustedCooldown,
  resetQuotaExhausted,
  isQuotaError
};

const STATS_DOC_PATH = ['metadata', 'requests_stats'] as const;
const ALL_SERVICE_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const STORAGE_KEY = 'hp_requests_stats_v1';

export const getRequestsStatsDocRef = () => doc(db, STATS_DOC_PATH[0], STATS_DOC_PATH[1]);

let memoryCache: RequestsStatsDoc | null = null;

const safeGetCount = async (queryTarget: any): Promise<number | null> => {
  if (isQuotaExhausted()) return null;
  try {
    const snap = await getCountFromServer(queryTarget);
    return snap.data().count || 0;
  } catch (err) {
    if (isQuotaError(err)) {
      setQuotaExhaustedCooldown(60_000);
      logger.warn('Firestore quota exhausted in aggregation query — circuit breaker activated for 60s');
    }
    return null;
  }
};

export const loadStoredStats = (): RequestsStatsDoc | null => {
  if (memoryCache && memoryCache.total > 0) return memoryCache;
  try {
    const raw = typeof window !== 'undefined' ? window.sessionStorage?.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.total > 0) return (memoryCache = parsed);
    }
  } catch {}
  return memoryCache;
};

export const persistStatsToSession = (stats: RequestsStatsDoc): void => {
  if (!stats) return;
  if (stats.total <= 0 && memoryCache && memoryCache.total > 0) return;
  memoryCache = stats;
  try {
    if (typeof window !== 'undefined' && stats.total > 0) {
      window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(stats));
    }
  } catch {}
};

export const fetchSingleServiceCount = async (serviceId: string): Promise<ServiceStatsCount> => {
  if (isQuotaExhausted()) {
    const cached = memoryCache?.byService?.[serviceId];
    return cached || { total: 0, pending: 0 };
  }

  let total = 0;
  let pending = 0;

  try {
    const coll = collection(db, `serviceRequests_${serviceId}`);
    const snapCount = await safeGetCount(query(coll));
    if (snapCount !== null) {
      total = snapCount;
      if (total > 0 && !isQuotaExhausted()) {
        const [compCount, rejCount] = await Promise.all([
          safeGetCount(query(coll, where('status', '==', 'completed'))),
          safeGetCount(query(coll, where('status', '==', 'rejected')))
        ]);
        const comp = compCount || 0;
        const rej = rejCount || 0;
        pending = Math.max(0, total - comp - rej);
      }
    }
  } catch (err) {
    if (isQuotaError(err)) setQuotaExhaustedCooldown();
    logger.warn(`Count total for serviceRequests_${serviceId}:`, err);
  }

  if (isQuotaExhausted()) {
    const cached = memoryCache?.byService?.[serviceId];
    return cached || { total, pending };
  }

  try {
    const legacyColl = collection(db, 'serviceRequests');
    const [lStrCount, lNumCount] = await Promise.all([
      safeGetCount(query(legacyColl, where('serviceId', '==', String(serviceId)))),
      !Number.isNaN(Number(serviceId))
        ? safeGetCount(query(legacyColl, where('serviceId', '==', Number(serviceId))))
        : Promise.resolve(null)
    ]);
    const lCount = (lStrCount || 0) + (lNumCount || 0);
    if (lCount > 0) {
      total += lCount;
      if (!isQuotaExhausted()) {
        const [lCompCount, lRejCount] = await Promise.all([
          safeGetCount(query(legacyColl, where('serviceId', '==', String(serviceId)), where('status', '==', 'completed'))),
          safeGetCount(query(legacyColl, where('serviceId', '==', String(serviceId)), where('status', '==', 'rejected')))
        ]);
        const lComp = lCompCount || 0;
        const lRej = lRejCount || 0;
        pending += Math.max(0, lCount - lComp - lRej);
      }
    }
  } catch (err) {
    if (isQuotaError(err)) setQuotaExhaustedCooldown();
  }

  return { total, pending };
};

export const recountAllServicesFromFirestore = async (
  forceFresh: boolean = false
): Promise<RequestsStatsDoc> => {
  const cached = loadStoredStats();
  if (isQuotaExhausted() && cached && cached.total > 0) {
    return cached;
  }
  if (!forceFresh && cached && cached.total > 0) {
    return cached;
  }

  const byService: Record<string, ServiceStatsCount> = {};
  for (const serviceId of ALL_SERVICE_IDS) {
    if (isQuotaExhausted()) {
      if (cached && cached.total > 0) {
        return cached;
      }
      break;
    }
    byService[serviceId] = await fetchSingleServiceCount(serviceId);
  }

  if (isQuotaExhausted() && cached && cached.total > 0) {
    return cached;
  }

  let legacyTotal = 0;
  if (!isQuotaExhausted()) {
    const lTotal = await safeGetCount(query(collection(db, 'serviceRequests')));
    legacyTotal = lTotal || 0;
  }

  if (isQuotaExhausted() && cached && cached.total > 0) {
    return cached;
  }

  const total = calculateTotalFromServices(byService, legacyTotal);
  if (total <= 0 && cached && cached.total > 0) {
    return cached;
  }

  const result: RequestsStatsDoc = {
    total,
    byService,
    updatedAt: Date.now()
  };

  persistStatsToSession(result);

  if (!isQuotaExhausted()) {
    await executeStatsSyncWithFallback(
      async () => result,
      async (statsToPersist) => {
        await setDoc(getRequestsStatsDocRef(), {
          ...statsToPersist,
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
    );
  }

  return result;
};

export const seedRequestsStatsFromCount = () => recountAllServicesFromFirestore(true);

export const subscribeToRequestsStats = (
  onUpdate: (stats: RequestsStatsDoc) => void
): (() => void) => {
  const docRef = getRequestsStatsDocRef();
  const cached = loadStoredStats();
  if (cached && cached.total > 0) {
    onUpdate(cached);
  }

  let isRecounting = false;
  const triggerFallback = () => {
    if (isRecounting || isQuotaExhausted()) return;
    isRecounting = true;
    void recountAllServicesFromFirestore(true)
      .then((res) => onUpdate(res))
      .catch((err) => console.error('Auto fallback recount error:', err))
      .finally(() => { isRecounting = false; });
  };

  return onSnapshot(
    docRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data() as RequestsStatsDoc;
        const total = data.total ?? 0;
        const byService = data.byService ?? {};
        if (total > 0) {
          const fresh = { total, byService, updatedAt: data.updatedAt };
          persistStatsToSession(fresh);
          onUpdate(fresh);
          return;
        }
      }
      triggerFallback();
    },
    (err) => {
      if (isQuotaError(err)) {
        setQuotaExhaustedCooldown();
        logger.warn('metadata/requests_stats listener hit quota limit (circuit-breaker cooldown active)');
        return;
      }
      logger.warn('metadata/requests_stats listener error (fallback active):', err);
      triggerFallback();
    }
  );
};

export {
  atomicIncrementNewRequest,
  atomicUpdateStatusCount,
  atomicDecrementRequest
} from './requestsStatsAtomicService';
