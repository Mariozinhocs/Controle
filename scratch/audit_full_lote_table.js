/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, '../api/lotes_payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const blocks = [
  // LOTE 1
  { lote: 'LOTE 1', ctrl: '1786981045866', start: 1, end: 60, litros: 15 },
  { lote: 'LOTE 1', ctrl: '1786980886172', start: 1, end: 100, litros: 25 },
  { lote: 'LOTE 1', ctrl: '1786980942947', start: 1, end: 100, litros: 30 },
  { lote: 'LOTE 1', ctrl: '1786981005372', start: 1, end: 20, litros: 30 },

  // LOTE 2
  { lote: 'LOTE 2', ctrl: '1787069487718', start: 1, end: 50, litros: 20 },
  { lote: 'LOTE 2', ctrl: '1787069644788', start: 1, end: 33, litros: 30 },

  // LOTE 3
  { lote: 'LOTE 3', ctrl: '17875954044257', altCtrl: '1787595404425', start: 1, end: 66, litros: 15 },
  { lote: 'LOTE 3', ctrl: '1787595273786', start: 1, end: 100, litros: 20 },
  { lote: 'LOTE 3', ctrl: '1787595230092', start: 1, end: 100, litros: 20 },
  { lote: 'LOTE 3', ctrl: '1787595066974', start: 1, end: 100, litros: 30 },
  { lote: 'LOTE 3', ctrl: '1787595184138', start: 1, end: 67, litros: 30 },
  { lote: 'LOTE 3', ctrl: '1787595670733', start: 1, end: 100, litros: 50 },

  // LOTE 4
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

const stockSet = new Set();
(payload.custom_requisicoes || []).forEach(s => {
  const parts = s.split(' ');
  stockSet.add(parts[0].trim());
});

console.log('=== AUDITORIA COMPLETA DE LOTES (TABELA OFICIAL DO USUÁRIO) ===\n');

let grandTotal = 0;
let grandDist = 0;
let grandStock = 0;
const loteStats = {};

blocks.forEach(b => {
  const totalInBlock = b.end - b.start + 1;
  let distInBlock = 0;
  let stockInBlock = 0;
  
  for (let i = b.start; i <= b.end; i++) {
    const numPadded = String(i).padStart(3, '0');
    const seqPadded = `${b.ctrl}-${numPadded}`;
    const seqUnpadded = `${b.ctrl}-${i}`;
    const altPadded = b.altCtrl ? `${b.altCtrl}-${numPadded}` : null;
    const altUnpadded = b.altCtrl ? `${b.altCtrl}-${i}` : null;

    if (distSet.has(seqPadded) || distSet.has(seqUnpadded) || (altPadded && distSet.has(altPadded)) || (altUnpadded && distSet.has(altUnpadded))) {
      distInBlock++;
    } else if (stockSet.has(seqPadded) || stockSet.has(seqUnpadded) || (altPadded && stockSet.has(altPadded)) || (altUnpadded && stockSet.has(altUnpadded))) {
      stockInBlock++;
    }
  }

  const unassigned = totalInBlock - distInBlock - stockInBlock;
  grandTotal += totalInBlock;
  grandDist += distInBlock;
  grandStock += stockInBlock;

  if (!loteStats[b.lote]) {
    loteStats[b.lote] = { total: 0, dist: 0, stock: 0, unassigned: 0 };
  }
  loteStats[b.lote].total += totalInBlock;
  loteStats[b.lote].dist += distInBlock;
  loteStats[b.lote].stock += stockInBlock;
  loteStats[b.lote].unassigned += unassigned;

  console.log(`${b.lote.padEnd(6)} | Código: ${b.ctrl.padEnd(14)} | ${String(b.litros).padStart(2)}L | Total: ${String(totalInBlock).padStart(3)} | Distribuídas: ${String(distInBlock).padStart(3)} | Em Estoque Atual: ${String(stockInBlock).padStart(3)} | Não Distribuídas: ${String(unassigned).padStart(3)}`);
});

console.log('\n=== RESUMO POR LOTE ===');
Object.keys(loteStats).forEach(lName => {
  const s = loteStats[lName];
  console.log(`${lName.padEnd(6)} -> Total: ${String(s.total).padStart(4)} | Distribuídas: ${String(s.dist).padStart(4)} | Em Estoque Atual: ${String(s.stock).padStart(4)} | Restantes para Estoque: ${String(s.unassigned).padStart(4)}`);
});

console.log('\n===============================================================');
console.log(`TOTAL GERAL: ${grandTotal} requisições | Distribuídas: ${grandDist} | No Estoque Atual: ${grandStock} | Restantes para Estoque: ${grandTotal - grandDist - grandStock}`);
