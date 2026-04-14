import React, { useEffect } from 'react';
import { Service } from '../types';
import {
  Headphones, Package, Book, CreditCard, CheckCircle, Award, Zap,
  BookOpen, Search, Target, FileText, User, ClipboardList, FileCheck
} from 'lucide-react';
import '../styles/ServiceCard.css';

const LOTTIE_PLAYER_SCRIPT_SRC =
  'https://unpkg.com/@lottiefiles/lottie-player@latest/dist/lottie-player.js';

let lottiePlayerLoadPromise: Promise<void> | null = null;

function ensureLottiePlayerLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (customElements?.get?.('lottie-player')) return Promise.resolve();

  if (lottiePlayerLoadPromise) return lottiePlayerLoadPromise;

  lottiePlayerLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[data-lottie-player="true"]`
    );
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Failed to load lottie-player')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = LOTTIE_PLAYER_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.lottiePlayer = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load lottie-player'));
    document.head.appendChild(script);
  });

  return lottiePlayerLoadPromise;
}

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
  useEffect(() => {
    if (service.icon && service.icon.toLowerCase().endsWith('.json')) {
      // Load the web component only when needed.
      ensureLottiePlayerLoaded().catch(() => {
        // If it fails, we simply keep rendering; card will still show layout.
      });
    }
  }, [service.icon]);

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
