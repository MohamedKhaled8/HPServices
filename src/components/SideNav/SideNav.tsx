import React, { useState } from 'react';
import {
  Home, User, ClipboardList, Book, LogOut,
  Newspaper, Shield, ChevronLeft
} from 'lucide-react';
import './SideNav.css';

export interface SideNavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  badge?: number;
  danger?: boolean;
}

interface SideNavProps {
  studentName?: string;
  studentInitial?: string;
  isAdmin?: boolean;
  onProfileClick: () => void;
  onRequestsClick: () => void;
  onAssignmentsClick: () => void;
  onNewsClick: () => void;
  onAdminClick?: () => void;
  onLogout: () => void;
  activeItem?: string;
}

const SideNav: React.FC<SideNavProps> = ({
  studentName,
  studentInitial,
  isAdmin,
  onProfileClick,
  onRequestsClick,
  onAssignmentsClick,
  onNewsClick,
  onAdminClick,
  onLogout,
  activeItem,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const navItems: SideNavItem[] = [
    { id: 'home',        label: 'الرئيسية',            icon: Home,          onClick: () => { window.scrollTo({ top: 0, behavior: 'smooth' }); } },
    { id: 'profile',     label: 'الملف الشخصي',        icon: User,          onClick: onProfileClick },
    { id: 'requests',    label: 'الطلبات الموافق عليها', icon: ClipboardList, onClick: onRequestsClick },
    { id: 'assignments', label: 'التكليفات الدراسية',   icon: Book,          onClick: onAssignmentsClick },
    { id: 'news',        label: 'آخر الأخبار',          icon: Newspaper,     onClick: onNewsClick },
    ...(isAdmin && onAdminClick ? [{ id: 'admin', label: 'لوحة الأدمن', icon: Shield, onClick: onAdminClick }] : []),
  ];

  const bottomItems: SideNavItem[] = [
    { id: 'logout', label: 'تسجيل خروج', icon: LogOut, onClick: onLogout, danger: true },
  ];

  return (
    <>
      {isExpanded && (
        <div
          className="sidenav-backdrop"
          onClick={() => setIsExpanded(false)}
        />
      )}

      <aside className={`sidenav ${isExpanded ? 'sidenav--expanded' : ''}`}>
        <div className="sidenav-avatar-area" onClick={() => setIsExpanded(prev => !prev)}>
          <div className="sidenav-avatar">
            {studentInitial || 'U'}
          </div>
          <div className="sidenav-avatar-info">
            <span className="sidenav-avatar-name">{studentName || 'الطالب'}</span>
            <span className="sidenav-avatar-sub">HP Services</span>
          </div>
          <ChevronLeft
            size={16}
            className={`sidenav-chevron ${isExpanded ? 'sidenav-chevron--open' : ''}`}
          />
        </div>

        <button
          className="sidenav-toggle"
          onClick={() => setIsExpanded(prev => !prev)}
          title={isExpanded ? 'إغلاق القائمة' : 'فتح القائمة'}
        >
          <ChevronLeft size={18} className={`sidenav-toggle-icon ${isExpanded ? 'sidenav-toggle-icon--open' : ''}`} />
        </button>

        <nav className="sidenav-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeItem === item.id;
            return (
              <button
                key={item.id}
                className={`sidenav-item ${isActive ? 'sidenav-item--active' : ''}`}
                onClick={item.onClick}
                title={item.label}
              >
                <span className="sidenav-item-icon">
                  <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className="sidenav-badge">{item.badge}</span>
                  )}
                </span>
                <span className="sidenav-item-label">{item.label}</span>
                {isActive && <span className="sidenav-active-indicator" />}
              </button>
            );
          })}
        </nav>

        <div className="sidenav-bottom">
          {bottomItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`sidenav-item ${item.danger ? 'sidenav-item--danger' : ''}`}
                onClick={item.onClick}
                title={item.label}
              >
                <span className="sidenav-item-icon">
                  <Icon size={20} strokeWidth={1.8} />
                </span>
                <span className="sidenav-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      </aside>
    </>
  );
};

export default SideNav;
