import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { ServiceRequest, StudentData } from '../types';
import { filterRequests, searchRequests } from '../services/requestsSearchService';
import {
  mergeAndDeduplicateRequests,
  sortRequestsByPriorityAndDate,
  type RequestStatusFilter
} from '../utils/requestsPaginationCore';

export interface UseRequestsSearchOptions {
  activeServiceId: string | null;
  loadedRequests: ServiceRequest[];
  students?: Record<string, StudentData>;
  hasMore?: boolean;
  statusFilter?: RequestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  pageSize?: number;
  debounceMs?: number;
}

export interface UseRequestsSearchResult {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  clearSearch: () => void;
  isSearching: boolean;
  isDbSearching: boolean;
  searchResults: ServiceRequest[] | null;
  matchCount: number;
  hasMoreSearchResults: boolean;
  loadMoreSearchResults: () => void;
}

export function useRequestsSearch({
  activeServiceId,
  loadedRequests,
  students,
  hasMore = false,
  statusFilter = 'all',
  dateFrom = '',
  dateTo = '',
  pageSize = 50,
  debounceMs = 400
}: UseRequestsSearchOptions): UseRequestsSearchResult {
  const [searchTerm, setSearchTermState] = useState<string>('');
  const [dbResults, setDbResults] = useState<ServiceRequest[] | null>(null);
  const [isDbSearching, setIsDbSearching] = useState<boolean>(false);
  const [visibleLimit, setVisibleLimit] = useState<number>(pageSize);
  const filterKeyRef = useRef<string>('');
  const searchGenRef = useRef<number>(0);

  const currentFilterKey = `${activeServiceId || ''}__${statusFilter}__${dateFrom}__${dateTo}`;

  // Reset pagination & stale results cleanly whenever filters or search term change
  useEffect(() => {
    if (filterKeyRef.current !== currentFilterKey) {
      filterKeyRef.current = currentFilterKey;
      setDbResults(null);
      setIsDbSearching(false);
    }
    setVisibleLimit(pageSize);
  }, [currentFilterKey, searchTerm, pageSize]);

  const isQueryValid = searchTerm.trim().length >= 2;

  // Instant local-first filtering on already-loaded items
  const localResults = useMemo(() => {
    if (!isQueryValid) return null;
    return filterRequests(
      loadedRequests,
      searchTerm,
      students,
      statusFilter,
      dateFrom || undefined,
      dateTo || undefined
    );
  }, [isQueryValid, loadedRequests, searchTerm, students, statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    const gen = ++searchGenRef.current;

    if (!isQueryValid) {
      setDbResults(null);
      setIsDbSearching(false);
      return;
    }

    // Skip Firestore if everything in this filtered scope is already loaded
    if (!hasMore && activeServiceId && activeServiceId !== 'all') {
      setDbResults(null);
      setIsDbSearching(false);
      return;
    }

    let isCancelled = false;
    setIsDbSearching(true);

    const timer = setTimeout(async () => {
      try {
        const fullMatches = await searchRequests({
          serviceId: activeServiceId,
          query: searchTerm,
          loadedRequests,
          students,
          hasMore,
          statusFilter,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined
        });
        if (!isCancelled && searchGenRef.current === gen) {
          setDbResults(fullMatches);
          setIsDbSearching(false);
        }
      } catch {
        if (!isCancelled && searchGenRef.current === gen) {
          setIsDbSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isQueryValid, searchTerm, activeServiceId, loadedRequests, students, hasMore, statusFilter, dateFrom, dateTo, debounceMs]);

  const allSearchResults = useMemo(() => {
    if (!isQueryValid) return null;
    const combined =
      dbResults !== null
        ? mergeAndDeduplicateRequests(localResults || [], dbResults)
        : (localResults || []);
    return sortRequestsByPriorityAndDate(combined, statusFilter);
  }, [isQueryValid, localResults, dbResults, statusFilter]);

  const paginatedSearchResults = useMemo(() => {
    if (!allSearchResults) return null;
    return allSearchResults.slice(0, visibleLimit);
  }, [allSearchResults, visibleLimit]);

  const matchCount = allSearchResults?.length ?? 0;
  const hasMoreSearchResults = Boolean(
    paginatedSearchResults && allSearchResults && paginatedSearchResults.length < allSearchResults.length
  );

  const loadMoreSearchResults = useCallback(() => {
    setVisibleLimit((prev) => prev + pageSize);
  }, [pageSize]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setDbResults(null);
    setIsDbSearching(false);
    setVisibleLimit(pageSize);
  }, [pageSize]);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    clearSearch,
    isSearching: isQueryValid,
    isDbSearching,
    searchResults: paginatedSearchResults,
    matchCount,
    hasMoreSearchResults,
    loadMoreSearchResults
  };
}
