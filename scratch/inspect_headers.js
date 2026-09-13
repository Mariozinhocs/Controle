const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'libs', 'xlsx.mini.min.js'));

const filePath = path.join(__dirname, '..', 'Lotes', 'lote ok (1).xlsx');
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

wb.SheetNames.forEach(sheetName => {
    if (sheetName === 'Planilha1') return;
    const sheet = wb.Sheets[sheetName];
    // Pegar linha de cabeçalho
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    console.log(`\n=== Aba "${sheetName}" ===`);
    console.log('Linha 0 (título):', rawRows[0]);
    console.log('Linha 1 (cabeçalhos):', rawRows[1]);
    console.log('Linha 2 (primeiro dado):', rawRows[2]);
});
