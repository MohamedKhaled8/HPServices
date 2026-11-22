import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { ServiceRequest } from '../types';
import {
  subscribeToLiveHeadRequests,
  fetchOlderRequestsPage,
  mergeAndDeduplicateRequests
} from '../services/requestsPaginationService';

export interface UseHybridRequestsPaginationOptions {
  serviceId: string | null;
  pageSize?: number;
  olderPageSize?: number;
  onInitialBatchLoaded?: (requests: ServiceRequest[]) => void;
}

export function useHybridRequestsPagination({
  serviceId,
  pageSize = 25,
  olderPageSize = 50,
  onInitialBatchLoaded
}: UseHybridRequestsPaginationOptions) {
  const [liveRequests, setLiveRequests] = useState<ServiceRequest[]>([]);
  const [olderRequests, setOlderRequests] = useState<ServiceRequest[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [hasMoreOlder, setHasMoreOlder] = useState<boolean>(true);

  const liveLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const olderLastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const callbackRef = useRef(onInitialBatchLoaded);
  callbackRef.current = onInitialBatchLoaded;

  useEffect(() => {
    if (!serviceId) {
      setLiveRequests([]);
      setOlderRequests([]);
      liveLastDocRef.current = null;
      olderLastDocRef.current = null;
      setHasMoreOlder(true);
      return;
    }

    setOlderRequests([]);
    olderLastDocRef.current = null;
    setHasMoreOlder(true);

    const unsubscribe = subscribeToLiveHeadRequests(
      serviceId,
      pageSize,
      ({ requests, lastDoc, hasMore }) => {
        setLiveRequests(requests);
        liveLastDocRef.current = lastDoc;
        setHasMoreOlder(hasMore);
        callbackRef.current?.(requests);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [serviceId, pageSize]);

  const loadMore = useCallback(
    async (overrideServiceId?: string) => {
      const activeServiceId = overrideServiceId || serviceId;
      if (isLoadingMore || !activeServiceId || !hasMoreOlder) return;

      const cursor = olderLastDocRef.current ?? liveLastDocRef.current;
      if (!cursor) {
        setHasMoreOlder(false);
        return;
      }

      setIsLoadingMore(true);
      try {
        const res = await fetchOlderRequestsPage(activeServiceId, cursor, olderPageSize);
        if (res.requests.length > 0) {
          setOlderRequests((prev) => [...prev, ...res.requests]);
          olderLastDocRef.current = res.lastDoc;
        }
        setHasMoreOlder(res.hasMore);
      } finally {
        setIsLoadingMore(false);
      }
    },
    [isLoadingMore, serviceId, hasMoreOlder, olderPageSize]
  );

  const updateLocalRequest = useCallback((requestId: string, patch: Partial<ServiceRequest>) => {
    setOlderRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, ...patch } : r))
    );
    setLiveRequests((prev) =>
      prev.map((r) => (r.id === requestId ? { ...r, ...patch } : r))
    );
  }, []);

  const deleteLocalRequest = useCallback((requestId: string) => {
    setOlderRequests((prev) => prev.filter((r) => r.id !== requestId));
    setLiveRequests((prev) => prev.filter((r) => r.id !== requestId));
  }, []);

  const combinedRequests = useMemo(
    () => mergeAndDeduplicateRequests(liveRequests, olderRequests),
    [liveRequests, olderRequests]
  );

  return {
    combinedRequests,
    liveRequests,
    olderRequests,
    isLoadingMore,
    hasMore: hasMoreOlder,
    loadMore,
    updateLocalRequest,
    deleteLocalRequest
  };
}
