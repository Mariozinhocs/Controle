const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'libs', 'xlsx.mini.min.js'));

const filePath = path.join(__dirname, '..', 'Lotes', 'lote ok (1).xlsx');
if (!fs.existsSync(filePath)) {
    console.error('Arquivo Excel não encontrado!');
    process.exit(1);
}

const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

console.log('Abas encontradas na planilha:', wb.SheetNames);

wb.SheetNames.forEach(sheetName => {
    const sheet = wb.Sheets[sheetName];
    const json = XLSX.utils.sheet_to_json(sheet);
    console.log(`\nAba: "${sheetName}" - Total de linhas lidas: ${json.length}`);
    if (json.length > 0) {
        console.log('Colunas:', Object.keys(json[0]));
        console.log('Exemplo 1ª linha:', json[0]);
    }
});
