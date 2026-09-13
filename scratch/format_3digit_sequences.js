/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, '../api/lotes_payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

function formatSeq(seq) {
  if (!seq) return seq;
  const parts = seq.toString().trim().split('-');
  if (parts.length === 2) {
    const num = parseInt(parts[1], 10);
    if (!isNaN(num)) {
      return `${parts[0]}-${String(num).padStart(3, '0')}`;
    }
  }
  return seq;
}

let changedInicio = 0;
let changedFim = 0;

payload.requisicoes.forEach(r => {
  const newIni = formatSeq(r.inicioSeq);
  const newFim = formatSeq(r.fimSeq);
  if (newIni !== r.inicioSeq) {
    changedInicio++;
    r.inicioSeq = newIni;
  }
  if (newFim !== r.fimSeq) {
    changedFim++;
    r.fimSeq = newFim;
  }
});

let changedStock = 0;
payload.custom_requisicoes = (payload.custom_requisicoes || []).map(s => {
  const parts = s.split(' ');
  const seqPart = parts[0];
  const formatted = formatSeq(seqPart);
  if (formatted !== seqPart) {
    changedStock++;
    parts[0] = formatted;
    return parts.join(' ');
  }
  return s;
});

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('=== PADRONIZAÇÃO DE 3 DÍGITOS CONCLUÍDA ===');
console.log('Novas inicioSeq formatadas para 3 dígitos:', changedInicio);
console.log('Novas fimSeq formatadas para 3 dígitos:', changedFim);
console.log('Novas custom_requisicoes formatadas para 3 dígitos:', changedStock);
console.log('\nAmostras de requisições distribuídas formatadas:');
console.log('Sample 1:', payload.requisicoes[0].inicioSeq);
console.log('Sample 2:', payload.requisicoes[1].inicioSeq);
console.log('\nAmostras de estoque formatadas:');
console.log('Sample Stock 1:', payload.custom_requisicoes[0]);
console.log('Sample Stock 2:', payload.custom_requisicoes[1]);
