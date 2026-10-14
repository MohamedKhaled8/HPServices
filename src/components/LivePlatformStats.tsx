import React, { useState, useEffect, useRef } from 'react';
import {
  Users,
  CheckCircle2,
  Activity,
  Sparkles
} from 'lucide-react';
import {
  subscribeToPlatformStats,
  getStudentsCollectionCount,
  subscribeToAllServiceRequests
} from '../services/firebaseService';
import '../styles/LivePlatformStats.css';

interface LivePlatformStatsProps {
  isAdmin?: boolean;
}

// Hook for smooth rolling number animation (Count-Up)
const useAnimatedCounter = (endValue: number, duration: number = 1800) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (endValue === 0) return;
    const startValue = count;
    const diff = endValue - startValue;
    if (diff === 0) return;

    let startTime: number | null = null;
    let animationFrame: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Smooth ease-out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      setCount(Math.round(startValue + diff * easeOut));

      if (progress < 1) {
        animationFrame = requestAnimationFrame(step);
      } else {
        setCount(endValue);
      }
    };

    animationFrame = requestAnimationFrame(step);

    return () => cancelAnimationFrame(animationFrame);
  }, [endValue, duration]);

  return count;
};

// Format numbers with commas (e.g. 1,250)
const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

const LivePlatformStats: React.FC<LivePlatformStatsProps> = ({ isAdmin = false }) => {
  const [rawStudentsCount, setRawStudentsCount] = useState<number>(0);
  const [rawRequestsCount, setRawRequestsCount] = useState<number>(0);
  const [newRequestBubble, setNewRequestBubble] = useState(false);
  const [newStudentBubble, setNewStudentBubble] = useState(false);
  const prevRequestsRef = useRef<number>(0);
  const prevStudentsRef = useRef<number>(0);

  // 1. استرجاع إحصائيات الطلاب والطلبات الحية
  useEffect(() => {
    // محاولة جلب عدد مستندات الطلاب الحقيقي
    getStudentsCollectionCount()
      .then((count) => {
        if (typeof count === 'number' && count > 0) {
          setRawStudentsCount(prev => Math.max(prev, count));
        }
      })
      .catch(() => {});

    // الاشتراك في وثيقة الإحصائيات العامة المحدثة تلقائياً مع كل تسجيل واشتراك
    const unsubStats = subscribeToPlatformStats((stats) => {
      if (stats.totalStudents > 0) {
        setRawStudentsCount(prev => Math.max(prev, stats.totalStudents));
      }
      if (stats.totalRequests > 0) {
        setRawRequestsCount(prev => Math.max(prev, stats.totalRequests));
      }
    });

    // إذا كان مديراً، استمع للطلبات الحية الفورية
    let unsubRequests: (() => void) | null = null;
    if (isAdmin) {
      unsubRequests = subscribeToAllServiceRequests((requests) => {
        if (Array.isArray(requests) && requests.length > 0) {
          setRawRequestsCount(prev => Math.max(prev, requests.length));
        }
      });
    }

    return () => {
      unsubStats();
      if (unsubRequests) unsubRequests();
    };
  }, [isAdmin]);

  // الأساس العام للإحصائيات مضافاً إليه أي حركة جديدة حية
  const BASE_STUDENTS = 1280;
  const BASE_REQUESTS = 3450;
  const BASE_ACTIVITY = 4920;

  const totalStudents = BASE_STUDENTS + rawStudentsCount;
  const totalRequests = BASE_REQUESTS + rawRequestsCount;
  const totalActivity = BASE_ACTIVITY + rawStudentsCount + (rawRequestsCount * 2);

  // تفاعل فوري عند زيادة الطلبات
  useEffect(() => {
    if (prevRequestsRef.current > 0 && totalRequests > prevRequestsRef.current) {
      setNewRequestBubble(true);
      const timer = setTimeout(() => setNewRequestBubble(false), 3500);
      return () => clearTimeout(timer);
    }
    prevRequestsRef.current = totalRequests;
  }, [totalRequests]);

  // تفاعل فوري عند زيادة المشتركين
  useEffect(() => {
    if (prevStudentsRef.current > 0 && totalStudents > prevStudentsRef.current) {
      setNewStudentBubble(true);
      const timer = setTimeout(() => setNewStudentBubble(false), 3500);
      return () => clearTimeout(timer);
    }
    prevStudentsRef.current = totalStudents;
  }, [totalStudents]);

  // عدادات متدرجة بانسيابية
  const animatedStudents = useAnimatedCounter(totalStudents, 2000);
  const animatedRequests = useAnimatedCounter(totalRequests, 2200);
  const animatedActivity = useAnimatedCounter(totalActivity, 2400);

  return (
    <section className="live-stats-wrapper" aria-label="إحصائيات المنصة الحية">
      <div className="live-stats-minimal-container">
        
        {/* 3 Stats Directly On Pure White Page Background */}
        <div className="live-stats-row">
          
          {/* Stat 1: عدد المشتركين */}
          <div className="live-stat-item">
            {newStudentBubble && (
              <span className="new-increment-bubble">+1 مشترك جديد! 🎓</span>
            )}
            <div className="stat-item-badge">
              <span className="stat-item-icon blue">
                <Users size={18} />
              </span>
              <span>المشتركون بالمنصة</span>
            </div>
            <div className="stat-item-number-wrap">
              <span className="stat-item-plus blue">+</span>
              <span className="stat-item-number">{formatNumber(animatedStudents)}</span>
            </div>
            <h4 className="stat-item-label">طالب ومشترك مسجل</h4>
            <p className="stat-item-desc">يزداد مع كل تسجيل دخول واشتراك جديد</p>
          </div>

          <div className="stat-item-divider" aria-hidden="true"></div>

          {/* Stat 2: اشتراكات الخدمات */}
          <div className="live-stat-item">
            {newRequestBubble && (
              <span className="new-increment-bubble">+1 خدمة جديدة! ⚡</span>
            )}
            <div className="stat-item-badge">
              <span className="stat-item-icon emerald">
                <CheckCircle2 size={18} />
              </span>
              <span>اشتراكات الخدمات</span>
            </div>
            <div className="stat-item-number-wrap">
              <span className="stat-item-plus emerald">+</span>
              <span className="stat-item-number">{formatNumber(animatedRequests)}</span>
            </div>
            <h4 className="stat-item-label">خدمة وطلب تم تقديمها</h4>
            <p className="stat-item-desc">عداد يرتفع تلقائياً مع كل طلب خدمة</p>
          </div>

          <div className="stat-item-divider" aria-hidden="true"></div>

          {/* Stat 3: إجمالي النشاط والعمليات */}
          <div className="live-stat-item">
            <div className="stat-item-badge">
              <span className="stat-item-icon purple">
                <Activity size={18} />
              </span>
              <span>الحركات والعمليات المكتملة</span>
            </div>
            <div className="stat-item-number-wrap">
              <span className="stat-item-plus purple">+</span>
              <span className="stat-item-number">{formatNumber(animatedActivity)}</span>
            </div>
            <h4 className="stat-item-label">عملية دخول واشتراك ناجحة</h4>
            <p className="stat-item-desc">نشاط طلابي مستمر على مدار الساعة</p>
          </div>

        </div>
      </div>
    </section>
  );
};

export default LivePlatformStats;
