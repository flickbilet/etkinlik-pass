import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tgghxvnfmcmgrvdsmyvs.supabase.co',
  'sb_publishable_28tjrDsQmAtbs1fBlqSLRQ_k-cFaTTc'
);

async function checkState() {
  const tables = ['katilimcilar', 'katilimcilar_yeni', 'katilimcilar_legacy', 'katilimcilar_eski_temp', 'biletler'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('*').limit(1);
    console.log(`Table ${t}:`, error ? `ERROR: ${error.message}` : `EXISTS (sample: ${JSON.stringify(data?.[0]?.id)})`);
  }
}

checkState();
