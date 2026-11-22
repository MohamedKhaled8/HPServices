import type { ServiceRequest } from '../types/index.ts';

export const isRequestStatusPending = (status?: string): boolean => {
  return status === 'pending' || status === 'submitted' || status === 'in_review';
};

/**
 * Determines whether the "Load More" button should be displayed.
 * STRICT RULE: Determined strictly from real database cursor pagination (hasMore).
 * NEVER hide based on totalCount <= 0 or missing count.
 */
export const shouldShowLoadMoreButton = (
  hasMore: boolean,
  _displayCount: number = 0,
  _totalCount: number | null = null
): boolean => {
  return Boolean(hasMore);
};

/**
 * Formats the badge string shown inside the "Load More" button.
 * STRICT RULE: If totalCount > 0, show "المعروض X من أصل Y".
 * If totalCount <= 0 or null, show "المعروض X" (NEVER show "من أصل 0").
 */
export const formatPaginationBadge = (
  displayCount: number,
  totalCount: number | null = null
): string => {
  if (totalCount != null && totalCount > 0) {
    return `المعروض ${displayCount} من أصل ${totalCount}`;
  }
  return `المعروض ${displayCount}`;
};

/**
 * Merges live head requests with older paginated requests cleanly,
 * deduplicating by request ID to prevent duplicate table rows when items shift.
 */
export const mergeAndDeduplicateRequests = (
  liveRequests: ServiceRequest[],
  olderRequests: ServiceRequest[]
): ServiceRequest[] => {
  const seenIds = new Set<string>();
  const merged: ServiceRequest[] = [];

  for (const req of liveRequests) {
    const id = req.id || `${req.serviceId}_${req.createdAt}`;
    if (!seenIds.has(id)) {
      seenIds.add(id);
      merged.push(req);
    }
  }

  for (const req of olderRequests) {
    const id = req.id || `${req.serviceId}_${req.createdAt}`;
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
