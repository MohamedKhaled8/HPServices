import React from 'react';
import { Service } from '../types';
import {
  Headphones, Package, Book, CreditCard, CheckCircle, Award, Zap,
  BookOpen, Search, Target, FileText, User, ClipboardList, FileCheck
} from 'lucide-react';
import '../styles/ServiceCard.css';

interface ServiceCardProps {
  service: Service;
  onClick: () => void;
}

const getServiceIcon = (iconName: string) => {
  const iconProps = { size: 32, strokeWidth: 1.5 };
  const icons: { [key: string]: React.ReactNode } = {
    headphones: <Headphones {...iconProps} />,
    package: <Package {...iconProps} />,
    book: <Book {...iconProps} />,
    creditcard: <CreditCard {...iconProps} />,
    checklist: <CheckCircle {...iconProps} />,
    award: <Award {...iconProps} />,
    zap: <Zap {...iconProps} />,
    'book-open': <BookOpen {...iconProps} />,
    search: <Search {...iconProps} />,
    target: <Target {...iconProps} />,
    'file-text': <FileText {...iconProps} />,
    user: <User {...iconProps} />,
    'clipboard-list': <ClipboardList {...iconProps} />,
    'file-check': <FileCheck {...iconProps} />
  };
  return icons[iconName] || <Book {...iconProps} />;
};

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onClick }) => {
  // دالة للحصول على السنة الحالية (تبدأ من 2026 وتتغير تلقائياً)
  const getCurrentYear = (): number => {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    return currentYear >= 2026 ? currentYear : 2026;
  };

  // تحديث اسم الخدمة إذا كانت "سجل بياناتك" لتشمل السنة الحالية
  const getServiceName = (): string => {
    if (service.nameAr.includes('سجل بياناتك')) {
      return `سجل بياناتك ${getCurrentYear()}`;
    }
    return service.nameAr;
  };

  // عرض الصورة المخصصة للخدمات المختلفة
  const renderIcon = () => {
    if (service.icon && service.icon.toLowerCase().endsWith('.json')) {
      return (
        <div className="lottie-icon-wrapper" style={{
          width: '120px',
          height: '120px',
          margin: '-30px auto -10px',
          pointerEvents: 'none',
          position: 'relative',
          zIndex: 2
        }}>
          {/* @ts-ignore */}
          <lottie-player
            src={`/json/${service.icon}`}
            renderer="canvas"
            background="transparent"
            speed="1"
            style={{ width: '100%', height: '100%' }}
            loop
            autoplay
          ></lottie-player>
        </div>
      );
    }

    return getServiceIcon(service.icon);
  };

  return (
    <div
      className="service-card"
      onClick={onClick}
      style={{
        borderTopColor: service.color,
        '--accent-color': service.color
      } as React.CSSProperties & { '--accent-color': string }}
    >
      <div className="service-icon" style={{ color: service.color }}>
        {renderIcon()}
      </div>
      <h3 className="service-name">{getServiceName()}</h3>
      <p className="service-description">{service.descriptionAr}</p>
      <button className="service-action">
        اطلب الآن
      </button>
    </div>
  );
};

export default ServiceCard;
