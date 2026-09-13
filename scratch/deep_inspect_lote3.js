const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function deepInspectLote3() {
    const buf = fs.readFileSync(file3);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    console.log('==================================================');
    console.log('DEEP INSPECTION OF LOTE 3');

    const prefixMap = {};
    let totalLitrosDistributed = 0;

    for (let i = 2; i < rows.length; i++) {
        const r = rows[i];
        if (!r || !r[2]) continue;
        const seqStr = String(r[2]).trim();
        const parts = seqStr.split('-');
        if (parts.length === 2) {
            const prefix = parts[0];
            const num = parseInt(parts[1]);
            const litros = parseFloat(r[10]) || 0;
            const base = r[4] ? String(r[4]).trim() : '';
            const resp = r[5] ? String(r[5]).trim() : '';
            const isDistributed = (base !== '' || resp !== '');

            totalLitrosDistributed += litros;

            if (!prefixMap[prefix]) {
                prefixMap[prefix] = {
                    count: 0,
                    minNum: Infinity,
                    maxNum: -Infinity,
                    litros: litros,
                    combustivel: r[9],
                    distributedCount: 0,
                    nonDistributedCount: 0
                };
            }
            prefixMap[prefix].count++;
            if (num < prefixMap[prefix].minNum) prefixMap[prefix].minNum = num;
            if (num > prefixMap[prefix].maxNum) prefixMap[prefix].maxNum = num;
            if (isDistributed) {
                prefixMap[prefix].distributedCount++;
            } else {
                prefixMap[prefix].nonDistributedCount++;
            }
        }
    }

    console.log('Total Litros Distributed in sheet rows:', totalLitrosDistributed);
    console.log('\nPrefixes in LOTE 3:');
    console.dir(prefixMap, { depth: null });
}

deepInspectLote3();
