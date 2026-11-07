import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../config/firebase';
import { ServiceRequest, StudentData } from '../types';
import { getStudentsByIds, getStudentData } from './firebaseService';
import {
  buildRestoredRequestData,
  mergeEnrichedRequestData,
  isPlaceholderOrderData,
  orderNeedsAutoFix
} from './cloudinaryRestoreService';
import { logger } from '../utils/logger';

export interface RunAutoFixOptions {
  scopeServiceId?: string | null;
  allRequests: ServiceRequest[];
  studentsRef: React.MutableRefObject<Record<string, StudentData>>;
  fixedRequestIdsRef: React.MutableRefObject<Set<string>>;
  setStudents: React.Dispatch<React.SetStateAction<Record<string, StudentData>>>;
  onToast?: (toast: { message: string; type: 'success' | 'error' | 'info'; duration?: number }) => void;
}

/**
 * إصلاح تلقائي: أي طلب اسمه «طالب» يُحدَّث من ملف الطالب — يدوي فقط من تبويب الخدمات
 */
export async function executeAutoFixPlaceholderOrders({
  scopeServiceId,
  allRequests,
  studentsRef,
  fixedRequestIdsRef,
  setStudents,
  onToast
}: RunAutoFixOptions): Promise<number> {
  const pool = scopeServiceId
    ? allRequests.filter((r) => String(r.serviceId) === String(scopeServiceId))
    : allRequests;

  const placeholders = pool.filter(
    (r) => r.id && r.studentId && orderNeedsAutoFix(r) && !fixedRequestIdsRef.current.has(r.id)
  );

  if (placeholders.length === 0) {
    return 0;
  }

  const studentIds = [...new Set(placeholders.map((r) => r.studentId!).filter(Boolean))];
  const studentsMap: Record<string, StudentData> = { ...studentsRef.current };

  const missingIds = studentIds.filter((id) => !studentsMap[id]);
  for (let i = 0; i < missingIds.length; i += 8) {
    const chunk = missingIds.slice(i, i + 8);
    const fetched = await getStudentsByIds(chunk);
    Object.assign(studentsMap, fetched);
    for (const id of chunk) {
      if (studentsMap[id]) continue;
      try {
        const one = await getStudentData(id);
        if (one) studentsMap[id] = one;
      } catch {
        /* quota — retry later */
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }

  if (Object.keys(studentsMap).length > 0) {
    setStudents((current) => ({ ...current, ...studentsMap }));
  }

  let fixed = 0;
  const writeBatch: Promise<void>[] = [];

  for (const req of placeholders) {
    const student = studentsMap[req.studentId!];
    if (!student) continue;

    const serviceId = String(req.serviceId || scopeServiceId || '');
    if (!serviceId || !req.id) continue;

    const merged = mergeEnrichedRequestData(
      (req.data || {}) as Record<string, unknown>,
      buildRestoredRequestData(student as unknown as Record<string, unknown>, serviceId)
    );

    if (isPlaceholderOrderData(merged)) continue;

    writeBatch.push(
      setDoc(
        doc(db, `serviceRequests_${serviceId}`, req.id),
        { data: merged, updatedAt: serverTimestamp() },
        { merge: true }
      ).then(() => {
        fixedRequestIdsRef.current.add(req.id!);
        fixed++;
      })
    );
  }

  for (let i = 0; i < writeBatch.length; i += 12) {
    await Promise.all(writeBatch.slice(i, i + 12));
  }

  if (fixed > 0 && onToast) {
    onToast({
      message: `✅ تم إصلاح ${fixed} طلب تلقائياً (أسماء وأرقام حقيقية)`,
      type: 'success',
      duration: 3500
    });
  }

  return fixed;
}

