const fs = require('fs');
const path = require('path');

const fileContent = fs.readFileSync(path.join(__dirname, 'prod_app_v70.js'), 'utf8');

try {
    new Function(fileContent);
    console.log("SUCCESS: Syntax is 100% valid!");
} catch (e) {
    console.error("SYNTAX ERROR FOUND:", e.message);
    console.error(e.stack);
}
