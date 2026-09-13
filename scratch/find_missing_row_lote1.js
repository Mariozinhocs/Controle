const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';

function findMissingRow() {
    const buf = fs.readFileSync(file1);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('INSPECTING ALL ROWS IN LOTE 1.xlsx');
    console.log('Total Rows in Sheet:', rows.length);

    let count = 0;
    let sumLitros = 0;
    const items = [];

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) {
            console.log(`Row ${i + 1} (1-indexed) is empty or missing sequence:`, r);
            continue;
        }

        const seqStr = String(r[2]).trim();
        const base = r[4] ? String(r[4]).trim() : '';
        const resp = r[5] ? String(r[5]).trim() : '';
        const litros = parseFloat(r[10]) || 0;

        count++;
        sumLitros += litros;
        items.push({ rowIdx: i + 1, seqStr, base, resp, litros });
    }

    console.log(`\nTotal Valid Rows with Sequence: ${count}`);
    console.log(`Total Litros Summed: ${sumLitros}`);

    // Check for duplicate sequence numbers in LOTE 1
    const seqCounts = {};
    items.forEach(it => {
        seqCounts[it.seqStr] = (seqCounts[it.seqStr] || 0) + 1;
    });

    const duplicates = Object.keys(seqCounts).filter(s => seqCounts[s] > 1);
    console.log('\nDuplicates in LOTE 1 Excel file:', duplicates);
    duplicates.forEach(d => {
        console.log(`Seq ${d} appears ${seqCounts[d]} times:`, items.filter(it => it.seqStr === d));
    });
}

findMissingRow();
