import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeAndDeduplicateRequests,
  applyAtomicCounterDelta,
  isRequestStatusPending,
  isNewRequestStatus,
  shouldShowLoadMoreButton,
  formatPaginationBadge,
  matchesStatusAndDateFilter,
  sortRequestsByPriorityAndDate
} from './requestsPaginationCore.ts';
import type { ServiceRequest } from '../types/index.ts';

test('isRequestStatusPending: identifies pending workflow statuses', () => {
  assert.equal(isRequestStatusPending('pending'), true);
  assert.equal(isRequestStatusPending('submitted'), true);
  assert.equal(isRequestStatusPending('in_review'), true);
  assert.equal(isRequestStatusPending('completed'), false);
  assert.equal(isRequestStatusPending('rejected'), false);
  assert.equal(isRequestStatusPending(undefined), false);
});

test('shouldShowLoadMoreButton: stays visible when hasMore is true even if totalCount is 0 or null', () => {
  // DB has more, totalCount is 0 (or still loading)
  assert.equal(shouldShowLoadMoreButton(true, 25, 0), true);
  assert.equal(shouldShowLoadMoreButton(true, 25, null), true);
  // DB has more, totalCount is positive
  assert.equal(shouldShowLoadMoreButton(true, 25, 540), true);
  // DB exhausted (no more items in DB)
  assert.equal(shouldShowLoadMoreButton(false, 540, 540), false);
});

test('formatPaginationBadge: never renders "من أصل 0" when items exist', () => {
  // When totalCount is 0 or null, badge omits "من أصل 0"
  assert.equal(formatPaginationBadge(25, 0), 'المعروض 25');
  assert.equal(formatPaginationBadge(25, null), 'المعروض 25');
  assert.equal(formatPaginationBadge(75, 0), 'المعروض 75');

  // When real totalCount > 0, badge includes total count cleanly
  assert.equal(formatPaginationBadge(25, 540), 'المعروض 25 من أصل 540');
  assert.equal(formatPaginationBadge(75, 540), 'المعروض 75 من أصل 540');
  assert.equal(formatPaginationBadge(125, 540), 'المعروض 125 من أصل 540');
});

test('mergeAndDeduplicateRequests: merges live head and older requests in stable order', () => {
  const live: ServiceRequest[] = [
    { id: 'req_1', serviceId: '1', status: 'pending', createdAt: '2026-11-22T04:00:00.000Z' } as any,
    { id: 'req_2', serviceId: '1', status: 'pending', createdAt: '2026-11-22T03:00:00.000Z' } as any
  ];
  const older: ServiceRequest[] = [
    { id: 'req_3', serviceId: '1', status: 'completed', createdAt: '2026-11-22T02:00:00.000Z' } as any,
    { id: 'req_4', serviceId: '1', status: 'rejected', createdAt: '2026-11-22T01:00:00.000Z' } as any
  ];

  const merged = mergeAndDeduplicateRequests(live, older);
  assert.equal(merged.length, 4);
  assert.deepEqual(merged.map((r) => r.id), ['req_1', 'req_2', 'req_3', 'req_4']);
});

test('mergeAndDeduplicateRequests: deduplicates cleanly when an item shifts between live and older batches', () => {
  const live: ServiceRequest[] = [
    { id: 'req_new', serviceId: '1', status: 'pending', createdAt: '2026-11-22T05:00:00.000Z' } as any,
    { id: 'req_1', serviceId: '1', status: 'approved', createdAt: '2026-11-22T04:00:00.000Z' } as any
  ];
  const older: ServiceRequest[] = [
    { id: 'req_1', serviceId: '1', status: 'pending', createdAt: '2026-11-22T04:00:00.000Z' } as any,
    { id: 'req_2', serviceId: '1', status: 'completed', createdAt: '2026-11-22T03:00:00.000Z' } as any
  ];

  const merged = mergeAndDeduplicateRequests(live, older);
  assert.equal(merged.length, 3);
  assert.deepEqual(merged.map((r) => r.id), ['req_new', 'req_1', 'req_2']);
  assert.equal(merged[1].status, 'approved');
});

test('single-click pagination simulator: advances cursor and loads +50 immediately across 500+ items', () => {
  // DB collection with 540 requests
  const totalDbItems = 540;
  const dbCollection: ServiceRequest[] = Array.from({ length: totalDbItems }, (_, i) => ({
    id: `req_${i + 1}`,
    serviceId: '2',
    status: 'pending',
    createdAt: new Date(Date.now() - i * 1000).toISOString()
  } as any));

  // Initial live-head batch: 25 items
  const liveBatch = dbCollection.slice(0, 25);
  let liveLastDoc: { id: string } | null = { id: liveBatch[liveBatch.length - 1].id! };
  let olderLastDoc: { id: string } | null = null;
  let olderRequests: ServiceRequest[] = [];
  let hasMore = totalDbItems > 25;

  assert.equal(shouldShowLoadMoreButton(hasMore, liveBatch.length, 0), true);

  // Single Click: Fetch next 50 items
  const clickLoadMore50 = () => {
    const cursor = olderLastDoc ?? liveLastDoc;
    assert.ok(cursor, 'Cursor must exist on click');

    const cursorIndex = dbCollection.findIndex((d) => d.id === cursor.id);
    const startIndex = cursorIndex + 1;
    // Query limit 51 to detect hasMore
    const querySlice = dbCollection.slice(startIndex, startIndex + 51);
    const hasMoreNext = querySlice.length > 50;
    const next50 = hasMoreNext ? querySlice.slice(0, 50) : querySlice;

    olderRequests = [...olderRequests, ...next50];
    olderLastDoc = next50.length > 0 ? { id: next50[next50.length - 1].id! } : null;
    hasMore = hasMoreNext;
  };

  // 1st single click: loads +50 (displays 25 + 50 = 75)
  clickLoadMore50();
  assert.equal(olderRequests.length, 50);
  const afterClick1 = mergeAndDeduplicateRequests(liveBatch, olderRequests);
  assert.equal(afterClick1.length, 75, 'Must display 75 requests immediately after ONE click');
  assert.equal(formatPaginationBadge(afterClick1.length, totalDbItems), 'المعروض 75 من أصل 540');
  assert.equal(shouldShowLoadMoreButton(hasMore, afterClick1.length, totalDbItems), true);

  // 2nd single click: loads next +50 (displays 75 + 50 = 125)
  clickLoadMore50();
  assert.equal(olderRequests.length, 100);
  const afterClick2 = mergeAndDeduplicateRequests(liveBatch, olderRequests);
  assert.equal(afterClick2.length, 125, 'Must display 125 requests immediately after TWO clicks');
  assert.equal(formatPaginationBadge(afterClick2.length, totalDbItems), 'المعروض 125 من أصل 540');
  assert.equal(shouldShowLoadMoreButton(hasMore, afterClick2.length, totalDbItems), true);
});

test('applyAtomicCounterDelta: keeps total and pending counts accurate for cards & reports', () => {
  let counter = { total: 100, pending: 20 };

  // New request created
  counter = applyAtomicCounterDelta(counter, 'create', { newStatus: 'pending' });
  assert.equal(counter.total, 101);
  assert.equal(counter.pending, 21);

  // Status changed from pending to completed
  counter = applyAtomicCounterDelta(counter, 'status_change', {
    oldStatus: 'pending',
    newStatus: 'completed'
  });
  assert.equal(counter.total, 101);
  assert.equal(counter.pending, 20);

  // Request deleted
  counter = applyAtomicCounterDelta(counter, 'delete', { oldStatus: 'completed' });
  assert.equal(counter.total, 100);
  assert.equal(counter.pending, 20);
});

test('server-side filter-first + sort: 10 new requests buried in 500 total records all load on page 1 without Load More', () => {
  const baseMs = Date.parse('2026-11-25T12:00:00.000Z');
  // 500 records: newest 30 are completed, 10 pending ("new") are buried at positions 30..450, rest completed/rejected
  const pendingPositions = new Set([35, 48, 72, 110, 155, 210, 280, 340, 410, 490]);
  const dbRecords: ServiceRequest[] = Array.from({ length: 500 }, (_, i) => ({
    id: `req_${i + 1}`,
    serviceId: '3',
    status: pendingPositions.has(i) ? 'pending' : (i % 2 === 0 ? 'completed' : 'rejected'),
    createdAt: new Date(baseMs - i * 60_000).toISOString()
  } as any));

  // Filter in DB BEFORE applying limit(50)
  const dbFilteredNew = sortRequestsByPriorityAndDate(
    dbRecords.filter((r) => matchesStatusAndDateFilter(r, 'new')),
    'new'
  );
  const totalMatchingCount = dbFilteredNew.length;
  const page1 = dbFilteredNew.slice(0, 50);

  assert.equal(totalMatchingCount, 10);
  assert.equal(page1.length, 10, 'All 10 new requests must load immediately on page 1');
  assert.deepEqual(
    page1.map((r) => r.id),
    ['req_36', 'req_49', 'req_73', 'req_111', 'req_156', 'req_211', 'req_281', 'req_341', 'req_411', 'req_491']
  );
  assert.equal(formatPaginationBadge(page1.length, totalMatchingCount), 'المعروض 10 من أصل 10');
  assert.equal(shouldShowLoadMoreButton(false, page1.length, totalMatchingCount), false);
  // Even if a stale hasMore flag were true, loadedCount >= totalMatchingCount hides Load More
  assert.equal(shouldShowLoadMoreButton(true, 10, 10), false);
});

test('per-filter pagination with >50 matching items: paginates 50 -> 100 -> 124 without duplicates', () => {
  const baseMs = Date.parse('2026-11-25T12:00:00.000Z');
  const dbRecords: ServiceRequest[] = Array.from({ length: 500 }, (_, i) => ({
    id: `req_${i + 1}`,
    serviceId: '4',
    status: i < 124 ? 'pending' : 'completed',
    createdAt: new Date(baseMs - i * 60_000).toISOString()
  } as any));

  const filtered = sortRequestsByPriorityAndDate(
    dbRecords.filter((r) => matchesStatusAndDateFilter(r, 'new')),
    'new'
  );
  const total = filtered.length;
  assert.equal(total, 124);

  const page1 = filtered.slice(0, 50);
  assert.equal(page1.length, 50);
  assert.equal(formatPaginationBadge(page1.length, total), 'المعروض 50 من أصل 124');
  assert.equal(shouldShowLoadMoreButton(true, page1.length, total), true);

  const page2 = mergeAndDeduplicateRequests(page1, filtered.slice(50, 100));
  assert.equal(page2.length, 100);
  assert.equal(formatPaginationBadge(page2.length, total), 'المعروض 100 من أصل 124');
  assert.equal(shouldShowLoadMoreButton(true, page2.length, total), true);

  const page3 = mergeAndDeduplicateRequests(page2, filtered.slice(100, 150));
  assert.equal(page3.length, 124);
  assert.equal(formatPaginationBadge(page3.length, total), 'المعروض 124 من أصل 124');
  assert.equal(shouldShowLoadMoreButton(false, page3.length, total), false);
});

test('all-requests view prioritizes unhandled new requests at the top sorted createdAt DESC', () => {
  const items: ServiceRequest[] = [
    { id: 'c_newest', serviceId: '1', status: 'completed', createdAt: '2026-11-25T12:00:00.000Z' } as any,
    { id: 'n_older', serviceId: '1', status: 'pending', createdAt: '2026-11-24T08:00:00.000Z' } as any,
    { id: 's_mid', serviceId: '1', status: 'submitted', createdAt: '2026-11-25T11:00:00.000Z' } as any,
    { id: 'n_newer', serviceId: '1', status: 'pending', createdAt: '2026-11-25T09:00:00.000Z' } as any
  ];

  assert.equal(isNewRequestStatus('pending'), true);
  assert.equal(isNewRequestStatus('completed'), false);

  const sortedAll = sortRequestsByPriorityAndDate(items, 'all');
  assert.deepEqual(
    sortedAll.map((r) => r.id),
    ['n_newer', 'n_older', 'c_newest', 's_mid']
  );

  // Date-range filtering works accurately alongside status filtering
  const dateFiltered = items.filter((r) =>
    matchesStatusAndDateFilter(r, 'new', '2026-11-25', '2026-11-25')
  );
  assert.deepEqual(dateFiltered.map((r) => r.id), ['n_newer']);
});
