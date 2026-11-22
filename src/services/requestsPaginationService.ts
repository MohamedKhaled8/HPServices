import {
  collection,
  query,
  orderBy,
  limit,
  startAfter,
  getDocs,
  onSnapshot,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ServiceRequest } from '../types';
import { logger } from '../utils/logger';

export interface RequestsPageResult {
  requests: ServiceRequest[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

const mapDocToRequest = (
  docSnap: QueryDocumentSnapshot<DocumentData>,
  serviceId?: string
): ServiceRequest => {
  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    serviceId: String(data.serviceId || serviceId || ''),
    createdAt: data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  } as ServiceRequest;
};

/**
 * Real-time listener pinned ONLY to top recent batch (orderBy createdAt desc, limit pageSize).
 * Uses limit + 1 query to accurately detect hasMore without querying all documents.
 */
export const subscribeToLiveHeadRequests = (
  serviceId: string,
  pageSize: number = 25,
  onUpdate: (result: RequestsPageResult) => void
): (() => void) => {
  const collName = `serviceRequests_${serviceId}`;
  const q = query(collection(db, collName), orderBy('createdAt', 'desc'), limit(pageSize + 1));

  return onSnapshot(
    q,
    (snap) => {
      const hasMore = snap.docs.length > pageSize;
      const docsToUse = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
      const requests = docsToUse.map((d) => mapDocToRequest(d, serviceId));
      const lastDoc = docsToUse.length > 0 ? docsToUse[docsToUse.length - 1] : null;
      onUpdate({ requests, lastDoc, hasMore });
    },
    (err) => {
      logger.error(`Error in live head subscription for service ${serviceId}:`, err);
      onUpdate({ requests: [], lastDoc: null, hasMore: false });
    }
  );
};

/**
 * One-time cursor query for older requests (getDocs with startAfter, limit pageSize + 1).
 * Detects hasMore strictly from query results (snap.docs.length > pageSize).
 * Fetches 50 items per single click.
 */
export const fetchOlderRequestsPage = async (
  serviceId: string,
  cursorDoc: QueryDocumentSnapshot<DocumentData> | null,
  pageSize: number = 50
): Promise<RequestsPageResult> => {
  if (!cursorDoc) {
    return { requests: [], lastDoc: null, hasMore: false };
  }
  try {
    const collName = `serviceRequests_${serviceId}`;
    const q = query(
      collection(db, collName),
      orderBy('createdAt', 'desc'),
      startAfter(cursorDoc),
      limit(pageSize + 1)
    );
    const snap = await getDocs(q);
    const hasMore = snap.docs.length > pageSize;
    const docsToUse = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const requests = docsToUse.map((d) => mapDocToRequest(d, serviceId));
    const lastDoc = docsToUse.length > 0 ? docsToUse[docsToUse.length - 1] : null;
    return { requests, lastDoc, hasMore };
  } catch (error) {
    logger.error(`fetchOlderRequestsPage error for service ${serviceId}:`, error);
    return { requests: [], lastDoc: null, hasMore: false };
  }
};

import { mergeAndDeduplicateRequests } from '../utils/requestsPaginationCore';
export { mergeAndDeduplicateRequests };
