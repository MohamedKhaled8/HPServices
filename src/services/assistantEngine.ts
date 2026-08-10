import { SERVICES } from '../constants/services';
import {
  ServiceRequest,
  ServiceRequestWorkflowStatus,
  StudentData,
} from '../types';

export type StatusBadgeVariant = ServiceRequestWorkflowStatus;

export type AssistantChip = {
  id: string;
  label: string;
  payload: string;
  variant?: 'primary' | 'secondary' | 'success' | 'outline';
};

export type AssistantDetailRow = {
  label: string;
  value: string;
  highlight?: boolean;
};

export type AssistantRequestCard = {
  serviceId: string;
  serviceName: string;
  serviceColor: string;
  requestId?: string;
  status: StatusBadgeVariant;
  statusLabel: string;
  date: string;
  rows: AssistantDetailRow[];
  codes?: { fawry?: string; orderNumber?: string };
  note?: string;
};

export type AssistantReply = {
  text?: string;
  cards?: AssistantRequestCard[];
  summary?: { total: number; completed: number; pending: number };
  sections?: { title: string; items: string[] }[];
  chips?: AssistantChip[];
  chipGroups?: { title: string; chips: AssistantChip[] }[];
};

export type DtCodeRow = {
  requestId?: string;
  fawryCode?: string;
  serialNumber?: string;
};

export type EpCodeRow = {
  requestId?: string;
  orderNumber?: string;
};

export type PendingSensitiveAction =
  | { type: 'national_id'; intent: 'fawry' | 'order_number'; requestId: string }
  | null;

export type ConversationContext = {
  lastServiceId?: string;
  lastRequestId?: string;
};

export type AssistantContext = {
  student: StudentData | null;
  requests: ServiceRequest[];
  dtCodes: DtCodeRow[];
  epCodes: EpCodeRow[];
  conversation?: ConversationContext;
};

export type AssistantTurnResult = {
  reply: AssistantReply;
  pending: PendingSensitiveAction;
  conversation?: ConversationContext;
};

const normalizeWorkflowStatus = (s: string | undefined): ServiceRequestWorkflowStatus => {
  const v = (s || '').toLowerCase();
  if (v === 'submitted' || v === 'receipt_sent' || v === 'completed' || v === 'rejected') return v;
  return 'pending';
};

export const workflowStatusLabelAr = (s: string | undefined): string => {
  switch (normalizeWorkflowStatus(s)) {
    case 'pending':
      return 'قيد الانتظار';
    case 'submitted':
      return 'تم التقديم';
    case 'receipt_sent':
      return 'تم إرسال الإيصال';
    case 'completed':
      return 'تمت الموافقة';
    case 'rejected':
      return 'مرفوض';
    default:
      return 'قيد الانتظار';
  }
};

export const normalizeNationalId = (value: string): string => value.replace(/\D/g, '');

export const serviceNameAr = (serviceId: string): string =>
  SERVICES.find((s) => s.id === serviceId)?.nameAr || `خدمة رقم ${serviceId}`;

export const serviceColor = (serviceId: string): string =>
  SERVICES.find((s) => s.id === serviceId)?.color || '#2563eb';

const formatDateAr = (iso?: string): string => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
};

const formatPrice = (raw: unknown): string => {
  const n =
    typeof raw === 'number'
      ? raw
      : parseFloat(String(raw).replace(/[^0-9.]/g, '')) || 0;
  return n.toLocaleString('ar-EG');
};

const skipValue = (v: unknown): boolean => {
  if (v == null || v === '') return true;
  const s = String(v).trim();
  return s.startsWith('اختر');
};

const maskNationalId = (id: string): string => {
  const n = normalizeNationalId(id);
  if (n.length < 4) return '****';
  return `**********${n.slice(-4)}`;
};

export const sortRequestsNewestFirst = (requests: ServiceRequest[]): ServiceRequest[] =>
  [...requests].sort((a, b) => {
    const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return tb - ta;
  });

export const requestsForService = (requests: ServiceRequest[], serviceId: string): ServiceRequest[] =>
  sortRequestsNewestFirst(requests.filter((r) => r.serviceId === serviceId));

export const distinctServiceIdsFromRequests = (requests: ServiceRequest[]): string[] =>
  sortRequestsNewestFirst(requests)
    .map((r) => r.serviceId)
    .filter((id, i, arr) => arr.indexOf(id) === i);

export const nationalIdMatchesStudentOrRequest = (
  student: StudentData | null,
  request: ServiceRequest,
  inputNationalId: string
): boolean => {
  const normalized = normalizeNationalId(inputNationalId);
  if (normalized.length !== 14) return false;
  const profileId = normalizeNationalId(student?.nationalID || '');
  if (profileId && profileId === normalized) return true;
  const fromData =
    request.data?.national_id || request.data?.nationalID || request.data?.nationalId || '';
  return normalizeNationalId(String(fromData)) === normalized;
};

export function findDtCodeForRequest(codes: DtCodeRow[], requestId?: string): DtCodeRow | undefined {
  if (!requestId) return undefined;
  return (
    codes.find((c) => c.requestId === requestId && (c.fawryCode || c.serialNumber)) ||
    codes.find((c) => c.requestId === requestId)
  );
}

export function findEpCodeForRequest(codes: EpCodeRow[], requestId?: string): EpCodeRow | undefined {
  if (!requestId) return undefined;
  return (
    codes.find((c) => c.requestId === requestId && c.orderNumber) ||
    codes.find((c) => c.requestId === requestId)
  );
}

export function filterCodesForStudentRequests(
  dtCodes: DtCodeRow[],
  epCodes: EpCodeRow[],
  requests: ServiceRequest[]
): { dt: DtCodeRow[]; ep: EpCodeRow[] } {
  const ids = new Set(requests.map((r) => r.id).filter(Boolean) as string[]);
  return {
    dt: dtCodes.filter((c) => c.requestId && ids.has(c.requestId)),
    ep: epCodes.filter((c) => c.requestId && ids.has(c.requestId)),
  };
}

function computeSummary(requests: ServiceRequest[]) {
  let completed = 0;
  let pending = 0;
  for (const r of requests) {
    const st = normalizeWorkflowStatus(r.status);
    if (st === 'completed') completed++;
    else if (st !== 'rejected') pending++;
  }
  return { total: requests.length, completed, pending };
}

function extractHighlightRows(request: ServiceRequest): AssistantDetailRow[] {
  const d = request.data || {};
  const rows: AssistantDetailRow[] = [];

  const name =
    d.full_name_arabic || d.full_name || studentNameFromData(d);
  if (name) rows.push({ label: 'الاسم', value: String(name) });

  const nid = d.national_id || d.nationalID;
  if (nid) rows.push({ label: 'الرقم القومي', value: maskNationalId(String(nid)) });

  if (!skipValue(d.diploma_type)) rows.push({ label: 'نوع الدبلومة', value: String(d.diploma_type) });
  if (!skipValue(d.diploma_year)) rows.push({ label: 'سنة الدبلومة', value: String(d.diploma_year) });

  const track = d.track || d.track_category || d.track_name;
  if (!skipValue(track)) rows.push({ label: 'المسار', value: String(track) });

  if (!skipValue(d.transformation_type)) {
    rows.push({ label: 'نوع التحول', value: String(d.transformation_type) });
  }
  if (d.number_of_copies) rows.push({ label: 'عدد النسخ', value: String(d.number_of_copies) });
  if (d.phone_whatsapp || d.whatsapp_number) {
    rows.push({ label: 'واتساب', value: String(d.phone_whatsapp || d.whatsapp_number) });
  }
  if (request.paymentMethod) rows.push({ label: 'طريقة الدفع', value: request.paymentMethod });

  const price = d.totalPrice ?? d.price ?? d.amount;
  if (price) {
    rows.push({ label: 'المبلغ', value: `${formatPrice(price)} ج.م`, highlight: true });
  }

  if (d.address_details) {
    const addr = String(d.address_details);
    rows.push({
      label: 'العنوان',
      value: addr.length > 60 ? `${addr.slice(0, 60)}…` : addr,
    });
  } else if (d.address && typeof d.address === 'string') {
    rows.push({ label: 'العنوان', value: d.address });
  }

  return rows.slice(0, 8);
}

function studentNameFromData(d: Record<string, unknown>): string | undefined {
  return (d.fullNameArabic as string) || undefined;
}

export function buildRequestCard(
  request: ServiceRequest,
  dtCodes: DtCodeRow[],
  epCodes: EpCodeRow[],
  options?: { includeCodes?: boolean; note?: string }
): AssistantRequestCard {
  const st = normalizeWorkflowStatus(request.status);
  const dt = findDtCodeForRequest(dtCodes, request.id);
  const ep = findEpCodeForRequest(epCodes, request.id);

  let note = options?.note;
  if (!note) {
    if (st === 'completed') note = 'تمت الموافقة على طلبك. يمكنك مراجعة التفاصيل في «الطلبات الموافق عليها».';
    else if (st === 'rejected') note = 'تم رفض الطلب. للاستفسار تواصل مع الدعم عبر واتساب.';
    else if (st === 'receipt_sent') note = 'تم استلام إيصال الدفع وجاري مراجعته من الإدارة.';
    else if (st === 'submitted') note = 'تم تقديم الطلب بنجاح وجاري المعالجة.';
    else note = 'الطلب في قائمة انتظار المراجعة.';
  }

  return {
    serviceId: request.serviceId,
    serviceName: serviceNameAr(request.serviceId),
    serviceColor: serviceColor(request.serviceId),
    requestId: request.id,
    status: st,
    statusLabel: workflowStatusLabelAr(request.status),
    date: formatDateAr(request.createdAt),
    rows: extractHighlightRows(request),
    codes:
      options?.includeCodes !== false
        ? {
            fawry: dt?.fawryCode || dt?.serialNumber || undefined,
            orderNumber: ep?.orderNumber || undefined,
          }
        : undefined,
    note,
  };
}

function welcomeChipGroups(requests: ServiceRequest[]): AssistantReply['chipGroups'] {
  const distinct = distinctServiceIdsFromRequests(requests);
  const groups: NonNullable<AssistantReply['chipGroups']> = [];

  if (distinct.length > 0) {
    groups.push({
      title: 'خدماتك',
      chips: distinct.map((sid) => ({
        id: `svc-${sid}`,
        label: serviceNameAr(sid),
        payload: `service:${sid}:status`,
        variant: 'primary' as const,
      })),
    });
  }

  groups.push({
    title: 'سريع',
    chips: [
      { id: 'all', label: 'كل طلباتي', payload: 'action:all_status', variant: 'outline' },
      { id: 'browse', label: 'كل خدمات المنصة', payload: 'action:services_list', variant: 'outline' },
      { id: 'human', label: 'واتساب', payload: 'action:whatsapp', variant: 'secondary' },
    ],
  });

  return groups;
}

function simpleWelcomeChips(requests: ServiceRequest[]): AssistantChip[] {
  const distinct = distinctServiceIdsFromRequests(requests);
  const chips: AssistantChip[] = [];

  if (requests.length > 0) {
    chips.push({ id: 'all', label: 'كل طلباتي', payload: 'action:all_status', variant: 'primary' });
    distinct.forEach((sid) => {
      chips.push({
        id: `svc-${sid}`,
        label: serviceNameAr(sid),
        payload: `service:${sid}:status`,
        variant: 'outline',
      });
    });
  } else {
    chips.push({ id: 'browse', label: 'كل الخدمات', payload: 'action:services_list', variant: 'primary' });
  }

  chips.push({ id: 'human', label: 'واتساب', payload: 'action:whatsapp', variant: 'secondary' });
  return chips;
}

const SERVICE_TEXT_ALIASES: { id: string; patterns: RegExp[] }[] = [
  { id: '1', patterns: [/سجل بيانات/, /بياناتي/, /تسجيل/] },
  { id: '2', patterns: [/vip/, /مميز/, /عميل مميز/] },
  { id: '3', patterns: [/كتب/, /شحن/, /مكتبة/] },
  { id: '4', patterns: [/مصروف/, /مصاريف/, /رسوم/] },
  { id: '5', patterns: [/تكليف/, /واجب/, /assignment/] },
  { id: '6', patterns: [/شهاد.*اون/, /شهاد.*أون/, /certificate/] },
  { id: '7', patterns: [/تحول رقم/, /رقمي/, /فوري/, /digital/] },
  { id: '8', patterns: [/مراجعة/, /مراجعه/] },
  { id: '9', patterns: [/مشروع/, /تخرج/] },
  { id: '10', patterns: [/استخراج.*تخرج/, /شهادة تخرج/] },
  { id: '11', patterns: [/استلام.*تحول/, /شحن.*تحول/] },
  { id: '12', patterns: [/استخراج بيانات/, /ocr/, /مسح/] },
];

export function matchServiceFromText(text: string): string | null {
  const t = text.trim().toLowerCase().replace(/\s+/g, ' ');

  for (const service of SERVICES) {
    const name = service.nameAr.toLowerCase();
    if (t.includes(name)) return service.id;
    const words = name.split(/\s+/).filter((w) => w.length > 3);
    const hits = words.filter((w) => t.includes(w));
    if (words.length >= 2 && hits.length >= 2) return service.id;
    if (words.length === 1 && hits.length === 1) return service.id;
  }

  for (const { id, patterns } of SERVICE_TEXT_ALIASES) {
    if (patterns.some((p) => p.test(t))) return id;
  }

  return null;
}

export function nextConversation(
  prev: ConversationContext | undefined,
  opts: {
    payload?: string;
    requests?: ServiceRequest[];
    pending?: PendingSensitiveAction;
    matchedServiceId?: string | null;
  }
): ConversationContext {
  const next: ConversationContext = { ...(prev || {}) };

  if (opts.pending?.type === 'national_id') {
    const req = opts.requests?.find((r) => r.id === opts.pending!.requestId);
    next.lastRequestId = opts.pending.requestId;
    if (req) next.lastServiceId = req.serviceId;
    return next;
  }

  if (opts.matchedServiceId) {
    next.lastServiceId = opts.matchedServiceId;
    return next;
  }

  if (opts.payload) {
    const sm = opts.payload.match(/^service:(\d+):/);
    if (sm) {
      next.lastServiceId = sm[1];
      return next;
    }
    const rm = opts.payload.match(/^request:([^:]+):/);
    if (rm) {
      next.lastRequestId = rm[1];
      const req = opts.requests?.find((r) => r.id === rm[1]);
      if (req) next.lastServiceId = req.serviceId;
      return next;
    }
  }

  return next;
}

function wrapTurn(
  reply: AssistantReply,
  pending: PendingSensitiveAction,
  ctx: AssistantContext,
  opts?: { payload?: string; matchedServiceId?: string | null }
): AssistantTurnResult {
  return {
    reply,
    pending,
    conversation: nextConversation(ctx.conversation, {
      payload: opts?.payload,
      requests: ctx.requests,
      pending,
      matchedServiceId: opts?.matchedServiceId,
    }),
  };
}

export function isGreetingText(text: string): boolean {
  const cleaned = text.trim().toLowerCase().replace(/[!؟?.,،]/g, '');
  if (
    /^(اهلا|أهلا|اهلاً|أهلاً|هلا|هلاً|مرحبا|مرحباً|السلام عليكم|سلام عليكم|سلام|صباح الخير|مساء الخير|هاي|hi|hello|hey|yo)$/.test(
      cleaned
    )
  ) {
    return true;
  }
  return /^(اهلا|أهلا|هلا|مرحبا|سلام)\b/.test(cleaned);
}

export function buildGreetingReply(
  student: StudentData | null,
  requests: ServiceRequest[]
): AssistantReply {
  const firstName = (student?.fullNameArabic || 'صديقي').split(/\s+/)[0];
  const hint = requests.length > 0 ? 'عايز تعرف حالة طلبك؟' : 'عايز تعرف عن الخدمات؟';

  return {
    text: `أهلاً **${firstName}**! 😊\n\n${hint}\n\nاكتب زي ما بتحكي — هفهمك:`,
    chipGroups: welcomeChipGroups(requests),
  };
}

export function buildNewRequestReply(request: ServiceRequest): AssistantReply {
  const name = serviceNameAr(request.serviceId);
  return {
    text:
      `✅ **تم تقديم طلبك!**\n\n` +
      `**${name}**\n\n` +
      `تقدر تسألني: «حالة ${name}» أو «اتقبلت؟»`,
    cards: [
      buildRequestCard(request, [], [], {
        includeCodes: false,
        note: 'تم استلام طلبك — هنبلّغك لما الحالة تتغير.',
      }),
    ],
    chips: [
      { id: 'st', label: 'حالة الطلب', payload: `service:${request.serviceId}:status`, variant: 'primary' },
      { id: 'ok', label: 'تمام', payload: 'action:welcome', variant: 'outline' },
    ],
  };
}

export function buildStatusChangeReply(request: ServiceRequest): AssistantReply {
  const name = serviceNameAr(request.serviceId);
  const status = workflowStatusLabelAr(request.status);

  if (request.status === 'completed') {
    return {
      text: `🎉 **تمت الموافقة!**\n\n**${name}**`,
      cards: [buildRequestCard(request, [], [], { includeCodes: false })],
      chips: [
        { id: 'st', label: 'التفاصيل', payload: `service:${request.serviceId}:status`, variant: 'primary' },
        { id: 'appr', label: 'الموافق عليها', payload: 'nav:approved', variant: 'success' },
      ],
    };
  }

  if (request.status === 'rejected') {
    return {
      text: `❌ **تم رفض الطلب**\n\n**${name}** — تواصل واتساب لو محتاج توضيح.`,
      chips: [
        { id: 'wa', label: 'واتساب', payload: 'action:whatsapp', variant: 'secondary' },
        { id: 'st', label: 'التفاصيل', payload: `service:${request.serviceId}:status`, variant: 'outline' },
      ],
    };
  }

  return {
    text: `📢 **تحديث على طلبك**\n\n**${name}**\n\nالحالة الآن: **${status}**`,
    chips: [
      { id: 'st', label: 'حالة الطلب', payload: `service:${request.serviceId}:status`, variant: 'primary' },
    ],
  };
}

export function buildWelcomeReply(student: StudentData | null, requests: ServiceRequest[]): AssistantReply {
  const firstName = (student?.fullNameArabic || 'صديقي').split(/\s+/)[0];

  if (requests.length === 0) {
    return {
      text:
        `أهلاً **${firstName}** 👋\n\n` +
        `أنا مساعدك — اتكلم عادي زي الواتساب، واسأل عن أي خدمة.`,
      chipGroups: welcomeChipGroups(requests),
    };
  }

  return {
    text:
      `أهلاً **${firstName}** 👋\n\n` +
      `اتكلم عادي — «حالة مصروفاتي»، «اتقبلت؟»، «كود فوري»…\n\n` +
      `أو اختار خدمتك من تحت 👇`,
    chipGroups: welcomeChipGroups(requests),
  };
}

function chipsForService(serviceId: string): AssistantChip[] {
  const chips: AssistantChip[] = [
    { id: 'st', label: 'حالة الطلب', payload: `service:${serviceId}:status`, variant: 'primary' },
  ];
  if (serviceId === '7') {
    chips.push({ id: 'fw', label: 'كود فوري', payload: `service:${serviceId}:fawry`, variant: 'success' });
  }
  if (serviceId === '4') {
    chips.push({ id: 'ord', label: 'رقم الطلب', payload: `service:${serviceId}:order`, variant: 'success' });
  }
  chips.push({ id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' });
  return chips;
}

function pickRequestChips(list: ServiceRequest[], intent: string, serviceId: string): AssistantReply {
  const chips: AssistantChip[] = list.slice(0, 5).map((r, i) => ({
    id: `req-${r.id}`,
    label: `${formatDateAr(r.createdAt)}${list.length > 1 ? ` (#${i + 1})` : ''}`,
    payload: `request:${r.id}:${intent}`,
    variant: 'primary' as const,
  }));
  chips.push({ id: 'back', label: 'رجوع', payload: `service:${serviceId}:menu`, variant: 'outline' });
  return {
    text: `لديك **${list.length}** طلب على **${serviceNameAr(serviceId)}**. اختر الطلب المطلوب:`,
    chips,
  };
}

export function handleAssistantPayload(
  payload: string,
  ctx: AssistantContext
): AssistantTurnResult {
  const result = dispatchAssistantPayload(payload, ctx);
  return wrapTurn(result.reply, result.pending, ctx, { payload });
}

function dispatchAssistantPayload(
  payload: string,
  ctx: AssistantContext
): { reply: AssistantReply; pending: PendingSensitiveAction } {
  const { student, requests, dtCodes, epCodes } = ctx;

  if (payload === 'action:welcome') {
    return { reply: buildWelcomeReply(student, requests), pending: null };
  }

  if (payload === 'action:all_status') {
    if (requests.length === 0) {
      return { reply: buildWelcomeReply(student, requests), pending: null };
    }
    return {
      reply: {
        text: '**ملخص شامل لكل طلباتك:**',
        summary: computeSummary(requests),
        cards: sortRequestsNewestFirst(requests).map((r) =>
          buildRequestCard(r, dtCodes, epCodes, { includeCodes: true })
        ),
        chips: [
          { id: 'back', label: 'رجوع للقائمة', payload: 'action:welcome', variant: 'outline' },
        ],
      },
      pending: null,
    };
  }

  if (payload === 'action:services_list') {
    const platformServices = SERVICES.filter((s) => s.id !== '12');
    const userServiceIds = new Set(distinctServiceIdsFromRequests(requests));
    return {
      reply: {
        text: '**كل خدمات المنصة** — اختار اللي محتاجها:',
        chipGroups: [
          {
            title: 'الخدمات',
            chips: platformServices.map((s) => ({
              id: `all-${s.id}`,
              label: s.nameAr,
              payload: userServiceIds.has(s.id) ? `service:${s.id}:status` : `nav:service:${s.id}`,
              variant: userServiceIds.has(s.id) ? ('primary' as const) : ('outline' as const),
            })),
          },
        ],
        chips: [{ id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' }],
      },
      pending: null,
    };
  }

  if (payload === 'action:whatsapp') {
    return {
      reply: {
        text: '**الدعم المباشر**\n\nفريقنا متاح على واتساب للرد على استفساراتك:\n📱 **+20 10 5088 9596**',
        chips: [{ id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' }],
      },
      pending: null,
    };
  }

  if (payload === 'action:assignments') {
    const files = student?.assignedFiles?.length
      ? student.assignedFiles
      : student?.assignedFile
        ? [student.assignedFile]
        : [];
    if (files.length === 0) {
      return {
        reply: {
          text: '**تكليفاتي**\n\nلم يُسند إليك ملفات بعد. ستظهر هنا فور إسنادها من الإدارة.',
          chips: [
            { id: 'nav', label: 'فتح صفحة التكليفات', payload: 'nav:assignments', variant: 'primary' },
            { id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' },
          ],
        },
        pending: null,
      };
    }
    return {
      reply: {
        text: `**ملفات مسندة إليك (${files.length}):**`,
        sections: [
          {
            title: 'الملفات',
            items: files.map((f) => `${f.customName || f.name} — مسار ${f.track?.replace('track', '') || ''}`),
          },
        ],
        chips: [
          { id: 'nav', label: 'تحميل من صفحة التكليفات', payload: 'nav:assignments', variant: 'primary' },
          { id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' },
        ],
      },
      pending: null,
    };
  }

  if (payload === 'action:profile') {
    const s = student;
    const rows: string[] = [];
    if (s?.fullNameArabic) rows.push(`الاسم: ${s.fullNameArabic}`);
    if (s?.email) rows.push(`البريد: ${s.email}`);
    if (s?.whatsappNumber) rows.push(`واتساب: ${s.whatsappNumber}`);
    if (s?.college) rows.push(`الكلية: ${s.college}`);
    if (s?.nationalID) rows.push(`الرقم القومي: ${maskNationalId(s.nationalID)}`);
    return {
      reply: {
        text: '**بيانات حسابك:**',
        sections: [{ title: 'الملف الشخصي', items: rows.length ? rows : ['لا توجد بيانات كافية — أكمل «سجل بياناتك».'] }],
        chips: [
          { id: 'prof', label: 'فتح الملف الشخصي', payload: 'nav:profile', variant: 'primary' },
          { id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' },
        ],
      },
      pending: null,
    };
  }

  const serviceMenu = payload.match(/^service:(\d+):menu$/);
  if (serviceMenu) {
    const sid = serviceMenu[1];
    const list = requestsForService(requests, sid);
    const service = SERVICES.find((s) => s.id === sid);

    if (list.length === 0) {
      return {
        reply: {
          text: `**${serviceNameAr(sid)}**\n\n${service?.descriptionAr || 'لم تقدم على هذه الخدمة بعد.'}`,
          sections: service?.requiredDocuments?.length
            ? [{ title: 'المستندات المطلوبة', items: service.requiredDocuments }]
            : undefined,
          chips: [
            { id: 'open', label: 'تقديم طلب جديد', payload: `nav:service:${sid}`, variant: 'primary' },
            { id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' },
          ],
        },
        pending: null,
      };
    }

    const latest = buildRequestCard(list[0], dtCodes, epCodes);
    return {
      reply: {
        text: `**${serviceNameAr(sid)}** — آخر طلب:`,
        cards: [latest],
        chips: chipsForService(sid),
      },
      pending: null,
    };
  }

  const serviceAction = payload.match(/^service:(\d+):(status|details|fawry|order)$/);
  if (serviceAction) {
    const [, sid, action] = serviceAction;
    const list = requestsForService(requests, sid);
    if (list.length === 0) {
      return {
        reply: {
          text: `لا يوجد طلب على **${serviceNameAr(sid)}**.`,
          chips: [{ id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' }],
        },
        pending: null,
      };
    }
    const intentMap = {
      status: 'status' as const,
      details: 'details' as const,
      fawry: 'fawry' as const,
      order: 'order_number' as const,
    };
    const intent = intentMap[action as keyof typeof intentMap];
    if (list.length > 1) {
      return { reply: pickRequestChips(list, intent, sid), pending: null };
    }
    return resolveRequestIntent(list[0], intent, student, dtCodes, epCodes);
  }

  const requestAction = payload.match(/^request:([^:]+):(status|details|fawry|order_number)$/);
  if (requestAction) {
    const [, reqId, intent] = requestAction;
    const req = requests.find((r) => r.id === reqId);
    if (!req) {
      return {
        reply: {
          text: 'لم أجد هذا الطلب.',
          chips: [{ id: 'back', label: 'رجوع', payload: 'action:welcome', variant: 'outline' }],
        },
        pending: null,
      };
    }
    return resolveRequestIntent(
      req,
      intent as 'status' | 'details' | 'fawry' | 'order_number',
      student,
      dtCodes,
      epCodes
    );
  }

  return { reply: buildWelcomeReply(student, requests), pending: null };
}

function resolveRequestIntent(
  request: ServiceRequest,
  intent: 'status' | 'details' | 'fawry' | 'order_number',
  student: StudentData | null,
  dtCodes: DtCodeRow[],
  epCodes: EpCodeRow[]
): { reply: AssistantReply; pending: PendingSensitiveAction } {
  const backChip: AssistantChip = {
    id: 'back',
    label: 'رجوع للخدمة',
    payload: `service:${request.serviceId}:menu`,
    variant: 'outline',
  };

  if (intent === 'status' || intent === 'details') {
    const service = SERVICES.find((s) => s.id === request.serviceId);
    const card = buildRequestCard(request, dtCodes, epCodes, { includeCodes: intent === 'details' });
    return {
      reply: {
        text: intent === 'status' ? '**حالة الطلب:**' : '**تفاصيل الطلب:**',
        cards: [card],
        sections:
          intent === 'details' && service?.requiredDocuments?.length
            ? [{ title: 'المستندات المطلوبة', items: service.requiredDocuments }]
            : undefined,
        chips: [
          backChip,
          { id: 'appr', label: 'الطلبات الموافق عليها', payload: 'nav:approved', variant: 'success' },
        ],
      },
      pending: null,
    };
  }

  if (intent === 'fawry') {
    if (request.serviceId !== '7') {
      return {
        reply: { text: 'كود فوري متاح ل**التحول الرقمي** فقط.', chips: [backChip] },
        pending: null,
      };
    }
    return promptOrShowFawry(request, student, dtCodes, backChip);
  }

  if (intent === 'order_number') {
    if (request.serviceId !== '4') {
      return {
        reply: { text: 'رقم الطلب متاح ل**دفع المصروفات** فقط.', chips: [backChip] },
        pending: null,
      };
    }
    return promptOrShowOrder(request, student, epCodes, backChip);
  }

  return { reply: buildWelcomeReply(student, [request]), pending: null };
}

function promptOrShowFawry(
  request: ServiceRequest,
  student: StudentData | null,
  dtCodes: DtCodeRow[],
  backChip: AssistantChip
): { reply: AssistantReply; pending: PendingSensitiveAction } {
  const dt = findDtCodeForRequest(dtCodes, request.id);
  const code = dt?.fawryCode || dt?.serialNumber;
  const profileId = student?.nationalID || '';
  if (code && profileId && nationalIdMatchesStudentOrRequest(student, request, profileId)) {
    return {
      reply: {
        text: '**كود فوري — التحول الرقمي**',
        cards: [
          {
            ...buildRequestCard(request, dtCodes, [], { includeCodes: false }),
            codes: { fawry: code },
            note: undefined,
          },
        ],
        chips: [backChip],
      },
      pending: null,
    };
  }
  return {
    reply: {
      text: '🔒 **تحقق أمني**\n\nلعرض كود فوري، اكتب **الرقم القومي** (14 رقم) في خانة الرسائل بالأسفل.',
      chips: [{ id: 'cancel', label: 'إلغاء', payload: `service:${request.serviceId}:menu`, variant: 'outline' }],
    },
    pending: { type: 'national_id', intent: 'fawry', requestId: request.id! },
  };
}

function promptOrShowOrder(
  request: ServiceRequest,
  student: StudentData | null,
  epCodes: EpCodeRow[],
  backChip: AssistantChip
): { reply: AssistantReply; pending: PendingSensitiveAction } {
  const ep = findEpCodeForRequest(epCodes, request.id);
  const profileId = student?.nationalID || '';
  if (ep?.orderNumber && profileId && nationalIdMatchesStudentOrRequest(student, request, profileId)) {
    return {
      reply: {
        text: '**رقم الطلب — المصروفات**',
        cards: [
          {
            ...buildRequestCard(request, [], epCodes, { includeCodes: false }),
            codes: { orderNumber: ep.orderNumber },
            note: undefined,
          },
        ],
        chips: [backChip],
      },
      pending: null,
    };
  }
  return {
    reply: {
      text: '🔒 **تحقق أمني**\n\nلعرض رقم الطلب، اكتب **الرقم القومي** (14 رقم) في خانة الرسائل.',
      chips: [{ id: 'cancel', label: 'إلغاء', payload: `service:${request.serviceId}:menu`, variant: 'outline' }],
    },
    pending: { type: 'national_id', intent: 'order_number', requestId: request.id! },
  };
}

export function handleNationalIdInput(
  pending: PendingSensitiveAction,
  nationalIdInput: string,
  ctx: AssistantContext
): { reply: AssistantReply; pending: PendingSensitiveAction } {
  if (!pending || pending.type !== 'national_id') {
    return { reply: { text: 'لا يوجد طلب تحقق نشط.' }, pending: null };
  }

  const request = ctx.requests.find((r) => r.id === pending.requestId);
  if (!request) {
    return {
      reply: {
        text: 'انتهت صلاحية الطلب. ابدأ من جديد.',
        chips: [{ id: 'w', label: 'القائمة', payload: 'action:welcome', variant: 'outline' }],
      },
      pending: null,
    };
  }

  const normalized = normalizeNationalId(nationalIdInput);
  if (normalized.length !== 14) {
    return {
      reply: { text: '⚠️ الرقم القومي يجب أن يكون **14 رقم**. حاول مرة أخرى.' },
      pending,
    };
  }

  if (!nationalIdMatchesStudentOrRequest(ctx.student, request, normalized)) {
    return {
      reply: {
        text: '❌ الرقم القومي **غير مطابق** لبياناتك. لن نعرض معلومات حساسة.',
        chips: [{ id: 'back', label: 'رجوع', payload: `service:${request.serviceId}:menu`, variant: 'outline' }],
      },
      pending: null,
    };
  }

  const backChip: AssistantChip = {
    id: 'back',
    label: 'رجوع',
    payload: `service:${request.serviceId}:menu`,
    variant: 'outline',
  };

  if (pending.intent === 'fawry') {
    const dt = findDtCodeForRequest(ctx.dtCodes, request.id);
    const code = dt?.fawryCode || dt?.serialNumber;
    if (!code) {
      return {
        reply: {
          text: '✅ تم التحقق، لكن **كود فوري** غير متاح بعد. راجع لاحقاً أو تواصل مع الدعم.',
          chips: [backChip],
        },
        pending: null,
      };
    }
    return {
      reply: {
        text: '✅ **تم التحقق بنجاح**',
        cards: [
          {
            ...buildRequestCard(request, ctx.dtCodes, [], { includeCodes: false }),
            codes: { fawry: code },
            note: undefined,
          },
        ],
        chips: [backChip],
      },
      pending: null,
    };
  }

  const ep = findEpCodeForRequest(ctx.epCodes, request.id);
  if (!ep?.orderNumber) {
    return {
      reply: {
        text: '✅ تم التحقق، لكن **رقم الطلب** غير متاح بعد.',
        chips: [backChip],
      },
      pending: null,
    };
  }
  return {
    reply: {
      text: '✅ **تم التحقق بنجاح**',
      cards: [
        {
          ...buildRequestCard(request, [], ctx.epCodes, { includeCodes: false }),
          codes: { orderNumber: ep.orderNumber },
          note: undefined,
        },
      ],
      chips: [backChip],
    },
    pending: null,
  };
}

export function handleFreeText(
  text: string,
  ctx: AssistantContext,
  pending: PendingSensitiveAction
): AssistantTurnResult {
  const digitsOnly = text.replace(/\D/g, '');
  if (pending?.type === 'national_id' && digitsOnly.length >= 14) {
    const result = handleNationalIdInput(pending, text, ctx);
    return wrapTurn(result.reply, result.pending, ctx);
  }

  const t = text.trim().toLowerCase();
  const lastSid = ctx.conversation?.lastServiceId;

  if (isGreetingText(text)) {
    return wrapTurn(buildGreetingReply(ctx.student, ctx.requests), null, ctx);
  }

  if (/^(شكر|متشكر|تسلم|thanks|thank you)/.test(t)) {
    return wrapTurn(
      {
        text: 'العفو! 😊 أي وقت تحتاج حاجة، أنا هنا.',
        chipGroups: welcomeChipGroups(ctx.requests),
      },
      null,
      ctx
    );
  }

  if (/^(تمام|ماشي|اوك|ok|حلو|تمام كده)$/.test(t.replace(/\s+/g, ' '))) {
    return wrapTurn(
      {
        text: 'تمام 👍 لو محتاج أي حاجة تاني، قولي.',
        chipGroups: welcomeChipGroups(ctx.requests),
      },
      null,
      ctx
    );
  }

  if (/واتس|whatsapp|دعم|موظف|تواصل/.test(t)) {
    return handleAssistantPayload('action:whatsapp', ctx);
  }
  if (/كل الطلب|كل طلبات|ملخص|طلباتي|عرض طلب/.test(t)) {
    return handleAssistantPayload('action:all_status', ctx);
  }
  if (/تكليف|ملف/.test(t)) {
    return handleAssistantPayload('action:assignments', ctx);
  }
  if (/حساب|ملف شخص|profile/.test(t) && !/بيانات/.test(t)) {
    return handleAssistantPayload('action:profile', ctx);
  }
  if (/خدمات|ايه المتاح|إيه المتاح|عندكم ايه|كل الخدمات/.test(t)) {
    return handleAssistantPayload('action:services_list', ctx);
  }

  const wantsFawry = /فوري|كود فوري|كود/.test(t);
  const wantsOrder = /رقم الطلب|رقم طلب/.test(t);
  const wantsStatus =
    /مواف|قبول|اتقبل|اتقبلت|حالة|وصل|رفض|مكتمل|لسه|خلص|نزل|ظهر/.test(t);
  const wantsDetails = /تفاصيل|معلومات|قولي|عايز اعرف|عاوز اعرف|اعرف/.test(t);
  const isShortFollowUp = /^(طب|و|يعني|ايه|إيه|؟|\?|كمان|وبعدين)$/.test(t.trim());

  const matchedService = matchServiceFromText(text);

  const resolveServiceIntent = (sid: string): AssistantTurnResult => {
    if (wantsFawry && sid === '7') return handleAssistantPayload(`service:7:fawry`, ctx);
    if (wantsOrder && sid === '4') return handleAssistantPayload(`service:4:order`, ctx);
    if (wantsStatus || wantsDetails || isShortFollowUp) {
      return handleAssistantPayload(`service:${sid}:status`, ctx);
    }
    return handleAssistantPayload(`service:${sid}:menu`, ctx);
  };

  if (matchedService) {
    return resolveServiceIntent(matchedService);
  }

  if (lastSid && (isShortFollowUp || wantsStatus || wantsDetails || wantsFawry || wantsOrder)) {
    return resolveServiceIntent(lastSid);
  }

  if (wantsFawry) {
    return handleAssistantPayload('service:7:fawry', ctx);
  }
  if (wantsOrder) {
    return handleAssistantPayload('service:4:order', ctx);
  }

  if (wantsStatus || wantsDetails) {
    if (lastSid) return handleAssistantPayload(`service:${lastSid}:status`, ctx);
    const active = sortRequestsNewestFirst(ctx.requests).filter(
      (r) => r.status !== 'completed' && r.status !== 'rejected'
    );
    if (active.length === 1 && active[0].id) {
      return handleAssistantPayload(`request:${active[0].id}:status`, ctx);
    }
    if (ctx.requests.length === 1 && ctx.requests[0].id) {
      return handleAssistantPayload(`request:${ctx.requests[0].id}:status`, ctx);
    }
    return handleAssistantPayload('action:all_status', ctx);
  }

  return wrapTurn(
    {
      text:
        'مش متأكد قصدك على إيه 🤔\n\n' +
        'قولي اسم الخدمة أو اسأل زي ما بتحكي:\n' +
        '«حالة مصروفاتي» — «اتقبلت؟» — «كود فوري»',
      chipGroups: welcomeChipGroups(ctx.requests),
    },
    null,
    ctx
  );
}
