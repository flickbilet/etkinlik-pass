import { createClient } from '@supabase/supabase-js';

/**
 * ============================================================================
 * TEST / ŞABLON (MOCK) ORTAM AYARI
 * ============================================================================
 * true  -> TEST MODU: Canlı Supabase'e bağlanmaz. Tarayıcı yerel hafızasındaki (localStorage)
 *          örnek/şablon verileri kullanır. Admin paneli şifresiz direkt açılır.
 * false -> CANLI MOD: .env.local içerisindeki canlı Supabase veritabanına bağlanır.
 * ============================================================================
 */
export const USE_TEST_MODE = false;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !USE_TEST_MODE && Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder.supabase.co')
);

/**
 * GÜVENLİ SALT-OKUNUR (READ-ONLY) KORUMA KILIDI
 * true olduğunda:
 * - Canlı Supabase veritabanından tüm veriler (SELECT) gerçek zamanlı okunur.
 * - Veritabanına hiçbir yazma, güncelleme, silme veya dosya yükleme (INSERT, UPDATE, DELETE, UPSERT, STORAGE UPLOAD) İSTEĞİ GÖNDERİLMEZ!
 * Canlı yayında katılımcıların kayıt yapabilmesi ve bilet alabilmesi için false olmalıdır.
 */
export const IS_DATABASE_READ_ONLY = false;

// Varsayılan başlangıç koltuk düzeni (P-A arası 16 sıra x 25 koltuk)
function createDefaultSeats(): string[] {
  const rows = ['P', 'O', 'N', 'M', 'L', 'K', 'J', 'I', 'H', 'G', 'F', 'E', 'D', 'C', 'B', 'A'];
  const seats: string[] = [];
  for (const r of rows) {
    for (let c = 1; c <= 25; c++) {
      seats.push(`${r}-${c}`);
    }
  }
  return seats;
}

const INITIAL_MOCK_DB: Record<string, any[]> = {
  etkinlik_ayarlari: [
    {
      id: 1,
      slot_id: 1,
      event_name: 'Interstellar — Özel Sinema Gecesi',
      event_type: 'cinema',
      event_date: '2026-10-28T19:00',
      event_location: 'Ankara Medipol A Blok Konferans Salonu || https://www.google.com/maps/search/?api=1&query=Ankara+Medipol+%C3%9Cniversitesi',
      whatsapp_link: 'https://chat.whatsapp.com/ornek-grup-1',
      is_active: true,
      is_registration_open: true,
      is_featured: true,
      has_seating: true,
      seat_layout: createDefaultSeats(),
      is_paid: true,
      event_price: '100',
      event_iban: 'TR12 0006 2000 0000 0001 2345 67',
      event_ibanname: 'Ankara Medipol Sinema ve Tiyatro Topluluğu',
    },
    {
      id: 2,
      slot_id: 2,
      event_name: 'Bir Delinin Hatıra Defteri — Tiyatro',
      event_type: 'theater',
      event_date: '2026-11-05T20:00',
      event_location: 'Merkez Kampüs Büyük Sahne || https://www.google.com/maps/search/?api=1&query=Ankara+Medipol+%C3%9Cniversitesi+Merkez+Kamp%C3%BCs',
      whatsapp_link: 'https://chat.whatsapp.com/ornek-grup-2',
      is_active: true,
      is_registration_open: true,
      is_featured: false,
      has_seating: true,
      seat_layout: createDefaultSeats(),
      is_paid: false,
      event_price: null,
      event_iban: null,
      event_ibanname: null,
    },
    {
      id: 3,
      slot_id: 3,
      event_name: 'Sinema & Dizi Quiz Night #4',
      event_type: 'quiz',
      event_date: '2026-10-10T18:30',
      event_location: 'Kafeterya Teras Alanı || https://www.google.com/maps/search/?api=1&query=Ankara+Medipol+%C3%9Cniversitesi',
      whatsapp_link: 'https://chat.whatsapp.com/ornek-grup-3',
      is_active: false,
      is_registration_open: false,
      is_featured: false,
      has_seating: false,
      seat_layout: [],
      is_paid: false,
      event_price: null,
      event_iban: null,
      event_ibanname: null,
    },
  ],
  katilimcilar: [
    {
      id: 1,
      telefon: '5551234567',
      ad_soyad: 'Ahmet Yılmaz',
      email: 'ahmet@medipol.edu.tr',
      okul: 'Tıp Fakültesi',
      referans: 'Furkan',
    },
    {
      id: 2,
      telefon: '5329876543',
      ad_soyad: 'Zeynep Kaya',
      email: 'zeynep@medipol.edu.tr',
      okul: 'Hukuk Fakültesi',
      referans: 'Instagram',
    },
    {
      id: 3,
      telefon: '5441112233',
      ad_soyad: 'Can Demir',
      email: 'can@medipol.edu.tr',
      okul: 'Diş Hekimliği',
      referans: 'Afiş',
    },
    {
      id: 4,
      telefon: '5054445566',
      ad_soyad: 'Elif Şahin',
      email: 'elif@medipol.edu.tr',
      okul: 'Mimarlık',
      referans: 'Topluluk Standı',
    },
    {
      id: 5,
      telefon: '5303334455',
      ad_soyad: 'Mert Aydın',
      email: 'mert@medipol.edu.tr',
      okul: 'Bilgisayar Mühendisliği',
      referans: '',
    },
    {
      id: 6,
      telefon: '5426667788',
      ad_soyad: 'Selin Özkan',
      email: 'selin@medipol.edu.tr',
      okul: 'Psikoloji',
      referans: '',
    },
  ],
  biletler: [
    {
      id: 101,
      etkinlik_id: 1,
      katilimci_id: 1,
      koltuk_no: 'D-12',
      qr_kodu: 'demo-qr-101',
      onayli_mi: true,
      geldi_mi: true,
      bilet_alindi_mi: true,
      dekont_url: 'https://placehold.co/600x800/0f172a/3b82f6?text=Odeme+Dekontu+%23101',
    },
    {
      id: 102,
      etkinlik_id: 1,
      katilimci_id: 2,
      koltuk_no: 'D-13',
      qr_kodu: 'demo-qr-102',
      onayli_mi: true,
      geldi_mi: false,
      bilet_alindi_mi: true,
      dekont_url: 'https://placehold.co/600x800/0f172a/3b82f6?text=Odeme+Dekontu+%23102',
    },
    {
      id: 103,
      etkinlik_id: 1,
      katilimci_id: 3,
      koltuk_no: null,
      qr_kodu: 'demo-qr-103',
      onayli_mi: false,
      geldi_mi: false,
      bilet_alindi_mi: false,
      dekont_url: 'https://placehold.co/600x800/0f172a/10b981?text=Dekont+Can+Demir',
    },
    {
      id: 104,
      etkinlik_id: 1,
      katilimci_id: 4,
      koltuk_no: null,
      qr_kodu: 'demo-qr-104',
      onayli_mi: false,
      geldi_mi: false,
      bilet_alindi_mi: false,
      dekont_url: 'https://placehold.co/600x800/0f172a/f59e0b?text=Dekont+Elif+Sahin',
    },
    {
      id: 105,
      etkinlik_id: 2,
      katilimci_id: 5,
      koltuk_no: null,
      qr_kodu: 'demo-qr-105',
      onayli_mi: true,
      geldi_mi: false,
      bilet_alindi_mi: false,
      dekont_url: null,
    },
    {
      id: 106,
      etkinlik_id: 3,
      katilimci_id: 6,
      koltuk_no: null,
      qr_kodu: 'demo-qr-106',
      onayli_mi: true,
      geldi_mi: true,
      bilet_alindi_mi: true,
      dekont_url: null,
    },
  ],
  surveys: [
    {
      id: 'survey-1',
      title: 'Bu Hafta Hangi Filmi İzleyelim?',
      is_active: true,
      version: 1,
      deadline: '2026-11-02T21:00',
      created_at: '2026-10-20T12:00:00Z',
    },
    {
      id: 'survey-0',
      title: 'Ekim Ayı Açılış Gecesi Film Seçimi',
      is_active: false,
      version: 1,
      deadline: '2026-10-15T20:00',
      created_at: '2026-10-10T12:00:00Z',
    },
  ],
  survey_options: [
    {
      id: 'opt-1',
      survey_id: 'survey-1',
      option_text: 'Inception (2010)',
      description: 'Bilim Kurgu / Gerilim • 2s 28dk • IMDb 8.8',
      trailer_url: 'https://www.youtube.com/watch?v=YoHD9XEInc0',
      image_url: 'https://placehold.co/600x400/0f172a/3b82f6?text=Inception+(2010)',
      votes: 24,
      created_at: '2026-10-20T12:01:00Z',
    },
    {
      id: 'opt-2',
      survey_id: 'survey-1',
      option_text: 'Whiplash (2014)',
      description: 'Dram / Müzik • 1s 46dk • IMDb 8.5',
      trailer_url: 'https://www.youtube.com/watch?v=7d_jQycdQGo',
      image_url: 'https://placehold.co/600x400/0f172a/f59e0b?text=Whiplash+(2014)',
      votes: 18,
      created_at: '2026-10-20T12:02:00Z',
    },
    {
      id: 'opt-3',
      survey_id: 'survey-1',
      option_text: 'The Prestige (2006)',
      description: 'Gizem / Dram • 2s 10dk • IMDb 8.5',
      trailer_url: 'https://www.youtube.com/watch?v=RLtaA9fFNXU',
      image_url: 'https://placehold.co/600x400/0f172a/10b981?text=The+Prestige+(2006)',
      votes: 15,
      created_at: '2026-10-20T12:03:00Z',
    },
  ],
};

function getLocalTable(table: string): any[] {
  if (typeof window === 'undefined') {
    return INITIAL_MOCK_DB[table] ? [...INITIAL_MOCK_DB[table]] : [];
  }
  const key = `flick_mock_db_v4_${table}`;
  const raw = window.localStorage.getItem(key);
  if (!raw) {
    const initial = INITIAL_MOCK_DB[table] ? [...INITIAL_MOCK_DB[table]] : [];
    window.localStorage.setItem(key, JSON.stringify(initial));
    return initial;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return INITIAL_MOCK_DB[table] ? [...INITIAL_MOCK_DB[table]] : [];
  }
}

function saveLocalTable(table: string, rows: any[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(`flick_mock_db_v4_${table}`, JSON.stringify(rows));
  }
}

/**
 * Canlı veritabanına yazma isteklerini tamamen engelleyen sahte (no-op) sorgu zinciri.
 * Hiçbir ağ isteği (fetch/POST/PATCH/DELETE) yapmaz!
 */
class ReadOnlyBlockedMutationBuilder {
  private table: string;
  private operation: string;
  private payload: any;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';

  constructor(table: string, operation: string, payload?: any) {
    this.table = table;
    this.operation = operation;
    this.payload = payload;
  }

  select(_columns = '*') {
    return this;
  }
  eq(_col: string, _val: any) {
    return this;
  }
  in(_col: string, _vals: any[]) {
    return this;
  }
  ilike(_col: string, _val: string) {
    return this;
  }
  not(_col: string, _op: string, _val: any) {
    return this;
  }
  order(_col: string, _opts?: any) {
    return this;
  }
  limit(_n: number) {
    return this;
  }
  single() {
    this.singleMode = 'single';
    return this;
  }
  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private resolveBlocked(): { data: any; error: any } {
    if (typeof window !== 'undefined') {
      console.warn(
        `🛡️ [SALT-OKUNUR KORUMA] Canlı veritabanına yazma işlemi engellendi: ${this.table}.${this.operation}`,
        this.payload ?? ''
      );
    }

    const simulatedRows = Array.isArray(this.payload)
      ? this.payload.map((item, idx) => ({ id: item?.id ?? Date.now() + idx, ...item }))
      : this.payload && typeof this.payload === 'object'
      ? [{ id: this.payload.id ?? Date.now(), ...this.payload }]
      : [];

    if (this.singleMode !== 'none') {
      return { data: simulatedRows[0] ?? { id: Date.now() }, error: null };
    }
    return { data: simulatedRows, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.resolveBlocked()).then(onfulfilled, onrejected);
  }
}

class LocalQueryBuilder {
  private table: string;
  private operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
  private payload: any = null;
  private filters: Array<(row: any) => boolean> = [];
  private sorts: Array<{ col: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private singleMode: 'none' | 'single' | 'maybeSingle' = 'none';

  constructor(table: string) {
    this.table = table;
  }

  select(_columns = '*') {
    return this;
  }

  insert(rows: any[]) {
    this.operation = 'insert';
    this.payload = Array.isArray(rows) ? rows : [rows];
    return this;
  }

  update(values: any) {
    this.operation = 'update';
    this.payload = values;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((row) => String(row[col]) === String(val));
    return this;
  }

  in(col: string, vals: any[]) {
    const strSet = new Set((vals || []).map((v) => String(v)));
    this.filters.push((row) => strSet.has(String(row[col])));
    return this;
  }

  ilike(col: string, val: string) {
    const target = String(val || '').toLocaleLowerCase('tr-TR');
    this.filters.push((row) => String(row[col] || '').toLocaleLowerCase('tr-TR') === target);
    return this;
  }

  not(col: string, op: string, val: any) {
    if (op === 'is' && val === null) {
      this.filters.push((row) => row[col] !== null && row[col] !== undefined && row[col] !== '');
    }
    return this;
  }

  order(col: string, opts?: { ascending?: boolean }) {
    this.sorts.push({ col, ascending: opts?.ascending !== false });
    return this;
  }

  limit(n: number) {
    this.limitCount = n;
    return this;
  }

  single() {
    this.singleMode = 'single';
    return this;
  }

  maybeSingle() {
    this.singleMode = 'maybeSingle';
    return this;
  }

  private execute(): { data: any; error: any } {
    let rows = getLocalTable(this.table);

    if (this.operation === 'insert') {
      const maxId = rows.reduce((max, r) => (typeof r.id === 'number' ? Math.max(max, r.id) : max), 0);
      const inserted = this.payload.map((item: any, idx: number) => ({
        id: item.id ?? (this.table.startsWith('survey') ? `${this.table}-${Date.now()}-${idx}` : maxId + idx + 1),
        created_at: new Date().toISOString(),
        ...item,
      }));
      rows = [...rows, ...inserted];
      saveLocalTable(this.table, rows);

      if (this.singleMode !== 'none') {
        return { data: inserted[0] ?? null, error: null };
      }
      return { data: inserted, error: null };
    }

    if (this.operation === 'update') {
      const updatedRows: any[] = [];
      rows = rows.map((row) => {
        if (this.filters.every((fn) => fn(row))) {
          const updated = { ...row, ...this.payload };
          updatedRows.push(updated);
          return updated;
        }
        return row;
      });
      saveLocalTable(this.table, rows);

      if (this.singleMode !== 'none') {
        return { data: updatedRows[0] ?? null, error: null };
      }
      return { data: updatedRows, error: null };
    }

    if (this.operation === 'delete') {
      const remaining = rows.filter((row) => !this.filters.every((fn) => fn(row)));
      saveLocalTable(this.table, remaining);
      return { data: null, error: null };
    }

    // SELECT
    let result = rows.filter((row) => this.filters.every((fn) => fn(row)));

    if (this.table === 'biletler') {
      const katilimcilar = getLocalTable('katilimcilar');
      result = result.map((bilet) => ({
        ...bilet,
        katilimcilar: katilimcilar.find((k) => k.id === bilet.katilimci_id) || null,
      }));
    }

    for (let i = this.sorts.length - 1; i >= 0; i--) {
      const { col, ascending } = this.sorts[i];
      result.sort((a, b) => {
        const va = a[col];
        const vb = b[col];
        if (va === vb) return 0;
        if (va === undefined || va === null) return 1;
        if (vb === undefined || vb === null) return -1;
        return (va > vb ? 1 : -1) * (ascending ? 1 : -1);
      });
    }

    if (this.limitCount !== null) {
      result = result.slice(0, this.limitCount);
    }

    if (this.singleMode === 'single') {
      return { data: result[0] ?? null, error: result.length === 0 ? { message: 'Kayıt bulunamadı' } : null };
    }
    if (this.singleMode === 'maybeSingle') {
      return { data: result[0] ?? null, error: null };
    }

    return { data: result, error: null };
  }

  then<TResult1 = { data: any; error: any }, TResult2 = never>(
    onfulfilled?: ((value: { data: any; error: any }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.execute()).then(onfulfilled, onrejected);
  }
}

const uploadedBlobUrls: Record<string, string> = {};

/**
 * Gerçek Supabase istemcisini sarar (wrap eder):
 * - SELECT sorgularını doğrudan canlı veritabanına iletir.
 * - IS_DATABASE_READ_ONLY === true iken INSERT / UPDATE / DELETE / UPSERT / STORAGE.UPLOAD
 *   işlemlerini ağa çıkmadan bloke eder.
 */
function wrapClientWithReadOnlyGuard(realClient: any): any {
  if (!IS_DATABASE_READ_ONLY) return realClient;

  return new Proxy(realClient, {
    get(target, prop, receiver) {
      if (prop === 'from') {
        return (table: string) => {
          const realTableBuilder = target.from(table);
          return new Proxy(realTableBuilder, {
            get(tTarget, tProp, tReceiver) {
              if (tProp === 'insert' || tProp === 'update' || tProp === 'delete' || tProp === 'upsert') {
                return (payload?: any) => new ReadOnlyBlockedMutationBuilder(table, String(tProp), payload);
              }
              const value = Reflect.get(tTarget, tProp, tReceiver);
              return typeof value === 'function' ? value.bind(tTarget) : value;
            },
          });
        };
      }

      if (prop === 'storage') {
        return {
          from: (bucket: string) => {
            const realBucket = target.storage.from(bucket);
            return {
              upload: async (path: string, file: File) => {
                console.warn(`🛡️ [SALT-OKUNUR KORUMA] Storage dosya yükleme engellendi: ${bucket}/${path}`);
                if (typeof window !== 'undefined' && file) {
                  uploadedBlobUrls[path] = URL.createObjectURL(file);
                }
                return { data: { path }, error: null };
              },
              getPublicUrl: (path: string) => {
                if (uploadedBlobUrls[path]) {
                  return { data: { publicUrl: uploadedBlobUrls[path] } };
                }
                return realBucket.getPublicUrl(path);
              },
            };
          },
        };
      }

      const val = Reflect.get(target, prop, receiver);
      return typeof val === 'function' ? val.bind(target) : val;
    },
  });
}

const mockSupabaseClient: any = {
  from: (table: string) => new LocalQueryBuilder(table),
  channel: (_name: string) => ({
    on: function () {
      return this;
    },
    subscribe: function () {
      return this;
    },
  }),
  removeChannel: () => {},
  auth: {
    getSession: async () => ({
      data: {
        session: {
          access_token: 'local-demo-token',
          user: { email: 'admin@flickbilet.com' },
        },
      },
      error: null,
    }),
    onAuthStateChange: (_cb: any) => ({
      data: {
        subscription: {
          unsubscribe: () => {},
        },
      },
    }),
    signInWithPassword: async ({ email }: { email: string }) => ({
      data: {
        session: {
          access_token: 'local-demo-token',
          user: { email },
        },
      },
      error: null,
    }),
    signOut: async () => ({ error: null }),
    signInWithOtp: async () => ({ data: {}, error: null }),
    verifyOtp: async () => ({ data: {}, error: null }),
    getUser: async () => ({
      data: { user: { email: 'admin@flickbilet.com' } },
      error: null,
    }),
  },
  storage: {
    from: (_bucket: string) => ({
      upload: async (path: string, file: File) => {
        if (typeof window !== 'undefined' && file) {
          uploadedBlobUrls[path] = URL.createObjectURL(file);
        }
        return { data: { path }, error: null };
      },
      getPublicUrl: (path: string) => ({
        data: {
          publicUrl: uploadedBlobUrls[path] || `https://placehold.co/600x400/0f172a/3b82f6?text=${encodeURIComponent(path)}`,
        },
      }),
    }),
  },
};

export const supabase = isSupabaseConfigured
  ? wrapClientWithReadOnlyGuard(createClient(supabaseUrl!, supabaseAnonKey!))
  : mockSupabaseClient;