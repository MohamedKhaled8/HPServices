import React from 'react';
import { Menu, LogOut } from 'lucide-react';

export interface AdminDashboardHeaderProps {
  serverHealth: {
    status: 'checking' | 'online' | 'offline';
    buildTag?: string;
    details?: string;
  };
  checkServerHealth: () => void;
  onOpenMobileNav: () => void;
  onBack?: () => void;
  onLogout: () => void;
}

export const AdminDashboardHeader: React.FC<AdminDashboardHeaderProps> = ({
  serverHealth,
  checkServerHealth,
  onOpenMobileNav,
  onBack,
  onLogout
}) => {
  return (
    <header className="admin-header">
      <div className="admin-header-content">
        <div className="admin-header-start">
          <button
            type="button"
            className="admin-nav-menu-btn"
            onClick={onOpenMobileNav}
            aria-label="فتح قائمة الأقسام"
          >
            <Menu size={19} />
          </button>
          <div className="admin-header-title-box">
            <h1 className="admin-header-title">لوحة تحكم الإدارة</h1>
            <span className="admin-header-subtitle">مركز إدارة الخدمات والطلبات</span>
          </div>
        </div>

        <div className="admin-actions admin-header-end">
          {/* Server Automation Health Badge */}
          <div
            className="admin-health-badge"
            title={
              serverHealth.status === 'online'
                ? 'الخدمة متصلة وتعمل كالمعتاد'
                : serverHealth.status === 'offline'
                ? 'تعذر الاتصال بخدمة الأتمتة'
                : 'جاري التحقق من حالة الاتصال'
            }
            onClick={checkServerHealth}
          >
            <span className={`admin-health-dot ${serverHealth.status}`} />
            <span className="admin-health-label">
              {serverHealth.status === 'online'
                ? 'حالة الخدمة: نشط 🟢'
                : serverHealth.status === 'offline'
                ? 'حالة الخدمة: متوقف 🔴'
                : 'جاري التحقق...'}
            </span>
          </div>

          {onBack && (
            <button onClick={onBack} className="back-button" title="رجوع">
              رجوع
            </button>
          )}
          <button onClick={onLogout} className="logout-button" title="تسجيل الخروج">
            <LogOut size={16} />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default AdminDashboardHeader;

