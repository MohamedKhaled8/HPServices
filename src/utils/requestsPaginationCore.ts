import type { ServiceRequest } from '../types/index.ts';

export type RequestStatusFilter =
  | 'all'
  | 'new'
  | 'pending'
  | 'submitted'
  | 'receipt_sent'
  | 'completed'
  | 'rejected';

export const NEW_REQUEST_STATUSES = ['pending', 'new', 'in_review'] as const;

export const isRequestStatusPending = (status?: string): boolean => {
  return status === 'pending' || status === 'submitted' || status === 'in_review';
};

export const isNewRequestStatus = (status?: string): boolean => {
  const s = String(status || '').trim();
  return s === '' || s === 'pending' || s === 'new' || s === 'in_review';
};

/**
 * Normalizes any createdAt representation (ISO string, Firestore Timestamp, Date, epoch ms)
 * into epoch milliseconds for deterministic sorting and date-range checks.
 */
export const getRequestCreatedAtMs = (createdAt: unknown): number => {
  if (!createdAt) return 0;
  if (typeof createdAt === 'number') return Number.isFinite(createdAt) ? createdAt : 0;
  if (createdAt instanceof Date) {
    const ms = createdAt.getTime();
    return Number.isNaN(ms) ? 0 : ms;
  }
  if (typeof createdAt === 'object' && createdAt !== null) {
    const obj = createdAt as { toDate?: () => Date; seconds?: number };
    if (typeof obj.toDate === 'function') {
      const ms = obj.toDate().getTime();
      return Number.isNaN(ms) ? 0 : ms;
    }
    if (typeof obj.seconds === 'number') {
      return obj.seconds * 1000;
    }
  }
  const ms = new Date(String(createdAt)).getTime();
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Checks whether a request matches a status filter and optional YYYY-MM-DD date bounds.
 * Used as a local consistency guard on server-filtered results and fallback queries.
 */
export const matchesStatusAndDateFilter = (
  req: ServiceRequest,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): boolean => {
  const rawStatus = String((req as { status?: string }).status || '').trim();
  if (statusFilter === 'new' || statusFilter === 'pending') {
    if (!isNewRequestStatus(rawStatus)) return false;
  } else if (statusFilter !== 'all') {
    if (rawStatus !== statusFilter) return false;
  }

  if (dateFrom || dateTo) {
    const ms = getRequestCreatedAtMs(req.createdAt);
    if (!ms) return false;
    if (dateFrom) {
      const start = new Date(`${dateFrom}T00:00:00.000`).getTime();
      if (!Number.isNaN(start) && ms < start) return false;
    }
    if (dateTo) {
      const end = new Date(`${dateTo}T23:59:59.999`).getTime();
      if (!Number.isNaN(end) && ms > end) return false;
    }
  }

  return true;
};

/**
 * Deterministic sorting:
 * - For "new" or any specific status filter: strictly createdAt DESC (newest first).
 * - For "all": unhandled/new requests prioritized at the top (createdAt DESC),
 *   followed by already-processed requests (createdAt DESC).
 */
export const sortRequestsByPriorityAndDate = (
  requests: ServiceRequest[],
  statusFilter: RequestStatusFilter = 'all'
): ServiceRequest[] => {
  const copy = [...requests];
  copy.sort((a, b) => {
    if (statusFilter === 'all') {
      const aNew = isNewRequestStatus(a.status);
      const bNew = isNewRequestStatus(b.status);
      if (aNew !== bNew) {
        return aNew ? -1 : 1;
      }
    }
    const timeDiff = getRequestCreatedAtMs(b.createdAt) - getRequestCreatedAtMs(a.createdAt);
    if (timeDiff !== 0) return timeDiff;
    return String(a.id || '').localeCompare(String(b.id || ''));
  });
  return copy;
};

/**
 * Determines whether the "Load More" button should be displayed.
 * When totalCount > 0, enforces displayCount < totalCount strictly alongside hasMore.
 * When totalCount is 0 and displayCount === 0, hides the button.
 * When totalCount is null (or 0 while items exist), relies on real cursor hasMore.
 */
export const shouldShowLoadMoreButton = (
  hasMore: boolean,
  displayCount: number = 0,
  totalCount: number | null = null
): boolean => {
  if (totalCount != null && totalCount > 0) {
    return displayCount < totalCount && Boolean(hasMore);
  }
  if (totalCount === 0 && displayCount === 0) {
    return false;
  }
  return Boolean(hasMore);
};

/**
 * Formats the counter badge string.
 * Shows "المعروض X من أصل Y" when totalCount > 0 (or 0 of 0 when empty).
 * Omits "من أصل 0" if items exist while count is unavailable (0/null).
 */
export const formatPaginationBadge = (
  displayCount: number,
  totalCount: number | null = null
): string => {
  if (totalCount != null && totalCount > 0) {
    return `المعروض ${displayCount} من أصل ${totalCount}`;
  }
  if (totalCount === 0 && displayCount === 0) {
    return 'المعروض 0 من أصل 0';
  }
  return `المعروض ${displayCount}`;
};

/**
 * Merges live head requests with older paginated requests cleanly,
 * deduplicating by serviceId+id to prevent duplicate table rows across pages or services.
 */
export const mergeAndDeduplicateRequests = (
  liveRequests: ServiceRequest[],
  olderRequests: ServiceRequest[]
): ServiceRequest[] => {
  const seenIds = new Set<string>();
  const merged: ServiceRequest[] = [];

  const getKey = (req: ServiceRequest): string => {
    if (req.id) {
      return req.serviceId ? `${req.serviceId}__${req.id}` : req.id;
    }
    return `${req.serviceId}_${req.createdAt}`;
  };

  for (const req of liveRequests) {
    const id = getKey(req);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      merged.push(req);
    }
  }

  for (const req of olderRequests) {
    const id = getKey(req);
    if (!seenIds.has(id)) {
      seenIds.add(id);
      merged.push(req);
    }
  }

  return merged;
};

export interface CounterState {
  total: number;
  pending: number;
}

export const applyAtomicCounterDelta = (
  current: CounterState,
  action: 'create' | 'delete' | 'status_change',
  payload: { oldStatus?: string; newStatus?: string }
): CounterState => {
  let { total, pending } = current;

  if (action === 'create') {
    total += 1;
    if (isRequestStatusPending(payload.newStatus)) {
      pending += 1;
    }
  } else if (action === 'delete') {
    total = Math.max(0, total - 1);
    if (isRequestStatusPending(payload.oldStatus)) {
      pending = Math.max(0, pending - 1);
    }
  } else if (action === 'status_change') {
    const wasPending = isRequestStatusPending(payload.oldStatus);
    const isNowPending = isRequestStatusPending(payload.newStatus);
    if (wasPending && !isNowPending) {
      pending = Math.max(0, pending - 1);
    } else if (!wasPending && isNowPending) {
      pending += 1;
    }
  }

  return { total, pending };
};
