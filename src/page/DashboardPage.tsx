import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { checkIsAdmin } from '../services/firebaseService';
import '../styles/DashboardPage.css';
import {
  User, LogOut, Settings, Book,
  Search, ArrowLeft, Star,
  CheckCircle, Zap, Shield, BookOpen,
  Library, GraduationCap, ClipboardList, Package, CreditCard, CheckSquare, Award, FileCheck, Phone, Mail, MapPin, ChevronRight
} from 'lucide-react';

interface DashboardPageProps {
  onServiceClick: (serviceId: string) => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onAllUsersClick?: () => void;
  onAdminClick?: () => void;
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
  onAllUsersClick,
  onAdminClick
}) => {
  const { student } = useStudent();
  const [isAdmin, setIsAdmin] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [greeting, setGreeting] = useState('');

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
    if (hour < 12) setGreeting('صباح الخير');
    else if (hour < 18) setGreeting('مساء الخير');
    else setGreeting('مساء الخير');
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
      {/* Animated Blobs */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>
      <div className="bg-blob blob-3"></div>
      <div className="bg-wave"></div>

      {/* Navbar */}
      <nav className={`dashboard-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-brand">
          <BookOpen size={32} />
          <span>HP Services</span>
        </div>

        <div className="nav-links">
          <span className="nav-link" onClick={() => scrollToSection('services')}>الخدمات</span>
          <span className="nav-link" onClick={() => scrollToSection('about')}>من نحن</span>
        </div>

        <div className="nav-profile-container">
          {isAdmin && onAdminClick && (
            <button className="logout-btn-minimal" onClick={onAdminClick} title="Admin" style={{ background: 'rgba(255,255,255,0.2)', color: 'white' }}>
              <Settings size={18} />
            </button>
          )}

          <div className="unique-profile-badge" onClick={onProfileClick}>
            <div className="profile-text">
              <span className="profile-name">{student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'زائر'}</span>
              <span className="profile-track">
                {student?.track || 'عضو جديد'} <ChevronRight size={10} style={{ transform: 'rotate(90deg)' }} />
              </span>
            </div>
            <div className="profile-avatar-hexagon">
              {student?.fullNameArabic ? student.fullNameArabic.charAt(0) : 'U'}
            </div>
          </div>

          <button className="logout-btn-minimal" onClick={onLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
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
            <span style={{ display: 'block', fontWeight: 700 }}>{student?.track || '-'}</span>
            <span style={{ fontSize: 13, color: '#64748b' }}>المسار الحالي</span>
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
