const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function analyzeFile(filePath, label) {
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\n==================================================`);
    console.log(`ANALYSIS OF ${label} (${filePath})`);
    console.log(`Total Rows: ${rows.length}`);

    let distributed = 0;
    let nonDistributed = 0;
    let emptyRows = 0;

    const sampleDistributed = [];
    const sampleNonDistributed = [];

    // Row 0 is title, Row 1 is header
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || r.length === 0 || (r.length === 1 && !r[0])) {
            emptyRows++;
            continue;
        }

        const seq = r[2]; // LOTE Sequence
        const base = r[4];
        const resp = r[5];
        const dateVal = r[1];

        const hasBaseOrRespOrDate = (base && String(base).trim() !== '') || (resp && String(resp).trim() !== '') || (dateVal && String(dateVal).trim() !== '');

        if (hasBaseOrRespOrDate) {
            distributed++;
            if (sampleDistributed.length < 5) sampleDistributed.push({ rowIdx: i, seq, base, resp, dateVal, litros: r[10] });
        } else {
            nonDistributed++;
            if (sampleNonDistributed.length < 10) sampleNonDistributed.push({ rowIdx: i, seq, base, resp, dateVal, litros: r[10] });
        }
    }

    console.log(`Distributed Rows (with Base/Resp/Date): ${distributed}`);
    console.log(`Non-Distributed Rows (Empty Base/Resp/Date): ${nonDistributed}`);
    console.log(`Empty Rows: ${emptyRows}`);

    console.log(`\nSample Distributed Rows:`, sampleDistributed);
    console.log(`\nSample Non-Distributed Rows:`, sampleNonDistributed);
}

analyzeFile(file1, 'LOTE 1');
analyzeFile(file3, 'LOTE 3');
