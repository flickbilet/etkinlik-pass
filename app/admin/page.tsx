"use client";
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdmin } from './layout';
import { 
  Plus, Calendar, MapPin, Users, Clock, CheckCircle2, TicketCheck,
  Film, Theater, Trophy, Sparkles, Armchair, CreditCard, Banknote,
  User, Link2, Archive, ArchiveRestore, Trash2, ArrowRight, Search,
  Loader2, X, Power, RefreshCcw, FolderKanban, AlertCircle, ExternalLink
} from 'lucide-react';
import { buildEventDateTime, formatEventDateDisplay, isEventPast, packEventLocation, unpackEventLocation } from '@/lib/dateUtils';

const EVENT_TYPE_META: Record<string, { label: string; icon: any }> = {
  cinema: { label: 'Sinema', icon: Film },
  theater: { label: 'Tiyatro', icon: Theater },
  social: { label: 'Sosyal', icon: Users },
  quiz: { label: 'Quiz / Yarışma', icon: Trophy },
};

export default function AdminDashboardPage() {
  const router = useRouter();
  const { events, fetchEvents, loadingEvents } = useAdmin();

  const [activeTab, setActiveTab] = useState<'active' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [statsByEvent, setStatsByEvent] = useState<Record<number, {
    approved: number;
    pending: number;
    ticketed: number;
    arrived: number;
  }>>({});
  const [loadingStats, setLoadingStats] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  // Yeni Etkinlik Oluşturma Modalı
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEvent, setNewEvent] = useState({
    event_name: '',
    event_type: 'cinema',
    raw_date: '',
    raw_time: '21:00',
    event_date: '',
    event_location: '',
    location_url: '',
    whatsapp_link: '',
    is_active: true,
    is_registration_open: true,
    is_featured: false,
    has_seating: true,
    is_paid: false,
    event_price: '',
    event_iban: '',
    event_ibanname: '',
  });

  const fetchAllParticipantStats = useCallback(async () => {
    setLoadingStats(true);
    const { data, error } = await supabase
      .from('katilimcilar')
      .select('id, etkinlik_id, onayli_mi, bilet_alindi_mi, geldi_mi');

    if (!error && data) {
      const map: Record<number, { approved: number; pending: number; ticketed: number; arrived: number }> = {};

      for (const p of data) {
        const eid = Number(p.etkinlik_id);
        if (!map[eid]) {
          map[eid] = { approved: 0, pending: 0, ticketed: 0, arrived: 0 };
        }
        if (p.onayli_mi === false || p.onayli_mi === null) {
          map[eid].pending += 1;
        } else {
          map[eid].approved += 1;
          if (p.bilet_alindi_mi) map[eid].ticketed += 1;
          if (p.geldi_mi) map[eid].arrived += 1;
        }
      }
      setStatsByEvent(map);
    }
    setLoadingStats(false);
  }, []);

  useEffect(() => {
    fetchAllParticipantStats();
  }, [fetchAllParticipantStats, events]);

  const getEventStats = (ev: any) => {
    const byId = statsByEvent[Number(ev.id)];
    if (byId) return byId;
    if (ev.slot_id && ev.slot_id !== ev.id && statsByEvent[Number(ev.slot_id)]) {
      return statsByEvent[Number(ev.slot_id)];
    }
    return { approved: 0, pending: 0, ticketed: 0, arrived: 0 };
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.event_name.trim()) return alert("Lütfen etkinlik adını girin!");
    if (!newEvent.raw_date) return alert("Lütfen etkinlik tarihini seçin!");

    setCreating(true);
    try {
      // Veritabanındaki en yüksek id ve slot_id değerini güvenli bir şekilde sorgula
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

      const isoDateTime = buildEventDateTime(newEvent.raw_date, newEvent.raw_time);
      const isPastDate = isEventPast(isoDateTime);

      // Varsayılan 16x25 tüm koltuklar açık başlasın
      const rows = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
      const defaultSeatLayout: string[] = [];
      for (const r of rows) {
        for (let c = 1; c <= 25; c++) {
          defaultSeatLayout.push(`${r}-${c}`);
        }
      }

      const payload: any = {
        id: nextId,
        slot_id: nextId,
        event_name: newEvent.event_name.trim(),
        event_type: newEvent.event_type,
        event_date: isoDateTime,
        event_location: packEventLocation(newEvent.event_location, newEvent.location_url),
        whatsapp_link: newEvent.whatsapp_link.trim(),
        // Eğer seçilen datetime geçmişse otomatik olarak geçmiş etkinliklere (is_active: false) ekle
        is_active: isPastDate ? false : newEvent.is_active,
        is_registration_open: isPastDate ? false : newEvent.is_registration_open,
        is_featured: newEvent.is_featured,
        has_seating: newEvent.has_seating,
        seat_layout: defaultSeatLayout,
        is_paid: newEvent.is_paid,
        event_price: newEvent.is_paid ? newEvent.event_price : null,
        event_iban: newEvent.is_paid ? newEvent.event_iban.trim() : null,
        event_ibanname: newEvent.is_paid ? newEvent.event_ibanname.trim() : null,
      };

      const { data: created, error } = await supabase
        .from('etkinlik_ayarlari')
        .insert([payload])
        .select()
        .single();

      if (error) throw error;

      setIsCreateModalOpen(false);
      setNewEvent({
        event_name: '',
        event_type: 'cinema',
        raw_date: '',
        raw_time: '21:00',
        event_date: '',
        event_location: '',
        location_url: '',
        whatsapp_link: '',
        is_active: true,
        is_registration_open: true,
        is_featured: false,
        has_seating: true,
        is_paid: false,
        event_price: '',
        event_iban: '',
        event_ibanname: '',
      });
      await fetchEvents();

      if (created?.id) {
        router.push(`/admin/events/${created.id}`);
      }
    } catch (err: any) {
      alert("Etkinlik oluşturulurken hata: " + err.message);
    } finally {
      setCreating(false);
    }
  };

  const toggleEventArchiveStatus = async (ev: any) => {
    const nextActive = !ev.is_active;

    // Tarihi geçmiş bir etkinliği tekrar aktif etmek isterse önce tarihini güncellemesini iste
    if (nextActive && isEventPast(ev.event_date)) {
      alert(
        `"${ev.event_name}" etkinliğinin tarihi (${formatEventDateDisplay(ev.event_date)}) geçmiş durumda.\n\nTekrar aktif edebilmek için yönlendirileceğiniz ayarlar sayfasından etkinlik tarihini ileri bir tarihe güncelleyin.`
      );
      router.push(`/admin/events/${ev.id}?tab=settings`);
      return;
    }

    setActionLoadingId(ev.id);
    const { error } = await supabase
      .from('etkinlik_ayarlari')
      .update({
        is_active: nextActive,
        is_registration_open: nextActive ? ev.is_registration_open : false,
      })
      .eq('id', ev.id);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      await fetchEvents();
    }
    setActionLoadingId(null);
  };

  const toggleRegistrationOpen = async (ev: any) => {
    setActionLoadingId(ev.id);
    const { error } = await supabase
      .from('etkinlik_ayarlari')
      .update({ is_registration_open: !ev.is_registration_open })
      .eq('id', ev.id);

    if (error) {
      alert("Hata: " + error.message);
    } else {
      await fetchEvents();
    }
    setActionLoadingId(null);
  };

  const deleteEventPermanently = async (ev: any) => {
    const stats = getEventStats(ev);
    const totalPeople = stats.approved + stats.pending;
    const confirmMsg = totalPeople > 0
      ? `"${ev.event_name}" etkinliğinde ${totalPeople} katılımcı kaydı bulunuyor! Kalıcı olarak silmek yerine "Arşive Kaldır" seçeneğini kullanmanız önerilir.\n\nYine de etkinliği ve tüm katılımcılarını silmek için SİL yazın:`
      : `"${ev.event_name}" etkinliğini kalıcı olarak silmek için SİL yazın:`;

    const input = prompt(confirmMsg);
    if (input !== "SİL") return;

    setActionLoadingId(ev.id);
    try {
      await supabase.from('katilimcilar').delete().eq('etkinlik_id', ev.id);
      const { error } = await supabase.from('etkinlik_ayarlari').delete().eq('id', ev.id);
      if (error) throw error;
      await fetchEvents();
      await fetchAllParticipantStats();
    } catch (err: any) {
      alert("Silme hatası: " + err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const activeEvents = events.filter((e: any) => e.is_active === true);
  const archivedEvents = events.filter((e: any) => e.is_active !== true);

  const displayedEvents = (activeTab === 'active' ? activeEvents : archivedEvents).filter((ev: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const displayDate = formatEventDateDisplay(ev.event_date).toLowerCase();
    return (
      (ev.event_name || '').toLowerCase().includes(q) ||
      (ev.event_location || '').toLowerCase().includes(q) ||
      displayDate.includes(q)
    );
  });

  const totalApprovedAll = Object.values(statsByEvent).reduce((acc, s) => acc + s.approved, 0);
  const totalPendingAll = Object.values(statsByEvent).reduce((acc, s) => acc + s.pending, 0);

  return (
    <div className="space-y-8 pb-20">
      {/* YENİ ETKİNLİK OLUŞTURMA MODALI */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-950 border border-white/10 rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 sm:p-8 border-b border-white/5 bg-slate-900/50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  <Plus className="text-blue-500" size={22} /> Yeni Etkinlik Oluştur
                </h2>
                <p className="text-[11px] text-slate-400 font-bold mt-1">
                  Oluşturulan etkinlik kendi yönetim sayfasına sahip olur
                </p>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="bg-slate-800 p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-rose-500/20 transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-5 custom-scrollbar">
              {/* Etkinlik Türü */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Etkinlik Türü
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {Object.entries(EVENT_TYPE_META).map(([id, meta]) => {
                    const Icon = meta.icon;
                    const selected = newEvent.event_type === id;
                    return (
                      <button
                        type="button"
                        key={id}
                        onClick={() => setNewEvent({ ...newEvent, event_type: id })}
                        className={`p-3.5 rounded-2xl flex flex-col items-center gap-1.5 border transition-all ${
                          selected
                            ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-600/20'
                            : 'bg-slate-900 border-white/5 text-slate-400 hover:text-white'
                        }`}
                      >
                        <Icon size={18} />
                        <span className="text-[10px] font-black uppercase">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Etkinlik Adı */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  Etkinlik Adı *
                </label>
                <input
                  required
                  placeholder="Örn: Interstellar Film Gösterimi"
                  className="w-full bg-slate-900 border border-white/10 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500"
                  value={newEvent.event_name}
                  onChange={(e) => setNewEvent({ ...newEvent, event_name: e.target.value })}
                />
              </div>

              {/* Tarih, Saat & Konum */}
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Etkinlik Tarihi *
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={16} />
                      <input
                        required
                        type="date"
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                        value={newEvent.raw_date}
                        onChange={(e) => {
                          const raw_date = e.target.value;
                          const event_date = buildEventDateTime(raw_date, newEvent.raw_time);
                          setNewEvent({ ...newEvent, raw_date, event_date });
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Saat *
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={16} />
                      <input
                        required
                        type="time"
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                        value={newEvent.raw_time}
                        onChange={(e) => {
                          const raw_time = e.target.value;
                          const event_date = buildEventDateTime(newEvent.raw_date, raw_time);
                          setNewEvent({ ...newEvent, raw_time, event_date });
                        }}
                      />
                    </div>
                  </div>
                </div>

                {newEvent.raw_date && (
                  <div className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    isEventPast(buildEventDateTime(newEvent.raw_date, newEvent.raw_time))
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}>
                    <span>
                      Otomatik Görünüm: <strong className="text-white">{formatEventDateDisplay(buildEventDateTime(newEvent.raw_date, newEvent.raw_time))}</strong>
                    </span>
                    {isEventPast(buildEventDateTime(newEvent.raw_date, newEvent.raw_time)) && (
                      <span className="text-[10px] font-black uppercase flex items-center gap-1">
                        <AlertCircle size={13} /> Geçmiş Tarih (Arşive Eklenir)
                      </span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                      Konum / Salon *
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                        required
                        placeholder="Örn: A Blok Konferans Salonu"
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={newEvent.event_location}
                        onChange={(e) => setNewEvent({ ...newEvent, event_location: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Google Maps Konum Linki
                      </label>
                      {newEvent.event_location.trim() && !newEvent.location_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setNewEvent({
                              ...newEvent,
                              location_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(newEvent.event_location.trim())}`,
                            })
                          }
                          className="text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          + Otomatik Oluştur
                        </button>
                      )}
                    </div>
                    <div className="relative">
                      <ExternalLink className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400" size={15} />
                      <input
                        placeholder="https://maps.app.goo.gl/..."
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={newEvent.location_url}
                        onChange={(e) => setNewEvent({ ...newEvent, location_url: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* WhatsApp Linki */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-2">
                  WhatsApp Grup Linki
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input
                    placeholder="https://chat.whatsapp.com/..."
                    className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                    value={newEvent.whatsapp_link}
                    onChange={(e) => setNewEvent({ ...newEvent, whatsapp_link: e.target.value })}
                  />
                </div>
              </div>

              {/* Anahtar Seçenekler */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, has_seating: !newEvent.has_seating })}
                  className={`p-3.5 rounded-2xl border text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    newEvent.has_seating
                      ? 'bg-blue-600/20 border-blue-500/50 text-blue-400'
                      : 'bg-slate-900 border-white/5 text-slate-500'
                  }`}
                >
                  <Armchair size={15} />
                  {newEvent.has_seating ? 'Koltuk Seçimli' : 'Koltuksuz (Genel)'}
                </button>

                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, is_registration_open: !newEvent.is_registration_open })}
                  className={`p-3.5 rounded-2xl border text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    newEvent.is_registration_open
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                      : 'bg-slate-900 border-white/5 text-slate-500'
                  }`}
                >
                  <User size={15} />
                  {newEvent.is_registration_open ? 'Kayıtlar Açık' : 'Kayıtlar Kapalı'}
                </button>

                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, is_featured: !newEvent.is_featured })}
                  className={`p-3.5 rounded-2xl border text-[10px] font-black uppercase flex items-center justify-center gap-2 transition-all ${
                    newEvent.is_featured
                      ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                      : 'bg-slate-900 border-white/5 text-slate-500'
                  }`}
                >
                  <Sparkles size={15} />
                  {newEvent.is_featured ? 'Özel Etkinlik' : 'Normal Vurgu'}
                </button>
              </div>

              {/* Ücret / Dekont Ayarı */}
              <div className="space-y-3 pt-1">
                <button
                  type="button"
                  onClick={() => setNewEvent({ ...newEvent, is_paid: !newEvent.is_paid })}
                  className={`w-full py-3.5 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center justify-center gap-2 ${
                    newEvent.is_paid
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  <CreditCard size={15} />
                  {newEvent.is_paid ? 'Ücretli Etkinlik (Dekont Zorunlu)' : 'Ücretsiz Etkinlik (Dekont İstemez)'}
                </button>

                {newEvent.is_paid && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-900/60 border border-amber-500/20">
                    <div className="sm:col-span-3 relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                      <input
                        placeholder="IBAN Hesap Sahibi Adı Soyadı"
                        className="w-full bg-slate-950 border border-white/10 p-3.5 pl-10 rounded-xl text-xs font-bold text-white outline-none"
                        value={newEvent.event_ibanname}
                        onChange={(e) => setNewEvent({ ...newEvent, event_ibanname: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-1 relative">
                      <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                      <input
                        type="number"
                        placeholder="Ücret (TL)"
                        className="w-full bg-slate-950 border border-white/10 p-3.5 pl-10 rounded-xl text-xs font-bold text-white outline-none"
                        value={newEvent.event_price}
                        onChange={(e) => setNewEvent({ ...newEvent, event_price: e.target.value })}
                      />
                    </div>
                    <div className="sm:col-span-2 relative">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                      <input
                        placeholder="TR00 0000 0000 0000 0000 0000 00"
                        className="w-full bg-slate-950 border border-white/10 p-3.5 pl-10 rounded-xl text-xs font-bold text-white outline-none font-mono"
                        value={newEvent.event_iban}
                        onChange={(e) => setNewEvent({ ...newEvent, event_iban: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-[2] bg-blue-600 hover:bg-blue-500 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30"
                >
                  {creating ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                  Etkinliği Oluştur ve Yönet
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ÜST ÖZET VE AKSİYON BARI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-400 block mb-1">Aktif Etkinlik</span>
            <span className="text-3xl font-black text-white">{activeEvents.length}</span>
          </div>
          <div className="bg-blue-500/10 text-blue-400 p-3.5 rounded-2xl">
            <FolderKanban size={24} />
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1">Geçmiş / Arşiv</span>
            <span className="text-3xl font-black text-white">{archivedEvents.length}</span>
          </div>
          <div className="bg-slate-800 text-slate-400 p-3.5 rounded-2xl">
            <Archive size={24} />
          </div>
        </div>

        <div className="bg-slate-900/50 border border-white/5 p-5 rounded-[2rem] flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400 block mb-1">Toplam Onaylı</span>
            <span className="text-3xl font-black text-white">{loadingStats ? '...' : totalApprovedAll}</span>
          </div>
          <div className="bg-emerald-500/10 text-emerald-400 p-3.5 rounded-2xl">
            <Users size={24} />
          </div>
        </div>

        <div className={`border p-5 rounded-[2rem] flex items-center justify-between transition-all ${
          totalPendingAll > 0
            ? 'bg-amber-500/10 border-amber-500/30'
            : 'bg-slate-900/50 border-white/5'
        }`}>
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400 block mb-1">Onay Bekleyen</span>
            <span className="text-3xl font-black text-white">{loadingStats ? '...' : totalPendingAll}</span>
          </div>
          <div className="bg-amber-500/20 text-amber-400 p-3.5 rounded-2xl">
            <Clock size={24} />
          </div>
        </div>
      </div>

      {/* SEKMELER, ARAMA VE YENİ ETKİNLİK BUTONU */}
      <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-4 bg-slate-900/40 p-4 rounded-[2rem] border border-white/5">
        <div className="flex gap-2 bg-slate-950/60 p-1.5 rounded-2xl border border-white/5">
          <button
            onClick={() => setActiveTab('active')}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'active'
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Power size={15} />
            <span>Aktif Etkinlikler ({activeEvents.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('archived')}
            className={`flex-1 md:flex-initial px-5 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
              activeTab === 'archived'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Archive size={15} />
            <span>Geçmiş Etkinlikler ({archivedEvents.length})</span>
          </button>
        </div>

        <div className="flex flex-1 max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
            <input
              type="text"
              placeholder="Etkinlik adı veya konum ara..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 pl-10 pr-4 py-3 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
            />
          </div>
          <button
            onClick={() => { fetchEvents(); fetchAllParticipantStats(); }}
            className="bg-slate-800 hover:bg-slate-700 p-3 rounded-2xl text-slate-300 transition-colors"
            title="Yenile"
          >
            <RefreshCcw size={18} />
          </button>
        </div>

        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/25 transition-all active:scale-95"
        >
          <Plus size={18} />
          <span>Yeni Etkinlik Ekle</span>
        </button>
      </div>

      {/* ETKİNLİK KARTLARI LİSTESİ */}
      {loadingEvents ? (
        <div className="flex justify-center p-20">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      ) : displayedEvents.length === 0 ? (
        <div className="text-center py-20 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-white/10 space-y-4">
          <FolderKanban className="mx-auto text-slate-700" size={56} />
          <div className="space-y-1">
            <h3 className="text-lg font-black uppercase text-slate-300">
              {activeTab === 'active' ? 'Aktif Etkinlik Bulunamadı' : 'Geçmiş Etkinlik Bulunamadı'}
            </h3>
            <p className="text-xs text-slate-500 font-bold">
              {activeTab === 'active'
                ? 'Yeni bir etkinlik oluşturabilir veya geçmiş etkinliklerden birini tekrar aktif edebilirsiniz.'
                : 'Arşive kaldırılan geçmiş etkinlikleriniz burada saklanır.'}
            </p>
          </div>
          {activeTab === 'active' && (
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-6 py-3.5 rounded-2xl font-black text-xs uppercase tracking-wider"
            >
              <Plus size={16} /> İlk Etkinliği Oluştur
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {displayedEvents.map((ev: any) => {
            const stats = getEventStats(ev);
            const meta = EVENT_TYPE_META[ev.event_type] || EVENT_TYPE_META.cinema;
            const TypeIcon = meta.icon;
            const isBusy = actionLoadingId === ev.id;

            return (
              <div
                key={ev.id}
                className={`rounded-[2.5rem] border p-6 sm:p-7 flex flex-col justify-between gap-6 transition-all ${
                  ev.is_active
                    ? ev.is_featured
                      ? 'bg-gradient-to-b from-amber-500/10 via-slate-900/60 to-slate-900/50 border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.1)]'
                      : 'bg-slate-900/50 border-white/10 hover:border-blue-500/40'
                    : 'bg-slate-900/30 border-white/5 opacity-90'
                }`}
              >
                {/* Üst Bilgi ve Rozetler */}
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-xl text-[10px] font-black uppercase">
                        <TypeIcon size={13} /> {meta.label}
                      </span>

                      {ev.is_featured && (
                        <span className="inline-flex items-center gap-1 bg-amber-500 text-slate-950 px-3 py-1 rounded-xl text-[10px] font-black uppercase">
                          <Sparkles size={12} /> Özel Etkinlik
                        </span>
                      )}

                      <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase border ${
                        ev.is_registration_open
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                      }`}>
                        {ev.is_registration_open ? 'Kayıt Açık' : 'Kayıt Kapalı'}
                      </span>

                      <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-slate-800 text-slate-300">
                        {ev.has_seating ? 'Koltuklu' : 'Koltuksuz'}
                      </span>

                      {ev.is_paid && (
                        <span className="px-3 py-1 rounded-xl text-[10px] font-black uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          {ev.event_price ? `${ev.event_price} TL` : 'Ücretli'}
                        </span>
                      )}
                    </div>

                    <span className="text-[10px] font-mono text-slate-500 font-bold">
                      ID #{ev.id}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-2xl font-black text-white tracking-tight leading-snug">
                      {ev.event_name}
                    </h3>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-slate-400 font-bold">
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-blue-400" /> {formatEventDateDisplay(ev.event_date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} className="text-blue-400" />
                        <span>{unpackEventLocation(ev).locationName}</span>
                        {unpackEventLocation(ev).locationUrl && (
                          <a
                            href={unpackEventLocation(ev).locationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1"
                          >
                            • Haritada Gör <ExternalLink size={11} />
                          </a>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Katılımcı İstatistik Kutuları */}
                  <div className="grid grid-cols-4 gap-2 pt-2">
                    <div className="bg-slate-950/70 border border-white/5 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-slate-500 block">Onaylı</span>
                      <span className="text-lg font-black text-white">{stats.approved}</span>
                    </div>

                    <Link
                      href={`/admin/events/${ev.id}?tab=pending`}
                      className={`border p-3 rounded-2xl text-center transition-all ${
                        stats.pending > 0
                          ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                          : 'bg-slate-950/70 border-white/5'
                      }`}
                    >
                      <span className="text-[9px] font-black uppercase text-amber-400 block">Bekleyen</span>
                      <span className="text-lg font-black text-amber-400">{stats.pending}</span>
                    </Link>

                    <div className="bg-slate-950/70 border border-white/5 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-blue-400 block">Biletli</span>
                      <span className="text-lg font-black text-blue-400">{stats.ticketed}</span>
                    </div>

                    <div className="bg-slate-950/70 border border-white/5 p-3 rounded-2xl text-center">
                      <span className="text-[9px] font-black uppercase text-emerald-400 block">İçeride</span>
                      <span className="text-lg font-black text-emerald-400">{stats.arrived}</span>
                    </div>
                  </div>
                </div>

                {/* Alt Aksiyon Butonları */}
                <div className="flex flex-wrap items-center gap-2 pt-4 border-t border-white/5">
                  <Link
                    href={`/admin/events/${ev.id}`}
                    className="flex-1 min-w-[180px] bg-blue-600 hover:bg-blue-500 text-white py-3.5 px-5 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95"
                  >
                    <span>Etkinliği Yönet</span>
                    <ArrowRight size={16} />
                  </Link>

                  {ev.is_active && (
                    <button
                      disabled={isBusy}
                      onClick={() => toggleRegistrationOpen(ev)}
                      className={`px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider border transition-all ${
                        ev.is_registration_open
                          ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-rose-500/20 hover:text-rose-400'
                          : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                      }`}
                      title="Yeni Kayıt Alımını Aç/Kapat"
                    >
                      {ev.is_registration_open ? 'Kaydı Kapat' : 'Kaydı Aç'}
                    </button>
                  )}

                  <button
                    disabled={isBusy}
                    onClick={() => toggleEventArchiveStatus(ev)}
                    className={`px-4 py-3.5 rounded-2xl font-black text-[10px] uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                      ev.is_active
                        ? 'bg-slate-800/80 border-white/10 text-slate-300 hover:bg-amber-500/20 hover:text-amber-400'
                        : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400 hover:bg-emerald-600 hover:text-white'
                    }`}
                    title={ev.is_active ? 'Geçmiş Etkinliklere (Arşive) Kaldır' : 'Tekrar Aktif Etkinlik Yap'}
                  >
                    {isBusy ? (
                      <Loader2 className="animate-spin" size={14} />
                    ) : ev.is_active ? (
                      <>
                        <Archive size={14} /> Arşivle
                      </>
                    ) : (
                      <>
                        <ArchiveRestore size={14} /> Aktif Et
                      </>
                    )}
                  </button>

                  <button
                    disabled={isBusy}
                    onClick={() => deleteEventPermanently(ev)}
                    className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 hover:bg-rose-600 hover:text-white transition-all"
                    title="Etkinliği Kalıcı Olarak Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
