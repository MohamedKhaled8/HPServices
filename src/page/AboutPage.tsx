import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Target, Eye, Heart, Users, Award, Mail, Phone } from 'lucide-react';
import '../styles/StaticPages.css';

const AboutPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="static-page" dir="rtl">
            {/* Header */}
            <header className="static-header">
                <div className="static-header-inner">
                    <button className="static-back-btn" onClick={() => navigate(-1)}>
                        <ArrowRight size={20} />
                        <span>رجوع</span>
                    </button>
                    <div className="static-logo">
                        <span>🎓</span>
                        <span>منصة HP للخدمات التعليمية</span>
                    </div>
                </div>
            </header>

            {/* Hero */}
            <section className="static-hero about-hero">
                <div className="static-hero-content">
                    <div className="static-hero-badge">من نحن</div>
                    <h1>منصة HP للخدمات التعليمية</h1>
                    <p>
                        نحن منصة متخصصة في تقديم الخدمات الأكاديمية للطلاب، نسعى لتبسيط الإجراءات وتوفير الوقت والجهد
                        من خلال بوابة رقمية متكاملة وسهلة الاستخدام.
                    </p>
                </div>
                <div className="static-hero-visual">
                    <div className="hero-icon-ring">🎓</div>
                </div>
            </section>

            {/* Stats */}
            <section className="static-stats">
                <div className="static-container">
                    <div className="stats-grid">
                        <div className="stat-card">
                            <div className="stat-number">+500</div>
                            <div className="stat-label">طالب مسجل</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">11</div>
                            <div className="stat-label">خدمة أكاديمية</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">+1000</div>
                            <div className="stat-label">طلب منجز</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-number">24/7</div>
                            <div className="stat-label">دعم متواصل</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Mission & Vision */}
            <section className="static-section">
                <div className="static-container">
                    <div className="mvv-grid">
                        <div className="mvv-card">
                            <div className="mvv-icon"><Target size={32} /></div>
                            <h3>رسالتنا</h3>
                            <p>
                                توفير بيئة رقمية آمنة وسهلة تمكّن الطلاب من إنجاز جميع خدماتهم الأكاديمية
                                بسرعة ودقة، بعيداً عن التعقيد والبيروقراطية.
                            </p>
                        </div>
                        <div className="mvv-card">
                            <div className="mvv-icon"><Eye size={32} /></div>
                            <h3>رؤيتنا</h3>
                            <p>
                                أن نكون المنصة الأكاديمية الرقمية الأولى التي يثق بها كل طالب ويعتمد عليها
                                في جميع احتياجاته الدراسية.
                            </p>
                        </div>
                        <div className="mvv-card">
                            <div className="mvv-icon"><Heart size={32} /></div>
                            <h3>قيمنا</h3>
                            <p>
                                الشفافية والمصداقية في التواصل، السرعة في الإنجاز، الدقة في التنفيذ،
                                والاهتمام الكامل برضا كل طالب.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Summary */}
            <section className="static-section bg-light">
                <div className="static-container">
                    <div className="static-section-header">
                        <h2>الخدمات التي نقدمها</h2>
                        <p>مجموعة شاملة من الخدمات الأكاديمية تحت سقف واحد</p>
                    </div>
                    <div className="services-summary-grid">
                        {[
                            { icon: '📋', title: 'استخراج الوثائق', desc: 'شهادات التخرج، كشف الدرجات، والوثائق الرسمية' },
                            { icon: '💳', title: 'سداد الرسوم', desc: 'رسوم الدراسة والاشتراكات الأكاديمية بكل سهولة' },
                            { icon: '📚', title: 'خدمات الكتب', desc: 'طلب الكتب الدراسية والمراجع المطلوبة' },
                            { icon: '🎓', title: 'التكليفات الوظيفية', desc: 'متابعة وإدارة ملفات التكليف الوظيفي' },
                            { icon: '🏆', title: 'الشهادات التدريبية', desc: 'الحصول على شهادات الدورات والتدريبات' },
                            { icon: '🔄', title: 'التحول الرقمي', desc: 'خدمات الامتحانات الإلكترونية وأكواد التسجيل' },
                        ].map((s, i) => (
                            <div key={i} className="service-summary-card">
                                <div className="service-summary-icon">{s.icon}</div>
                                <h4>{s.title}</h4>
                                <p>{s.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Team Values */}
            <section className="static-section">
                <div className="static-container">
                    <div className="static-section-header">
                        <h2>لماذا تختارنا؟</h2>
                        <p>مميزات تجعل تجربتك معنا فريدة</p>
                    </div>
                    <div className="why-grid">
                        {[
                            { icon: <Award size={24} />, title: 'خبرة وكفاءة', desc: 'فريق متخصص بخبرة في تقديم الخدمات الأكاديمية' },
                            { icon: <Users size={24} />, title: 'دعم شخصي', desc: 'تواصل مباشر مع فريق الدعم لحل أي استفسار' },
                            { icon: <Award size={24} />, title: 'سرعة التنفيذ', desc: 'معالجة الطلبات في أسرع وقت ممكن' },
                            { icon: <Heart size={24} />, title: 'ضمان الجودة', desc: 'نضمن دقة وصحة جميع الوثائق والخدمات المقدمة' },
                        ].map((w, i) => (
                            <div key={i} className="why-item">
                                <div className="why-icon">{w.icon}</div>
                                <h4>{w.title}</h4>
                                <p>{w.desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="static-cta">
                <div className="static-container">
                    <h2>جاهز للبدء؟</h2>
                    <p>سجّل الآن وابدأ في الاستمتاع بجميع خدماتنا الأكاديمية</p>
                    <div className="cta-buttons">
                        <button className="cta-btn-primary" onClick={() => navigate('/register')}>
                            إنشاء حساب مجاني
                        </button>
                        <button className="cta-btn-secondary" onClick={() => navigate('/contact')}>
                            <Mail size={18} /> تواصل معنا
                        </button>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="static-footer">
                <div className="static-container">
                    <p>© {new Date().getFullYear()} منصة HP للخدمات التعليمية — جميع الحقوق محفوظة</p>
                    <div className="footer-links">
                        <button onClick={() => navigate('/privacy')}>سياسة الخصوصية</button>
                        <button onClick={() => navigate('/contact')}>اتصل بنا</button>
                        <button onClick={() => navigate('/about')}>عن المنصة</button>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default AboutPage;
