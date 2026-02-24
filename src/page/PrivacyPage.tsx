import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield } from 'lucide-react';
import '../styles/StaticPages.css';

const PrivacyPage: React.FC = () => {
    const navigate = useNavigate();
    const lastUpdated = '24 فبراير 2026';

    const sections = [
        {
            title: '1. المعلومات التي نجمعها',
            content: `نقوم بجمع المعلومات التي تقدمها لنا مباشرة عند إنشاء حساب أو استخدام خدماتنا، وتشمل:
      
      • الاسم الكامل (عربي وإنجليزي)
      • البريد الإلكتروني وكلمة المرور (مشفرة عبر Firebase Authentication)
      • رقم الهاتف ورقم الواتساب
      • الرقم القومي (لأغراض التحقق من الهوية)
      • بيانات الدبلوم والشعبة الدراسية
      • العنوان (المحافظة، المدينة، الشارع)
      • المستندات والإيصالات المرفوعة مع الطلبات`
        },
        {
            title: '2. كيف نستخدم معلوماتك',
            content: `نستخدم المعلومات التي نجمعها للأغراض التالية:
      
      • تقديم وتحسين خدماتنا الأكاديمية
      • التحقق من هويتك ومعالجة طلباتك
      • إرسال إشعارات بحالة الطلبات والتحديثات
      • التواصل الإداري المتعلق بطلباتك
      • تحسين تجربة الاستخدام وجودة الخدمات المقدمة
      • الامتثال للمتطلبات القانونية والتنظيمية`
        },
        {
            title: '3. حماية وأمان بياناتك',
            content: `نحن ملتزمون بحماية بياناتك الشخصية بأعلى معايير الأمان:
      
      • بياناتك مخزنة على خوادم Google Firebase المؤمّنة
      • كلمات المرور مشفرة بالكامل ولا يمكن الاطلاع عليها من أحد
      • يتم التحكم في الوصول للبيانات وفق صلاحيات دقيقة (Firestore Rules)
      • لا نبيع أو نشارك بياناتك الشخصية مع أطراف ثالثة إلا بموافقتك
      • نستخدم بروتوكول HTTPS لتشفير جميع الاتصالات`
        },
        {
            title: '4. مشاركة المعلومات مع الغير',
            content: `لن نشارك معلوماتك الشخصية مع أطراف ثالثة إلا في الحالات التالية:
      
      • بموافقتك الصريحة
      • للامتثال لأوامر قضائية أو متطلبات قانونية
      • لحماية حقوقنا القانونية أو حماية سلامة المستخدمين
      • في حالة الاندماج أو الاستحواذ (مع إخطارك مسبقاً)
      
      نستخدم خدمات Google Firebase وGoogle AdSense. تخضع هذه الخدمات لسياسة خصوصية Google المستقلة.`
        },
        {
            title: '5. ملفات تعريف الارتباط (Cookies)',
            content: `نستخدم ملفات تعريف الارتباط وتقنيات مشابهة لـ:
      
      • الحفاظ على جلسة تسجيل الدخول
      • تذكر تفضيلاتك
      • تحليل استخدام الموقع لتحسينه
      • عرض إعلانات Google AdSense ذات صلة باهتماماتك
      
      يمكنك التحكم في ملفات تعريف الارتباط من إعدادات متصفحك، وقد يؤثر تعطيلها على بعض الوظائف.`
        },
        {
            title: '6. إعلانات Google AdSense',
            content: `يستخدم موقعنا Google AdSense لعرض الإعلانات. قد تستخدم Google ملفات تعريف الارتباط لعرض إعلانات مخصصة بناءً على زياراتك السابقة لهذا الموقع أو مواقع أخرى. 
      
      يمكنك إلغاء الاشتراك في استخدام Google لملفات تعريف الارتباط لأغراض الإعلانات المخصصة من خلال زيارة إعدادات الإعلانات في Google.`
        },
        {
            title: '7. حقوقك',
            content: `لديك الحق في:
      
      • الوصول إلى بياناتك الشخصية المحفوظة لدينا
      • تصحيح أي بيانات غير دقيقة من خلال صفحة الملف الشخصي
      • طلب حذف حسابك وجميع بياناتك
      • الاعتراض على معالجة بياناتك في حالات معينة
      • تقديم شكوى لدى الجهات المختصة إذا رأيت انتهاكاً لخصوصيتك
      
      للمطالبة بأي من هذه الحقوق، تواصل معنا عبر صفحة "اتصل بنا".`
        },
        {
            title: '8. الاحتفاظ بالبيانات',
            content: `نحتفظ ببياناتك الشخصية طالما حسابك نشط أو طالما هناك حاجة إليها لتقديم الخدمات. عند طلبك حذف الحساب، نقوم بحذف بياناتك الشخصية في غضون 30 يوماً، باستثناء ما يقتضيه القانون من الاحتفاظ ببعض السجلات.`
        },
        {
            title: '9. التعديلات على سياسة الخصوصية',
            content: `قد نقوم بتحديث سياسة الخصوصية من وقت لآخر. سنعلمك بأي تغييرات جوهرية عبر إشعار في الموقع أو بالبريد الإلكتروني. نشجعك على مراجعة هذه السياسة بشكل دوري للاطلاع على آخر التحديثات.`
        },
        {
            title: '10. التواصل معنا',
            content: `إذا كان لديك أي استفسار حول هذه السياسة أو ممارسات الخصوصية لدينا، يمكنك التواصل معنا عبر:
      
      • صفحة "اتصل بنا" في الموقع
      • رقم الواتساب: +20 10 5088 9596`
        }
    ];

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
            <section className="static-hero privacy-hero">
                <div className="static-hero-content">
                    <div className="static-hero-badge">
                        <Shield size={14} /> سياسة الخصوصية
                    </div>
                    <h1>سياسة الخصوصية وحماية البيانات</h1>
                    <p>نحن نأخذ خصوصيتك بجدية تامة. اقرأ كيف نجمع ونستخدم ونحمي بياناتك الشخصية.</p>
                    <div className="privacy-meta">
                        <span>آخر تحديث: {lastUpdated}</span>
                    </div>
                </div>
                <div className="static-hero-visual">
                    <div className="hero-icon-ring">🔒</div>
                </div>
            </section>

            {/* Content */}
            <section className="static-section">
                <div className="static-container privacy-layout">
                    {/* TOC Sidebar */}
                    <div className="privacy-toc">
                        <h3>المحتويات</h3>
                        <ul>
                            {sections.map((s, i) => (
                                <li key={i}>
                                    <a href={`#section-${i}`}>{s.title}</a>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Main Content */}
                    <div className="privacy-content">
                        <div className="privacy-intro">
                            <p>
                                مرحباً بك في منصة HP للخدمات التعليمية. تصف سياسة الخصوصية هذه كيفية جمعنا
                                لمعلوماتك الشخصية واستخدامها والكشف عنها عند استخدامك لخدماتنا.
                                باستخدامك للمنصة، فإنك توافق على الممارسات الواردة في هذه السياسة.
                            </p>
                        </div>

                        {sections.map((section, i) => (
                            <div key={i} id={`section-${i}`} className="privacy-section">
                                <h2>{section.title}</h2>
                                <div className="privacy-section-content">
                                    {section.content.split('\n').filter(l => l.trim()).map((line, j) => {
                                        const isPhoneLine = line.includes('+20');
                                        const content = isPhoneLine ? (
                                            <>
                                                {line.split('+20')[0]}
                                                <a
                                                    href="https://wa.me/201050889596"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ direction: 'ltr', unicodeBidi: 'plaintext', color: '#1e3a8a', fontWeight: 'bold' }}
                                                >
                                                    +20 10 5088 9596
                                                </a>
                                            </>
                                        ) : line.trim().startsWith('•') ? line.trim().slice(1).trim() : line.trim();

                                        if (line.trim().startsWith('•')) {
                                            return <li key={j}>{content}</li>;
                                        }
                                        return <p key={j}>{content}</p>;
                                    })}
                                </div>
                            </div>
                        ))}
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

export default PrivacyPage;
