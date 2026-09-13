/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const xlsxPath = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 4.xlsx';

if (!fs.existsSync(xlsxPath)) {
  console.error('Arquivo não encontrado:', xlsxPath);
  process.exit(1);
}

const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('=== PLANILHA LOTE 4.xlsx ===');
console.log('Abas encontradas:', wb.SheetNames);

wb.SheetNames.forEach((sheetName, index) => {
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`\nAba [${index}] '${sheetName}': Total de linhas = ${json.length}`);
  if (json.length > 0) {
    console.log(' Primeiras 10 linhas:');
    json.slice(0, 10).forEach((r, i) => console.log(`  Linha ${i + 1}:`, r));
  }
});
