const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function inspectSequences(filePath, label) {
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheetName = wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log(`\n==================================================`);
    console.log(`SEQUENCES IN ${label}`);

    const seqNums = [];
    const fullSeqs = [];

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;
        const rawSeq = String(r[2]).trim();
        fullSeqs.push(rawSeq);
        // Ex: "17875954044257-1" -> num 1
        const parts = rawSeq.split('-');
        if (parts.length === 2) {
            const num = parseInt(parts[1]);
            if (!isNaN(num)) seqNums.push(num);
        }
    }

    seqNums.sort((a, b) => a - b);
    console.log(`Total Sequences Found: ${fullSeqs.length}`);
    if (seqNums.length > 0) {
        console.log(`Min Sequence Number: ${seqNums[0]}`);
        console.log(`Max Sequence Number: ${seqNums[seqNums.length - 1]}`);
        console.log(`Prefix Example: ${fullSeqs[0]}`);
    }

    // Check last 5 rows of sheet
    console.log(`\nLast 5 rows of sheet:`);
    for (let i = Math.max(0, rows.length - 5); i < rows.length; i++) {
        console.log(`Row ${i}:`, rows[i]);
    }
}

inspectSequences(file1, 'LOTE 1');
inspectSequences(file3, 'LOTE 3');
