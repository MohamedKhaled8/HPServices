/**
 * استعادة طلبات الخدمات من صور Cloudinary — مع pagination كامل.
 */

const CLOUD_NAME = 'dpjnaefed';
const API_KEY = '441411461172178';
const API_SECRET = 'FJqt4NGMBOW49DhdvTpW9-SPNZ8';

export interface CloudinaryAsset {
  public_id: string;
  secure_url?: string;
  asset_id?: string;
  bytes?: number;
  format?: string;
  created_at?: string;
}

export interface ParsedCloudinaryPath {
  studentId: string;
  serviceId: string;
}

export const RESTORED_DOC_PREFIXES = ['restored_', 'exact_', 'real_auto_', 'real_cld_', 'real_grad_'] as const;

function getAuthHeader(): string {
  return 'Basic ' + btoa(`${API_KEY}:${API_SECRET}`);
}

export function parseServiceRequestPublicId(publicId: string): ParsedCloudinaryPath {
  const parts = (publicId || '').split('/');
  let serviceId = '';
  let studentId = '';

  for (const p of parts) {
    if (/^(1[0-1]|[1-9])$/.test(p)) {
      serviceId = p;
      break;
    }
  }

  for (const p of parts) {
    if (p !== 'serviceRequests' && p !== serviceId && p.length >= 8 && !p.includes('.')) {
      studentId = p;
      break;
    }
  }
  if (!studentId && parts.length >= 2) studentId = parts[1];

  return { studentId, serviceId: serviceId || '1' };
}

/** جلب كل صور serviceRequests من Cloudinary مع pagination */
export async function fetchAllServiceRequestImages(
  targetServiceId?: string
): Promise<CloudinaryAsset[]> {
  const all: CloudinaryAsset[] = [];
  let cursor: string | undefined;

  const expression = targetServiceId
    ? `public_id:serviceRequests/*/${targetServiceId}/*`
    : 'public_id:serviceRequests/*';

  do {
    const body: Record<string, unknown> = { expression, max_results: 500 };
    if (cursor) body.next_cursor = cursor;

    const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/resources/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: getAuthHeader() },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Cloudinary search failed (${response.status}): ${errText.slice(0, 200)}`);
    }

    const data = await response.json();
    if (data.error) throw new Error(data.error.message || 'Cloudinary search error');

    let batch: CloudinaryAsset[] = data.resources || [];

    if (targetServiceId && batch.length === 0 && all.length === 0 && !cursor) {
      // Fallback: fetch all and filter
      return fetchAllServiceRequestImages(undefined).then((allResources) =>
        allResources.filter((r) => parseServiceRequestPublicId(r.public_id).serviceId === targetServiceId)
      );
    }

    if (targetServiceId) {
      batch = batch.filter((r) => {
        const parts = (r.public_id || '').split('/');
        return parts.includes(targetServiceId);
      });
    }

    all.push(...batch);
    cursor = data.next_cursor;
  } while (cursor);

  return all;
}

/** دمج الصور: طلب واحد لكل طالب+خدمة (أحدث صورة) */
export function groupAssetsByStudentService(
  assets: CloudinaryAsset[]
): Map<string, { asset: CloudinaryAsset; studentId: string; serviceId: string }> {
  const map = new Map<string, { asset: CloudinaryAsset; studentId: string; serviceId: string; createdMs: number }>();

  for (const asset of assets) {
    const { studentId, serviceId } = parseServiceRequestPublicId(asset.public_id);
    if (!studentId) continue;

    const key = `${serviceId}__${studentId}`;
    const createdMs = asset.created_at ? new Date(asset.created_at).getTime() : 0;
    const existing = map.get(key);

    if (!existing || createdMs >= existing.createdMs) {
      map.set(key, { asset, studentId, serviceId, createdMs });
    }
  }

  const result = new Map<string, { asset: CloudinaryAsset; studentId: string; serviceId: string }>();
  map.forEach((v, k) => result.set(k, { asset: v.asset, studentId: v.studentId, serviceId: v.serviceId }));
  return result;
}

export function buildRestoredRequestData(student: Record<string, unknown>, serviceId: string): Record<string, unknown> {
  const fullNameAr = (student.fullNameArabic || student.full_name_arabic || student.full_name || 'طالب') as string;
  const fullNameEn = (student.vehicleNameEnglish || student.fullNameEnglish || student.full_name_english || '') as string;
  const phone = (student.whatsappNumber || student.phone || student.phoneNumber || student.mobile || '') as string;
  const natId = (student.nationalID || student.national_id || '') as string;
  const email = (student.email || '') as string;
  const track = (student.track || student.track_name || student.course || '') as string;
  const diplomaType = (student.diplomaType || student.diploma_type || 'عام تربوي') as string;
  const diplomaYear = (student.diplomaYear || student.diploma_year || '2026') as string;
  const address = student.address
    ? typeof student.address === 'object'
      ? `${(student.address as Record<string, string>).governorate || ''} ${(student.address as Record<string, string>).city || ''} ${(student.address as Record<string, string>).street || ''}`.trim()
      : String(student.address)
    : '';

  const base: Record<string, unknown> = {
    full_name_arabic: fullNameAr,
    full_name_english: fullNameEn,
    national_id: natId,
    whatsapp_number: phone,
    phone_whatsapp: phone,
    email,
    address,
    address_details: address,
    diploma_type: diplomaType,
    diploma_year: diplomaYear,
    track,
    student_names: fullNameAr,
  };

  if (serviceId === '1') {
    base.college = student.college || '';
    base.department = student.department || '';
    base.grade = student.grade || '';
  } else if (serviceId === '3') {
    base.number_of_copies = student.numberOfCopies || 1;
    base.names_array = [fullNameAr];
    base.tracks_array = [track || 'المسار الأول'];
  } else if (serviceId === '5') {
    base.educational_specialization = student.specialization || student.department || 'عام';
  } else if (serviceId === '6') {
    base.selectedCertificate = student.selectedCertificate || 'شهادة تقدير';
  } else if (serviceId === '7') {
    base.transformation_type = student.transformationType || 'دورة التحول الرقمي';
    base.selectedExamLanguage = student.examLanguage || 'عربي';
  } else if (serviceId === '9') {
    base.leader_whatsapp = phone;
    base.project_title = student.project_title || student.projectTitle || student.course || 'مشروع التخرج';
    base.group_link = student.group_link || student.groupLink || '';
  }

  return base;
}

export function buildRestoredDocument(asset: CloudinaryAsset, fullNameAr: string) {
  return {
    id: asset.asset_id || asset.public_id,
    name: `إيصال_${fullNameAr}.jpg`,
    size: asset.bytes || 150000,
    type: 'image/jpeg',
    url:
      asset.secure_url ||
      `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/q_auto:best,f_auto/${asset.public_id}.${asset.format || 'jpg'}`,
  };
}

const PLACEHOLDER_VALUES = new Set(['', '-', 'طالب', 'بدون اسم', 'unknown']);

function isPlaceholder(field: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const s = String(value).trim();
  if (PLACEHOLDER_VALUES.has(s)) return true;
  if (field === 'project_title' && (s === 'مشروع التخرج' || s === 'طلب خدمة')) return true;
  return false;
}

/** دمج بيانات الطالب والطلبات القديمة مع المحافظة على القيم الحقيقية */
export function mergeEnrichedRequestData(
  existing: Record<string, unknown>,
  fromStudent: Record<string, unknown>,
  fromLegacyAuto: Record<string, unknown> = {}
): Record<string, unknown> {
  const merged = { ...existing };
  const sources = [fromLegacyAuto, fromStudent];

  for (const source of sources) {
    for (const [key, value] of Object.entries(source)) {
      if (value === null || value === undefined) continue;
      if (isPlaceholder(key, merged[key]) && !isPlaceholder(key, value)) {
        merged[key] = value;
      }
    }
  }

  return merged;
}

export function isPlaceholderOrderData(data: Record<string, unknown> | undefined | null): boolean {
  if (!data) return true;
  const rawName = data.full_name_arabic || data.full_name || data.student_names;
  if (!rawName) return true;
  if (Array.isArray(rawName)) {
    return rawName.length === 0 || rawName.every((n) => !String(n).trim() || String(n).trim() === 'طالب');
  }
  const names = String(rawName).split(/[\n\r,،;]+/).map((n) => n.trim()).filter(Boolean);
  if (names.length === 0) return true;
  return names.every((n) => n === 'طالب' || n === 'بدون اسم');
}

export function orderNeedsAutoFix(req: { id?: string; data?: Record<string, unknown> }): boolean {
  if (!req.id) return false;
  return req.id.startsWith('real_cld_') || req.id.startsWith('real_auto_') || isPlaceholderOrderData(req.data);
}

export function isRestoredRequestId(id?: string): boolean {
  if (!id) return false;
  return RESTORED_DOC_PREFIXES.some((p) => id.startsWith(p));
}

/** أولوية الإبقاء بين طلبات مستعادة فقط */
export function requestKeepScore(req: {
  id?: string;
  data?: Record<string, unknown>;
  documents?: { url?: string }[];
  createdAt?: string;
}): number {
  let score = 0;
  const id = req.id || '';
  if (id.startsWith('real_cld_')) score += 1000;
  else if (id.startsWith('real_auto_')) score += 200;
  else if (isRestoredRequestId(id)) score += 100;

  const docs = req.documents || [];
  if (docs.some((d) => (d.url || '').includes('cloudinary.com'))) score += 500;
  if (!isPlaceholderOrderData(req.data)) score += 300;

  const t = req.createdAt ? new Date(req.createdAt).getTime() : 0;
  return score * 1e15 + t;
}

/**
 * إزالة تكرار العرض فقط:
 * - الطلبات الحقيقية (الجديدة) تظهر دائماً كلها
 * - الطلبات المستعادة تظهر فقط إذا لا يوجد طلب حقيقي لنفس الطالب
 */
export function dedupeRequestsByStudent<T extends { id?: string; studentId?: string; data?: Record<string, unknown>; documents?: { url?: string }[]; createdAt?: string }>(
  requests: T[]
): T[] {
  const originals: T[] = [];
  const restored: T[] = [];
  const orphans: T[] = [];

  for (const req of requests) {
    if (!req.studentId) {
      orphans.push(req);
      continue;
    }
    if (isRestoredRequestId(req.id)) restored.push(req);
    else originals.push(req);
  }

  const studentsWithOriginal = new Set(originals.map((r) => r.studentId).filter(Boolean));
  const bestRestored = new Map<string, T>();

  for (const req of restored) {
    const sid = req.studentId!;
    if (studentsWithOriginal.has(sid)) continue;
    const existing = bestRestored.get(sid);
    if (!existing || requestKeepScore(req) > requestKeepScore(existing)) {
      bestRestored.set(sid, req);
    }
  }

  return [...originals, ...bestRestored.values(), ...orphans];
}

/** حذف التكرارات من Firestore — لا يمس الطلبات الحقيقية الجديدة أبداً */
export function partitionDuplicateRequests<T extends { id?: string; studentId?: string; data?: Record<string, unknown>; documents?: { url?: string }[]; createdAt?: string }>(
  requests: T[]
): { keepUpdates: { id: string; data: Record<string, unknown> }[]; deleteIds: string[] } {
  const byStudent = new Map<string, T[]>();
  for (const req of requests) {
    if (!req.studentId || !req.id) continue;
    const arr = byStudent.get(req.studentId) || [];
    arr.push(req);
    byStudent.set(req.studentId, arr);
  }

  const keepUpdates: { id: string; data: Record<string, unknown> }[] = [];
  const deleteIds: string[] = [];

  byStudent.forEach((group) => {
    if (group.length <= 1) return;

    const originals = group.filter((r) => !isRestoredRequestId(r.id));
    const restored = group.filter((r) => isRestoredRequestId(r.id));

    if (originals.length > 0) {
      for (const r of restored) {
        if (r.id) deleteIds.push(r.id);
      }
      if (restored.length > 0) {
        const newestOriginal = [...originals].sort(
          (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )[0];
        let merged = { ...((newestOriginal.data || {}) as Record<string, unknown>) };
        for (const r of restored) {
          merged = mergeEnrichedRequestData(merged, (r.data || {}) as Record<string, unknown>);
        }
        if (newestOriginal.id) {
          keepUpdates.push({ id: newestOriginal.id, data: merged });
        }
      }
      return;
    }

    // مستعاد فقط — احتفظ بالأفضل
    const sorted = [...restored].sort((a, b) => requestKeepScore(b) - requestKeepScore(a));
    const winner = sorted[0];
    let merged = { ...((winner.data || {}) as Record<string, unknown>) };
    for (let i = 1; i < sorted.length; i++) {
      merged = mergeEnrichedRequestData(merged, (sorted[i].data || {}) as Record<string, unknown>);
      if (sorted[i].id) deleteIds.push(sorted[i].id!);
    }
    if (winner.id) keepUpdates.push({ id: winner.id, data: merged });
  });

  return { keepUpdates, deleteIds };
}
