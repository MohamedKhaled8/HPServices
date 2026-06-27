import { getAutomationApiBaseUrl, getAutomationAuthHeaders } from './automationApi';
import { logger } from './logger';

/**
 * دالة مساعدة للاتصال بمسارات الواتساب في السيرفر
 */
export async function callWhatsAppApi(endpoint: string, body?: any): Promise<any> {
  const baseUrl = getAutomationApiBaseUrl();
  if (!baseUrl) {
    throw new Error('رابط خادم الأتمتة غير مهيأ (VITE_API_URL)');
  }

  const url = `${baseUrl}/api/whatsapp/${endpoint}`;
  const authHeaders = await getAutomationAuthHeaders();

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { error: errorText };
      }
      throw new Error(errorData.error || `خطأ في الخادم (${response.status})`);
    }

    return await response.json();
  } catch (error: any) {
    logger.error(`WhatsApp API Call [${endpoint}] failed:`, error);
    throw error;
  }
}

/**
 * دالة لإرسال إشعار تلقائي للواتساب عند تغيير حالة طلب أو تقديم طلب جديد
 */
export async function triggerWhatsAppNotification(
  requestId: string,
  serviceId: string,
  status: string,
  extraData?: Record<string, any>
): Promise<any> {
  try {
    logger.log(`Triggering WhatsApp notification: Request=${requestId}, Service=${serviceId}, Status=${status}`);
    const res = await callWhatsAppApi('notify', {
      requestId,
      serviceId,
      status,
      ...extraData
    });
    logger.log('WhatsApp notification result:', res);
    return res;
  } catch (error) {
    logger.error('Failed to trigger WhatsApp notification:', error);
    // لا نرمي الخطأ حتى لا تتعطل العمليات الأساسية في التطبيق إن فشل الواتساب
    return { success: false, error: (error as Error).message };
  }
}
