import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { checkIsAdmin } from '../services/firebaseService';
import '../styles/DashboardPage.css';
import {
  User, LogOut, Users, Settings, Bell,
  Search, ArrowLeft, Star, Clock,
  CheckCircle, Zap, Shield, BookOpen
} from 'lucide-react';
import * as Icons from 'lucide-react';

interface DashboardPageProps {
  onServiceClick: (serviceId: string) => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onAllUsersClick: () => void;
  onAdminClick?: () => void;
}

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

  // Handle scroll effect for navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Check admin status
  useEffect(() => {
    const checkAdmin = async () => {
      if (student?.id) {
        const adminStatus = await checkIsAdmin(student.id);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, [student]);

  // Set time-based greeting
  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('صباح الخير');
    else if (hour < 18) setGreeting('مساء الخير');
    else setGreeting('مساء الخير');
  }, []);

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  // Helper to get icon component
  const getIcon = (iconName: string) => {
    // @ts-ignore
    const IconComponent = Icons[iconName.charAt(0).toUpperCase() + iconName.slice(1)];
    return IconComponent ? <IconComponent size={24} /> : <Zap size={24} />;
  };

  // Categorize Services
  const featuredServices = SERVICES.filter(s => s.id === '2' || s.id === '9');
  const otherServices = SERVICES.filter(s => s.id !== '2' && s.id !== '9');

  return (
    <div className="dashboard-page">
      {/* Modern Navbar */}
      <nav className={`dashboard-navbar ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-brand">
          <div className="nav-logo-icon">HP</div>
          <span className="nav-logo-text">HP Services</span>
        </div>

        <div className="nav-actions">
          {isAdmin && onAdminClick && (
            <button className="nav-btn" onClick={onAdminClick} title="لوحة التحكم">
              <Settings size={20} />
            </button>
          )}

          <button className="nav-btn" onClick={onAllUsersClick} title="المستخدمين">
            <Users size={20} />
          </button>

          <div className="nav-profile" onClick={onProfileClick}>
            <div className="profile-avatar">
              {student?.fullNameArabic ? student.fullNameArabic.charAt(0) : 'U'}
            </div>
            <div className="profile-info">
              <span className="profile-name">{student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'الطالب'}</span>
              <span className="profile-role">{student?.track || 'طالب جديد'}</span>
            </div>
          </div>

          <button className="nav-btn logout" onClick={onLogout} title="تسجيل خروج">
            <LogOut size={20} />
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-welcome">
          <Star size={16} fill="#4F46E5" stroke="none" />
          <span>مرحباً بك في بوابتك التعليمية</span>
        </div>

        <h1 className="hero-title">
          {greeting}، {student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'عزيزي الطالب'} 👋
          <br />
          <span style={{ fontSize: '0.6em', fontWeight: 500, color: '#64748b' }}>
            نتمنى لك عاماً دراسياً مليئاً بالنجاح والتفوق
          </span>
        </h1>

        {/* Quick Stats Grid */}
        <div className="hero-stats">
          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#ecfdf5', color: '#10b981' }}>
              <CheckCircle size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">مفعل</span>
              <span className="stat-label">حالة الحساب</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
              <BookOpen size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">{student?.track || 'غير محدد'}</span>
              <span className="stat-label">المسار الحالي</span>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-icon" style={{ background: '#f5f3ff', color: '#8b5cf6' }}>
              <Shield size={24} />
            </div>
            <div className="stat-content">
              <span className="stat-value">أساسي</span>
              <span className="stat-label">نوع العضوية</span>
            </div>
          </div>
        </div>
      </header>

      {/* Services Section */}
      <main className="dashboard-main">
        {/* Featured Services */}
        <div className="services-container">
          <h2 className="section-title">خدمات مميزة</h2>
          <div className="services-grid">
            {featuredServices.map(service => (
              <div
                key={service.id}
                className="service-card-modern"
                onClick={() => onServiceClick(service.id)}
                style={{ '--card-color': service.color } as React.CSSProperties}
              >
                <div className="card-header">
                  <div className="card-icon-wrapper" style={{ background: `${service.color}15`, color: service.color }}>
                    {getIcon(service.icon)}
                  </div>
                  <div className="card-arrow">
                    <ArrowLeft size={18} />
                  </div>
                </div>
                <div className="card-body">
                  <h3 className="card-title">{service.nameAr}</h3>
                  <p className="card-description">{service.descriptionAr}</p>
                </div>
                <div className="card-footer">
                  <Clock size={14} />
                  <span>متاح الآن</span>
                </div>
              </div>
            ))}
          </div>

          {/* All Services */}
          <h2 className="section-title">جميع الخدمات</h2>
          <div className="services-grid">
            {otherServices.map(service => (
              <div
                key={service.id}
                className="service-card-modern"
                onClick={() => onServiceClick(service.id)}
                style={{ '--card-color': service.color } as React.CSSProperties}
              >
                <div className="card-header">
                  <div className="card-icon-wrapper" style={{ background: `${service.color}15`, color: service.color }}>
                    {getIcon(service.icon)}
                  </div>
                  <div className="card-arrow">
                    <ArrowLeft size={18} />
                  </div>
                </div>
                <div className="card-body">
                  <h3 className="card-title">{service.nameAr}</h3>
                  <p className="card-description">{service.descriptionAr}</p>
                </div>
                {/* Optional Status Footer */}
                {service.id === '1' && !student?.track && (
                  <div className="card-footer" style={{ color: '#ef4444', background: '#fef2f2' }}>
                    <Icons.AlertCircle size={14} />
                    <span>مطلوب التسجيل</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
