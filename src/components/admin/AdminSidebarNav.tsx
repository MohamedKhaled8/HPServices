import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import {
  ADMIN_NAV_OPEN_GROUPS_KEY,
  ADMIN_SIDEBAR_COLLAPSED_KEY,
  findAdminNavGroupId,
  getAdminNavigation,
  type AdminNavItem,
  type AdminTabId
} from '../../constants/adminNavigation';
import '../../styles/AdminSidebarNav.css';

interface AdminSidebarNavProps {
  activeTab: AdminTabId;
  onSelectTab: (tab: AdminTabId) => void;
  showAssignments: boolean;
  onAssignmentsClick?: () => void;
  mobileOpen: boolean;
  onMobileOpenChange: (open: boolean) => void;
}

function readCollapsed(): boolean {
  try {
    const saved = localStorage.getItem(ADMIN_SIDEBAR_COLLAPSED_KEY);
    if (saved === '1') {
      localStorage.removeItem(ADMIN_SIDEBAR_COLLAPSED_KEY);
    }
    return false;
  } catch {
    return false;
  }
}

const AdminSidebarNav: React.FC<AdminSidebarNavProps> = ({
  activeTab,
  onSelectTab,
  showAssignments,
  onAssignmentsClick,
  mobileOpen,
  onMobileOpenChange
}) => {
  const groups = useMemo(
    () => getAdminNavigation({ showAssignments }),
    [showAssignments]
  );

  const activeGroupId = findAdminNavGroupId(activeTab, groups);
  const navRef = useRef<HTMLElement>(null);

  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [openGroups, setOpenGroups] = useState<string[]>(() => (
    activeGroupId ? [activeGroupId] : ['overview']
  ));

  useEffect(() => {
    if (!activeGroupId) return;
    setOpenGroups(activeGroupId ? [activeGroupId] : ['overview']);
  }, [activeGroupId]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [collapsed]);

  useEffect(() => {
    try {
      localStorage.setItem(ADMIN_NAV_OPEN_GROUPS_KEY, JSON.stringify(openGroups));
    } catch {
      /* ignore */
    }
  }, [openGroups]);

  useEffect(() => {
    if (collapsed) return;
    const active = navRef.current?.querySelector('.admin-nav-link.is-active');
    active?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeTab, collapsed]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onMobileOpenChange(false);
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [mobileOpen, onMobileOpenChange]);

  const toggleGroup = useCallback((groupId: string) => {
    setOpenGroups((prev) => {
      if (prev.length === 1 && prev[0] === groupId) {
        return activeGroupId && activeGroupId !== groupId ? [activeGroupId] : prev;
      }
      return [groupId];
    });
  }, [activeGroupId]);

  const handleItemClick = (item: AdminNavItem) => {
    if (item.kind === 'external') {
      onAssignmentsClick?.();
      onMobileOpenChange(false);
      return;
    }
    onSelectTab(item.id as AdminTabId);
    onMobileOpenChange(false);
  };

  const isItemActive = (item: AdminNavItem) => item.kind === 'tab' && item.id === activeTab;

  const renderItem = (item: AdminNavItem) => {
    const Icon = item.icon;
    const active = isItemActive(item);
    return (
      <li key={item.id} className="admin-nav-item">
        <button
          type="button"
          className={`admin-nav-link${active ? ' is-active' : ''}`}
          onClick={() => handleItemClick(item)}
          aria-current={active ? 'page' : undefined}
          title={item.label}
        >
          {active && <span className="admin-nav-active-bar" aria-hidden="true" />}
          <span className="admin-nav-icon-wrap" aria-hidden="true">
            <Icon size={17} strokeWidth={active ? 2.2 : 1.9} className="admin-nav-icon" />
          </span>
          <span className="admin-nav-label">{item.label}</span>
        </button>
      </li>
    );
  };

  const navBody = (
    <div className="admin-sidebar-inner">
      <div className="admin-sidebar-brand">
        <div
          className="admin-sidebar-brand-left"
          onClick={() => collapsed && setCollapsed(false)}
          style={{ cursor: collapsed ? 'pointer' : 'default' }}
          title={collapsed ? 'توسيع القائمة' : undefined}
        >
          <div className="admin-sidebar-brand-badge">HP</div>
          <div className="admin-sidebar-brand-copy">
            <span className="admin-sidebar-kicker">HP Services</span>
            <span className="admin-sidebar-brand-text">لوحة التحكم</span>
          </div>
        </div>
        <button
          type="button"
          className="admin-sidebar-collapse-btn"
          onClick={() => setCollapsed((value) => !value)}
          aria-label={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
          title={collapsed ? 'توسيع القائمة' : 'طي القائمة'}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
        <button
          type="button"
          className="admin-sidebar-close-btn"
          onClick={() => onMobileOpenChange(false)}
          aria-label="إغلاق القائمة"
        >
          <X size={18} />
        </button>
      </div>

      <nav ref={navRef} className="admin-sidebar-nav" aria-label="أقسام لوحة التحكم">
        {groups.map((group) => {
          const isMulti = group.items.length > 1;
          const expanded = collapsed || !isMulti || openGroups.includes(group.id);
          const hasActive = group.items.some(isItemActive);
          return (
            <div
              key={group.id}
              className={`admin-nav-group${hasActive ? ' has-active' : ''}${expanded ? ' is-open' : ''}`}
            >
              {isMulti && (
                <button
                  type="button"
                  className="admin-nav-group-toggle"
                  onClick={() => (collapsed ? setCollapsed(false) : toggleGroup(group.id))}
                  aria-expanded={expanded}
                  title={group.label}
                >
                  <span className="admin-nav-group-label">{group.label}</span>
                  <ChevronDown
                    size={14}
                    className={`admin-nav-chevron${expanded ? ' is-open' : ''}`}
                    aria-hidden="true"
                  />
                </button>
              )}
              <div className={`admin-nav-list-wrap${expanded ? ' is-open' : ''}`}>
                <ul className="admin-nav-list">
                  {group.items.map(renderItem)}
                </ul>
              </div>
            </div>
          );
        })}
      </nav>
    </div>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="admin-nav-backdrop"
          onClick={() => onMobileOpenChange(false)}
          aria-label="إغلاق القائمة"
        />
      )}
      <aside
        className={`admin-sidebar${collapsed ? ' is-collapsed' : ''}${mobileOpen ? ' is-mobile-open' : ''}`}
        aria-label="قائمة لوحة التحكم"
      >
        {navBody}
      </aside>
    </>
  );
};

export default AdminSidebarNav;
