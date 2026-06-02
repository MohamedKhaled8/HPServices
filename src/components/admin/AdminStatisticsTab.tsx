import React from 'react';
import { TrendingUp, DollarSign, Bell, Lock, Key } from 'lucide-react';
import { SERVICES } from '../../constants/services';
import { ServiceRequest } from '../../types';

interface AdminStatisticsTabProps {
  serviceRequests: ServiceRequest[];
  adminPrefs: any;
  setAdminPrefs: React.Dispatch<React.SetStateAction<any>>;
  updateAdminPreferences: (prefs: any) => Promise<void>;
  statsDateRange: 'all' | 'today' | 'week' | 'month';
  setStatsDateRange: React.Dispatch<React.SetStateAction<'all' | 'today' | 'week' | 'month'>>;
  isMobile: boolean;
  statsUnlocked: boolean;
  lockStats: () => void;
  setStatsPasswordOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setToastState: React.Dispatch<React.SetStateAction<{ message: string; type: 'loading' | 'success' | 'error'; duration?: number } | null>>;
}

const AdminStatisticsTab: React.FC<AdminStatisticsTabProps> = ({
  serviceRequests,
  adminPrefs,
  setAdminPrefs,
  updateAdminPreferences,
  statsDateRange,
  setStatsDateRange,
  isMobile,
  statsUnlocked,
  lockStats,
  setStatsPasswordOpen,
  setToastState,
}) => {
  const maskNumber = (n: number) => (statsUnlocked ? String(n) : '*****');
  const maskMoney = (n: number) => (statsUnlocked ? `${Number(n || 0).toLocaleString()} ج.م` : '*****');

  // --- STATISTICS CALCULATION ENGINE ---
  let totalRevenue = 0;
  let totalProfit = 0;
  const serviceStats: Record<string, { id: string; count: number; revenue: number; profit: number; name: string; color: string }> = {};

  // Initialize Services
  SERVICES.forEach(s => {
    serviceStats[s.id] = { id: s.id, count: 0, revenue: 0, profit: 0, name: s.nameAr, color: s.color };
  });

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  // Loop through all requests to gather data
  serviceRequests.forEach(req => {
    const reqDate = req.createdAt ? new Date(req.createdAt as any) : null;

    // Apply Date Filtering
    if (statsDateRange !== 'all' && (!reqDate || isNaN(reqDate.getTime()))) return;
    if (statsDateRange === 'today' && reqDate! < startOfDay) return;
    if (statsDateRange === 'week' && reqDate! < startOfWeek) return;
    if (statsDateRange === 'month' && reqDate! < startOfMonth) return;

    // Per Service Logic
    if (serviceStats[req.serviceId]) {
      serviceStats[req.serviceId].count++;

      // Revenue: Only count if COMPLETED
      if (req.status === 'completed' && req.data) {
        let amount = 0;
        // Smart parsing for various price keys
        const rawPrice = req.data.price || req.data.totalPrice || req.data.amount || req.data.cost || req.data.fees;
        if (rawPrice) {
          // Remove currency symbols if any and parse
          amount = parseFloat(String(rawPrice).replace(/[^0-9.]/g, '')) || 0;
        }

        const profitMarginOrCost = adminPrefs.profitCosts?.[req.serviceId] || 0;
        // If profit margin looks like a percentage (e.g., < 1), or just use as fixed cost per item
        // For simplicity: Admin inputs the EXACT profit per request (e.g. 50 means 50 EGP profit per request)
        let itemProfit = profitMarginOrCost;

        serviceStats[req.serviceId].revenue += amount;
        serviceStats[req.serviceId].profit += itemProfit;
        totalRevenue += amount;
        totalProfit += itemProfit;
      }
    }
  });

  const sortedServicesByRew = Object.values(serviceStats).sort((a, b) => b.revenue - a.revenue);
  const sortedServicesByCount = Object.values(serviceStats).sort((a, b) => b.count - a.count);
  const maxServiceCount = Math.max(...Object.values(serviceStats).map(s => s.count), 1); // avoid div by zero

  return (
    <div className="admin-content stats-dashboard" style={{ animation: 'fadeIn 0.5s ease-out' }}>
      <div className="section-header" style={{ marginBottom: '30px', flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'stretch' : 'center', gap: '20px' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <TrendingUp size={32} color="#2563eb" />
            مركز الإحصائيات والتقارير المالية
            <span
              style={{ marginInlineStart: 'auto', display: 'inline-flex', alignItems: 'center', cursor: 'pointer', padding: 8, borderRadius: 10, border: '1px solid rgba(148,163,184,0.25)', background: 'rgba(241,245,249,0.6)' }}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (statsUnlocked) {
                  lockStats();
                  setToastState({ message: 'تم إخفاء الأرقام.', type: 'success', duration: 2200 });
                  return;
                }
                setStatsPasswordOpen(true);
              }}
              title={statsUnlocked ? 'إخفاء الأرقام' : 'إظهار الأرقام'}
              role="button"
              aria-label={statsUnlocked ? 'إخفاء أرقام الإحصائيات' : 'إظهار أرقام الإحصائيات'}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  if (statsUnlocked) {
                    lockStats();
                  } else {
                    setStatsPasswordOpen(true);
                  }
                }
              }}
            >
              {statsUnlocked ? <Lock size={18} /> : <Key size={18} />}
            </span>
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '15px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setStatsDateRange('all')}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'all' ? '#2563eb' : 'white', color: statsDateRange === 'all' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >الكل</button>
            <button
              onClick={() => setStatsDateRange('today')}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'today' ? '#2563eb' : 'white', color: statsDateRange === 'today' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >اليوم</button>
            <button
              onClick={() => setStatsDateRange('week')}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'week' ? '#2563eb' : 'white', color: statsDateRange === 'week' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >هذا الأسبوع</button>
            <button
              onClick={() => setStatsDateRange('month')}
              style={{ padding: '8px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', border: '1px solid #e2e8f0', background: statsDateRange === 'month' ? '#2563eb' : 'white', color: statsDateRange === 'month' ? 'white' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >هذا الشهر</button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: '20px' }}>
        {/* Total Stats */}
        <div className="chart-card" style={{ background: 'linear-gradient(135deg, #2563eb, #1e40af)', color: 'white', padding: '24px', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgba(37, 99, 235, 0.3)', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <h3 style={{ marginBottom: '15px', display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.9 }}>
            <DollarSign size={20} />
            إجمالي الإيرادات (للمقبولة فقط)
          </h3>
          <div style={{ fontSize: '2.5rem', fontWeight: 'bold', marginBottom: '10px' }}>
            {maskMoney(totalRevenue)}
          </div>
          <div style={{ fontSize: '1.2rem', opacity: 0.9, marginTop: '10px' }}>
            إجمالي الأرباح: {maskMoney(totalProfit)}
          </div>
        </div>

        {/* Requests Count */}
        <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: '20px', color: '#334155', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <TrendingUp size={20} />
            أكثر الخدمات طلباً
          </h3>
          <div className="custom-chart" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sortedServicesByCount.map((service) => (
              <div key={service.name} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '120px', fontSize: '0.85rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'left' }}>{service.name}</div>
                <div style={{ flex: 1, height: '10px', background: '#f1f5f9', borderRadius: '5px', overflow: 'hidden' }}>
                  <div style={{
                    width: `${(service.count / maxServiceCount) * 100}%`,
                    height: '100%',
                    background: service.color,
                    borderRadius: '5px',
                    transition: 'width 1s ease-out'
                  }} />
                </div>
                <div style={{ width: '40px', fontSize: '0.85rem', fontWeight: 'bold', textAlign: 'right' }}>{maskNumber(service.count)}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Revenue Breakdown */}
        <div className="chart-card" style={{ background: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
          <h3 style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <DollarSign size={20} />
            تحليل الإيرادات (للمقبولة فقط)
          </h3>
          <div style={{ height: '300px', overflowY: 'auto', paddingRight: '10px' }}>
            {sortedServicesByRew.map((service) => (
              service.revenue > 0 && (
                <div key={service.name} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px dashed #f1f5f9' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '600', color: '#334155' }}>{service.name}</span>
                    <div>
                      <span style={{ fontWeight: 'bold', color: '#10b981', marginLeft: '10px' }}>
                        {statsUnlocked ? `${service.revenue.toLocaleString()} ج.م` : '*****'}
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#d97706' }}>
                        (مكسب: {statsUnlocked ? `${service.profit.toLocaleString()} ج.م` : '*****'})
                      </span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', background: '#f1f5f9', borderRadius: '4px', marginBottom: '10px' }}>
                    <div style={{
                      width: `${(service.revenue / (totalRevenue || 1)) * 100}%`,
                      height: '100%',
                      background: '#10b981',
                      borderRadius: '4px'
                    }} />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem' }}>
                    <label style={{ color: '#64748b' }}>حدد المكسب للطلب الواحد (ج.م):</label>
                    <input
                      type="number"
                      style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1', width: '80px' }}
                      value={adminPrefs.profitCosts?.[service.id] || ''}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 0;
                        const updated = { ...adminPrefs, profitCosts: { ...adminPrefs.profitCosts, [service.id]: val } };
                        setAdminPrefs(updated);
                        updateAdminPreferences(updated).catch(err => console.error(err));
                      }}
                    />
                  </div>
                </div>
              )
            ))}
            {totalRevenue === 0 && (
              <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                لا توجد إيرادات مسجلة حتى الآن
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="quick-actions-hint" style={{ marginTop: '20px', padding: '20px', background: '#fffbeb', borderRadius: '12px', border: '1px solid #fcd34d', color: '#92400e', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Bell size={20} />
        <span>تلميح: يتم حساب الإيرادات تلقائياً فقط للطلبات التي تم تغيير حالتها إلى "مكتمل" (Completed). تأكد من قبول الطلبات المدفوعة ليتم إدراجها هنا.</span>
      </div>
    </div>
  );
};

export default AdminStatisticsTab;
