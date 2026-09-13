const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';

function findMissing15LTicket() {
    const buf = fs.readFileSync(file1);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('ALL 15L TICKETS IN LOTE 1.xlsx:');

    const tickets15 = [];
    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;
        const litros = parseFloat(r[10]);
        if (litros === 15) {
            tickets15.push({ rowIdx: i + 1, seqStr: String(r[2]).trim(), base: r[4], resp: r[5] });
        }
    }

    console.log(`Total 15L tickets count: ${tickets15.length}`);

    // Check duplicate sequence strings among 15L tickets
    const map = {};
    tickets15.forEach(t => {
        if (map[t.seqStr]) {
            console.log('FOUND DUPLICATE 15L TICKET IN EXCEL FILE:', t.seqStr, 'at row', t.rowIdx, 'and row', map[t.seqStr].rowIdx);
        } else {
            map[t.seqStr] = t;
        }
    });

    console.log('\nList of all 15L sequence strings:');
    console.log(tickets15.map(t => t.seqStr));
}

findMissing15LTicket();
