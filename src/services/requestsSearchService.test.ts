import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeArabic,
  normalizePhone,
  matchesRequest,
  filterRequests,
  searchRequests,
  setDbFetchers,
  invalidateSearchCache,
  updateSearchCacheItem,
  removeSearchCacheItem,
  getSearchSessionCacheSize
} from '../utils/requestsSearchCore.ts';
import type { ServiceRequest, StudentData } from '../types/index.ts';

test('Arabic normalization: matches Arabic variations and diacritics', () => {
  assert.equal(normalizeArabic('أحمد'), 'احمد');
  assert.equal(normalizeArabic('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeArabic('فاطمة'), 'فاطمه');
  assert.equal(normalizeArabic('مُحَمَّد'), 'محمد');
  assert.equal(normalizeArabic('مستشفى'), 'مستشفي');

  const req1: ServiceRequest = {
    id: 'req_1',
    serviceId: '1',
    data: { full_name_arabic: 'أحمد محمد علي' }
  } as unknown as ServiceRequest;

  const req2: ServiceRequest = {
    id: 'req_2',
    serviceId: '1',
    data: { full_name: 'فاطمة حسن' }
  } as unknown as ServiceRequest;

  // "احمد" matches "أحمد محمد"
  assert.equal(matchesRequest(req1, 'احمد'), true);
  assert.equal(matchesRequest(req1, 'أحمد'), true);
  // "فاطمه" matches "فاطمة"
  assert.equal(matchesRequest(req2, 'فاطمه'), true);
  assert.equal(matchesRequest(req2, 'فاطمة'), true);
  // Non-matching query
  assert.equal(matchesRequest(req2, 'محمود'), false);
});

test('Phone normalization: matches local and international formats', () => {
  assert.equal(normalizePhone('+201012345678'), '01012345678');
  assert.equal(normalizePhone('00201012345678'), '01012345678');
  assert.equal(normalizePhone('01012345678'), '01012345678');
  assert.equal(normalizePhone('+20 101-234-5678'), '01012345678');

  const reqPhone: ServiceRequest = {
    id: 'req_phone',
    serviceId: '1',
    data: { whatsapp_number: '+201012345678' }
  } as unknown as ServiceRequest;

  // "01012345678" matches "+201012345678"
  assert.equal(matchesRequest(reqPhone, '01012345678'), true);
  assert.equal(matchesRequest(reqPhone, '+201012345678'), true);
  assert.equal(matchesRequest(reqPhone, '0101234'), true);
});

test('Matches across student data records and extra fields', () => {
  const req: ServiceRequest = {
    id: 'req_student_match',
    studentId: 'stud_99',
    serviceId: '2',
    data: { national_id: '29901011234567' }
  } as unknown as ServiceRequest;

  const students: Record<string, StudentData> = {
    stud_99: {
      fullNameArabic: 'محمود عبد الرحمن',
      email: 'mahmoud@example.com',
      whatsappNumber: '01223344556'
    } as unknown as StudentData
  };

  assert.equal(matchesRequest(req, 'محمود', students.stud_99), true);
  assert.equal(matchesRequest(req, 'mahmoud@example.com', students.stud_99), true);
  assert.equal(matchesRequest(req, '2990101', students.stud_99), true);
});

test('Older unloaded requests found via database search without clicking Load More', async () => {
  invalidateSearchCache();

  const loadedRequests: ServiceRequest[] = [
    { id: 'req_recent_1', serviceId: '1', data: { full_name: 'علي حسن' }, createdAt: '2026-11-23T10:00:00Z' } as unknown as ServiceRequest
  ];

  const dbOlderRequests: ServiceRequest[] = [
    { id: 'req_older_99', serviceId: '1', data: { full_name: 'طارق عبد الله' }, createdAt: '2026-01-10T10:00:00Z' } as unknown as ServiceRequest
  ];

  let dbReads = 0;
  setDbFetchers(async () => {
    dbReads++;
    return dbOlderRequests;
  });

  // Searching for "طارق" which is NOT in loadedRequests
  const results = await searchRequests({
    serviceId: '1',
    query: 'طارق',
    loadedRequests,
    hasMore: true
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].id, 'req_older_99');
  assert.equal(dbReads, 1);
});

test('Session cache prevents duplicate Firestore reads on repeated searches and backspacing', async () => {
  invalidateSearchCache();

  const loadedRequests: ServiceRequest[] = [
    { id: 'req_1', serviceId: '1', data: { full_name: 'سارة خالد' } } as unknown as ServiceRequest
  ];

  const dbBatch: ServiceRequest[] = [
    { id: 'req_2', serviceId: '1', data: { full_name: 'سارة إبراهيم' } } as unknown as ServiceRequest,
    { id: 'req_3', serviceId: '1', data: { full_name: 'خالد يوسف' } } as unknown as ServiceRequest
  ];

  let fetchBatchCalls = 0;
  setDbFetchers(async () => {
    fetchBatchCalls++;
    return dbBatch;
  });

  // 1. First search -> triggers bounded batch fetch (read #1)
  const res1 = await searchRequests({ serviceId: '1', query: 'سارة', loadedRequests, hasMore: true });
  assert.equal(res1.length, 2);
  assert.equal(fetchBatchCalls, 1);

  // 2. Keystroke / backspacing "سار" in same service -> 0 extra reads (cached!)
  const res2 = await searchRequests({ serviceId: '1', query: 'سار', loadedRequests, hasMore: true });
  assert.equal(res2.length, 2);
  assert.equal(fetchBatchCalls, 1);

  // 3. New search "خالد" in same service -> 0 extra reads (cached!)
  const res3 = await searchRequests({ serviceId: '1', query: 'خالد', loadedRequests, hasMore: true });
  assert.equal(res3.length, 2);
  assert.equal(fetchBatchCalls, 1);

  // 4. Invalidation forces fresh read on next search
  invalidateSearchCache('1');
  const res4 = await searchRequests({ serviceId: '1', query: 'سارة', loadedRequests, hasMore: true });
  assert.equal(res4.length, 2);
  assert.equal(fetchBatchCalls, 2);
});

test('Zero reads when query length < 2 or scope already fully loaded', async () => {
  invalidateSearchCache();

  let fetchCalls = 0;
  setDbFetchers(async () => {
    fetchCalls++;
    return [];
  });

  const loaded: ServiceRequest[] = [
    { id: 'r1', serviceId: '3', data: { full_name: 'محمد' } } as unknown as ServiceRequest
  ];

  // Query length < 2 -> 0 reads
  const rEmpty = await searchRequests({ serviceId: '3', query: 'م', loadedRequests: loaded, hasMore: true });
  assert.equal(fetchCalls, 0);

  // hasMore = false (fully loaded) -> 0 reads
  const rFull = await searchRequests({ serviceId: '3', query: 'محمد', loadedRequests: loaded, hasMore: false });
  assert.equal(fetchCalls, 0);
  assert.equal(rFull.length, 1);
});

test('Cache mutation helpers update and delete items cleanly', () => {
  invalidateSearchCache();
  const req: ServiceRequest = { id: 'm1', serviceId: '1', data: { full_name: 'قديم' } } as unknown as ServiceRequest;
  updateSearchCacheItem(req);
  removeSearchCacheItem('m1', '1');
  assert.equal(getSearchSessionCacheSize().queries, 0);
});

test('Filtered search passes statusFilter and date range to DB query and sorts newest-first', async () => {
  invalidateSearchCache();
  let capturedFilter: any = null;

  setDbFetchers(
    undefined,
    undefined,
    async (params) => {
      capturedFilter = params;
      return [
        {
          id: 'p_old',
          serviceId: '5',
          status: 'pending',
          data: { full_name_arabic: 'محمد علي' },
          createdAt: '2026-11-20T10:00:00.000Z'
        } as unknown as ServiceRequest,
        {
          id: 'p_new',
          serviceId: '5',
          status: 'pending',
          data: { full_name_arabic: 'محمد أحمد' },
          createdAt: '2026-11-25T10:00:00.000Z'
        } as unknown as ServiceRequest
      ];
    }
  );

  const results = await searchRequests({
    serviceId: '5',
    query: 'محمد',
    loadedRequests: [],
    hasMore: true,
    statusFilter: 'new',
    dateFrom: '2026-11-01',
    dateTo: '2026-11-25'
  });

  assert.equal(capturedFilter?.statusFilter, 'new');
  assert.equal(capturedFilter?.dateFrom, '2026-11-01');
  assert.equal(capturedFilter?.dateTo, '2026-11-25');
  assert.deepEqual(results.map((r) => r.id), ['p_new', 'p_old']);
});
