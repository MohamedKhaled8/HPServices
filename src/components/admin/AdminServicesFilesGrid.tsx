import React, { memo, useMemo } from 'react';
import {
  ClipboardList,
  User,
  Package,
  CreditCard,
  BookOpen,
  GraduationCap,
  FileCheck,
  Award,
  FileText,
  Lock,
  Key
} from 'lucide-react';
import { SERVICES } from '../../constants/services';
import type { AssignmentsServiceConfig, BookServiceConfig } from '../../types';

export type ServiceRequestStats = { pending: number; total: number };

export interface AdminServicesFilesGridProps {
  selectedServiceId: string | null;
  onSelectService: (serviceId: string, alreadySelected: boolean) => void;
  requestStatsByServiceId: Record<string, ServiceRequestStats | undefined>;
  bookConfig: BookServiceConfig | null;
  assignmentsConfig: AssignmentsServiceConfig | null;
  statsUnlocked: boolean;
  onToggleStatsLockClick: (e: React.MouseEvent) => void;
  onToggleStatsLockKeyDown: (e: React.KeyboardEvent) => void;
}

function ServiceIcon({ icon }: { icon: string }) {
  const iconProps = { size: 32 };
  switch (icon) {
    case 'clipboard-list':
      return <ClipboardList {...iconProps} />;
    case 'user':
      return <User {...iconProps} />;
    case 'package':
      return <Package {...iconProps} />;
    case 'credit-card':
      return <CreditCard {...iconProps} />;
    case 'book-open':
      return <BookOpen {...iconProps} />;
    case 'graduation-cap':
      return <GraduationCap {...iconProps} />;
    case 'file-check':
      return <FileCheck {...iconProps} />;
    case 'award':
      return <Award {...iconProps} />;
    default:
      return <FileText {...iconProps} />;
  }
}

const AdminServicesFilesGrid = memo(function AdminServicesFilesGrid({
  selectedServiceId,
  onSelectService,
  requestStatsByServiceId,
  bookConfig,
  assignmentsConfig,
  statsUnlocked,
  onToggleStatsLockClick,
  onToggleStatsLockKeyDown
}: AdminServicesFilesGridProps) {
  const maskNumber = useMemo(
    () => (n: number) => (statsUnlocked ? String(n) : '*****'),
    [statsUnlocked]
  );

  return (
    <div className="services-files-grid">
      {SERVICES.map((service) => {
        const q = requestStatsByServiceId[service.id];
        const newRequests = q?.pending ?? 0;
        const totalRequests = q?.total ?? 0;
        const isSelected = selectedServiceId === service.id;
        let serviceName = service.nameAr;
        if (service.id === '3' && bookConfig) {
          serviceName = bookConfig.serviceName;
        } else if (service.id === '5' && assignmentsConfig) {
          serviceName = assignmentsConfig.serviceName;
        }

        return (
          <div
            key={service.id}
            className={`service-file ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelectService(service.id, isSelected)}
          >
            <div className="service-file-icon" style={{ color: service.color }}>
              <ServiceIcon icon={service.icon} />
            </div>
            <div className="service-file-name">{serviceName}</div>
            <div className="service-file-stats">
              <div className="service-file-stat-item service-file-stat-new">
                <span className="stat-label">جديدة</span>
                <span className="stat-value">{maskNumber(newRequests)}</span>
              </div>
              <div className="service-file-stat-item service-file-stat-total">
                <span className="stat-label">الإجمالي</span>
                <span className="stat-value">{maskNumber(totalRequests)}</span>
              </div>
            </div>

            <div
              style={{ position: 'absolute', top: 10, left: 10, zIndex: 2 }}
              onClick={onToggleStatsLockClick}
              title={statsUnlocked ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
              role="button"
              aria-label={statsUnlocked ? 'إخفاء أرقام الطلبات' : 'إظهار أرقام الطلبات'}
              tabIndex={0}
              onKeyDown={onToggleStatsLockKeyDown}
            >
              {statsUnlocked ? <Lock size={18} /> : <Key size={18} />}
            </div>
          </div>
        );
      })}
    </div>
  );
});

export default AdminServicesFilesGrid;
