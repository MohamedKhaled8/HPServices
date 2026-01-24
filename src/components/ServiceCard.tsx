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
    // Map service IDs to their custom images
    const customImages: Record<string, string> = {
      '1': '/saveinformation.png', // سجل بياناتك
      '2': '/vip.png', // العميل المميز
      '3': '/pay.jpeg', // شحن الكتب الدراسية
      '4': '/pay.jpeg', // دفع المصروفات الدراسية
      '5': '/solveproblem.png', // حل وتسليم تكليفات
      '6': '/Certificatesofappreciation.png', // شهادات اونلاين
      '7': '/visual.png' // التقديم علي التحول الرقمي
    };

    const imagePath = customImages[service.id];
    
    if (imagePath) {
      return (
        <img 
          src={imagePath} 
          alt={service.nameAr}
          className="service-custom-icon"
          onError={(e) => {
            // Fallback to icon if image fails to load
            const target = e.target as HTMLImageElement;
            target.style.display = 'none';
            const parent = target.parentElement;
            if (parent) {
              parent.innerHTML = '';
              parent.appendChild(getServiceIcon(service.icon) as any);
            }
          }}
        />
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
