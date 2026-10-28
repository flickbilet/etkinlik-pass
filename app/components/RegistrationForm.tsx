"use client";
import { useState, useEffect } from 'react';
import { 
  Loader2, Film, Theater, Users, Trophy, 
  CalendarDays, MapPin, ChevronRight, ArrowLeft, Ticket, 
  User, Smartphone, Search, Presentation, AlertCircle, Sparkles, CalendarX2, ExternalLink, Vote, HelpCircle
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { formatEventDateDisplay, unpackEventLocation } from '@/lib/dateUtils';
import SurveyWidget from './SurveyWidget';

const EVENT_ICONS: Record<string, React.ElementType> = {
  cinema: Film,
  theater: Theater,
  social: Users,
  quiz: Trophy
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  cinema: 'SİNEMA',
  theater: 'TİYATRO',
  social: 'SOSYAL ETKİNLİK',
  quiz: 'YARIŞMA / QUIZ'
};

interface RegistrationFormProps {
  step: number;
  setStep: (step: number) => void;
  eventSlots: any[];
  loading: boolean;
  selectedEvent: any;
  setSelectedEvent: (event: any) => void;
  adSoyad: string;
  setAdSoyad: (val: string) => void;
  telefon: string;
  setTelefon: (val: string) => void;
  handleSubmit: (e: React.FormEvent) => void;
  error: string;
}

// Anket sistemi kodlarda hazır tutulur, arayüzde görünmesi istendiğinde true yapılır
const SHOW_SURVEY_IN_UI = false;

export default function RegistrationForm({
  step, setStep, eventSlots, loading, selectedEvent, setSelectedEvent,
  adSoyad, setAdSoyad, telefon, setTelefon, handleSubmit, error
}: RegistrationFormProps) {
  const [homeTab, setHomeTab] = useState<'events' | 'survey'>('events');
  const [activeSurveyInfo, setActiveSurveyInfo] = useState<{ exists: boolean; title: string }>({
    exists: false,
    title: '',
  });

  useEffect(() => {
    if (!SHOW_SURVEY_IN_UI) return;
    supabase
      .from('surveys')
      .select('id, title')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setActiveSurveyInfo({ exists: true, title: data.title });
        } else {
          setActiveSurveyInfo({ exists: false, title: '' });
        }
      });
  }, []);

  const getEventIcon = (type: string, size = 16) => {
    const Icon = EVENT_ICONS[type] || Film;
    return <Icon size={size} />;
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setAdSoyad(adSoyad.trim());
    setTelefon(telefon.trim());
    handleSubmit(e);
  };

  // Yalnızca aktif olan etkinlikleri göster, özel (featured) etkinlikleri en üste al
  const activeEvents = eventSlots
    .filter((event) => event.is_active === true)
    .sort((a, b) => Number(!!b.is_featured) - Number(!!a.is_featured));

  // Her durumda kullanıcı arayüzünde minimum 4 slot gösterilir (boş olanlar "Çok Yakında" olarak dolar)
  const placeholderCount = Math.max(0, 4 - activeEvents.length);
  const placeholderSlots = Array.from({ length: placeholderCount }, (_, i) => ({
    id: `placeholder-slot-${i + 1}`,
    is_placeholder: true,
    is_active: false,
    event_name: 'Çok Yakında',
    event_type: 'cinema',
    event_date: null,
    event_location: 'Bilinmiyor',
  }));

  const displaySlots = [...activeEvents, ...placeholderSlots];

  return (
    <>
      {step === 0 && (
        <div className="view-transition space-y-6">
          {SHOW_SURVEY_IN_UI ? (
            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-950/70 border border-white/5 rounded-2xl">
              <button
                type="button"
                onClick={() => setHomeTab('events')}
                className={`py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                  homeTab === 'events'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles size={14} />
                <span>Aktif Etkinlikler</span>
                {!loading && activeEvents.length > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                    homeTab === 'events' ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {activeEvents.length}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setHomeTab('survey')}
                className={`py-3 px-4 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${
                  homeTab === 'survey'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Vote size={14} />
                <span>Sen Seç (Anket)</span>
                {activeSurveyInfo.exists && (
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="text-amber-400" size={18} />
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.2em]">ETKİNLİK TAKVİMİ</h3>
              </div>
              {!loading && (
                <span className="text-[10px] font-black text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
                  {activeEvents.length > 0 ? `${activeEvents.length} Aktif Etkinlik` : 'Çok Yakında'}
                </span>
              )}
            </div>
          )}

          {homeTab === 'events' || !SHOW_SURVEY_IN_UI ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4">
                {loading ? (
                  <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>
                ) : (
                  displaySlots.map((event, index) => {
                    // BOŞ / DEVRE DIŞI (ÇOK YAKINDA) SLOTLARI
                    if (event.is_placeholder || !event.is_active) {
                      const slotNum = event.slot_id || index + 1;
                      return (
                        <div
                          key={event.id || `empty-slot-${index}`}
                          className="relative overflow-hidden rounded-[2rem] border bg-slate-900/10 border-white/5 cursor-not-allowed select-none transition-all"
                        >
                          {/* MERKEZDEKİ ÇOK YAKINDA KATMANI (BUZLU CAM & İKON) */}
                          <div className="absolute inset-0 z-20 backdrop-blur-sm bg-[#020617]/45 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2">
                              <HelpCircle size={44} className="text-slate-400 stroke-[1.6]" />
                              <span className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                                ÇOK YAKINDA
                              </span>
                            </div>
                          </div>

                          {/* ARKA PLANDA GÖRÜNEN MÜLAZA DETAYLARI */}
                          <div className="p-6 flex items-center justify-between gap-4 grayscale opacity-40">
                            <div className="space-y-2 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-slate-500">
                                  <Film size={16} />
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">
                                  SLOT {slotNum} • BELİRSİZ
                                </span>
                              </div>
                              <h4 className="text-xl font-black text-slate-300">Çok Yakında</h4>
                              <div className="flex flex-wrap gap-4 pt-1 text-[10px] font-bold uppercase text-slate-500">
                                <div className="flex items-center gap-1.5">
                                  <CalendarDays size={12} /> TARİH: BİLİNMİYOR
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <MapPin size={12} /> KONUM: BİLİNMİYOR
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const isFeatured = !!event.is_featured;
                    const isRegClosed = event.is_registration_open === false;
                    const { locationName, locationUrl } = unpackEventLocation(event);

                    return (
                      <div
                        key={event.id}
                        onClick={() => { setSelectedEvent(event); setStep(1); }}
                        className={`relative overflow-hidden rounded-[2rem] border transition-all duration-500 cursor-pointer
                          ${isFeatured
                            ? 'bg-gradient-to-br from-amber-500/15 via-slate-900/90 to-slate-900/80 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] hover:border-amber-400 hover:shadow-[0_0_35px_rgba(245,158,11,0.35)] hover:scale-[1.02] active:scale-[0.98]'
                            : 'bg-slate-900/60 border-white/5 hover:border-blue-500/50 hover:scale-[1.02] active:scale-[0.98]'}`}
                      >
                        {/* ÖZEL ETKİNLİK ROZETİ */}
                        {isFeatured && (
                          <div className="absolute top-0 right-0 z-10">
                            <div className="bg-gradient-to-l from-amber-500 to-amber-600 text-slate-950 font-black text-[8px] uppercase tracking-widest px-3 py-1 rounded-bl-2xl flex items-center gap-1 shadow-lg">
                              <Sparkles size={10} className="animate-spin" style={{ animationDuration: '4s' }} />
                              <span>ÖZEL ETKİNLİK</span>
                            </div>
                          </div>
                        )}

                        <div className="p-6 flex items-center justify-between gap-4">
                          <div className="space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={isFeatured ? 'text-amber-400' : 'text-blue-500'}>
                                {getEventIcon(event.event_type)}
                              </span>
                              <span className={`text-[9px] font-bold uppercase tracking-widest ${isFeatured ? 'text-amber-400/90' : 'text-slate-500'}`}>
                                {EVENT_TYPE_LABELS[event.event_type] || event.event_type}
                              </span>
                              {isRegClosed && (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 px-2 py-0.5 rounded-md">
                                  SADECE BİLET SORGULAMA
                                </span>
                              )}
                            </div>
                            <h4 className="text-xl font-black text-white truncate">{event.event_name}</h4>
                            <div className="flex flex-wrap gap-4 pt-1">
                              <div className={`flex items-center gap-1.5 text-[10px] font-medium uppercase ${isFeatured ? 'text-amber-200/70' : 'text-slate-500'}`}>
                                <CalendarDays size={12} /> {formatEventDateDisplay(event.event_date)}
                              </div>
                              <div className={`flex flex-wrap items-center gap-1.5 text-[10px] font-medium uppercase ${isFeatured ? 'text-amber-200/70' : 'text-slate-500'}`}>
                                <MapPin size={12} />
                                <span>{locationName}</span>
                                {locationUrl && (
                                  <a
                                    href={locationUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="inline-flex items-center gap-1 text-[9px] font-black uppercase text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-1"
                                  >
                                    • Haritada Gör <ExternalLink size={10} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className={`shrink-0 ${isFeatured ? 'bg-amber-500/20 text-amber-400 p-3 rounded-2xl border border-amber-500/30' : 'bg-blue-600/10 text-blue-500 p-3 rounded-2xl'}`}>
                            <ChevronRight size={20} />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {SHOW_SURVEY_IN_UI && activeSurveyInfo.exists && (
                <div
                  onClick={() => setHomeTab('survey')}
                  className="mt-2 p-5 rounded-[2rem] bg-gradient-to-r from-purple-600/15 via-indigo-600/10 to-slate-900/60 border border-purple-500/30 hover:border-purple-400/60 flex items-center justify-between gap-4 cursor-pointer transition-all hover:scale-[1.01] active:scale-[0.99]"
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="bg-purple-600/20 border border-purple-500/30 text-purple-400 p-3 rounded-2xl shrink-0">
                      <Vote size={20} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-[9px] font-black uppercase tracking-widest text-purple-400 block">
                        SEN SEÇ • AKTİF ANKET
                      </span>
                      <h4 className="text-sm font-black text-white truncate">
                        {activeSurveyInfo.title}
                      </h4>
                    </div>
                  </div>
                  <div className="shrink-0 bg-purple-600/20 text-purple-300 px-3.5 py-2 rounded-xl text-[10px] font-black uppercase flex items-center gap-1">
                    <span>Oy Ver</span>
                    <ChevronRight size={14} />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <SurveyWidget
              onSurveyLoaded={(exists, title) =>
                setActiveSurveyInfo({ exists, title: title || '' })
              }
            />
          )}
        </div>
      )}

      {step === 1 && (
        <div id="step-ticket-lookup" className="view-transition max-w-md mx-auto">
          <button onClick={() => setStep(0)} className="flex items-center gap-2 text-slate-500 font-bold text-[10px] uppercase tracking-widest mb-6 hover:text-white transition-colors">
            <ArrowLeft size={14} /> ETKİNLİKLERE DÖN
          </button>
          <div className="flex flex-col items-center mb-8 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500/20 to-indigo-600/20 rounded-2xl flex items-center justify-center mb-6 border border-white/10 shadow-xl">
              <Ticket size={32} className="text-blue-500" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter bg-gradient-to-b from-white to-slate-500 bg-clip-text text-transparent uppercase">BİLGİLERİNİZ</h1>
            <p className="text-[11px] text-slate-500 font-bold mt-2">Onaylanan kaydınızla biletinizi veya koltuğunuzu alın</p>
          </div>

          <form onSubmit={onFormSubmit} className="space-y-6">
            <div className="relative group">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input required type="text" placeholder="Ad ve Soyad" value={adSoyad} className="w-full bg-slate-950/50 border border-slate-800 p-4 pl-12 rounded-2xl text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all" onChange={(e) => setAdSoyad(e.target.value)} />
            </div>
            <div className="relative group">
              <Smartphone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={20} />
              <input required type="tel" maxLength={10} value={telefon} placeholder="5XXXXXXXXX" className="w-full bg-slate-950/50 border border-slate-800 p-4 pl-12 rounded-2xl text-white outline-none focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/5 transition-all" onChange={(e) => setTelefon(e.target.value.replace(/\D/g, ""))} />
            </div>
            <button disabled={loading} type="submit" className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 p-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl shadow-blue-900/40">
              {loading ? <Loader2 className="animate-spin" /> : <Search size={20} />}
              <span className="tracking-widest uppercase text-sm">
                {selectedEvent?.has_seating === false ? 'Biletimi Hazırla' : 'Koltuk Seçimine Geç'}
              </span>
            </button>

            {selectedEvent && (() => {
              const { locationName, locationUrl } = unpackEventLocation(selectedEvent);
              return (
                <div className="grid grid-cols-1 gap-3 pt-4">
                  <div className="bg-white/5 border border-white/10 p-5 rounded-[2rem] backdrop-blur-sm">
                    <p className="text-[9px] font-bold text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Presentation size={14} className="shrink-0" /> SEÇİLEN ETKİNLİK DETAYLARI
                    </p>
                    <div className="space-y-2">
                      <p className="text-white font-black text-sm uppercase tracking-tight">{selectedEvent.event_name}</p>
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-2 text-slate-400 text-[10px] font-bold uppercase">
                          <CalendarDays size={12} className="text-slate-500 shrink-0" /> {formatEventDateDisplay(selectedEvent.event_date)}
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-slate-400 text-[10px] font-bold uppercase">
                          <MapPin size={12} className="text-slate-500 shrink-0" />
                          <span>{locationName}</span>
                          {locationUrl && (
                            <a
                              href={locationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-blue-400 hover:text-blue-300 underline underline-offset-2 ml-0.5"
                            >
                              • Haritada Gör <ExternalLink size={11} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {error && (
              <div className="flex items-center gap-2 text-rose-400 bg-rose-400/10 p-3 rounded-xl border border-rose-400/20">
                <AlertCircle size={16} />
                <p className="text-xs font-bold">{error}</p>
              </div>
            )}
          </form>
        </div>
      )}
    </>
  );
}
