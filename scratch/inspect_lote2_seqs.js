const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'libs', 'xlsx.mini.min.js'));

const filePath = path.join(__dirname, '..', 'Lotes', 'lote ok (1).xlsx');
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

const sheet = wb.Sheets['LOTE 02 2K'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Linhas 0 a 10 de LOTE 02 2K:');
rows.slice(0, 10).forEach((r, idx) => console.log(`[${idx}]:`, r));
