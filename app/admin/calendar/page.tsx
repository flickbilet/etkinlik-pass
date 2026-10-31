"use client";
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../layout';
import { 
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, 
  Clock, MapPin, Users, Film, Theater, Trophy, Eye, EyeOff, 
  Power, CheckCircle2, AlertCircle, Sparkles, ExternalLink, 
  ArrowRight, Loader2, X, Armchair, CreditCard, Filter,
  FileQuestion, Trash2
} from 'lucide-react';
import { 
  formatEventDateDisplay, isEventPast, buildEventDateTime, 
  splitEventDateTime, unpackEventLocation 
} from '@/lib/dateUtils';

const EVENT_TYPE_META: Record<string, { label: string; icon: any }> = {
  cinema: { label: 'Sinema', icon: Film },
  theater: { label: 'Tiyatro', icon: Theater },
  social: { label: 'Sosyal', icon: Users },
  quiz: { label: 'Quiz / Yarışma', icon: Trophy },
};

const TURKISH_DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const TURKISH_MONTH_NAMES = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

export default function AdminCalendarPage() {
  const router = useRouter();
  const { events, fetchEvents, loadingEvents } = useAdmin();

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'draft' | 'active' | 'past'>('all');
  const [togglingEventId, setTogglingEventId] = useState<number | null>(null);

  // İstatistikler (Bilet ve Katılımcı sayıları)
  const [statsMap, setStatsMap] = useState<Record<number, { approved: number; pending: number }>>({});
  const [loadingStats, setLoadingStats] = useState(false);

  // Yeni Etkinlik Planlama Modalı
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [planDate, setPlanDate] = useState<string>('');
  const [planTime, setPlanTime] = useState<string>('21:00');
  const [planName, setPlanName] = useState<string>('');
  const [planType, setPlanType] = useState<string>('cinema');
  const [planLocation, setPlanLocation] = useState<string>('');
  const [planIsActive, setPlanIsActive] = useState<boolean>(false); // Varsayılan olarak taslak/gizli
  const [planIsPaid, setPlanIsPaid] = useState<boolean>(false);
  const [planPrice, setPlanPrice] = useState<string>('');
  const [creatingPlan, setCreatingPlan] = useState<boolean>(false);

  // Özel başvuru soruları
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);

  const handleAddQuestion = () => {
    const newQ = {
      id: 'q_' + Date.now(),
      label: '',
      type: 'textarea',
      options: ['Evet', 'Hayır'],
      required: true,
      placeholder: '',
    };
    setCustomQuestions(prev => [...prev, newQ]);
  };

  const handleUpdateQuestion = (index: number, field: string, value: any) => {
    setCustomQuestions(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleRemoveQuestion = (index: number) => {
    setCustomQuestions(prev => prev.filter((_, i) => i !== index));
  };

  // Etkinlik istatistiklerini getir
  useEffect(() => {
    const fetchStats = async () => {
      setLoadingStats(true);
      const [ticketsRes, membersRes] = await Promise.all([
        supabase.from('biletler').select('id, katilimci_id, etkinlik_id, onayli_mi'),
        supabase.from('katilimcilar').select('id, is_banned, referans')
      ]);

      let data = ticketsRes.data;
      if (!data || ticketsRes.error) {
        const fallback = await supabase.from('katilimcilar').select('id, etkinlik_id, onayli_mi, is_banned, referans');
        data = fallback.data;
      }

      const bannedMemberIds = new Set<number>();
      if (membersRes.data) {
        for (const m of membersRes.data) {
          if (m.is_banned === true || (typeof m.referans === 'string' && m.referans.includes('[YASAKLI]'))) {
            bannedMemberIds.add(Number(m.id));
          }
        }
      }

      if (data) {
        const map: Record<number, { approved: number; pending: number }> = {};
        for (const item of data) {
          const eid = Number(item.etkinlik_id);
          if (!map[eid]) map[eid] = { approved: 0, pending: 0 };

          const kid = Number(item.katilimci_id || item.id);
          const isBanned = bannedMemberIds.has(kid) || 
            item.is_banned === true || 
            (typeof item.referans === 'string' && item.referans.includes('[YASAKLI]'));

          // Yasaklı kullanıcılar bekleyen listesine kesinlikle eklenmesin
          if (isBanned) continue;

          if (item.onayli_mi) map[eid].approved++;
          else map[eid].pending++;
        }
        setStatsMap(map);
      }
      setLoadingStats(false);
    };
    fetchStats();
  }, [events]);

  // Ay Bilgileri
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  // Takvim günlerini oluştur (Pazartesi başlangıçlı)
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    // Pazartesi = 0, Salı = 1, ... Pazar = 6
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days = [];

    // Önceki aydan taşan günler
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthLastDay - i),
        isCurrentMonth: false,
      });
    }

    // Bu ayın günleri
    for (let i = 1; i <= lastDayOfMonth.getDate(); i++) {
      days.push({
        date: new Date(year, month, i),
        isCurrentMonth: true,
      });
    }

    // Sonraki aydan taşan günler (toplam 35 veya 42 güne tamamlamak için)
    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push({
        date: new Date(year, month + 1, i),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [year, month]);

  // Etkinlikleri tarihlerine göre grupla (YYYY-MM-DD formatında)
  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const ev of events) {
      if (!ev.event_date) continue;
      const { dateInput } = splitEventDateTime(ev.event_date);
      if (!dateInput) continue;

      // Filtreleme modu
      const isPast = isEventPast(ev.event_date);
      if (filterMode === 'draft' && (ev.is_active || isPast)) continue;
      if (filterMode === 'active' && (!ev.is_active || isPast)) continue;
      if (filterMode === 'past' && !isPast) continue;

      const existing = map.get(dateInput) || [];
      existing.push(ev);
      map.set(dateInput, existing);
    }
    return map;
  }, [events, filterMode]);

  // Gelecek ve planlanan etkinliklerin kronolojik listesi
  const upcomingPlannedEvents = useMemo(() => {
    return [...events]
      .filter((ev) => {
        if (filterMode === 'draft') return !ev.is_active && !isEventPast(ev.event_date);
        if (filterMode === 'active') return ev.is_active && !isEventPast(ev.event_date);
        if (filterMode === 'past') return isEventPast(ev.event_date);
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.event_date || 0).getTime();
        const timeB = new Date(b.event_date || 0).getTime();
        return timeA - timeB;
      });
  }, [events, filterMode]);

  const formatDateKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const isToday = (d: Date) => {
    const now = new Date();
    return (
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  };

  // Bir güne tıklandığında yeni planlama modalını aç
  const handleDayClick = (d: Date) => {
    setSelectedDay(d);
    setPlanDate(formatDateKey(d));
    setPlanTime('21:00');
    setPlanName('');
    setPlanIsActive(false); // Varsayılan olarak taslak/planlanan
    setIsPlanModalOpen(true);
  };

  // Etkinlik yayın durumunu (Aktif <-> Taslak) değiştir
  const handleTogglePublish = async (ev: any) => {
    const nextState = !ev.is_active;

    // Tarihi geçmişse önce uyar
    if (nextState && isEventPast(ev.event_date)) {
      alert(`"${ev.event_name}" etkinliğinin tarihi geçmiş durumda. Aktif edebilmek için etkinlik tarihini güncelleyin.`);
      router.push(`/admin/events/${ev.id}?tab=settings`);
      return;
    }

    setTogglingEventId(ev.id);
    try {
      const { error } = await supabase
        .from('etkinlik_ayarlari')
        .update({ 
          is_active: nextState,
          is_registration_open: nextState ? ev.is_registration_open : false 
        })
        .eq('id', ev.id);

      if (error) throw error;

      await fetchEvents();
      if (selectedEvent?.id === ev.id) {
        setSelectedEvent((prev: any) => ({ ...prev, is_active: nextState }));
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setTogglingEventId(null);
    }
  };

  // Yeni Etkinlik Oluştur
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName.trim()) return alert("Lütfen etkinlik adını girin!");
    if (!planDate) return alert("Lütfen tarih seçin!");

    setCreatingPlan(true);
    try {
      const { data: highestRows } = await supabase
        .from('etkinlik_ayarlari')
        .select('id, slot_id')
        .order('id', { ascending: false })
        .limit(1);

      const nextId = highestRows && highestRows.length > 0 ? Number(highestRows[0].id) + 1 : 1;
      const nextSlotId = highestRows && highestRows.length > 0 ? (Number(highestRows[0].slot_id) || nextId) + 1 : nextId;

      const fullDateTime = buildEventDateTime(planDate, planTime);

      const newRow: any = {
        id: nextId,
        slot_id: nextSlotId,
        event_name: planName.trim(),
        event_type: planType,
        event_date: fullDateTime,
        event_location: planLocation.trim() || 'Belirtilmedi',
        is_active: planIsActive, // Taslak veya aktif
        is_registration_open: planIsActive,
        is_featured: false,
        has_seating: true,
        is_paid: planIsPaid,
        event_price: planIsPaid ? planPrice : '',
        custom_questions: customQuestions,
      };

      let { data, error } = await supabase
        .from('etkinlik_ayarlari')
        .insert([newRow])
        .select()
        .single();

      if (error && (error.message?.includes('custom_questions') || error.code === 'PGRST204')) {
        delete newRow.custom_questions;
        const retry = await supabase
          .from('etkinlik_ayarlari')
          .insert([newRow])
          .select()
          .single();
        data = retry.data;
        error = retry.error;
      }

      if (error) throw error;

      setIsPlanModalOpen(false);
      setCustomQuestions([]);
      await fetchEvents();

      // Başarılı uyarısı
      if (!planIsActive) {
        alert(`"${planName}" başarıyla takvime planlandı!\n\nDurum: Taslak (Yayında Değil)\nSiz 'Yayına Al' diyene kadar kullanıcılar bu etkinliği göremez.`);
      } else {
        alert(`"${planName}" oluşturuldu ve yayına alındı!`);
      }
    } catch (err: any) {
      alert("Planlama hatası: " + err.message);
    } finally {
      setCreatingPlan(false);
    }
  };

  // Sayısal özetler
  const draftCount = events.filter((e: any) => !e.is_active && !isEventPast(e.event_date)).length;
  const activeCount = events.filter((e: any) => e.is_active && !isEventPast(e.event_date)).length;
  const pastCount = events.filter((e: any) => isEventPast(e.event_date)).length;

  return (
    <div className="space-y-6 pb-20">
      {/* Üst Bilgi Kartı */}
      <div className="bg-slate-900/50 p-6 sm:p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 text-blue-400 p-3 rounded-2xl border border-blue-500/30">
              <CalendarIcon size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">Etkinlik Takvimi</h1>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                Planlanan, taslak ve yayındaki tüm etkinliklerin takvim yönetimi
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const todayStr = formatDateKey(new Date());
              setPlanDate(todayStr);
              setPlanTime('21:00');
              setPlanName('');
              setPlanIsActive(false);
              setIsPlanModalOpen(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase px-5 py-3.5 rounded-2xl shadow-lg shadow-blue-600/20 active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} /> Yeni Etkinlik Planla
          </button>
        </div>
      </div>

      {/* İstatistik & Filtre Şeridi */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <button
          onClick={() => setFilterMode('all')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'all'
              ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">Tüm Etkinlikler</span>
          <span className="text-2xl font-black text-white">{events.length}</span>
        </button>

        <button
          onClick={() => setFilterMode('draft')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'draft'
              ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg shadow-amber-500/20'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest block text-amber-400">
            Planlanan / Taslak (Gizli)
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-400">{draftCount}</span>
            <span className="text-[9px] text-amber-300/80 font-bold">Kullanıcılar Göremez</span>
          </div>
        </button>

        <button
          onClick={() => setFilterMode('active')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'active'
              ? 'bg-emerald-500/20 border-emerald-500 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest block text-emerald-400">
            Yayında (Aktif)
          </span>
          <span className="text-2xl font-black text-emerald-400">{activeCount}</span>
        </button>

        <button
          onClick={() => setFilterMode('past')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === 'past'
              ? 'bg-slate-700/50 border-slate-500 text-white shadow-lg'
              : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white'
          }`}
        >
          <span className="text-[10px] font-black uppercase tracking-widest block opacity-70">Geçmiş / Arşiv</span>
          <span className="text-2xl font-black text-slate-400">{pastCount}</span>
        </button>
      </div>

      {/* TAKVİM ALANI */}
      <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/10 p-5 sm:p-7 shadow-2xl space-y-6">
        {/* Ay Gezintisi & Başlık */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-5">
          <div className="flex items-center gap-3">
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">
              {TURKISH_MONTH_NAMES[month]} {year}
            </h2>
            <button
              onClick={handleToday}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-300 hover:text-white transition-colors"
            >
              Bugün
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Önceki Ay"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
              title="Sonraki Ay"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        {/* Gün Başlıkları */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2 text-center">
          {TURKISH_DAY_NAMES.map((name, i) => (
            <div
              key={name}
              className={`py-2 text-[11px] font-black uppercase tracking-wider ${
                i >= 5 ? 'text-blue-400' : 'text-slate-400'
              }`}
            >
              {name}
            </div>
          ))}
        </div>

        {/* Gün Hücreleri */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {calendarDays.map((dayObj, index) => {
            const dateKey = formatDateKey(dayObj.date);
            const dayEvents = eventsByDate.get(dateKey) || [];
            const isCurr = dayObj.isCurrentMonth;
            const isTod = isToday(dayObj.date);

            return (
              <div
                key={index}
                onClick={() => handleDayClick(dayObj.date)}
                className={`min-h-[95px] sm:min-h-[120px] p-1.5 sm:p-2.5 rounded-2xl border transition-all flex flex-col justify-between group cursor-pointer relative ${
                  !isCurr
                    ? 'opacity-25 bg-slate-950/40 border-white/[0.02]'
                    : isTod
                    ? 'bg-blue-950/20 border-blue-500/50 shadow-inner'
                    : 'bg-slate-950/60 border-white/5 hover:border-blue-500/40 hover:bg-slate-900/60'
                }`}
              >
                {/* Gün Numarası & + İkonu */}
                <div className="flex items-center justify-between">
                  <span
                    className={`text-xs font-mono font-bold w-6 h-6 flex items-center justify-center rounded-lg ${
                      isTod
                        ? 'bg-blue-600 text-white font-black'
                        : isCurr
                        ? 'text-slate-300'
                        : 'text-slate-600'
                    }`}
                  >
                    {dayObj.date.getDate()}
                  </span>

                  <span className="opacity-0 group-hover:opacity-100 text-[10px] font-black uppercase text-blue-400 transition-opacity flex items-center gap-0.5">
                    <Plus size={11} /> Planla
                  </span>
                </div>

                {/* Gün İçindeki Etkinlikler */}
                <div className="space-y-1 mt-1 flex-1">
                  {dayEvents.slice(0, 3).map((ev) => {
                    const isPast = isEventPast(ev.event_date);
                    const isDraft = !ev.is_active && !isPast;
                    const isActive = ev.is_active && !isPast;

                    const TypeIcon = EVENT_TYPE_META[ev.event_type]?.icon || Film;
                    const { timeInput } = splitEventDateTime(ev.event_date);

                    return (
                      <div
                        key={ev.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(ev);
                        }}
                        className={`p-1.5 rounded-xl border text-[10px] font-bold transition-all truncate flex items-center gap-1.5 shadow-sm hover:scale-[1.02] cursor-pointer ${
                          isDraft
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300 hover:bg-amber-500/25'
                            : isActive
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                            : 'bg-slate-800/60 border-white/5 text-slate-400'
                        }`}
                        title={`${ev.event_name} (${isDraft ? 'Taslak / Gizli' : isActive ? 'Yayında' : 'Geçmiş'})`}
                      >
                        <TypeIcon size={12} className="shrink-0" />
                        <span className="truncate flex-1">{ev.event_name}</span>
                        {isDraft && (
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Taslak / Gizli" />
                        )}
                        {isActive && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" title="Yayında (Aktif)" />
                        )}
                      </div>
                    );
                  })}

                  {dayEvents.length > 3 && (
                    <div className="text-[9px] font-bold text-slate-500 text-center pt-0.5">
                      +{dayEvents.length - 3} daha
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* KRONOLOJİK ETKİNLİK ZAMAN ÇİZELGESİ (Aşağıdaki Liste) */}
      <div className="bg-slate-900/40 rounded-[2.5rem] border border-white/10 p-6 sm:p-8 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h3 className="text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
              <Clock size={18} className="text-blue-500" /> Planlanan ve Yayındaki Etkinlikler Sıralaması
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-0.5">
              Hangi gün hangi etkinliğin olduğunu kronolojik sırayla inceleyin
            </p>
          </div>
        </div>

        {upcomingPlannedEvents.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <CalendarIcon className="mx-auto mb-2 opacity-30" size={40} />
            <p className="text-xs font-bold uppercase tracking-wider">Filtreye uygun etkinlik bulunamadı.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-2">
            {upcomingPlannedEvents.map((ev) => {
              const isPast = isEventPast(ev.event_date);
              const isDraft = !ev.is_active && !isPast;
              const isActive = ev.is_active && !isPast;
              const TypeIcon = EVENT_TYPE_META[ev.event_type]?.icon || Film;
              const stats = statsMap[ev.id] || { approved: 0, pending: 0 };
              const { locationName } = unpackEventLocation(ev);

              return (
                <div
                  key={ev.id}
                  onClick={() => setSelectedEvent(ev)}
                  className={`p-5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-4 group hover:border-blue-500/50 ${
                    isDraft
                      ? 'bg-slate-900/70 border-amber-500/30'
                      : isActive
                      ? 'bg-slate-900/70 border-emerald-500/30'
                      : 'bg-slate-900/40 border-white/5 opacity-60'
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-slate-300">
                        <TypeIcon size={12} /> {EVENT_TYPE_META[ev.event_type]?.label || 'Etkinlik'}
                      </span>

                      {isDraft && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                          <EyeOff size={10} /> Taslak (Gizli)
                        </span>
                      )}
                      {isActive && (
                        <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[9px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                          <Eye size={10} /> Yayında (Aktif)
                        </span>
                      )}
                      {isPast && (
                        <span className="bg-slate-800 text-slate-400 text-[9px] font-black uppercase px-2 py-0.5 rounded">
                          Geçmiş
                        </span>
                      )}
                    </div>

                    <h4 className="text-base font-black text-white group-hover:text-blue-400 transition-colors line-clamp-1">
                      {ev.event_name}
                    </h4>

                    <div className="text-xs text-slate-400 flex items-center gap-2 font-bold">
                      <CalendarIcon size={13} className="text-blue-400" />
                      <span>{formatEventDateDisplay(ev.event_date)}</span>
                    </div>

                    {locationName && locationName !== 'Belirtilmedi' && (
                      <div className="text-[11px] text-slate-400 flex items-center gap-2 truncate">
                        <MapPin size={12} className="text-slate-500" />
                        <span className="truncate">{locationName}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="text-emerald-400">{stats.approved} Onaylı</span>
                      {stats.pending > 0 && (
                        <span className="text-amber-400">• {stats.pending} Bekleyen</span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTogglePublish(ev);
                        }}
                        disabled={togglingEventId === ev.id}
                        className={`p-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all ${
                          ev.is_active
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white'
                            : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500 hover:text-white'
                        }`}
                        title={ev.is_active ? "Yayından Kaldır (Taslağa Al)" : "Yayına Al (Aktif Et)"}
                      >
                        {togglingEventId === ev.id ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Power size={12} />
                        )}
                        <span>{ev.is_active ? 'Yayından Kaldır' : 'Yayına Al'}</span>
                      </button>

                      <Link
                        href={`/admin/events/${ev.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white hover:bg-blue-600 transition-colors"
                        title="Etkinliği Yönet"
                      >
                        <ExternalLink size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ETKİNLİK DETAY / HIZLI YAYIN MODALI */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-950 border border-white/10 rounded-[2.5rem] flex flex-col overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600/20 border border-blue-500/30 rounded-xl flex items-center justify-center text-blue-400 font-mono font-bold">
                  #{selectedEvent.id}
                </div>
                <div>
                  <h3 className="text-base font-black uppercase text-white tracking-tight line-clamp-1">
                    {selectedEvent.event_name}
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">
                    {EVENT_TYPE_META[selectedEvent.event_type]?.label || 'Etkinlik'}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Yayın Durumu Uyarısı */}
              <div
                className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
                  selectedEvent.is_active
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                }`}
              >
                <div className="space-y-0.5">
                  <span className="text-xs font-black uppercase block">
                    {selectedEvent.is_active ? '🟢 Şu An Yayında (Aktif)' : '🟡 Planlanan / Taslak (Gizli)'}
                  </span>
                  <p className="text-[11px] text-slate-300 font-bold">
                    {selectedEvent.is_active
                      ? 'Bu etkinlik sitede kullanıcılar tarafından görülüyor ve kayıt alabiliyor.'
                      : 'Bu etkinlik sitede kullanıcılara gözükmez. Siz aktife alana kadar tamamen gizlidir.'}
                  </p>
                </div>

                <button
                  onClick={() => handleTogglePublish(selectedEvent)}
                  disabled={togglingEventId === selectedEvent.id}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase shrink-0 transition-all shadow-md ${
                    selectedEvent.is_active
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                  }`}
                >
                  {togglingEventId === selectedEvent.id ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : selectedEvent.is_active ? (
                    'Yayından Kaldır'
                  ) : (
                    'Yayına Al'
                  )}
                </button>
              </div>

              {/* Bilgi Kutusu */}
              <div className="bg-slate-900/50 p-4 rounded-2xl border border-white/5 space-y-2.5 text-xs">
                <div className="flex items-center gap-2 text-slate-300">
                  <CalendarIcon size={14} className="text-blue-400" />
                  <span className="font-bold">{formatEventDateDisplay(selectedEvent.event_date)}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <MapPin size={14} className="text-slate-400" />
                  <span>{unpackEventLocation(selectedEvent).locationName}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-300">
                  <CreditCard size={14} className="text-amber-400" />
                  <span>
                    {selectedEvent.is_paid
                      ? `Ücretli: ${selectedEvent.event_price || '0'} ₺ (Dekont Zorunlu)`
                      : 'Ücretsiz Etkinlik'}
                  </span>
                </div>
              </div>

              {/* Katılımcı Durumu */}
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Onaylı</span>
                  <span className="text-xl font-black text-emerald-400">
                    {statsMap[selectedEvent.id]?.approved || 0}
                  </span>
                </div>
                <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-0.5">Onay Bekleyen</span>
                  <span className="text-xl font-black text-amber-400">
                    {statsMap[selectedEvent.id]?.pending || 0}
                  </span>
                </div>
              </div>

              {/* Alt Butonlar */}
              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-2xl font-bold text-xs uppercase"
                >
                  Kapat
                </button>
                <Link
                  href={`/admin/events/${selectedEvent.id}`}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  Etkinlik Yönetim Sayfası <ArrowRight size={15} />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* YENİ ETKİNLİK PLANLAMA MODALI */}
      {isPlanModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-slate-950 border border-white/10 rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50">
              <div>
                <h3 className="text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                  <CalendarIcon className="text-blue-500" size={20} /> Etkinlik Planla
                </h3>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  Seçili güne yeni bir etkinlik planlayın
                </p>
              </div>
              <button
                onClick={() => {
                  setIsPlanModalOpen(false);
                  setCustomQuestions([]);
                }}
                className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlan} className="p-6 space-y-4 overflow-y-auto custom-scrollbar">
              {/* Etkinlik Türü */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Etkinlik Türü
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(EVENT_TYPE_META).map(([id, meta]) => {
                    const Icon = meta.icon;
                    const selected = planType === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setPlanType(id)}
                        className={`p-3 rounded-2xl flex flex-col items-center gap-1 border transition-all ${
                          selected
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon size={16} />
                        <span className="text-[9px] font-black uppercase">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Etkinlik Adı */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Etkinlik Adı *
                </label>
                <input
                  required
                  placeholder="Örn: The Dark Knight Gösterimi"
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 p-3.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* Tarih ve Saat */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Tarih *
                  </label>
                  <input
                    type="date"
                    required
                    value={planDate}
                    onChange={(e) => setPlanDate(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 p-3.5 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                    Saat *
                  </label>
                  <input
                    type="time"
                    required
                    value={planTime}
                    onChange={(e) => setPlanTime(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 p-3.5 rounded-xl text-xs font-mono font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Konum */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">
                  Konum / Salon
                </label>
                <input
                  placeholder="Örn: Medipol A Blok Sinema Salonu"
                  value={planLocation}
                  onChange={(e) => setPlanLocation(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 p-3.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              {/* YAYIN DURUMU SEÇİCİ (ÖNEMLİ: KULLANICILAR AKTİFE ALANA KADAR GÖRMESİN) */}
              <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/5 space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Yayın Durumu
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPlanIsActive(false)}
                    className={`p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                      !planIsActive
                        ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-lg shadow-amber-500/20'
                        : 'bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <EyeOff size={14} /> Taslak (Gizli - Önerilen)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPlanIsActive(true)}
                    className={`p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-1.5 transition-all ${
                      planIsActive
                        ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-lg shadow-emerald-500/20'
                        : 'bg-slate-950 border-white/5 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    <Eye size={14} /> Hemen Yayına Al
                  </button>
                </div>
                <p className="text-[10px] text-slate-400">
                  {!planIsActive
                    ? '🔒 Bu etkinlik takvimde plan olarak kalacak; siz aktife alana kadar kullanıcılar sitede kesinlikle göremeyecektir.'
                    : '🌐 Etkinlik oluşturulduğu anda sitede kullanıcılara gösterilir.'}
                </p>
              </div>

              {/* Ücret Durumu */}
              <div>
                <button
                  type="button"
                  onClick={() => setPlanIsPaid(!planIsPaid)}
                  className={`w-full p-3 rounded-xl border text-xs font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    planIsPaid
                      ? 'bg-amber-500/10 border-amber-500/40 text-amber-400'
                      : 'bg-slate-900 border-white/5 text-slate-400'
                  }`}
                >
                  <CreditCard size={14} />
                  {planIsPaid ? 'Ücretli Etkinlik (Dekont Zorunlu)' : 'Ücretsiz Etkinlik'}
                </button>
                {planIsPaid && (
                  <input
                    type="number"
                    placeholder="Bilet Ücreti (TL) - Örn: 100"
                    value={planPrice}
                    onChange={(e) => setPlanPrice(e.target.value)}
                    className="w-full mt-2 bg-slate-900 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-amber-500"
                  />
                )}
              </div>

              {/* BAŞVURU SORULARI */}
              <div className="bg-slate-900/60 p-4 sm:p-5 rounded-[2rem] border border-blue-500/20 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 bg-blue-600/20 text-blue-400 rounded-xl border border-blue-500/30">
                      <FileQuestion size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black uppercase text-white tracking-wide">
                        Başvuru Soruları
                      </h4>
                      <p className="text-[10px] text-slate-400 font-bold">
                        Kayıt formuna özel sorular ({customQuestions.length} Soru)
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="bg-blue-600 hover:bg-blue-500 text-white font-black text-[11px] uppercase px-3 py-2 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-1 transition-all cursor-pointer"
                  >
                    <Plus size={14} /> Soru Ekle
                  </button>
                </div>

                {/* Soru Listesi */}
                {customQuestions.length === 0 ? (
                  <div className="p-4 rounded-xl border border-dashed border-white/10 text-center">
                    <p className="text-[11px] text-slate-500 font-medium">
                      Özel soru eklenmedi. Katılımcılar standart form ile kaydolur.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customQuestions.map((q, qIndex) => (
                      <div
                        key={q.id || qIndex}
                        className="p-3.5 rounded-xl bg-slate-950 border border-white/10 space-y-2.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-black uppercase tracking-wider text-blue-400">
                            Soru #{qIndex + 1}
                          </span>
                          <div className="flex items-center gap-2.5">
                            <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-slate-400 select-none">
                              <input
                                type="checkbox"
                                checked={q.required}
                                onChange={(e) => handleUpdateQuestion(qIndex, 'required', e.target.checked)}
                                className="w-3.5 h-3.5 rounded text-blue-600 bg-slate-900 border-white/20 focus:ring-0 cursor-pointer"
                              />
                              <span className={q.required ? 'text-rose-400 font-black' : 'text-slate-400'}>
                                * Zorunlu
                              </span>
                            </label>
                            <button
                              type="button"
                              onClick={() => handleRemoveQuestion(qIndex)}
                              className="p-1 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                              title="Soruyu Sil"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Soru Metni */}
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 block mb-1">Soru Metni</label>
                          <input
                            placeholder="Örn: Bu derslere katılma motivasyonunuz nedir?"
                            value={q.label}
                            onChange={(e) => handleUpdateQuestion(qIndex, 'label', e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                          />
                        </div>

                        {/* Yanıt Türü & İpuçları */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">Yanıt Türü</label>
                            <select
                              value={q.type || 'textarea'}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'type', e.target.value)}
                              className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="textarea">Uzun Paragraf</option>
                              <option value="text">Kısa Yanıt (Tek Satır)</option>
                              <option value="radio">Tekli Seçim (Evet / Hayır)</option>
                              <option value="select">Açılır Liste</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-[9px] font-bold text-slate-400 block mb-1">
                              {q.type === 'radio' || q.type === 'select' ? 'Seçenekler (Virgülle Ayırın)' : 'İpucu'}
                            </label>
                            {q.type === 'radio' || q.type === 'select' ? (
                              <input
                                placeholder="Örn: Evet, Hayır"
                                value={(q.options || []).join(', ')}
                                onChange={(e) => {
                                  const opts = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                  handleUpdateQuestion(qIndex, 'options', opts);
                                }}
                                className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                              />
                            ) : (
                              <input
                                placeholder="Örn: Kısaca anlatın..."
                                value={q.placeholder || ''}
                                onChange={(e) => handleUpdateQuestion(qIndex, 'placeholder', e.target.value)}
                                className="w-full bg-slate-900 border border-white/10 p-2.5 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                              />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Kaydet Butonu */}
              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsPlanModalOpen(false);
                    setCustomQuestions([]);
                  }}
                  className="flex-1 bg-slate-800 text-slate-300 py-3.5 rounded-xl font-bold text-xs uppercase"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creatingPlan}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  {creatingPlan ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Etkinliği Takvime Ekle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
