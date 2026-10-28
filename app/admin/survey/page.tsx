"use client";

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../layout';
import { 
  Plus, Trash2, LayoutDashboard, ImageIcon, Loader2, Power, 
  BarChart3, Save, CheckCircle2, AlertCircle, Edit2, RefreshCw, Upload,
  Archive, ArchiveRestore, Trophy, Calendar, Clock, PlayCircle, Link2, Sparkles, Film
} from 'lucide-react';
import { buildEventDateTime, splitEventDateTime, formatEventDateDisplay, isEventPast } from '@/lib/dateUtils';

export default function AdminSurveyPage() {
  const router = useRouter();
  const { events, fetchEvents } = useAdmin();

  const [surveys, setSurveys] = useState<any[]>([]);
  const [selectedSurvey, setSelectedSurvey] = useState<any>(null);
  const [options, setOptions] = useState<any[]>([]);
  const [allOptionsBySurvey, setAllOptionsBySurvey] = useState<Record<string, any[]>>({});
  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [uploadingId, setUploadingId] = useState<string | null>(null);

  const [rawDeadlineDate, setRawDeadlineDate] = useState('');
  const [rawDeadlineTime, setRawDeadlineTime] = useState('21:00');

  useEffect(() => {
    if (message.text) {
      const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  const syncDeadlineInputs = (srv: any) => {
    if (srv?.deadline) {
      const { dateInput, timeInput } = splitEventDateTime(srv.deadline);
      setRawDeadlineDate(dateInput);
      setRawDeadlineTime(timeInput);
    } else {
      setRawDeadlineDate('');
      setRawDeadlineTime('21:00');
    }
  };

  const fetchData = useCallback(async (preferredSurveyId?: string) => {
    setLoading(true);
    try {
      const { data: allSurveys } = await supabase
        .from('surveys')
        .select('*')
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      const { data: allOpts } = await supabase
        .from('survey_options')
        .select('*')
        .order('created_at', { ascending: true });

      const optMap: Record<string, any[]> = {};
      for (const o of allOpts || []) {
        if (!optMap[o.survey_id]) optMap[o.survey_id] = [];
        optMap[o.survey_id].push(o);
      }
      setAllOptionsBySurvey(optMap);

      const list = allSurveys || [];
      setSurveys(list);

      const target =
        (preferredSurveyId && list.find((s: any) => s.id === preferredSurveyId)) ||
        list.find((s: any) => s.is_active) ||
        list[0] ||
        null;

      setSelectedSurvey(target);
      if (target) {
        setOptions(optMap[target.id] || []);
        syncDeadlineInputs(target);
      } else {
        setOptions([]);
      }
    } catch (e) {
      console.error("Anket verisi çekme hatası:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSelectSurvey = (srv: any) => {
    setSelectedSurvey(srv);
    setOptions(allOptionsBySurvey[srv.id] || []);
    syncDeadlineInputs(srv);
  };

  // Eski anketi silmeden arşive kaldırıp yeni aktif anket oluşturur
  const handleCreateNewSurvey = async () => {
    const title = prompt('Yeni anketin başlığını girin:', 'Bu Hafta Hangi Filmi İzleyelim?');
    if (!title || !title.trim()) return;

    setActionLoading(true);
    try {
      // Mevcut aktif anketleri arşive çek
      for (const s of surveys) {
        if (s.is_active) {
          await supabase.from('surveys').update({ is_active: false }).eq('id', s.id);
        }
      }

      const { data: created, error } = await supabase
        .from('surveys')
        .insert([
          {
            title: title.trim(),
            is_active: true,
            version: 1,
            deadline: null,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Varsayılan 2 örnek şık ekle
      await supabase.from('survey_options').insert([
        {
          survey_id: created.id,
          option_text: '1. Film Seçeneği',
          description: 'Tür • Süre • IMDb Puanı',
          trailer_url: '',
          image_url: '',
          votes: 0,
        },
        {
          survey_id: created.id,
          option_text: '2. Film Seçeneği',
          description: 'Tür • Süre • IMDb Puanı',
          trailer_url: '',
          image_url: '',
          votes: 0,
        },
      ]);

      setActiveTab('active');
      await fetchData(created.id);
      setMessage({ type: 'success', text: 'Yeni anket oluşturuldu (Önceki anket arşive taşındı)!' });
    } catch (e: any) {
      setMessage({ type: 'error', text: 'Anket oluşturulamadı: ' + e.message });
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateSurvey = async () => {
    if (!selectedSurvey) return;
    setActionLoading(true);
    try {
      const isoDeadline = rawDeadlineDate ? buildEventDateTime(rawDeadlineDate, rawDeadlineTime) : null;
      const { error } = await supabase
        .from('surveys')
        .update({
          title: selectedSurvey.title,
          is_active: selectedSurvey.is_active,
          deadline: isoDeadline,
        })
        .eq('id', selectedSurvey.id);

      if (error) throw error;
      setSelectedSurvey({ ...selectedSurvey, deadline: isoDeadline });
      await fetchData(selectedSurvey.id);
      setMessage({ type: 'success', text: 'Anket ayarları başarıyla güncellendi!' });
    } catch {
      setMessage({ type: 'error', text: 'Güncelleme başarısız oldu.' });
    } finally {
      setActionLoading(false);
    }
  };

  const toggleSurveyActiveStatus = async (srv: any) => {
    const nextStatus = !srv.is_active;
    setActionLoading(true);
    try {
      // Eğer bir anketi aktif ediyorsak diğer aktif anketleri kapat
      if (nextStatus) {
        for (const s of surveys) {
          if (s.id !== srv.id && s.is_active) {
            await supabase.from('surveys').update({ is_active: false }).eq('id', s.id);
          }
        }
      }
      await supabase.from('surveys').update({ is_active: nextStatus }).eq('id', srv.id);
      await fetchData(srv.id);
      setMessage({
        type: 'success',
        text: nextStatus ? 'Anket yayına alındı!' : 'Anket geçmiş anketlere (arşive) kaldırıldı.',
      });
    } finally {
      setActionLoading(false);
    }
  };

  // Mevcut anketin oylarını sıfırla (versiyon artırarak kullanıcıların tekrar oy vermesini sağlar)
  const resetCurrentSurveyVotes = async () => {
    if (!selectedSurvey) return;
    if (!confirm('Bu anketteki tüm oyları sıfırlamak ve kullanıcıların yeniden oy kullanabilmesini sağlamak istiyor musunuz?')) return;

    setActionLoading(true);
    try {
      const newVersion = (selectedSurvey.version || 1) + 1;
      await supabase
        .from('surveys')
        .update({ version: newVersion })
        .eq('id', selectedSurvey.id);

      for (const opt of options) {
        await supabase.from('survey_options').update({ votes: 0 }).eq('id', opt.id);
      }

      localStorage.removeItem(`flick_survey_voted_${selectedSurvey.id}`);
      localStorage.setItem(`flick_survey_v_check_${selectedSurvey.id}`, newVersion.toString());

      await fetchData(selectedSurvey.id);
      setMessage({ type: 'success', text: `Oylar sıfırlandı (v${newVersion})!` });
    } catch {
      setMessage({ type: 'error', text: 'Oylar sıfırlanırken hata oluştu.' });
    } finally {
      setActionLoading(false);
    }
  };

  const deleteSurveyPermanently = async (srv: any) => {
    if (!confirm(`"${srv.title}" anketini ve tüm şıklarını kalıcı olarak silmek istediğinize emin misiniz?`)) return;
    setActionLoading(true);
    try {
      await supabase.from('survey_options').delete().eq('survey_id', srv.id);
      await supabase.from('surveys').delete().eq('id', srv.id);
      await fetchData();
      setMessage({ type: 'success', text: 'Anket silindi.' });
    } finally {
      setActionLoading(false);
    }
  };

  const addOption = async () => {
    if (!selectedSurvey) return;
    const { data: newOpt, error } = await supabase
      .from('survey_options')
      .insert([
        {
          survey_id: selectedSurvey.id,
          option_text: 'Yeni Film / Etkinlik Şıkkı',
          description: '',
          trailer_url: '',
          image_url: '',
          votes: 0,
        },
      ])
      .select()
      .single();

    if (!error && newOpt) {
      const updated = [...options, newOpt];
      setOptions(updated);
      setAllOptionsBySurvey({ ...allOptionsBySurvey, [selectedSurvey.id]: updated });
    }
  };

  const deleteOption = async (id: string) => {
    if (!confirm('Bu şıkkı silmek istediğine emin misin?')) return;
    const { error } = await supabase.from('survey_options').delete().eq('id', id);
    if (!error && selectedSurvey) {
      const updated = options.filter((o) => o.id !== id);
      setOptions(updated);
      setAllOptionsBySurvey({ ...allOptionsBySurvey, [selectedSurvey.id]: updated });
    }
  };

  const updateOptionLocal = (id: string, field: string, value: string) => {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)));
  };

  const saveOptionToDB = async (opt: any) => {
    const { error } = await supabase
      .from('survey_options')
      .update({
        option_text: opt.option_text,
        description: opt.description || '',
        trailer_url: opt.trailer_url || '',
        image_url: opt.image_url || '',
      })
      .eq('id', opt.id);

    if (!error) setMessage({ type: 'success', text: 'Şık bilgileri kaydedildi.' });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, optId: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingId(optId);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('survey-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from('survey-images')
        .getPublicUrl(fileName);

      const publicUrl = data.publicUrl;

      setOptions((prev) => prev.map((o) => (o.id === optId ? { ...o, image_url: publicUrl } : o)));

      await supabase
        .from('survey_options')
        .update({ image_url: publicUrl })
        .eq('id', optId);

      setMessage({ type: 'success', text: 'Görsel başarıyla yüklendi!' });
    } catch {
      setMessage({ type: 'error', text: 'Görsel yükleme başarısız.' });
    } finally {
      setUploadingId(null);
    }
  };

  // Kazanan veya seçilen şıkkı tek tıkla yeni bir etkinliğe dönüştürür!
  const convertOptionToEvent = async (opt: any) => {
    if (!confirm(`"${opt.option_text}" şıkkından yeni bir etkinlik oluşturulsun mu?`)) return;

    setActionLoading(true);
    try {
      const { data: highestRows } = await supabase
        .from('etkinlik_ayarlari')
        .select('id, slot_id')
        .order('id', { ascending: false })
        .limit(1);

      const maxIdFromDb = highestRows && highestRows.length > 0 ? Number(highestRows[0].id) || 0 : 0;
      const maxSlotFromDb = highestRows && highestRows.length > 0 ? Number(highestRows[0].slot_id) || 0 : 0;
      const maxFromState = (events || []).reduce(
        (max: number, ev: any) => Math.max(max, Number(ev.id) || 0, Number(ev.slot_id) || 0),
        0
      );
      const nextId = Math.max(maxIdFromDb, maxSlotFromDb, maxFromState) + 1;

      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const yyyy = nextWeek.getFullYear();
      const mm = String(nextWeek.getMonth() + 1).padStart(2, '0');
      const dd = String(nextWeek.getDate()).padStart(2, '0');

      const rows = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
      const defaultSeatLayout: string[] = [];
      for (const r of rows) {
        for (let c = 1; c <= 25; c++) defaultSeatLayout.push(`${r}-${c}`);
      }

      const { data: createdEvent, error } = await supabase
        .from('etkinlik_ayarlari')
        .insert([
          {
            id: nextId,
            slot_id: nextId,
            event_name: opt.option_text,
            event_type: 'cinema',
            event_date: `${yyyy}-${mm}-${dd}T20:00`,
            event_location: 'Ankara Medipol Konferans Salonu',
            location_url: 'https://www.google.com/maps/search/?api=1&query=Ankara+Medipol+%C3%9Cniversitesi',
            whatsapp_link: '',
            is_active: true,
            is_registration_open: true,
            is_featured: true,
            has_seating: true,
            seat_layout: defaultSeatLayout,
            is_paid: false,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      if (fetchEvents) await fetchEvents();
      if (createdEvent?.id) {
        router.push(`/admin/events/${createdEvent.id}?tab=settings`);
      }
    } catch (e: any) {
      alert('Etkinlik oluşturulurken hata: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const totalVotes = options.reduce((acc, curr) => acc + (curr.votes || 0), 0);
  const maxVotes = options.length > 0 ? Math.max(...options.map((o) => o.votes || 0)) : 0;

  const activeSurveys = surveys.filter((s) => s.is_active);
  const archivedSurveys = surveys.filter((s) => !s.is_active);
  const displayedSurveys = activeTab === 'active' ? activeSurveys : archivedSurveys;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4">
        <Loader2 className="animate-spin text-purple-500" size={48} />
        <p className="text-slate-500 font-medium animate-pulse">Anket verileri yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      {message.text && (
        <div
          className={`fixed top-6 right-6 z-50 flex items-center gap-3 px-6 py-4 rounded-2xl border shadow-2xl animate-in fade-in slide-in-from-top-4 duration-300 ${
            message.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
              : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
          <span className="text-sm font-bold">{message.text}</span>
        </div>
      )}

      {/* ÜST BAR: AKTİF / GEÇMİŞ ANKETLER SEKMELERİ VE YENİ ANKET BUTONU */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-4 bg-slate-900/40 p-4 rounded-[2rem] border border-white/5">
        <div className="flex gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => {
              setActiveTab('active');
              if (activeSurveys[0]) handleSelectSurvey(activeSurveys[0]);
            }}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'active' ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Power size={15} />
            <span>Aktif Anket ({activeSurveys.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('archived');
              if (archivedSurveys[0]) handleSelectSurvey(archivedSurveys[0]);
            }}
            className={`px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              activeTab === 'archived' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive size={15} />
            <span>Geçmiş Anketler ({archivedSurveys.length})</span>
          </button>
        </div>

        <button
          onClick={handleCreateNewSurvey}
          disabled={actionLoading}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all"
        >
          <Plus size={18} />
          <span>Yeni Anket Başlat</span>
        </button>
      </div>

      {/* ANKET SEÇİCİ LİSTE (Birden fazla anket varsa) */}
      {displayedSurveys.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {displayedSurveys.map((srv) => {
            const srvOpts = allOptionsBySurvey[srv.id] || [];
            const srvVotes = srvOpts.reduce((sum, o) => sum + (o.votes || 0), 0);
            const isSelected = selectedSurvey?.id === srv.id;
            return (
              <button
                key={srv.id}
                onClick={() => handleSelectSurvey(srv)}
                className={`px-4 py-3 rounded-2xl border text-left transition-all flex items-center gap-3 ${
                  isSelected
                    ? 'bg-purple-600/20 border-purple-500 text-white'
                    : 'bg-slate-900/40 border-white/5 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <span className="text-xs font-black block">{srv.title}</span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {srvOpts.length} Şık • {srvVotes} Oy
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {!selectedSurvey ? (
        <div className="text-center py-20 bg-slate-900/30 border border-dashed border-white/10 rounded-[2.5rem] space-y-4">
          <LayoutDashboard className="mx-auto text-purple-500" size={48} />
          <h2 className="text-xl font-black uppercase text-white">Anket Bulunmuyor</h2>
          <button
            onClick={handleCreateNewSurvey}
            className="inline-flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase"
          >
            <Plus size={16} /> İlk Anketi Oluştur
          </button>
        </div>
      ) : (
        <>
          {/* ANKET AYARLARI KARTI */}
          <header className="bg-slate-900/50 border border-white/10 p-6 sm:p-8 rounded-[2.5rem] backdrop-blur-md space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div className="flex items-center gap-3">
                <div className="bg-purple-600/20 p-2.5 rounded-xl text-purple-400">
                  <LayoutDashboard size={22} />
                </div>
                <div>
                  <h1 className="text-lg font-black text-white uppercase tracking-tight">Anket Yönetimi</h1>
                  <p className="text-[10px] font-bold text-slate-400">
                    Versiyon v{selectedSurvey.version || 1} • Toplam {totalVotes} Oy
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={resetCurrentSurveyVotes}
                  disabled={actionLoading}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all font-black text-[10px] uppercase"
                >
                  <RefreshCw size={14} /> Oyları Sıfırla
                </button>

                <button
                  onClick={() => toggleSurveyActiveStatus(selectedSurvey)}
                  disabled={actionLoading}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border transition-all font-black text-[10px] uppercase ${
                    selectedSurvey.is_active
                      ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-white/10 text-slate-300 hover:text-white'
                  }`}
                >
                  {selectedSurvey.is_active ? (
                    <>
                      <Archive size={14} /> Arşive Kaldır (Yayında)
                    </>
                  ) : (
                    <>
                      <ArchiveRestore size={14} /> Tekrar Yayına Al
                    </>
                  )}
                </button>

                <button
                  onClick={() => deleteSurveyPermanently(selectedSurvey)}
                  disabled={actionLoading}
                  className="p-2.5 rounded-2xl border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                  title="Anketi Kalıcı Sil"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Anket Başlığı
                </label>
                <div className="relative">
                  <input
                    value={selectedSurvey.title || ''}
                    onChange={(e) => setSelectedSurvey({ ...selectedSurvey, title: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-4 text-base font-bold text-white outline-none focus:border-purple-500"
                    placeholder="Örn: Bu Hafta Hangi Filmi İzleyelim?"
                  />
                  <Edit2 size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Oylama Bitiş Tarihi (İsteğe Bağlı)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" size={15} />
                  <input
                    type="date"
                    value={rawDeadlineDate}
                    onChange={(e) => setRawDeadlineDate(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 p-3.5 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-purple-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1.5">
                  Bitiş Saati
                </label>
                <div className="relative">
                  <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400 pointer-events-none" size={15} />
                  <input
                    type="time"
                    value={rawDeadlineTime}
                    onChange={(e) => setRawDeadlineTime(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 p-3.5 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-purple-500 [color-scheme:dark]"
                  />
                </div>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleUpdateSurvey}
                  disabled={actionLoading}
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/25"
                >
                  {actionLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                  Ayarları Kaydet
                </button>
              </div>
            </div>

            {rawDeadlineDate && (
              <div className="px-4 py-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-xs font-bold text-purple-300 flex items-center justify-between">
                <span>
                  Bitiş Görünümü:{' '}
                  <strong className="text-white">
                    {formatEventDateDisplay(buildEventDateTime(rawDeadlineDate, rawDeadlineTime))}
                  </strong>
                </span>
                {isEventPast(buildEventDateTime(rawDeadlineDate, rawDeadlineTime)) && (
                  <span className="text-[10px] font-black uppercase text-rose-400">Süre Dolmuş</span>
                )}
              </div>
            )}
          </header>

          {/* ŞIKLAR VE FİLM DETAYLARI */}
          <section className="bg-slate-900/30 border border-white/5 p-6 sm:p-8 rounded-[2.5rem] space-y-6">
            <div className="flex justify-between items-center border-b border-white/5 pb-4">
              <div>
                <h2 className="text-sm font-black text-purple-400 uppercase tracking-widest">Anket Şıkları</h2>
                <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                  Afiş yükleyebilir/yapıştırabilir, IMDb/tür bilgisi ve fragman linki ekleyebilirsiniz
                </p>
              </div>
              <button
                onClick={addOption}
                className="flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all"
              >
                <Plus size={16} />
                <span>Yeni Şık Ekle</span>
              </button>
            </div>

            <div className="grid gap-4">
              {options.map((opt) => {
                const isWinner = maxVotes > 0 && opt.votes === maxVotes;
                return (
                  <div
                    key={opt.id}
                    className={`bg-slate-950/60 border p-5 rounded-3xl transition-all space-y-4 ${
                      isWinner ? 'border-amber-500/40' : 'border-white/5 hover:border-purple-500/30'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row gap-4 items-start">
                      {/* Afiş Yükleme Alanı */}
                      <div className="relative w-24 h-28 bg-slate-900 rounded-2xl overflow-hidden border border-white/10 shrink-0 flex items-center justify-center group/img">
                        {uploadingId === opt.id ? (
                          <Loader2 className="animate-spin text-purple-500" size={20} />
                        ) : opt.image_url ? (
                          <img
                            src={opt.image_url}
                            alt=""
                            className="w-full h-full object-cover opacity-80 group-hover/img:opacity-30 transition-opacity"
                          />
                        ) : (
                          <ImageIcon className="text-slate-700" size={28} />
                        )}

                        <input
                          type="file"
                          accept="image/*"
                          className="absolute inset-0 opacity-0 cursor-pointer z-20"
                          onChange={(e) => handleImageUpload(e, opt.id)}
                        />
                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity text-[9px] font-black uppercase text-white gap-1">
                          <Upload size={16} />
                          <span>Yükle</span>
                        </div>
                      </div>

                      {/* Şık Bilgileri */}
                      <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                            Film / Etkinlik Adı
                          </label>
                          <input
                            value={opt.option_text || ''}
                            onChange={(e) => updateOptionLocal(opt.id, 'option_text', e.target.value)}
                            onBlur={() => saveOptionToDB(opt)}
                            placeholder="Örn: Inception (2010)"
                            className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-xs font-black text-white outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                            Detay / Tür / IMDb (İsteğe Bağlı)
                          </label>
                          <input
                            value={opt.description || ''}
                            onChange={(e) => updateOptionLocal(opt.id, 'description', e.target.value)}
                            onBlur={() => saveOptionToDB(opt)}
                            placeholder="Örn: Bilim Kurgu • 2s 28dk • IMDb 8.8"
                            className="w-full bg-slate-900 border border-white/10 p-3 rounded-xl text-xs font-bold text-slate-200 outline-none focus:border-purple-500"
                          />
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                            Afiş Görsel URL (Veya Soldan Dosya Yükle)
                          </label>
                          <div className="relative">
                            <Link2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                            <input
                              value={opt.image_url || ''}
                              onChange={(e) => updateOptionLocal(opt.id, 'image_url', e.target.value)}
                              onBlur={() => saveOptionToDB(opt)}
                              placeholder="https://..."
                              className="w-full bg-slate-900 border border-white/10 p-3 pl-8 rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="text-[9px] font-black uppercase text-slate-500 block mb-1">
                            Fragman Linki (YouTube vb.)
                          </label>
                          <div className="relative">
                            <PlayCircle size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
                            <input
                              value={opt.trailer_url || ''}
                              onChange={(e) => updateOptionLocal(opt.id, 'trailer_url', e.target.value)}
                              onBlur={() => saveOptionToDB(opt)}
                              placeholder="https://youtube.com/watch?v=..."
                              className="w-full bg-slate-900 border border-white/10 p-3 pl-8 rounded-xl text-xs font-bold text-slate-300 outline-none focus:border-purple-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Sağ Aksiyonlar */}
                      <div className="flex md:flex-col items-center gap-2 shrink-0 self-end md:self-center">
                        <button
                          type="button"
                          onClick={() => convertOptionToEvent(opt)}
                          title="Bu şıkkı tek tıkla yeni etkinliğe dönüştür"
                          className="px-3.5 py-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 hover:bg-amber-500 hover:text-slate-950 font-black text-[10px] uppercase flex items-center gap-1.5 transition-all"
                        >
                          <Film size={13} />
                          <span>Etkinlik Yap</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => deleteOption(opt.id)}
                          className="p-2.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                          title="Şıkkı Sil"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* CANLI SONUÇLAR */}
          <section className="bg-slate-900/50 border border-white/5 p-6 sm:p-8 rounded-[2.5rem] space-y-6">
            <div className="flex justify-between items-end">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BarChart3 className="text-purple-400" size={20} />
                  <h2 className="text-xl font-black text-white uppercase italic">Canlı Sonuçlar</h2>
                </div>
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  Gerçek zamanlı oy dağılımı
                </p>
              </div>
              <div className="text-right">
                <span className="block text-3xl font-black text-white tracking-tighter">{totalVotes}</span>
                <span className="text-[9px] font-black text-purple-400 uppercase tracking-widest">TOPLAM OY</span>
              </div>
            </div>

            <div className="grid gap-5">
              {options.map((opt) => {
                const percent = totalVotes > 0 ? ((opt.votes / totalVotes) * 100).toFixed(1) : '0';
                const isWinner = maxVotes > 0 && opt.votes === maxVotes;
                return (
                  <div key={opt.id} className="space-y-2">
                    <div className="flex justify-between items-end px-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-white uppercase">{opt.option_text}</span>
                        {isWinner && (
                          <span className="bg-amber-500 text-slate-950 text-[9px] font-black uppercase px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Trophy size={10} /> Lider
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-black text-purple-400">%{percent}</span>
                        <span className="text-[10px] font-bold text-slate-500 ml-2">({opt.votes || 0} oy)</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-white/5 p-[2px]">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isWinner
                            ? 'bg-gradient-to-r from-amber-500 to-emerald-500'
                            : 'bg-gradient-to-r from-purple-600 to-indigo-500'
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
