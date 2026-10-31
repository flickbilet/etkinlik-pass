"use client";
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';
import { 
  Users, Search, Download, Phone, Mail, School, 
  Calendar, CheckCircle2, XCircle, ArrowUpDown, Loader2, 
  X, ExternalLink, ShieldCheck, Ticket, UserCheck, AlertCircle, Copy, Edit3, Trash2,
  ShieldAlert, Ban
} from 'lucide-react';
import { formatEventDateDisplay } from '@/lib/dateUtils';

export default function AdminMembersPage() {
  const [members, setMembers] = useState<any[]>([]);
  const [tickets, setTickets] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'id' | 'telefon' | 'ad_soyad' | 'event_count'>('telefon');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  
  // Detay Modalı
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editFormData, setEditFormData] = useState({ ad_soyad: '', telefon: '', email: '', okul: '', referans: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [membersRes, ticketsRes, eventsRes] = await Promise.all([
        supabase.from('katilimcilar').select('*').order('id', { ascending: true }),
        supabase.from('biletler').select('*'),
        supabase.from('etkinlik_ayarlari').select('id, event_name, event_date, event_type')
      ]);

      if (membersRes.data) {
        // Telefon numarasına göre tekil üye havuzu oluştur
        const seenPhones = new Set<string>();
        const uniqueMembers: any[] = [];
        for (const m of membersRes.data) {
          const cleanTel = String(m.telefon || '').trim();
          if (cleanTel && seenPhones.has(cleanTel)) continue;
          if (cleanTel) seenPhones.add(cleanTel);
          uniqueMembers.push({
            ...m,
            is_banned: m.is_banned === true || (typeof m.referans === 'string' && m.referans.includes('[YASAKLI]')),
          });
        }
        setMembers(uniqueMembers);
      }
      if (ticketsRes.data) setTickets(ticketsRes.data);
      if (eventsRes.data) setEvents(eventsRes.data);
    } catch (err) {
      console.error("Veri çekme hatası:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const eventMap = useMemo(() => {
    return new Map(events.map(e => [Number(e.id), e]));
  }, [events]);

  const memberStats = useMemo(() => {
    const map = new Map<number, { count: number; arrived: number; tickets: any[] }>();
    for (const t of tickets) {
      const kid = Number(t.katilimci_id);
      if (!map.has(kid)) {
        map.set(kid, { count: 0, arrived: 0, tickets: [] });
      }
      const entry = map.get(kid)!;
      entry.count += 1;
      if (t.geldi_mi) entry.arrived += 1;
      entry.tickets.push({
        ...t,
        event: eventMap.get(Number(t.etkinlik_id)) || null
      });
    }
    return map;
  }, [tickets, eventMap]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const result = members.filter(m => {
      if (!q) return true;
      return (
        String(m.id).includes(q) ||
        (m.ad_soyad || '').toLowerCase().includes(q) ||
        (m.telefon || '').includes(q) ||
        (m.email || '').toLowerCase().includes(q) ||
        (m.okul || '').toLowerCase().includes(q)
      );
    });

    result.sort((a, b) => {
      let valA: any = a[sortBy];
      let valB: any = b[sortBy];

      if (sortBy === 'event_count') {
        valA = memberStats.get(Number(a.id))?.count || 0;
        valB = memberStats.get(Number(b.id))?.count || 0;
      }

      if (typeof valA === 'string') {
        const cmp = valA.localeCompare(valB || '', 'tr');
        return sortOrder === 'asc' ? cmp : -cmp;
      }
      return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return result;
  }, [members, search, sortBy, sortOrder, memberStats]);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedPhone(text);
    setTimeout(() => setCopiedPhone(null), 2000);
  };

  const handleOpenDetail = (member: any) => {
    setSelectedMember(member);
    setIsEditing(false);
    setEditFormData({
      ad_soyad: member.ad_soyad || '',
      telefon: member.telefon || '',
      email: member.email || '',
      okul: member.okul || '',
      referans: member.referans || ''
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedMember) return;
    setSavingEdit(true);
    try {
      const { error } = await supabase
        .from('katilimcilar')
        .update({
          ad_soyad: editFormData.ad_soyad.trim(),
          telefon: editFormData.telefon.trim(),
          email: editFormData.email.trim(),
          okul: editFormData.okul.trim(),
          referans: editFormData.referans.trim()
        })
        .eq('id', selectedMember.id);

      if (error) {
        if (error.message?.includes('is_banned') || error.code === 'PGRST204') {
          alert("Veritabanı Uyarısı:\n\n'katilimcilar' tablosunda 'is_banned' sütunu henüz bulunmuyor.\n\nLütfen Supabase SQL Editöründe şu komutu çalıştırın:\nALTER TABLE public.katilimcilar ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;");
          return;
        }
        throw error;
      }

      setMembers(prev => prev.map(m => m.id === selectedMember.id ? { ...m, ...editFormData } : m));
      setSelectedMember((prev: any) => ({ ...prev, ...editFormData }));
      setIsEditing(false);
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleToggleBan = async (member: any) => {
    const newBannedState = !member.is_banned;
    const confirmPrompt = newBannedState
      ? `"${member.ad_soyad}" adlı kullanıcıyı yasaklamak (banlamak) istiyor musunuz?\n\nKullanıcıya yasaklandığı söylenmeyecek, sistemde 'onay bekliyor' gibi görünmeye devam edecektir.`
      : `"${member.ad_soyad}" adlı kullanıcının yasağını kaldırmak istiyor musunuz?`;

    if (!confirm(confirmPrompt)) return;

    try {
      let updateError: any = null;
      const { error: banColErr } = await supabase
        .from('katilimcilar')
        .update({ is_banned: newBannedState })
        .eq('id', member.id);

      if (banColErr && (banColErr.message?.includes('is_banned') || banColErr.code === 'PGRST204')) {
        // Akıllı Fallback: is_banned sütunu yoksa referans alanında [YASAKLI] bayrağını yönet!
        const currentRef = String(member.referans || '');
        let newRef = currentRef;
        if (newBannedState) {
          if (!newRef.includes('[YASAKLI]')) {
            newRef = `[YASAKLI] ${newRef}`.trim();
          }
        } else {
          newRef = newRef.replace('[YASAKLI]', '').trim();
        }

        if (member.telefon) {
          const { error: refErr } = await supabase
            .from('katilimcilar')
            .update({ referans: newRef })
            .eq('telefon', member.telefon);
          if (refErr) updateError = refErr;
        } else {
          const { error: refErr } = await supabase
            .from('katilimcilar')
            .update({ referans: newRef })
            .eq('id', member.id);
          if (refErr) updateError = refErr;
        }
      } else if (banColErr) {
        updateError = banColErr;
      }

      if (updateError) throw updateError;

      setMembers(prev => prev.map(m => (m.id === member.id || (member.telefon && m.telefon === member.telefon)) ? { ...m, is_banned: newBannedState } : m));
      if (selectedMember?.id === member.id) {
        setSelectedMember((prev: any) => ({ ...prev, is_banned: newBannedState }));
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
    }
  };

  const handleDeleteMember = async (member: any) => {
    const stats = memberStats.get(Number(member.id));
    const confirmMsg = stats && stats.count > 0
      ? `"${member.ad_soyad}" adlı katılımcının ${stats.count} adet etkinlik kaydı bulunuyor. Bu katılımcıyı ve ilişkili biletlerini silmek için ONAY yazın:`
      : `"${member.ad_soyad}" katılımcısını silmek için ONAY yazın:`;

    const input = prompt(confirmMsg);
    if (input !== "ONAY") return;

    try {
      await supabase.from('biletler').delete().eq('katilimci_id', member.id);
      const { error } = await supabase.from('katilimcilar').delete().eq('id', member.id);
      if (error) {
        if (error.message?.includes('is_banned') || error.code === 'PGRST204') {
          alert("Veritabanı Uyarısı:\n\n'katilimcilar' tablosunda 'is_banned' sütunu henüz bulunmuyor.\n\nLütfen Supabase SQL Editöründe şu komutu çalıştırın:\nALTER TABLE public.katilimcilar ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;");
          return;
        }
        throw error;
      }

      setMembers(prev => prev.filter(m => m.id !== member.id));
      if (selectedMember?.id === member.id) setSelectedMember(null);
    } catch (err: any) {
      alert("Silme hatası: " + err.message);
    }
  };

  const exportAllMembersToExcel = () => {
    if (members.length === 0) return alert("Dışa aktarılacak katılımcı bulunamadı.");
    const rows = members.map((m, idx) => {
      const stats = memberStats.get(Number(m.id)) || { count: 0, arrived: 0 };
      return {
        "Katılımcı ID": m.id,
        "Ad Soyad": m.ad_soyad,
        "Telefon": m.telefon,
        "E-Posta": m.email || "",
        "Okul / Bölüm": m.okul || "",
        "Referans": m.referans || "",
        "Kayıt Olduğu Etkinlik Sayısı": stats.count,
        "Geldiği (Check-in) Etkinlik Sayısı": stats.arrived,
        "Katılım Oranı": stats.count > 0 ? `%${Math.round((stats.arrived / stats.count) * 100)}` : "%0"
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Katilimcilar_Rehberi");
    XLSX.writeFile(wb, `Flick_Tum_Katilimcilar_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Üst Başlık & Eylemler */}
      <div className="bg-slate-900/50 p-6 sm:p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-xl flex flex-wrap items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="bg-blue-600/20 text-blue-400 p-3 rounded-2xl border border-blue-500/30">
              <Users size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-tight text-white">Katılımcı Rehberi</h1>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                Topluluğun tekil üye veri tabanı ({members.length} kayıtlı katılımcı)
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={exportAllMembersToExcel}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase px-5 py-3.5 rounded-2xl shadow-lg shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer"
        >
          <Download size={16} /> Tüm Katılımcıları Excel Olarak İndir
        </button>
      </div>

      {/* Arama & Filtreleme Çubuğu */}
      <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[260px]">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input
            type="text"
            placeholder="İsim, telefon, e-posta veya okul ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950/70 border border-white/10 p-3.5 pl-12 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Sırala:</span>
          <button
            onClick={() => {
              if (sortBy === 'telefon') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else { setSortBy('telefon'); setSortOrder('asc'); }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              sortBy === 'telefon' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Telefon <ArrowUpDown size={12} />
          </button>
          <button
            onClick={() => {
              if (sortBy === 'ad_soyad') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else { setSortBy('ad_soyad'); setSortOrder('asc'); }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              sortBy === 'ad_soyad' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            İsim <ArrowUpDown size={12} />
          </button>
          <button
            onClick={() => {
              if (sortBy === 'event_count') setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
              else { setSortBy('event_count'); setSortOrder('desc'); }
            }}
            className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              sortBy === 'event_count' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            Etkinlik Sayısı <ArrowUpDown size={12} />
          </button>
        </div>
      </div>

      {/* Katılımcı Tablosu */}
      <div className="bg-slate-900/40 rounded-[2rem] border border-white/10 overflow-hidden shadow-2xl">
        {loading ? (
          <div className="flex items-center justify-center p-24">
            <Loader2 className="animate-spin text-blue-500" size={36} />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="p-16 text-center text-slate-500">
            <Users className="mx-auto mb-3 opacity-30" size={48} />
            <p className="text-sm font-bold uppercase tracking-wider">Aramanıza uygun katılımcı bulunamadı.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/5 bg-slate-950/60 text-[10px] font-black uppercase tracking-wider text-slate-400">
                  <th className="py-4 px-6">ID</th>
                  <th className="py-4 px-6">Katılımcı</th>
                  <th className="py-4 px-6">İletişim</th>
                  <th className="py-4 px-6">Okul / Bölüm</th>
                  <th className="py-4 px-6 text-center">Etkinlikler</th>
                  <th className="py-4 px-6 text-center">Katılım Oranı</th>
                  <th className="py-4 px-6 text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-xs">
                {filteredMembers.map((m) => {
                  const stats = memberStats.get(Number(m.id)) || { count: 0, arrived: 0 };
                  const rate = stats.count > 0 ? Math.round((stats.arrived / stats.count) * 100) : 0;

                  return (
                    <tr
                      key={m.id}
                      onClick={() => handleOpenDetail(m)}
                      className="hover:bg-white/5 transition-colors cursor-pointer group"
                    >
                      <td className="py-4 px-6 font-mono font-bold text-slate-500">
                        #{m.id}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-white group-hover:text-blue-400 transition-colors">
                            {m.ad_soyad}
                          </span>
                          {m.is_banned && (
                            <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black px-1.5 py-0.5 rounded tracking-wider uppercase">
                              YASAKLI
                            </span>
                          )}
                        </div>
                        {m.referans && (
                          <div className="text-[10px] text-slate-500 font-medium">Ref: {m.referans}</div>
                        )}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2 font-mono text-slate-300">
                          <span>0{m.telefon}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(m.telefon);
                            }}
                            className="text-slate-500 hover:text-white"
                            title="Kopyala"
                          >
                            <Copy size={12} />
                          </button>
                          {copiedPhone === m.telefon && (
                            <span className="text-[9px] text-emerald-400 font-bold">Kopyalandı!</span>
                          )}
                        </div>
                        {m.email && (
                          <div className="text-[10px] text-slate-500 truncate max-w-[180px]">{m.email}</div>
                        )}
                      </td>
                      <td className="py-4 px-6 text-slate-400 max-w-[180px] truncate">
                        {m.okul || '—'}
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Ticket size={11} /> {stats.count} Kayıt
                        </span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {stats.count > 0 ? (
                          <div className="inline-flex items-center gap-1.5 font-bold">
                            <span className={`text-[11px] ${rate >= 75 ? 'text-emerald-400' : rate >= 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                              {stats.arrived}/{stats.count} (%{rate})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDetail(m);
                          }}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-300 hover:bg-blue-600 hover:text-white text-[10px] font-black uppercase transition-all"
                        >
                          Detay
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* KATILIMCI DETAY & GEÇMİŞ MODALI */}
      {selectedMember && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 bg-black/90 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-950 border border-white/10 rounded-[2.5rem] flex flex-col max-h-[92vh] overflow-hidden shadow-2xl">
            {/* Modal Başlığı */}
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 font-mono font-black text-lg">
                  #{selectedMember.id}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black uppercase text-white tracking-tight">
                      {selectedMember.ad_soyad}
                    </h3>
                    {selectedMember.is_banned && (
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black px-2 py-0.5 rounded tracking-wider uppercase">
                        YASAKLI (BANLI)
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-slate-400">0{selectedMember.telefon}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleBan(selectedMember)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all ${
                    selectedMember.is_banned
                      ? 'bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600 hover:text-white border border-emerald-500/30'
                      : 'bg-rose-600/20 text-rose-400 hover:bg-rose-600 hover:text-white border border-rose-500/30'
                  }`}
                  title={selectedMember.is_banned ? "Yasağı Kaldır" : "Kullanıcıyı Yasakla"}
                >
                  <Ban size={14} />
                  <span className="hidden sm:inline">{selectedMember.is_banned ? "Yasağı Kaldır" : "Yasakla"}</span>
                </button>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="p-2.5 rounded-xl bg-slate-800 text-slate-300 hover:text-white transition-colors"
                    title="Düzenle"
                  >
                    <Edit3 size={16} />
                  </button>
                )}
                <button
                  onClick={() => handleDeleteMember(selectedMember)}
                  className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors"
                  title="Katılımcıyı Sil"
                >
                  <Trash2 size={16} />
                </button>
                <button
                  onClick={() => setSelectedMember(null)}
                  className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal İçeriği */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {/* Profil Düzenleme / Bilgiler */}
              {isEditing ? (
                <div className="bg-slate-900/50 p-5 rounded-2xl border border-white/5 space-y-3">
                  <h4 className="text-xs font-black uppercase tracking-wider text-blue-400 mb-2">Bilgileri Güncelle</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Ad Soyad</label>
                      <input
                        value={editFormData.ad_soyad}
                        onChange={(e) => setEditFormData({ ...editFormData, ad_soyad: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Telefon</label>
                      <input
                        value={editFormData.telefon}
                        onChange={(e) => setEditFormData({ ...editFormData, telefon: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs text-white font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">E-Posta</label>
                      <input
                        value={editFormData.email}
                        onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-400 block mb-1">Okul / Bölüm</label>
                      <input
                        value={editFormData.okul}
                        onChange={(e) => setEditFormData({ ...editFormData, okul: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs text-white"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 text-slate-300"
                    >
                      İptal
                    </button>
                    <button
                      onClick={handleSaveEdit}
                      disabled={savingEdit}
                      className="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white flex items-center gap-1.5"
                    >
                      {savingEdit ? <Loader2 size={14} className="animate-spin" /> : "Kaydet"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/50 p-4 rounded-2xl border border-white/5">
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Telefon</span>
                    <span className="text-xs font-mono font-bold text-white">0{selectedMember.telefon}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">E-Posta</span>
                    <span className="text-xs font-bold text-white truncate block">{selectedMember.email || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Okul / Bölüm</span>
                    <span className="text-xs font-bold text-white truncate block">{selectedMember.okul || '—'}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-black uppercase text-slate-500 block">Referans</span>
                    <span className="text-xs font-bold text-white truncate block">{selectedMember.referans || '—'}</span>
                  </div>
                </div>
              )}

              {/* Katıldığı Etkinlikler Listesi */}
              <div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-2">
                  <Ticket size={16} className="text-blue-500" /> Etkinlik Biletleri & Katılım Geçmişi
                </h4>

                {(() => {
                  const memberTicketList = memberStats.get(Number(selectedMember.id))?.tickets || [];
                  if (memberTicketList.length === 0) {
                    return (
                      <div className="bg-slate-900/30 p-8 rounded-2xl border border-dashed border-white/10 text-center text-slate-500 text-xs">
                        Bu katılımcıya ait henüz bir bilet kaydı bulunmuyor.
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2.5">
                      {memberTicketList.map((t: any) => (
                        <div
                          key={t.id}
                          className="bg-slate-900/60 border border-white/5 p-4 rounded-2xl flex flex-wrap items-center justify-between gap-3"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-white text-sm">
                                {t.event?.event_name || `Etkinlik #${t.etkinlik_id}`}
                              </span>
                              {t.koltuk_no ? (
                                <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md">
                                  Koltuk: {t.koltuk_no}
                                </span>
                              ) : (
                                <span className="bg-slate-800 text-slate-400 text-[9px] font-bold px-2 py-0.5 rounded-md">
                                  Genel Giriş
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-500 flex items-center gap-3">
                              {t.event?.event_date && (
                                <span>{formatEventDateDisplay(t.event.event_date)}</span>
                              )}
                              <span>Bilet ID: #{t.id}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {t.onayli_mi ? (
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                <CheckCircle2 size={11} /> Onaylı
                              </span>
                            ) : (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                Onay Bekliyor
                              </span>
                            )}

                            {t.geldi_mi ? (
                              <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[9px] font-black uppercase px-2.5 py-1 rounded-full flex items-center gap-1">
                                <UserCheck size={11} /> Geldi
                              </span>
                            ) : (
                              <span className="bg-slate-800 text-slate-500 text-[9px] font-black uppercase px-2.5 py-1 rounded-full">
                                Gelmedi
                              </span>
                            )}

                            {t.event?.id && (
                              <Link
                                href={`/admin/events/${t.event.id}`}
                                className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="Etkinliğe Git"
                              >
                                <ExternalLink size={14} />
                              </Link>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
