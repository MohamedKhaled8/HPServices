import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  doc,
  getDoc,
  Query,
  QuerySnapshot,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';
import type { ServiceRequest } from '../types';
import { setDbFetchers, type DbFetchFilteredBatchFn } from '../utils/requestsSearchCore';
import {
  buildStatusConstraint,
  buildDateConstraints
} from './requestsPaginationService';
import {
  matchesStatusAndDateFilter,
  sortRequestsByPriorityAndDate
} from '../utils/requestsPaginationCore';

const mapDoc = (d: QueryDocumentSnapshot<DocumentData>, serviceId: string): ServiceRequest => {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    serviceId: String(data.serviceId || serviceId),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  } as ServiceRequest;
};

const defaultFetchBatch = async (serviceId: string, maxLimit: number): Promise<ServiceRequest[]> => {
  const collName = `serviceRequests_${serviceId}`;
  const q = query(collection(db, collName), orderBy('createdAt', 'desc'), limit(maxLimit));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapDoc(d, serviceId));
};

const defaultFetchFilteredBatch: DbFetchFilteredBatchFn = async ({
  serviceId,
  statusFilter,
  dateFrom,
  dateTo,
  maxLimit
}) => {
  const coll = collection(db, `serviceRequests_${serviceId}`);
  const sc = buildStatusConstraint(statusFilter);
  const dc = buildDateConstraints(dateFrom, dateTo);
  const constraints = [...(sc ? [sc] : []), ...dc];

  const batchSize = Math.min(250, maxLimit);
  const results: ServiceRequest[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  try {
    while (results.length < maxLimit) {
      const remaining = Math.min(batchSize, maxLimit - results.length);
      const q: Query<DocumentData> = cursor
        ? query(coll, ...constraints, orderBy('createdAt', 'desc'), startAfter(cursor), limit(remaining))
        : query(coll, ...constraints, orderBy('createdAt', 'desc'), limit(remaining));
      const snap: QuerySnapshot<DocumentData> = await getDocs(q);
      if (snap.docs.length === 0) break;
      snap.docs.forEach((d: QueryDocumentSnapshot<DocumentData>) => results.push(mapDoc(d, serviceId)));
      cursor = snap.docs[snap.docs.length - 1];
      if (snap.docs.length < remaining) break;
    }
    return sortRequestsByPriorityAndDate(results, statusFilter);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    const msg = String((err as { message?: string })?.message || '').toLowerCase();
    if (code === 'failed-precondition' || msg.includes('index')) {
      const fallbackQ = sc ? query(coll, sc) : query(coll, ...dc);
      const snap = await getDocs(fallbackQ);
      const filtered = snap.docs
        .map((d) => mapDoc(d, serviceId))
        .filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo));
      return sortRequestsByPriorityAndDate(filtered, statusFilter).slice(0, maxLimit);
    }
    throw err;
  }
};

const defaultGetDoc = async (serviceId: string, docId: string): Promise<ServiceRequest | null> => {
  const collName = `serviceRequests_${serviceId}`;
  const d = await getDoc(doc(db, collName, docId));
  if (!d.exists()) return null;
  return mapDoc(d, serviceId);
};

// Wire production Firestore fetchers by default
setDbFetchers(defaultFetchBatch, defaultGetDoc, defaultFetchFilteredBatch);

export * from '../utils/requestsSearchCore';
