import React, { useState, useEffect } from 'react';
import { getLatestNews } from '../services/firebaseService';
import { Bell, ArrowRight, Calendar, Bookmark, Share2, Info } from 'lucide-react';
import { logger } from '../utils/logger';
import '../styles/GeometricShapes.css';
import '../styles/NewsPage.css';

interface NewsPageProps {
    onBack: () => void;
}

const NewsPage: React.FC<NewsPageProps> = ({ onBack }) => {
    const [newsContent, setNewsContent] = useState<string>('');
    const [updatedAt, setUpdatedAt] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        window.scrollTo(0, 0);
        const fetchNews = async () => {
            try {
                const news = await getLatestNews();
                if (news) {
                    setNewsContent(news.content);
                    setUpdatedAt(news.updatedAt);
                }
            } catch (error) {
                logger.error('Error fetching news:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchNews();
    }, []);

    const handleShare = async () => {
        try {
            if (navigator.share) {
                await navigator.share({
                    title: 'أخر الأخبار - HP Services',
                    text: newsContent,
                    url: window.location.href,
                });
            } else {
                // Fallback: Copy to clipboard
                await navigator.clipboard.writeText(`${newsContent}\n\nعرض المزيد في HP Services: ${window.location.href}`);
                alert('تم نسخ الخبر إلى الحافظة للمشاركة');
            }
        } catch (error) {
            logger.error('Error sharing news:', error);
        }
    };

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'متاح دائماً';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return new Intl.DateTimeFormat('ar-EG', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="news-page-premium">
            {/* Geometric Background */}
            <div className="body-geometric-shapes">
                <div className="geo-shape news-circle-1"></div>
                <div className="geo-shape news-triangle-1"></div>
                <div className="geo-shape news-square-1"></div>
                <div className="geo-shape news-hexagon-1"></div>
            </div>

            <nav className={`news-nav ${scrolled ? 'scrolled' : ''}`}>
                <button onClick={onBack} className="news-back-btn">
                    <ArrowRight size={20} />
                    <span>العودة للرئيسية</span>
                </button>
                <div className="news-nav-title">أخر الأخبار</div>
            </nav>

            <header className="news-header">
                <div className="news-header-overlay"></div>
                <div className="news-header-content">
                    <div className="news-badge">
                        <Bell size={18} />
                        <span>تحديثات هامة</span>
                    </div>
                    <h1>أحدث المستجدات والقرارات الدراسية</h1>
                    <p className="news-subtitle">ابقَ على اطلاع دائم بجميع التفاصيل والأخبار الخاصة بالدبلومة والخدمات الأكاديمية.</p>
                </div>
            </header>

            <main className="news-container">
                {loading ? (
                    <div className="news-loader-container">
                        <div className="modern-loader">
                            <div className="loader-spinner"></div>
                        </div>
                    </div>
                ) : (
                    <div className="news-content-card animate-slide-up">
                        <div className="news-card-meta">
                            <div className="meta-item">
                                <Calendar size={16} />
                                <span>تم التحديث في: {formatDate(updatedAt)}</span>
                            </div>
                            <div className="meta-item">
                                <Bookmark size={16} />
                                <span>أخبار عامة</span>
                            </div>
                        </div>

                        <div className="news-text-body">
                            {newsContent ? (
                                newsContent.split('\n').map((paragraph, index) => (
                                    <p key={index}>{paragraph}</p>
                                ))
                            ) : (
                                <div className="no-news-message">
                                    <Info size={48} />
                                    <p>لا توجد أخبار منشورة حالياً. يرجى مراجعتها لاحقاً.</p>
                                </div>
                            )}
                        </div>

                        <div className="news-footer-actions">
                            <button className="news-action-btn share" onClick={handleShare}>
                                <Share2 size={18} />
                                <span>مشاركة الخبر</span>
                            </button>
                        </div>
                    </div>
                )}
            </main>

            <footer className="news-footer-simple">
                <p>© 2026 HP Services - جميع الحقوق محفوظة</p>
            </footer>
        </div>
    );
};

export default NewsPage;
