-- ============================================================================
-- FLICK BİLET: BİLET & KATILIMCI AYRIMI (GÜVENLİ & HIZLI MİGRASYON)
-- ============================================================================

-- 1. Güvenlik için mevcut tablonun tam bir veritabanı yedeğini alalım
CREATE TABLE IF NOT EXISTS public.katilimcilar_legacy AS 
SELECT * FROM public.katilimcilar;

-- 2. Katılımcılar tablosuna is_banned sütununu ekleyelim
ALTER TABLE public.katilimcilar ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT false;

-- 3. Biletler (Etkinlik Kayıtları & Dekontlar) tablosunu oluşturalım
CREATE TABLE IF NOT EXISTS public.biletler (
    id BIGSERIAL PRIMARY KEY,
    etkinlik_id BIGINT NOT NULL,
    katilimci_id BIGINT NOT NULL,
    koltuk_no TEXT,
    qr_kodu TEXT UNIQUE,
    onayli_mi BOOLEAN DEFAULT false,
    geldi_mi BOOLEAN DEFAULT false,
    bilet_alindi_mi BOOLEAN DEFAULT false,
    dekont_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Mevcut katılımcıların bilet kayıtlarını biletler tablosuna aktaralım
INSERT INTO public.biletler (id, etkinlik_id, katilimci_id, koltuk_no, qr_kodu, onayli_mi, geldi_mi, bilet_alindi_mi, dekont_url, created_at)
SELECT 
    k.id,
    k.etkinlik_id,
    k.id AS katilimci_id,
    k.koltuk_no,
    k.qr_kodu,
    COALESCE(k.onayli_mi, false),
    COALESCE(k.geldi_mi, false),
    COALESCE(k.bilet_alindi_mi, false),
    k.dekont_url,
    now()
FROM public.katilimcilar k
ON CONFLICT (id) DO NOTHING;

-- 5. Biletler tablosunun ID sayacını en yüksek değere eşitleyelim
SELECT setval('public.biletler_id_seq', COALESCE((SELECT MAX(id) FROM public.biletler), 1));

-- 6. Performans İndeksleri
CREATE INDEX IF NOT EXISTS idx_katilimcilar_telefon ON public.katilimcilar(telefon);
CREATE INDEX IF NOT EXISTS idx_biletler_etkinlik ON public.biletler(etkinlik_id);
CREATE INDEX IF NOT EXISTS idx_biletler_katilimci ON public.biletler(katilimci_id);
CREATE INDEX IF NOT EXISTS idx_biletler_qr ON public.biletler(qr_kodu);

-- 7. Güvenlik İzinleri (RLS Politikaları)
ALTER TABLE public.katilimcilar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.biletler ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Katilimcilar tam erisim" ON public.katilimcilar;
CREATE POLICY "Katilimcilar tam erisim" 
ON public.katilimcilar FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Biletler tam erisim" ON public.biletler;
CREATE POLICY "Biletler tam erisim" 
ON public.biletler FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- 8. Sonuç Özeti
SELECT 
    (SELECT COUNT(*) FROM public.katilimcilar) AS toplam_katilimci,
    (SELECT COUNT(*) FROM public.biletler) AS toplam_bilet_kaydi,
    (SELECT COUNT(*) FROM public.katilimcilar_legacy) AS eski_yedek_kayit_sayisi;
