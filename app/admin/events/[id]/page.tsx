"use client";
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { supabase } from '@/lib/supabase';
import { useAdmin } from '../../layout';
import { 
  ArrowLeft, Users, Clock, UserPlus, Camera, Settings2, CheckCircle2, 
  XCircle, AlertCircle, Search, RefreshCcw, TicketCheck, AlertTriangle, 
  Save, Trash2, Edit3, Armchair, FileText, ExternalLink, X, Check, 
  GraduationCap, UserCheck2, Copy, FileUp, Loader2, Film, Theater, 
  Trophy, Calendar, MapPin, Link2, Sparkles, Power, User, CreditCard, 
  Banknote, LayoutGrid, Download, Archive, ArchiveRestore, UserCheck,
  ShieldAlert, Ban, FileQuestion, HelpCircle, ListPlus, AlignLeft, Plus
} from 'lucide-react';
import { buildEventDateTime, splitEventDateTime, formatEventDateDisplay, isEventPast, packEventLocation, unpackEventLocation } from '@/lib/dateUtils';

type TabType = 'list' | 'pending' | 'banned' | 'add' | 'scanner' | 'settings';

const SEAT_ROWS = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
const SEAT_COLS = Array.from({ length: 25 }, (_, i) => i + 1);

export default function EventManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-24">
          <Loader2 className="animate-spin text-blue-500" size={48} />
        </div>
      }
    >
      <EventManagementContent />
    </Suspense>
  );
}

function EventManagementContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { fetchEvents, session, isAuthenticated } = useAdmin();

  const eventId = Number(params?.id);
  const initialTab = (searchParams?.get('tab') as TabType) || 'list';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [event, setEvent] = useState<any>(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(true);

  // --- SEKME 1: LİSTE FİLTRE VE MODALLARI ---
  const [searchTerm, setSearchTerm] = useState("");
  const [filterNotArrived, setFilterNotArrived] = useState(false);
  const [filterArrived, setFilterArrived] = useState(false);
  const [filterTicketed, setFilterTicketed] = useState(false);
  const [filterNotTicketed, setFilterNotTicketed] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingPerson, setEditingPerson] = useState<any>(null);
  const [viewingReceiptUrl, setViewingReceiptUrl] = useState<string | null>(null);

  // --- SEKME 2: ONAY BEKLEYENLER STATE'LERİ ---
  const [approvingId, setApprovingId] = useState<string | number | null>(null);
  const [bulkApproving, setBulkApproving] = useState(false);
  const [rejectingPerson, setRejectingPerson] = useState<any | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  // --- SEKME 3: KATILIMCI EKLE STATE'LERİ ---
  const [newPerson, setNewPerson] = useState({ ad_soyad: "", telefon: "", email: "", okul: "" });
  const [addLoading, setAddLoading] = useState(false);
  const [uiWarnings, setUiWarnings] = useState<{
    isOpen: boolean;
    messages: string[];
    onConfirm: () => void;
    onCancel: () => void;
  }>({ isOpen: false, messages: [], onConfirm: () => {}, onCancel: () => {} });

  // --- SEKME 4: QR OKUYUCU STATE'LERİ ---
  const [scanStatus, setScanStatus] = useState<{
    status: 'idle' | 'processing' | 'success' | 'error' | 'warning';
    message: string;
  }>({ status: 'idle', message: '' });
  const [isInitializingScanner, setIsInitializingScanner] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const scanStatusRef = useRef(scanStatus.status);

  // --- SEKME 5: AYARLAR & KOLTUK DÜZENLEYİCİ STATE'LERİ ---
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [isSeatEditorOpen, setIsSeatEditorOpen] = useState(false);
  const [activeSeats, setActiveSeats] = useState<string[]>([]);
  const [savingSeats, setSavingSeats] = useState(false);
  const [isDraggingSeat, setIsDraggingSeat] = useState(false);
  const [rawDate, setRawDate] = useState("");
  const [rawTime, setRawTime] = useState("21:00");

  // --- ÖZEL BAŞVURU SORULARI (GOOGLE FORMS TARZI) STATE'LERİ ---
  const [customQuestions, setCustomQuestions] = useState<any[]>([]);
  const [viewingAnswersPerson, setViewingAnswersPerson] = useState<any | null>(null);

  const handleAddQuestion = () => {
    const newQ = {
      id: 'q_' + Date.now(),
      label: '',
      type: 'textarea', // 'textarea' | 'text' | 'radio' | 'select'
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

  useEffect(() => {
    scanStatusRef.current = scanStatus.status;
  }, [scanStatus.status]);

  const formatPhoneNumber = (phone: any) => {
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.startsWith('90')) cleaned = cleaned.substring(2);
    if (cleaned.startsWith('0')) cleaned = cleaned.substring(1);
    return cleaned.slice(-10);
  };

  const fetchEventDetails = useCallback(async () => {
    if (!eventId) return;
    setLoadingEvent(true);
    const { data, error } = await supabase
      .from('etkinlik_ayarlari')
      .select('*')
      .eq('id', eventId)
      .maybeSingle();

    if (!error && data) {
      const { dateInput, timeInput } = splitEventDateTime(data.event_date);
      setRawDate(dateInput);
      setRawTime(timeInput);

      const { locationName, locationUrl } = unpackEventLocation(data);
      data.event_location = locationName;
      data.location_url = locationUrl;

      // Tarihi geçmişse otomatik arşive al (doğrudan datetime üzerinden)
      if (data.is_active && isEventPast(data.event_date)) {
        await supabase
          .from('etkinlik_ayarlari')
          .update({ is_active: false, is_registration_open: false })
          .eq('id', data.id);
        data.is_active = false;
        data.is_registration_open = false;
      }

      setEvent(data);
      setActiveSeats(data.seat_layout || []);
      setCustomQuestions(Array.isArray(data.custom_questions) ? data.custom_questions : []);
    }
    setLoadingEvent(false);
  }, [eventId]);

  const fetchEventParticipants = useCallback(async (currentEventObj?: any) => {
    const targetEv = currentEventObj || event;
    if (!eventId) return;
    setLoadingParticipants(true);

    // Hem event.id hem de eski slot_id kayıtlarıyla geriye dönük uyumlu sorgu
    const idsToMatch = [eventId];
    if (targetEv?.slot_id && Number(targetEv.slot_id) !== eventId) {
      idsToMatch.push(Number(targetEv.slot_id));
    }

    // 1. Yeni 'biletler' tablosundan sorgula ve 'katilimcilar' ile birleştir
    const { data: tickets, error: ticketError } = await supabase
      .from('biletler')
      .select('*')
      .in('etkinlik_id', idsToMatch);

    if (!ticketError && tickets) {
      const katilimciIds = [...new Set(tickets.map((t: any) => t.katilimci_id).filter(Boolean))];
      let memberMap = new Map();
      if (katilimciIds.length > 0) {
        const { data: members } = await supabase
          .from('katilimcilar')
          .select('*')
          .in('id', katilimciIds);
        if (members) {
          memberMap = new Map(members.map((m: any) => [m.id, m]));
        }
      }

      const merged = tickets.map((t: any) => {
        const m = memberMap.get(t.katilimci_id) || {};
        return {
          ...t,
          id: t.id,
          bilet_id: t.id,
          katilimci_id: m.id || t.katilimci_id,
          ad_soyad: m.ad_soyad || 'Bilinmiyor',
          telefon: m.telefon || '',
          email: m.email || '',
          okul: m.okul || '',
          referans: m.referans || '',
          is_banned: m.is_banned === true || (typeof m.referans === 'string' && m.referans.includes('[YASAKLI]')),
          form_answers: t.form_answers || {},
        };
      });

      merged.sort((a: any, b: any) => (a.ad_soyad || '').localeCompare(b.ad_soyad || '', 'tr'));
      setParticipants(merged);
      setLoadingParticipants(false);
      return;
    }

    // 2. Geriye dönük uyumluluk: migration öncesi katilimcilar tablosu
    const { data, error } = await supabase
      .from('katilimcilar')
      .select('*')
      .in('etkinlik_id', idsToMatch)
      .order('ad_soyad', { ascending: true });

    if (!error && data) {
      const processed = data.map((p: any) => ({
        ...p,
        is_banned: p.is_banned === true || (typeof p.referans === 'string' && p.referans.includes('[YASAKLI]')),
      }));
      setParticipants(processed);
    }
    setLoadingParticipants(false);
  }, [eventId, event]);

  useEffect(() => {
    fetchEventDetails();
  }, [fetchEventDetails]);

  useEffect(() => {
    if (event) {
      fetchEventParticipants(event);
    }
  }, [event?.id]);

  // --- QR SCANNER YÖNETİMİ ---
  const safeStopScanner = async () => {
    if (scannerRef.current && scannerRef.current.isScanning) {
      try {
        await scannerRef.current.stop();
        scannerRef.current = null;
      } catch (err) {
        console.error("Scanner durdurulamadı:", err);
      }
    }
  };

  useEffect(() => {
    if (!isAuthenticated || activeTab !== 'scanner' || !event) {
      safeStopScanner();
      return;
    }

    let isMounted = true;

    const startCamera = async () => {
      try {
        setIsInitializingScanner(true);
        await safeStopScanner();

        const readerEl = document.getElementById("reader");
        if (!readerEl || !isMounted) return;

        const html5QrCode = new Html5Qrcode("reader", {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false,
        });
        scannerRef.current = html5QrCode;

        const scanConfig: any = {
          fps: 24,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1.0,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        };

        let cameraConfig: any = { facingMode: "environment" };

        try {
          const devices = await Html5Qrcode.getCameras();
          if (devices && devices.length > 0) {
            const mainCamera = devices.find((d) => {
              const lbl = d.label.toLowerCase();
              return (
                (lbl.includes('back') || lbl.includes('arka') || lbl.includes('rear')) &&
                !lbl.includes('ultra') &&
                !lbl.includes('0.5') &&
                !lbl.includes('wide-angle')
              );
            });

            if (mainCamera) {
              cameraConfig = mainCamera.id;
            } else if (devices.length > 1) {
              cameraConfig = devices[devices.length - 2].id;
            } else {
              cameraConfig = devices[0].id;
            }
          }
        } catch (e) {
          console.warn("Kamera listesi alınamadı, facingMode kullanılacak:", e);
        }

        const idsToMatch = [eventId];
        if (event.slot_id && Number(event.slot_id) !== eventId) {
          idsToMatch.push(Number(event.slot_id));
        }

        await html5QrCode.start(
          cameraConfig,
          scanConfig,
          async (decodedText) => {
            if (scanStatusRef.current !== 'idle') return;
            setScanStatus({ status: 'processing', message: 'Kontrol Ediliyor...' });

            const cleanCode = decodedText.trim();
            if (window.navigator.vibrate) window.navigator.vibrate(100);

            // Önce biletler tablosundan bilet ve katılımcı sorgulayalım
            let ticket: any = null;
            let ticketUserName = 'Katılımcı';

            const { data: biletData } = await supabase
              .from('biletler')
              .select('*')
              .eq('qr_kodu', cleanCode)
              .in('etkinlik_id', idsToMatch)
              .maybeSingle();

            if (biletData) {
              ticket = biletData;
              const { data: katData } = await supabase
                .from('katilimcilar')
                .select('ad_soyad')
                .eq('id', biletData.katilimci_id)
                .maybeSingle();
              if (katData?.ad_soyad) ticketUserName = katData.ad_soyad;
            } else {
              // Geriye dönük uyumluluk: eski katilimcilar tablosu
              const { data: oldData } = await supabase
                .from('katilimcilar')
                .select('*')
                .eq('qr_kodu', cleanCode)
                .in('etkinlik_id', idsToMatch)
                .maybeSingle();
              if (oldData) {
                ticket = oldData;
                ticketUserName = oldData.ad_soyad;
              }
            }

            if (!ticket) {
              setScanStatus({ status: 'error', message: 'Bu Etkinlik İçin Geçersiz QR Kod!' });
            } else if (ticket.onayli_mi === false) {
              setScanStatus({ status: 'error', message: `${ticketUserName} Kaydı Henüz Onaylanmamış!` });
            } else if (ticket.geldi_mi) {
              setScanStatus({ status: 'warning', message: `${ticketUserName} Zaten İçeride!` });
            } else {
              await supabase.from('biletler').update({ geldi_mi: true }).eq('id', ticket.bilet_id || ticket.id);

              setParticipants((prev) =>
                prev.map((p) => (p.bilet_id === ticket.id || p.id === ticket.id ? { ...p, geldi_mi: true } : p))
              );
              const seatInfo = ticket.koltuk_no ? ` (${ticket.koltuk_no})` : '';
              setScanStatus({ status: 'success', message: `${ticketUserName}${seatInfo} Giriş Yaptı!` });
            }

            setTimeout(() => {
              if (isMounted) setScanStatus({ status: 'idle', message: '' });
            }, 2000);
          },
          () => {}
        );
        if (isMounted) setIsInitializingScanner(false);
      } catch (err) {
        console.error("Kamera başlatılamadı:", err);
        if (isMounted) setIsInitializingScanner(false);
      }
    };

    startCamera();
    return () => {
      isMounted = false;
      safeStopScanner();
    };
  }, [activeTab, isAuthenticated, event?.id]);

  // --- KATILIMCI İŞLEMLERİ ---
  const bannedParticipants = participants.filter((p) => p.is_banned === true);
  const approvedParticipants = participants.filter((p) => p.onayli_mi === true && p.is_banned !== true);
  const pendingParticipants = participants.filter((p) => (p.onayli_mi === false || p.onayli_mi === null) && p.is_banned !== true);
  const ticketedCount = approvedParticipants.filter((p) => p.bilet_alindi_mi === true).length;
  const arrivedCount = approvedParticipants.filter((p) => p.geldi_mi === true).length;

  const handleToggleBan = async (person: any) => {
    const targetMemberId = person.katilimci_id || person.id;
    const newBannedState = !person.is_banned;
    const confirmPrompt = newBannedState
      ? `"${person.ad_soyad}" adlı katılımcıyı yasaklamak (banlamak) istiyor musunuz?\n\nKullanıcıya yasaklandığı söylenmeyecek, arayüzde onay bekliyor gibi görünmeye devam edecektir.`
      : `"${person.ad_soyad}" adlı katılımcının yasağını kaldırmak istiyor musunuz?`;

    if (!confirm(confirmPrompt)) return;

    try {
      let updateError: any = null;
      const { error: banColErr } = await supabase
        .from('katilimcilar')
        .update({ is_banned: newBannedState })
        .eq('id', targetMemberId);

      if (banColErr && (banColErr.message?.includes('is_banned') || banColErr.code === 'PGRST204')) {
        // Akıllı Fallback: is_banned sütunu henüz yoksa referans alanında [YASAKLI] bayrağı ile anında yasakla!
        const currentRef = String(person.referans || '');
        let newRef = currentRef;
        if (newBannedState) {
          if (!newRef.includes('[YASAKLI]')) {
            newRef = `[YASAKLI] ${newRef}`.trim();
          }
        } else {
          newRef = newRef.replace('[YASAKLI]', '').trim();
        }

        if (person.telefon) {
          const { error: refErr } = await supabase
            .from('katilimcilar')
            .update({ referans: newRef })
            .eq('telefon', person.telefon);
          if (refErr) updateError = refErr;
        } else {
          const { error: refErr } = await supabase
            .from('katilimcilar')
            .update({ referans: newRef })
            .eq('id', targetMemberId);
          if (refErr) updateError = refErr;
        }
      } else if (banColErr) {
        updateError = banColErr;
      }

      if (updateError) throw updateError;

      // Yasaklanıyorsa bu etkinlikteki bilet onayını kaldır
      if (newBannedState && (person.bilet_id || person.id)) {
        const ticketId = person.bilet_id || person.id;
        await supabase.from('biletler').update({ onayli_mi: false }).eq('id', ticketId);
      }

      setParticipants((prev) =>
        prev.map((p) => {
          if (p.katilimci_id === targetMemberId || p.id === person.id) {
            return {
              ...p,
              is_banned: newBannedState,
              onayli_mi: newBannedState ? false : p.onayli_mi,
            };
          }
          return p;
        })
      );
    } catch (err: any) {
      alert("Yasaklama işlemi hatası: " + err.message);
    }
  };

  const filteredApprovedList = approvedParticipants.filter((p) => {
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      (p.ad_soyad || '').toLowerCase().includes(q) ||
      (p.telefon && p.telefon.includes(searchTerm)) ||
      (p.email && p.email.toLowerCase().includes(q)) ||
      (p.okul && p.okul.toLowerCase().includes(q));
    const matchesNotArrived = filterNotArrived ? p.geldi_mi === false : true;
    const matchesArrived = filterArrived ? p.geldi_mi === true : true;
    const matchesTicketed = filterTicketed ? p.bilet_alindi_mi === true : true;
    const matchesNotTicketed = filterNotTicketed ? p.bilet_alindi_mi === false : true;
    return matchesSearch && matchesNotArrived && matchesArrived && matchesTicketed && matchesNotTicketed;
  });

  const handleUpdateParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formatPhoneNumber(editingPerson.telefon);
    const memberId = editingPerson.katilimci_id || editingPerson.id;
    const ticketId = editingPerson.bilet_id || editingPerson.id;

    // 1. Katılımcı profil bilgilerini güncelle
    await supabase
      .from('katilimcilar')
      .update({
        ad_soyad: editingPerson.ad_soyad.trim(),
        telefon: cleanPhone,
        email: editingPerson.email?.trim() || null,
        okul: editingPerson.okul?.trim() || null,
      })
      .eq('id', memberId);

    // 2. Bilet tablosunda koltuk bilgisini güncelle
    await supabase
      .from('biletler')
      .update({
        koltuk_no: editingPerson.koltuk_no || null,
      })
      .eq('id', ticketId);

    setIsEditModalOpen(false);
    fetchEventParticipants();
  };

  const deleteUser = async (id: number) => {
    if (confirm("Bu bilet kaydı silinsin mi? (Katılımcı üye kaydı korunur)")) {
      await supabase.from('biletler').delete().eq('id', id);
      setParticipants((prev) => prev.filter((p) => p.bilet_id !== id && p.id !== id));
    }
  };

  const resetSeatAndTicket = async (id: number) => {
    if (confirm("Katılımcının koltuk seçimi, bilet ve giriş durumu sıfırlansın mı?")) {
      await supabase
        .from('biletler')
        .update({
          koltuk_no: null,
          bilet_alindi_mi: false,
          geldi_mi: false,
          qr_kodu: crypto.randomUUID(),
        })
        .eq('id', id);

      fetchEventParticipants();
    }
  };

  const deleteAllApprovedParticipants = async () => {
    if (approvedParticipants.length === 0) {
      alert("Silinecek onaylı katılımcı bulunamadı.");
      return;
    }
    const confirmText = prompt(
      `"${event?.event_name}" etkinliğinin ${approvedParticipants.length} kişilik onaylı bilet listesini tamamen silmek için ONAYLIYORUM yazın:`
    );
    if (confirmText === "ONAYLIYORUM") {
      setLoadingParticipants(true);
      try {
        const idsToDelete = approvedParticipants.map((p) => p.bilet_id || p.id);
        await supabase.from('biletler').delete().in('id', idsToDelete);
        await supabase.from('katilimcilar').delete().in('id', idsToDelete); // fallback
        await fetchEventParticipants();
      } catch (err: any) {
        alert("Hata: " + err.message);
      } finally {
        setLoadingParticipants(false);
      }
    }
  };

  const exportToExcel = () => {
    if (approvedParticipants.length === 0) return alert("Dışa aktarılacak katılımcı yok.");
    const rows = approvedParticipants.map((p, index) => {
      const rowObj: any = {
        "#": index + 1,
        "Ad Soyad": p.ad_soyad,
        "Telefon": p.telefon,
        "E-Posta": p.email || "",
        "Okul / Bölüm": p.okul || "",
        "Referans": p.referans || "",
        "Koltuk No": p.koltuk_no || "Genel",
        "Bilet Alındı mı": p.bilet_alindi_mi ? "Evet" : "Hayır",
        "İçeride mi": p.geldi_mi ? "Evet" : "Hayır",
      };

      if (customQuestions && customQuestions.length > 0) {
        customQuestions.forEach((q: any) => {
          rowObj[`Soru: ${q.label || q.id}`] = (p.form_answers && p.form_answers[q.id]) || "—";
        });
      }

      return rowObj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Katilimcilar");
    XLSX.writeFile(wb, `${event?.event_name || 'Etkinlik'}_Katilimcilar.xlsx`);
  };

  // --- ONAY BEKLEYENLER İŞLEMLERİ ---
  const sendApprovalEmail = async (person: any) => {
    if (!person.email || String(person.email).trim() === "") return;
    try {
      const token = session?.access_token;
      await fetch('/api/send-approval', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: String(person.email).trim(),
          ad_soyad: person.ad_soyad,
          event_name: event?.event_name,
        }),
      });
    } catch (e) {
      console.error("E-posta gönderim hatası:", e);
    }
  };

  const approveUser = async (person: any) => {
    if (approvingId) return;
    const targetId = person.bilet_id || person.id;
    setApprovingId(targetId);
    try {
      const generatedQr = person.qr_kodu || crypto.randomUUID();
      await supabase
        .from('biletler')
        .update({
          onayli_mi: true,
          qr_kodu: generatedQr,
        })
        .eq('id', targetId);

      await sendApprovalEmail(person);

      setParticipants((prev) =>
        prev.map((p) => (p.bilet_id === targetId || p.id === targetId ? { ...p, onayli_mi: true } : p))
      );
    } catch (err: any) {
      alert("Onaylama hatası: " + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  const approveAllPending = async () => {
    if (pendingParticipants.length === 0 || bulkApproving) return;
    if (!confirm(`Bekleyen ${pendingParticipants.length} kişinin tamamını onaylamak ve e-posta göndermek istiyor musunuz?`)) return;

    setBulkApproving(true);
    try {
      for (const person of pendingParticipants) {
        const targetId = person.bilet_id || person.id;
        const generatedQr = person.qr_kodu || crypto.randomUUID();
        await supabase
          .from('biletler')
          .update({
            onayli_mi: true,
            qr_kodu: generatedQr,
          })
          .eq('id', targetId);

        await sendApprovalEmail(person);
      }
      await fetchEventParticipants();
    } catch (err: any) {
      alert("Toplu onay hatası: " + err.message);
    } finally {
      setBulkApproving(false);
    }
  };

  const handleOpenRejectModal = (person: any) => {
    setRejectingPerson(person);
    if (person.telefon) {
      navigator.clipboard.writeText(person.telefon);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingPerson) return;
    setIsRejecting(true);
    const targetId = rejectingPerson.bilet_id || rejectingPerson.id;
    await supabase.from('biletler').delete().eq('id', targetId);
    setParticipants((prev) => prev.filter((p) => p.bilet_id !== targetId && p.id !== targetId));
    setRejectingPerson(null);
    setIsRejecting(false);
  };

  // --- KATILIMCI EKLEME (EXCEL & MANUEL) ---
  const validateParticipant = (
    name: string,
    rawPhone: string,
    formattedPhone: string,
    existingList: any[],
    seenPhones: Set<string>
  ) => {
    const warnings = [];
    const cleanName = name.trim();
    if (!cleanName.includes(" ")) warnings.push(`"${cleanName}": Soyadı eksik olabilir.`);
    if (cleanName.length > 30) warnings.push(`"${cleanName}": İsim çok uzun.`);
    if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]/.test(String(rawPhone))) {
      warnings.push(`"${cleanName}": Telefon numarasında harf bulunuyor (${rawPhone}).`);
    }
    const isDuplicate = existingList.some((p) => p.telefon === formattedPhone);
    const isDuplicateInBatch = seenPhones.has(formattedPhone);
    if (isDuplicate || isDuplicateInBatch) {
      warnings.push(`Uyarı: "${cleanName}" ile aynı telefon (${formattedPhone}) listede zaten mevcut.`);
    }
    return warnings;
  };

  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddLoading(true);
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data: any[] = XLSX.utils.sheet_to_json(ws);

        const allWarnings: string[] = [];
        const seenPhones = new Set<string>();
        const formattedData = data
          .map((row) => {
            const nameKeys = ["Adınız Soyisimiz", "Adınız Soyisim", "Ad Soyad", "ad_soyad", "Adınız", "İsim Soyisim"];
            const phoneKeys = ["Telefon numarası", "Telefon", "telefon", "No", "Tel"];
            const nameKey = Object.keys(row).find((k) => nameKeys.includes(k.trim()));
            const phoneKey = Object.keys(row).find((k) => phoneKeys.includes(k.trim()));
            if (nameKey && phoneKey && row[nameKey] && row[phoneKey]) {
              const name = String(row[nameKey]).trim();
              const rawPhone = String(row[phoneKey]);
              const phone = formatPhoneNumber(rawPhone);

              const rowWarnings = validateParticipant(name, rawPhone, phone, participants, seenPhones);
              if (rowWarnings.length > 0) allWarnings.push(...rowWarnings);
              seenPhones.add(phone);

              return {
                ad_soyad: name,
                telefon: phone,
                qr_kodu: crypto.randomUUID(),
                onayli_mi: true,
                geldi_mi: false,
                bilet_alindi_mi: false,
                etkinlik_id: eventId,
              };
            }
            return null;
          })
          .filter((item) => item !== null);

        const proceedWithUpload = async () => {
          setAddLoading(true);
          try {
            if (formattedData.length > 0) {
              for (const item of formattedData) {
                let memberId: number | null = null;
                const { data: existingKat } = await supabase
                  .from('katilimcilar')
                  .select('id')
                  .eq('telefon', item.telefon)
                  .maybeSingle();

                if (existingKat) {
                  memberId = existingKat.id;
                } else {
                  const { data: newKat } = await supabase
                    .from('katilimcilar')
                    .insert([{
                      telefon: item.telefon,
                      ad_soyad: item.ad_soyad,
                      email: null,
                      okul: null,
                    }])
                    .select()
                    .maybeSingle();
                  if (newKat) memberId = newKat.id;
                }

                if (memberId) {
                  await supabase.from('biletler').insert([{
                    etkinlik_id: eventId,
                    katilimci_id: memberId,
                    qr_kodu: item.qr_kodu || crypto.randomUUID(),
                    onayli_mi: true,
                    geldi_mi: false,
                    bilet_alindi_mi: false,
                  }]);
                }
              }

              alert(`${formattedData.length} kayıt başarıyla eklendi.`);
              fetchEventParticipants();
              setActiveTab('list');
            } else {
              alert("Excel'de uygun 'Ad Soyad' ve 'Telefon' sütunları bulunamadı!");
            }
          } catch (err: any) {
            alert("Yükleme hatası: " + err.message);
          } finally {
            setAddLoading(false);
            e.target.value = "";
          }
        };

        if (allWarnings.length > 0) {
          setAddLoading(false);
          setUiWarnings({
            isOpen: true,
            messages: allWarnings,
            onConfirm: () => {
              setUiWarnings((prev) => ({ ...prev, isOpen: false }));
              proceedWithUpload();
            },
            onCancel: () => {
              setUiWarnings((prev) => ({ ...prev, isOpen: false }));
              e.target.value = "";
            },
          });
          return;
        }

        proceedWithUpload();
      } catch {
        alert("Dosya okunurken bir hata oluştu.");
        setAddLoading(false);
        e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleAddSinglePerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPerson.ad_soyad.trim() || !newPerson.telefon.trim()) return alert("Lütfen Ad Soyad ve Telefon girin!");

    const rawPhone = newPerson.telefon;
    const phone = formatPhoneNumber(rawPhone);
    const seenPhones = new Set<string>();
    const warnings = validateParticipant(newPerson.ad_soyad, rawPhone, phone, participants, seenPhones);

    const proceedWithAdd = async () => {
      setAddLoading(true);
      try {
        let memberId: number | null = null;
        const { data: existingKat } = await supabase
          .from('katilimcilar')
          .select('id')
          .eq('telefon', phone)
          .maybeSingle();

        if (existingKat) {
          memberId = existingKat.id;
          await supabase.from('katilimcilar').update({
            ad_soyad: newPerson.ad_soyad.trim(),
            email: newPerson.email.trim() || null,
            okul: newPerson.okul.trim() || null,
          }).eq('id', memberId);
        } else {
          const { data: newKat } = await supabase
            .from('katilimcilar')
            .insert([{
              telefon: phone,
              ad_soyad: newPerson.ad_soyad.trim(),
              email: newPerson.email.trim() || null,
              okul: newPerson.okul.trim() || null,
            }])
            .select()
            .maybeSingle();
          if (newKat) memberId = newKat.id;
        }

        if (memberId) {
          await supabase.from('biletler').insert([{
            etkinlik_id: eventId,
            katilimci_id: memberId,
            qr_kodu: crypto.randomUUID(),
            onayli_mi: true,
            geldi_mi: false,
            bilet_alindi_mi: false,
          }]);
        }

        setNewPerson({ ad_soyad: "", telefon: "", email: "", okul: "" });
        await fetchEventParticipants();
        alert("Katılımcı başarıyla eklendi!");
      } catch (err: any) {
        alert("Hata: " + err.message);
      } finally {
        setAddLoading(false);
      }
    };

    if (warnings.length > 0) {
      setUiWarnings({
        isOpen: true,
        messages: warnings,
        onConfirm: () => {
          setUiWarnings((prev) => ({ ...prev, isOpen: false }));
          proceedWithAdd();
        },
        onCancel: () => {
          setUiWarnings((prev) => ({ ...prev, isOpen: false }));
        },
      });
      return;
    }

    proceedWithAdd();
  };

  // --- ETKİNLİK & KOLTUK AYARLARI KAYDETME ---
  const handleSaveSettings = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!event) return;
    setSavingSettings(true);
    setSettingsMessage(null);

    const isoDateTime = rawDate ? buildEventDateTime(rawDate, rawTime) : event.event_date;
    const expired = isEventPast(isoDateTime);
    const finalIsActive = expired ? false : event.is_active;
    const finalIsRegOpen = expired ? false : event.is_registration_open;

    const updatePayload = {
      event_name: event.event_name,
      event_date: isoDateTime,
      event_location: packEventLocation(event.event_location, event.location_url),
      event_type: event.event_type,
      is_active: finalIsActive,
      has_seating: event.has_seating,
      whatsapp_link: event.whatsapp_link,
      is_paid: event.is_paid,
      event_price: event.is_paid ? event.event_price : null,
      event_iban: event.is_paid ? event.event_iban : null,
      event_ibanname: event.is_paid ? event.event_ibanname : null,
      is_registration_open: finalIsRegOpen,
      is_featured: event.is_featured,
    };

    let { error } = await supabase
      .from('etkinlik_ayarlari')
      .update({
        ...updatePayload,
        custom_questions: customQuestions,
      })
      .eq('id', event.id);

    if (error && (error.message?.includes('custom_questions') || error.code === 'PGRST204')) {
      alert("Bilgi:\n\n'etkinlik_ayarlari' tablosunda 'custom_questions' sütunu henüz eklenmemiş.\nSoruların kaydedilebilmesi için lütfen Supabase SQL Editöründe şu komutu çalıştırın:\n\nALTER TABLE public.etkinlik_ayarlari ADD COLUMN IF NOT EXISTS custom_questions JSONB DEFAULT '[]'::jsonb;");
      const retry = await supabase.from('etkinlik_ayarlari').update(updatePayload).eq('id', event.id);
      error = retry.error;
    }

    if (error) {
      alert("Ayarlar kaydedilirken hata: " + error.message);
    } else {
      setEvent({
        ...event,
        event_date: isoDateTime,
        is_active: finalIsActive,
        is_registration_open: finalIsRegOpen,
      });
      setSettingsMessage(
        expired
          ? "Ayarlar kaydedildi (Tarihi geçmiş olduğu için etkinlik otomatik olarak Arşivde tutuldu)."
          : "Etkinlik ayarları başarıyla kaydedildi!"
      );
      fetchEvents();
      setTimeout(() => setSettingsMessage(null), 3500);
    }
    setSavingSettings(false);
  };

  const quickToggleField = async (field: string, value: any) => {
    if (!event) return;
    if (field === 'is_active' && value === true && isEventPast(event.event_date)) {
      alert(
        `Bu etkinliğin tarihi (${formatEventDateDisplay(event.event_date)}) geçmiş durumda.\n\nTekrar aktif edebilmek için lütfen "Ayarlar & Koltuk" sekmesinden tarihini ileri bir tarihe güncelleyin.`
      );
      setActiveTab('settings');
      return;
    }
    const updated = { ...event, [field]: value };
    setEvent(updated);
    const { error } = await supabase
      .from('etkinlik_ayarlari')
      .update({ [field]: value })
      .eq('id', event.id);
    if (!error) fetchEvents();
  };

  const toggleSeat = (seatId: string) => {
    setActiveSeats((prev) =>
      prev.includes(seatId) ? prev.filter((s) => s !== seatId) : [...prev, seatId]
    );
  };

  const toggleSeatRow = (row: string) => {
    const rowSeats = SEAT_COLS.map((c) => `${row}-${c}`);
    const allRowActive = rowSeats.every((s) => activeSeats.includes(s));
    if (allRowActive) {
      setActiveSeats((prev) => prev.filter((s) => !s.startsWith(`${row}-`)));
    } else {
      setActiveSeats((prev) => Array.from(new Set([...prev, ...rowSeats])));
    }
  };

  const selectAllSeats = () => {
    const all: string[] = [];
    for (const r of SEAT_ROWS) {
      for (const c of SEAT_COLS) {
        all.push(`${r}-${c}`);
      }
    }
    setActiveSeats(all);
  };

  const handleSaveSeats = async () => {
    if (!event) return;
    setSavingSeats(true);
    const { error } = await supabase
      .from('etkinlik_ayarlari')
      .update({ seat_layout: activeSeats })
      .eq('id', event.id);

    if (!error) {
      setEvent({ ...event, seat_layout: activeSeats });
      setIsSeatEditorOpen(false);
      fetchEvents();
    } else {
      alert("Koltuk düzeni kaydedilemedi: " + error.message);
    }
    setSavingSeats(false);
  };

  if (loadingEvent) {
    return (
      <div className="flex justify-center p-24">
        <Loader2 className="animate-spin text-blue-500" size={48} />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="text-center py-20 bg-slate-900/40 rounded-[2.5rem] border border-white/10 space-y-4">
        <AlertCircle className="mx-auto text-rose-500" size={48} />
        <h2 className="text-xl font-black uppercase">Etkinlik Bulunamadı</h2>
        <button
          onClick={() => router.push('/admin')}
          className="inline-flex items-center gap-2 bg-blue-600 px-6 py-3 rounded-2xl text-xs font-black uppercase"
        >
          <ArrowLeft size={16} /> Etkinlik Listesine Dön
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* DEKONT İNCELEME MODALI */}
      {viewingReceiptUrl && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col items-center">
            <div className="w-full flex justify-between items-center mb-4 pb-3 border-b border-white/5">
              <span className="text-xs font-black uppercase text-blue-400 flex items-center gap-2 tracking-wider">
                <FileText size={16} /> Katılımcı Ödeme Dekontu
              </span>
              <button
                onClick={() => setViewingReceiptUrl(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="w-full max-h-[60vh] overflow-auto rounded-2xl border border-white/5 bg-slate-950 p-2 flex justify-center">
              <img
                src={viewingReceiptUrl}
                alt="Dekont Görseli"
                loading="lazy"
                className="max-w-full h-auto object-contain rounded-xl select-none"
              />
            </div>

            <div className="w-full flex gap-3 mt-4">
              <a
                href={viewingReceiptUrl}
                target="_blank"
                rel="noreferrer"
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all"
              >
                <ExternalLink size={16} /> Yeni Sekmede Aç
              </a>
              <button
                onClick={() => setViewingReceiptUrl(null)}
                className="px-6 bg-slate-800 hover:bg-slate-700 text-slate-300 py-3.5 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BAŞVURU FORMU YANITLARI MODALI */}
      {viewingAnswersPerson && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-2xl bg-slate-900 border border-white/10 rounded-[2.5rem] p-6 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="w-full flex justify-between items-center pb-4 border-b border-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                  <FileQuestion size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Başvuru Formu Yanıtları</h3>
                  <p className="text-xs text-slate-400 font-medium">
                    {viewingAnswersPerson.ad_soyad} • <span className="text-slate-500 font-mono">#{viewingAnswersPerson.id}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => setViewingAnswersPerson(null)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="w-full flex-1 overflow-y-auto py-4 space-y-4 custom-scrollbar pr-1">
              {/* Katılımcı Temel Bilgileri */}
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-2xl bg-slate-950 border border-white/5 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Telefon</span>
                  <span className="text-white font-mono">{viewingAnswersPerson.telefon}</span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">E-Posta</span>
                  <span className="text-white">{viewingAnswersPerson.email || 'Belirtilmemiş'}</span>
                </div>
                {viewingAnswersPerson.okul && (
                  <div className="col-span-2">
                    <span className="text-slate-500 text-[10px] uppercase font-bold block">Okul / Bölüm</span>
                    <span className="text-white">{viewingAnswersPerson.okul}</span>
                  </div>
                )}
              </div>

              {/* Sorular ve Cevaplar */}
              {customQuestions && customQuestions.length > 0 ? (
                customQuestions.map((q: any, idx: number) => {
                  const ans = viewingAnswersPerson.form_answers?.[q.id] ?? viewingAnswersPerson.form_answers?.[q.label];
                  return (
                    <div key={q.id || idx} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-bold text-slate-300 leading-snug">
                          <span className="text-purple-400 font-black mr-1.5">{idx + 1}.</span>
                          {q.label || 'İsimsiz Soru'}
                        </span>
                        {q.required && (
                          <span className="text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded-full font-bold uppercase shrink-0">
                            Zorunlu
                          </span>
                        )}
                      </div>
                      <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-sm text-white font-medium whitespace-pre-wrap">
                        {ans !== undefined && ans !== null && String(ans).trim() !== '' ? (
                          String(ans)
                        ) : (
                          <span className="text-slate-500 italic text-xs">Cevaplanmamış</span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : viewingAnswersPerson.form_answers && Object.keys(viewingAnswersPerson.form_answers).length > 0 ? (
                Object.entries(viewingAnswersPerson.form_answers).map(([key, val]: any, idx: number) => (
                  <div key={key || idx} className="p-4 rounded-2xl bg-slate-950/80 border border-white/5 space-y-2">
                    <span className="text-xs font-bold text-slate-300 leading-snug">
                      <span className="text-purple-400 font-black mr-1.5">{idx + 1}.</span>
                      {key}
                    </span>
                    <div className="p-3 rounded-xl bg-slate-900 border border-white/5 text-sm text-white font-medium whitespace-pre-wrap">
                      {val !== undefined && val !== null && String(val).trim() !== '' ? (
                        String(val)
                      ) : (
                        <span className="text-slate-500 italic text-xs">Boş</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-500 text-xs">
                  Bu katılımcı için özel soru yanıtı bulunamadı.
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-white/5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingAnswersPerson(null)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* KOLTUK DÜZENLEYİCİ MODALI */}
      {isSeatEditorOpen && (
        <div className="fixed inset-0 z-[240] flex items-center justify-center p-2 sm:p-6 bg-black/95 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="w-full max-w-6xl bg-slate-950 border border-white/10 rounded-[2.5rem] flex flex-col max-h-[95vh] overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-6 border-b border-white/5 bg-slate-900/50">
              <div>
                <h2 className="text-xl font-black uppercase tracking-tight text-white">
                  Koltuk Düzeni Editörü — <span className="text-blue-400">{event.event_name}</span>
                </h2>
                <p className="text-[10px] text-slate-400 font-bold tracking-widest mt-1">
                  KOLTUKLARA TIKLAYARAK, SÜRÜKLEYEREK VEYA SIRA HARFİNE BASARAK AKTİF/PASİF YAPABİLİRSİNİZ
                </p>
              </div>
              <button
                onClick={() => setIsSeatEditorOpen(false)}
                className="bg-slate-800 p-3 rounded-2xl hover:bg-rose-500/20 hover:text-rose-500 transition-all text-white"
              >
                <X size={22} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-4 sm:p-8 custom-scrollbar bg-[#020617]">
              <div
                className="min-w-max flex flex-col gap-2 mx-auto pb-8"
                onMouseUp={() => setIsDraggingSeat(false)}
                onMouseLeave={() => setIsDraggingSeat(false)}
              >
                <div className="flex gap-2 items-center mb-3">
                  <div className="w-8"></div>
                  {SEAT_COLS.map((col) => (
                    <div key={`head-${col}`} className="w-8 text-center text-[10px] font-black text-slate-500">
                      {col}
                    </div>
                  ))}
                </div>

                {SEAT_ROWS.map((row) => (
                  <div key={row} className="flex gap-2 items-center">
                    <button
                      type="button"
                      onClick={() => toggleSeatRow(row)}
                      title={`${row} sırasının tamamını aç/kapat`}
                      className="w-8 h-8 rounded-lg bg-slate-900 hover:bg-blue-600 text-center text-xs font-black text-slate-400 hover:text-white transition-colors"
                    >
                      {row}
                    </button>
                    {SEAT_COLS.map((col) => {
                      const seatId = `${row}-${col}`;
                      const isActive = activeSeats.includes(seatId);
                      return (
                        <button
                          type="button"
                          key={seatId}
                          onMouseDown={() => {
                            setIsDraggingSeat(true);
                            toggleSeat(seatId);
                          }}
                          onMouseEnter={() => {
                            if (isDraggingSeat) toggleSeat(seatId);
                          }}
                          className={`w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold transition-all select-none ${
                            isActive
                              ? 'bg-emerald-500 text-white shadow-[0_0_10px_rgba(16,185,129,0.4)] scale-105 z-10'
                              : 'bg-slate-800/50 text-slate-600 hover:bg-slate-700 hover:text-white'
                          }`}
                        >
                          {col}
                        </button>
                      );
                    })}
                  </div>
                ))}

                <div className="w-full mt-10 relative flex justify-center">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-dashed border-slate-700"></div>
                  </div>
                  <div className="relative bg-[#020617] px-4 text-[10px] font-black tracking-[0.5em] text-slate-500">
                    PERDE / SAHNE
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-white/5 bg-slate-900/50 flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-slate-400">
                <span>
                  Toplam Aktif Koltuk: <span className="text-emerald-400 text-lg font-black ml-1">{activeSeats.length}</span>
                </span>
                <button
                  type="button"
                  onClick={selectAllSeats}
                  className="text-blue-400 hover:text-blue-300 text-[10px] font-black uppercase tracking-widest"
                >
                  Tümünü Seç (400)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSeats([])}
                  className="text-rose-400 hover:text-rose-300 text-[10px] font-black uppercase tracking-widest"
                >
                  Tümünü Temizle
                </button>
              </div>
              <button
                type="button"
                disabled={savingSeats}
                onClick={handleSaveSeats}
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center gap-2"
              >
                {savingSeats ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                KOLTUK DÜZENİNİ KAYDET
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ÜST ETKİNLİK BAŞLIK VE HIZLI KONTROL KARTI */}
      <div className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-2">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-[11px] font-black uppercase tracking-widest transition-colors"
            >
              <ArrowLeft size={15} /> Tüm Etkinliklere Dön
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {event.event_name}
              </h1>
              <span className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase ${
                event.is_active
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-800 text-slate-400 border border-white/10'
              }`}>
                {event.is_active ? 'AKTİF ETKİNLİK' : 'GEÇMİŞ (ARŞİV)'}
              </span>
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-slate-400 font-bold">
              <span className="flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-400" /> {formatEventDateDisplay(event.event_date)}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin size={14} className="text-blue-400" />
                <span>{unpackEventLocation(event).locationName}</span>
                {unpackEventLocation(event).locationUrl && (
                  <a
                    href={unpackEventLocation(event).locationUrl}
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

          {/* Hızlı Durum Değiştirme Butonları */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => quickToggleField('is_registration_open', !event.is_registration_open)}
              className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                event.is_registration_open
                  ? 'bg-purple-600/20 border-purple-500/40 text-purple-300'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}
            >
              <User size={14} />
              {event.is_registration_open ? 'Kayıtlar Açık' : 'Kayıtlar Kapalı'}
            </button>

            <button
              onClick={() => quickToggleField('is_featured', !event.is_featured)}
              className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                event.is_featured
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-slate-800 border-white/10 text-slate-400'
              }`}
            >
              <Sparkles size={14} />
              {event.is_featured ? 'Özel Etkinlik' : 'Normal'}
            </button>

            <button
              onClick={() => quickToggleField('is_active', !event.is_active)}
              className={`px-4 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all flex items-center gap-1.5 ${
                event.is_active
                  ? 'bg-slate-800 border-white/10 text-slate-300 hover:bg-amber-500/20 hover:text-amber-400'
                  : 'bg-emerald-600/20 border-emerald-500/40 text-emerald-400'
              }`}
            >
              {event.is_active ? (
                <>
                  <Archive size={14} /> Arşive Kaldır
                </>
              ) : (
                <>
                  <ArchiveRestore size={14} /> Tekrar Aktif Et
                </>
              )}
            </button>
          </div>
        </div>

        {/* Özet İstatistik Kartları */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('list')}
            className="bg-slate-950/60 border border-white/5 hover:border-blue-500/30 p-4 rounded-2xl text-left transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Onaylı Katılımcı</span>
            <span className="text-2xl font-black text-white">{approvedParticipants.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pending')}
            className={`border p-4 rounded-2xl text-left transition-all ${
              pendingParticipants.length > 0
                ? 'bg-amber-500/15 border-amber-500/40 hover:bg-amber-500/25'
                : 'bg-slate-950/60 border-white/5'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 block">Onay Bekleyen</span>
            <span className="text-2xl font-black text-amber-400">{pendingParticipants.length}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('banned')}
            className={`border p-4 rounded-2xl text-left transition-all ${
              bannedParticipants.length > 0
                ? 'bg-rose-500/15 border-rose-500/40 hover:bg-rose-500/25'
                : 'bg-slate-950/60 border-white/5'
            }`}
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-400 block">Yasaklanan</span>
            <span className="text-2xl font-black text-rose-400">{bannedParticipants.length}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('list'); setFilterTicketed(true); setFilterNotTicketed(false); }}
            className="bg-slate-950/60 border border-white/5 hover:border-blue-500/30 p-4 rounded-2xl text-left transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-400 block">Bilet Alan</span>
            <span className="text-2xl font-black text-blue-400">{ticketedCount}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('scanner')}
            className="bg-slate-950/60 border border-white/5 hover:border-emerald-500/30 p-4 rounded-2xl text-left transition-all"
          >
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-400 block">İçeride (Gelen)</span>
            <span className="text-2xl font-black text-emerald-400">{arrivedCount}</span>
          </button>
        </div>

        {/* ANA SEKME MENÜSÜ */}
        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 pt-2">
          <button
            onClick={() => setActiveTab('list')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'list'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <Users size={16} />
            <span>Katılımcılar ({approvedParticipants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('pending')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${
              activeTab === 'pending'
                ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <Clock size={16} />
            <span>Bekleyen</span>
            {pendingParticipants.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'pending' ? 'bg-slate-950 text-amber-400' : 'bg-amber-500 text-slate-950'
              }`}>
                {pendingParticipants.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('banned')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all relative ${
              activeTab === 'banned'
                ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/25'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <ShieldAlert size={16} />
            <span>Yasaklı</span>
            {bannedParticipants.length > 0 && (
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'banned' ? 'bg-white text-rose-600' : 'bg-rose-500 text-white'
              }`}>
                {bannedParticipants.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('add')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'add'
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/25'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <UserPlus size={16} />
            <span>Ekle</span>
          </button>

          <button
            onClick={() => setActiveTab('scanner')}
            className={`py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'scanner'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/25'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <Camera size={16} />
            <span>QR</span>
          </button>

          <button
            onClick={() => setActiveTab('settings')}
            className={`col-span-2 sm:col-span-1 py-3.5 px-4 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
              activeTab === 'settings'
                ? 'bg-slate-700 text-white shadow-lg'
                : 'bg-slate-950/70 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <Settings2 size={16} />
            <span>Ayarlar</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          SEKME 1: ONAYLI KATILIMCI LİSTESİ
         ===================================================================== */}
      {activeTab === 'list' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          {isEditModalOpen && editingPerson && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-lg font-black uppercase">Katılımcı Düzenle</h2>
                  <button onClick={() => setIsEditModalOpen(false)} className="p-2">
                    <X size={24} />
                  </button>
                </div>
                <form onSubmit={handleUpdateParticipant} className="space-y-4">
                  <input
                    type="text"
                    placeholder="Ad Soyad"
                    className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl outline-none text-white"
                    value={editingPerson.ad_soyad || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, ad_soyad: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Telefon"
                    className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl outline-none text-white"
                    value={editingPerson.telefon || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, telefon: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="E-posta"
                    className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl outline-none text-white"
                    value={editingPerson.email || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, email: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="Okul / Bölüm"
                    className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl outline-none text-white"
                    value={editingPerson.okul || ''}
                    onChange={(e) => setEditingPerson({ ...editingPerson, okul: e.target.value })}
                  />
                  <button
                    type="submit"
                    className="w-full bg-blue-600 p-5 rounded-2xl font-bold uppercase text-xs tracking-widest flex items-center justify-center gap-2"
                  >
                    <Save size={18} /> Güncelle
                  </button>
                </form>
              </div>
            </div>
          )}

          <div className="bg-slate-900/40 p-6 rounded-[2.5rem] border border-white/5 space-y-5">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={20} />
                <input
                  type="text"
                  placeholder="İsim, telefon, e-posta veya okul ile ara..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-white/5 pl-12 pr-4 py-4 rounded-2xl outline-none text-sm text-white focus:border-blue-500 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={exportToExcel}
                  className="bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-600 hover:text-white px-5 py-4 rounded-2xl transition-all flex items-center justify-center gap-2 font-black uppercase text-xs"
                >
                  <Download size={18} /> Excel İndir
                </button>
                <button
                  onClick={() => fetchEventParticipants()}
                  className="bg-slate-800 p-4 rounded-2xl text-white hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 font-bold uppercase text-xs"
                >
                  <RefreshCcw size={18} /> Yenile
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setFilterArrived(!filterArrived); setFilterNotArrived(false); }}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${
                  filterArrived ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <CheckCircle2 size={15} /> İÇERİDEKİLER
              </button>
              <button
                onClick={() => { setFilterNotArrived(!filterNotArrived); setFilterArrived(false); }}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${
                  filterNotArrived ? 'bg-rose-600 border-rose-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <XCircle size={15} /> GELMEYENLER
              </button>
              <button
                onClick={() => { setFilterTicketed(!filterTicketed); setFilterNotTicketed(false); }}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${
                  filterTicketed ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <TicketCheck size={15} /> BİLET ALANLAR
              </button>
              <button
                onClick={() => { setFilterNotTicketed(!filterNotTicketed); setFilterTicketed(false); }}
                className={`flex-1 min-w-[130px] flex items-center justify-center gap-2 py-3 rounded-xl text-[11px] font-bold border transition-all ${
                  filterNotTicketed ? 'bg-amber-600 border-amber-500 text-white' : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <XCircle size={15} /> BİLET ALMAYANLAR
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {loadingParticipants ? (
              <div className="flex justify-center p-20">
                <Loader2 className="animate-spin text-blue-500" size={48} />
              </div>
            ) : filteredApprovedList.length === 0 ? (
              <div className="text-center py-20 bg-slate-900/20 rounded-[3rem] border border-dashed border-white/10">
                <Users className="mx-auto text-slate-700 mb-4" size={64} />
                <p className="text-slate-500 font-bold uppercase text-sm tracking-widest">
                  Arama kriterlerine uygun onaylı katılımcı bulunamadı.
                </p>
              </div>
            ) : (
              filteredApprovedList.map((person) => {
                const isDuplicate = participants.filter((p) => p.telefon === person.telefon).length > 1;
                return (
                  <div
                    key={person.id}
                    className="bg-slate-900/40 p-6 md:p-8 rounded-[2.5rem] border border-white/5 shadow-xl hover:border-white/10 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-4 flex-1 w-full">
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-bold text-xl md:text-2xl leading-tight text-white">{person.ad_soyad}</p>
                          {isDuplicate && (
                            <div className="flex items-center gap-1 bg-amber-500/20 px-3 py-1.5 rounded-lg border border-amber-500/30">
                              <AlertTriangle size={14} className="text-amber-500" />
                              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">ORTAK TEL NO</span>
                            </div>
                          )}
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border tracking-wider ${
                            person.geldi_mi ? 'bg-emerald-500 text-white border-emerald-400' : 'bg-slate-800 text-slate-400 border-white/5'
                          }`}>
                            {person.geldi_mi ? 'İÇERİDE' : 'GELMEDİ'}
                          </span>
                          <span className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border tracking-wider ${
                            person.bilet_alindi_mi ? 'bg-blue-500 text-white border-blue-400' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                          }`}>
                            {person.bilet_alindi_mi ? 'BİLET ALINDI' : 'BİLET ALINMADI'}
                          </span>
                          {event.has_seating && person.koltuk_no && (
                            <span className="text-[10px] font-bold px-3 py-1.5 rounded-lg border bg-slate-800 text-blue-300 border-blue-500/20 flex items-center gap-2">
                              <Armchair size={14} /> KOLTUK: {person.koltuk_no}
                            </span>
                          )}
                          {((person.form_answers && Object.keys(person.form_answers).length > 0) || (customQuestions && customQuestions.length > 0)) && (
                            <button
                              type="button"
                              onClick={() => setViewingAnswersPerson(person)}
                              className="text-[10px] font-bold px-3 py-1.5 rounded-lg border bg-purple-500/10 text-purple-300 border-purple-500/20 hover:bg-purple-600 hover:text-white flex items-center gap-1.5 transition-all"
                              title="Başvuru Formu Yanıtları"
                            >
                              <FileQuestion size={13} /> Form Yanıtları
                            </button>
                          )}
                        </div>

                        <div className="flex flex-col gap-1">
                          <p className={`text-sm md:text-base font-medium ${isDuplicate ? 'text-amber-400' : 'text-slate-300'}`}>
                            📞 {person.telefon}
                          </p>
                          <p className="text-[10px] text-slate-600 font-mono tracking-widest uppercase">
                            Kayıt ID: #{person.id}
                          </p>
                        </div>

                        <div className="mt-4 grid grid-cols-1 gap-y-3 pt-4 border-t border-white/5">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex flex-wrap gap-4 items-center flex-1">
                              {person.email && (
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                  <span className="text-blue-500 font-black uppercase text-[9px] tracking-widest">E-Posta</span>
                                  <span className="text-xs text-slate-300 break-all">{person.email}</span>
                                </div>
                              )}
                              {person.okul && (
                                <div className="flex flex-col gap-1 min-w-[140px]">
                                  <span className="text-emerald-500 font-black uppercase text-[9px] tracking-widest">Okul / Bölüm</span>
                                  <span className="text-xs text-slate-300">{person.okul}</span>
                                </div>
                              )}
                            </div>

                            {person.dekont_url && (
                              <button
                                type="button"
                                onClick={() => setViewingReceiptUrl(person.dekont_url)}
                                className="w-full sm:w-auto flex items-center justify-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 border border-blue-500/30 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0"
                              >
                                <FileText size={14} /> DEKONTU İNCELE
                              </button>
                            )}
                          </div>

                          {person.referans && (
                            <div className="flex flex-col gap-1 bg-slate-950/50 p-3 rounded-xl border border-white/5">
                              <span className="text-purple-500 font-black uppercase text-[9px] tracking-widest">Referans Bilgisi</span>
                              <span className="text-xs text-slate-400 italic">&quot;{person.referans}&quot;</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-row md:flex-col gap-2 w-full md:w-auto border-t md:border-none pt-4 md:pt-0">
                        {!person.geldi_mi && (
                          <button
                            onClick={async () => {
                              if (confirm(`${person.ad_soyad} içeri alınsın mı?`)) {
                                const ticketId = person.bilet_id || person.id;
                                const { error } = await supabase
                                  .from('biletler')
                                  .update({ geldi_mi: true })
                                  .eq('id', ticketId);
                                if (!error) {
                                  setParticipants((prev) =>
                                    prev.map((p) => (p.bilet_id === ticketId || p.id === ticketId ? { ...p, geldi_mi: true } : p))
                                  );
                                }
                              }
                            }}
                            title="Manuel İçeri Al"
                            className="flex-1 p-4 bg-emerald-500/10 text-emerald-400 rounded-2xl border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <TicketCheck size={22} />
                          </button>
                        )}
                        <div className="flex flex-1 gap-2">
                          <button
                            onClick={() => { setEditingPerson(person); setIsEditModalOpen(true); }}
                            title="Bilgileri Düzenle"
                            className="flex-1 p-4 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <Edit3 size={20} />
                          </button>
                          <button
                            onClick={() => resetSeatAndTicket(person.id)}
                            title="Bilet ve Koltuğu Sıfırla"
                            className="flex-1 p-4 bg-amber-500/10 text-amber-500 rounded-2xl border border-amber-500/20 hover:bg-amber-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <RefreshCcw size={20} />
                          </button>
                          <button
                            onClick={() => handleToggleBan(person)}
                            title="Katılımcıyı Yasakla (Banla)"
                            className="flex-1 p-4 bg-purple-500/10 text-purple-400 rounded-2xl border border-purple-500/20 hover:bg-purple-600 hover:text-white transition-all flex items-center justify-center"
                          >
                            <ShieldAlert size={20} />
                          </button>
                          <button
                            onClick={() => deleteUser(person.id)}
                            title="Katılımcıyı Sil"
                            className="flex-1 p-4 bg-rose-500/10 text-rose-500 rounded-2xl border border-rose-500/20 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                          >
                            <Trash2 size={20} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {approvedParticipants.length > 0 && (
            <button
              onClick={deleteAllApprovedParticipants}
              className="w-full bg-rose-500/10 border border-rose-500/20 text-rose-500 p-5 rounded-2xl font-bold uppercase text-xs tracking-[0.2em] flex items-center justify-center gap-2 hover:bg-rose-600 hover:text-white transition-all"
            >
              <Trash2 size={18} /> Bu Etkinliğin Onaylı Katılımcı Listesini Tamamen Sil
            </button>
          )}
        </div>
      )}

      {/* =====================================================================
          SEKME 2: ONAY BEKLEYENLER
         ===================================================================== */}
      {activeTab === 'pending' && (
        <div className="space-y-6 animate-in fade-in duration-300">
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
                    Telefon numarası otomatik olarak panoya kopyalandı.
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

          <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/40 p-6 rounded-[2rem] border border-white/5">
            <div>
              <h2 className="text-xl font-black uppercase text-white">Onay Bekleyen Başvurular</h2>
              <p className="text-xs text-slate-400 font-bold mt-0.5">
                Onaylanan katılımcılara otomatik olarak onay e-postası gönderilir
              </p>
            </div>
            <div className="flex items-center gap-2">
              {pendingParticipants.length > 1 && (
                <button
                  onClick={approveAllPending}
                  disabled={bulkApproving}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 transition-all"
                >
                  {bulkApproving ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                  Tümünü Onayla ({pendingParticipants.length})
                </button>
              )}
              <button
                onClick={() => fetchEventParticipants()}
                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white"
              >
                <RefreshCcw size={20} className={loadingParticipants ? "animate-spin" : ""} />
              </button>
            </div>
          </div>

          <div className="grid gap-4">
            {loadingParticipants ? (
              <div className="flex justify-center p-20">
                <Loader2 className="animate-spin text-blue-500" size={40} />
              </div>
            ) : pendingParticipants.length === 0 ? (
              <div className="text-center p-16 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-white/10 text-white">
                <UserCheck className="mx-auto text-slate-700 mb-4" size={52} />
                <p className="text-slate-400 font-black uppercase text-sm tracking-wider">
                  Bu etkinlik için bekleyen başvuru bulunmuyor.
                </p>
              </div>
            ) : (
              pendingParticipants.map((person) => (
                <div
                  key={person.id}
                  className="bg-slate-900/40 border border-white/10 p-6 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center text-white gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Clock size={16} className="text-amber-500" />
                      <h3 className="font-black text-lg">{person.ad_soyad}</h3>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-300 font-bold">
                      <span>📞 {person.telefon}</span>
                      {person.email && <span>✉️ {person.email}</span>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                      {person.okul && (
                        <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                          <GraduationCap size={14} className="text-blue-400" />
                          <span>{person.okul}</span>
                        </div>
                      )}
                      {person.referans && (
                        <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                          <UserCheck2 size={14} className="text-purple-400" />
                          <span>Ref: {person.referans}</span>
                        </div>
                      )}
                      {person.dekont_url && (
                        <button
                          type="button"
                          onClick={() => setViewingReceiptUrl(person.dekont_url)}
                          className="flex items-center gap-1.5 bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 px-3 py-1.5 rounded-xl font-black text-xs transition-all"
                        >
                          <FileText size={14} /> DEKONTU GÖR
                        </button>
                      )}
                      {((person.form_answers && Object.keys(person.form_answers).length > 0) || (customQuestions && customQuestions.length > 0)) && (
                        <button
                          type="button"
                          onClick={() => setViewingAnswersPerson(person)}
                          className="flex items-center gap-1.5 bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 px-3 py-1.5 rounded-xl font-black text-xs transition-all"
                          title="Başvuru Formu Yanıtları"
                        >
                          <FileQuestion size={14} /> FORM YANITLARI
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:flex-col gap-2 w-full sm:w-auto min-w-[150px]">
                    <button
                      disabled={approvingId === person.id}
                      onClick={() => approveUser(person)}
                      className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white px-5 py-3 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
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
                      className="flex-1 bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 px-5 py-3 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
                    >
                      <X size={16} /> REDDET
                    </button>

                    <button
                      onClick={() => handleToggleBan(person)}
                      className="flex-1 bg-purple-500/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 px-5 py-3 rounded-2xl font-black transition-all active:scale-95 flex items-center justify-center gap-1.5 text-xs uppercase tracking-wider"
                      title="Katılımcıyı Yasakla (Kullanıcı onay bekliyor görmeye devam eder)"
                    >
                      <ShieldAlert size={16} /> YASAKLA
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME: YASAKLANANLAR (GÖLGE BANLI KATILIMCILAR)
         ===================================================================== */}
      {activeTab === 'banned' && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-wrap justify-between items-center gap-4 bg-slate-900/60 p-6 rounded-[2rem] border border-rose-500/20">
            <div>
              <h2 className="text-xl font-black uppercase flex items-center gap-2 text-rose-400">
                <ShieldAlert size={22} /> Yasaklanan Katılımcılar ({bannedParticipants.length})
              </h2>
              <p className="text-xs text-slate-400 font-bold mt-1">
                Bu kullanıcılar sistemde yasaklanmıştır. Kullanıcı arayüzünde banlandıkları söylenmez, onay bekliyor gibi görünürler.
              </p>
            </div>
            <button
              onClick={() => fetchEventParticipants()}
              className="p-3 bg-slate-800 hover:bg-slate-700 rounded-2xl text-white"
            >
              <RefreshCcw size={20} className={loadingParticipants ? "animate-spin" : ""} />
            </button>
          </div>

          <div className="grid gap-4">
            {bannedParticipants.length === 0 ? (
              <div className="text-center p-16 bg-slate-900/20 rounded-[2.5rem] border border-dashed border-white/10 text-white">
                <CheckCircle2 className="mx-auto text-emerald-500/40 mb-4" size={52} />
                <p className="text-slate-400 font-black uppercase text-sm tracking-wider">
                  Bu etkinlikte yasaklanmış katılımcı bulunmuyor.
                </p>
              </div>
            ) : (
              bannedParticipants.map((person) => (
                <div
                  key={person.id}
                  className="bg-slate-900/40 border border-rose-500/20 p-6 rounded-[2rem] flex flex-col sm:flex-row justify-between items-start sm:items-center text-white gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[9px] font-black uppercase px-2.5 py-1 rounded-md">
                        YASAKLI (GÖLGE BAN)
                      </span>
                      <h3 className="font-black text-lg">{person.ad_soyad}</h3>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-300 font-bold">
                      <span>📞 {person.telefon}</span>
                      {person.email && <span>✉️ {person.email}</span>}
                    </div>
                    <div className="flex flex-wrap items-center gap-2.5 pt-1 text-xs">
                      {person.okul && (
                        <div className="flex items-center gap-1.5 text-slate-300 bg-white/5 px-3 py-1.5 rounded-xl border border-white/5">
                          <GraduationCap size={14} className="text-blue-400" />
                          <span>{person.okul}</span>
                        </div>
                      )}
                      {person.dekont_url && (
                        <button
                          onClick={() => setViewingReceiptUrl(person.dekont_url)}
                          className="text-[10px] text-blue-400 underline font-bold"
                        >
                          Ödeme Dekontunu İncele
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <button
                      onClick={() => handleToggleBan(person)}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
                    >
                      <Check size={16} /> YASAĞI KALDIR
                    </button>
                    <button
                      onClick={() => deleteUser(person.id)}
                      className="p-3 bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white rounded-2xl transition-all"
                      title="Bileti Sil"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME 3: KATILIMCI EKLE (EXCEL & MANUEL)
         ===================================================================== */}
      {activeTab === 'add' && (
        <div className="max-w-2xl mx-auto space-y-6 animate-in fade-in duration-300">
          {uiWarnings.isOpen && (
            <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
              <div className="w-full max-w-lg bg-slate-900 border border-amber-500/30 rounded-[2.5rem] p-8 shadow-2xl">
                <div className="flex items-center gap-3 mb-6 text-amber-500">
                  <AlertTriangle size={32} />
                  <h2 className="text-xl font-black uppercase">Veri Uyarıları</h2>
                </div>
                <div className="max-h-60 overflow-y-auto mb-6 space-y-2 pr-2 custom-scrollbar">
                  {uiWarnings.messages.map((msg, idx) => (
                    <div
                      key={idx}
                      className="bg-amber-500/10 text-amber-400 p-3 rounded-xl text-xs font-bold border border-amber-500/20"
                    >
                      {msg}
                    </div>
                  ))}
                </div>
                <p className="text-sm text-slate-400 mb-6 font-bold">Yine de kaydı tamamlamak istiyor musunuz?</p>
                <div className="flex gap-3">
                  <button
                    onClick={uiWarnings.onCancel}
                    className="flex-1 bg-slate-800 text-white p-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-slate-700 transition-colors"
                  >
                    Vazgeç
                  </button>
                  <button
                    onClick={uiWarnings.onConfirm}
                    className="flex-1 bg-amber-600 text-white p-4 rounded-2xl font-bold uppercase text-xs tracking-widest hover:bg-amber-500 transition-colors"
                  >
                    Yine de Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="bg-slate-900/60 border border-dashed border-white/20 hover:border-emerald-500/50 rounded-[2.5rem] p-8 text-center cursor-pointer transition-all">
            <label className="cursor-pointer block">
              <input
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleExcelUpload}
                disabled={addLoading}
              />
              <div className="flex flex-col items-center gap-4">
                <div className="bg-emerald-500/10 p-5 rounded-2xl">
                  {addLoading ? (
                    <Loader2 className="animate-spin text-emerald-400" size={40} />
                  ) : (
                    <FileUp size={40} className="text-emerald-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-lg font-black uppercase tracking-tight text-white">
                    {event.event_name} — Excel / CSV Yükle
                  </h3>
                  <p className="text-xs text-slate-400 font-bold mt-1">
                    &quot;Ad Soyad&quot; ve &quot;Telefon&quot; sütunlarını içeren dosyayı seçin (Otomatik onaylı eklenir)
                  </p>
                </div>
              </div>
            </label>
          </div>

          <div className="bg-slate-900/60 border border-white/10 rounded-[2.5rem] p-8">
            <div className="flex items-center gap-3 mb-6">
              <UserPlus size={24} className="text-emerald-400" />
              <h2 className="text-lg font-black uppercase">Manuel Katılımcı Ekle</h2>
            </div>
            <form onSubmit={handleAddSinglePerson} className="space-y-4">
              <input
                required
                type="text"
                placeholder="Ad Soyad *"
                className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-emerald-500"
                value={newPerson.ad_soyad}
                onChange={(e) => setNewPerson({ ...newPerson, ad_soyad: e.target.value })}
              />
              <input
                required
                type="text"
                placeholder="Telefon (5XXXXXXXXX) *"
                className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-emerald-500"
                value={newPerson.telefon}
                onChange={(e) => setNewPerson({ ...newPerson, telefon: e.target.value })}
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <input
                  type="email"
                  placeholder="E-posta (Opsiyonel)"
                  className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-emerald-500"
                  value={newPerson.email}
                  onChange={(e) => setNewPerson({ ...newPerson, email: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Okul / Bölüm (Opsiyonel)"
                  className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl text-white outline-none focus:border-emerald-500"
                  value={newPerson.okul}
                  onChange={(e) => setNewPerson({ ...newPerson, okul: e.target.value })}
                />
              </div>
              <button
                disabled={addLoading}
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 p-5 rounded-2xl font-black uppercase text-xs tracking-widest mt-2 transition-all"
              >
                {addLoading ? "Ekleniyor..." : "Onaylı Listeye Kaydet"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* =====================================================================
          SEKME 4: QR OKUYUCU (SCANNER)
         ===================================================================== */}
      {activeTab === 'scanner' && (
        <div className="max-w-md mx-auto space-y-6 animate-in fade-in duration-300">
          <div
            className={`relative aspect-square rounded-[3rem] overflow-hidden border-[6px] transition-all duration-500 shadow-2xl ${
              scanStatus.status === 'success'
                ? 'border-emerald-500 shadow-emerald-500/20'
                : scanStatus.status === 'error'
                ? 'border-rose-500 shadow-rose-500/20'
                : scanStatus.status === 'warning'
                ? 'border-amber-500 shadow-amber-500/20'
                : scanStatus.status === 'processing'
                ? 'border-blue-500 shadow-blue-500/20'
                : 'border-white/10'
            }`}
          >
            <div id="reader" className="w-full h-full object-cover"></div>

            {scanStatus.status === 'idle' && !isInitializingScanner && (
              <div className="absolute inset-x-0 top-0 h-1 bg-blue-500/50 shadow-[0_0_15px_blue] animate-scan-line z-10"></div>
            )}

            {isInitializingScanner && (
              <div className="absolute inset-0 bg-slate-900 flex flex-col items-center justify-center gap-4 z-20">
                <Loader2 className="w-10 h-10 text-blue-500 animate-spin" />
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Kamera Hazırlanıyor...</p>
              </div>
            )}

            {scanStatus.message && (
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center p-6 text-center backdrop-blur-md z-30 animate-in fade-in zoom-in duration-300 ${
                  scanStatus.status === 'success'
                    ? 'bg-emerald-950/85'
                    : scanStatus.status === 'error'
                    ? 'bg-rose-950/85'
                    : scanStatus.status === 'processing'
                    ? 'bg-blue-950/85'
                    : 'bg-amber-950/85'
                }`}
              >
                {scanStatus.status === 'success' && <CheckCircle2 className="w-20 h-20 text-emerald-400 mb-4" />}
                {scanStatus.status === 'error' && <XCircle className="w-20 h-20 text-rose-400 mb-4" />}
                {scanStatus.status === 'warning' && <AlertCircle className="w-20 h-20 text-amber-400 mb-4" />}
                {scanStatus.status === 'processing' && <Loader2 className="w-20 h-20 text-blue-400 mb-4 animate-spin" />}

                <p className="text-2xl font-black text-white uppercase leading-tight">{scanStatus.message}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center">
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2">İçeride</span>
              <span className="text-4xl font-black text-white">{arrivedCount}</span>
            </div>
            <div className="bg-slate-900/50 border border-white/5 p-6 rounded-[2.5rem] flex flex-col items-center">
              <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Kalan Onaylı</span>
              <span className="text-4xl font-black text-white">{approvedParticipants.length - arrivedCount}</span>
            </div>
          </div>

          <p className="text-center text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em]">
            <Camera className="inline-block w-3.5 h-3.5 mr-2 mb-0.5" />
            {event.event_name} İçin QR Tarama Aktif
          </p>

          <style jsx global>{`
            @keyframes scan {
              0% { top: 0%; }
              100% { top: 100%; }
            }
            .animate-scan-line {
              position: absolute;
              animation: scan 2s linear infinite;
            }
          `}</style>
        </div>
      )}

      {/* =====================================================================
          SEKME 5: ETKİNLİK & KOLTUK DÜZENİ AYARLARI
         ===================================================================== */}
      {activeTab === 'settings' && (
        <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in duration-300">
          {settingsMessage && (
            <div className="p-4 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-black flex items-center gap-2">
              <CheckCircle2 size={18} /> {settingsMessage}
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="bg-slate-900/50 border border-white/10 rounded-[2.5rem] p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap justify-between items-center gap-4 border-b border-white/5 pb-4">
              <div>
                <h2 className="text-xl font-black uppercase text-white">Etkinlik Ayarları</h2>
                <p className="text-xs text-slate-400 font-bold">Etkinlik bilgilerini, ücret ve koltuk düzenini güncelleyin</p>
              </div>
              {event.has_seating && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSeats(event.seat_layout || []);
                    setIsSeatEditorOpen(true);
                  }}
                  className="bg-amber-500 hover:bg-amber-400 text-slate-950 px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg"
                >
                  <LayoutGrid size={16} /> Koltuk Düzenini Aç ({(event.seat_layout || []).length} Koltuk)
                </button>
              )}
            </div>

            {/* Tür Seçimi */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: 'cinema', label: 'Sinema', icon: <Film size={16} /> },
                { id: 'theater', label: 'Tiyatro', icon: <Theater size={16} /> },
                { id: 'social', label: 'Sosyal', icon: <Users size={16} /> },
                { id: 'quiz', label: 'Quiz', icon: <Trophy size={16} /> },
              ].map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setEvent({ ...event, event_type: t.id })}
                  className={`p-3.5 rounded-2xl flex flex-col items-center gap-1 border transition-all ${
                    event.event_type === t.id
                      ? 'bg-blue-600 border-blue-400 text-white'
                      : 'bg-slate-950 border-white/5 text-slate-500'
                  }`}
                >
                  {t.icon}
                  <span className="text-[9px] font-black uppercase">{t.label}</span>
                </button>
              ))}
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  Etkinlik Adı
                </label>
                <input
                  required
                  value={event.event_name || ''}
                  onChange={(e) => setEvent({ ...event, event_name: e.target.value })}
                  className="w-full bg-slate-950 border border-white/10 p-4 rounded-2xl text-sm font-bold text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="sm:col-span-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Etkinlik Tarihi
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={15} />
                      <input
                        type="date"
                        value={rawDate}
                        onChange={(e) => {
                          const nextDate = e.target.value;
                          setRawDate(nextDate);
                          const isoDateTime = buildEventDateTime(nextDate, rawTime);
                          setEvent({
                            ...event,
                            event_date: isoDateTime,
                            is_active: isEventPast(isoDateTime) ? false : true,
                          });
                        }}
                        className="w-full bg-slate-950 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Saat
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 pointer-events-none" size={15} />
                      <input
                        type="time"
                        value={rawTime}
                        onChange={(e) => {
                          const nextTime = e.target.value;
                          setRawTime(nextTime);
                          const isoDateTime = buildEventDateTime(rawDate, nextTime);
                          setEvent({
                            ...event,
                            event_date: isoDateTime,
                            is_active: isEventPast(isoDateTime) ? false : event.is_active,
                          });
                        }}
                        className="w-full bg-slate-950 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </div>

                {event.event_date && (
                  <div className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${
                    isEventPast(event.event_date)
                      ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                      : 'bg-blue-500/10 border-blue-500/30 text-blue-300'
                  }`}>
                    <span>
                      Otomatik Görünüm: <strong className="text-white">{formatEventDateDisplay(event.event_date)}</strong>
                    </span>
                    {isEventPast(event.event_date) && (
                      <span className="text-[10px] font-black uppercase">Tarihi Geçmiş (Arşiv)</span>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                      Konum / Salon
                    </label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                      <input
                        value={event.event_location || ''}
                        onChange={(e) => setEvent({ ...event, event_location: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        Google Maps Konum Linki
                      </label>
                      {event.event_location?.trim() && !event.location_url && (
                        <button
                          type="button"
                          onClick={() =>
                            setEvent({
                              ...event,
                              location_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.event_location.trim())}`,
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
                        value={event.location_url || ''}
                        onChange={(e) => setEvent({ ...event, location_url: e.target.value })}
                        className="w-full bg-slate-950 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 block mb-1.5">
                  WhatsApp Grup Linki
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={15} />
                  <input
                    value={event.whatsapp_link || ''}
                    onChange={(e) => setEvent({ ...event, whatsapp_link: e.target.value })}
                    className="w-full bg-slate-950 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Durum Anahtarları */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                type="button"
                onClick={() => setEvent({ ...event, is_active: !event.is_active })}
                className={`p-3.5 rounded-2xl text-[10px] font-black uppercase border flex items-center justify-center gap-2 transition-all ${
                  event.is_active
                    ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400'
                    : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <Power size={14} /> {event.is_active ? 'Aktif' : 'Arşivde'}
              </button>

              <button
                type="button"
                onClick={() => setEvent({ ...event, is_registration_open: !event.is_registration_open })}
                className={`p-3.5 rounded-2xl text-[10px] font-black uppercase border flex items-center justify-center gap-2 transition-all ${
                  event.is_registration_open
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <User size={14} /> {event.is_registration_open ? 'Kayıt Açık' : 'Kayıt Kapalı'}
              </button>

              <button
                type="button"
                onClick={() => setEvent({ ...event, has_seating: !event.has_seating })}
                className={`p-3.5 rounded-2xl text-[10px] font-black uppercase border flex items-center justify-center gap-2 transition-all ${
                  event.has_seating
                    ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                    : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <Armchair size={14} /> {event.has_seating ? 'Koltuk Açık' : 'Koltuk Kapalı'}
              </button>

              <button
                type="button"
                onClick={() => setEvent({ ...event, is_featured: !event.is_featured })}
                className={`p-3.5 rounded-2xl text-[10px] font-black uppercase border flex items-center justify-center gap-2 transition-all ${
                  event.is_featured
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                    : 'bg-slate-950 border-white/5 text-slate-500'
                }`}
              >
                <Sparkles size={14} /> {event.is_featured ? 'Özel Vurgu' : 'Normal'}
              </button>
            </div>

            {/* Ücret & Dekont Ayarı */}
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setEvent({ ...event, is_paid: !event.is_paid })}
                className={`w-full py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                  event.is_paid
                    ? 'bg-amber-600/15 border-amber-500/30 text-amber-400'
                    : 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400'
                }`}
              >
                {event.is_paid ? 'ÜCRETLİ ETKİNLİK (DEKONT İSTER)' : 'ÜCRETSİZ ETKİNLİK (DEKONT İSTEMEZ)'}
              </button>

              {event.is_paid && (
                <div className="space-y-3 p-4 rounded-2xl bg-slate-950/60 border border-amber-500/20">
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                    <input
                      placeholder="Hesap Sahibi Adı Soyadı"
                      className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none"
                      value={event.event_ibanname || ''}
                      onChange={(e) => setEvent({ ...event, event_ibanname: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="relative col-span-1">
                      <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                      <input
                        type="number"
                        placeholder="Fiyat (TL)"
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none"
                        value={event.event_price || ''}
                        onChange={(e) => setEvent({ ...event, event_price: e.target.value })}
                      />
                    </div>
                    <div className="relative col-span-2">
                      <CreditCard className="absolute left-3.5 top-1/2 -translate-y-1/2 text-amber-500/60" size={14} />
                      <input
                        placeholder="Ödeme IBAN Bilgisi"
                        className="w-full bg-slate-900 border border-white/10 p-4 pl-10 rounded-2xl text-xs font-bold text-white outline-none font-mono"
                        value={event.event_iban || ''}
                        onChange={(e) => setEvent({ ...event, event_iban: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ÖZEL BAŞVURU SORULARI */}
            <div className="bg-slate-950/70 p-6 rounded-[2rem] border border-blue-500/20 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl border border-blue-500/30">
                    <FileQuestion size={22} />
                  </div>
                  <div>
                    <h3 className="text-base font-black uppercase text-white tracking-wide">
                      Başvuru Soruları
                    </h3>
                    <p className="text-xs text-slate-400 font-bold">
                      Kayıt formunda katılımcıya yöneltilecek özel sorular ({customQuestions.length} Soru)
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddQuestion}
                  className="bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase px-4 py-2.5 rounded-xl shadow-lg shadow-blue-600/20 flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <Plus size={15} /> Soru Ekle
                </button>
              </div>

              {/* Soru Listesi */}
              {customQuestions.length === 0 ? (
                <div className="p-8 text-center bg-slate-900/30 rounded-2xl border border-dashed border-white/10 text-slate-500 text-xs">
                  Bu etkinlik için henüz özel bir başvuru sorusu eklenmedi. Katılımcılar sadece standart kimlik bilgileriyle kayıt olur.
                </div>
              ) : (
                <div className="space-y-3 pt-2">
                  {customQuestions.map((q, qIndex) => (
                    <div
                      key={q.id || qIndex}
                      className="bg-slate-900/80 border border-white/10 p-5 rounded-2xl space-y-3 transition-all hover:border-blue-500/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-[10px] font-mono font-bold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-md">
                          Soru #{qIndex + 1}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuestion(qIndex, 'required', !q.required)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all ${
                              q.required
                                ? 'bg-rose-500/20 text-rose-400 border-rose-500/40'
                                : 'bg-slate-800 text-slate-400 border-white/5'
                            }`}
                          >
                            {q.required ? '* Zorunlu Soru' : 'İsteğe Bağlı'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(qIndex)}
                            className="p-1.5 rounded-lg bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition-colors cursor-pointer"
                            title="Soruyu Sil"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>

                      {/* Soru Metni */}
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Soru Metni</label>
                        <input
                          placeholder="Örn: Bu derslere katılma motivasyonunuz nedir?"
                          value={q.label}
                          onChange={(e) => handleUpdateQuestion(qIndex, 'label', e.target.value)}
                          className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        />
                      </div>

                      {/* Yanıt Türü & İpuçları */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">Yanıt Türü</label>
                          <select
                            value={q.type || 'textarea'}
                            onChange={(e) => handleUpdateQuestion(qIndex, 'type', e.target.value)}
                            className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                          >
                            <option value="textarea">Uzun Paragraf (Açıklama / Motivasyon)</option>
                            <option value="text">Kısa Yanıt (Tek Satır)</option>
                            <option value="radio">Tekli Seçim (Evet / Hayır vb. Butonlar)</option>
                            <option value="select">Açılır Liste (Seçmeli)</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 block mb-1">
                            {q.type === 'radio' || q.type === 'select' ? 'Seçenekler (Virgülle Ayırın)' : 'İpucu / Placeholder'}
                          </label>
                          {q.type === 'radio' || q.type === 'select' ? (
                            <input
                              placeholder="Örn: Evet, Hayır, Kısmen"
                              value={(q.options || []).join(', ')}
                              onChange={(e) => {
                                const opts = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                handleUpdateQuestion(qIndex, 'options', opts);
                              }}
                              className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                            />
                          ) : (
                            <input
                              placeholder="Örn: Kısaca hedeflerinizi anlatın..."
                              value={q.placeholder || ''}
                              onChange={(e) => handleUpdateQuestion(qIndex, 'placeholder', e.target.value)}
                              className="w-full bg-slate-950 border border-white/10 p-3 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={savingSettings}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white p-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25"
            >
              {savingSettings ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
              DEĞİŞİKLİKLERİ KAYDET
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
