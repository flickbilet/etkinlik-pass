import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function verify() {
  console.log('--- VERİTABANI DURUM KONTROLÜ ---');
  
  const { data: bData, error: bErr } = await supabase.from('biletler').select('*', { count: 'exact', head: true });
  const { data: kData, error: kErr } = await supabase.from('katilimcilar').select('*', { count: 'exact', head: true });
  
  console.log('biletler tablosu:', bErr ? `Erişilemedi (${bErr.message})` : `Aktif`);
  console.log('katilimcilar tablosu:', kErr ? `Erişilemedi (${kErr.message})` : `Aktif`);

  if (!bErr && !kErr) {
    const { data: sampleTicket } = await supabase.from('biletler').select('*').limit(1);
    const { data: sampleKatilimci } = await supabase.from('katilimcilar').select('*').limit(1);
    console.log('\nÖrnek Bilet Kolonları:', sampleTicket?.[0] ? Object.keys(sampleTicket[0]) : 'Boş');
    console.log('Örnek Katılımcı Kolonları:', sampleKatilimci?.[0] ? Object.keys(sampleKatilimci[0]) : 'Boş');
  }
}

verify();
