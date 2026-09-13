const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const fileZip = path.join(__dirname, 'backup_today_11-09-2026.zip');
const filePath = path.join(__dirname, 'backup_today_11-09-2026.xlsx');

// Copy file to zip extension in current dir
fs.copyFileSync(filePath, fileZip);

const tempDir = path.join(__dirname, 'temp_xlsx_inspect');
if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
}
fs.mkdirSync(tempDir, { recursive: true });

try {
    // Use tar -xf or powershell Expand-Archive with escaped quotes
    execSync(`tar -xf "${fileZip}" -C "${tempDir}"`);
} catch (e) {
    console.error("tar error:", e.message);
}

// 1. Read sharedStrings
let sharedStrings = [];
const ssPath = path.join(tempDir, 'xl', 'sharedStrings.xml');
if (fs.existsSync(ssPath)) {
    const ssXml = fs.readFileSync(ssPath, 'utf8');
    const matches = ssXml.match(/<t[^>]*>(.*?)<\/t>/gs) || [];
    sharedStrings = matches.map(m => m.replace(/<[^>]+>/g, ''));
}

// Helper to extract value
function getVal(cXml) {
    const isShared = cXml.includes('t="s"');
    const vMatch = cXml.match(/<v>(.*?)<\/v>/);
    if (!vMatch) return '';
    const val = vMatch[1];
    if (isShared) {
        return sharedStrings[parseInt(val, 10)] || val;
    }
    return val;
}

// 2. Inspect Sheet 5 (Lançamentos)
const sheet5Path = path.join(tempDir, 'xl', 'worksheets', 'sheet5.xml');
let totalRows5 = 0;
let duplicates5 = [];
let seqsCountMap = {};

if (fs.existsSync(sheet5Path)) {
    const xmlStr = fs.readFileSync(sheet5Path, 'utf8');
    const rows = xmlStr.match(/<row r="\d+"[^>]*>.*?<\/row>/gs) || [];
    
    let headers = {};
    
    rows.forEach(rowXml => {
        const rMatch = rowXml.match(/row r="(\d+)"/);
        if (!rMatch) return;
        const rNum = parseInt(rMatch[1], 10);
        
        const cells = rowXml.match(/<c r="[A-Z]+\d+"[^>]*>(?:<v>.*?<\/v>)?<\/c>/gs) || [];
        
        if (rNum === 1) {
            cells.forEach(c => {
                const colMatch = c.match(/r="([A-Z]+)\d+"/);
                if (colMatch) {
                    headers[colMatch[1]] = getVal(c).trim();
                }
            });
        } else {
            totalRows5++;
            let seq = '';
            let id = '';
            let lote = '';
            
            cells.forEach(c => {
                const colMatch = c.match(/r="([A-Z]+)\d+"/);
                if (colMatch) {
                    const hName = headers[colMatch[1]] || '';
                    const val = getVal(c).trim();
                    if (hName === 'Nº da Requisição' || hName === 'inicioSeq' || hName === 'Nº Requisição') {
                        seq = val;
                    }
                    if (hName === 'ID' || hName === 'id') {
                        id = val;
                    }
                    if (hName === 'Lote' || hName === 'lote') {
                        lote = val;
                    }
                }
            });
            
            const key = seq || id || `row_${rNum}`;
            if (!seqsCountMap[key]) {
                seqsCountMap[key] = { count: 0, lote: lote, firstRow: rNum };
            }
            seqsCountMap[key].count++;
            if (seqsCountMap[key].count > 1) {
                duplicates5.push({ seq: key, lote: lote, row: rNum });
            }
        }
    });
}

// Cleanup zip and temp dir
if (fs.existsSync(fileZip)) fs.unlinkSync(fileZip);
if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });

console.log(JSON.stringify({
    total_lancamentos_sheet5: totalRows5,
    unique_sequencias_count: Object.keys(seqsCountMap).length,
    duplicados_count: duplicates5.length,
    amostra_duplicados: duplicates5.slice(0, 10)
}, null, 2));
