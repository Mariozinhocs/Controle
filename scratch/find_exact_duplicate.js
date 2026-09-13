const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function findExactDuplicate() {
    const buf1 = fs.readFileSync(file1);
    const wb1 = XLSX.read(buf1, { type: 'buffer' });
    const rows1 = XLSX.utils.sheet_to_json(wb1.Sheets[wb1.SheetNames[0]], { header: 1 });

    const buf3 = fs.readFileSync(file3);
    const wb3 = XLSX.read(buf3, { type: 'buffer' });
    const rows3 = XLSX.utils.sheet_to_json(wb3.Sheets[wb3.SheetNames[0]], { header: 1 });

    console.log('==================================================');
    console.log('CHECKING ALL SEQUENCES IN LOTE 1 AND LOTE 3');

    const lote1Seqs = [];
    for (let i = 2; i < rows1.length; i++) {
        const r = rows1[i];
        if (r && r[2]) {
            lote1Seqs.push({ rowIdx: i + 1, seq: String(r[2]).trim(), litros: r[10], base: r[4], resp: r[5] });
        }
    }

    const lote3Seqs = [];
    for (let i = 2; i < rows3.length; i++) {
        const r = rows3[i];
        if (r && r[2]) {
            lote3Seqs.push({ rowIdx: i + 1, seq: String(r[2]).trim(), litros: r[10], base: r[4], resp: r[5] });
        }
    }

    console.log(`Lote 1 total valid rows: ${lote1Seqs.length}`);
    console.log(`Lote 3 total valid rows: ${lote3Seqs.length}`);

    // Check duplicates inside Lote 1
    const set1 = new Set();
    const dups1 = [];
    lote1Seqs.forEach(item => {
        if (set1.has(item.seq)) dups1.push(item);
        else set1.add(item.seq);
    });

    console.log(`Duplicates INSIDE Lote 1:`, dups1);

    // Check duplicates between Lote 1 and Lote 3
    const crossDups = [];
    lote1Seqs.forEach(item1 => {
        const match3 = lote3Seqs.find(item3 => item3.seq === item1.seq);
        if (match3) {
            crossDups.push({ lote1: item1, lote3: match3 });
        }
    });

    console.log(`Cross-Duplicates between Lote 1 and Lote 3:`, crossDups);
}

findExactDuplicate();
