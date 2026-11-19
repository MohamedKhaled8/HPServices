import React, { useState, useMemo } from 'react';
import {
  Folder,
  Calendar,
  Clock,
  Users,
  FileText,
  RotateCcw,
  Search,
  Filter,
  Loader2,
  Layers,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { DistributedFolderSummary } from '../../../../../services/firebaseService';
import { RecallModalState } from '../../../types/assignments.types';

export interface RecallByFolderTabProps {
  recallModal: RecallModalState;
  setRecallModal: React.Dispatch<React.SetStateAction<RecallModalState>>;
  setConfirmRevokeFolder: React.Dispatch<React.SetStateAction<DistributedFolderSummary | null>>;
  setConfirmRevokeDateOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export const RecallByFolderTab: React.FC<RecallByFolderTabProps> = ({
  recallModal,
  setRecallModal,
  setConfirmRevokeFolder,
  setConfirmRevokeDateOpen,
}) => {
  const [folderSearch, setFolderSearch] = useState('');
  const todayDateString = useMemo(() => new Date().toISOString().split('T')[0], []);

  // المجلدات المرسلة اليوم تحديداً
  const todayFolders = useMemo(() => {
    return recallModal.folders.filter((f) => f.dateString === todayDateString || f.isToday);
  }, [recallModal.folders, todayDateString]);

  // استخراج قائمة التواريخ الفريدة المتاحة
  const availableDates = useMemo(() => {
    const dateMap = new Map<string, { formattedDate: string; count: number }>();
    recallModal.folders.forEach((f) => {
      if (f.dateString && f.dateString !== 'unknown-date') {
        if (!dateMap.has(f.dateString)) {
          dateMap.set(f.dateString, { formattedDate: f.formattedDate || f.dateString, count: 0 });
        }
        dateMap.get(f.dateString)!.count++;
      }
    });
    return Array.from(dateMap.entries()).map(([dateString, info]) => ({
      dateString,
      formattedDate: info.formattedDate,
      count: info.count,
      isToday: dateString === todayDateString
    }));
  }, [recallModal.folders, todayDateString]);

  // المجلدات المصفاة حسب البحث والتاريخ المحدد
  const filteredFolders = useMemo(() => {
    return recallModal.folders.filter((f) => {
      const matchSearch =
        !folderSearch.trim() ||
        f.folderName.toLowerCase().includes(folderSearch.toLowerCase().trim()) ||
        f.folderPath.toLowerCase().includes(folderSearch.toLowerCase().trim()) ||
        (f.subFolderName && f.subFolderName.toLowerCase().includes(folderSearch.toLowerCase().trim()));

      let matchDate = true;
      if (recallModal.selectedDateFilter === 'today') {
        matchDate = f.dateString === todayDateString || f.isToday;
      } else if (recallModal.selectedDateFilter !== 'all') {
        matchDate = f.dateString === recallModal.selectedDateFilter;
      }

      return matchSearch && matchDate;
    });
  }, [recallModal.folders, folderSearch, recallModal.selectedDateFilter, todayDateString]);

  // المجلدات التابعة للتاريخ المحدد حالياً لسحب اليوم بالكامل
  const foldersForSelectedDate = useMemo(() => {
    if (recallModal.selectedDateFilter === 'all') return [];
    if (recallModal.selectedDateFilter === 'today') return todayFolders;
    return recallModal.folders.filter((f) => f.dateString === recallModal.selectedDateFilter);
  }, [recallModal.folders, recallModal.selectedDateFilter, todayFolders]);

  const activeDateLabel =
    recallModal.selectedDateFilter === 'today'
      ? 'اليوم'
      : availableDates.find((d) => d.dateString === recallModal.selectedDateFilter)?.formattedDate ||
        recallModal.selectedDateFilter;

  return (
    <>
      {/* شريط التحكم الموحد: البحث وتصفية التواريخ والفلاتر السريعة */}
      <div className="recall-folder-controls-bar">
        <div className="recall-controls-row">
          {/* صندوق البحث */}
          <div className="recall-search-box">
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="ابحث باسم المجلد أو التكليف..."
              value={folderSearch}
              onChange={(e) => setFolderSearch(e.target.value)}
              className="recall-search-input"
            />
            {folderSearch && (
              <button
                type="button"
                className="recall-search-clear"
                onClick={() => setFolderSearch('')}
              >
                ×
              </button>
            )}
          </div>

          {/* محدد التواريخ المنسدل */}
          <div className="recall-date-select-wrap">
            <Filter size={14} className="recall-filter-icon" />
            <select
              className="recall-filter-select"
              value={recallModal.selectedDateFilter}
              onChange={(e) =>
                setRecallModal((prev) => ({ ...prev, selectedDateFilter: e.target.value }))
              }
            >
              <option value="today">🟢 اليوم ({todayFolders.length})</option>
              <option value="all">كافة التواريخ والأيام ({availableDates.length})</option>
              {availableDates.map((d) => (
                <option key={d.dateString} value={d.dateString}>
                  {d.isToday ? `اليوم — ${d.formattedDate}` : d.formattedDate} ({d.count} مجلد)
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* الفلاتر السريعة وأزرار السحب الجماعي */}
        <div className="recall-pills-row">
          <div className="recall-pills-group">
            <button
              type="button"
              className={`recall-filter-pill ${recallModal.selectedDateFilter === 'today' ? 'active-today' : ''}`}
              onClick={() => setRecallModal((prev) => ({ ...prev, selectedDateFilter: 'today' }))}
            >
              <span className="pill-dot green"></span>
              <span>أُرسلت اليوم ({todayFolders.length})</span>
            </button>

            <button
              type="button"
              className={`recall-filter-pill ${recallModal.selectedDateFilter === 'all' ? 'active-all' : ''}`}
              onClick={() => setRecallModal((prev) => ({ ...prev, selectedDateFilter: 'all' }))}
            >
              <Layers size={13} />
              <span>كافة التواريخ والأيام ({recallModal.folders.length})</span>
            </button>
          </div>

          {/* سحب كافة مجلدات اليوم أو التاريخ المحدد */}
          {recallModal.selectedDateFilter !== 'all' && foldersForSelectedDate.length > 0 && (
            <button
              type="button"
              className="recall-action-batch-btn"
              disabled={recallModal.isRevokingDateAll || Boolean(recallModal.revokingFolderKey)}
              onClick={() => setConfirmRevokeDateOpen(true)}
              title={`سحب كافة المجلدات (${foldersForSelectedDate.length}) التي أُرسلت في: ${activeDateLabel}`}
            >
              {recallModal.isRevokingDateAll ? (
                <>
                  <Loader2 size={13} className="spinning-loader-small" />
                  <span>جاري سحب مجلدات {activeDateLabel}...</span>
                </>
              ) : (
                <>
                  <RotateCcw size={13} />
                  <span>سحب كافة مجلدات {activeDateLabel} ({foldersForSelectedDate.length})</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* قائمة بطاقات المجلدات */}
      <div className="recall-list-body" style={{ maxHeight: '55vh', overflowY: 'auto' }}>
        {recallModal.loading ? (
          <div className="recall-loading-wrap">
            <Loader2 className="spinning-loader-large" size={36} color="#e11d48" />
            <h4 style={{ margin: '8px 0 2px', fontSize: '15px', color: '#0f172a' }}>جاري فحص المجلدات الموزعة على الطلاب...</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>يتم الآن جرد التكليفات وتجميعها بدقة حسب التاريخ وساعة الإرسال</p>
          </div>
        ) : filteredFolders.length === 0 ? (
          <div className="recall-empty-state" style={{ padding: '36px 20px', textAlign: 'center' }}>
            <Folder size={46} color="#cbd5e1" />
            <h4 style={{ fontSize: '15.5px', fontWeight: 800, margin: '10px 0 4px', color: '#1e293b' }}>
              {recallModal.selectedDateFilter === 'today'
                ? 'لم يتم إرسال مجلدات اليوم بعد'
                : 'لا توجد مجلدات موزعة مطابقة'}
            </h4>
            <p style={{ margin: '0 0 12px', fontSize: '13px', color: '#64748b', maxWidth: '420px', marginLeft: 'auto', marginRight: 'auto' }}>
              {recallModal.selectedDateFilter === 'today'
                ? 'اضغط على زر "كافة التواريخ والأيام" بالأعلى لعرض المجلدات السابقة وسحبها.'
                : 'جرب تغيير شروط البحث أو اختيار تاريخ آخر من القائمة بالأعلى.'}
            </p>
            {recallModal.selectedDateFilter === 'today' && recallModal.folders.length > 0 && (
              <button
                type="button"
                className="recall-switch-filter-btn"
                onClick={() => setRecallModal((prev) => ({ ...prev, selectedDateFilter: 'all' }))}
              >
                عرض كافة التواريخ والأيام ({recallModal.folders.length} مجلد)
              </button>
            )}
          </div>
        ) : (
          filteredFolders.map((folder) => {
            const isRevokingThis = recallModal.revokingFolderKey === folder.folderKey;
            const isFolderEmpty = folder.studentCount === 0;

            return (
              <div
                key={folder.folderKey}
                className={`recall-folder-card ${isRevokingThis ? 'revoking' : ''}`}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', flex: 1, minWidth: 0 }}>
                  <div className={`recall-folder-icon-box ${folder.isToday ? 'today' : ''}`}>
                    <Folder size={22} />
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    {/* اسم المجلد الرئيسي بوضوح بارز */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                      <h4
                        style={{
                          margin: 0,
                          fontSize: '15px',
                          fontWeight: 800,
                          color: '#0f172a',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '420px'
                        }}
                        title={folder.folderPath}
                      >
                        {folder.folderName}
                      </h4>

                      {folder.isToday && (
                        <span
                          style={{
                            background: '#dcfce7',
                            color: '#15803d',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle2 size={12} />
                          أُرسل اليوم
                        </span>
                      )}

                      <span
                        style={{
                          background: '#f1f5f9',
                          color: '#475569',
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '6px'
                        }}
                      >
                        {folder.track === 'track1'
                          ? 'المسار الأول'
                          : folder.track === 'track2'
                          ? 'المسار الثاني'
                          : folder.track === 'track3'
                          ? 'المسار الثالث'
                          : 'التربية العملي'}
                      </span>
                    </div>

                    {/* المجلد الفرعي إن وجد */}
                    {folder.subFolderName && (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#64748b',
                          marginBottom: '6px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <span style={{ color: '#94a3b8' }}>المحتوى الفرعي:</span>
                        <span style={{ fontWeight: 600, color: '#334155' }}>{folder.subFolderName}</span>
                      </div>
                    )}

                    {/* شارات التاريخ والوقت والطلاب بالساعة والدقيقة بدقة */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '12px', color: '#64748b' }}>
                      {/* تاريخ الإرسال */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={13} color="#64748b" />
                        <span style={{ fontWeight: 600, color: '#1e293b' }}>
                          {folder.formattedDate || folder.dateString}
                        </span>
                      </div>

                      {/* ساعة وتوقيت الإرسال بدقة */}
                      {folder.formattedTime && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: '#f8fafc',
                            padding: '2px 8px',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0'
                          }}
                        >
                          <Clock size={13} color="#e11d48" />
                          <span style={{ fontWeight: 700, color: '#e11d48' }}>
                            الساعة: {folder.formattedTime}
                          </span>
                        </div>
                      )}

                      {/* عدد الطلاب */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Users size={13} color="#64748b" />
                        <span style={{ fontWeight: 700, color: '#0f172a' }}>{folder.studentCount} طالب</span>
                      </div>

                      {/* عدد النماذج */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <FileText size={13} color="#64748b" />
                        <span>{folder.filesCount} نموذج موزع</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* زر سحب هذا المجلد بالكامل */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    className="recall-single-btn"
                    disabled={isRevokingThis || isFolderEmpty || Boolean(recallModal.revokingFolderKey) || recallModal.isRevokingDateAll}
                    onClick={() => setConfirmRevokeFolder(folder)}
                    title={`سحب مجلد ${folder.folderName} بالكامل من حسابات ${folder.studentCount} طالب`}
                  >
                    {isRevokingThis ? (
                      <>
                        <Loader2 size={14} className="spinning-loader-small" />
                        <span>جاري السحب...</span>
                      </>
                    ) : (
                      <>
                        <RotateCcw size={14} />
                        <span>سحب هذا المجلد</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};
