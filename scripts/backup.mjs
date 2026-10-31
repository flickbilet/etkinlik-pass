import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// .env.local dosyasını oku
const envPath = path.resolve('.env.local');
let supabaseUrl = '';
let supabaseKey = '';

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = trimmed.split('=')[1]?.trim();
    }
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseKey = trimmed.split('=')[1]?.trim();
    }
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.error('Supabase kimlik bilgileri bulunamadı!');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const TABLES = ['etkinlik_ayarlari', 'katilimcilar', 'surveys', 'survey_options'];

async function backup() {
  const backupDir = path.resolve('backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sessionDir = path.join(backupDir, `backup_${timestamp}`);
  fs.mkdirSync(sessionDir, { recursive: true });

  const summary = {};
  const workbook = XLSX.utils.book_new();

  for (const table of TABLES) {
    console.log(`Tablo çekiliyor: ${table}...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.error(`Hata (${table}):`, error.message);
      summary[table] = { status: 'error', error: error.message };
    } else {
      const count = data ? data.length : 0;
      console.log(`  -> ${count} kayıt bulundu.`);
      
      // JSON olarak kaydet
      const jsonPath = path.join(sessionDir, `${table}.json`);
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf-8');
      
      // Excel sayfası olarak ekle
      if (data && data.length > 0) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, table);
      } else {
        const worksheet = XLSX.utils.json_to_sheet([{}]);
        XLSX.utils.book_append_sheet(workbook, worksheet, table);
      }

      summary[table] = { status: 'ok', count, json: jsonPath };
    }
  }

  // Excel (.xlsx) dosyasını tek bir dosya olarak kaydet
  const excelPath = path.join(sessionDir, 'flick_veritabani_tam_yedek.xlsx');
  XLSX.writeFile(workbook, excelPath);
  summary['excel_export'] = excelPath;

  fs.writeFileSync(path.join(sessionDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf-8');

  console.log('\n=============================================');
  console.log('✅ YEDEKLEME KUSURSUZ TAMAMLANDI!');
  console.log('📁 Klasör:', sessionDir);
  console.log('📊 Excel Yedeği:', excelPath);
  console.log('=============================================\n');
}

backup();
