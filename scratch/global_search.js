const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        let isDirectory = fs.statSync(dirPath).isDirectory();
        if (f === 'node_modules' || f === '.git') return;
        if (isDirectory) {
            walkDir(dirPath, callback);
        } else {
            callback(dirPath);
        }
    });
}

const root = path.join(__dirname, '..');
let found = [];
walkDir(root, (filePath) => {
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        if (content.includes('1789771755740') || content.includes('178977') || content.includes('755740')) {
            found.push(filePath);
        }
    } catch(e) {}
});

console.log('Resultados da busca global:', found);
