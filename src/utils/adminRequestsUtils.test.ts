import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  adminCodeCreatedAtMs,
  buildAdminCodesLookup,
  computeRequestDuplicateCounts,
  normalizeWorkflowStatus
} from './adminRequestsUtils.ts';
import type { ServiceRequest, StudentData } from '../types/index.ts';

// -------------------------------------------------------------
// 1. adminCodeCreatedAtMs Tests
// -------------------------------------------------------------
test('adminCodeCreatedAtMs: handles null, undefined, empty inputs', () => {
  assert.equal(adminCodeCreatedAtMs(null), 0);
  assert.equal(adminCodeCreatedAtMs(undefined), 0);
  assert.equal(adminCodeCreatedAtMs(''), 0);
  assert.equal(adminCodeCreatedAtMs(0), 0);
});

test('adminCodeCreatedAtMs: handles Firestore Timestamp with toDate()', () => {
  const d = new Date('2026-05-15T10:00:00Z');
  const firestoreObj = {
    toDate: () => d
  };
  assert.equal(adminCodeCreatedAtMs(firestoreObj), d.getTime());
});

test('adminCodeCreatedAtMs: handles Firestore timestamp with seconds', () => {
  const firestoreObj = { seconds: 1700000000 };
  assert.equal(adminCodeCreatedAtMs(firestoreObj), 1700000000000);
});

test('adminCodeCreatedAtMs: handles standard Date strings, numbers, and invalid dates', () => {
  const iso = '2026-01-01T00:00:00.000Z';
  assert.equal(adminCodeCreatedAtMs(iso), new Date(iso).getTime());
  assert.equal(adminCodeCreatedAtMs(1700000000000), 1700000000000);
  assert.equal(adminCodeCreatedAtMs('not-a-valid-date'), 0);
});

// -------------------------------------------------------------
// 2. buildAdminCodesLookup Tests
// -------------------------------------------------------------
test('buildAdminCodesLookup: empty inputs produce empty lookup maps', () => {
  const lookup = buildAdminCodesLookup([], []);
  assert.equal(lookup.dtLatestByStudent.size, 0);
  assert.equal(lookup.dtLatestByNational.size, 0);
  assert.equal(lookup.dtLatestByPhone.size, 0);
  assert.equal(lookup.epLatestByStudent.size, 0);
  assert.equal(lookup.epLatestByNational.size, 0);
  assert.equal(lookup.epLatestByPhone.size, 0);
});

test('buildAdminCodesLookup: indexes DT codes by student, nationalID, and phone', () => {
  const dtCodes = [
    {
      studentId: 'stud_1',
      nationalID: '29901011234567',
      mobile: '01012345678',
      createdAt: '2026-01-01T00:00:00Z',
      code: 'DT-1'
    }
  ];
  const lookup = buildAdminCodesLookup(dtCodes, []);
  assert.equal(lookup.dtLatestByStudent.get('stud_1')?.code, 'DT-1');
  assert.equal(lookup.dtLatestByNational.get('29901011234567')?.code, 'DT-1');
  assert.equal(lookup.dtLatestByPhone.get('1012345678')?.code, 'DT-1');
});

test('buildAdminCodesLookup: keeps the latest code when duplicate keys exist', () => {
  const dtCodes = [
    {
      studentId: 'stud_1',
      national_id: '29901011234567',
      phone: '+20 010 1234 5678',
      createdAt: '2026-01-01T00:00:00Z',
      code: 'DT-OLD'
    },
    {
      studentId: 'stud_1',
      nationalID: '29901011234567',
      whatsapp: '01012345678',
      createdAt: '2026-02-01T00:00:00Z',
      code: 'DT-NEW'
    }
  ];
  const lookup = buildAdminCodesLookup(dtCodes, []);
  assert.equal(lookup.dtLatestByStudent.get('stud_1')?.code, 'DT-NEW');
  assert.equal(lookup.dtLatestByNational.get('29901011234567')?.code, 'DT-NEW');
  assert.equal(lookup.dtLatestByPhone.get('1012345678')?.code, 'DT-NEW');
});

test('buildAdminCodesLookup: respects length thresholds for national ID (>=6) and phone (>=10)', () => {
  const dtCodes = [
    {
      studentId: 'stud_2',
      nationalID: '12345', // < 6 chars, should be ignored
      mobile: '123456789',  // < 10 chars, should be ignored
      createdAt: '2026-01-01T00:00:00Z',
      code: 'DT-SHORT'
    }
  ];
  const lookup = buildAdminCodesLookup(dtCodes, []);
  assert.equal(lookup.dtLatestByStudent.get('stud_2')?.code, 'DT-SHORT');
  assert.equal(lookup.dtLatestByNational.size, 0);
  assert.equal(lookup.dtLatestByPhone.size, 0);
});

test('buildAdminCodesLookup: indexes EP codes properly', () => {
  const epCodes = [
    {
      studentId: 'stud_ep_1',
      national_id: '30005051234567',
      whatsapp: '01122334455',
      updatedAt: '2026-03-01T00:00:00Z',
      code: 'EP-1'
    }
  ];
  const lookup = buildAdminCodesLookup([], epCodes);
  assert.equal(lookup.epLatestByStudent.get('stud_ep_1')?.code, 'EP-1');
  assert.equal(lookup.epLatestByNational.get('30005051234567')?.code, 'EP-1');
  assert.equal(lookup.epLatestByPhone.get('1122334455')?.code, 'EP-1');
});

// -------------------------------------------------------------
// 3. computeRequestDuplicateCounts Tests
// -------------------------------------------------------------
test('computeRequestDuplicateCounts: returns empty array for empty rows', () => {
  const counts = computeRequestDuplicateCounts([], {});
  assert.deepEqual(counts, []);
});

test('computeRequestDuplicateCounts: returns [1] for single unique request', () => {
  const rows: ServiceRequest[] = [
    {
      id: 'req_1',
      studentId: 's1',
      serviceId: 'serv_1',
      data: { email: 'user1@example.com', national_id: '12345678901234' },
      documents: [],
      status: 'pending'
    }
  ];
  const counts = computeRequestDuplicateCounts(rows, {});
  assert.deepEqual(counts, [1]);
});

test('computeRequestDuplicateCounts: detects duplicates by studentId, email, or nationalID', () => {
  const rows: ServiceRequest[] = [
    {
      id: 'r1',
      studentId: 's1',
      serviceId: 'serv_1',
      data: { email: 'john@example.com' },
      documents: [],
      status: 'pending'
    },
    {
      id: 'r2',
      studentId: 's1', // matches r1 by studentId
      serviceId: 'serv_2',
      data: {},
      documents: [],
      status: 'submitted'
    },
    {
      id: 'r3',
      studentId: 's2',
      serviceId: 'serv_1',
      data: { email: ' JOHN@example.com ' }, // matches r1 by email (case-insensitive & trimmed)
      documents: [],
      status: 'pending'
    },
    {
      id: 'r4',
      studentId: 's3',
      serviceId: 'serv_1',
      data: { email: 'unique@example.com', national_id: '99999999999999' },
      documents: [],
      status: 'pending'
    }
  ];

  const counts = computeRequestDuplicateCounts(rows, {});
  // r1 matches r2 (via studentId) and r3 (via email) -> size 3
  // r2 matches r1 (via studentId) -> also connected via r1 to r3 in merged Set?
  // Let's check algorithm logic:
  // for r2: sk=s1 (finds r1, r2). r2 email is empty. r2 nat is empty.
  // counts[1] = 2.
  // for r1: sk=s1 (finds r1, r2), email finds r1, r3 -> counts[0] = 3.
  // for r3: sk=s2 (finds r3), email finds r1, r3 -> counts[2] = 2.
  // for r4: sk=s3 (finds r4), email finds r4, nat finds r4 -> counts[3] = 1.
  assert.equal(counts[0], 3);
  assert.equal(counts[1], 2);
  assert.equal(counts[2], 2);
  assert.equal(counts[3], 1);
});

test('computeRequestDuplicateCounts: enriches missing request fields from students dictionary', () => {
  const students: Record<string, StudentData> = {
    s1: {
      fullNameArabic: 'طالب تجريبي',
      vehicleNameEnglish: '',
      whatsappNumber: '01000000000',
      diplomaYear: '2026',
      diplomaType: 'عام',
      address: '',
      course: '',
      email: 'student_s1@example.com',
      nationalID: '29801011111111'
    }
  };

  const rows: ServiceRequest[] = [
    {
      id: 'r1',
      studentId: 's1',
      serviceId: 'serv_1',
      data: {}, // no email or national_id in request.data
      documents: [],
      status: 'pending'
    },
    {
      id: 'r2',
      studentId: 'other_student',
      serviceId: 'serv_2',
      data: { national_id: '29801011111111' }, // matches s1 nationalID
      documents: [],
      status: 'completed'
    }
  ];

  const counts = computeRequestDuplicateCounts(rows, students);
  assert.equal(counts[0], 2);
  assert.equal(counts[1], 2);
});

test('computeRequestDuplicateCounts: handles undefined studentId safely with __no_student__ key', () => {
  const rows: ServiceRequest[] = [
    {
      id: 'r_none_1',
      studentId: '',
      serviceId: 'serv_1',
      data: { email: 'a@b.com' },
      documents: [],
      status: 'pending'
    },
    {
      id: 'r_none_2',
      studentId: undefined as any,
      serviceId: 'serv_2',
      data: { email: 'c@d.com' },
      documents: [],
      status: 'pending'
    }
  ];

  const counts = computeRequestDuplicateCounts(rows, {});
  // Both share __no_student__ key, so both see each other
  assert.equal(counts[0], 2);
  assert.equal(counts[1], 2);
});

// -------------------------------------------------------------
// 4. normalizeWorkflowStatus Tests
// -------------------------------------------------------------
test('normalizeWorkflowStatus: passes valid statuses through', () => {
  assert.equal(normalizeWorkflowStatus('submitted'), 'submitted');
  assert.equal(normalizeWorkflowStatus('receipt_sent'), 'receipt_sent');
  assert.equal(normalizeWorkflowStatus('completed'), 'completed');
  assert.equal(normalizeWorkflowStatus('rejected'), 'rejected');
  assert.equal(normalizeWorkflowStatus('pending'), 'pending');
});

test('normalizeWorkflowStatus: trims whitespace on valid statuses', () => {
  assert.equal(normalizeWorkflowStatus('  submitted  '), 'submitted');
  assert.equal(normalizeWorkflowStatus('\treceipt_sent\n'), 'receipt_sent');
  assert.equal(normalizeWorkflowStatus(' completed '), 'completed');
  assert.equal(normalizeWorkflowStatus(' rejected '), 'rejected');
});

test('normalizeWorkflowStatus: maps unexpected, invalid, or empty inputs to "pending"', () => {
  assert.equal(normalizeWorkflowStatus(undefined), 'pending');
  assert.equal(normalizeWorkflowStatus(''), 'pending');
  assert.equal(normalizeWorkflowStatus('   '), 'pending');
  assert.equal(normalizeWorkflowStatus('approved'), 'pending');
  assert.equal(normalizeWorkflowStatus('in_review'), 'pending');
  assert.equal(normalizeWorkflowStatus('random_status_string'), 'pending');
});

