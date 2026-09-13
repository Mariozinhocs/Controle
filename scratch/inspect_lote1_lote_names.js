const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';

function inspectLote1Names() {
    const buf = fs.readFileSync(file1);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('INSPECTING ALL 280 ROWS IN LOTE 1.xlsx FOR LOTE VALUE & LITROS');

    const loteMap = {};
    let count15 = 0;
    let countOther = 0;

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;

        const seqStr = String(r[2]).trim();
        const base = r[4] ? String(r[4]).trim() : '';
        const resp = r[5] ? String(r[5]).trim() : '';
        const litros = parseFloat(r[10]) || 0;
        const loteCol = r[13] || r[14] || 'DEFAULT_LOTE_1';

        if (litros === 15) count15++;
        else countOther++;

        if (!loteMap[loteCol]) loteMap[loteCol] = 0;
        loteMap[loteCol]++;
    }

    console.log(`Rows with 15 Litros: ${count15}`);
    console.log(`Rows with non-15 Litros: ${countOther}`);
    console.log(`Lote Column Values:`, loteMap);
}

inspectLote1Names();
