const fs = require('fs');

const payload = JSON.parse(fs.readFileSync('api/lotes_payload.json', 'utf8'));

console.log('Total requisicoes in payload:', payload.requisicoes.length);

const lote1Items = payload.requisicoes.filter(r => r.lote === 'LOTE 1');
const lote3Items = payload.requisicoes.filter(r => r.lote === 'LOTE 3');

console.log('LOTE 1 items in payload:', lote1Items.length);
console.log('LOTE 3 items in payload:', lote3Items.length);

const sumLote1Litros = lote1Items.reduce((a, b) => a + (b.litros || 0), 0);
const sumLote3Litros = lote3Items.reduce((a, b) => a + (b.litros || 0), 0);

console.log('Sum LOTE 1 Litros in payload:', sumLote1Litros);
console.log('Sum LOTE 3 Litros in payload:', sumLote3Litros);

// Check if any inicioSeq is duplicated in payload
const seqMap = {};
payload.requisicoes.forEach((r, idx) => {
    if (seqMap[r.inicioSeq]) {
        console.log(`DUPLICATE INICIOSEQ IN PAYLOAD: ${r.inicioSeq} at idx ${idx} and ${seqMap[r.inicioSeq]}`);
    } else {
        seqMap[r.inicioSeq] = idx;
    }
});
