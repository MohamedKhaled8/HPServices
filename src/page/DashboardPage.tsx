import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';

import { checkIsAdmin, subscribeToServiceSettings, subscribeToLatestNews, subscribeToQuickNotification, subscribeToAdminPreferences } from '../services/firebaseService';
import { ServiceSettings } from '../types';
import '../styles/DashboardPage.css';
import '../styles/GeometricShapes.css';
import {
  User, LogOut, Settings, Book,
  Search, Star, Zap, Menu, X, CheckCircle, Shield,
  GraduationCap, ClipboardList, Package, CreditCard, CheckSquare, Award, FileCheck, Phone, Mail, MapPin, ChevronRight,
  Facebook, Linkedin, Github, MessageCircle,
  Truck, ScrollText, PenTool, MonitorSmartphone, Library, BookOpen, Crown, Wallet, ClipboardEdit, Bell, Sparkles
} from 'lucide-react';

interface DashboardPageProps {
  onServiceClick: (serviceId: string) => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onAdminClick?: () => void;
  onAssignmentsClick: () => void;
  onRequestsClick: () => void;
  onNewsClick: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  // Generic mappings
  'clipboard-list': ClipboardList,
  'user': User,
  'package': Package,
  'creditcard': CreditCard,
  'checklist': CheckSquare,
  'award': Award,
  'zap': Zap,
  'search': Search,
  'graduation-cap': GraduationCap,
  'file-check': FileCheck,

  // Mapping JSON filenames to Icons (Smart Replace)
  'Writing.json': ClipboardEdit,   // سجل بياناتك
  'vip.json': Crown,               // العميل المميز
  'shipping.json': Truck,          // شحن الكتب
  'payment.json': Wallet,          // دفع المصروفات
  'Books.json': BookOpen,          // المراجعة النهائية
  'Fees.json': CreditCard,         // احتياطي
  'Diploma.json': ScrollText,      // الدبلومة
  'solve.json': PenTool,           // حل التكليفات
  'Certificate.json': Award,       // الشهادات
  'TEchnology.json': MonitorSmartphone, // التحول الرقمي
  'Graduation.json': GraduationCap // مشروع التخرج
};

// --- Memoized Hero Slideshow Component to prevent Dashboard re-renders ---
const HeroSlideshow = React.memo(({ images }: { images: string[] }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    let interval: any;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % images.length);
          }, 4000);
        } else {
          if (interval) clearInterval(interval);
        }
      },
      { threshold: 0.1 }
    );

    const hero = document.querySelector('.hero-pure');
    if (hero) observer.observe(hero);

    return () => {
      if (interval) clearInterval(interval);
      if (hero) observer.unobserve(hero);
    };
  }, [images.length]);

  return (
    <div className="hero-slides">
      {images.map((src, index) => {
        const isCurrent = index === currentIndex;

        // Render all images to keep them preloaded, but only active ones have opacity
        // However, to be super smooth, we just need current and the one before it
        const isPrev = index === (currentIndex - 1 + images.length) % images.length;
        if (!isCurrent && !isPrev) return null;

        return (
          <div
            key={src}
            className={`hero-slide ${isCurrent ? 'active' : 'prev'}`}
            style={{
              backgroundImage: `url(${src.replace(/\.JPG/i, '.webp')})`,
              zIndex: isCurrent ? 5 : 4 // Current on top
            }}
          ></div>
        );
      })}
    </div>
  );
});

const DashboardPage: React.FC<DashboardPageProps> = ({
  onServiceClick,
  onProfileClick,
  onLogout,
  onAdminClick,
  onAssignmentsClick,
  onRequestsClick,
  onNewsClick
}) => {
  const { student } = useStudent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [hoveredServiceId, setHoveredServiceId] = useState<string | null>(null);
  const [serviceSettings, setServiceSettings] = useState<ServiceSettings>({});
  const [adminPrefs, setAdminPrefs] = useState<any>({ serviceOrder: [], profitCosts: {} });

  const promoImages = [
    "/images/optimized/0T8A9628.JPG",
    "/images/optimized/0T8A9638.JPG",
    "/images/optimized/0T8A9717.JPG",
    "/images/optimized/0T8A9748.JPG",
    "/images/optimized/0T8A9887.JPG",
    "/images/optimized/0T8A9970.JPG",
    "/images/optimized/4W3A0163.JPG",
    "/images/optimized/4W3A0166.JPG",
    "/images/optimized/4W3A0167.JPG",
    "/images/optimized/4W3A0215.JPG",
    "/images/optimized/4W3A0388.JPG",
    "/images/optimized/4W3A0410.JPG",
    "/images/optimized/4W3A0434.JPG"
  ];


  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let scrollTimeout: any = null;
    const handleScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        const isPastThreshold = window.scrollY > 20;
        setScrolled(isPastThreshold);
        scrollTimeout = null;
      }, 100);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, []);

  // State for mobile view detection
  const [isMobileView, setIsMobileView] = useState(window.innerWidth <= 900);

  // News Popup State
  const [newsPopupOpen, setNewsPopupOpen] = useState(false);
  const [latestNewsData, setLatestNewsData] = useState<any>(null);
  const [quickNotification, setQuickNotification] = useState<{ content: string; id: string } | null>(null);
  const [showQuickNotify, setShowQuickNotify] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToLatestNews((news) => {
      if (news && news.content) {
        setLatestNewsData(news);

        // استخراج الـ timestamp الحالي للخبر
        const currentNewsTimestamp = news.updatedAt?.seconds ||
          (news.updatedAt instanceof Date ? news.updatedAt.getTime() / 1000 :
            (typeof news.updatedAt === 'string' ? new Date(news.updatedAt).getTime() / 1000 : 0));

        // لا تظهر البوب أب إذا لم يكن هناك timestamp حقيقي
        if (!currentNewsTimestamp || currentNewsTimestamp === 0) return;

        // تحقق من localStorage: إذا كان المستخدم شاهد هذا الخبر من قبل، لا تُظهره
        const lastSeenTimestamp = localStorage.getItem('lastSeenNewsDate');
        if (lastSeenTimestamp && Number(lastSeenTimestamp) >= currentNewsTimestamp) return;

        // الخبر جديد ولم يُشاهَد → احفظه في localStorage وأظهره لمرة واحدة فقط
        localStorage.setItem('lastSeenNewsDate', String(currentNewsTimestamp));
        setTimeout(() => setNewsPopupOpen(true), 2000);
      }
    });

    const unsubscribeQuick = subscribeToQuickNotification((data) => {
      if (data && data.content && data.id) {
        // تحقق من localStorage: هل رأى المستخدم هذه الرسالة مسبقاً؟
        const localKey = `quick_seen_${data.id}`;
        if (localStorage.getItem(localKey)) return;

        // الرسالة جديدة → ضع علامة في localStorage وأظهرها مرة واحدة فقط للأبد
        localStorage.setItem(localKey, '1');
        setQuickNotification(data);
        setShowQuickNotify(true);
        // إخفاء تلقائي بعد 6 ثوانٍ
        setTimeout(() => setShowQuickNotify(false), 6000);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeQuick();
    };
  }, []);

  const handleCloseNewsPopup = () => {
    setNewsPopupOpen(false);
  };


  console.log('📱 Dashboard Layout Debug: Is Mobile?', isMobileView, 'Width:', window.innerWidth);

  useEffect(() => {
    const handleResize = () => setIsMobileView(window.innerWidth <= 900);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (student?.id) {
        const adminStatus = await checkIsAdmin(student.id);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();

    // Subscribe to service settings
    const unsubscribe = subscribeToServiceSettings((settings) => {
      setServiceSettings(settings);
    });

    // Subscribe to admin preferences
    const unsubscribePrefs = subscribeToAdminPreferences((prefs) => {
      setAdminPrefs(prefs);
    });

    return () => {
      unsubscribe();
      unsubscribePrefs();
    }
  }, [student]);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour >= 4 && hour < 12) {
      setGreeting('صباح الخير');
    } else {
      setGreeting('مساء الخير');
    }
  }, []);

  const getFirstName = (fullName: string): string => fullName.split(' ')[0];

  // Render optimized icons with CSS animation instead of heavy Lottie files
  const renderServiceIcon = (serviceId: string, iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || Book;

    return (
      <div className="service-icon-wrapper">
        <IconComponent
          size={48}
          strokeWidth={1.5}
          className="service-icon-svg"
        />
      </div>
    );
  };

  // Optimized Native Smooth Scroll (Lag-Free)
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;

    const navHeight = 80;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - navHeight;

    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  };



  return (
    <div className={`dashboard-page ${isMobileMenuOpen ? 'is-menu-open' : ''}`}>
      {/* Real Geometric Shapes Throughout Body */}
      <div className={`body-geometric-shapes ${scrolled ? 'is-scrolled' : ''} ${isMobileMenuOpen ? 'is-menu-open' : ''}`}>
        {/* Optimized Geometric Background */}
        <div className="geo-shape geo-circle-1"></div>
        <div className="geo-shape geo-triangle-1"></div>
        <div className="geo-shape geo-square-1"></div>
        <div className="geo-shape geo-circle-2"></div>
        <div className="geo-shape geo-hexagon-1"></div>
        <div className="geo-shape geo-circle-3"></div>
      </div>

      {/* Navbar */}
      {/* Navbar - Fully Responsive */}
      <nav className={`dashboard-navbar ${scrolled ? 'scrolled' : ''}`}>

        {/* Right Side: Brand */}
        <div className="nav-brand">
          <img src="/لوجو اتش بي .jpg.jpeg" alt="HP" className="nav-logo-img" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <span>HP Services</span>
        </div>

        {/* Center: Links (Automatically hidden on tablet/mobile by CSS) */}
        <div className="nav-links-container">
          <span className="nav-link-item" onClick={() => scrollToSection('services')}>الخدمات</span>
          <span className="nav-link-item" onClick={onNewsClick}>أخر الأخبار</span>
          <span className="nav-link-item" onClick={() => scrollToSection('about')}>من نحن</span>
        </div>

        {/* Left Side: Actions */}
        <div className="nav-right-actions">

          {/* Mobile Toggle Button (Visible only when links are hidden) */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          {/* Desktop Profile */}
          <div className="nav-profile-container desktop-only-profile">
            {isAdmin && onAdminClick && (
              <button className="logout-btn-minimal" onClick={onAdminClick} title="Admin" style={{ background: 'rgba(255,255,255,0.1)', color: 'white', marginRight: '8px' }}>
                <Shield size={20} />
              </button>
            )}

            <div
              className="unique-profile-badge"
              onClick={() => setShowProfileMenu(prev => !prev)}
            >
              <div className="profile-text">
                <span className="profile-name">{student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'زائر'}</span>
                <span className="profile-track">
                  {student?.course || 'عضو جديد'} <ChevronRight size={10} style={{ transform: 'rotate(90deg)' }} />
                </span>
              </div>
              <div className="profile-avatar-hexagon">
                {student?.fullNameArabic ? student.fullNameArabic.charAt(0) : 'U'}
              </div>
            </div>
          </div>

          {showProfileMenu && (
            <div className="profile-dropdown-menu">
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={() => {
                  setShowProfileMenu(false);
                  onProfileClick();
                }}
              >
                <User size={16} className="ml-2" />
                الملف الشخصي
              </button>
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={() => {
                  setShowProfileMenu(false);
                  onRequestsClick();
                }}
              >
                <ClipboardList size={16} className="ml-2" />
                الطلبات الموافق عليها
              </button>
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={() => {
                  setShowProfileMenu(false);
                  onAssignmentsClick();
                }}
              >
                <Book size={16} className="ml-2" />
                التكليفات الدراسية
              </button>
              <div style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }}></div>
              <button
                type="button"
                className="profile-dropdown-item"
                onClick={onLogout}
                style={{ color: '#ef4444' }}
              >
                <LogOut size={16} className="ml-2" />
                تسجيل خروج
              </button>
            </div>
          )}
          <button className="logout-btn-minimal" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {/* Mobile Menu Overlay */}
      {
        isMobileMenuOpen && (
          <div className="mobile-menu-overlay">
            <button className="mobile-menu-close" onClick={() => setIsMobileMenuOpen(false)}>
              <X size={32} color="white" />
            </button>

            <div className="mobile-menu-content">
              {/* Profile in Mobile Menu */}
              <div className="mobile-profile-section" onClick={onProfileClick} style={{ textAlign: 'center', marginBottom: '30px' }}>
                <div className="profile-avatar-hexagon" style={{ width: '80px', height: '80px', fontSize: '32px', margin: '0 auto' }}>
                  {student?.fullNameArabic ? student.fullNameArabic.charAt(0) : 'U'}
                </div>
                <h3 style={{ color: 'white', marginTop: '16px', fontSize: '20px' }}>{student?.fullNameArabic || 'زائر'}</h3>
                <p style={{ color: '#94a3b8', fontSize: '14px' }}>{student?.course}</p>
              </div>


              <span className="mobile-nav-link" onClick={() => { scrollToSection('services'); setIsMobileMenuOpen(false); }}>الخدمات</span>
              <span className="mobile-nav-link" onClick={() => { onNewsClick(); setIsMobileMenuOpen(false); }}>أخر الأخبار</span>
              <span className="mobile-nav-link" onClick={() => { scrollToSection('about'); setIsMobileMenuOpen(false); }}>من نحن</span>

              <span className="mobile-nav-link" onClick={() => { onProfileClick(); setIsMobileMenuOpen(false); }}>
                <User size={20} className="ml-2" /> الملف الشخصي
              </span>
              <span className="mobile-nav-link" onClick={() => { onRequestsClick(); setIsMobileMenuOpen(false); }}>
                <ClipboardList size={20} className="ml-2" /> الطلبات الموافق عليها
              </span>
              <span className="mobile-nav-link" onClick={() => { onAssignmentsClick(); setIsMobileMenuOpen(false); }}>
                <Book size={20} className="ml-2" /> التكليفات الدراسية
              </span>

              {isAdmin && onAdminClick && (
                <span className="mobile-nav-link" onClick={() => { onAdminClick(); setIsMobileMenuOpen(false); }}>
                  <Settings size={20} className="ml-2" /> لوحة الأدمن
                </span>
              )}

              <span className="mobile-nav-link logout" onClick={onLogout}>
                <LogOut size={20} className="ml-2" /> تسجيل خروج
              </span>
            </div>
          </div>
        )
      }


      <header className="hero-pure">
        <HeroSlideshow images={promoImages} />
        <div className="hero-content">
          <h1 className="hero-title">
            {greeting}، {student?.fullNameArabic ? `أ / ${getFirstName(student.fullNameArabic)}` : 'عزيزي الطالب'}
          </h1>
          <p className="hero-subtitle">
            خطوتك الأولى نحو التميز الأكاديمي تبدأ من هنا.
          </p>
        </div>
      </header>

      {/* stats removed per request */}

      {/* Services Grid */}
      <main className="services-section" id="services">
        <div className="section-header">
          <h2 className="section-title">اختر خدماتك من هنا</h2>
          <div className="title-decoration"></div>
        </div>

        <div className="services-grid">

          {
            [...SERVICES]
              .sort((a, b) => {
                const orderA = adminPrefs.serviceOrder?.indexOf(a.id) ?? -1;
                const orderB = adminPrefs.serviceOrder?.indexOf(b.id) ?? -1;
                const rankA = orderA === -1 ? 999 : orderA;
                const rankB = orderB === -1 ? 999 : orderB;
                return rankA - rankB;
              })
              .map((service) => {
                const isActive = serviceSettings[service.id] !== false; // Default to true if not set
                const isClickable = isActive;

                return (
                  <div
                    key={service.id}
                    className={`service-card-premium ${!isActive ? 'service-disabled' : ''}`}
                    onClick={() => isClickable && onServiceClick(service.id)}
                    onMouseEnter={() => isClickable && setHoveredServiceId(service.id)}
                    onMouseLeave={() => setHoveredServiceId(null)}
                    style={{
                      '--card-color': isActive ? service.color : '#94a3b8',
                      cursor: isClickable ? 'pointer' : 'not-allowed',
                      filter: !isActive ? 'grayscale(1)' : 'none',
                      opacity: !isActive ? 0.8 : 1
                    } as React.CSSProperties}
                  >
                    <div className="service-icon mb-4 transform transition-transform duration-300 group-hover:scale-110">
                      {renderServiceIcon(service.id, service.icon)}
                    </div>
                    <h3 className="card-title">{service.nameAr}</h3>
                    <p className="card-desc">{service.descriptionAr}</p>

                    <div className="card-action-oval">
                      {isActive ? (
                        <>بدء الخدمة <ChevronRight size={16} /></>
                      ) : (
                        <span>الخدمة ستتوفر قريبا</span>
                      )}
                    </div>
                  </div>
                );
              })
          }
        </div>

      </main>

      {/* Footer & About */}
      <div className="footer-clipped-wrapper" id="about">
        <footer className="library-info-footer">
          <div className="footer-main-grid">
            <div className="footer-about">
              <h2>HP Services</h2>
              <p>
                منصتك الرقمية المتكاملة لخدمات التعليم الجامعي وما بعد الجامعي.
                نعمل على توفير وقتك وجهدك من خلال حلول ذكية ومبتكرة.
              </p>
              <div className="footer-contact-card">
                <h3 style={{ marginBottom: 20 }}>تواصل معنا</h3>
                <a
                  href="https://wa.me/201050889596?text=%D8%A7%D9%84%D8%B3%D9%84%D8%A7%D9%85%20%D8%B9%D9%84%D9%8A%D9%83%D9%85"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-item-link"
                  style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16, textDecoration: 'none', color: 'inherit' }}
                >
                  <Phone size={20} color="#F59E0B" /> <span>01050889596 (واتساب)</span>
                </a>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
                  <Mail size={20} color="#F59E0B" /> <span>support@hpservices.com</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
                  <MapPin size={20} color="#F59E0B" /> <span style={{ lineHeight: '1.4' }}>المنوفية , مدينة السادات , سوق المنطقة السابعة التجاري , اول شارع كليه تربية عام</span>
                </div>
                <a
                  href="https://www.facebook.com/hpsadat1"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-item-link"
                  style={{ display: 'flex', alignItems: 'center', gap: 15, textDecoration: 'none', color: 'inherit' }}
                >
                  <Facebook size={20} color="#F59E0B" /> <span>صفحتنا على فيسبوك</span>
                </a>
              </div>

              <div className="features-list">
                <div className="feature-pill">
                  <CheckCircle size={18} color="#10B981" /> <span>دعم فني</span>
                </div>
                <div className="feature-pill">
                  <Shield size={18} color="#10B981" /> <span>أمان تام</span>
                </div>
                <div className="feature-pill">
                  <Zap size={18} color="#10B981" /> <span>سرعة فائقة</span>
                </div>
                <div className="feature-pill">
                  <Star size={18} color="#10B981" /> <span>جودة عالية</span>
                </div>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 HP Services. جميع الحقوق محفوظة.</span>
            <div className="developer-credits">
              <span className="powered-by">Powered By Eng. Mohamed Khaled</span>
              <div className="social-links">
                <a href="https://www.facebook.com/mohamedkhaled.khalil.5/" target="_blank" rel="noopener noreferrer" className="social-link facebook">
                  <Facebook size={18} />
                </a>
                <a href="https://www.linkedin.com/in/mohamed-khaled-0341a2224" target="_blank" rel="noopener noreferrer" className="social-link linkedin">
                  <Linkedin size={18} />
                </a>
                <a href="https://github.com/MohamedKhaled8" target="_blank" rel="noopener noreferrer" className="social-link github">
                  <Github size={18} />
                </a>
                <a href="https://wa.me/201026331866" target="_blank" rel="noopener noreferrer" className="social-link whatsapp">
                  <MessageCircle size={18} />
                </a>
              </div>
            </div>
          </div>
        </footer>
      </div>


      {/* News Popup Modal */}
      {newsPopupOpen && latestNewsData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(3px)'
        }}>
          <div style={{
            background: 'white', borderRadius: '16px',
            width: '90%', maxWidth: '500px', overflow: 'hidden',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            animation: 'slideUp 0.4s ease-out',
            direction: 'rtl'
          }}>
            <div style={{
              background: 'linear-gradient(90deg, #2563EB 0%, #3B82F6 100%)',
              padding: '20px', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Bell size={24} fill="white" />
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>تم إضافة خبر جديد</h3>
              </div>
              <button onClick={handleCloseNewsPopup} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>
            <div style={{ padding: '24px', maxHeight: '60vh', overflowY: 'auto' }}>
              <p style={{ whiteSpace: 'pre-line', lineHeight: '1.6', color: '#1f2937', fontSize: '1rem', margin: 0 }}>
                {latestNewsData.content.length > 150
                  ? `${latestNewsData.content.substring(0, 150)}...`
                  : latestNewsData.content}
              </p>
            </div>
            <div style={{
              padding: '16px 24px', borderTop: '1px solid #E5E7EB', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: '#F9FAFB'
            }}>
              <button onClick={handleCloseNewsPopup} style={{
                padding: '8px 20px', borderRadius: '8px', border: '1px solid #D1D5DB',
                background: 'white', color: '#374151', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s'
              }}>
                إلغاء
              </button>
              <button onClick={() => { handleCloseNewsPopup(); onNewsClick(); }} style={{
                padding: '8px 20px', borderRadius: '8px', border: 'none',
                background: '#2563EB', color: 'white', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s'
              }}>
                أخر الأخبار <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Real-time Notification (Celebration Style) */}
      {showQuickNotify && quickNotification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10000,
          animation: 'celebratePulse 0.5s ease-out',
          pointerEvents: 'none',
          width: '90%',
          maxWidth: '500px',
          direction: 'rtl'
        }}>
          <div style={{
            background: 'white',
            borderRadius: '24px',
            padding: '20px 30px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
            border: '2px solid transparent',
            backgroundImage: 'linear-gradient(white, white), linear-gradient(135deg, #FFD700, #F59E0B, #FFD700)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            display: 'flex',
            alignItems: 'center',
            gap: '20px'
          }}>
            <div style={{
              background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)',
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 16px -4px rgba(245, 158, 11, 0.4)',
              flexShrink: 0
            }}>
              <Sparkles size={32} color="white" />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ margin: '0 0 4px 0', color: '#B45309', fontSize: '1.1rem', fontWeight: '800' }}>رسالة سريعة من الإدارة</h4>
              <p style={{ margin: 0, color: '#1F2937', fontSize: '1rem', fontWeight: '600', lineHeight: '1.5' }}>
                {quickNotification.content}
              </p>
            </div>
          </div>

          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none' }}>
            {[...Array(15)].map((_, i) => (
              <div key={i} className={`confetti-p p${i}`} style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: i % 2 === 0 ? '8px' : '6px',
                height: i % 2 === 0 ? '8px' : '10px',
                backgroundColor: ['#FFD700', '#F59E0B', '#10B981', '#3B82F6', '#EF4444', '#8B5CF6'][i % 6],
                borderRadius: i % 3 === 0 ? '50%' : '2px',
                opacity: 0
              }} />
            ))}
          </div>

          <style>{`
            @keyframes celebratePulse {
              0% { transform: translate(-50%, -100px) scale(0.8); opacity: 0; }
              70% { transform: translate(-50%, 20px) scale(1.05); opacity: 1; }
              100% { transform: translate(-50%, 0) scale(1); opacity: 1; }
            }
            ${[...Array(15)].map((_, i) => `
              .p${i} { animation: confetti-f${i} 4s ease-out forwards; }
              @keyframes confetti-f${i} {
                0% { transform: translate(0, 0) rotate(0); opacity: 1; }
                100% { transform: translate(${(Math.random() - 0.5) * 800}px, ${(Math.random() - 0.5) * 800}px) rotate(${Math.random() * 720}deg); opacity: 0; }
              }
            `).join('')}
          `}</style>
        </div>
      )}

    </div>
  );
};


export default DashboardPage;