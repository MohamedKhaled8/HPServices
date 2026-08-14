import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageCircle, X, Send, Bot, Sparkles, ShieldAlert } from 'lucide-react';
import {
  buildWelcomeReply,
  buildNewRequestReply,
  buildStatusChangeReply,
  handleAssistantPayload,
  handleFreeText,
  PendingSensitiveAction,
  DtCodeRow,
  EpCodeRow,
  AssistantReply,
  ConversationContext,
  AssistantTurnResult,
  nextConversation,
} from '../../services/assistantEngine';
import { ServiceRequest, StudentData } from '../../types';
import { AssistantMessageBody } from './AssistantMessageRenderer';
import '../../styles/SupportAssistant.css';

type ChatMessage = {
  id: string;
  role: 'user' | 'bot';
  text?: string;
  reply?: AssistantReply;
  showWhatsApp?: boolean;
};

export interface SupportAssistantProps {
  student: StudentData | null;
  serviceRequests: ServiceRequest[];
  dtCodes: DtCodeRow[];
  epCodes: EpCodeRow[];
  onNavigateService?: (serviceId: string) => void;
  onNavigateAssignments?: () => void;
  onNavigateApproved?: () => void;
  onNavigateProfile?: () => void;
}

const SupportAssistant: React.FC<SupportAssistantProps> = ({
  student,
  serviceRequests,
  dtCodes,
  epCodes,
  onNavigateService,
  onNavigateAssignments,
  onNavigateApproved,
  onNavigateProfile,
}) => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState<PendingSensitiveAction>(null);
  const [typing, setTyping] = useState(false);
  const [newActivity, setNewActivity] = useState(0);
  const [conversation, setConversation] = useState<ConversationContext>({});
  const listRef = useRef<HTMLDivElement>(null);
  const welcomedRef = useRef(false);
  const knownRequestIdsRef = useRef<Set<string>>(new Set());
  const knownStatusRef = useRef<Map<string, string>>(new Map());
  const pendingRepliesRef = useRef<AssistantReply[]>([]);
  const bootstrapPendingRef = useRef(true);
  const sawEmptyRequestsRef = useRef(false);

  const ctx = useMemo(
    () => ({ student, requests: serviceRequests, dtCodes, epCodes, conversation }),
    [student, serviceRequests, dtCodes, epCodes, conversation]
  );

  const pendingCount = useMemo(
    () =>
      serviceRequests.filter(
        (r) => r.status !== 'completed' && r.status !== 'rejected'
      ).length,
    [serviceRequests]
  );

  const pushBotReply = useCallback((reply: AssistantReply, showWhatsApp?: boolean) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `b-${Date.now()}-${Math.random()}`,
        role: 'bot',
        reply,
        showWhatsApp,
      },
    ]);
  }, []);

  const pushUser = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text },
    ]);
  }, []);

  const respond = useCallback(
    (fn: () => AssistantTurnResult & { showWhatsApp?: boolean }) => {
      setTyping(true);
      window.setTimeout(() => {
        const result = fn();
        setPending(result.pending);
        if (result.conversation) setConversation(result.conversation);
        pushBotReply(result.reply, result.showWhatsApp);
        setTyping(false);
      }, 350);
    },
    [pushBotReply]
  );

  const applyPayload = useCallback(
    (payload: string) => {
      if (payload.startsWith('nav:service:')) {
        const sid = payload.replace('nav:service:', '');
        onNavigateService?.(sid);
        pushBotReply({ text: '✅ تم توجيهك لصفحة الخدمة.' });
        return;
      }
      if (payload === 'nav:approved') {
        onNavigateApproved?.();
        pushBotReply({ text: '✅ افتح صفحة «الطلبات الموافق عليها» لمراجعة التفاصيل والأكواد.' });
        return;
      }
      if (payload === 'nav:assignments') {
        onNavigateAssignments?.();
        pushBotReply({ text: '✅ تم فتح صفحة التكليفات.' });
        return;
      }
      if (payload === 'nav:profile') {
        onNavigateProfile?.();
        pushBotReply({ text: '✅ تم فتح الملف الشخصي.' });
        return;
      }
      if (payload === 'action:assignments') {
        onNavigateAssignments?.();
      }
      respond(() => {
        const result = handleAssistantPayload(payload, ctx);
        return { ...result, showWhatsApp: payload === 'action:whatsapp' };
      });
    },
    [ctx, onNavigateApproved, onNavigateAssignments, onNavigateProfile, onNavigateService, pushBotReply, respond]
  );

  useEffect(() => {
    if (open && !welcomedRef.current) {
      welcomedRef.current = true;
      setTyping(true);
      window.setTimeout(() => {
        pushBotReply(buildWelcomeReply(student, serviceRequests));
        setTyping(false);
      }, 400);
    }
  }, [open, student, serviceRequests, pushBotReply]);

  const queueReply = useCallback(
    (reply: AssistantReply) => {
      if (open) {
        pushBotReply(reply);
      } else {
        pendingRepliesRef.current.push(reply);
        setNewActivity((n) => n + 1);
      }
    },
    [open, pushBotReply]
  );

  useEffect(() => {
    if (!open) return;
    setNewActivity(0);
    if (pendingRepliesRef.current.length > 0) {
      const queued = [...pendingRepliesRef.current];
      pendingRepliesRef.current = [];
      queued.forEach((reply) => pushBotReply(reply));
    }
  }, [open, pushBotReply]);

  useEffect(() => {
    if (!student?.id) return;

    const notifyOrQueue = (reply: AssistantReply) => queueReply(reply);

    const trackRequest = (req: ServiceRequest) => {
      if (!req.id) return;
      knownRequestIdsRef.current.add(req.id);
      knownStatusRef.current.set(req.id, req.status || 'pending');
    };

    if (bootstrapPendingRef.current) {
      if (serviceRequests.length === 0) {
        sawEmptyRequestsRef.current = true;
        return;
      }

      const unseen = serviceRequests.filter(
        (r) => r.id && !knownRequestIdsRef.current.has(r.id)
      );

      if (sawEmptyRequestsRef.current) {
        unseen.forEach((req) => {
          trackRequest(req);
          notifyOrQueue(buildNewRequestReply(req));
          setConversation((prev) =>
            nextConversation(prev, { matchedServiceId: req.serviceId, requests: serviceRequests })
          );
        });
      } else {
        unseen.forEach(trackRequest);
      }

      bootstrapPendingRef.current = false;
      return;
    }

    const newRequests = serviceRequests.filter(
      (r) => r.id && !knownRequestIdsRef.current.has(r.id)
    );
    newRequests.forEach((req) => {
      trackRequest(req);
      notifyOrQueue(buildNewRequestReply(req));
      setConversation((prev) =>
        nextConversation(prev, { matchedServiceId: req.serviceId, requests: serviceRequests })
      );
    });

    serviceRequests.forEach((req) => {
      if (!req.id || newRequests.some((n) => n.id === req.id)) return;
      const prev = knownStatusRef.current.get(req.id);
      const cur = req.status || 'pending';
      if (prev && prev !== cur) {
        knownStatusRef.current.set(req.id, cur);
        notifyOrQueue(buildStatusChangeReply(req));
        setConversation((c) =>
          nextConversation(c, { matchedServiceId: req.serviceId, requests: serviceRequests })
        );
      }
    });
  }, [serviceRequests, student?.id, queueReply]);

  useEffect(() => {
    if (listRef.current) {
      if (messages.length <= 1) {
        listRef.current.scrollTop = 0;
      } else {
        const lastMsg = listRef.current.querySelector('.sa-msg-row:last-child');
        if (lastMsg) {
          lastMsg.scrollIntoView({ block: 'start', behavior: 'smooth' });
        } else {
          listRef.current.scrollTop = listRef.current.scrollHeight;
        }
      }
    }
  }, [messages, open, typing]);

  const submitText = () => {
    const trimmed = input.trim();
    if (!trimmed || typing) return;
    pushUser(trimmed);
    setInput('');

    respond(() => handleFreeText(trimmed, ctx, pending));
  };

  const resetChat = () => {
    setMessages([]);
    setPending(null);
    setConversation({});
    welcomedRef.current = false;
    welcomedRef.current = true;
    pushBotReply(buildWelcomeReply(student, serviceRequests));
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="sa-fab"
          aria-label="فتح المساعد"
          onClick={() => setOpen(true)}
        >
          <MessageCircle size={26} />
          {(newActivity > 0 || pendingCount > 0) && (
            <span className={`sa-fab-badge ${newActivity > 0 ? 'new' : ''}`}>
              {newActivity > 0 ? '!' : pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </button>
      )}

      {open && (
        <div className="sa-panel" role="dialog" aria-label="مساعد المنصة">
          <div className="sa-header">
            <div className="sa-header-info">
              <div className="sa-avatar">
                <Bot size={20} />
              </div>
              <div>
                <h3>
                  مساعد HP
                  <Sparkles size={14} className="sa-sparkle" />
                </h3>
                <p><span className="sa-status-dot"></span> متصل الآن — كيف يمكنني مساعدتك؟</p>
              </div>
            </div>
            <div className="sa-header-actions">
              <button type="button" className="sa-icon-btn" title="إعادة البداية" onClick={resetChat}>
                ↺
              </button>
              <button type="button" className="sa-icon-btn" aria-label="إغلاق" onClick={() => setOpen(false)}>
                <X size={18} />
              </button>
            </div>
          </div>

          {pending?.type === 'national_id' && (
            <div className="sa-pending-banner">
              <ShieldAlert size={16} />
              <span>مطلوب الرقم القومي (14 رقم) للتحقق قبل عرض البيانات الحساسة</span>
            </div>
          )}

          <div className="sa-messages" ref={listRef}>
            {messages.map((m) => (
              <div key={m.id} className={`sa-msg-row ${m.role}`}>
                {m.role === 'bot' && (
                  <div className="sa-msg-avatar bot">
                    <Bot size={14} />
                  </div>
                )}
                <div className={`sa-bubble ${m.role}`}>
                  {m.role === 'user' && m.text}
                  {m.role === 'bot' && m.reply && (
                    <AssistantMessageBody
                      reply={m.reply}
                      showWhatsApp={m.showWhatsApp}
                      onChip={applyPayload}
                    />
                  )}
                </div>
              </div>
            ))}

            {typing && (
              <div className="sa-msg-row bot">
                <div className="sa-msg-avatar bot">
                  <Bot size={14} />
                </div>
                <div className="sa-bubble bot sa-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          <div className="sa-quick-bar">
            <button type="button" onClick={() => applyPayload('action:faq_main')}>
              الأسئلة الشائعة ❓
            </button>
            <button type="button" onClick={() => applyPayload('action:all_status')}>
              طلباتي 📋
            </button>
            <button type="button" onClick={() => applyPayload('action:services_list')}>
              الخدمات 🌐
            </button>
            <button type="button" onClick={() => applyPayload('action:whatsapp')}>
              واتساب 💬
            </button>
          </div>

          <div className="sa-footer">
            <input
              className="sa-input"
              placeholder={
                pending?.type === 'national_id'
                  ? 'الرقم القومي (14 رقم)...'
                  : 'اسأل عن أي خدمة أو استفسار...'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitText();
              }}
              inputMode={pending?.type === 'national_id' ? 'numeric' : 'text'}
              disabled={typing}
            />
            <button
              type="button"
              className="sa-send"
              aria-label="إرسال"
              onClick={submitText}
              disabled={typing || !input.trim()}
            >
              <Send size={18} />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SupportAssistant;
