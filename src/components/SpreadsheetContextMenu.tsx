import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Scissors,
  Copy,
  Clipboard,
  Plus,
  Trash2,
  X,
  EyeOff,
  MoveHorizontal,
  Filter,
  ArrowUpAZ,
  ArrowDownZA,
  Palette,
  ListChecks,
  ChevronDown
} from 'lucide-react';
import '../styles/SpreadsheetGrid.css';

const MENU_ESTIMATED_HEIGHT = 520;
const MENU_WIDTH = 260;

export type SpreadsheetMenuAction =
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteSpecial'
  | 'insertColumnLeft'
  | 'insertColumnRight'
  | 'deleteColumn'
  | 'clearColumn'
  | 'hideColumn'
  | 'resizeColumn'
  | 'removeFilter'
  | 'sortAtoZ'
  | 'sortZtoA'
  | 'conditionalFormatting'
  | 'dataValidation';

export interface SpreadsheetContextMenuProps {
  /** Position (for context menu) */
  x: number;
  y: number;
  /** For column menu */
  columnLabel?: string;
  columnIndex?: number;
  /** For cell/range menu */
  isRange?: boolean;
  canPaste: boolean;
  hasFilter?: boolean;
  onAction: (action: SpreadsheetMenuAction) => void;
  onClose: () => void;
  /** When true, show as dropdown under the trigger (e.g. header arrow) */
  asDropdown?: boolean;
  anchorRef?: React.RefObject<HTMLElement>;
  disabledActions?: SpreadsheetMenuAction[];
}

const MENU_ITEMS: { action: SpreadsheetMenuAction; label: string; labelEn?: string; icon: React.ReactNode; shortcut?: string; dividerAfter?: boolean }[] = [
  { action: 'cut', label: 'قص', labelEn: 'Cut', icon: <Scissors size={14} />, shortcut: 'Ctrl+X' },
  { action: 'copy', label: 'نسخ', labelEn: 'Copy', icon: <Copy size={14} />, shortcut: 'Ctrl+C' },
  { action: 'paste', label: 'لصق', labelEn: 'Paste', icon: <Clipboard size={14} />, shortcut: 'Ctrl+V' },
  { action: 'pasteSpecial', label: 'لصق خاص', labelEn: 'Paste special', icon: <Clipboard size={14} />, dividerAfter: true },
  { action: 'insertColumnLeft', label: 'إدراج عمود لليسار', labelEn: 'Insert 1 column left', icon: <Plus size={14} /> },
  { action: 'insertColumnRight', label: 'إدراج عمود لليمين', labelEn: 'Insert 1 column right', icon: <Plus size={14} /> },
  { action: 'deleteColumn', label: 'حذف العمود', labelEn: 'Delete column', icon: <Trash2 size={14} /> },
  { action: 'clearColumn', label: 'مسح العمود', labelEn: 'Clear column', icon: <X size={14} /> },
  { action: 'hideColumn', label: 'إخفاء العمود', labelEn: 'Hide column', icon: <EyeOff size={14} /> },
  { action: 'resizeColumn', label: 'تغيير حجم العمود', labelEn: 'Resize column', icon: <MoveHorizontal size={14} />, dividerAfter: true },
  { action: 'removeFilter', label: 'إزالة الفلتر', labelEn: 'Remove filter', icon: <Filter size={14} /> },
  { action: 'sortAtoZ', label: 'ترتيب من أ إلى ي', labelEn: 'Sort A→Z', icon: <ArrowUpAZ size={14} /> },
  { action: 'sortZtoA', label: 'ترتيب من ي إلى أ', labelEn: 'Sort Z→A', icon: <ArrowDownZA size={14} /> },
  { action: 'conditionalFormatting', label: 'التنسيق الشرطي', labelEn: 'Conditional formatting', icon: <Palette size={14} /> },
  { action: 'dataValidation', label: 'التحقق من صحة البيانات', labelEn: 'Data validation', icon: <ListChecks size={14} /> }
];

export const SpreadsheetContextMenu: React.FC<SpreadsheetContextMenuProps> = ({
  x,
  y,
  columnLabel,
  canPaste,
  hasFilter = false,
  onAction,
  onClose,
  asDropdown = false,
  anchorRef,
  disabledActions = []
}) => {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: x, top: y });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node) && !anchorRef?.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    /* إغلاق القائمة عند التمرير خارجها فقط - التمرير داخل القائمة لا يغلقها */
    const handleScroll = (e: Event) => {
      if (menuRef.current && menuRef.current.contains(e.target as Node)) return;
      onClose();
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    document.addEventListener('scroll', handleScroll, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('scroll', handleScroll, true);
    };
  }, [onClose, anchorRef]);

  useLayoutEffect(() => {
    let left = x;
    let top = y;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 768;
    if (left + MENU_WIDTH > vw - 8) left = vw - MENU_WIDTH - 8;
    if (left < 8) left = 8;
    if (top + MENU_ESTIMATED_HEIGHT > vh - 8) top = vh - MENU_ESTIMATED_HEIGHT - 8;
    if (top < 8) top = 8;
    setPosition({ left, top });
  }, [x, y]);

  const isDisabled = (action: SpreadsheetMenuAction): boolean => {
    if (disabledActions.includes(action)) return true;
    if (action === 'paste' || action === 'pasteSpecial') return !canPaste;
    if (action === 'removeFilter') return !hasFilter;
    return false;
  };

  const menuContent = (
    <div
      ref={menuRef}
      className="spreadsheet-context-menu"
      style={{ left: position.left, top: position.top, position: 'fixed' as const }}
      role="menu"
      aria-label="Spreadsheet menu"
    >
      {columnLabel && (
        <div className="spreadsheet-context-menu-header">
          <span className="spreadsheet-context-menu-title">{columnLabel}</span>
        </div>
      )}
      <div className="spreadsheet-context-menu-list">
        {MENU_ITEMS.map((item) => {
          const disabled = isDisabled(item.action);
          return (
            <React.Fragment key={item.action}>
              <button
                type="button"
                className="spreadsheet-context-menu-item"
                disabled={disabled}
                onClick={() => {
                  if (!disabled) {
                    onAction(item.action);
                    onClose();
                  }
                }}
                role="menuitem"
              >
                <span className="spreadsheet-context-menu-item-icon">{item.icon}</span>
                <span className="spreadsheet-context-menu-item-label">{item.label}</span>
                {item.shortcut && (
                  <span className="spreadsheet-context-menu-item-shortcut">{item.shortcut}</span>
                )}
              </button>
              {item.dividerAfter && <div className="spreadsheet-context-menu-divider" />}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(menuContent, document.body)
    : menuContent;
};

/** Dropdown trigger button for column header - click opens context menu */
export const SpreadsheetHeaderDropdown: React.FC<{
  columnLabel: string;
  columnIndex: number;
  isOpen: boolean;
  onToggle: (open: boolean) => void;
  onOpenMenu: (e: React.MouseEvent) => void;
  children?: React.ReactNode;
}> = ({ columnLabel, isOpen, onToggle, onOpenMenu, children }) => (
  <div className="spreadsheet-header-cell-inner">
    {children}
    <button
      type="button"
      className="spreadsheet-header-dropdown-trigger"
      aria-label={`Menu for ${columnLabel}`}
      aria-expanded={isOpen}
      onClick={(e) => {
        e.stopPropagation();
        onOpenMenu(e);
        onToggle(!isOpen);
      }}
    >
      <ChevronDown size={14} />
    </button>
  </div>
);

export default SpreadsheetContextMenu;
