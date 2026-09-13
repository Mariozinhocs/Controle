const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function inspectFile(filePath) {
    console.log('==================================================');
    console.log('FILE:', path.basename(filePath));
    const wb = XLSX.readFile(filePath);
    console.log('Sheets:', wb.SheetNames);

    wb.SheetNames.forEach(sheetName => {
        const sheet = wb.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`--- Sheet: [${sheetName}] | Rows: ${json.length} ---`);
        if (json.length > 0) {
            console.log('Header (Row 0):', json[0]);
            console.log('Sample Row 1:', json[1]);
            console.log('Sample Row 2:', json[2]);
        }
    });
}

inspectFile(file1);
inspectFile(file3);
