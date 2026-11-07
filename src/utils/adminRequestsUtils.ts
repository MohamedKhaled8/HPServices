import type { ServiceRequest, ServiceRequestWorkflowStatus, StudentData } from '../types/index.ts';

export function adminCodeCreatedAtMs(v: any): number {
  if (!v) return 0;
  if (v?.toDate && typeof v.toDate === 'function') return v.toDate().getTime();
  if (typeof v?.seconds === 'number') return v.seconds * 1000;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

export interface AdminCodesLookup {
  dtLatestByStudent: Map<string, any>;
  dtLatestByNational: Map<string, any>;
  dtLatestByPhone: Map<string, any>;
  epLatestByStudent: Map<string, any>;
  epLatestByNational: Map<string, any>;
  epLatestByPhone: Map<string, any>;
}

/** فهارس لآخر كود DT/EP لكل طالب أو رقم قومي/هاتف — يستبدل filter+sort على كل صف في الجدول */
export function buildAdminCodesLookup(dtCodes: any[], epCodes: any[]): AdminCodesLookup {
  const dtLatestByStudent = new Map<string, any>();
  const dtLatestByNational = new Map<string, any>();
  const dtLatestByPhone = new Map<string, any>();
  for (const c of dtCodes) {
    const ts = adminCodeCreatedAtMs(c.createdAt || c.updatedAt);
    const sid = c.studentId;
    if (sid) {
      const prev = dtLatestByStudent.get(sid);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) dtLatestByStudent.set(sid, c);
    }
    const nat = String(c.nationalID || c.national_id || '').replace(/\D/g, '');
    if (nat.length >= 6) {
      const prev = dtLatestByNational.get(nat);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) dtLatestByNational.set(nat, c);
    }
    const ph = String(c.mobile || c.phone || c.whatsapp || '').replace(/\D/g, '');
    const ph10 = ph.length >= 10 ? ph.slice(-10) : ph;
    if (ph10.length >= 10) {
      const prev = dtLatestByPhone.get(ph10);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) dtLatestByPhone.set(ph10, c);
    }
  }
  const epLatestByStudent = new Map<string, any>();
  const epLatestByNational = new Map<string, any>();
  const epLatestByPhone = new Map<string, any>();
  for (const c of epCodes) {
    const ts = adminCodeCreatedAtMs(c.createdAt || c.updatedAt);
    const sid = c.studentId;
    if (sid) {
      const prev = epLatestByStudent.get(sid);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) epLatestByStudent.set(sid, c);
    }
    const nat = String(c.nationalID || c.national_id || '').replace(/\D/g, '');
    if (nat.length >= 6) {
      const prev = epLatestByNational.get(nat);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) epLatestByNational.set(nat, c);
    }
    const ph = String(c.mobile || c.whatsapp || '').replace(/\D/g, '');
    const ph10 = ph.length >= 10 ? ph.slice(-10) : ph;
    if (ph10.length >= 10) {
      const prev = epLatestByPhone.get(ph10);
      if (!prev || ts > adminCodeCreatedAtMs(prev.createdAt || prev.updatedAt)) epLatestByPhone.set(ph10, c);
    }
  }
  return { dtLatestByStudent, dtLatestByNational, dtLatestByPhone, epLatestByStudent, epLatestByNational, epLatestByPhone };
}

/** كان O(n²) — يصبح تقريباً O(n + مجموع أحجام المجموعات) عبر فهارس */
export function computeRequestDuplicateCounts(rows: ServiceRequest[], students: Record<string, StudentData>): number[] {
  const n = rows.length;
  const byStudent = new Map<string, number[]>();
  const byEmail = new Map<string, number[]>();
  const byNat = new Map<string, number[]>();
  const studentKey = (id: string | undefined) => (id != null && String(id) !== '' ? String(id) : '__no_student__');

  for (let i = 0; i < n; i++) {
    const request = rows[i];
    const studentData = students[request.studentId];
    const sk = studentKey(request.studentId);
    if (!byStudent.has(sk)) byStudent.set(sk, []);
    byStudent.get(sk)!.push(i);

    const rEmail = (request.data?.email || studentData?.email || '').toLowerCase().trim();
    if (rEmail) {
      if (!byEmail.has(rEmail)) byEmail.set(rEmail, []);
      byEmail.get(rEmail)!.push(i);
    }
    const rNationalID = String(request.data?.national_id || studentData?.nationalID || '');
    if (rNationalID) {
      if (!byNat.has(rNationalID)) byNat.set(rNationalID, []);
      byNat.get(rNationalID)!.push(i);
    }
  }

  const counts = new Array<number>(n);
  const merged = new Set<number>();
  for (let i = 0; i < n; i++) {
    merged.clear();
    const request = rows[i];
    const studentData = students[request.studentId];
    const sk = studentKey(request.studentId);
    for (const j of byStudent.get(sk) || []) merged.add(j);

    const rEmail = (request.data?.email || studentData?.email || '').toLowerCase().trim();
    if (rEmail) {
      for (const j of byEmail.get(rEmail) || []) merged.add(j);
    }
    const rNationalID = String(request.data?.national_id || studentData?.nationalID || '');
    if (rNationalID) {
      for (const j of byNat.get(rNationalID) || []) merged.add(j);
    }
    counts[i] = merged.size;
  }
  return counts;
}

export const normalizeWorkflowStatus = (s: string | undefined): ServiceRequestWorkflowStatus => {
  const v = String(s || '').trim();
  if (v === 'submitted' || v === 'receipt_sent' || v === 'completed' || v === 'rejected') return v;
  return 'pending';
};
