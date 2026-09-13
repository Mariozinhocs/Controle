const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function inspectUndistributed() {
    const buf = fs.readFileSync(file3);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('NON-DISTRIBUTED ROWS IN LOTE 3:');

    const undistributed = [];

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;
        const seqStr = String(r[2]).trim();
        const base = r[4] ? String(r[4]).trim() : '';
        const resp = r[5] ? String(r[5]).trim() : '';

        if (base === '' && resp === '') {
            undistributed.push({
                rowIdx: i + 1, // 1-based row in Excel
                seqStr,
                qtd: r[3],
                posto: r[6],
                combustivel: r[9],
                litros: r[10],
                preco: r[11],
                valor: r[12]
            });
        }
    }

    console.log(`Total Non-Distributed Rows: ${undistributed.length}`);
    console.log('\nFirst 5 Non-Distributed Rows:');
    console.log(undistributed.slice(0, 5));
    console.log('\nLast 5 Non-Distributed Rows:');
    console.log(undistributed.slice(-5));
}

inspectUndistributed();
