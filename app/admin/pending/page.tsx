"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../layout';
import { 
  UserCheck, RefreshCcw, Loader2, Clock, Check, AlertTriangle, X, GraduationCap, UserCheck2, Copy
} from 'lucide-react';

export default function PendingParticipantsPage() {
  const { selectedSlotId } = useAdmin(); 
  const [participants, setParticipants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorLog, setErrorLog] = useState<string | null>(null);

  // İŞLEM YAPILAN KULLANICI ID'Sİ (ÇİFT TIKLAMAYI ÖNLEMEK VE LOADING GÖSTERMEK İÇİN)
  const [approvingId, setApprovingId] = useState<string | number | null>(null);

  // REDDETME MODALI STATE'LERİ
  const [rejectingPerson, setRejectingPerson] = useState<any | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    if (selectedSlotId) {
      fetchPendingParticipants();
    }
  }, [selectedSlotId]);

  async function fetchPendingParticipants() {
    setLoading(true);
    setErrorLog(null);

    try {
      const { data, error } = await supabase
        .from('katilimcilar')
        .select('*')
        .eq('etkinlik_id', selectedSlotId);

      if (error) {
        setErrorLog("Supabase Hatası: " + error.message);
      } else if (data) {
        const pendingOnes = data.filter(p => p.onayli_mi === false || p.onayli_mi === null);
        setParticipants(pendingOnes);
        
        if (data.length > 0 && pendingOnes.length === 0) {
          setErrorLog(`Bu etkinlikte ${data.length} kişi var ama hepsi onaylı.`);
        }
      }
    } catch (err: any) {
      setErrorLog("Bağlantı Hatası: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function approveUser(person: any) {
    if (approvingId) return; // Zaten işlem yapılıyorsa engelle
    setApprovingId(person.id);

    try {
      // 1. Supabase'de kullanıcının durumunu onaylandı yap
      const { error } = await supabase
        .from('katilimcilar')
        .update({ onayli_mi: true })
        .eq('id', person.id);

      if (error) throw error;

      // 2. Eğer kullanıcının email adresi varsa Resend API rotasına e-posta isteği at
      if (person.email && String(person.email).trim() !== "") {
        const res = await fetch('/api/send-approval', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: String(person.email).trim(),
            ad_soyad: person.ad_soyad
          }),
        });

        if (!res.ok) {
          const resData = await res.json();
          console.error("Resend E-posta Gönderme Hatası:", resData.error);
        }
      }

      // 3. İşlem başarılı olunca katılımcıyı bekleyenler listesinden kaldır
      setParticipants(prev => prev.filter(p => p.id !== person.id));

    } catch (err: any) {
      alert("Hata oluştu: " + (err.message || "Onaylama işlemi başarısız."));
    } finally {
      setApprovingId(null);
    }
  }

  // REDDET BUTONUNA BASILDIĞINDA UYARI PENCERESİNİ AÇMA VE NUMARAYI KOPYALAMA
  const handleOpenRejectModal = (person: any) => {
    setRejectingPerson(person);
    if (person.telefon) {
      navigator.clipboard.writeText(person.telefon);
    }
  };

  // REDDETME İŞLEMİNİ GERÇEKLEŞTİRİP KAYDI SİLME
  const handleConfirmReject = async () => {
    if (!rejectingPerson) return;
    setIsRejecting(true);

    const { error } = await supabase
      .from('katilimcilar')
      .delete()
      .eq('id', rejectingPerson.id);

    if (!error) {
      setParticipants(prev => prev.filter(p => p.id !== rejectingPerson.id));
      setRejectingPerson(null);
    } else {
      alert("Silme hatası: " + error.message);
    }
    setIsRejecting(false);
  };

  return (
    <div className="space-y-6">
      {/* REDDETME ONAY UYARI MODALI */}
      {rejectingPerson && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-rose-500/30 w-full max-w-md p-6 rounded-[2rem] shadow-2xl space-y-5 text-white">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2 text-rose-500 font-black text-sm uppercase tracking-wider">
                <AlertTriangle size={20} />
                <span>KAYIT REDDEDİLSİN Mİ?</span>
              </div>
              <button 
                onClick={() => setRejectingPerson(null)}
                className="text-slate-400 hover:text-white p-2 rounded-xl bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-white/5">
              <p className="text-sm font-bold text-slate-200">
                <span className="text-rose-400">{rejectingPerson.ad_soyad}</span> isimli kullanıcının kaydını silmek istediğinize emin misiniz?
              </p>
              
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-300 font-medium">
                Emin misin? Telefon numarasını kopyala ve haber ver.
              </div>

              <div className="flex items-center justify-between bg-slate-900 p-3 rounded-xl border border-white/10 text-xs">
                <span className="text-slate-400 font-bold">Kopyalanan Telefon:</span>
                <span className="font-mono font-bold text-amber-400 flex items-center gap-1">
                  {rejectingPerson.telefon} <Copy size={12} />
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPerson(null)}
                className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                İPTAL
              </button>

              <button
                type="button"
                disabled={isRejecting}
                onClick={handleConfirmReject}
                className="w-full bg-rose-600 hover:bg-rose-500 text-white py-3.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
              >
                {isRejecting ? <Loader2 className="animate-spin" size={16} /> : null}
                TAMAM (SİL)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Hata Mesajı Paneli */}
      {errorLog && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3 text-amber-500 text-sm">
          <AlertTriangle size={20} />
          <p>{errorLog}</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold uppercase text-white">Onay Bekleyenler</h1>
          <p className="text-slate-400 text-sm italic">Slot ID: {selectedSlotId || 'Seçilmedi'}</p>
        </div>
        <button onClick={fetchPendingParticipants} className="p-3 bg-white/5 rounded-2xl text-white">
          <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="grid gap-3">
        {loading ? (
          <div className="flex justify-center p-20"><Loader2 className="animate-spin text-blue-500" size={40} /></div>
        ) : participants.length === 0 ? (
          <div className="text-center p-12 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-white/10 text-white">
            <UserCheck className="mx-auto text-slate-700 mb-4" size={48} />
            <p className="text-slate-500 font-bold uppercase text-xs">Görüntülenecek bekleyen kayıt yok.</p>
          </div>
        ) : participants.map((person) => (
          <div key={person.id} className="bg-slate-900/40 border border-white/5 p-5 rounded-3xl flex justify-between items-center text-white gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={14} className="text-amber-500" />
                <h3 className="font-bold text-lg">{person.ad_soyad}</h3>
              </div>
              <p className="text-sm text-slate-400">{person.telefon}</p>

              {/* OKUL VE REFERANS BİLGİLERİ */}
              <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                {person.okul && (
                  <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    <GraduationCap size={14} className="text-blue-400" />
                    <span>{person.okul}</span>
                  </div>
                )}
                {person.referans && (
                  <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                    <UserCheck2 size={14} className="text-purple-400" />
                    <span>Ref: {person.referans}</span>
                  </div>
                )}
              </div>

              {person.dekont_url && (
                <a href={person.dekont_url} target="_blank" className="text-blue-400 text-xs font-bold hover:underline mt-2 inline-block">DEKONTU GÖR</a>
              )}
            </div>

            {/* BUTONLAR (ONAYLA VE ALTINDA REDDET) */}
            <div className="flex flex-col gap-2 min-w-[130px]">
              <button 
                disabled={approvingId === person.id}
                onClick={() => approveUser(person)}
                className="bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
              >
                {approvingId === person.id ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <>
                    <Check size={16} /> ONAYLA
                  </>
                )}
              </button>

              <button 
                onClick={() => handleOpenRejectModal(person)}
                className="bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 px-5 py-2.5 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
              >
                <X size={16} /> ONAYI REDDET
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
