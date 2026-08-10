import React from 'react';
import {
  AssistantChip,
  AssistantReply,
  AssistantRequestCard,
  StatusBadgeVariant,
} from '../../services/assistantEngine';
import { CheckCircle, Clock, XCircle, FileText, AlertCircle } from 'lucide-react';

const STATUS_CONFIG: Record<
  StatusBadgeVariant,
  { label: string; className: string; Icon: React.ElementType }
> = {
  pending: { label: 'قيد الانتظار', className: 'sa-badge-pending', Icon: Clock },
  submitted: { label: 'تم التقديم', className: 'sa-badge-submitted', Icon: FileText },
  receipt_sent: { label: 'تم إرسال الإيصال', className: 'sa-badge-receipt', Icon: AlertCircle },
  completed: { label: 'تمت الموافقة', className: 'sa-badge-completed', Icon: CheckCircle },
  rejected: { label: 'مرفوض', className: 'sa-badge-rejected', Icon: XCircle },
};

function renderMarkdownLite(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return <span key={i}>{part}</span>;
  });
}

function StatusBadge({ status, label }: { status: StatusBadgeVariant; label: string }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const Icon = cfg.Icon;
  return (
    <span className={`sa-status-badge ${cfg.className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
}

function RequestCard({ card }: { card: AssistantRequestCard }) {
  return (
    <div className="sa-request-card" style={{ borderRightColor: card.serviceColor }}>
      <div className="sa-request-card-head">
        <div>
          <span className="sa-request-service" style={{ color: card.serviceColor }}>
            {card.serviceName}
          </span>
          <span className="sa-request-date">{card.date}</span>
        </div>
        <StatusBadge status={card.status} label={card.statusLabel} />
      </div>

      {card.rows.length > 0 && (
        <div className="sa-request-rows">
          {card.rows.map((row, i) => (
            <div key={i} className={`sa-request-row ${row.highlight ? 'highlight' : ''}`}>
              <span className="sa-row-label">{row.label}</span>
              <span className="sa-row-value">{row.value}</span>
            </div>
          ))}
        </div>
      )}

      {(card.codes?.fawry || card.codes?.orderNumber) && (
        <div className="sa-codes-block">
          {card.codes.fawry && (
            <div className="sa-code-item fawry">
              <span className="sa-code-label">كود فوري</span>
              <span className="sa-code-value">{card.codes.fawry}</span>
            </div>
          )}
          {card.codes.orderNumber && (
            <div className="sa-code-item order">
              <span className="sa-code-label">رقم الطلب</span>
              <span className="sa-code-value">{card.codes.orderNumber}</span>
            </div>
          )}
        </div>
      )}

      {card.note && <p className="sa-card-note">{card.note}</p>}
    </div>
  );
}

function SummaryBar({ summary }: { summary: NonNullable<AssistantReply['summary']> }) {
  return (
    <div className="sa-summary-bar">
      <div className="sa-summary-item">
        <span className="sa-summary-num">{summary.total}</span>
        <span className="sa-summary-lbl">إجمالي الطلبات</span>
      </div>
      <div className="sa-summary-item success">
        <span className="sa-summary-num">{summary.completed}</span>
        <span className="sa-summary-lbl">مكتمل</span>
      </div>
      <div className="sa-summary-item warning">
        <span className="sa-summary-num">{summary.pending}</span>
        <span className="sa-summary-lbl">قيد المعالجة</span>
      </div>
    </div>
  );
}

function ChipGroups({
  chips,
  chipGroups,
  onChip,
}: {
  chips?: AssistantChip[];
  chipGroups?: AssistantReply['chipGroups'];
  onChip: (payload: string) => void;
}) {
  if (chipGroups?.length) {
    return (
      <div className="sa-chip-groups">
        {chipGroups.map((group) => (
          <div key={group.title} className="sa-chip-group">
            <span className="sa-chip-group-title">{group.title}</span>
            <div className="sa-chips">
              {group.chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`sa-chip ${c.variant || ''}`}
                  onClick={() => onChip(c.payload)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (!chips?.length) return null;
  return (
    <div className="sa-chips">
      {chips.map((c) => (
        <button
          key={c.id}
          type="button"
          className={`sa-chip ${c.variant || ''}`}
          onClick={() => onChip(c.payload)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function AssistantMessageBody({
  reply,
  showWhatsApp,
  onChip,
}: {
  reply: AssistantReply;
  showWhatsApp?: boolean;
  onChip: (payload: string) => void;
}) {
  return (
    <>
      {reply.summary && <SummaryBar summary={reply.summary} />}
      {reply.text && <div className="sa-msg-text">{renderMarkdownLite(reply.text)}</div>}
      {reply.cards && reply.cards.length > 0 && (
        <div className="sa-cards-stack">
          {reply.cards.map((card, i) => (
            <RequestCard key={card.requestId || i} card={card} />
          ))}
        </div>
      )}
      {reply.sections?.map((sec, i) => (
        <div key={i} className="sa-info-section">
          <span className="sa-info-section-title">{sec.title}</span>
          <ul className="sa-info-list">
            {sec.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {showWhatsApp && (
        <a
          className="sa-wa-link"
          href="https://wa.me/201050889596"
          target="_blank"
          rel="noopener noreferrer"
        >
          فتح واتساب الدعم
        </a>
      )}
      <ChipGroups chips={reply.chips} chipGroups={reply.chipGroups} onChip={onChip} />
    </>
  );
}
