import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envContent = fs.readFileSync(path.resolve('.env.local'), 'utf-8');
const supabaseUrl = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)?.[1]?.trim();
const supabaseKey = envContent.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/)?.[1]?.trim();

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  const { data, error } = await supabase.from('biletler').select('*').limit(1);
  console.log('biletler tablosu durumu:', { exists: !error, error: error?.message });
  
  const { data: mData, error: mError } = await supabase.from('uyeler').select('*').limit(1);
  console.log('uyeler tablosu durumu:', { exists: !mError, error: mError?.message });
}

check();
