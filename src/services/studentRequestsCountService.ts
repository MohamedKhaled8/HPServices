import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase.ts';
import type { StudentData, ServiceRequest } from '../types/index.ts';
import { normalizePhone } from '../utils/requestsSearchCore.ts';

const STORAGE_KEY = 'hp_student_order_counts_v1';
const memoryCache = new Map<string, number>();

export const doesRequestMatchStudent = (req: ServiceRequest, student: StudentData): boolean => {
  if (!student || !req) return false;
  if (student.id && req.studentId === student.id) return true;
  const legacyId = (student as unknown as Record<string, unknown>).legacyId;
  if (typeof legacyId === 'string' && legacyId && req.studentId === legacyId) return true;

  const sEmail = (student.email || '').trim().toLowerCase();
  if (sEmail) {
    const rStudentId = (req.studentId || '').trim().toLowerCase();
    const rEmail = String((req as unknown as Record<string, unknown>).email || '').trim().toLowerCase();
    const rDataEmail = String(req.data?.email || '').trim().toLowerCase();
    const rDataStudentEmail = String(req.data?.student_email || '').trim().toLowerCase();
    if (rStudentId === sEmail || rEmail === sEmail || rDataEmail === sEmail || rDataStudentEmail === sEmail) return true;
  }

  const sPhoneRaw = student.whatsappNumber || String((student as unknown as Record<string, unknown>).phone || '');
  const sPhone = normalizePhone(sPhoneRaw);
  if (sPhone && sPhone.length >= 8) {
    const phones = [
      req.data?.whatsapp_number, req.data?.whatsappNumber, req.data?.phone,
      req.data?.phone_whatsapp, req.data?.leader_whatsapp,
      (req as unknown as Record<string, unknown>).phone, (req as unknown as Record<string, unknown>).whatsapp
    ];
    for (const cp of phones) {
      if (cp != null) {
        const norm = normalizePhone(String(cp));
        if (norm && (norm === sPhone || norm.endsWith(sPhone) || sPhone.endsWith(norm))) return true;
      }
    }
  }

  const sNatId = String(student.nationalID || (student as unknown as Record<string, unknown>).national_id || '').trim();
  if (sNatId && sNatId.length >= 10) {
    const reqNatId = String(req.data?.national_id || req.data?.nationalID || req.data?.nationalId || '').trim();
    if (reqNatId && reqNatId === sNatId) return true;
  }
  return false;
};

const loadSessionCounts = (): Record<string, number> => {
  try {
    if (typeof window === 'undefined') return {};
    const raw = window.sessionStorage?.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.warn('Failed reading student count sessionStorage:', err);
    return {};
  }
};

export const getCachedStudentRequestCount = (studentId: string): number | undefined => {
  if (!studentId) return undefined;
  if (memoryCache.has(studentId)) return memoryCache.get(studentId);
  const sess = loadSessionCounts();
  if (typeof sess[studentId] === 'number') {
    memoryCache.set(studentId, sess[studentId]);
    return sess[studentId];
  }
  return undefined;
};

export const syncStudentRequestCount = (studentId: string, count: number): void => {
  if (!studentId || typeof count !== 'number') return;
  memoryCache.set(studentId, count);
  try {
    if (typeof window !== 'undefined') {
      const sess = loadSessionCounts();
      sess[studentId] = count;
      window.sessionStorage?.setItem(STORAGE_KEY, JSON.stringify(sess));
    }
  } catch (err) {
    console.warn('Failed persisting student count to sessionStorage:', err);
  }
};

export const clearStudentRequestCountCache = (): void => {
  memoryCache.clear();
  try {
    if (typeof window !== 'undefined') window.sessionStorage?.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Failed clearing student count cache:', err);
  }
};

const ORDER_COLLECTIONS = [
  'serviceRequests_1', 'serviceRequests_2', 'serviceRequests_3', 'serviceRequests_4',
  'serviceRequests_5', 'serviceRequests_6', 'serviceRequests_7', 'serviceRequests_8',
  'serviceRequests_9', 'serviceRequests_10', 'serviceRequests_11', 'serviceRequests_12',
  'serviceRequests'
];

export const fetchCountsForStudents = async (
  students: StudentData[]
): Promise<Map<string, number>> => {
  const uncached = students.filter((s) => s?.id && getCachedStudentRequestCount(s.id) === undefined);
  if (uncached.length === 0) return memoryCache;

  const chunkSize = 25;
  for (let i = 0; i < uncached.length; i += chunkSize) {
    const chunk = uncached.slice(i, i + chunkSize);
    const ids = chunk.map((s) => s.id).filter((id): id is string => Boolean(id));
    const emails = Array.from(new Set(chunk.map((s) => (s.email || '').trim().toLowerCase()).filter(Boolean)));
    const legIds = Array.from(new Set(chunk.map((s) => String((s as unknown as Record<string, unknown>).legacyId || '')).filter(Boolean)));

    const matchedMap = new Map<string, Set<string>>();
    chunk.forEach((s) => { if (s.id) matchedMap.set(s.id, new Set()); });

    const queries: Promise<unknown>[] = [];
    for (const colName of ORDER_COLLECTIONS) {
      const colRef = collection(db, colName);
      if (ids.length) queries.push(getDocs(query(colRef, where('studentId', 'in', ids))).catch((e) => {
        console.warn(`Query ${colName} by studentId failed:`, e);
        return null;
      }));
      if (emails.length) {
        queries.push(getDocs(query(colRef, where('studentId', 'in', emails))).catch(() => null));
        queries.push(getDocs(query(colRef, where('email', 'in', emails))).catch(() => null));
        queries.push(getDocs(query(colRef, where('data.email', 'in', emails))).catch(() => null));
      }
      if (legIds.length) {
        queries.push(getDocs(query(colRef, where('studentId', 'in', legIds))).catch(() => null));
      }
    }

    const snaps = await Promise.all(queries);
    for (const snap of snaps) {
      if (!snap || typeof snap !== 'object' || !('docs' in snap) || !Array.isArray((snap as { docs: unknown[] }).docs)) continue;
      for (const d of (snap as { docs: Array<{ id: string; data: () => Record<string, unknown> }> }).docs) {
        const req = { ...d.data(), id: d.id } as ServiceRequest;
        for (const st of chunk) {
          if (st.id && doesRequestMatchStudent(req, st)) matchedMap.get(st.id)?.add(d.id);
        }
      }
    }

    for (const st of chunk) {
      if (st.id) {
        const count = matchedMap.get(st.id)?.size ?? 0;
        syncStudentRequestCount(st.id, count);
      }
    }
  }
  return memoryCache;
};
