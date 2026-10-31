"use client";
import { useState, useEffect, createContext, useContext, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  Lock, ShieldCheck, CalendarRange, ClipboardList, 
  Loader2, LogOut, ExternalLink, AlertCircle, Calendar
} from 'lucide-react';
import { isEventPast } from '@/lib/dateUtils';

const AdminContext = createContext<any>(null);
export const useAdmin = () => useContext(AdminContext);

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Dinamik etkinlik listesi
  const [events, setEvents] = useState<any[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);

  const isEmailAuthorized = (userEmail?: string) => {
    if (!userEmail) return false;
    const allowedEnv = process.env.NEXT_PUBLIC_ADMIN_EMAILS;
    if (!allowedEnv || allowedEnv.trim() === "") return true;
    const allowedList = allowedEnv
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    return allowedList.length === 0 || allowedList.includes(userEmail.toLowerCase());
  };

  const fetchEvents = useCallback(async () => {
    setLoadingEvents(true);
    const { data, error } = await supabase
      .from('etkinlik_ayarlari')
      .select('*')
      .order('is_active', { ascending: false })
      .order('is_featured', { ascending: false })
      .order('id', { ascending: false });

    if (!error && data) {
      // Tarihi geçmiş aktif etkinlikleri otomatik olarak arşive (is_active: false) aktar
      const processedEvents = await Promise.all(
        data.map(async (ev: any) => {
          if (ev.is_active && isEventPast(ev.event_date)) {
            await supabase
              .from('etkinlik_ayarlari')
              .update({ is_active: false, is_registration_open: false })
              .eq('id', ev.id);
            return { ...ev, is_active: false, is_registration_open: false };
          }
          return ev;
        })
      );
      setEvents(processedEvents);
    }
    setLoadingEvents(false);
  }, []);

  useEffect(() => {
    const verifySession = async (currentSession: any) => {
      if (!currentSession?.user) {
        setSession(null);
        setIsAuthenticated(false);
        setIsAuthLoading(false);
        return;
      }

      // Güvenlik Kontrolü: İzin verilen admin e-posta kontrolü
      if (!isEmailAuthorized(currentSession.user.email)) {
        await supabase.auth.signOut();
        setSession(null);
        setIsAuthenticated(false);
        setAuthError("Bu e-posta adresi admin paneli için yetkili değil.");
        setIsAuthLoading(false);
        return;
      }

      setSession(currentSession);
      setIsAuthenticated(true);
      setIsAuthLoading(false);
    };

    supabase.auth.getSession()
      .then(({ data, error }: any) => {
        if (error) {
          verifySession(null);
        } else {
          verifySession(data?.session);
        }
      })
      .catch(() => {
        verifySession(null);
      });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, newSession: any) => {
      verifySession(newSession);
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchEvents();
    }
  }, [isAuthenticated, fetchEvents]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoginLoading(true);
    try {
      if (!isEmailAuthorized(email.trim())) {
        setAuthError("Bu e-posta adresi admin girişi için yetkili değil.");
        return;
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setAuthError("Giriş başarısız: " + error.message);
      } else if (data?.session) {
        setSession(data.session);
        setIsAuthenticated(true);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = async () => { 
    await supabase.auth.signOut();
    setSession(null);
    setIsAuthenticated(false);
  };

  if (isAuthLoading) {
    return (
      <main className="min-h-screen bg-[#020617] flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={48} />
      </main>
    );
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-[#020617] flex items-center justify-center p-6 text-white">
        <div className="w-full max-w-md bg-slate-900/40 border border-white/10 p-10 rounded-[2.5rem] text-center shadow-2xl backdrop-blur-xl">
          <div className="bg-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-600/30">
            <Lock size={32} />
          </div>
          <h1 className="text-2xl font-black uppercase tracking-tight mb-2">Flick Admin</h1>
          <p className="text-xs text-slate-400 font-bold mb-6">Etkinlik ve Bilet Yönetim Sistemi</p>

          {authError && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl text-rose-400 text-xs font-bold flex items-center gap-2 text-left">
              <AlertCircle size={18} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              type="email" 
              placeholder="Admin E-posta Adresi" 
              className="w-full bg-slate-950 border border-white/10 p-5 rounded-2xl outline-none text-center focus:border-blue-500/50 transition-colors" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              autoFocus 
              required 
            />
            <input 
              type="password" 
              placeholder="Şifre" 
              className="w-full bg-slate-950 border border-white/10 p-5 rounded-2xl outline-none text-center focus:border-blue-500/50 transition-colors" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            <button 
              type="submit" 
              disabled={loginLoading}
              className="w-full bg-blue-600 p-5 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-blue-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loginLoading ? <Loader2 className="animate-spin" size={18} /> : "Giriş Yap"}
            </button>
          </form>
        </div>
      </main>
    );
  }

  const isEventsRoute = pathname === '/admin' || pathname?.startsWith('/admin/events');
  const isSurveyRoute = pathname === '/admin/survey';

  return (
    <AdminContext.Provider value={{
      events,
      setEvents,
      fetchEvents,
      loadingEvents,
      isAuthenticated,
      session
    }}>
      <main className="min-h-screen bg-[#020617] text-white p-4 md:p-8 font-sans flex flex-col items-center">
        {/* Üst Navigasyon Barı */}
        <header className="w-full max-w-6xl flex flex-wrap justify-between items-center gap-4 bg-slate-900/50 p-4 sm:p-5 rounded-[2rem] border border-white/10 mb-8 backdrop-blur-xl shadow-xl">
          <Link href="/admin" className="flex items-center gap-3 group">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-600/20 group-hover:scale-105 transition-transform">
              <ShieldCheck size={24} />
            </div>
            <div>
              <h1 className="text-lg font-black uppercase tracking-tight leading-none">Flick Admin</h1>
              <span className="text-[10px] text-slate-400 font-bold truncate block max-w-[180px] sm:max-w-xs mt-1">
                {session?.user?.email || "Yönetim Paneli"}
              </span>
            </div>
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            <Link 
              href="/admin" 
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                isEventsRoute 
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <CalendarRange size={18} />
              <span>Etkinlikler</span>
            </Link>

            <Link 
              href="/admin/calendar" 
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                pathname === '/admin/calendar'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <Calendar size={18} />
              <span>Takvim</span>
            </Link>

            <Link 
              href="/admin/members" 
              className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                pathname === '/admin/members'
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25' 
                  : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <ClipboardList size={18} />
              <span>Katılımcılar</span>
            </Link>

            {false && (
              <Link 
                href="/admin/survey" 
                className={`flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all ${
                  isSurveyRoute 
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/25' 
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <ClipboardList size={18} />
                <span>Anket</span>
              </Link>
            )}

            <Link 
              href="/" 
              target="_blank"
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl text-xs font-bold bg-slate-800/50 text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
              title="Kullanıcı Sitesini Aç"
            >
              <ExternalLink size={16} />
              <span className="hidden sm:inline text-[11px] uppercase font-black">Site</span>
            </Link>

            <button 
              onClick={handleLogout} 
              className="flex items-center gap-1.5 px-3.5 py-3 rounded-2xl text-xs font-black uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-600 hover:text-white transition-all"
              title="Çıkış Yap"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline text-[11px]">Çıkış</span>
            </button>
          </div>
        </header>

        <div className="w-full max-w-6xl flex-1">
          {children}
        </div>

        <style jsx global>{`
          #reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
          #reader { border: none !important; }
          .custom-scrollbar::-webkit-scrollbar { width: 6px; height: 6px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.1); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(59, 130, 246, 0.3); border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(59, 130, 246, 0.6); }
        `}</style>
      </main>
    </AdminContext.Provider>
  );
}
