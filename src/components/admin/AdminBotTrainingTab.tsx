import React, { useEffect, useState, useMemo } from 'react';
import {
  Brain,
  HelpCircle,
  BookOpen,
  PlusCircle,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  Search,
  Sparkles,
  RefreshCw,
  Send,
  Check,
  Tag,
  Zap
} from 'lucide-react';
import {
  subscribeToUnansweredQuestions,
  subscribeToTrainedQAs,
  trainFromUnanswered,
  ignoreUnansweredQuestion,
  deleteUnansweredQuestion,
  addTrainedQA,
  updateTrainedQA,
  deleteTrainedQA
} from '../../services/chatbotTrainingService';
import { TrainedQA, UnansweredQuestion } from '../../types';
import { logger } from '../../utils/logger';

interface AdminBotTrainingTabProps {
  showAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const CATEGORIES = [
  'عام',
  'التقديم الباقات والرسوم',
  'شهادة التحول الرقمي',
  'الباصات والمواصلات',
  'الأوراق والمتطلبات',
  'المشاريع والتكليفات',
  'النتائج والشهادات',
  'مشاكل الحسابات والدفع'
];

export const AdminBotTrainingTab: React.FC<AdminBotTrainingTabProps> = ({
  showAlert,
  showConfirm
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'knowledge' | 'add'>('pending');
  const [unansweredList, setUnansweredList] = useState<UnansweredQuestion[]>([]);
  const [trainedList, setTrainedList] = useState<TrainedQA[]>([]);
  const [loading, setLoading] = useState(true);

  // حالة الإجابات التي يتم كتابتها تحث كل سؤال غير مجاب
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});

  // حالة البحث والفلترة
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // حالة إضافة سؤال جديد يدوياً
  const [newQuestion, setNewQuestion] = useState('');
  const [newAnswer, setNewAnswer] = useState('');
  const [newCategory, setNewCategory] = useState('عام');
  const [newKeywords, setNewKeywords] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  // حالة تعديل سؤال مدرب
  const [editingQA, setEditingQA] = useState<TrainedQA | null>(null);
  const [editQuestionText, setEditQuestionText] = useState('');
  const [editAnswerText, setEditAnswerText] = useState('');
  const [editCategory, setEditCategory] = useState('عام');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // الاشتراك الحي في البيانات
  useEffect(() => {
    setLoading(true);
    const unsubUnanswered = subscribeToUnansweredQuestions((items) => {
      setUnansweredList(items);
      setLoading(false);
    });

    const unsubTrained = subscribeToTrainedQAs((items) => {
      setTrainedList(items);
    });

    return () => {
      unsubUnanswered();
      unsubTrained();
    };
  }, []);

  // الإحصائيات العلوية
  const totalUsage = useMemo(() => {
    return trainedList.reduce((acc, curr) => acc + (curr.usageCount || 0), 0);
  }, [trainedList]);

  // إجابة سؤال غير مجاب وتدريب البوت
  const handleTrainQuestion = async (item: UnansweredQuestion) => {
    const draftAnswer = (answerDrafts[item.id] || '').trim();
    if (!draftAnswer) {
      showAlert('تنبيه', 'يرجى كتابة إجابة السؤال أولاً قبل الحفظ والتدريب', 'warning');
      return;
    }

    setSubmittingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      await trainFromUnanswered(item.id, item.question, draftAnswer);
      showAlert('تم التدريب 🎯', 'تمت إضافة الإجابة وتدريب الشات بوت بنجاح! وسيرد بها من الآن فصاعداً.', 'success');
      setAnswerDrafts((prev) => {
        const copy = { ...prev };
        delete copy[item.id];
        return copy;
      });
    } catch (error: any) {
      logger.error('Error training question:', error);
      showAlert('خطأ', error.message || 'حدث خطأ أثناء التدريب', 'error');
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  // تجاهل سؤال معلق
  const handleIgnore = async (item: UnansweredQuestion) => {
    try {
      await ignoreUnansweredQuestion(item.id);
      showAlert('تم الاستبعاد', 'تم نقل السؤال إلى قائمة التجاهل.', 'info');
    } catch (error: any) {
      logger.error('Error ignoring question:', error);
      showAlert('خطأ', 'حدث خطأ أثناء الاستبعاد', 'error');
    }
  };

  // حذف سؤال معلق نهائياً
  const handleDeleteUnanswered = async (id: string) => {
    showConfirm('حذف السؤال', 'هل أنت متأكد من حذف هذا السؤال نهائياً؟', async () => {
      try {
        await deleteUnansweredQuestion(id);
        showAlert('تم الحذف', 'تم حذف السؤال من القائمة بنجاح.', 'success');
      } catch (error: any) {
        logger.error('Error deleting unanswered:', error);
        showAlert('خطأ', 'حدث خطأ أثناء الحذف', 'error');
      }
    });
  };

  // إضافة سؤال جديد يدوياً
  const handleAddManualQA = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestion.trim() || !newAnswer.trim()) {
      showAlert('تنبيه', 'يرجى كتابة السؤال والإجابة كلاهما', 'warning');
      return;
    }

    setIsAdding(true);
    try {
      const kwList = newKeywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

      await addTrainedQA(newQuestion, newAnswer, newCategory, kwList);
      showAlert('تم الحفظ 🚀', 'تمت إضافة السؤال والإجابة بنجاح لقاعدة معرفة الشات بوت', 'success');

      setNewQuestion('');
      setNewAnswer('');
      setNewCategory('عام');
      setNewKeywords('');
      setActiveSubTab('knowledge');
    } catch (error: any) {
      logger.error('Error adding manual QA:', error);
      showAlert('خطأ', error.message || 'حدث خطأ أثناء الإضافة', 'error');
    } finally {
      setIsAdding(false);
    }
  };

  // تفعيل / تعطيل سؤال مدرب
  const handleToggleActive = async (item: TrainedQA) => {
    try {
      await updateTrainedQA(item.id, { isActive: !item.isActive });
      showAlert(
        'تم التحديث',
        item.isActive ? 'تم تعطيل هذا السؤال مؤقتاً' : 'تم تفعيل هذا السؤال بنجاح',
        'info'
      );
    } catch (error: any) {
      logger.error('Error toggling active:', error);
      showAlert('خطأ', 'حدث خطأ أثناء تحديث الحالة', 'error');
    }
  };

  // حذف سؤال مدرب
  const handleDeleteTrained = (id: string) => {
    showConfirm('حذف السؤال المدرب', 'هل أنت متأكد من حذف هذا السؤال من قاعدة المعرفة؟ لن يستطيع الشات بوت الرد به بعد الآن.', async () => {
      try {
        await deleteTrainedQA(id);
        showAlert('تم الحذف', 'تم حذف السؤال بنجاح من قاعدة المعرفة', 'success');
      } catch (error: any) {
        logger.error('Error deleting trained QA:', error);
        showAlert('خطأ', 'حدث خطأ أثناء الحذف', 'error');
      }
    });
  };

  // تجهيز مودال التعديل
  const openEditModal = (item: TrainedQA) => {
    setEditingQA(item);
    setEditQuestionText(item.question);
    setEditAnswerText(item.answer);
    setEditCategory(item.category || 'عام');
  };

  const handleSaveEdit = async () => {
    if (!editingQA || !editQuestionText.trim() || !editAnswerText.trim()) return;
    setIsSavingEdit(true);
    try {
      await updateTrainedQA(editingQA.id, {
        question: editQuestionText.trim(),
        answer: editAnswerText.trim(),
        category: editCategory
      });
      showAlert('تم التعديل', 'تمت تحديث الإجابة بنجاح', 'success');
      setEditingQA(null);
    } catch (error: any) {
      logger.error('Error saving edit:', error);
      showAlert('خطأ', 'حدث خطأ أثناء حفظ التعديل', 'error');
    } finally {
      setIsSavingEdit(false);
    }
  };

  // تصفية الأسئلة المدربة حسب البحث والقسم
  const filteredTrainedList = useMemo(() => {
    return trainedList.filter((item) => {
      const matchCat = selectedCategory === 'all' || item.category === selectedCategory;
      const term = searchTerm.trim().toLowerCase();
      const matchSearch =
        !term ||
        item.question.toLowerCase().includes(term) ||
        item.answer.toLowerCase().includes(term) ||
        (item.keywords && item.keywords.some((k) => k.toLowerCase().includes(term)));
      return matchCat && matchSearch;
    });
  }, [trainedList, searchTerm, selectedCategory]);

  return (
    <div className="admin-content">
      {/* الهيدر الرئيسي للميزه */}
      <div className="config-section" style={{ padding: '24px', borderRadius: '16px', background: 'var(--bg-card, #ffffff)' }}>
        <div className="section-header-compact" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
          <div
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px rgba(99, 102, 241, 0.25)',
              color: '#fff'
            }}
          >
            <Brain size={28} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
              مركز تدريب الشات بوت (Bot Training & Knowledge Base)
            </h2>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary, #64748b)', fontSize: '0.9rem' }}>
              درب الشات بوت على الإجابة الذكية، راجع الأسئلة التي تعثر بها الطلاب، وسجل إجابتك ليرد بها فوراً!
            </p>
          </div>
        </div>

        {/* كروت الإحصائيات */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}
        >
          <div
            onClick={() => setActiveSubTab('pending')}
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: activeSubTab === 'pending' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-subtle, #f8fafc)',
              border: `1.5px solid ${activeSubTab === 'pending' ? '#6366f1' : 'var(--border-color, #e2e8f0)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>أسئلة تنتظر التدريب</span>
              <HelpCircle size={20} color="#f59e0b" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#f59e0b' }}>
              {unansweredList.length}
            </div>
          </div>

          <div
            onClick={() => setActiveSubTab('knowledge')}
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: activeSubTab === 'knowledge' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-subtle, #f8fafc)',
              border: `1.5px solid ${activeSubTab === 'knowledge' ? '#6366f1' : 'var(--border-color, #e2e8f0)'}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>الأسئلة والحلول المدربة</span>
              <BookOpen size={20} color="#10b981" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#10b981' }}>
              {trainedList.length}
            </div>
          </div>

          <div
            style={{
              padding: '16px 20px',
              borderRadius: '12px',
              background: 'var(--bg-subtle, #f8fafc)',
              border: '1.5px solid var(--border-color, #e2e8f0)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: 600 }}>إجمالي إجابات البوت</span>
              <Zap size={20} color="#6366f1" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, marginTop: '8px', color: '#6366f1' }}>
              {totalUsage}
            </div>
          </div>
        </div>

        {/* أزرار التنقل الفرعية داخل السيكشن */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '2px solid var(--border-color, #e2e8f0)',
            paddingBottom: '12px',
            marginBottom: '24px'
          }}
        >
          <button
            type="button"
            className={`tab-button ${activeSubTab === 'pending' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('pending')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <HelpCircle size={18} />
            الأسئلة المستلمة (تنتظر التدريب)
            {unansweredList.length > 0 && (
              <span
                style={{
                  background: '#f59e0b',
                  color: '#fff',
                  fontSize: '0.75rem',
                  padding: '2px 8px',
                  borderRadius: '10px',
                  marginRight: '4px'
                }}
              >
                {unansweredList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`tab-button ${activeSubTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('knowledge')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            <BookOpen size={18} />
            قاعدة المعرفة والأسئلة المدربة
          </button>

          <button
            type="button"
            className={`tab-button ${activeSubTab === 'add' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('add')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
              background: activeSubTab === 'add' ? 'var(--primary-color, #4f46e5)' : 'transparent',
              color: activeSubTab === 'add' ? '#fff' : 'inherit'
            }}
          >
            <PlusCircle size={18} />
            إضافة سؤال وإجابة يدوياً
          </button>
        </div>

        {/* ----------------- التبويب الأول: الأسئلة المستلمة غير المجاوبة ----------------- */}
        {activeSubTab === 'pending' && (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: '0 0 4px', fontSize: '1.1rem' }}>📥 الأسئلة التي تعثر البوت في إجابتها</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                هذه الأسئلة تم سؤالها بالفعل من الطلاب في المحادثات وسجل البوت تعثره فيها. اكتب الإجابة المناسبة واضغط "حفظ وتدريب" ليتعلم البوت الرد عليها في المستقبل!
              </p>
            </div>

            {loading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
                <RefreshCw className="spin" size={24} />
                <p>جاري تحميل الأسئلة المستلمة...</p>
              </div>
            ) : unansweredList.length === 0 ? (
              <div
                style={{
                  padding: '48px 24px',
                  textAlign: 'center',
                  background: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color, #cbd5e1)'
                }}
              >
                <CheckCircle2 size={40} color="#10b981" style={{ marginBottom: '12px' }} />
                <h4 style={{ margin: '0 0 6px', fontSize: '1.1rem', color: '#1e293b' }}>ممتاز! لا يوجد أسئلة بانتظار التدريب</h4>
                <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>
                  الشات بوت يجيب على جميع أسئلة الطلاب الحالية بنجاح، أو لم ترد أسئلة جديدة غير معروفة بعد.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {unansweredList.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: '20px',
                      borderRadius: '12px',
                      background: 'var(--bg-card, #ffffff)',
                      border: '1.5px solid var(--border-color, #e2e8f0)',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.03)',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '8px',
                            background: 'rgba(245, 158, 11, 0.12)',
                            color: '#d97706',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700
                          }}
                        >
                          <HelpCircle size={18} />
                        </div>
                        <h4 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--text-primary, #1e293b)', fontWeight: 700 }}>
                          « {item.question} »
                        </h4>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '4px 10px',
                            borderRadius: '20px',
                            background: '#fef3c7',
                            color: '#92400e',
                            fontWeight: 700,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          🔥 وُرِد {item.askCount} مرات
                        </span>
                        <button
                          type="button"
                          onClick={() => handleIgnore(item)}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            background: 'transparent',
                            border: '1px solid #cbd5e1',
                            color: '#64748b',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="تجاهل السؤال"
                        >
                          <XCircle size={14} />
                          تجاهل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteUnanswered(item.id)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                          title="حذف السؤال نهائياً"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* حقل الإجابة المباشر تحت كل سؤال */}
                    <div style={{ marginTop: '12px' }}>
                      <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '6px', color: '#475569' }}>
                        إجابة الشات بوت المعتمدة على هذا السؤال:
                      </label>
                      <textarea
                        className="premium-textarea"
                        rows={2}
                        value={answerDrafts[item.id] || ''}
                        onChange={(e) =>
                          setAnswerDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="اكتب الإجابة الكاملة والتفصيلية التي سيرد بها الشات بوت عند سؤال هذا السؤال مرّة أخرى..."
                        style={{
                          width: '100%',
                          minHeight: '70px',
                          borderRadius: '8px',
                          padding: '10px 12px',
                          border: '1.5px solid var(--border-color, #cbd5e1)',
                          fontSize: '0.9rem',
                          fontFamily: 'inherit'
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
                        <button
                          type="button"
                          className="action-button primary"
                          disabled={submittingIds[item.id]}
                          onClick={() => handleTrainQuestion(item)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '8px 18px',
                            borderRadius: '8px',
                            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                            color: '#fff',
                            fontWeight: 700,
                            fontSize: '0.85rem',
                            border: 'none',
                            cursor: 'pointer',
                            boxShadow: '0 4px 10px rgba(16, 185, 129, 0.25)'
                          }}
                        >
                          {submittingIds[item.id] ? (
                            'جاري حفظ الإجابة...'
                          ) : (
                            <>
                              <Sparkles size={16} />
                              حفظ وتدريب الشات بوت 🚀
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- التبويب الثاني: قاعدة المعرفة الحالية ----------------- */}
        {activeSubTab === 'knowledge' && (
          <div>
            {/* شريط البحث والفلترة */}
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
              <div style={{ flex: '1', minWidth: '240px', position: 'relative' }}>
                <Search size={18} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input
                  type="text"
                  placeholder="ابحث في الأسئلة أو الإجابات أو الكلمات المفتاحية..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color, #cbd5e1)',
                    fontSize: '0.9rem',
                    outline: 'none'
                  }}
                />
              </div>

              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1.5px solid var(--border-color, #cbd5e1)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  background: '#fff'
                }}
              >
                <option value="all">كل الأقسام</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {filteredTrainedList.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'var(--bg-subtle, #f8fafc)',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color, #cbd5e1)'
                }}
              >
                <BookOpen size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <p style={{ color: '#64748b', margin: 0 }}>لا يوجد أسئلة مدربة تطابق فلاتر البحث الحالية.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                {filteredTrainedList.map((qa) => (
                  <div
                    key={qa.id}
                    style={{
                      padding: '18px',
                      borderRadius: '12px',
                      background: qa.isActive !== false ? 'var(--bg-card, #ffffff)' : '#f1f5f9',
                      border: `1.5px solid ${qa.isActive !== false ? 'var(--border-color, #e2e8f0)' : '#cbd5e1'}`,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      opacity: qa.isActive !== false ? 1 : 0.65,
                      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span
                          style={{
                            fontSize: '0.75rem',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            background: '#e0e7ff',
                            color: '#3730a3',
                            fontWeight: 600
                          }}
                        >
                          {qa.category || 'عام'}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
                            🎯 أُجيب بها {qa.usageCount || 0} مرات
                          </span>
                        </div>
                      </div>

                      <h4 style={{ margin: '0 0 8px', fontSize: '1rem', color: '#1e293b', fontWeight: 700 }}>
                        س: {qa.question}
                      </h4>

                      <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#475569', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>
                        ج: {qa.answer}
                      </p>

                      {qa.keywords && qa.keywords.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                          {qa.keywords.map((kw, idx) => (
                            <span
                              key={idx}
                              style={{
                                fontSize: '0.7rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: '#f1f5f9',
                                color: '#64748b',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px'
                              }}
                            >
                              <Tag size={10} />
                              {kw}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '10px', borderTop: '1px solid var(--border-color, #f1f5f9)' }}>
                      <button
                        type="button"
                        onClick={() => handleToggleActive(qa)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: qa.isActive !== false ? '#10b981' : '#64748b',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        {qa.isActive !== false ? <Check size={14} /> : <XCircle size={14} />}
                        {qa.isActive !== false ? 'مفعلة' : 'معطلة'}
                      </button>

                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          type="button"
                          onClick={() => openEditModal(qa)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            border: 'none',
                            color: '#475569',
                            fontSize: '0.8rem',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit3 size={14} />
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTrained(qa.id)}
                          style={{
                            padding: '4px 8px',
                            borderRadius: '6px',
                            background: 'rgba(239, 68, 68, 0.08)',
                            border: 'none',
                            color: '#ef4444',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ----------------- التبويب الثالث: إضافة سؤال جديد يدوياً ----------------- */}
        {activeSubTab === 'add' && (
          <div style={{ maxWidth: '700px', margin: '0 auto' }}>
            <div style={{ marginBottom: '20px', textAlign: 'center' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '1.2rem', color: '#1e293b' }}>➕ إضافة سؤال وإجابة جديدة يدوياً</h3>
              <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                يمكنك تدريب الشات بوت مسبقاً على أي أسئلة متوقعة لإثراء قاعدة معرفة البوت.
              </p>
            </div>

            <form onSubmit={handleAddManualQA} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: '#334155' }}>
                  السؤال المكتوب من الطالب:
                </label>
                <input
                  type="text"
                  required
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="مثال: كم تبلغ رسوم شحن التكليفات إلى الجيزة؟"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color, #cbd5e1)',
                    fontSize: '0.95rem',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: '#334155' }}>
                  الإجابة النموذجية المعتمدة للشات بوت:
                </label>
                <textarea
                  required
                  rows={4}
                  value={newAnswer}
                  onChange={(e) => setNewAnswer(e.target.value)}
                  placeholder="اكتب الإجابة التفصيلية بكل وضوح..."
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1.5px solid var(--border-color, #cbd5e1)',
                    fontSize: '0.95rem',
                    outline: 'none',
                    lineHeight: '1.6',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: '#334155' }}>
                    القسم / التصنيف:
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.9rem',
                      outline: 'none',
                      background: '#fff'
                    }}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '6px', color: '#334155' }}>
                    كلمات مفتاحية (اختياري - مفصولة بفاصلة):
                  </label>
                  <input
                    type="text"
                    value={newKeywords}
                    onChange={(e) => setNewKeywords(e.target.value)}
                    placeholder="مثال: رسوم, شحن, الجيزة"
                    style={{
                      width: '100%',
                      padding: '11px 14px',
                      borderRadius: '8px',
                      border: '1.5px solid var(--border-color, #cbd5e1)',
                      fontSize: '0.9rem',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <button
                  type="submit"
                  disabled={isAdding}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '8px',
                    background: 'linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1rem',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  {isAdding ? (
                    'جاري الحفظ...'
                  ) : (
                    <>
                      <Sparkles size={18} />
                      حفظ السؤال وتدريب البوت الآن
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* ----------------- مودال التعديل ----------------- */}
      {editingQA && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px'
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: '16px',
              maxWidth: '600px',
              width: '100%',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '1.15rem' }}>تعديل السؤال والحل المدرب</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>السؤال:</label>
                <input
                  type="text"
                  value={editQuestionText}
                  onChange={(e) => setEditQuestionText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>الإجابة:</label>
                <textarea
                  rows={4}
                  value={editAnswerText}
                  onChange={(e) => setEditAnswerText(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '4px' }}>القسم:</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.9rem',
                    background: '#fff'
                  }}
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setEditingQA(null)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  background: '#f1f5f9',
                  border: 'none',
                  color: '#475569',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                إلغاء
              </button>

              <button
                type="button"
                disabled={isSavingEdit}
                onClick={handleSaveEdit}
                style={{
                  padding: '8px 20px',
                  borderRadius: '8px',
                  background: '#4f46e5',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                {isSavingEdit ? 'جاري الحفظ...' : 'حفظ التعديلات'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBotTrainingTab;
