import type { ServiceRequest, StudentData } from '../types/index.ts';
import {
  mergeAndDeduplicateRequests,
  matchesStatusAndDateFilter,
  sortRequestsByPriorityAndDate,
  type RequestStatusFilter
} from './requestsPaginationCore.ts';

export type DbFetchBatchFn = (serviceId: string, maxLimit: number) => Promise<ServiceRequest[]>;
export type DbFetchFilteredBatchFn = (params: {
  serviceId: string;
  statusFilter: RequestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
  maxLimit: number;
}) => Promise<ServiceRequest[]>;
export type DbGetDocFn = (serviceId: string, docId: string) => Promise<ServiceRequest | null>;

let activeFetchBatch: DbFetchBatchFn = async () => [];
let activeFetchFilteredBatch: DbFetchFilteredBatchFn | null = null;
let activeGetDoc: DbGetDocFn = async () => null;

export const setDbFetchers = (
  fetchBatch?: DbFetchBatchFn,
  getDocFn?: DbGetDocFn,
  fetchFilteredBatch?: DbFetchFilteredBatchFn
): void => {
  if (fetchBatch) {
    activeFetchBatch = fetchBatch;
    // Reset custom filtered fetcher when tests override fetchBatch without passing fetchFilteredBatch
    activeFetchFilteredBatch = fetchFilteredBatch ?? null;
  } else if (fetchFilteredBatch) {
    activeFetchFilteredBatch = fetchFilteredBatch;
  }
  if (getDocFn) activeGetDoc = getDocFn;
};

const serviceCache = new Map<string, ServiceRequest[]>();
const allServicesQueryCache = new Map<string, ServiceRequest[]>();

const buildServiceCacheKey = (
  serviceId: string,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): string => `${serviceId}__${statusFilter}__${dateFrom || ''}__${dateTo || ''}`;

export const normalizeArabic = (text: string): string => {
  if (!text) return '';
  return text.toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/[ىي]/g, 'ي')
    .replace(/\s+/g, ' ').trim();
};

export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+20')) cleaned = '0' + cleaned.slice(3);
  else if (cleaned.startsWith('0020')) cleaned = '0' + cleaned.slice(4);
  else if (cleaned.startsWith('20') && cleaned.length >= 11) cleaned = '0' + cleaned.slice(2);
  return cleaned.replace(/\D/g, '');
};

export const matchesRequest = (req: ServiceRequest, queryStr: string, student?: StudentData): boolean => {
  if (!queryStr || queryStr.trim().length === 0) return true;
  const normQ = normalizeArabic(queryStr);
  const normPQ = normalizePhone(queryStr);
  const rawQ = queryStr.toLowerCase().trim();

  if (req.id?.toLowerCase().includes(rawQ) || req.studentId?.toLowerCase().includes(rawQ)) return true;

  const nameAr = normalizeArabic(req.data?.full_name_arabic || req.data?.full_name || req.data?.name || req.data?.studentName || req.data?.clientName || student?.fullNameArabic || '');
  if (normQ && nameAr.includes(normQ)) return true;

  const nameEn = (req.data?.full_name_english || student?.vehicleNameEnglish || (student as any)?.fullNameEnglish || '').toLowerCase();
  if (rawQ && nameEn.includes(rawQ)) return true;

  const natId = String(req.data?.national_id || student?.nationalID || '');
  if (rawQ && natId.includes(rawQ)) return true;

  const phoneVal = String(req.data?.whatsapp_number || req.data?.phone_whatsapp || req.data?.phone || req.data?.phoneNumber || student?.whatsappNumber || (student as any)?.phoneNumber || '');
  if (normPQ && normalizePhone(phoneVal).includes(normPQ)) return true;

  const email = String(req.data?.email || student?.email || '').toLowerCase();
  if (rawQ && email.includes(rawQ)) return true;

  return req.serviceId === rawQ;
};

export const filterRequests = (
  requests: ServiceRequest[],
  queryStr: string,
  students?: Record<string, StudentData>,
  statusFilter: RequestStatusFilter = 'all',
  dateFrom?: string,
  dateTo?: string
): ServiceRequest[] => {
  const preFiltered =
    statusFilter !== 'all' || dateFrom || dateTo
      ? requests.filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo))
      : requests;
  if (!queryStr || queryStr.trim().length === 0) {
    return sortRequestsByPriorityAndDate(preFiltered, statusFilter);
  }
  const matched = preFiltered.filter((r) => matchesRequest(r, queryStr, students?.[r.studentId]));
  return sortRequestsByPriorityAndDate(matched, statusFilter);
};

export interface SearchRequestsParams {
  serviceId: string | null;
  query: string;
  loadedRequests: ServiceRequest[];
  students?: Record<string, StudentData>;
  hasMore?: boolean;
  statusFilter?: RequestStatusFilter;
  dateFrom?: string;
  dateTo?: string;
}

const fetchServicePoolForSearch = async (
  serviceId: string,
  statusFilter: RequestStatusFilter,
  dateFrom: string | undefined,
  dateTo: string | undefined,
  maxLimit: number
): Promise<ServiceRequest[]> => {
  if (activeFetchFilteredBatch) {
    return activeFetchFilteredBatch({ serviceId, statusFilter, dateFrom, dateTo, maxLimit });
  }
  const raw = await activeFetchBatch(serviceId, maxLimit);
  return raw.filter((r) => matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo));
};

export const searchRequests = async ({
  serviceId,
  query: queryStr,
  loadedRequests,
  students,
  hasMore = false,
  statusFilter = 'all',
  dateFrom,
  dateTo
}: SearchRequestsParams): Promise<ServiceRequest[]> => {
  const qTrim = queryStr.trim();
  if (qTrim.length < 2) {
    return filterRequests(loadedRequests, qTrim, students, statusFilter, dateFrom, dateTo);
  }

  if (!hasMore && loadedRequests.length > 0 && serviceId && serviceId !== 'all') {
    return filterRequests(loadedRequests, qTrim, students, statusFilter, dateFrom, dateTo);
  }

  if (serviceId && serviceId !== 'all') {
    const cacheKey = buildServiceCacheKey(serviceId, statusFilter, dateFrom, dateTo);
    if (serviceCache.has(cacheKey)) {
      return filterRequests(serviceCache.get(cacheKey)!, qTrim, students, statusFilter, dateFrom, dateTo);
    }
    let idDocReq: ServiceRequest | null = null;
    if (/^[a-zA-Z0-9_-]{12,40}$/.test(qTrim)) {
      try { idDocReq = await activeGetDoc(serviceId, qTrim); } catch (_) {}
    }
    const fetched = await fetchServicePoolForSearch(serviceId, statusFilter, dateFrom, dateTo, 2500);
    if (
      idDocReq &&
      matchesStatusAndDateFilter(idDocReq, statusFilter, dateFrom, dateTo) &&
      !fetched.some((r) => r.id === idDocReq!.id)
    ) {
      fetched.unshift(idDocReq);
    }
    const scopedLoaded = loadedRequests.filter((r) =>
      matchesStatusAndDateFilter(r, statusFilter, dateFrom, dateTo)
    );
    const combined = sortRequestsByPriorityAndDate(
      mergeAndDeduplicateRequests(scopedLoaded, fetched),
      statusFilter
    );
    serviceCache.set(cacheKey, combined);
    return filterRequests(combined, qTrim, students, statusFilter, dateFrom, dateTo);
  }

  const normKey = `${normalizeArabic(qTrim)}__${statusFilter}__${dateFrom || ''}__${dateTo || ''}`;
  if (allServicesQueryCache.has(normKey)) return allServicesQueryCache.get(normKey)!;

  const allActiveIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const allResults: ServiceRequest[] = [];
  const uncachedServiceIds: string[] = [];

  for (const sid of allActiveIds) {
    const cacheKey = buildServiceCacheKey(sid, statusFilter, dateFrom, dateTo);
    if (serviceCache.has(cacheKey)) {
      allResults.push(...filterRequests(serviceCache.get(cacheKey)!, qTrim, students, statusFilter, dateFrom, dateTo));
    } else {
      uncachedServiceIds.push(sid);
    }
  }

  if (uncachedServiceIds.length > 0) {
    const batchResults = await Promise.all(
      uncachedServiceIds.map((sid) =>
        fetchServicePoolForSearch(sid, statusFilter, dateFrom, dateTo, 250)
      )
    );
    batchResults.forEach((docs, idx) => {
      const sid = uncachedServiceIds[idx];
      const cacheKey = buildServiceCacheKey(sid, statusFilter, dateFrom, dateTo);
      serviceCache.set(cacheKey, docs);
      allResults.push(...filterRequests(docs, qTrim, students, statusFilter, dateFrom, dateTo));
    });
  }

  const mergedAll = sortRequestsByPriorityAndDate(
    mergeAndDeduplicateRequests(
      filterRequests(loadedRequests, qTrim, students, statusFilter, dateFrom, dateTo),
      allResults
    ),
    statusFilter
  );
  allServicesQueryCache.set(normKey, mergedAll);
  return mergedAll;
};

export const invalidateSearchCache = (serviceId?: string): void => {
  if (serviceId) {
    for (const key of Array.from(serviceCache.keys())) {
      if (key === serviceId || key.startsWith(`${serviceId}__`)) {
        serviceCache.delete(key);
      }
    }
  } else {
    serviceCache.clear();
  }
  allServicesQueryCache.clear();
};

export const updateSearchCacheItem = (request: ServiceRequest): void => {
  const sid = String(request.serviceId || '');
  if (sid) {
    for (const [key, cached] of serviceCache.entries()) {
      if (key === sid || key.startsWith(`${sid}__`)) {
        const idx = cached.findIndex((r) => r.id === request.id);
        if (idx >= 0) cached[idx] = { ...cached[idx], ...request };
        else cached.unshift(request);
      }
    }
  }
  allServicesQueryCache.clear();
};

export const removeSearchCacheItem = (requestId: string, serviceId?: string): void => {
  if (serviceId) {
    for (const [key, list] of serviceCache.entries()) {
      if (key === serviceId || key.startsWith(`${serviceId}__`)) {
        serviceCache.set(key, list.filter((r) => r.id !== requestId));
      }
    }
  } else {
    for (const [key, list] of serviceCache.entries()) {
      serviceCache.set(key, list.filter((r) => r.id !== requestId));
    }
  }
  allServicesQueryCache.clear();
};

export const getSearchSessionCacheSize = (): { services: number; queries: number } => ({
  services: serviceCache.size,
  queries: allServicesQueryCache.size
});
