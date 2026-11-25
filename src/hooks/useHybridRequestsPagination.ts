import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ServiceRequest } from '../types';
import {
  subscribeToFilteredRequestsHead,
  fetchFilteredRequestsNextPage,
  fetchFilteredRequestsCount,
  fetchServiceStatusCounts,
  mergeAndDeduplicateRequests,
  type FilteredPaginationState
} from '../services/requestsPaginationService';
import {
  type RequestStatusFilter,
  isNewRequestStatus,
  matchesStatusAndDateFilter,
  sortRequestsByPriorityAndDate
} from '../utils/requestsPaginationCore';

export interface UseHybridRequestsPaginationOptions {
  serviceId: string | null;
  statusFilter?: RequestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  olderPageSize?: number;
  onInitialBatchLoaded?: (requests: ServiceRequest[]) => void;
}

export function useHybridRequestsPagination({
  serviceId,
  statusFilter = 'all',
  dateFrom = '',
  dateTo = '',
  pageSize = 50,
  olderPageSize = 50,
  onInitialBatchLoaded
}: UseHybridRequestsPaginationOptions) {
  const [liveRequests, setLiveRequests] = useState<ServiceRequest[]>([]);
  const [olderRequests, setOlderRequests] = useState<ServiceRequest[]>([]);
  const [isLoadingInitial, setIsLoadingInitial] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(false);
  const [totalMatchingCount, setTotalMatchingCount] = useState<number | null>(null);
  const [statusCounts, setStatusCounts] = useState<{ all: number | null; new: number | null }>({ all: null, new: null });

  const paginationStateRef = useRef<FilteredPaginationState | null>(null);
  const hasLoadedOlderPagesRef = useRef<boolean>(false);
  const filterGenRef = useRef<number>(0);
  const fullAllScopeRef = useRef<string | null>(null);
  const activeQueryKeyRef = useRef<string>('');
  const serverTotalRef = useRef<number | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);
  const callbackRef = useRef(onInitialBatchLoaded);
  callbackRef.current = onInitialBatchLoaded;

  const baseScopeKey = serviceId ? `${serviceId}__${dateFrom}__${dateTo}` : '';

  const refreshCounts = useCallback(
    async (sid: string, status: RequestStatusFilter, from: string, to: string, gen: number) => {
      const [exactCount, svcCounts] = await Promise.all([
        fetchFilteredRequestsCount({ serviceId: sid, statusFilter: status, dateFrom: from || undefined, dateTo: to || undefined }),
        fetchServiceStatusCounts(sid, from || undefined, to || undefined)
      ]);
      if (filterGenRef.current !== gen) return;
      serverTotalRef.current = exactCount;
      setTotalMatchingCount(exactCount);
      setStatusCounts(svcCounts);
    },
    []
  );

  useEffect(() => () => {
    unsubRef.current?.();
    unsubRef.current = null;
  }, []);

  useEffect(() => {
    if (!serviceId) {
      unsubRef.current?.();
      unsubRef.current = null;
      filterGenRef.current++;
      fullAllScopeRef.current = null;
      activeQueryKeyRef.current = '';
      serverTotalRef.current = null;
      setLiveRequests([]);
      setOlderRequests([]);
      paginationStateRef.current = null;
      hasLoadedOlderPagesRef.current = false;
      setHasMoreOlder(false);
      setIsLoadingInitial(false);
      setIsLoadingMore(false);
      setTotalMatchingCount(null);
      setStatusCounts({ all: null, new: null });
      return;
    }

    if (fullAllScopeRef.current === baseScopeKey) {
      return;
    }

    const nextQueryKey = `${baseScopeKey}__${statusFilter}__${pageSize}`;
    if (activeQueryKeyRef.current === nextQueryKey) return;

    unsubRef.current?.();
    unsubRef.current = null;
    activeQueryKeyRef.current = nextQueryKey;
    fullAllScopeRef.current = null;
    serverTotalRef.current = null;

    const gen = ++filterGenRef.current;
    setLiveRequests([]);
    setOlderRequests([]);
    paginationStateRef.current = null;
    hasLoadedOlderPagesRef.current = false;
    setHasMoreOlder(false);
    setIsLoadingInitial(true);
    setIsLoadingMore(false);
    setTotalMatchingCount(null);

    void refreshCounts(serviceId, statusFilter, dateFrom, dateTo, gen);

    unsubRef.current = subscribeToFilteredRequestsHead({
      serviceId,
      statusFilter,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      pageSize,
      onUpdate: ({ requests, hasMore, paginationState }) => {
        if (filterGenRef.current !== gen) return;
        setLiveRequests(requests);
        if (!hasLoadedOlderPagesRef.current) {
          paginationStateRef.current = paginationState;
          setHasMoreOlder(hasMore);
          if (hasMore) {
            fullAllScopeRef.current = null;
          } else if (
            statusFilter === 'all' &&
            serverTotalRef.current !== null &&
            requests.length >= serverTotalRef.current &&
            requests.length < pageSize
          ) {
            fullAllScopeRef.current = baseScopeKey;
          }
        }
        setIsLoadingInitial(false);
        callbackRef.current?.(requests);
      }
    });
  }, [serviceId, statusFilter, dateFrom, dateTo, baseScopeKey, pageSize, refreshCounts]);

  const loadMore = useCallback(
    async (overrideServiceId?: string) => {
      const activeServiceId = overrideServiceId || serviceId;
      if (isLoadingMore || !activeServiceId || !hasMoreOlder || !paginationStateRef.current) return;

      const gen = filterGenRef.current;
      setIsLoadingMore(true);
      try {
        const res = await fetchFilteredRequestsNextPage({
          serviceId: activeServiceId,
          statusFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          pageSize: olderPageSize,
          paginationState: paginationStateRef.current
        });
        if (filterGenRef.current !== gen) return;

        hasLoadedOlderPagesRef.current = true;
        paginationStateRef.current = res.paginationState;
        let nextMergedCount = liveRequests.length + olderRequests.length;
        if (res.requests.length > 0) {
          const nextOlder = mergeAndDeduplicateRequests(olderRequests, res.requests);
          nextMergedCount = mergeAndDeduplicateRequests(liveRequests, nextOlder).length;
          setOlderRequests(nextOlder);
        }
        setHasMoreOlder(res.hasMore);
        if (res.hasMore) {
          fullAllScopeRef.current = null;
        } else if (
          statusFilter === 'all' &&
          serverTotalRef.current !== null &&
          nextMergedCount >= serverTotalRef.current &&
          olderRequests.length === 0
        ) {
          fullAllScopeRef.current = baseScopeKey;
        }
      } finally {
        if (filterGenRef.current === gen) setIsLoadingMore(false);
      }
    },
    [isLoadingMore, serviceId, statusFilter, dateFrom, dateTo, baseScopeKey, hasMoreOlder, olderPageSize, liveRequests, olderRequests]
  );

  const updateLocalRequest = useCallback(
    (requestId: string, patch: Partial<ServiceRequest>) => {
      setOlderRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, ...patch } : r)));
      setLiveRequests((prev) => prev.map((r) => (r.id === requestId ? { ...r, ...patch } : r)));
      if (serviceId && patch.status !== undefined && fullAllScopeRef.current !== baseScopeKey) {
        void refreshCounts(serviceId, statusFilter, dateFrom, dateTo, filterGenRef.current);
      }
    },
    [serviceId, statusFilter, dateFrom, dateTo, baseScopeKey, refreshCounts]
  );

  const deleteLocalRequest = useCallback(
    (requestId: string) => {
      setOlderRequests((prev) => prev.filter((r) => r.id !== requestId));
      setLiveRequests((prev) => prev.filter((r) => r.id !== requestId));
      if (serviceId && fullAllScopeRef.current !== baseScopeKey) {
        void refreshCounts(serviceId, statusFilter, dateFrom, dateTo, filterGenRef.current);
      }
    },
    [serviceId, statusFilter, dateFrom, dateTo, baseScopeKey, refreshCounts]
  );

  const allMerged = useMemo(() => mergeAndDeduplicateRequests(liveRequests, olderRequests), [liveRequests, olderRequests]);

  const combinedRequests = useMemo(() => {
    const filtered = allMerged.filter((req) =>
      matchesStatusAndDateFilter(req, statusFilter, dateFrom || undefined, dateTo || undefined)
    );
    return sortRequestsByPriorityAndDate(filtered, statusFilter);
  }, [allMerged, statusFilter, dateFrom, dateTo]);

  const isInMemoryComplete = Boolean(serviceId && fullAllScopeRef.current === baseScopeKey);
  const effectiveStatusCounts = useMemo(() => {
    if (!isInMemoryComplete) return statusCounts;
    const allInScope = allMerged.filter((r) => matchesStatusAndDateFilter(r, 'all', dateFrom || undefined, dateTo || undefined));
    return { all: allInScope.length, new: allInScope.filter((r) => isNewRequestStatus(r.status)).length };
  }, [isInMemoryComplete, allMerged, dateFrom, dateTo, statusCounts]);

  return {
    combinedRequests,
    liveRequests,
    olderRequests,
    isLoadingInitial,
    isLoadingMore,
    hasMore: isInMemoryComplete ? false : hasMoreOlder,
    totalMatchingCount: isInMemoryComplete ? combinedRequests.length : totalMatchingCount,
    statusCounts: effectiveStatusCounts,
    loadMore,
    updateLocalRequest,
    deleteLocalRequest
  };
}
