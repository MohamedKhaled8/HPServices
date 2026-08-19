import { supabase } from '../config/supabaseClient';
import { db } from '../config/firebase';
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
import { TrainedQA, UnansweredQuestion } from '../types';
import { logger } from '../utils/logger';

const UNANSWERED_TABLE = 'chatbot_unanswered';
const KNOWLEDGE_TABLE = 'chatbot_knowledge';

function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ==========================================
// 1. Data Mappers & Helpers
// ==========================================

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

function mapUnansweredQuestion(row: any): UnansweredQuestion {
  return {
    id: String(row.id),
    question: row.question,
    normalizedQuestion: row.normalized_question || row.question,
    askCount: row.ask_count ?? 1,
    status: row.status || 'pending',
    trainedAnswer: row.trained_answer || undefined,
    firstAskedAt: row.first_asked_at,
    lastAskedAt: row.last_asked_at,
  };
}

function mapTrainedQA(row: any): TrainedQA {
  return {
    id: String(row.id),
    question: row.question,
    answer: row.answer,
    category: row.category || 'عام',
    keywords: Array.isArray(row.keywords) ? row.keywords : [],
    source: row.source || 'manual',
    usageCount: row.usage_count ?? 0,
    isActive: row.is_active !== false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

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

// ==========================================
// 2. Realtime Subscriptions
// ==========================================

export function subscribeToUnansweredQuestions(
  callback: (items: UnansweredQuestion[]) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;

  const fetchSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from(UNANSWERED_TABLE)
        .select('*')
        .eq('status', 'pending')
        .order('last_asked_at', { ascending: false });

      if (error) {
        if (!unsubFirestore) {
          const q = query(collection(db, UNANSWERED_TABLE), where('status', '==', 'pending'));
          unsubFirestore = onSnapshot(q, (snap) => {
            const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }));
            items.sort((a: any, b: any) => getMillis(b.lastAskedAt) - getMillis(a.lastAskedAt));
            callback(items);
          });
        }
        return;
      }

      callback((data || []).map(mapUnansweredQuestion));
    } catch (e) {
      logger.error('Error fetching unanswered from Supabase:', e);
    }
  };

  fetchSupabase();

  const channel = supabase
    .channel('public:chatbot_unanswered')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: UNANSWERED_TABLE },
      () => {
        fetchSupabase();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    if (unsubFirestore) unsubFirestore();
  };
}

export function subscribeToTrainedQAs(
  callback: (items: TrainedQA[]) => void
): () => void {
  let unsubFirestore: (() => void) | null = null;

  const fetchSupabase = async () => {
    try {
      const { data, error } = await supabase
        .from(KNOWLEDGE_TABLE)
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (!unsubFirestore) {
          const q = collection(db, KNOWLEDGE_TABLE);
          unsubFirestore = onSnapshot(q, (snap) => {
            const items = snap.docs.map(docSnap => ({ id: docSnap.id, ...(docSnap.data() as any) }));
            items.sort((a: any, b: any) => getMillis(b.createdAt) - getMillis(a.createdAt));
            callback(items);
          });
        }
        return;
      }

      callback((data || []).map(mapTrainedQA));
    } catch (e) {
      logger.error('Error fetching trained QAs from Supabase:', e);
    }
  };

  fetchSupabase();

  const channel = supabase
    .channel('public:chatbot_knowledge')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: KNOWLEDGE_TABLE },
      () => {
        fetchSupabase();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
    if (unsubFirestore) unsubFirestore();
  };
}

// ==========================================
// 3. Actions & Operations
// ==========================================

export async function logUnansweredQuestion(rawQuestion: string): Promise<void> {
  const cleanQ = rawQuestion.trim();
  if (!cleanQ) return;

  // استخدم النص المنظف إن أمكن، أو النص الخام كمعرّف بديل
  const normalized = normalizeTextForSearch(cleanQ) || cleanQ.toLowerCase();

  try {
    const { data: existingDocs } = await supabase
      .from(UNANSWERED_TABLE)
      .select('id, ask_count')
      .eq('normalized_question', normalized)
      .eq('status', 'pending')
      .limit(1);

    if (existingDocs && existingDocs.length > 0) {
      const d = existingDocs[0];
      await supabase
        .from(UNANSWERED_TABLE)
        .update({
          ask_count: (d.ask_count || 1) + 1,
          last_asked_at: new Date().toISOString(),
          question: cleanQ
        })
        .eq('id', d.id);
    } else {
      await supabase
        .from(UNANSWERED_TABLE)
        .insert({
          question: cleanQ,
          normalized_question: normalized,
          ask_count: 1,
          status: 'pending',
          first_asked_at: new Date().toISOString(),
          last_asked_at: new Date().toISOString()
        });
    }
  } catch (err) {
    logger.error('Error logging unanswered in Supabase:', err);
  }
}

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

  const { data, error } = await supabase
    .from(KNOWLEDGE_TABLE)
    .insert({
      question: cleanQ,
      answer: cleanA,
      category,
      keywords,
      source: 'manual',
      usage_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .select('id')
    .single();

  if (error) {
    logger.error('Error adding trained QA to Supabase:', error);
    throw new Error(error.message || 'فشل حفظ الإجابة');
  }

  return String(data.id);
}

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

  const { error: insertError } = await supabase
    .from(KNOWLEDGE_TABLE)
    .insert({
      question: cleanQ,
      answer: cleanA,
      category,
      keywords,
      source: 'trained_from_unanswered',
      usage_count: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

  if (insertError) {
    logger.error('Error inserting trained QA to Supabase:', insertError);
    throw new Error(insertError.message || 'فشل حفظ الإجابة');
  }

  if (isUUID(unansweredId)) {
    await supabase
      .from(UNANSWERED_TABLE)
      .update({
        status: 'trained',
        trained_answer: cleanA
      })
      .eq('id', unansweredId);
  } else {
    await supabase
      .from(UNANSWERED_TABLE)
      .update({
        status: 'trained',
        trained_answer: cleanA
      })
      .eq('question', question);
  }

  try {
    const qSnap = await getDocs(
      query(collection(db, UNANSWERED_TABLE), where('status', '==', 'pending'))
    );
    qSnap.docs.forEach((docSnap) => {
      const qText = docSnap.data().question || '';
      if (docSnap.id === unansweredId || qText.trim() === cleanQ || normalizeTextForSearch(qText) === normalizeTextForSearch(cleanQ)) {
        updateDoc(doc(db, UNANSWERED_TABLE, docSnap.id), { status: 'trained', trainedAnswer: cleanA });
      }
    });
  } catch (e) {}
}

export async function ignoreUnansweredQuestion(unansweredId: string, rawQuestion?: string): Promise<void> {
  if (isUUID(unansweredId)) {
    await supabase
      .from(UNANSWERED_TABLE)
      .update({ status: 'ignored' })
      .eq('id', unansweredId);
  } else if (rawQuestion) {
    await supabase
      .from(UNANSWERED_TABLE)
      .update({ status: 'ignored' })
      .eq('question', rawQuestion);
  }

  try {
    const docRef = doc(db, UNANSWERED_TABLE, unansweredId);
    await updateDoc(docRef, { status: 'ignored' });
  } catch (e) {
    if (rawQuestion) {
      try {
        const qSnap = await getDocs(query(collection(db, UNANSWERED_TABLE), where('question', '==', rawQuestion)));
        qSnap.docs.forEach((d) => updateDoc(doc(db, UNANSWERED_TABLE, d.id), { status: 'ignored' }));
      } catch (err) {}
    }
  }
}

export async function deleteUnansweredQuestion(unansweredId: string, rawQuestion?: string): Promise<void> {
  if (isUUID(unansweredId)) {
    await supabase
      .from(UNANSWERED_TABLE)
      .delete()
      .eq('id', unansweredId);
  } else if (rawQuestion) {
    await supabase
      .from(UNANSWERED_TABLE)
      .delete()
      .eq('question', rawQuestion);
  }

  try {
    const docRef = doc(db, UNANSWERED_TABLE, unansweredId);
    await deleteDoc(docRef);
  } catch (e) {
    if (rawQuestion) {
      try {
        const qSnap = await getDocs(query(collection(db, UNANSWERED_TABLE), where('question', '==', rawQuestion)));
        qSnap.docs.forEach((d) => deleteDoc(doc(db, UNANSWERED_TABLE, d.id)));
      } catch (err) {}
    }
  }
}

export async function updateTrainedQA(
  id: string,
  updates: Partial<TrainedQA>,
  questionText?: string
): Promise<void> {
  const sbPayload: Record<string, any> = {
    updated_at: new Date().toISOString()
  };

  if (updates.question !== undefined) sbPayload.question = updates.question.trim();
  if (updates.answer !== undefined) sbPayload.answer = updates.answer.trim();
  if (updates.category !== undefined) sbPayload.category = updates.category;
  if (updates.isActive !== undefined) sbPayload.is_active = updates.isActive;
  if (updates.keywords !== undefined) sbPayload.keywords = updates.keywords;
  else if (updates.question) sbPayload.keywords = extractKeywords(updates.question);

  try {
    if (isUUID(id)) {
      await supabase
        .from(KNOWLEDGE_TABLE)
        .update(sbPayload)
        .eq('id', id);
    } else if (questionText) {
      await supabase
        .from(KNOWLEDGE_TABLE)
        .update(sbPayload)
        .eq('question', questionText);
    }
  } catch (err) {
    logger.error('Error updating trained QA in Supabase:', err);
  }

  try {
    const docRef = doc(db, KNOWLEDGE_TABLE, id);
    const payload: Record<string, any> = { ...updates, updatedAt: serverTimestamp() };
    await updateDoc(docRef, payload);
  } catch (e) {
    if (questionText) {
      try {
        const qSnap = await getDocs(query(collection(db, KNOWLEDGE_TABLE), where('question', '==', questionText)));
        qSnap.docs.forEach((d) => updateDoc(doc(db, KNOWLEDGE_TABLE, d.id), updates));
      } catch (err) {}
    }
  }
}

export async function deleteTrainedQA(id: string, questionText?: string): Promise<void> {
  try {
    if (isUUID(id)) {
      await supabase
        .from(KNOWLEDGE_TABLE)
        .delete()
        .eq('id', id);
    } else if (questionText) {
      await supabase
        .from(KNOWLEDGE_TABLE)
        .delete()
        .eq('question', questionText);
    } else {
      await supabase
        .from(KNOWLEDGE_TABLE)
        .delete()
        .eq('id', id);
    }
  } catch (err) {
    logger.error('Error deleting trained QA from Supabase:', err);
  }

  try {
    await deleteDoc(doc(db, KNOWLEDGE_TABLE, id));
  } catch (e) {
    if (questionText) {
      try {
        const qSnap = await getDocs(query(collection(db, KNOWLEDGE_TABLE), where('question', '==', questionText)));
        qSnap.docs.forEach((d) => deleteDoc(doc(db, KNOWLEDGE_TABLE, d.id)));
      } catch (err) {}
    }
  }
}

export async function incrementQAUsage(id: string): Promise<void> {
  if (isUUID(id)) {
    try {
      const { data } = await supabase
        .from(KNOWLEDGE_TABLE)
        .select('usage_count')
        .eq('id', id)
        .maybeSingle();

      if (data) {
        await supabase
          .from(KNOWLEDGE_TABLE)
          .update({ usage_count: (data.usage_count || 0) + 1 })
          .eq('id', id);
      }
    } catch (e) {}
  }

  try {
    await updateDoc(doc(db, KNOWLEDGE_TABLE, id), { usageCount: increment(1) });
  } catch (e) {}
}
