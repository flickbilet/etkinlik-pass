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
 * Doğrudan datetime (Date.getTime() / timestamp) üzerinden etkinliğin geçip geçmediğini hesaplar.
 * Hiçbir metin ayrıştırması (string parse) yapmaz.
 */
export function isEventPast(datetimeStr?: string): boolean {
  if (!datetimeStr) return false;
  const timestamp = new Date(datetimeStr).getTime();
  if (isNaN(timestamp)) return false;
  return Date.now() > timestamp;
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
