import React, { useState, useEffect } from 'react';
import { useStudent } from '../context';
import { SERVICES } from '../constants/services';
import { checkIsAdmin } from '../services/firebaseService';
import ServiceCard from '../components/ServiceCard';
import '../styles/DashboardPage.css';
import { User, LogOut, Users, Settings } from 'lucide-react';

interface DashboardPageProps {
  onServiceClick: (serviceId: string) => void;
  onProfileClick: () => void;
  onLogout: () => void;
  onAllUsersClick: () => void;
  onAdminClick?: () => void;
}

const DashboardPage: React.FC<DashboardPageProps> = ({ onServiceClick, onProfileClick, onLogout, onAllUsersClick, onAdminClick }) => {
  const { student } = useStudent();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (student?.id) {
        const adminStatus = await checkIsAdmin(student.id);
        setIsAdmin(adminStatus);
      }
    };
    checkAdmin();
  }, [student]);

  const getFirstName = (fullName: string): string => {
    return fullName.split(' ')[0];
  };

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div className="header-right">
          <div className="logo">
            <div className="logo-circle">SS</div>
          </div>
        </div>

        <div className="header-center">
          <h1 className="welcome-message">
            أهلا وسهلا {student?.fullNameArabic ? getFirstName(student.fullNameArabic) : 'الطالب'}
          </h1>
        </div>

        <div className="header-left">
          {isAdmin && onAdminClick && (
            <button className="admin-button" onClick={onAdminClick} title="لوحة تحكم الإدارة">
              <Settings size={20} />
            </button>
          )}
          <button className="all-users-button" onClick={onAllUsersClick} title="جميع المستخدمين">
            <Users size={20} />
          </button>
          <button className="profile-button" onClick={onProfileClick} title="الملف الشخصي">
            <User size={20} />
          </button>
          <button className="logout-button" onClick={onLogout} title="تسجيل الخروج">
            <LogOut size={20} />
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="services-container">
          <h2 className="services-title">الخدمات المتاحة</h2>
          <div className="services-grid">
            {SERVICES.map(service => (
              <ServiceCard
                key={service.id}
                service={service}
                onClick={() => onServiceClick(service.id)}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
