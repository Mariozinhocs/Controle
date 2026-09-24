const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const files = [
    path.join(__dirname, '../Lotes/lote ok (1).xlsx'),
    path.join(__dirname, 'backup_today_11-09-2026.xlsx')
];

files.forEach(filePath => {
    if (!fs.existsSync(filePath)) return;
    console.log('\n--- Prefixos em:', path.basename(filePath));
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    const prefixes = new Map();
    wb.SheetNames.forEach(sheetName => {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1 });
        rows.forEach((row) => {
            const rowStr = row.join(' ');
            const matches = rowStr.match(/(\d{10,18})(?:-(\d+))?/g);
            if (matches) {
                matches.forEach(m => {
                    const prefix = m.split('-')[0];
                    if (prefix.length >= 10) {
                        prefixes.set(prefix, (prefixes.get(prefix) || 0) + 1);
                    }
                });
            }
        });
    });
    console.log(Array.from(prefixes.entries()));
});
