import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import type { ServiceRequest, StudentData } from '../types';
import { filterRequests, searchRequests } from '../services/requestsSearchService';
import { mergeAndDeduplicateRequests } from '../utils/requestsPaginationCore';

export interface UseRequestsSearchOptions {
  activeServiceId: string | null;
  loadedRequests: ServiceRequest[];
  students?: Record<string, StudentData>;
  hasMore?: boolean;
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
}

export function useRequestsSearch({
  activeServiceId,
  loadedRequests,
  students,
  hasMore = false,
  debounceMs = 500
}: UseRequestsSearchOptions): UseRequestsSearchResult {
  const [searchTerm, setSearchTermState] = useState<string>('');
  const [dbResults, setDbResults] = useState<ServiceRequest[] | null>(null);
  const [isDbSearching, setIsDbSearching] = useState<boolean>(false);
  const prevServiceIdRef = useRef<string | null>(activeServiceId);

  // Reset or adjust when active service tab switches
  useEffect(() => {
    if (prevServiceIdRef.current !== activeServiceId) {
      prevServiceIdRef.current = activeServiceId;
      setDbResults(null);
      setIsDbSearching(false);
    }
  }, [activeServiceId]);

  const isQueryValid = searchTerm.trim().length >= 2;

  // Instant local-first filtering (0ms, 0 reads)
  const localResults = useMemo(() => {
    if (!isQueryValid) return null;
    return filterRequests(loadedRequests, searchTerm, students);
  }, [isQueryValid, loadedRequests, searchTerm, students]);

  useEffect(() => {
    if (!isQueryValid) {
      setDbResults(null);
      setIsDbSearching(false);
      return;
    }

    // Skip Firestore if everything in this scope is already loaded
    if (!hasMore && activeServiceId && activeServiceId !== 'all') {
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
          hasMore
        });
        if (!isCancelled) {
          setDbResults(fullMatches);
          setIsDbSearching(false);
        }
      } catch (err) {
        if (!isCancelled) {
          setIsDbSearching(false);
        }
      }
    }, debounceMs);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [isQueryValid, searchTerm, activeServiceId, loadedRequests, students, hasMore, debounceMs]);

  const searchResults = useMemo(() => {
    if (!isQueryValid) return null;
    if (dbResults !== null) {
      return mergeAndDeduplicateRequests(localResults || [], dbResults);
    }
    return localResults;
  }, [isQueryValid, localResults, dbResults]);

  const clearSearch = useCallback(() => {
    setSearchTermState('');
    setDbResults(null);
    setIsDbSearching(false);
  }, []);

  const setSearchTerm = useCallback((term: string) => {
    setSearchTermState(term);
  }, []);

  return {
    searchTerm,
    setSearchTerm,
    clearSearch,
    isSearching: isQueryValid,
    isDbSearching,
    searchResults,
    matchCount: searchResults?.length ?? 0
  };
}
