const fs = require('fs');
const path = require('path');
// Import local SheetJS from libs/xlsx.mini.min.js
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function inspectFile(filePath) {
    console.log('==================================================');
    console.log('FILE:', path.basename(filePath));
    const buf = fs.readFileSync(filePath);
    const wb = XLSX.read(buf, { type: 'buffer' });
    console.log('Sheet Names:', wb.SheetNames);

    wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n--- Sheet: [${sheetName}] | Rows: ${json.length} ---`);
        for (let i = 0; i < Math.min(15, json.length); i++) {
            console.log(`Row ${i}:`, json[i]);
        }
    });
}

inspectFile(file1);
inspectFile(file3);
