import fs from 'fs';

const data = JSON.parse(fs.readFileSync('backups/backup_2026-10-31T16-19-27-552Z/katilimcilar.json'));
console.log('Sample row from katilimcilar:');
console.log(JSON.stringify(data[0], null, 2));

const allColumns = new Set();
data.forEach(row => Object.keys(row).forEach(k => allColumns.add(k)));
console.log('\nAll unique columns:', Array.from(allColumns));
