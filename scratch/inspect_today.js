const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const filePath = path.join(__dirname, 'backup_today_11-09-2026.xlsx');
const stats = fs.statSync(filePath);

console.log(JSON.stringify({
    file: path.basename(filePath),
    size_bytes: stats.size,
    size_mb: (stats.size / (1024 * 1024)).toFixed(2),
    mtime: stats.mtime.toLocaleString('pt-BR')
}, null, 2));
