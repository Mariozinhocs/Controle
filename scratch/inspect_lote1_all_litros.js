const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';

function inspectLote1AllLitros() {
    const buf = fs.readFileSync(file1);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('INSPECTING ALL LITROS IN LOTE 1.xlsx');

    const litrosBreakdown = {};
    let totalLitros = 0;
    let totalCount = 0;

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;

        const seqStr = String(r[2]).trim();
        const litros = parseFloat(r[10]);

        totalCount++;
        if (isNaN(litros)) {
            console.log(`Row ${i + 1} has NaN litros:`, r);
        } else {
            totalLitros += litros;
            litrosBreakdown[litros] = (litrosBreakdown[litros] || 0) + 1;
        }
    }

    console.log(`Total Valid Rows: ${totalCount}`);
    console.log(`Total Sum of Litros: ${totalLitros}`);
    console.log(`Litros Breakdown:`, litrosBreakdown);
}

inspectLote1AllLitros();
