import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mergeAndDeduplicateRequests,
  shouldShowLoadMoreButton,
  formatPaginationBadge,
  sortRequestsByPriorityAndDate,
  matchesStatusAndDateFilter,
  isNewRequestStatus
} from './requestsPaginationCore.ts';
import type { ServiceRequest } from '../types/index.ts';

test('never hides duplicate or restored student requests with distinct doc.id: 50 of 50 displayed cleanly', () => {
  const baseMs = Date.parse('2026-11-26T00:00:00.000Z');
  const docs: ServiceRequest[] = [];
  for (let i = 0; i < 37; i++) {
    docs.push({
      id: `req_orig_${i}`,
      studentId: `stud_${i}`,
      serviceId: '7',
      status: i < 5 ? 'pending' : 'completed',
      createdAt: new Date(baseMs - i * 60_000).toISOString()
    } as ServiceRequest);
  }
  for (let i = 0; i < 13; i++) {
    docs.push({
      id: `restored_7_stud_${i}`,
      studentId: `stud_${i}`,
      serviceId: '7',
      status: 'completed',
      createdAt: new Date(baseMs - (40 + i) * 60_000).toISOString()
    } as ServiceRequest);
  }
  assert.equal(docs.length, 50);

  // Deduplicating strictly by serviceId__id keeps ALL 50 distinct Firestore documents (0 hidden)
  const displayed = mergeAndDeduplicateRequests(docs, []);
  assert.equal(displayed.length, 50);
  assert.equal(shouldShowLoadMoreButton(false, displayed.length, 50), false);
  assert.equal(formatPaginationBadge(displayed.length, 50), 'المعروض 50 من أصل 50');
});

test('68 requests (including same-student/restored docs) with pageSize 50: displays 50 on page 1, Load More loads remaining 18 -> 68 of 68', () => {
  const baseMs = Date.parse('2026-11-26T00:00:00.000Z');
  const dbDocs: ServiceRequest[] = [];
  for (let i = 0; i < 68; i++) {
    dbDocs.push({
      id: i >= 8 && i < 16 ? `real_cld_4_stud_${i - 8}` : `orig_${i}`,
      studentId: i >= 8 && i < 16 ? `stud_${i - 8}` : `stud_${i}`,
      serviceId: '4',
      status: i >= 60 ? 'pending' : 'completed',
      createdAt: new Date(baseMs - i * 60_000).toISOString()
    } as ServiceRequest);
  }

  const sorted = sortRequestsByPriorityAndDate(dbDocs, 'all');
  const page1 = mergeAndDeduplicateRequests(sorted.slice(0, 50), []);
  assert.equal(page1.length, 50);
  assert.equal(shouldShowLoadMoreButton(true, page1.length, 68), true);
  assert.equal(formatPaginationBadge(page1.length, 68), 'المعروض 50 من أصل 68');

  const page2 = mergeAndDeduplicateRequests(page1, sorted.slice(50, 100));
  assert.equal(page2.length, 68);
  assert.equal(shouldShowLoadMoreButton(false, page2.length, 68), false);
  assert.equal(formatPaginationBadge(page2.length, 68), 'المعروض 68 من أصل 68');
});

test('statusFilter="new" with >50 new requests (including missing createdAt, empty status, and legacy docs): keeps hasMore=true and loads all 75 cleanly', () => {
  const baseMs = Date.parse('2026-11-26T00:00:00.000Z');
  const allDbDocs: ServiceRequest[] = [];

  // 75 new requests across pending, in_review, empty status, missing createdAt, and legacy serviceRequests
  for (let i = 0; i < 75; i++) {
    const status = i < 65 ? 'pending' : i < 70 ? 'in_review' : i < 73 ? '' : undefined;
    const createdAt = i < 70 ? new Date(baseMs - i * 60_000).toISOString() : undefined;
    allDbDocs.push({
      id: i >= 70 ? `legacy_new_${i}` : `new_${i}`,
      studentId: `stud_${i % 40}`, // repeated students must all remain visible
      serviceId: '5',
      status: status as any,
      createdAt
    } as ServiceRequest);
  }
  // Plus 200 completed requests
  for (let i = 0; i < 200; i++) {
    allDbDocs.push({
      id: `done_${i}`,
      studentId: `stud_done_${i}`,
      serviceId: '5',
      status: 'completed',
      createdAt: new Date(baseMs - i * 30_000).toISOString()
    } as ServiceRequest);
  }

  const filteredNew = sortRequestsByPriorityAndDate(
    allDbDocs.filter((r) => matchesStatusAndDateFilter(r, 'new')),
    'new'
  );
  assert.equal(filteredNew.length, 75);
  assert.equal(isNewRequestStatus(''), true);
  assert.equal(isNewRequestStatus(undefined), true);

  // Page 1: 50 items, hasMore = true
  const page1 = mergeAndDeduplicateRequests(filteredNew.slice(0, 50), []);
  assert.equal(page1.length, 50);
  assert.equal(shouldShowLoadMoreButton(true, page1.length, 75), true);
  assert.equal(formatPaginationBadge(page1.length, 75), 'المعروض 50 من أصل 75');

  // Page 2: Load More fetches remaining 25 -> 75 of 75, hasMore = false
  const page2 = mergeAndDeduplicateRequests(page1, filteredNew.slice(50, 100));
  assert.equal(page2.length, 75);
  assert.equal(shouldShowLoadMoreButton(false, page2.length, 75), false);
  assert.equal(formatPaginationBadge(page2.length, 75), 'المعروض 75 من أصل 75');
});

test('all-services mode merges across services without hiding duplicate students and paginates 50-by-50', () => {
  const baseMs = Date.parse('2026-11-26T00:00:00.000Z');
  const multiServiceDocs: ServiceRequest[] = Array.from({ length: 68 }, (_, i) => ({
    id: `svc_${(i % 12) + 1}_req_${i}`,
    studentId: `stud_${i % 20}`, // repeated student across services & requests
    serviceId: String((i % 12) + 1),
    status: i < 12 ? 'pending' : 'completed',
    createdAt: new Date(baseMs - i * 60_000).toISOString()
  } as ServiceRequest));

  const sorted = sortRequestsByPriorityAndDate(multiServiceDocs, 'all');
  const page1 = mergeAndDeduplicateRequests(sorted.slice(0, 50), []);
  const page2 = mergeAndDeduplicateRequests(page1, sorted.slice(50, 100));

  assert.equal(page1.length, 50);
  assert.equal(shouldShowLoadMoreButton(true, page1.length, 68), true);
  assert.equal(page2.length, 68);
  assert.equal(shouldShowLoadMoreButton(false, page2.length, 68), false);
});
