/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const xlsxPath = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 4.xlsx';
const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer' });

function cleanSeq(raw) {
    if (!raw) return '';
    const str = String(raw).trim().replace(/\s+/g, '');
    const parts = str.split('-');
    if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
            return `${parts[0]}-${String(num).padStart(3, '0')}`;
        }
    }
    return str;
}

const rawRows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { range: 1 });

const xlsxSeqs = new Set();
rawRows.forEach(r => {
    const seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || '');
    if (seq) xlsxSeqs.add(seq);
});

const lote4Blocks = [
  { ctrl: '1788275751235', start: 1, end: 66, litros: 15 },
  { ctrl: '1788275524001', start: 1, end: 100, litros: 20 },
  { ctrl: '1788275566848', start: 1, end: 100, litros: 20 },
  { ctrl: '1788275438090', start: 1, end: 100, litros: 30 },
  { ctrl: '1788275400861', start: 1, end: 67, litros: 30 },
  { ctrl: '1788274896260', start: 1, end: 100, litros: 50 }
];

console.log('=== AUDITORIA DE LACUNAS (GAPS) EM LOTE 4.xlsx ===\n');

lote4Blocks.forEach(b => {
  const present = [];
  const missing = [];
  
  for (let i = b.start; i <= b.end; i++) {
    const seqPadded = `${b.ctrl}-${String(i).padStart(3, '0')}`;
    const seqUnpadded = `${b.ctrl}-${i}`;

    if (xlsxSeqs.has(seqPadded) || xlsxSeqs.has(seqUnpadded)) {
      present.push(i);
    } else {
      missing.push(i);
    }
  }

  console.log(`Bloco ${b.ctrl} (${b.litros}L): Total = ${b.end - b.start + 1} | Presentes na Planilha = ${present.length} | FALTANDO (NÃO DISTRIBUÍDOS) = ${missing.length}`);
  if (missing.length > 0) {
    const firstMiss = String(missing[0]).padStart(3, '0');
    const lastMiss = String(missing[missing.length - 1]).padStart(3, '0');
    console.log(` -> Faixa não distribuída (Estoque): ${b.ctrl}-${firstMiss} até ${b.ctrl}-${lastMiss} (${missing.length} requisições de ${b.litros}L)`);
  }
});
