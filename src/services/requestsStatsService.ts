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
  executeStatsSyncWithFallback
} from '../utils/requestsStatsCore';

export type { ServiceStatsCount, RequestsStatsDoc };

const STATS_DOC_PATH = ['metadata', 'requests_stats'] as const;
const ALL_SERVICE_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
const STORAGE_KEY = 'hp_requests_stats_v1';

export const getRequestsStatsDocRef = () => doc(db, STATS_DOC_PATH[0], STATS_DOC_PATH[1]);

let memoryCache: RequestsStatsDoc | null = null;

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
  let total = 0;
  let pending = 0;

  try {
    const coll = collection(db, `serviceRequests_${serviceId}`);
    const snap = await getCountFromServer(query(coll));
    total = snap.data().count || 0;
    if (total > 0) {
      const [compSnap, rejSnap] = await Promise.all([
        getCountFromServer(query(coll, where('status', '==', 'completed'))).catch(() => null),
        getCountFromServer(query(coll, where('status', '==', 'rejected'))).catch(() => null)
      ]);
      const compCount = compSnap?.data().count || 0;
      const rejCount = rejSnap?.data().count || 0;
      pending = Math.max(0, total - compCount - rejCount);
    }
  } catch (err) {
    logger.warn(`Count total for serviceRequests_${serviceId}:`, err);
  }

  try {
    const legacyColl = collection(db, 'serviceRequests');
    const [lStrSnap, lNumSnap] = await Promise.all([
      getCountFromServer(query(legacyColl, where('serviceId', '==', String(serviceId)))).catch(() => null),
      !Number.isNaN(Number(serviceId))
        ? getCountFromServer(query(legacyColl, where('serviceId', '==', Number(serviceId)))).catch(() => null)
        : null
    ]);
    const lCount = (lStrSnap?.data().count || 0) + (lNumSnap?.data().count || 0);
    if (lCount > 0) {
      total += lCount;
      const [lCompSnap, lRejSnap] = await Promise.all([
        getCountFromServer(query(legacyColl, where('serviceId', '==', String(serviceId)), where('status', '==', 'completed'))).catch(() => null),
        getCountFromServer(query(legacyColl, where('serviceId', '==', String(serviceId)), where('status', '==', 'rejected'))).catch(() => null)
      ]);
      const lComp = lCompSnap?.data().count || 0;
      const lRej = lRejSnap?.data().count || 0;
      pending += Math.max(0, lCount - lComp - lRej);
    }
  } catch {}

  return { total, pending };
};

export const recountAllServicesFromFirestore = async (
  forceFresh: boolean = false
): Promise<RequestsStatsDoc> => {
  if (!forceFresh) {
    const cached = loadStoredStats();
    if (cached && cached.total > 0) return cached;
  }

  const byService: Record<string, ServiceStatsCount> = {};
  await Promise.all(
    ALL_SERVICE_IDS.map(async (serviceId) => {
      byService[serviceId] = await fetchSingleServiceCount(serviceId);
    })
  );

  let legacyTotal = 0;
  try {
    const legacySnap = await getCountFromServer(query(collection(db, 'serviceRequests')));
    legacyTotal = legacySnap.data().count || 0;
  } catch {}

  const total = calculateTotalFromServices(byService, legacyTotal);
  const result: RequestsStatsDoc = {
    total,
    byService,
    updatedAt: Date.now()
  };

  persistStatsToSession(result);

  await executeStatsSyncWithFallback(
    async () => result,
    async (statsToPersist) => {
      await setDoc(getRequestsStatsDocRef(), {
        ...statsToPersist,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  );

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
    if (isRecounting) return;
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
