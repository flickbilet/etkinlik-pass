import fs from 'fs';

const rawData = JSON.parse(fs.readFileSync('backups/backup_2026-10-31T16-19-27-552Z/katilimcilar.json'));

const phoneToMember = new Map();
let nextMemberId = 1;

// 1. Tekil katılımcıları çıkar
for (const row of rawData) {
  const tel = String(row.telefon || '').trim();
  if (!tel) continue;
  
  if (!phoneToMember.has(tel)) {
    phoneToMember.set(tel, {
      id: nextMemberId++,
      telefon: tel,
      ad_soyad: (row.ad_soyad || '').trim(),
      email: (row.email || '').trim(),
      okul: (row.okul || '').trim(),
      referans: (row.referans || '').trim(),
      kayit_sayisi: 1
    });
  } else {
    const existing = phoneToMember.get(tel);
    existing.kayit_sayisi += 1;
    // Eğer önceki kayıtta okul veya email boşsa güncelle
    if (!existing.email && row.email) existing.email = row.email.trim();
    if (!existing.okul && row.okul) existing.okul = row.okul.trim();
  }
}

const members = Array.from(phoneToMember.values());

// 2. Biletleri eşle
const tickets = rawData.map(row => {
  const tel = String(row.telefon || '').trim();
  const member = phoneToMember.get(tel);
  return {
    id: row.id,
    etkinlik_id: row.etkinlik_id,
    katilimci_id: member ? member.id : null,
    koltuk_no: row.koltuk_no,
    qr_kodu: row.qr_kodu,
    onayli_mi: row.onayli_mi,
    geldi_mi: row.geldi_mi,
    bilet_alindi_mi: row.bilet_alindi_mi,
    dekont_url: row.dekont_url
  };
});

console.log('--- SİMÜLASYON RAPORU ---');
console.log('Toplam Orijinal Kayıt:', rawData.length);
console.log('Oluşturulan Tekil Katılımcı (Üye) Sayısı:', members.length);
console.log('Oluşturulan Bilet Sayısı:', tickets.length);
console.log('Çoklu Etkinliğe Katılan Kişi Sayısı:', members.filter(m => m.kayit_sayisi > 1).length);
console.log('\nÖrnek Katılımcı:', members[0]);
console.log('\nÖrnek Bilet:', tickets[0]);
