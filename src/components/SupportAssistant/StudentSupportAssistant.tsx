import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useStudent } from '../../context';
import {
  checkIsAdmin,
  getCurrentUser,
  subscribeToCodesForRequests,
} from '../../services/firebaseService';
import {
  DtCodeRow,
  EpCodeRow,
  filterCodesForStudentRequests,
} from '../../services/assistantEngine';
import SupportAssistant from './SupportAssistant';

const HIDDEN_PREFIXES = ['/login', '/register', '/reset-password', '/admin'];

const StudentSupportAssistant: React.FC = () => {
  const { student, serviceRequests, isLoggedIn } = useStudent();
  const location = useLocation();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [dtCodes, setDtCodes] = useState<DtCodeRow[]>([]);
  const [epCodes, setEpCodes] = useState<EpCodeRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!isLoggedIn) {
        setIsAdmin(false);
        setAdminChecked(true);
        return;
      }
      const user = getCurrentUser();
      const admin = user ? await checkIsAdmin(user.uid) : false;
      if (!cancelled) {
        setIsAdmin(admin);
        setAdminChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  // اشتراك ذكي فقط في الأكواد الخاصة بطلبات هذا الطالب (يوفر آلاف القراءات من الفايربيز)
  useEffect(() => {
    if (!isLoggedIn || isAdmin) return;
    const reqIds = (serviceRequests || []).map((r) => r.id).filter(Boolean) as string[];
    const unsub = subscribeToCodesForRequests(reqIds, (dt, ep) => {
      setDtCodes(dt as DtCodeRow[]);
      setEpCodes(ep as EpCodeRow[]);
    });
    return () => {
      unsub();
    };
  }, [isLoggedIn, isAdmin, serviceRequests]);

  const pathHidden = HIDDEN_PREFIXES.some((p) => location.pathname.startsWith(p));
  if (!adminChecked || !isLoggedIn || isAdmin || pathHidden) {
    return null;
  }

  const { dt, ep } = filterCodesForStudentRequests(dtCodes, epCodes, serviceRequests);

  return (
    <SupportAssistant
      student={student}
      serviceRequests={serviceRequests}
      dtCodes={dt}
      epCodes={ep}
      onNavigateService={(id) => navigate(`/service/${id}`)}
      onNavigateAssignments={() => navigate('/my-assignments')}
      onNavigateApproved={() => navigate('/my-requests')}
      onNavigateProfile={() => navigate('/profile')}
    />
  );
};

export default StudentSupportAssistant;
