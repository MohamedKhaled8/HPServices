import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  onSnapshot,
  Timestamp,
  QueryConstraint,
  QueryDocumentSnapshot,
  DocumentData
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ServiceRequest } from '../types';
import { logger } from '../utils/logger';
import {
  RequestStatusFilter,
  NEW_REQUEST_STATUSES,
  mergeAndDeduplicateRequests,
  matchesStatusAndDateFilter,
  sortRequestsByPriorityAndDate
} from '../utils/requestsPaginationCore';

export type { RequestStatusFilter };
export { mergeAndDeduplicateRequests };

export const ALL_SERVICE_IDS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'] as const;

export interface RequestsPageResult {
  requests: ServiceRequest[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export interface ServiceCursorState {
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
  fallbackDocs?: ServiceRequest[] | null;
  fallbackOffset?: number;
  // Used when statusFilter === 'all' to keep unhandled/new requests pinned at the top
  newLastDoc?: QueryDocumentSnapshot<DocumentData> | null;
  newHasMore?: boolean;
  newFallbackDocs?: ServiceRequest[] | null;
  newFallbackOffset?: number;
  generalLastDoc?: QueryDocumentSnapshot<DocumentData> | null;
  generalHasMore?: boolean;
  loadedNewIds?: Set<string>;
  // Legacy `serviceRequests` collection overflow pagination
  legacyDocs?: ServiceRequest[] | null;
  legacyOffset?: number;
  legacyChecked?: boolean;
  legacyPendingCount?: number;
}

export interface FilteredPaginationState {
  mode: 'single' | 'all_services';
  single?: ServiceCursorState;
  perService?: Record<string, ServiceCursorState>;
  allServicesBuffer?: ServiceRequest[];
}

export interface FilteredRequestsHeadUpdate {
  requests: ServiceRequest[];
  hasMore: boolean;
  paginationState: FilteredPaginationState;
}

export interface FilterQueryParams {
  serviceId: string;
  statusFilter?: RequestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
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

const isMissingIndexError = (err: unknown): boolean => {
  const code = (err as { code?: string })?.code;
  const msg = String((err as { message?: string })?.message || '').toLowerCase();
  return code === 'failed-precondition' || msg.includes('requires an index') || msg.includes('index');
};

const parseDateBoundary = (dateStr: string, endOfDay: boolean): Timestamp | null => {
  const trimmed = dateStr.trim();
  if (!trimmed) return null;
  const parts = trimmed.split('-').map((p) => parseInt(p, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [y, m, d] = parts;
  const dt = endOfDay
    ? new Date(y, m - 1, d, 23, 59, 59, 999)
    : new Date(y, m - 1, d, 0, 0, 0, 0);
  if (Number.isNaN(dt.getTime())) return null;
  return Timestamp.fromDate(dt);
};

export const buildStatusConstraint = (statusFilter: RequestStatusFilter): QueryConstraint | null => {
  if (statusFilter === 'new' || statusFilter === 'pending') {
    return where('status', 'in', [...NEW_REQUEST_STATUSES, '']);
  }
  if (statusFilter !== 'all') {
    return where('status', '==', statusFilter);
  }
  return null;
};

export const buildDateConstraints = (dateFrom?: string, dateTo?: string): QueryConstraint[] => {
  const constraints: QueryConstraint[] = [];
  if (dateFrom) {
    const startTs = parseDateBoundary(dateFrom, false);
    if (startTs) constraints.push(where('createdAt', '>=', startTs));
  }
  if (dateTo) {
    const endTs = parseDateBoundary(dateTo, true);
    if (endTs) constraints.push(where('createdAt', '<=', endTs));
  }
  return constraints;
};

const buildAllFilterConstraints = (
  statusFilter: RequestStatusFilter,
  dateFrom?: string,
  dateTo?: string
): QueryConstraint[] => {
  const sc = buildStatusConstraint(statusFilter);
  const dc = buildDateConstraints(dateFrom, dateTo);
  return [...(sc ? [sc] : []), ...dc];
};

const fetchPrimaryCollectionCount = async (
  serviceId: string,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): Promise<number | null> => {
  const coll = collection(db, `serviceRequests_${serviceId}`);
  const constraints = buildAllFilterConstraints(statusFilter, dateFrom, dateTo);
  try {
    const snap = await getCountFromServer(query(coll, ...constraints));
    return snap.data().count || 0;
  } catch (err) {
    if (isMissingIndexError(err)) {
      try {
        const sc = buildStatusConstraint(statusFilter);
        const fallbackQuery = sc ? query(coll, sc) : query(coll, ...buildDateConstraints(dateFrom, dateTo));
        const docsSnap = await getDocs(fallbackQuery);
        return docsSnap.docs
          .map((d) => mapDocToRequest(d, serviceId))
          .filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo)).length;
      } catch (fallbackErr) {
        logger.warn(`Fallback count error for service ${serviceId}:`, fallbackErr);
        return null;
      }
    }
    logger.warn(`fetchPrimaryCollectionCount error for service ${serviceId}:`, err);
    return null;
  }
};

const fetchLegacyCollectionCount = async (
  serviceId: string,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): Promise<number> => {
  const legacyColl = collection(db, 'serviceRequests');
  const numSid = Number(serviceId);
  const serviceMatches: QueryConstraint[] = [where('serviceId', '==', String(serviceId))];
  const numericQueryAllowed = !Number.isNaN(numSid) && String(numSid) === String(serviceId);
  const extraConstraints = buildAllFilterConstraints(statusFilter, dateFrom, dateTo);

  const countForConstraint = async (svcConstraint: QueryConstraint): Promise<number> => {
    try {
      const snap = await getCountFromServer(query(legacyColl, svcConstraint, ...extraConstraints));
      return snap.data().count || 0;
    } catch (err) {
      if (isMissingIndexError(err)) {
        try {
          const docsSnap = await getDocs(query(legacyColl, svcConstraint));
          return docsSnap.docs
            .map((d) => mapDocToRequest(d, serviceId))
            .filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo)).length;
        } catch (fallbackErr) {
          logger.warn(`Fallback legacy count error for service ${serviceId}:`, fallbackErr);
          return 0;
        }
      }
      return 0;
    }
  };

  try {
    const counts = await Promise.all([
      countForConstraint(serviceMatches[0]),
      numericQueryAllowed ? countForConstraint(where('serviceId', '==', numSid)) : Promise.resolve(0)
    ]);
    return counts[0] + counts[1];
  } catch (err) {
    logger.warn(`fetchLegacyCollectionCount error for service ${serviceId}:`, err);
    return 0;
  }
};

const fetchLegacyCollectionDocs = async (
  serviceId: string,
  statusFilter: RequestStatusFilter,
  dateFrom?: string,
  dateTo?: string
): Promise<ServiceRequest[]> => {
  const legacyColl = collection(db, 'serviceRequests');
  const numSid = Number(serviceId);
  const numericQueryAllowed = !Number.isNaN(numSid) && String(numSid) === String(serviceId);
  const sc = buildStatusConstraint(statusFilter);

  const runFetch = async (svcConstraint: QueryConstraint): Promise<ServiceRequest[]> => {
    try {
      const q = sc ? query(legacyColl, svcConstraint, sc) : query(legacyColl, svcConstraint);
      const snap = await getDocs(q);
      return snap.docs.map((d) => mapDocToRequest(d, serviceId));
    } catch (err) {
      if (isMissingIndexError(err)) {
        const snap = await getDocs(query(legacyColl, svcConstraint));
        return snap.docs.map((d) => mapDocToRequest(d, serviceId));
      }
      logger.warn(`fetchLegacyCollectionDocs error for service ${serviceId}:`, err);
      return [];
    }
  };

  const [strDocs, numDocs] = await Promise.all([
    runFetch(where('serviceId', '==', String(serviceId))),
    numericQueryAllowed ? runFetch(where('serviceId', '==', numSid)) : Promise.resolve([])
  ]);

  const merged = mergeAndDeduplicateRequests(strDocs, numDocs).filter((r) =>
    matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo)
  );
  return sortRequestsByPriorityAndDate(merged, statusFilter);
};

/**
 * Fetches exact total matching count directly from Firestore (primary + legacy collections).
 */
const fetchSingleServiceFilteredCount = async (
  serviceId: string,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): Promise<number | null> => {
  const [primaryCount, legacyCount] = await Promise.all([
    fetchPrimaryCollectionCount(serviceId, statusFilter, dateFrom, dateTo),
    fetchLegacyCollectionCount(serviceId, statusFilter, dateFrom, dateTo)
  ]);
  if (primaryCount === null && legacyCount === 0) return null;
  return (primaryCount ?? 0) + legacyCount;
};

export const fetchFilteredRequestsCount = async ({
  serviceId,
  statusFilter = 'all',
  dateFrom,
  dateTo
}: FilterQueryParams): Promise<number | null> => {
  if (serviceId === 'all') {
    const counts = await Promise.all(
      ALL_SERVICE_IDS.map((sid) => fetchSingleServiceFilteredCount(sid, statusFilter, dateFrom, dateTo))
    );
    if (counts.every((c) => c === null)) return null;
    return counts.reduce<number>((sum, c) => sum + (c ?? 0), 0);
  }
  return fetchSingleServiceFilteredCount(serviceId, statusFilter, dateFrom, dateTo);
};

export const fetchServiceStatusCounts = async (
  serviceId: string,
  dateFrom?: string,
  dateTo?: string
): Promise<{ all: number | null; new: number | null }> => {
  const [allCount, newCount] = await Promise.all([
    fetchFilteredRequestsCount({ serviceId, statusFilter: 'all', dateFrom, dateTo }),
    fetchFilteredRequestsCount({ serviceId, statusFilter: 'new', dateFrom, dateTo })
  ]);
  return { all: allCount, new: newCount };
};

/**
 * Fetches all docs in `serviceRequests_${serviceId}` without `orderBy('createdAt')`
 * so documents missing `createdAt` are never lost, then sorts deterministically in memory.
 */
const fetchUnorderedPrimaryDocs = async (
  serviceId: string,
  statusFilter: RequestStatusFilter,
  dateFrom?: string,
  dateTo?: string,
  scanAllDocs: boolean = false
): Promise<ServiceRequest[]> => {
  const coll = collection(db, `serviceRequests_${serviceId}`);
  const sc = scanAllDocs ? null : buildStatusConstraint(statusFilter);
  const q = sc ? query(coll, sc) : query(coll);
  const snap = await getDocs(q);
  const filtered = snap.docs
    .map((d) => mapDocToRequest(d, serviceId))
    .filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo));
  return sortRequestsByPriorityAndDate(filtered, statusFilter);
};

/**
 * Checks whether `serviceRequests_${serviceId}` has documents with missing/legacy `status`
 * (which Firestore `where('status', 'in', ...)` cannot match) when `statusFilter === 'new'`.
 */
const countPrimaryMissingStatusNewDocs = async (
  serviceId: string,
  knownInCount: number
): Promise<boolean> => {
  const coll = collection(db, `serviceRequests_${serviceId}`);
  try {
    const [totalSnap, compSnap, rejSnap, subSnap, recSnap] = await Promise.all([
      getCountFromServer(query(coll)),
      getCountFromServer(query(coll, where('status', '==', 'completed'))),
      getCountFromServer(query(coll, where('status', '==', 'rejected'))),
      getCountFromServer(query(coll, where('status', '==', 'submitted'))),
      getCountFromServer(query(coll, where('status', '==', 'receipt_sent')))
    ]);
    const estimatedUnhandled =
      (totalSnap.data().count || 0) -
      (compSnap.data().count || 0) -
      (rejSnap.data().count || 0) -
      (subSnap.data().count || 0) -
      (recSnap.data().count || 0);
    return estimatedUnhandled > knownInCount;
  } catch (err) {
    logger.warn(`countPrimaryMissingStatusNewDocs notice for service ${serviceId}:`, err);
    return false;
  }
};

/**
 * Appends legacy `serviceRequests` page slices once primary `serviceRequests_${sid}` is exhausted.
 */
const appendLegacyTailIfNeeded = async (
  serviceId: string,
  statusFilter: RequestStatusFilter,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  pageSize: number,
  currentItems: ServiceRequest[],
  state: ServiceCursorState
): Promise<{ items: ServiceRequest[]; state: ServiceCursorState }> => {
  if (state.hasMore) {
    return { items: currentItems, state };
  }

  let legacyDocs = state.legacyDocs;
  let legacyOffset = state.legacyOffset ?? 0;

  if (!state.legacyChecked) {
    const legacyCount = await fetchLegacyCollectionCount(serviceId, statusFilter, dateFrom, dateTo);
    if (legacyCount <= 0) {
      return {
        items: currentItems,
        state: { ...state, legacyChecked: true, legacyDocs: [], legacyOffset: 0, hasMore: false }
      };
    }
    legacyDocs = await fetchLegacyCollectionDocs(serviceId, statusFilter, dateFrom, dateTo);
    legacyOffset = 0;
  }

  const allLegacy = legacyDocs ?? [];
  const existingIds = new Set(currentItems.map((r) => r.id).filter(Boolean));
  const remainingSlots = Math.max(0, pageSize - currentItems.length);
  const appended: ServiceRequest[] = [];

  while (appended.length < remainingSlots && legacyOffset < allLegacy.length) {
    const candidate = allLegacy[legacyOffset++];
    if (candidate.id && existingIds.has(candidate.id)) continue;
    appended.push(candidate);
  }

  const legacyHasMore = legacyOffset < allLegacy.length;
  return {
    items: [...currentItems, ...appended],
    state: {
      ...state,
      legacyChecked: true,
      legacyDocs: allLegacy,
      legacyOffset,
      hasMore: legacyHasMore
    }
  };
};

/**
 * Fetches one page of a single service for a specific non-'all' status filter,
 * with automatic single-field fallback if composite index or `createdAt` field is missing.
 */
const fetchSingleStatusPageOnce = async (
  serviceId: string,
  statusFilter: RequestStatusFilter,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  pageSize: number,
  cursorState?: ServiceCursorState
): Promise<{ items: ServiceRequest[]; state: ServiceCursorState }> => {
  const coll = collection(db, `serviceRequests_${serviceId}`);

  if (cursorState?.fallbackDocs) {
    const offset = cursorState.fallbackOffset ?? 0;
    const slice = cursorState.fallbackDocs.slice(offset, offset + pageSize);
    const nextOffset = offset + slice.length;
    const primaryHasMore = nextOffset < cursorState.fallbackDocs.length;
    return appendLegacyTailIfNeeded(
      serviceId,
      statusFilter,
      dateFrom,
      dateTo,
      pageSize,
      slice,
      {
        ...cursorState,
        lastDoc: null,
        hasMore: primaryHasMore,
        fallbackDocs: cursorState.fallbackDocs,
        fallbackOffset: nextOffset
      }
    );
  }

  if (cursorState && !cursorState.hasMore && cursorState.legacyDocs) {
    return appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, [], cursorState);
  }

  const constraints = buildAllFilterConstraints(statusFilter, dateFrom, dateTo);
  const q = cursorState?.lastDoc
    ? query(coll, ...constraints, orderBy('createdAt', 'desc'), startAfter(cursorState.lastDoc), limit(pageSize + 1))
    : query(coll, ...constraints, orderBy('createdAt', 'desc'), limit(pageSize + 1));

  try {
    const snap = await getDocs(q);
    const hasMore = snap.docs.length > pageSize;
    const docsToUse = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
    const items = docsToUse.map((d) => mapDocToRequest(d, serviceId));
    const lastDoc = docsToUse.length > 0 ? docsToUse[docsToUse.length - 1] : null;

    // On initial page, guard against documents missing `createdAt` or missing `status` excluded by query
    if (!cursorState && !hasMore) {
      const primaryServerCount = await fetchPrimaryCollectionCount(serviceId, statusFilter, dateFrom, dateTo);
      const hasMissingStatus =
        (statusFilter === 'new' || statusFilter === 'pending') && primaryServerCount !== null
          ? await countPrimaryMissingStatusNewDocs(serviceId, primaryServerCount)
          : false;
      if ((primaryServerCount !== null && primaryServerCount > items.length) || hasMissingStatus) {
        const fullSorted = await fetchUnorderedPrimaryDocs(
          serviceId,
          statusFilter,
          dateFrom,
          dateTo,
          hasMissingStatus
        );
        const slice = fullSorted.slice(0, pageSize);
        const fbHasMore = slice.length < fullSorted.length;
        return appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, slice, {
          lastDoc: null,
          hasMore: fbHasMore,
          fallbackDocs: fullSorted,
          fallbackOffset: slice.length
        });
      }
    }

    return appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, items, {
      ...(cursorState || {}),
      lastDoc,
      hasMore
    });
  } catch (err) {
    if (isMissingIndexError(err)) {
      logger.warn(`Missing Firestore composite index for serviceRequests_${serviceId}; using filtered single-field fallback.`);
      const filtered = await fetchUnorderedPrimaryDocs(serviceId, statusFilter, dateFrom, dateTo);
      const slice = filtered.slice(0, pageSize);
      return appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, slice, {
        lastDoc: null,
        hasMore: slice.length < filtered.length,
        fallbackDocs: filtered,
        fallbackOffset: slice.length
      });
    }
    logger.error(`fetchSingleStatusPageOnce error for service ${serviceId}:`, err);
    return { items: [], state: { lastDoc: null, hasMore: false } };
  }
};

/**
 * Fetches general (orderBy createdAt desc) non-new docs while skipping already-loaded new request IDs,
 * preserving the exact QueryDocumentSnapshot cursor of the last consumed item.
 */
const fetchGeneralFillDocs = async (
  serviceId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  neededCount: number,
  startCursor: QueryDocumentSnapshot<DocumentData> | null,
  excludeIds: Set<string>
): Promise<{
  items: ServiceRequest[];
  lastConsumedDoc: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}> => {
  if (neededCount <= 0) {
    return { items: [], lastConsumedDoc: startCursor, hasMore: true };
  }

  const coll = collection(db, `serviceRequests_${serviceId}`);
  const dc = buildDateConstraints(dateFrom, dateTo);
  const collected: ServiceRequest[] = [];
  let cursor = startCursor;
  let hasMore = false;
  let rounds = 0;

  while (collected.length < neededCount && rounds < 25) {
    rounds++;
    const batchLimit = Math.max(neededCount - collected.length, 25) + 1;
    const q = cursor
      ? query(coll, ...dc, orderBy('createdAt', 'desc'), startAfter(cursor), limit(batchLimit))
      : query(coll, ...dc, orderBy('createdAt', 'desc'), limit(batchLimit));

    const snap = await getDocs(q);
    if (snap.docs.length === 0) {
      hasMore = false;
      break;
    }

    const batchHasMore = snap.docs.length > batchLimit - 1;
    const docsToInspect = batchHasMore ? snap.docs.slice(0, batchLimit - 1) : snap.docs;
    let consumedIdx = -1;

    for (let i = 0; i < docsToInspect.length; i++) {
      const d = docsToInspect[i];
      consumedIdx = i;
      cursor = d;
      if (!excludeIds.has(d.id)) {
        collected.push(mapDocToRequest(d, serviceId));
        if (collected.length >= neededCount) {
          hasMore = batchHasMore || i < docsToInspect.length - 1;
          break;
        }
      }
    }

    if (collected.length >= neededCount) {
      break;
    }

    if (!batchHasMore || consumedIdx < 0) {
      hasMore = false;
      break;
    }
    hasMore = true;
  }

  return { items: collected, lastConsumedDoc: cursor, hasMore };
};

/**
 * Fetches page 1 (or next page) for a single service in 'all' mode:
 * prioritizes 'new' requests (sorted createdAt DESC) at the top, then fills with newest non-new requests
 * and any legacy `serviceRequests` records.
 */
const fetchAllModePageOnce = async (
  serviceId: string,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  pageSize: number,
  cursorState?: ServiceCursorState
): Promise<{ items: ServiceRequest[]; state: ServiceCursorState }> => {
  // If in unordered missing-createdAt fallback mode, serve directly from fallbackDocs
  if (cursorState?.fallbackDocs) {
    const offset = cursorState.fallbackOffset ?? 0;
    const slice = cursorState.fallbackDocs.slice(offset, offset + pageSize);
    const nextOffset = offset + slice.length;
    const primaryHasMore = nextOffset < cursorState.fallbackDocs.length;
    return appendLegacyTailIfNeeded(serviceId, 'all', dateFrom, dateTo, pageSize, slice, {
      ...cursorState,
      lastDoc: null,
      hasMore: primaryHasMore,
      fallbackDocs: cursorState.fallbackDocs,
      fallbackOffset: nextOffset
    });
  }

  // If primary is already exhausted and we are paging through legacy docs
  if (cursorState && !cursorState.newHasMore && !cursorState.generalHasMore && cursorState.legacyDocs) {
    return appendLegacyTailIfNeeded(serviceId, 'all', dateFrom, dateTo, pageSize, [], cursorState);
  }

  const loadedNewIds = new Set<string>(cursorState?.loadedNewIds ?? []);
  const isInitial = !cursorState;
  const shouldFetchNew = isInitial || Boolean(cursorState?.newHasMore);

  let newItems: ServiceRequest[] = [];
  let newLastDoc: QueryDocumentSnapshot<DocumentData> | null = cursorState?.newLastDoc ?? null;
  let newHasMore = Boolean(cursorState?.newHasMore);
  let newFallbackDocs = cursorState?.newFallbackDocs ?? null;
  let newFallbackOffset = cursorState?.newFallbackOffset ?? 0;

  if (shouldFetchNew) {
    const newRes = await fetchSingleStatusPageOnce(
      serviceId,
      'new',
      dateFrom,
      dateTo,
      pageSize,
      isInitial
        ? undefined
        : {
            lastDoc: newLastDoc,
            hasMore: newHasMore,
            fallbackDocs: newFallbackDocs,
            fallbackOffset: newFallbackOffset,
            legacyChecked: true
          }
    );
    newItems = newRes.items;
    newLastDoc = newRes.state.lastDoc;
    newHasMore = newRes.state.hasMore;
    newFallbackDocs = newRes.state.fallbackDocs ?? null;
    newFallbackOffset = newRes.state.fallbackOffset ?? 0;
    newItems.forEach((r) => {
      if (r.id) loadedNewIds.add(r.id);
    });
  }

  const remainingSlots = pageSize - newItems.length;
  let generalItems: ServiceRequest[] = [];
  let generalLastDoc = cursorState?.generalLastDoc ?? null;
  let generalHasMore = cursorState?.generalHasMore ?? true;

  if (!newHasMore && remainingSlots > 0 && generalHasMore) {
    const fill = await fetchGeneralFillDocs(
      serviceId,
      dateFrom,
      dateTo,
      remainingSlots,
      generalLastDoc,
      loadedNewIds
    );
    generalItems = fill.items;
    generalLastDoc = fill.lastConsumedDoc;
    generalHasMore = fill.hasMore;
  } else if (newHasMore) {
    generalHasMore = true;
  }

  const combined = [...newItems, ...generalItems];

  // Initial page missing-createdAt guard
  if (isInitial && !newHasMore && !generalHasMore) {
    const primaryServerCount = await fetchPrimaryCollectionCount(serviceId, 'all', dateFrom, dateTo);
    if (primaryServerCount !== null && primaryServerCount > combined.length) {
      const fullSorted = await fetchUnorderedPrimaryDocs(serviceId, 'all', dateFrom, dateTo);
      const slice = fullSorted.slice(0, pageSize);
      const fbHasMore = slice.length < fullSorted.length;
      return appendLegacyTailIfNeeded(serviceId, 'all', dateFrom, dateTo, pageSize, slice, {
        lastDoc: null,
        hasMore: fbHasMore,
        fallbackDocs: fullSorted,
        fallbackOffset: slice.length
      });
    }
  }

  const primaryHasMore = newHasMore || generalHasMore;
  return appendLegacyTailIfNeeded(serviceId, 'all', dateFrom, dateTo, pageSize, combined, {
    ...(cursorState || {}),
    lastDoc: generalLastDoc ?? newLastDoc,
    hasMore: primaryHasMore,
    newLastDoc,
    newHasMore,
    newFallbackDocs,
    newFallbackOffset,
    generalLastDoc,
    generalHasMore,
    loadedNewIds
  });
};

/**
 * Combines live 'new' head docs and general head docs for a single service in 'all' mode,
 * keeping all 'new' items first and filling up to pageSize with non-new items cleanly.
 */
const buildAllModeHeadFromSnapshots = (
  serviceId: string,
  pageSize: number,
  newDocs: ServiceRequest[],
  newLastDoc: QueryDocumentSnapshot<DocumentData> | null,
  newHasMore: boolean,
  newFallbackDocs: ServiceRequest[] | null,
  newFallbackOffset: number,
  generalRawDocs: QueryDocumentSnapshot<DocumentData>[],
  generalRawHasMore: boolean,
  legacyCount: number
): FilteredRequestsHeadUpdate => {
  const loadedNewIds = new Set<string>();
  const newSlice = newDocs.slice(0, pageSize);
  newSlice.forEach((r) => {
    if (r.id) loadedNewIds.add(r.id);
  });

  const remaining = Math.max(0, pageSize - newSlice.length);
  const generalSlice: ServiceRequest[] = [];
  let generalLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
  let hasUnusedNonNewInBatch = false;

  for (let i = 0; i < generalRawDocs.length; i++) {
    const d = generalRawDocs[i];
    if (loadedNewIds.has(d.id)) continue;
    if (generalSlice.length < remaining) {
      generalSlice.push(mapDocToRequest(d, serviceId));
      generalLastDoc = d;
    } else {
      hasUnusedNonNewInBatch = true;
      break;
    }
  }

  const generalHasMore = newHasMore
    ? (generalRawDocs.some((d) => !loadedNewIds.has(d.id)) || generalRawHasMore)
    : (hasUnusedNonNewInBatch || generalRawHasMore);

  const requests = [...newSlice, ...generalSlice];
  const hasMore = newHasMore || generalHasMore || legacyCount > 0;

  return {
    requests,
    hasMore,
    paginationState: {
      mode: 'single',
      single: {
        lastDoc: generalLastDoc ?? newLastDoc,
        hasMore,
        newLastDoc,
        newHasMore,
        newFallbackDocs,
        newFallbackOffset,
        generalLastDoc,
        generalHasMore,
        loadedNewIds,
        legacyChecked: legacyCount === 0,
        legacyPendingCount: legacyCount
      }
    }
  };
};

/**
 * Real-time subscription to Page 1 of filtered & sorted requests directly from Firestore.
 * Applies statusFilter and dateFrom/dateTo at the database query level BEFORE limit(pageSize).
 */
export const subscribeToFilteredRequestsHead = ({
  serviceId,
  statusFilter = 'all',
  dateFrom,
  dateTo,
  pageSize = 50,
  onUpdate
}: FilterQueryParams & {
  onUpdate: (result: FilteredRequestsHeadUpdate) => void;
}): (() => void) => {
  let disposed = false;

  // Multi-service mode ("all")
  if (serviceId === 'all') {
    const loadAllServicesHead = async () => {
      try {
        const results = await Promise.all(
          ALL_SERVICE_IDS.map(async (sid) => {
            const res =
              statusFilter === 'all'
                ? await fetchAllModePageOnce(sid, dateFrom, dateTo, pageSize)
                : await fetchSingleStatusPageOnce(sid, statusFilter, dateFrom, dateTo, pageSize);
            return { sid, ...res };
          })
        );
        if (disposed) return;

        const perService: Record<string, ServiceCursorState> = {};
        const mergedPool: ServiceRequest[] = [];
        for (const r of results) {
          perService[r.sid] = r.state;
          mergedPool.push(...r.items);
        }

        const sortedPool = sortRequestsByPriorityAndDate(
          mergeAndDeduplicateRequests(mergedPool, []),
          statusFilter
        );
        const pageItems = sortedPool.slice(0, pageSize);
        const buffer = sortedPool.slice(pageSize);
        const anyServiceHasMore = Object.values(perService).some(
          (s) => s.hasMore || s.newHasMore || s.generalHasMore
        );
        const hasMore = buffer.length > 0 || anyServiceHasMore;

        onUpdate({
          requests: pageItems,
          hasMore,
          paginationState: {
            mode: 'all_services',
            perService,
            allServicesBuffer: buffer
          }
        });
      } catch (err) {
        logger.error('Error loading all-services filtered head:', err);
        if (!disposed) {
          onUpdate({
            requests: [],
            hasMore: false,
            paginationState: { mode: 'all_services', perService: {}, allServicesBuffer: [] }
          });
        }
      }
    };

    void loadAllServicesHead();
    return () => {
      disposed = true;
    };
  }

  const coll = collection(db, `serviceRequests_${serviceId}`);
  const unsubscribes: (() => void)[] = [];

  // Check primary & legacy counts in parallel to detect missing-createdAt docs and legacy overflow
  let knownPrimaryCount: number | null = null;
  let knownLegacyCount = 0;
  let countsResolved = false;

  // Single-service 'all' mode: live 'new' listener + live general listener
  if (statusFilter === 'all') {
    let newReady = false;
    let generalReady = false;
    let newDocs: ServiceRequest[] = [];
    let newLastDoc: QueryDocumentSnapshot<DocumentData> | null = null;
    let newHasMore = false;
    let newFallbackDocs: ServiceRequest[] | null = null;
    let newFallbackOffset = 0;

    let generalRawDocs: QueryDocumentSnapshot<DocumentData>[] = [];
    let generalRawHasMore = false;

    const emitIfReady = async () => {
      if (disposed || !newReady || !generalReady) return;
      const head = buildAllModeHeadFromSnapshots(
        serviceId,
        pageSize,
        newDocs,
        newLastDoc,
        newHasMore,
        newFallbackDocs,
        newFallbackOffset,
        generalRawDocs,
        generalRawHasMore,
        knownLegacyCount
      );

      // Guard: if ordered query returned <= pageSize while primary collection actually holds more docs
      // (docs missing `createdAt`), switch cleanly to unordered sorted full primary + legacy pages.
      if (
        countsResolved &&
        !head.hasMore &&
        knownPrimaryCount !== null &&
        knownPrimaryCount > head.requests.length
      ) {
        const fullSorted = await fetchUnorderedPrimaryDocs(serviceId, 'all', dateFrom, dateTo);
        if (disposed) return;
        const slice = fullSorted.slice(0, pageSize);
        const fbHasMore = slice.length < fullSorted.length;
        const enriched = await appendLegacyTailIfNeeded(serviceId, 'all', dateFrom, dateTo, pageSize, slice, {
          lastDoc: null,
          hasMore: fbHasMore,
          fallbackDocs: fullSorted,
          fallbackOffset: slice.length
        });
        if (disposed) return;
        onUpdate({
          requests: enriched.items,
          hasMore: enriched.state.hasMore,
          paginationState: { mode: 'single', single: enriched.state }
        });
        return;
      }

      if (!newHasMore && !head.paginationState.single?.generalHasMore && knownLegacyCount > 0 && head.requests.length < pageSize) {
        const enriched = await appendLegacyTailIfNeeded(
          serviceId,
          'all',
          dateFrom,
          dateTo,
          pageSize,
          head.requests,
          { ...(head.paginationState.single!), hasMore: false, legacyChecked: false }
        );
        if (disposed) return;
        onUpdate({
          requests: enriched.items,
          hasMore: enriched.state.hasMore,
          paginationState: { mode: 'single', single: enriched.state }
        });
        return;
      }

      onUpdate(head);
    };

    void Promise.all([
      fetchPrimaryCollectionCount(serviceId, 'all', dateFrom, dateTo),
      fetchLegacyCollectionCount(serviceId, 'all', dateFrom, dateTo)
    ]).then(([pCount, lCount]) => {
      if (disposed) return;
      knownPrimaryCount = pCount;
      knownLegacyCount = lCount;
      countsResolved = true;
      void emitIfReady();
    });

    const newConstraints = buildAllFilterConstraints('new', dateFrom, dateTo);
    const newPrimaryQ = query(coll, ...newConstraints, orderBy('createdAt', 'desc'), limit(pageSize + 1));

    const attachFallbackNewListener = () => {
      const sc = buildStatusConstraint('new')!;
      const fallbackQ = query(coll, sc);
      const unsubFb = onSnapshot(
        fallbackQ,
        (snap) => {
          const allNew = sortRequestsByPriorityAndDate(
            snap.docs
              .map((d) => mapDocToRequest(d, serviceId))
              .filter((r) => matchesStatusAndDateFilter(r, 'new', dateFrom, dateTo)),
            'new'
          );
          newDocs = allNew.slice(0, pageSize);
          newLastDoc = null;
          newHasMore = allNew.length > pageSize;
          newFallbackDocs = allNew;
          newFallbackOffset = newDocs.length;
          newReady = true;
          void emitIfReady();
        },
        (fbErr) => {
          logger.error(`Fallback new listener error for service ${serviceId}:`, fbErr);
          newDocs = [];
          newHasMore = false;
          newReady = true;
          void emitIfReady();
        }
      );
      unsubscribes.push(unsubFb);
    };

    const unsubNew = onSnapshot(
      newPrimaryQ,
      (snap) => {
        const hasMore = snap.docs.length > pageSize;
        const docsToUse = hasMore ? snap.docs.slice(0, pageSize) : snap.docs;
        newDocs = docsToUse.map((d) => mapDocToRequest(d, serviceId));
        newLastDoc = docsToUse.length > 0 ? docsToUse[docsToUse.length - 1] : null;
        newHasMore = hasMore;
        newFallbackDocs = null;
        newFallbackOffset = 0;
        newReady = true;
        void emitIfReady();
      },
      (err) => {
        if (isMissingIndexError(err)) {
          logger.warn(`Missing composite index on serviceRequests_${serviceId} for 'new' head; activating single-field real-time fallback.`);
          attachFallbackNewListener();
          return;
        }
        logger.error(`Error in new-head subscription for service ${serviceId}:`, err);
        newDocs = [];
        newHasMore = false;
        newReady = true;
        void emitIfReady();
      }
    );
    unsubscribes.push(unsubNew);

    const dc = buildDateConstraints(dateFrom, dateTo);
    const generalQ = query(coll, ...dc, orderBy('createdAt', 'desc'), limit(pageSize + 1));
    const unsubGeneral = onSnapshot(
      generalQ,
      (snap) => {
        generalRawHasMore = snap.docs.length > pageSize;
        generalRawDocs = generalRawHasMore ? snap.docs.slice(0, pageSize) : snap.docs;
        generalReady = true;
        void emitIfReady();
      },
      (err) => {
        logger.error(`Error in general-head subscription for service ${serviceId}:`, err);
        generalRawDocs = [];
        generalRawHasMore = false;
        generalReady = true;
        void emitIfReady();
      }
    );
    unsubscribes.push(unsubGeneral);

    return () => {
      disposed = true;
      unsubscribes.forEach((u) => u());
    };
  }

  // Single-service specific status mode ('new', 'submitted', 'receipt_sent', 'completed', 'rejected')
  const constraints = buildAllFilterConstraints(statusFilter, dateFrom, dateTo);
  const primaryQ = query(coll, ...constraints, orderBy('createdAt', 'desc'), limit(pageSize + 1));
  let lastPrimarySnapDocs: QueryDocumentSnapshot<DocumentData>[] | null = null;

  const emitSingleStatus = async (docs: QueryDocumentSnapshot<DocumentData>[]) => {
    if (disposed) return;
    const primaryHasMore = docs.length > pageSize;
    const docsToUse = primaryHasMore ? docs.slice(0, pageSize) : docs;
    const requests = docsToUse.map((d) => mapDocToRequest(d, serviceId));
    const lastDoc = docsToUse.length > 0 ? docsToUse[docsToUse.length - 1] : null;

    const hasMissingStatus =
      countsResolved &&
      !primaryHasMore &&
      (statusFilter === 'new' || statusFilter === 'pending') &&
      knownPrimaryCount !== null
        ? await countPrimaryMissingStatusNewDocs(serviceId, knownPrimaryCount)
        : false;

    if (
      countsResolved &&
      !primaryHasMore &&
      ((knownPrimaryCount !== null && knownPrimaryCount > requests.length) || hasMissingStatus)
    ) {
      const fullSorted = await fetchUnorderedPrimaryDocs(
        serviceId,
        statusFilter,
        dateFrom,
        dateTo,
        hasMissingStatus
      );
      if (disposed) return;
      const slice = fullSorted.slice(0, pageSize);
      const fbHasMore = slice.length < fullSorted.length;
      const enriched = await appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, slice, {
        lastDoc: null,
        hasMore: fbHasMore,
        fallbackDocs: fullSorted,
        fallbackOffset: slice.length
      });
      if (disposed) return;
      onUpdate({
        requests: enriched.items,
        hasMore: enriched.state.hasMore,
        paginationState: { mode: 'single', single: enriched.state }
      });
      return;
    }

    if (!primaryHasMore && knownLegacyCount > 0) {
      const enriched = await appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, requests, {
        lastDoc,
        hasMore: false,
        legacyChecked: false
      });
      if (disposed) return;
      onUpdate({
        requests: enriched.items,
        hasMore: enriched.state.hasMore,
        paginationState: { mode: 'single', single: enriched.state }
      });
      return;
    }

    onUpdate({
      requests,
      hasMore: primaryHasMore,
      paginationState: {
        mode: 'single',
        single: {
          lastDoc,
          hasMore: primaryHasMore,
          legacyChecked: countsResolved && knownLegacyCount === 0
        }
      }
    });
  };

  void Promise.all([
    fetchPrimaryCollectionCount(serviceId, statusFilter, dateFrom, dateTo),
    fetchLegacyCollectionCount(serviceId, statusFilter, dateFrom, dateTo)
  ]).then(([pCount, lCount]) => {
    if (disposed) return;
    knownPrimaryCount = pCount;
    knownLegacyCount = lCount;
    countsResolved = true;
    if (lastPrimarySnapDocs !== null) {
      void emitSingleStatus(lastPrimarySnapDocs);
    }
  });

  const attachFallbackStatusListener = () => {
    const sc = buildStatusConstraint(statusFilter);
    const fallbackQ = sc ? query(coll, sc) : query(coll, ...buildDateConstraints(dateFrom, dateTo));
    const unsubFb = onSnapshot(
      fallbackQ,
      (snap) => {
        if (disposed) return;
        const sorted = sortRequestsByPriorityAndDate(
          snap.docs
            .map((d) => mapDocToRequest(d, serviceId))
            .filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo)),
          statusFilter
        );
        const pageSlice = sorted.slice(0, pageSize);
        const fbHasMore = sorted.length > pageSize;
        void appendLegacyTailIfNeeded(serviceId, statusFilter, dateFrom, dateTo, pageSize, pageSlice, {
          lastDoc: null,
          hasMore: fbHasMore,
          fallbackDocs: sorted,
          fallbackOffset: pageSlice.length
        }).then((enriched) => {
          if (disposed) return;
          onUpdate({
            requests: enriched.items,
            hasMore: enriched.state.hasMore,
            paginationState: { mode: 'single', single: enriched.state }
          });
        });
      },
      (fbErr) => {
        logger.error(`Fallback status listener error for service ${serviceId}:`, fbErr);
        if (!disposed) {
          onUpdate({
            requests: [],
            hasMore: false,
            paginationState: { mode: 'single', single: { lastDoc: null, hasMore: false } }
          });
        }
      }
    );
    unsubscribes.push(unsubFb);
  };

  const unsub = onSnapshot(
    primaryQ,
    (snap) => {
      if (disposed) return;
      lastPrimarySnapDocs = snap.docs;
      void emitSingleStatus(snap.docs);
    },
    (err) => {
      if (isMissingIndexError(err)) {
        logger.warn(`Missing composite index on serviceRequests_${serviceId} (${statusFilter}); activating single-field real-time fallback.`);
        attachFallbackStatusListener();
        return;
      }
      logger.error(`Error in filtered head subscription for service ${serviceId}:`, err);
      if (!disposed) {
        onUpdate({
          requests: [],
          hasMore: false,
          paginationState: { mode: 'single', single: { lastDoc: null, hasMore: false } }
        });
      }
    }
  );
  unsubscribes.push(unsub);

  return () => {
    disposed = true;
    unsubscribes.forEach((u) => u());
  };
};

/**
 * Fetches the next page (+50) using the EXACT same active filters and sort order.
 */
export const fetchFilteredRequestsNextPage = async ({
  serviceId,
  statusFilter = 'all',
  dateFrom,
  dateTo,
  pageSize = 50,
  paginationState
}: FilterQueryParams & {
  paginationState: FilteredPaginationState | null;
}): Promise<FilteredRequestsHeadUpdate> => {
  if (!paginationState) {
    return {
      requests: [],
      hasMore: false,
      paginationState: { mode: serviceId === 'all' ? 'all_services' : 'single' }
    };
  }

  if (serviceId === 'all' && paginationState.mode === 'all_services') {
    let buffer = [...(paginationState.allServicesBuffer ?? [])];
    const perService = { ...(paginationState.perService ?? {}) };

    if (buffer.length < pageSize) {
      const sidsToFetch = ALL_SERVICE_IDS.filter((sid) => {
        const st = perService[sid];
        return st && (st.hasMore || st.newHasMore || st.generalHasMore);
      });

      if (sidsToFetch.length > 0) {
        const fetched = await Promise.all(
          sidsToFetch.map(async (sid) => {
            const cur = perService[sid];
            const res =
              statusFilter === 'all'
                ? await fetchAllModePageOnce(sid, dateFrom, dateTo, pageSize, cur)
                : await fetchSingleStatusPageOnce(sid, statusFilter, dateFrom, dateTo, pageSize, cur);
            return { sid, ...res };
          })
        );
        for (const r of fetched) {
          perService[r.sid] = r.state;
          buffer = mergeAndDeduplicateRequests(buffer, r.items);
        }
        buffer = sortRequestsByPriorityAndDate(buffer, statusFilter);
      }
    }

    const pageItems = buffer.slice(0, pageSize);
    const nextBuffer = buffer.slice(pageSize);
    const anyServiceHasMore = Object.values(perService).some(
      (s) => s.hasMore || s.newHasMore || s.generalHasMore
    );
    const hasMore = nextBuffer.length > 0 || anyServiceHasMore;

    return {
      requests: pageItems,
      hasMore,
      paginationState: {
        mode: 'all_services',
        perService,
        allServicesBuffer: nextBuffer
      }
    };
  }

  const singleState = paginationState.single;
  if (!singleState) {
    return {
      requests: [],
      hasMore: false,
      paginationState
    };
  }

  if (statusFilter === 'all') {
    const res = await fetchAllModePageOnce(serviceId, dateFrom, dateTo, pageSize, singleState);
    return {
      requests: res.items,
      hasMore: res.state.hasMore,
      paginationState: { mode: 'single', single: res.state }
    };
  }

  const res = await fetchSingleStatusPageOnce(serviceId, statusFilter, dateFrom, dateTo, pageSize, singleState);
  return {
    requests: res.items,
    hasMore: res.state.hasMore,
    paginationState: { mode: 'single', single: res.state }
  };
};

// Backward-compatible wrappers
export const subscribeToLiveHeadRequests = (
  serviceId: string,
  pageSize: number = 50,
  onUpdate: (result: RequestsPageResult) => void
): (() => void) => {
  return subscribeToFilteredRequestsHead({
    serviceId,
    statusFilter: 'all',
    pageSize,
    onUpdate: ({ requests, hasMore, paginationState }) => {
      onUpdate({
        requests,
        lastDoc: paginationState.single?.lastDoc ?? null,
        hasMore
      });
    }
  });
};

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
