import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { checkIsAdmin } from '../services/firebaseService';
import '../styles/DashboardPage.css';
import '../styles/GeometricShapes.css';
import {
  User, LogOut, Settings, Book,
  Search, Star,
  CheckCircle, Zap, Shield, BookOpen, Menu, X,
  Library, GraduationCap, ClipboardList, Package, CreditCard, CheckSquare, Award, FileCheck, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';

interface DashboardPageProps {
  onServiceClick: (serviceId: string) => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onAdminClick?: () => void;
  onAssignmentsClick: () => void;
  onRequestsClick: () => void;
}

const ICON_MAP: Record<string, React.ElementType> = {
  'clipboard-list': ClipboardList,
  'user': User,
  'package': Package,
  'creditcard': CreditCard,
  'checklist': CheckSquare,
  'award': Award,
  'zap': Zap,
  'search': Search,
  'graduation-cap': GraduationCap,
  'file-check': FileCheck
};

const DashboardPage: React.FC<DashboardPageProps> = ({
  onServiceClick,
  onProfileClick,
  onLogout,
  onAdminClick,
  onAssignmentsClick,
  onRequestsClick
}) => {
  const { student } = useStudent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const promoImages = [
    "/images/1.jpg",
    "/images/2.jpg",
    "/images/5.jpg",
    "/images/6.jpg",
    "/images/7.jpg",
    "/images/10.jpg"
  ];


  // Scroll to top on mount
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % promoImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [promoImages.length]);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (student?.id) {
        const adminStatus = await checkIsAdmin(student.id);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
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

  const getIcon = (iconName: string) => {
    const IconComponent = ICON_MAP[iconName] || Book;
    return <IconComponent size={32} strokeWidth={2} />;
  };

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="dashboard-page">
      {/* Real Geometric Shapes Throughout Body */}
      <div className="body-geometric-shapes">
        {/* Top Section */}
        <div className="geo-shape geo-circle-1"></div>
        <div className="geo-shape geo-triangle-1"></div>
        <div className="geo-shape geo-square-1"></div>
        <div className="geo-shape geo-diamond-1"></div>
        <div className="geo-shape geo-circle-2"></div>

        {/* Upper-Middle Section */}
        <div className="geo-shape geo-hexagon-1"></div>
        <div className="geo-shape geo-square-2"></div>
        <div className="geo-shape geo-triangle-2"></div>
        <div className="geo-shape geo-pentagon-1"></div>
        <div className="geo-shape geo-circle-3"></div>

        {/* Lower-Middle Section */}
        <div className="geo-shape geo-square-3"></div>
        <div className="geo-shape geo-circle-4"></div>
        <div className="geo-shape geo-triangle-3"></div>
        <div className="geo-shape geo-diamond-2"></div>
        <div className="geo-shape geo-hexagon-2"></div>

        {/* Bottom Section */}
        <div className="geo-shape geo-circle-5"></div>
        <div className="geo-shape geo-square-4"></div>
        <div className="geo-shape geo-triangle-4"></div>
        <div className="geo-shape geo-pentagon-2"></div>
        <div className="geo-shape geo-circle-6"></div>
        <div className="geo-shape geo-diamond-3"></div>
        <div className="geo-shape geo-circle-7"></div>
        <div className="geo-shape geo-square-5"></div>
      </div>

      {/* Navbar */}
      {/* Navbar - Fully Responsive */}
      <nav className={`dashboard-navbar ${scrolled ? 'scrolled' : ''}`}>

        {/* Right Side: Brand */}
        <div className="nav-brand">
          <BookOpen size={32} />
          <span>HP Services</span>
        </div>

        {/* Center: Links (Hidden on Mobile) */}
        <div className="nav-links desktop-only">
          <span className="nav-link" onClick={() => scrollToSection('services')}>الخدمات</span>
          <span className="nav-link" onClick={() => scrollToSection('about')}>من نحن</span>
        </div>

        {/* Left Side: Actions */}
        <div className="nav-right-actions">

          {/* Mobile Toggle Button */}
          <button
            className="mobile-menu-toggle"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle Menu"
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>

          {/* Desktop Profile (Hidden on Mobile) */}
          <div className="nav-profile-container desktop-only">
            {isAdmin && onAdminClick && (
              <button className="logout-btn-minimal" onClick={onAdminClick} title="Admin" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <Settings size={18} />
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
        </div>

        {/* Mobile Menu Overlay */}
        {isMobileMenuOpen && (
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

              <div className="mobile-menu-divider"></div>

              <span className="mobile-nav-link" onClick={() => { scrollToSection('services'); setIsMobileMenuOpen(false); }}>الخدمات</span>
              <span className="mobile-nav-link" onClick={() => { scrollToSection('about'); setIsMobileMenuOpen(false); }}>من نحن</span>

              <div className="mobile-menu-divider"></div>

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
        )}
      </nav>

      {/* Clipper Hero */}
      <header className="hero-pure">
        <div className="hero-content">
          <h1 className="hero-title">
            {greeting}، {student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'عزيزي الطالب'}
          </h1>
          <p className="hero-subtitle">
            خطوتك الأولى نحو التميز الأكاديمي تبدأ من هنا.
          </p>
        </div>
      </header>

      {/* Stats */}
      <div className="stats-container">
        <div className="stat-box">
          <div className="stat-icon-wrapper" style={{ color: '#10B981', background: '#ECFDF5' }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <span style={{ display: 'block', fontWeight: 700 }}>نشط</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>حالة الحساب</span>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon-wrapper" style={{ color: '#3B82F6', background: '#EFF6FF' }}>
            <Library size={24} />
          </div>
          <div>
            <span style={{ display: 'block', fontWeight: 700 }}>{student?.course || 'التخصص غير محدد'}</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>
              مسارك: <strong style={{ color: '#4F46E5' }}>{student?.track || 'غير محدد'}</strong>
            </span>
          </div>
        </div>
        <div className="stat-box">
          <div className="stat-icon-wrapper" style={{ color: '#F59E0B', background: '#FFFBEB' }}>
            <Shield size={24} />
          </div>
          <div>
            <span style={{ display: 'block', fontWeight: 700 }}>أساسي</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>نوع العضوية</span>
          </div>
        </div>
      </div>

      {/* Services Grid */}
      <main className="services-section" id="services">
        <div className="section-header">
          <h2 className="section-title">الخدمات المتاحة</h2>
          <div className="title-decoration"></div>
        </div>

        <div className="services-grid">
          {SERVICES.map((service) => (
            <div
              key={service.id}
              className="service-card-premium"
              onClick={() => onServiceClick(service.id)}
              style={{ '--card-color': service.color } as React.CSSProperties}
            >
              <div className="card-icon-float">
                {getIcon(service.icon)}
              </div>
              <h3 className="card-title">{service.nameAr}</h3>
              <p className="card-desc">{service.descriptionAr}</p>

              <div className="card-action-oval">
                بدء الخدمة <ChevronRight size={16} />
              </div>
            </div>
          ))}
        </div>

        {/* New Added Section based on User Image */}
        <div className="additional-info-section">


          <div className="promo-banner-card">
            <div className="promo-image-side">
              {promoImages.map((src, index) => (
                <img
                  key={index}
                  src={src}
                  alt={`Study Success ${index + 1}`}
                  className={`promo-carousel-img ${index === currentImageIndex ? 'active' : ''}`}
                />
              ))}
            </div>
            <div className="promo-content-side">
              <h2>طريقك نحو التميز الدراسي يبدأ بخطوة واحدة معنا</h2>
              <p>
                انضم إلى آلاف الطلاب الذين وثقوا في خدماتنا التعليمية. نحن نوفر لك البيئة المثالية
                والخبرات اللازمة لتطوير مهاراتك والتميز في مسارك التعليمي بكل سهولة واحترافية.
              </p>
            </div>
          </div>
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

            <div className="footer-contact-card">
              <h3 style={{ marginBottom: 20 }}>تواصل معنا</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
                <Phone size={20} color="#F59E0B" /> <span>01050889596</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15, marginBottom: 16 }}>
                <Mail size={20} color="#F59E0B" /> <span>support@hpservices.com</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                <MapPin size={20} color="#F59E0B" /> <span>القاهرة، مصر</span>
              </div>
            </div>
          </div>

          <div className="footer-bottom">
            <span>© 2026 HP Services. جميع الحقوق محفوظة.</span>
            <span className="powered-by">Powered By Eng. Mohamed Khaled</span>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default DashboardPage;
