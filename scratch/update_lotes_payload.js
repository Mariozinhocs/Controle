/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, '../api/lotes_payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const newStockTickets = [];

// Range 1: 1788275400861-027 to 067 (41 tickets)
for (let i = 27; i <= 67; i++) {
  const seq = String(i).padStart(3, '0');
  newStockTickets.push(`1788275400861-${seq} (LOTE 2)`);
}

// Range 2: 1788274896260-021 to 100 (80 tickets)
for (let i = 21; i <= 100; i++) {
  const seq = String(i).padStart(3, '0');
  newStockTickets.push(`1788274896260-${seq} (LOTE 2)`);
}

console.log('Total new tickets generated:', newStockTickets.length);
console.log('First Range 1 ticket:', newStockTickets[0]);
console.log('Last Range 1 ticket:', newStockTickets[40]);
console.log('First Range 2 ticket:', newStockTickets[41]);
console.log('Last Range 2 ticket:', newStockTickets[120]);

// Combine with existing custom_requisicoes
const existingPool = payload.custom_requisicoes || [];
const combinedSet = new Set(existingPool);
newStockTickets.forEach(ticket => combinedSet.add(ticket));

payload.custom_requisicoes = Array.from(combinedSet);

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('✅ lotes_payload.json successfully updated!');
console.log('Previous custom_requisicoes size:', existingPool.length);
console.log('New custom_requisicoes size:', payload.custom_requisicoes.length);
