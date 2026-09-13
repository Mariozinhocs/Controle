/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, '../api/lotes_payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const blocks = [
  // LOTE 2 (83 tickets)
  { lote: 'LOTE 2', ctrl: '1787069487718', start: 1, end: 50, litros: 20 },
  { lote: 'LOTE 2', ctrl: '1787069644788', start: 1, end: 33, litros: 30 },

  // LOTE 3 remaining stock (26 tickets: 75 to 100 on 1787595670733)
  { lote: 'LOTE 3', ctrl: '1787595670733', start: 75, end: 100, litros: 50 },

  // LOTE 4 (533 tickets)
  { lote: 'LOTE 4', ctrl: '1788275751235', start: 1, end: 66, litros: 15 },
  { lote: 'LOTE 4', ctrl: '1788275524001', start: 1, end: 100, litros: 20 },
  { lote: 'LOTE 4', ctrl: '1788275566848', start: 1, end: 100, litros: 20 },
  { lote: 'LOTE 4', ctrl: '1788275438090', start: 1, end: 100, litros: 30 },
  { lote: 'LOTE 4', ctrl: '1788275400861', start: 1, end: 67, litros: 30 },
  { lote: 'LOTE 4', ctrl: '1788274896260', start: 1, end: 100, litros: 50 }
];

const distSet = new Set();
payload.requisicoes.forEach(r => {
  if (r.inicioSeq) distSet.add(r.inicioSeq.trim());
});

const stockTickets = [];
const loteCounts = {};

blocks.forEach(b => {
  for (let i = b.start; i <= b.end; i++) {
    const seqPadded = `${b.ctrl}-${String(i).padStart(3, '0')}`;
    const seqUnpadded = `${b.ctrl}-${i}`;

    // Ensure it was not already distributed in launch records
    if (!distSet.has(seqPadded) && !distSet.has(seqUnpadded)) {
      const ticketStr = `${seqPadded} - ${b.litros}L (${b.lote})`;
      stockTickets.push(ticketStr);
      loteCounts[b.lote] = (loteCounts[b.lote] || 0) + 1;
    }
  }
});

payload.custom_requisicoes = stockTickets;

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('=== GERAÇÃO DE ESTOQUE COMPLETA ===');
console.log('Total de tickets em estoque gerados:', stockTickets.length);
console.log('Detalhamento por Lote no Estoque:', loteCounts);
console.log('\nAmostras por lote:');
console.log('LOTE 2 sample:', stockTickets.find(s => s.includes('LOTE 2')));
console.log('LOTE 3 sample:', stockTickets.find(s => s.includes('LOTE 3')));
console.log('LOTE 4 sample:', stockTickets.find(s => s.includes('LOTE 4')));
