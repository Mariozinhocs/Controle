/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');

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

console.log('=== DETALHAMENTO DE LINHAS DA PLANILHA LOTE 4.xlsx ===\n');

const unassigned = [];
const assignedByBlock = {};

rawRows.forEach((r, idx) => {
    const seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || '');
    const base = (r['Base'] || '').toString().trim();
    const resp = (r['Responsável'] || '').toString().trim();
    const litros = parseFloat(r['Litros']) || 0;

    if (!seq) return;

    const ctrl = seq.split('-')[0];
    if (!assignedByBlock[ctrl]) {
        assignedByBlock[ctrl] = { total: 0, assigned: 0, unassigned: 0, litros: litros };
    }
    assignedByBlock[ctrl].total++;

    if (!base || base === 'NÃO INFORMADO' || base.toLowerCase().includes('não informado') || !resp || resp === 'NÃO INFORMADO' || resp.toLowerCase().includes('não informado')) {
        unassigned.push({ line: idx + 2, seq, litros, base, resp });
        assignedByBlock[ctrl].unassigned++;
    } else {
        assignedByBlock[ctrl].assigned++;
    }
});

console.log('Resumo de Distribuição vs Disponíveis em LOTE 4.xlsx por Código:');
Object.keys(assignedByBlock).forEach(ctrl => {
    const b = assignedByBlock[ctrl];
    console.log(`Código ${ctrl} (${b.litros}L): Total = ${b.total} | Distribuídos (com Base/Resp) = ${b.assigned} | DISPONÍVEIS (Sem Base/Resp) = ${b.unassigned}`);
});

console.log(`\nTotal de requisições SEM distribuição (disponíveis no estoque) na planilha LOTE 4.xlsx: ${unassigned.length}`);
if (unassigned.length > 0) {
    console.log('\nLista de requisições disponíveis em LOTE 4.xlsx:');
    unassigned.forEach(u => {
        console.log(` Linha ${u.line}: Sequência ${u.seq} (${u.litros}L) - Base: '${u.base}', Responsável: '${u.resp}'`);
    });
}
