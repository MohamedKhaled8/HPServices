import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  increment
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { TrainedQA, UnansweredQuestion } from '../types';
import { logger } from '../utils/logger';

const UNANSWERED_COLLECTION = 'chatbot_unanswered';
const KNOWLEDGE_COLLECTION = 'chatbot_knowledge';

/**
 * تحويل أية قيمة تاريخ إلى مللي ثانية لترتيب آمن
 */
function getMillis(val: any): number {
  if (!val) return 0;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    return isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

/**
 * تبسيط النص وتنظيفه للمطابقة وقياس التكرار
 */
export function normalizeTextForSearch(text: string): string {
  if (!text) return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u0652]/g, '') // remove Arabic diacritics
    .replace(/[^\w\s\u0600-\u06FF]/g, '') // remove punctuation
    .replace(/\s+/g, ' ');
}

/**
 * استخراج كلمات مفتاحية تلقائياً من السؤال
 */
export function extractKeywords(text: string): string[] {
  const norm = normalizeTextForSearch(text);
  const stopWords = new Set([
    'في', 'من', 'على', 'عن', 'إلى', 'الي', 'مع', 'هل', 'كيف', 'ما', 'ماذا', 'متى',
    'اين', 'أين', 'كام', 'بكم', 'لو', 'سمحت', 'اريد', 'أريد', 'عايز', 'عاوز',
    'ممكن', 'هو', 'هي', 'أن', 'ان', 'لا', 'يا', 'مستند', 'طلب'
  ]);
  return norm
    .split(' ')
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

/**
 * تسجيل أو تجميع السؤال غير المجاوب في Firestore
 */
export async function logUnansweredQuestion(rawQuestion: string): Promise<void> {
  const cleanQ = rawQuestion.trim();
  if (!cleanQ || cleanQ.length < 3) return;

  const normalized = normalizeTextForSearch(cleanQ);
  if (!normalized) return;

  try {
    // البحث أولاً عما إذا كان نفس السؤال المسبق موجوداً وحالته pending
    const qSnap = await getDocs(
      query(
        collection(db, UNANSWERED_COLLECTION),
        where('normalizedQuestion', '==', normalized)
      )
    );

    const pendingDoc = qSnap.docs.find((d) => d.data().status === 'pending');

    if (pendingDoc) {
      // تعديل العداد وتاريخ آخر ورود للسؤال
      await updateDoc(doc(db, UNANSWERED_COLLECTION, pendingDoc.id), {
        askCount: increment(1),
        lastAskedAt: serverTimestamp(),
        question: cleanQ
      });
    } else {
      // إضافة جديد
      await addDoc(collection(db, UNANSWERED_COLLECTION), {
        question: cleanQ,
        normalizedQuestion: normalized,
        askCount: 1,
        status: 'pending',
        firstAskedAt: serverTimestamp(),
        lastAskedAt: serverTimestamp()
      });
    }
  } catch (error) {
    logger.error('Error logging unanswered question:', error);
  }
}

/**
 * الاستماع الحي لقائمة الأسئلة المعلقة
 */
export function subscribeToUnansweredQuestions(
  callback: (items: UnansweredQuestion[]) => void
): () => void {
  const q = query(
    collection(db, UNANSWERED_COLLECTION),
    where('status', '==', 'pending')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const items: UnansweredQuestion[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<UnansweredQuestion, 'id'>)
      }));
      // الترتيب محلي بـ JavaScript لمنع أخطاء الفهارس والـ assertions
      items.sort((a, b) => getMillis(b.lastAskedAt) - getMillis(a.lastAskedAt));
      callback(items);
    },
    (error) => {
      logger.error('Error listening to unanswered questions:', error);
      callback([]);
    }
  );
}

/**
 * الاستماع الحي لقائمة الأسئلة والحلول المدربة
 */
export function subscribeToTrainedQAs(
  callback: (items: TrainedQA[]) => void
): () => void {
  const q = collection(db, KNOWLEDGE_COLLECTION);

  return onSnapshot(
    q,
    (snapshot) => {
      const items: TrainedQA[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<TrainedQA, 'id'>)
      }));
      // الترتيب محلي بـ JavaScript
      items.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
      callback(items);
    },
    (error) => {
      logger.error('Error listening to trained QAs:', error);
      callback([]);
    }
  );
}

/**
 * إضافة سؤال وإجابة يدوياً إلى قاعدة المعرفة
 */
export async function addTrainedQA(
  question: string,
  answer: string,
  category = 'عام',
  customKeywords?: string[]
): Promise<string> {
  const cleanQ = question.trim();
  const cleanA = answer.trim();

  if (!cleanQ || !cleanA) {
    throw new Error('السؤال والإجابة مطلوبان');
  }

  const keywords = customKeywords && customKeywords.length > 0
    ? customKeywords
    : extractKeywords(cleanQ);

  const docRef = await addDoc(collection(db, KNOWLEDGE_COLLECTION), {
    question: cleanQ,
    answer: cleanA,
    category,
    keywords,
    source: 'manual',
    usageCount: 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  return docRef.id;
}

/**
 * الإجابة على سؤال معلق وتدريب الشات بوت عليه
 */
export async function trainFromUnanswered(
  unansweredId: string,
  question: string,
  answer: string,
  category = 'عام'
): Promise<void> {
  const cleanQ = question.trim();
  const cleanA = answer.trim();

  if (!cleanQ || !cleanA) {
    throw new Error('يرجى كتابة الإجابة قبل الاعتماد');
  }

  const keywords = extractKeywords(cleanQ);

  // 1. إضافة إلى قاعدة المعرفة
  await addDoc(collection(db, KNOWLEDGE_COLLECTION), {
    question: cleanQ,
    answer: cleanA,
    category,
    keywords,
    source: 'trained_from_unanswered',
    usageCount: 0,
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 2. تحديث حالة السؤال المعلق إلى trained
  await updateDoc(doc(db, UNANSWERED_COLLECTION, unansweredId), {
    status: 'trained',
    trainedAnswer: cleanA
  });
}

/**
 * تجاهل / استبعاد سؤال معلق
 */
export async function ignoreUnansweredQuestion(unansweredId: string): Promise<void> {
  await updateDoc(doc(db, UNANSWERED_COLLECTION, unansweredId), {
    status: 'ignored'
  });
}

/**
 * حذف سؤال معلق نهائياً
 */
export async function deleteUnansweredQuestion(unansweredId: string): Promise<void> {
  await deleteDoc(doc(db, UNANSWERED_COLLECTION, unansweredId));
}

/**
 * تحديث سؤال مدرب
 */
export async function updateTrainedQA(
  id: string,
  updates: Partial<TrainedQA>
): Promise<void> {
  const payload: Record<string, any> = {
    ...updates,
    updatedAt: serverTimestamp()
  };
  if (updates.question) {
    payload.keywords = updates.keywords || extractKeywords(updates.question);
  }
  await updateDoc(doc(db, KNOWLEDGE_COLLECTION, id), payload);
}

/**
 * حذف سؤال مدرب
 */
export async function deleteTrainedQA(id: string): Promise<void> {
  await deleteDoc(doc(db, KNOWLEDGE_COLLECTION, id));
}

/**
 * زيادة عداد استخدام إجابة مدربة
 */
export async function incrementQAUsage(id: string): Promise<void> {
  try {
    await updateDoc(doc(db, KNOWLEDGE_COLLECTION, id), {
      usageCount: increment(1)
    });
  } catch (error) {
    logger.error('Error incrementing QA usage:', error);
  }
}
