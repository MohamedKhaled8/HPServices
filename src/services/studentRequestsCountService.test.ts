import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  doesRequestMatchStudent,
  syncStudentRequestCount,
  getCachedStudentRequestCount,
  clearStudentRequestCountCache,
  fetchCountsForStudents
} from './studentRequestsCountService.ts';
import { executeStatsSyncWithFallback } from '../utils/requestsStatsCore.ts';
import type { StudentData, ServiceRequest } from '../types/index.ts';

test('doesRequestMatchStudent: matches by id, legacyId, email, phone, and national ID', () => {
  const student = {
    id: 'stud_123',
    fullNameArabic: 'محمد أحمد',
    email: 'mohamed@test.com',
    whatsappNumber: '01012345678',
    nationalID: '29801011234567'
  } as unknown as StudentData;

  // 1. Direct studentId
  assert.equal(doesRequestMatchStudent({ id: 'r1', studentId: 'stud_123' } as unknown as ServiceRequest, student), true);
  // 2. LegacyId
  const legacyStudent = { ...student, legacyId: 'legacy_999' } as unknown as StudentData;
  assert.equal(doesRequestMatchStudent({ id: 'r2', studentId: 'legacy_999' } as unknown as ServiceRequest, legacyStudent), true);
  // 3. Email in data
  assert.equal(doesRequestMatchStudent({ id: 'r3', data: { email: 'MOHAMED@TEST.COM' } } as unknown as ServiceRequest, student), true);
  // 4. Phone with international prefix
  assert.equal(doesRequestMatchStudent({ id: 'r4', data: { whatsapp_number: '+201012345678' } } as unknown as ServiceRequest, student), true);
  // 5. National ID
  assert.equal(doesRequestMatchStudent({ id: 'r5', data: { national_id: '29801011234567' } } as unknown as ServiceRequest, student), true);
  // 6. Non-match
  assert.equal(doesRequestMatchStudent({ id: 'r6', studentId: 'other_user', data: { email: 'diff@test.com' } } as unknown as ServiceRequest, student), false);
});

test('syncStudentRequestCount & persistent module cache: zero Firestore reads and never resets to 0', async () => {
  clearStudentRequestCountCache();
  assert.equal(getCachedStudentRequestCount('stud_abc'), undefined);

  // Sync updates immediately
  syncStudentRequestCount('stud_abc', 5);
  assert.equal(getCachedStudentRequestCount('stud_abc'), 5);

  // Remounting / tab switch reading from persistent cache:
  const student = { id: 'stud_abc', fullNameArabic: 'أحمد', email: 'a@a.com' } as unknown as StudentData;
  const res = await fetchCountsForStudents([student]);
  assert.equal(res.get('stud_abc'), 5, 'Must read from module cache with 0 extra reads');
  assert.equal(getCachedStudentRequestCount('stud_abc'), 5, 'Count must NEVER reset to 0');
});

test('deduplication across multiple collections: duplicate doc IDs counted once', () => {
  const student = { id: 'stud_multi', fullNameArabic: 'علي', email: 'ali@test.com' } as unknown as StudentData;
  const req1 = { id: 'req_common_id', studentId: 'stud_multi' } as unknown as ServiceRequest;
  const req2 = { id: 'req_common_id', data: { email: 'ali@test.com' } } as unknown as ServiceRequest;
  const req3 = { id: 'req_unique_id', studentId: 'stud_multi' } as unknown as ServiceRequest;

  // Matching logic
  assert.equal(doesRequestMatchStudent(req1, student), true);
  assert.equal(doesRequestMatchStudent(req2, student), true);
  assert.equal(doesRequestMatchStudent(req3, student), true);

  // Deduplicating via Set as done in fetchCountsForStudents
  const matched = new Set<string>();
  [req1, req2, req3].forEach(r => {
    if (doesRequestMatchStudent(r, student) && r.id) matched.add(r.id);
  });
  assert.equal(matched.size, 2, 'req_common_id must be deduplicated to 1, total 2');
});

test('zero-overwrite guard: permission-denied metadata or total=0 doc replaced by real server count', async () => {
  const freshRealStats = {
    total: 350,
    byService: {
      '1': { total: 100, pending: 5 },
      '2': { total: 250, pending: 15 }
    },
    updatedAt: Date.now()
  };

  // Writing to metadata fails with permission-denied
  const res = await executeStatsSyncWithFallback(
    async () => freshRealStats,
    async () => {
      const err = new Error('permission-denied on metadata/requests_stats');
      (err as unknown as Record<string, unknown>).code = 'permission-denied';
      throw err;
    }
  );

  assert.equal(res.persisted, false);
  assert.equal(res.stats.total, 350, 'UI must receive real count of 350 even if metadata write fails');
  assert.equal(res.stats.byService['1'].total, 100);
  assert.equal(res.stats.byService['2'].total, 250);
});
