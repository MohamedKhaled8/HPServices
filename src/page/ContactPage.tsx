import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MessageCircle, Clock, Phone, MapPin, Info, ChevronLeft } from 'lucide-react';
import '../styles/StaticPages.css';
import '../styles/ContactPage.css';

const ContactPage: React.FC = () => {
    const navigate = useNavigate();

    return (
        <div className="static-page" dir="rtl">
            {/* ─── HEADER ─── */}
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

            {/* ─── HERO ─── */}
            <div className="contact-new-hero">
                <div className="contact-new-hero-inner">
                    <div className="contact-hero-badge">📞 تواصل معنا</div>
                    <h1>كيف يمكننا مساعدتك؟</h1>
                    <p>فريقنا جاهز دائماً للرد على استفساراتك ومساعدتك في إنجاز خدماتك الأكاديمية.</p>
                </div>
            </div>

            {/* ─── MAIN CONTENT ─── */}
            <div className="contact-new-body">
                <div className="static-container">

                    {/* Quick Contact Cards */}
                    <div className="contact-quick-cards">
                        <div className="contact-quick-card whatsapp-card"
                            onClick={() => window.open('https://wa.me/201050889596', '_blank')}>
                            <div className="cqc-icon">💬</div>
                            <div className="cqc-body">
                                <h3>تواصل عبر واتساب</h3>
                                <p className="cqc-value" style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>+20 10 5088 9596</p>
                                <p className="cqc-hint">اضغط للتواصل المباشر</p>
                            </div>
                            <ChevronLeft size={22} className="cqc-arrow" />
                        </div>

                        <div className="contact-quick-card phone-card"
                            onClick={() => window.open('tel:+201050889596', '_blank')}>
                            <div className="cqc-icon">📞</div>
                            <div className="cqc-body">
                                <h3>اتصل بنا مباشرة</h3>
                                <p className="cqc-value" style={{ direction: 'ltr', unicodeBidi: 'plaintext' }}>+20 10 5088 9596</p>
                                <p className="cqc-hint">اضغط للاتصال الآن</p>
                            </div>
                            <ChevronLeft size={22} className="cqc-arrow" />
                        </div>

                        <div className="contact-quick-card hours-card">
                            <div className="cqc-icon">🕐</div>
                            <div className="cqc-body">
                                <h3>ساعات العمل</h3>
                                <p className="cqc-value">السبت — الخميس</p>
                                <p className="cqc-hint">من 9 صباحاً حتى 9 مساءً</p>
                            </div>
                        </div>
                    </div>

                    {/* FAQ Section */}
                    <div className="contact-faq-section">
                        <div className="contact-faq-header">
                            <Info size={22} />
                            <h2>أسئلة شائعة</h2>
                        </div>
                        <div className="contact-faq-grid">
                            {[
                                {
                                    q: 'كيف أتتبع حالة طلبي؟',
                                    a: 'بعد تسجيل الدخول، توجه إلى "طلباتي" من القائمة الرئيسية لمتابعة حالة جميع طلباتك لحظة بلحظة.',
                                },
                                {
                                    q: 'ما المستندات المطلوبة لاستخراج الوثائق؟',
                                    a: 'يختلف حسب نوع الخدمة. ستجد المتطلبات موضحة بالتفصيل داخل صفحة كل خدمة بعد تسجيل الدخول.',
                                },
                                {
                                    q: 'كم تستغرق معالجة الطلب؟',
                                    a: 'يتم معالجة معظم الطلبات خلال 24–48 ساعة عمل. ستصلك إشعارات بتحديثات حالة طلبك.',
                                },
                                {
                                    q: 'هل يمكنني تعديل طلبي بعد الإرسال؟',
                                    a: 'يمكنك التواصل معنا عبر واتساب فور إرسال الطلب إذا احتجت لتعديل. لا يمكن التعديل بعد بدء المعالجة.',
                                },
                                {
                                    q: 'كيف أسترد رسومي في حالة إلغاء الطلب؟',
                                    a: 'يتم النظر في طلبات الاسترداد خلال 3–5 أيام عمل. تواصل معنا عبر واتساب مع رقم الطلب.',
                                },
                                {
                                    q: 'هل بياناتي آمنة على المنصة؟',
                                    a: 'نعم، بياناتك مشفرة ومحمية بأعلى معايير الأمان عبر Google Firebase. راجع صفحة سياسة الخصوصية.',
                                },
                            ].map((item, i) => (
                                <div key={i} className="faq-card">
                                    <div className="faq-q">
                                        <span className="faq-icon">❓</span>
                                        <h4>{item.q}</h4>
                                    </div>
                                    <p className="faq-a">{item.a}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Bottom CTA */}
                    <div className="contact-bottom-cta">
                        <div className="cta-icon">💬</div>
                        <h2>لم تجد إجابتك؟</h2>
                        <p>راسلنا مباشرة على واتساب وسيرد عليك أحد أعضاء فريقنا في أقرب وقت ممكن.</p>
                        <button
                            className="contact-wa-btn"
                            onClick={() => window.open('https://wa.me/201050889596', '_blank')}
                        >
                            <span>💬</span>
                            تواصل عبر واتساب الآن
                        </button>
                    </div>

                </div>
            </div>

            {/* ─── FOOTER ─── */}
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

export default ContactPage;
