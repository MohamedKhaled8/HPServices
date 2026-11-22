import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  savePersistedSession,
  getPersistedSession,
  clearPersistedSession,
  type PersistedAuthSession
} from './authPersistenceService.ts';

// Mock storage in Node environment
const mockLocalStore = new Map<string, string>();
const mockSessionStore = new Map<string, string>();

if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => mockLocalStore.get(key) || null,
    setItem: (key: string, val: string) => mockLocalStore.set(key, val),
    removeItem: (key: string) => mockLocalStore.delete(key),
    clear: () => mockLocalStore.clear()
  };
}

if (typeof globalThis.sessionStorage === 'undefined') {
  (globalThis as any).sessionStorage = {
    getItem: (key: string) => mockSessionStore.get(key) || null,
    setItem: (key: string, val: string) => mockSessionStore.set(key, val),
    removeItem: (key: string) => mockSessionStore.delete(key),
    clear: () => mockSessionStore.clear()
  };
}

beforeEach(() => {
  globalThis.localStorage.clear();
  globalThis.sessionStorage.clear();
});

test('savePersistedSession and getPersistedSession successfully retain user and role', () => {
  const dummyStudent = {
    id: 'uid_test_123',
    fullNameArabic: 'طالب تجريبي',
    vehicleNameEnglish: 'Test Student',
    email: 'student@example.com',
    whatsappNumber: '01000000000',
    diplomaYear: '2024',
    diplomaType: 'عام',
    track: 'مسار 1',
    nationalID: '29901010000000',
    address: { governorate: 'القاهرة', city: 'مدينة نصر', street: '', building: '', siteNumber: '' },
    course: ''
  };

  savePersistedSession({ uid: 'uid_test_123', email: 'student@example.com' }, 'student', dummyStudent);

  const session = getPersistedSession();
  assert.ok(session !== null, 'Session should not be null');
  assert.equal(session?.uid, 'uid_test_123');
  assert.equal(session?.role, 'student');
  assert.equal(session?.email, 'student@example.com');
  assert.equal(session?.student?.fullNameArabic, 'طالب تجريبي');
});

test('admin session hydrates immediately on simulated reload and browser reopen without null bounce', () => {
  const adminProfile = {
    id: 'admin_primary_999',
    fullNameArabic: 'مدير النظام',
    vehicleNameEnglish: 'Admin',
    email: 'admin@hp-portal.sec',
    whatsappNumber: '',
    diplomaYear: '',
    diplomaType: '',
    track: '',
    nationalID: '',
    address: { governorate: '', city: '', street: '', building: '', siteNumber: '' },
    course: ''
  };

  savePersistedSession({ uid: 'admin_primary_999', email: 'admin@hp-portal.sec' }, 'primary_admin', adminProfile);

  // Simulate browser reopen or page reload: initial state reads getPersistedSession()
  const hydrated = getPersistedSession();
  assert.ok(hydrated !== null, 'Hydrated session must not be null');
  assert.equal(hydrated?.uid, 'admin_primary_999');
  assert.equal(hydrated?.role, 'primary_admin');

  // Verify route guard conditions hold immediately on hydration
  const isLoggedIn = hydrated?.student !== null;
  const isAdmin = hydrated?.role === 'primary_admin';
  const isAuthLoading = !hydrated;

  assert.equal(isLoggedIn, true, 'Admin must be immediately logged in');
  assert.equal(isAdmin, true, 'Admin role must be immediately verified');
  assert.equal(isAuthLoading, false, 'Loading flag must be false to avoid login bounce');
});

test('manual logout immediately clears storage and prevents auto-restoration on next mount', () => {
  savePersistedSession({ uid: 'admin_to_logout', email: 'admin@hp-portal.sec' }, 'primary_admin', null);
  sessionStorage.setItem('hp_admin_telemetry_session_id', 'sess_active_123');
  sessionStorage.setItem('hp_telemetry_hmac_token', 'token_active_abc');

  assert.ok(getPersistedSession() !== null);

  // Trigger manual logout cleanup
  clearPersistedSession();

  // Storage must be purged
  assert.equal(localStorage.getItem('hp_auth_session_v2'), null);
  assert.equal(sessionStorage.getItem('hp_admin_telemetry_session_id'), null);
  assert.equal(sessionStorage.getItem('hp_telemetry_hmac_token'), null);

  // Re-hydration on next mount must resolve to null
  const nextMountSession = getPersistedSession();
  assert.equal(nextMountSession, null, 'Logged-out session must never auto-restore');
});

test('getPersistedSession returns null and clears if student session exceeds max age', () => {
  const expiredSession: PersistedAuthSession = {
    uid: 'old_student',
    email: 'old@example.com',
    role: 'student',
    student: null,
    savedAt: Date.now() - (35 * 24 * 60 * 60 * 1000)
  };

  localStorage.setItem('hp_auth_session_v2', JSON.stringify(expiredSession));

  const result = getPersistedSession();
  assert.equal(result, null, 'Expired student session must return null');
  assert.equal(localStorage.getItem('hp_auth_session_v2'), null, 'Expired session must be cleaned from storage');
});

test('getPersistedSession handles corrupted storage data safely', () => {
  localStorage.setItem('hp_auth_session_v2', '{invalid_json');
  const result = getPersistedSession();
  assert.equal(result, null, 'Corrupted session must return null safely');
});

test('admin sessions never expire on localStorage time lease', () => {
  const oldAdminSession: PersistedAuthSession = {
    uid: 'admin_permanent',
    email: 'admin@hp-portal.sec',
    role: 'primary_admin',
    student: null,
    savedAt: Date.now() - (60 * 24 * 60 * 60 * 1000)
  };

  localStorage.setItem('hp_auth_session_v2', JSON.stringify(oldAdminSession));

  const result = getPersistedSession();
  assert.ok(result !== null, 'Admin session must never expire on time lease');
  assert.equal(result?.uid, 'admin_permanent');
  assert.equal(result?.role, 'primary_admin');
});
