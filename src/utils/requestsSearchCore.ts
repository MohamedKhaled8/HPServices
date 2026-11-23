import type { ServiceRequest, StudentData } from '../types/index.ts';
import { mergeAndDeduplicateRequests } from './requestsPaginationCore.ts';

export type DbFetchBatchFn = (serviceId: string, maxLimit: number) => Promise<ServiceRequest[]>;
export type DbGetDocFn = (serviceId: string, docId: string) => Promise<ServiceRequest | null>;

let activeFetchBatch: DbFetchBatchFn = async () => [];
let activeGetDoc: DbGetDocFn = async () => null;

export const setDbFetchers = (fetchBatch?: DbFetchBatchFn, getDocFn?: DbGetDocFn): void => {
  if (fetchBatch) activeFetchBatch = fetchBatch;
  if (getDocFn) activeGetDoc = getDocFn;
};

const serviceCache = new Map<string, ServiceRequest[]>();
const allServicesQueryCache = new Map<string, ServiceRequest[]>();

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

  const phoneVal = String(req.data?.whatsapp_number || req.data?.phone_whatsapp || req.data?.phone || req.data?.phoneNumber || student?.whatsappNumber || student?.phoneNumber || '');
  if (normPQ && normalizePhone(phoneVal).includes(normPQ)) return true;

  const email = String(req.data?.email || student?.email || '').toLowerCase();
  if (rawQ && email.includes(rawQ)) return true;

  return req.serviceId === rawQ;
};

export const filterRequests = (requests: ServiceRequest[], queryStr: string, students?: Record<string, StudentData>): ServiceRequest[] => {
  if (!queryStr || queryStr.trim().length === 0) return requests;
  return requests.filter((r) => matchesRequest(r, queryStr, students?.[r.studentId]));
};

export interface SearchRequestsParams {
  serviceId: string | null;
  query: string;
  loadedRequests: ServiceRequest[];
  students?: Record<string, StudentData>;
  hasMore?: boolean;
}

export const searchRequests = async ({
  serviceId,
  query: queryStr,
  loadedRequests,
  students,
  hasMore = false
}: SearchRequestsParams): Promise<ServiceRequest[]> => {
  const qTrim = queryStr.trim();
  if (qTrim.length < 2) return filterRequests(loadedRequests, qTrim, students);

  if (!hasMore && loadedRequests.length > 0 && serviceId && serviceId !== 'all') {
    return filterRequests(loadedRequests, qTrim, students);
  }

  if (serviceId && serviceId !== 'all') {
    if (serviceCache.has(serviceId)) {
      return filterRequests(serviceCache.get(serviceId)!, qTrim, students);
    }
    let idDocReq: ServiceRequest | null = null;
    if (/^[a-zA-Z0-9_-]{12,40}$/.test(qTrim)) {
      try { idDocReq = await activeGetDoc(serviceId, qTrim); } catch (_) {}
    }
    const fetched = await activeFetchBatch(serviceId, 350);
    if (idDocReq && !fetched.some((r) => r.id === idDocReq!.id)) fetched.unshift(idDocReq);
    const combined = mergeAndDeduplicateRequests(loadedRequests, fetched);
    serviceCache.set(serviceId, combined);
    return filterRequests(combined, qTrim, students);
  }

  const normKey = normalizeArabic(qTrim);
  if (allServicesQueryCache.has(normKey)) return allServicesQueryCache.get(normKey)!;

  const allActiveIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  const allResults: ServiceRequest[] = [];
  const uncachedServiceIds: string[] = [];

  for (const sid of allActiveIds) {
    if (serviceCache.has(sid)) allResults.push(...filterRequests(serviceCache.get(sid)!, qTrim, students));
    else uncachedServiceIds.push(sid);
  }

  if (uncachedServiceIds.length > 0) {
    const batchResults = await Promise.all(uncachedServiceIds.map((sid) => activeFetchBatch(sid, 30)));
    batchResults.forEach((docs, idx) => {
      const sid = uncachedServiceIds[idx];
      serviceCache.set(sid, docs);
      allResults.push(...filterRequests(docs, qTrim, students));
    });
  }

  const mergedAll = mergeAndDeduplicateRequests(loadedRequests.filter((r) => matchesRequest(r, qTrim, students?.[r.studentId])), allResults);
  allServicesQueryCache.set(normKey, mergedAll);
  return mergedAll;
};

export const invalidateSearchCache = (serviceId?: string): void => {
  if (serviceId) serviceCache.delete(serviceId);
  else serviceCache.clear();
  allServicesQueryCache.clear();
};

export const updateSearchCacheItem = (request: ServiceRequest): void => {
  const sid = String(request.serviceId || '');
  if (sid && serviceCache.has(sid)) {
    const cached = serviceCache.get(sid)!;
    const idx = cached.findIndex((r) => r.id === request.id);
    if (idx >= 0) cached[idx] = { ...cached[idx], ...request };
    else cached.unshift(request);
  }
  allServicesQueryCache.clear();
};

export const removeSearchCacheItem = (requestId: string, serviceId?: string): void => {
  if (serviceId && serviceCache.has(serviceId)) {
    serviceCache.set(serviceId, serviceCache.get(serviceId)!.filter((r) => r.id !== requestId));
  } else {
    for (const [sid, list] of serviceCache.entries()) {
      serviceCache.set(sid, list.filter((r) => r.id !== requestId));
    }
  }
  allServicesQueryCache.clear();
};

export const getSearchSessionCacheSize = (): { services: number; queries: number } => ({
  services: serviceCache.size,
  queries: allServicesQueryCache.size
});
