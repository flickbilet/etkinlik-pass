const TURKISH_MONTHS = [
  'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
  'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
];

const TURKISH_DAYS = [
  'Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'
];

/**
 * Tarih (YYYY-MM-DD) ve Saat (HH:mm) inputlarını standart ISO datetime ("YYYY-MM-DDTHH:mm") formatında birleştirir.
 */
export function buildEventDateTime(dateInput: string, timeInput: string = '21:00'): string {
  if (!dateInput) return '';
  const cleanTime = (timeInput || '21:00').replace('.', ':');
  return `${dateInput}T${cleanTime}`;
}

/**
 * Standart ISO datetime ("YYYY-MM-DDTHH:mm") değerini Date nesnesi üzerinden
 * input[type="date"] ve input[type="time"] alanları için ayırır.
 */
export function splitEventDateTime(datetimeStr?: string): {
  dateInput: string;
  timeInput: string;
} {
  if (!datetimeStr) {
    return { dateInput: '', timeInput: '21:00' };
  }

  const dt = new Date(datetimeStr);
  if (isNaN(dt.getTime())) {
    return { dateInput: '', timeInput: '21:00' };
  }

  const yyyy = String(dt.getFullYear());
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');

  return {
    dateInput: `${yyyy}-${mm}-${dd}`,
    timeInput: `${hh}:${min}`,
  };
}

/**
 * Bir etkinliğin sona erme (arşive alınma) zamanını timestamp (ms) olarak hesaplar.
 * 
 * ÖNEMLİ KURAL: Bir etkinlik günü (örneğin "2 Kasım") henüz bitmemişken o etkinlik KESİNLİKLE geçmiş sayılmaz.
 * Etkinlik günü boyunca (sabah, öğlen, etkinlik başlangıç anı ve tüm gece boyunca) etkinlik aktif kalır;
 * ziyaretçiler bilet alabilir, QR okutulabilir ve yoklama yapılabilir.
 * 
 * Etkinlik ancak o takvim günü tamamen bitip ertesi sabah olduğunda (ertesi gün 06:00 veya başlangıçtan en az 6 saat sonra)
 * geçmiş (arşivlenmiş) kabul edilir.
 */
export function getEventExpirationTime(datetimeStr?: string): number | null {
  if (!datetimeStr || String(datetimeStr).trim().toLowerCase() === 'bilinmiyor') {
    return null;
  }

  const str = String(datetimeStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2})[:.](\d{2}))?/);

  let eventDate: Date;

  if (match) {
    const [, yStr, mStr, dStr, hStr, minStr] = match;
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1;
    const day = parseInt(dStr, 10);
    const hours = hStr !== undefined ? parseInt(hStr, 10) : 0;
    const minutes = minStr !== undefined ? parseInt(minStr, 10) : 0;
    eventDate = new Date(year, month, day, hours, minutes, 0, 0);
  } else {
    eventDate = new Date(str);
  }

  if (isNaN(eventDate.getTime())) {
    return null;
  }

  // Etkinlik gününün son anı: YYYY-MM-DD 23:59:59.999
  const endOfEventDay = new Date(
    eventDate.getFullYear(),
    eventDate.getMonth(),
    eventDate.getDate(),
    23,
    59,
    59,
    999
  );

  // Etkinlik günü ve gece etkinlikleri toleransı:
  // 1. O günün bitiminden sonra ertesi sabah 06:00'ya kadar (endOfEventDay + 6 saat)
  // 2. Etkinliğin başlangıç saatinden sonra en az 6 saat (gece geç başlayan sinema/partiler için)
  const endOfDayWithBuffer = endOfEventDay.getTime() + 6 * 60 * 60 * 1000;
  const eventTimeWithBuffer = eventDate.getTime() + 6 * 60 * 60 * 1000;

  return Math.max(endOfDayWithBuffer, eventTimeWithBuffer);
}

/**
 * Etkinliğin gerçekten sona erip ermediğini belirler.
 * Etkinlik günü boyunca false döner (etkinlik gününde ASLA arşive atılmaz / geçmiş sayılmaz).
 * Ancak etkinlik günü tamamen sona erip ertesi sabaha ulaşıldığında true döner.
 */
export function isEventPast(datetimeStr?: string): boolean {
  if (!datetimeStr) return false;
  const expirationTime = getEventExpirationTime(datetimeStr);
  if (!expirationTime) return false;
  return Date.now() > expirationTime;
}

/**
 * Bir etkinliğin başlangıç zamanını timestamp (ms) olarak döndürür.
 * Saat belirtilmemişse varsayılan olarak 21:00 kabul edilir.
 */
export function getEventStartTimestamp(datetimeStr?: string): number | null {
  if (!datetimeStr || String(datetimeStr).trim().toLowerCase() === 'bilinmiyor') {
    return null;
  }

  const str = String(datetimeStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2})[:.](\d{2}))?/);

  let eventDate: Date;
  if (match) {
    const [, yStr, mStr, dStr, hStr, minStr] = match;
    const year = parseInt(yStr, 10);
    const month = parseInt(mStr, 10) - 1;
    const day = parseInt(dStr, 10);
    const hours = hStr !== undefined ? parseInt(hStr, 10) : 21;
    const minutes = minStr !== undefined ? parseInt(minStr, 10) : 0;
    eventDate = new Date(year, month, day, hours, minutes, 0, 0);
  } else {
    eventDate = new Date(str);
  }

  if (isNaN(eventDate.getTime())) {
    return null;
  }

  return eventDate.getTime();
}

/**
 * Etkinliğin başlamasına 1 saat veya daha az kalıp kalmadığını kontrol eder.
 * Başlangıç saati geçmiş ancak etkinlik günü henüz arşive kalkmamışsa da true döner.
 * Etkinlik tamamen sona ermişse (isEventPast) false döner.
 */
export function isEventWithinOneHour(datetimeStr?: string): boolean {
  if (!datetimeStr || isEventPast(datetimeStr)) return false;
  const startTs = getEventStartTimestamp(datetimeStr);
  if (!startTs) return false;

  const msRemaining = startTs - Date.now();
  // 1 saat (60 dakika) veya daha az kaldıysa (veya etkinlik saati geldiyse/geçtiyse)
  return msRemaining <= 60 * 60 * 1000;
}

/**
 * Etkinlik kayıtlarının otomatik olarak kapatılıp sadece "Bilet Hazırlama" moduna
 * geçirilip geçirilmeyeceğini belirler.
 * 
 * Kurallar:
 * 1. Etkinlik aktif olmalı ve geçmiş (arşivlenmiş) olmamalı.
 * 2. Etkinliğe 1 saat veya daha az kalmış (veya etkinlik başlamış) olmalı.
 * 3. Yönetici tarafından bu 1 saatlik pencerede açıkça "Kaydı Aç" (manuel override) yapılmamış olmalı.
 */
export function shouldAutoCloseRegistration(event: any): boolean {
  if (!event || event.is_active === false || isEventPast(event.event_date)) {
    return false;
  }

  // 1 saat veya daha az kalmadıysa otomatik kapanmaz
  if (!isEventWithinOneHour(event.event_date)) {
    return false;
  }

  // Yönetici açıkça "Kaydı Aç" diyerek manuel override yapmışsa otomatik kapanmaz
  if (event.registration_manually_opened === true) {
    return false;
  }

  // localStorage kontrolü (admin arayüzünde hızlı override)
  if (typeof window !== 'undefined') {
    try {
      const localOverride = localStorage.getItem(`manual_reg_opened_${event.id}`);
      if (localOverride === 'true') {
        return false;
      }
    } catch {
      // localStorage erişim hatası olursa yoksay
    }
  }

  // updated_at kontrolü:
  // Eğer yönetici 1 saat eşiğinden (event_start - 60 dk) SONRA bu kaydı güncellediyse
  // ve is_registration_open true ise, yönetici bunu bilinçli olarak açık bırakmıştır.
  if (event.updated_at && event.is_registration_open) {
    const startTs = getEventStartTimestamp(event.event_date);
    if (startTs) {
      const oneHourBeforeStart = startTs - 60 * 60 * 1000;
      const updatedAtTs = new Date(event.updated_at).getTime();
      if (!isNaN(updatedAtTs) && updatedAtTs > oneHourBeforeStart) {
        return false;
      }
    }
  }

  return true;
}

/**
 * ISO datetime ("2026-09-25T21:00") değerini yalnızca ekranda göstermek için
 * "25 Eylül Cuma • 21.00" formatına çevirir.
 */
export function formatEventDateDisplay(datetimeStr?: string): string {
  if (!datetimeStr || String(datetimeStr).trim().toLowerCase() === 'bilinmiyor') {
    return 'Belirtilmedi';
  }

  let dt: Date;
  const str = String(datetimeStr).trim();
  const match = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{1,2})[:.](\d{2}))?/);
  if (match) {
    const [, yStr, mStr, dStr, hStr, minStr] = match;
    dt = new Date(
      parseInt(yStr, 10),
      parseInt(mStr, 10) - 1,
      parseInt(dStr, 10),
      hStr !== undefined ? parseInt(hStr, 10) : 0,
      minStr !== undefined ? parseInt(minStr, 10) : 0
    );
  } else {
    dt = new Date(str);
  }

  if (isNaN(dt.getTime())) {
    return str;
  }

  const dayNumber = dt.getDate();
  const monthName = TURKISH_MONTHS[dt.getMonth()];
  const dayName = TURKISH_DAYS[dt.getDay()];
  const year = dt.getFullYear();
  const currentYear = new Date().getFullYear();

  const hh = String(dt.getHours()).padStart(2, '0');
  const min = String(dt.getMinutes()).padStart(2, '0');
  const formattedTime = `${hh}.${min}`;

  if (year !== currentYear) {
    return `${dayNumber} ${monthName} ${year} ${dayName} • ${formattedTime}`;
  }

  return `${dayNumber} ${monthName} ${dayName} • ${formattedTime}`;
}

/**
 * Canlı Supabase tablosunda ekstra sütun (ALTER TABLE) gerektirmeden
 * konum adı ve Google Maps linkini mevcut `event_location` sütununda birleştirir.
 */
export function packEventLocation(locationName?: string, locationUrl?: string | null): string {
  const cleanName = (locationName || '').split('||')[0].trim() || 'Belirtilmedi';
  const cleanUrl = (locationUrl || '').trim();
  return cleanUrl ? `${cleanName} || ${cleanUrl}` : cleanName;
}

/**
 * `event_location` içinden konum adını ve Google Maps linkini ayrıştırır.
 */
export function unpackEventLocation(evOrLocation?: any): {
  locationName: string;
  locationUrl: string;
} {
  if (!evOrLocation) return { locationName: 'Belirtilmedi', locationUrl: '' };

  let raw = '';
  let url = '';

  if (typeof evOrLocation === 'string') {
    raw = evOrLocation;
  } else if (typeof evOrLocation === 'object') {
    raw = String(evOrLocation.event_location || '');
    url = String(evOrLocation.location_url || '').trim();
  }

  if (raw.includes('||')) {
    const parts = raw.split('||');
    const namePart = (parts[0] || '').trim();
    const urlPart = (parts.slice(1).join('||') || '').trim();
    return {
      locationName: namePart || 'Belirtilmedi',
      locationUrl: url || urlPart || '',
    };
  }

  return {
    locationName: raw.trim() || 'Belirtilmedi',
    locationUrl: url,
  };
}
