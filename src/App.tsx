import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { StudentProvider, useStudent } from './context';
import { getCurrentUser, checkIsAdmin } from './services/firebaseService';
import RegisterPage from './page/RegisterPage';
import LoginPage from './page/LoginPage';
import DashboardPage from './page/DashboardPage';
import ServiceDetailsPage from './page/ServiceDetailsPage';
import ProfilePage from './page/ProfilePage';
import AllUsersPage from './page/AllUsersPage';
import AdminDashboardPage from './page/AdminDashboardPage';
import AssignmentsManagementPage from './page/AssignmentsManagementPage';
import StudentAssignmentsPage from './page/StudentAssignmentsPage';
import ApprovedRequestsPage from './page/ApprovedRequestsPage';
import NewsPage from './page/NewsPage';
import ResetPasswordPage from './page/ResetPasswordPage';
import './styles/App.css';

// --- Error Boundary ---
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
    constructor(props: { children: ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error: Error) {
        return { hasError: true, error };
    }
    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("ErrorBoundary caught an error", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', textAlign: 'center', direction: 'rtl' }}>
                    <h1 style={{ color: '#ef4444' }}>عذراً، حدث خطأ ما في التطبيق.</h1>
                    <p style={{ color: '#64748b' }}>يرجى محاولة تحديث الصفحة أو العودة لاحقاً.</p>
                    <pre style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', overflow: 'auto', textAlign: 'left', direction: 'ltr', fontSize: '12px' }}>
                        {this.state.error?.toString()}
                    </pre>
                    <button onClick={() => window.location.reload()} style={{ padding: '10px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}>
                        تحديث الصفحة
                    </button>
                </div>
            );
        }
        return this.props.children;
    }
}

// مكون حماية المسارات الخاصة بالمستخدمين المسجلين (الطلاب فقط)
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
    const { isLoggedIn } = useStudent();
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [isAdmin, setIsAdmin] = useState<boolean>(false);

    useEffect(() => {
        const checkAuthAndRole = async () => {
            try {
                // تأخير بسيط لمحاكاة/انتظار تحميل الحالة
                await new Promise(resolve => setTimeout(resolve, 800));

                const user = getCurrentUser();
                if (user) {
                    const adminStatus = await checkIsAdmin(user.uid);
                    setIsAdmin(adminStatus);
                }
            } catch (e) {
                console.error(e);
            } finally {
                setIsAuthChecking(false);
            }
        };

        if (isLoggedIn) {
            checkAuthAndRole();
        } else {
            setIsAuthChecking(false);
        }
    }, [isLoggedIn]);

    if (isAuthChecking) {
        return (
            <div className="loading-container" style={{ position: 'fixed', zIndex: 9999 }}>
                <div className="modern-loader">
                    <div className="loader-spinner"></div>
                    <p style={{ fontFamily: 'sans-serif', marginTop: '10px', color: '#64748b' }}>جارٍ التحقق...</p>
                </div>
            </div>
        );
    }

    // غير مسجل دخول -> Login
    if (!isLoggedIn) {
        return <Navigate to="/login" replace />;
    }

    // مسجل دخول وهو مدير -> Admin Dashboard (ممنوع عليه صفحة الطلاب)
    if (isAdmin) {
        return <Navigate to="/admin" replace />;
    }

    return <>{children}</>;
};

// مكون حماية مسارات الأدمن
const AdminRoute = ({ children }: { children: React.ReactNode }) => {
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifyAdmin = async () => {
            try {
                const user = getCurrentUser();
                if (user) {
                    const adminStatus = await checkIsAdmin(user.uid);
                    setIsAdmin(adminStatus);
                } else {
                    setIsAdmin(false);
                }
            } catch (e) {
                setIsAdmin(false);
            } finally {
                setLoading(false);
            }
        };
        verifyAdmin();
    }, []);

    if (loading) {
        return (
            <div className="loading-container">
                <div className="modern-loader">
                    <div className="loader-spinner"></div>
                </div>
            </div>
        );
    }

    if (!isAdmin) {
        // إذا لم يكن مديراً، نطرده لصفحة الطلاب (أو Login)
        return <Navigate to="/dashboard" replace />;
    }

    return <>{children}</>;
};

// --- Page Wrappers & Logic ---

const LoginWrapper = () => {
    const navigate = useNavigate();
    const { isLoggedIn } = useStudent();

    useEffect(() => {
        const checkRedirect = async () => {
            if (isLoggedIn) {
                // التحقق من الدور قبل التوجيه
                const user = getCurrentUser();
                if (user) {
                    const isAdmin = await checkIsAdmin(user.uid);
                    if (isAdmin) {
                        navigate('/admin', { replace: true });
                    } else {
                        navigate('/dashboard', { replace: true });
                    }
                }
            }
        };
        checkRedirect();
    }, [isLoggedIn, navigate]);

    return (
        <LoginPage
            onLoginSuccess={() => {
                // يتم التعامل مع التوجيه في useEffect
            }}
            onGoToRegister={() => navigate('/register')}
            onAdminLogin={() => navigate('/login')}
        />
    );
};

const RegisterWrapper = () => {
    const navigate = useNavigate();
    const { isLoggedIn } = useStudent();

    useEffect(() => {
        if (isLoggedIn) navigate('/dashboard', { replace: true });
    }, [isLoggedIn, navigate]);

    return (
        <RegisterPage
            onRegistrationSuccess={() => navigate('/dashboard')}
            onGoToLogin={() => navigate('/login')}
        />
    );
};

const DashboardWrapper = () => {
    const navigate = useNavigate();
    const { logout } = useStudent();

    const handleLogout = async () => {
        try {
            await logout();
        } catch (error) {
            console.error('Logout error:', error);
        }
        navigate('/login', { replace: true });
    };

    return (
        <DashboardPage
            onServiceClick={(id) => navigate(`/service/${id}`)}
            onProfileClick={() => navigate('/profile')}
            onAssignmentsClick={() => navigate('/my-assignments')}
            onRequestsClick={() => navigate('/my-requests')}
            onNewsClick={() => navigate('/news')}
            onLogout={handleLogout}
            onAdminClick={() => navigate('/admin')}
        />
    );
};

const StudentAssignmentsWrapper = () => {
    const navigate = useNavigate();
    return <StudentAssignmentsPage onBack={() => navigate('/dashboard')} />;
};

const ApprovedRequestsWrapper = () => {
    const navigate = useNavigate();
    return <ApprovedRequestsPage onBack={() => navigate('/dashboard')} />;
};

const ServiceDetailsWrapper = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // إذا لم يكن هناك ID، نعود للوحة التحكم
    if (!id) return <Navigate to="/dashboard" replace />;

    return (
        <ServiceDetailsPage
            serviceId={id}
            onBack={() => navigate('/dashboard')}
            onSubmitSuccess={() => navigate('/dashboard')}
        />
    );
};

const ProfileWrapper = () => {
    const navigate = useNavigate();
    return <ProfilePage onBack={() => navigate('/dashboard')} />;
};

const AllUsersWrapper = () => {
    const navigate = useNavigate();
    return <AllUsersPage onBack={() => navigate('/dashboard')} />;
};

const NewsWrapper = () => {
    const navigate = useNavigate();
    return <NewsPage onBack={() => navigate('/dashboard')} />;
};

const AdminDashboardWrapper = () => {
    const navigate = useNavigate();
    const { logout } = useStudent();

    const handleLogout = async () => {
        try {
            await logout();
            // تأخير بسيط لضمان تحديث الحالة
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error('Logout error:', error);
        }
        navigate('/login', { replace: true });
    };

    return (
        <AdminDashboardPage
            onLogout={handleLogout}
            onBack={() => navigate('/dashboard')}
            onAssignmentsClick={() => navigate('/admin/assignments')}
        />
    );
};

const AssignmentsWrapper = () => {
    const navigate = useNavigate();
    return <AssignmentsManagementPage onBack={() => navigate('/admin')} />;
};

// --- Main App Component ---

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <StudentProvider>
                <BrowserRouter>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginWrapper />} />
                        <Route path="/register" element={<RegisterWrapper />} />
                        <Route path="/reset-password" element={<ResetPasswordPage />} />
                        <Route path="/admin-login" element={<Navigate to="/login" replace />} />

                        {/* User Protected Routes */}
                        <Route path="/" element={<Navigate to="/dashboard" replace />} />

                        <Route path="/dashboard" element={
                            <ProtectedRoute>
                                <DashboardWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/my-assignments" element={
                            <ProtectedRoute>
                                <StudentAssignmentsWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/my-requests" element={
                            <ProtectedRoute>
                                <ApprovedRequestsWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/service/:id" element={
                            <ProtectedRoute>
                                <ServiceDetailsWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/profile" element={
                            <ProtectedRoute>
                                <ProfileWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/all-users" element={
                            <ProtectedRoute>
                                <AllUsersWrapper />
                            </ProtectedRoute>
                        } />

                        <Route path="/news" element={
                            <ProtectedRoute>
                                <NewsWrapper />
                            </ProtectedRoute>
                        } />

                        {/* Admin Routes */}
                        <Route path="/admin" element={
                            <AdminRoute>
                                <AdminDashboardWrapper />
                            </AdminRoute>
                        } />

                        <Route path="/admin/assignments" element={
                            <AdminRoute>
                                <AssignmentsWrapper />
                            </AdminRoute>
                        } />

                        {/* Catch All */}
                        <Route path="*" element={<Navigate to="/dashboard" replace />} />
                    </Routes>
                </BrowserRouter>
            </StudentProvider>
        </ErrorBoundary>
    );
};

export default App;
