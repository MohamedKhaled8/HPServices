import React, { useState } from 'react';
import { Bell, Zap, Send, X } from 'lucide-react';
import { updateLatestNews, sendQuickNotification, clearLatestNews, clearQuickNotification } from '../../services/firebaseService';
import { logger } from '../../utils/logger';

interface AdminNewsTabProps {
  showAlert: (title: string, message: string, type: 'success' | 'error' | 'info' | 'warning') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

const AdminNewsTab: React.FC<AdminNewsTabProps> = ({ showAlert, showConfirm }) => {
  const [latestNews, setLatestNews] = useState('');
  const [isPublishingNews, setIsPublishingNews] = useState(false);
  const [isSendingQuickMessage, setIsSendingQuickMessage] = useState(false);

  const handlePublishNews = async () => {
    if (!latestNews.trim()) {
      showAlert('تنبيه', 'يرجى كتابة خبر لنشره', 'warning');
      return;
    }

    setIsPublishingNews(true);
    try {
      await updateLatestNews(latestNews);
      showAlert('نجاح', 'تم نشر الخبر بنجاح لجميع المستخدمين', 'success');
    } catch (error: any) {
      logger.error('Error publishing news:', error);
      showAlert('خطأ', 'حدث خطأ أثناء النشر', 'error');
    } finally {
      setIsPublishingNews(false);
    }
  };

  const handleSendQuickMessage = async () => {
    if (!latestNews.trim()) {
      showAlert('تنبيه', 'يرجى كتابة نص الرسالة السريعة أولاً', 'warning');
      return;
    }

    setIsSendingQuickMessage(true);
    try {
      await sendQuickNotification(latestNews);
      showAlert('تم الإرسال', 'تم إرسال الرسالة السريعة لجميع المستخدمين الآن', 'success');
    } catch (error: any) {
      logger.error('Error sending quick notification:', error);
      showAlert('خطأ', 'حدث خطأ أثناء إرسال الرسالة السريعة', 'error');
    } finally {
      setIsSendingQuickMessage(false);
    }
  };

  const handleStopPublishing = async () => {
    showConfirm('إيقاف النشر', 'هل أنت متأكد من إيقاف نشر الأخبار والرسائل السريعة؟ سيتم إزالة الخبر الحالي والرسائل السريعة من جميع المستخدمين.', async () => {
      try {
        await clearLatestNews();
        await clearQuickNotification();
        setLatestNews('');
        showAlert('تم الإيقاف', 'تم إيقاف نشر الأخبار والرسائل السريعة بنجاح', 'success');
      } catch (error: any) {
        logger.error('Error stopping publishing:', error);
        showAlert('خطأ', 'حدث خطأ أثناء إيقاف النشر', 'error');
      }
    });
  };

  return (
    <div className="admin-content">
      <div className="config-section premium-news-editor">
        <div className="section-header-compact">
          <div className="header-icon-hex">
            <Bell size={24} color="#F59E0B" />
          </div>
          <div>
            <h2>إدارة أخر الأخبار</h2>
            <p>هذا النص سيظهر لجميع المستخدمين في صفحة "أخر الأخبار" بشكل مميز.</p>
          </div>
        </div>

        <div className="news-editor-container" style={{ marginTop: '24px' }}>
          <div className="form-group-full">
            <label>محتوى الخبر (يمكنك كتابة أي نص بأي طول)</label>
            <textarea
              className="premium-textarea"
              value={latestNews}
              onChange={(e) => setLatestNews(e.target.value)}
              placeholder="اكتب الخبر هنا... سوف يظهر للطلاب فور الحفظ."
              style={{ minHeight: '300px', lineHeight: '1.8' }}
            />
          </div>

          <div className="action-row-end">
            <button
              className="quick-message-button-premium"
              onClick={handleSendQuickMessage}
              disabled={isSendingQuickMessage}
            >
              {isSendingQuickMessage ? (
                'جاري الإرسال...'
              ) : (
                <>
                  <Zap size={18} />
                  إرسال رسالة سريعة
                </>
              )}
            </button>

            <button
              className="publish-button-premium"
              onClick={handlePublishNews}
              disabled={isPublishingNews}
            >
              {isPublishingNews ? (
                'جاري الحفظ...'
              ) : (
                <>
                  <Send size={18} style={{ marginLeft: '8px' }} />
                  نشر وحفظ الخبر
                </>
              )}
            </button>

            <button
              className="stop-button-premium"
              onClick={handleStopPublishing}
            >
              <X size={18} />
              إيقاف النشر
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminNewsTab;
