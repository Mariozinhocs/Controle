const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'libs', 'xlsx.mini.min.js'));

const filePath = path.join(__dirname, '..', 'Lotes', 'lote ok (1).xlsx');
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

const sheet = wb.Sheets['LOTE 02 2K'];
const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log(`Total de linhas brutas em LOTE 02 2K: ${rows.length}`);
rows.forEach((r, idx) => {
    // se a linha tiver mais de 2 elementos não nulos
    const nonNulls = (r || []).filter(x => x !== undefined && x !== null && x !== '');
    if (nonNulls.length > 2) {
        console.log(`Linha ${idx}:`, r);
    }
});
