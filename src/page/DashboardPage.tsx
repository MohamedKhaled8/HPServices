import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { checkIsAdmin } from '../services/firebaseService';
import '../styles/DashboardPage.css';
import '../styles/GeometricShapes.css';
import {
  User, LogOut, Settings, Book,
  Search, Star, Zap, Menu, X, CheckCircle, Shield,
  GraduationCap, ClipboardList, Package, CreditCard, CheckSquare, Award, FileCheck, Phone, Mail, MapPin, ChevronRight,
  Facebook, Linkedin, Github, MessageCircle
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
  onRequestsClick,
  onNewsClick
}) => {
  const { student } = useStudent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [greeting, setGreeting] = useState('');
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);



  const [currentImageIndex, setCurrentImageIndex] = useState(0);
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
    const interval = setInterval(() => {
      setCurrentImageIndex((prev) => (prev + 1) % promoImages.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [promoImages.length]);

  useEffect(() => {
    let scrollTimeout: any;
    const geoContainer = document.querySelector('.body-geometric-shapes');

    const handleScroll = () => {
      const isPastThreshold = window.scrollY > 20;
      setScrolled(prev => prev !== isPastThreshold ? isPastThreshold : prev);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearTimeout(scrollTimeout);
    };
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
    if (iconName && iconName.toLowerCase().endsWith('.json')) {
      return (
        <div className="lottie-icon-container" style={{
          width: '130px',
          height: '130px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '-20px',
          pointerEvents: 'none',
          position: 'relative',
          zIndex: 5
        }}>
          {/* @ts-ignore */}
          <lottie-player
            src={`/json/${iconName}`}
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
        {/* Richer Geometric Background - Floating on scroll */}
        <div className="geo-shape geo-circle-1"></div>
        <div className="geo-shape geo-triangle-1"></div>
        <div className="geo-shape geo-square-1"></div>
        <div className="geo-shape geo-diamond-1"></div>
        <div className="geo-shape geo-circle-2"></div>

        <div className="geo-shape geo-hexagon-1"></div>
        <div className="geo-shape geo-square-2"></div>
        <div className="geo-shape geo-triangle-2"></div>
        <div className="geo-shape geo-circle-3"></div>
        <div className="geo-shape geo-square-3"></div>

        <div className="geo-shape geo-triangle-3"></div>
        <div className="geo-shape geo-circle-4"></div>
        <div className="geo-shape geo-diamond-2"></div>
        <div className="geo-shape geo-hexagon-2"></div>

        <div className="geo-shape geo-circle-5"></div>
        <div className="geo-shape geo-square-4"></div>
        <div className="geo-shape geo-triangle-4"></div>
        <div className="geo-shape geo-pentagon-2"></div>
        <div className="geo-shape geo-circle-6"></div>
        <div className="geo-shape geo-diamond-3"></div>
        <div className="geo-shape geo-circle-7"></div>
        <div className="geo-shape geo-square-5"></div>
        <div className="geo-shape geo-pentagon-1"></div>

        {/* Extra Lush Shapes for Desktop */}
        <div className="geo-shape geo-circle-8 geo-lush"></div>
        <div className="geo-shape geo-square-6 geo-lush"></div>
        <div className="geo-shape geo-triangle-5 geo-lush"></div>
        <div className="geo-shape geo-diamond-4 geo-lush"></div>
        <div className="geo-shape geo-hexagon-3 geo-lush"></div>
        <div className="geo-shape geo-circle-9 geo-lush"></div>
        <div className="geo-shape geo-square-7 geo-lush"></div>
        <div className="geo-shape geo-diamond-5 geo-lush"></div>
        <div className="geo-shape geo-circle-10 geo-lush"></div>
        <div className="geo-shape geo-triangle-6 geo-lush"></div>
        <div className="geo-shape geo-pentagon-3 geo-lush"></div>
        <div className="geo-shape geo-circle-11 geo-lush"></div>
        <div className="geo-shape geo-square-8 geo-lush"></div>
        <div className="geo-shape geo-diamond-6 geo-lush"></div>
        <div className="geo-shape geo-circle-12 geo-lush"></div>
        <div className="geo-shape geo-pentagon-4 geo-lush"></div>
      </div>

      {/* Navbar */}
      {/* Navbar - Fully Responsive */}
      <nav className={`dashboard-navbar ${scrolled ? 'scrolled' : ''}`}>

        {/* Right Side: Brand */}
        <div className="nav-brand">
          <img src="/لوجو اتش بي .jpg.jpeg" alt="HP" className="nav-logo-img" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
          <span>HP Services</span>
        </div>

        {/* Center: Links (Hidden on Mobile) */}
        <div className="nav-links desktop-only">
          <span className="nav-link" onClick={() => scrollToSection('services')}>الخدمات</span>
          <span className="nav-link" onClick={onNewsClick}>أخر الأخبار</span>
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
              <span className="mobile-nav-link" onClick={() => { onNewsClick(); setIsMobileMenuOpen(false); }}>أخر الأخبار</span>
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

      {/* Clipper Hero with Slideshow Background */}
      <header className="hero-pure">
        <div className="hero-slides">
          {promoImages.map((src, index) => (
            <div
              key={index}
              className={`hero-slide ${index === currentImageIndex ? 'active' : ''}`}
              style={{ backgroundImage: `url(${src.replace(/\.JPG/i, '.webp')})` }}
            ></div>
          ))}
        </div>
        <div className="hero-content">
          <h1 className="hero-title">
            {greeting}، {student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'عزيزي الطالب'}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                <MapPin size={20} color="#F59E0B" /> <span>القاهرة، مصر</span>
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


    </div>
  );
};


export default DashboardPage;
