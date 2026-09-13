/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const xlsxPath = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 4.xlsx';
const payloadPath = path.join(__dirname, '../api/lotes_payload.json');

const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer' });
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

function excelDateToDateStr(val) {
    if (!val) return '2026-08-27';
    if (typeof val === 'number') {
        const d = XLSX.SSF.parse_date_code(val);
        if (d) {
            const yyyy = d.y;
            const mm = String(d.m).padStart(2, '0');
            const dd = String(d.d).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        }
    }
    const str = String(val).trim();
    const parts = str.split('/');
    if (parts.length === 3) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return '2026-08-27';
}

function cleanSeq(raw) {
    if (!raw) return '';
    const str = String(raw).trim().replace(/\s+/g, '');
    const parts = str.split('-');
    if (parts.length === 2) {
        const num = parseInt(parts[1], 10);
        if (!isNaN(num)) {
            return `${parts[0]}-${String(num).padStart(3, '0')}`;
        }
    }
    return str;
}

function cleanBaseName(raw) {
    if (!raw) return 'NÃO INFORMADO';
    let str = raw.toString().trim();
    if (str.includes(' - ')) str = str.split(' - ')[0].trim();
    str = str.replace(/^Base\s*-\s*/i, '');
    if (str === 'CENTRAL ' || str === 'CENTRAL') return 'CENTRAL';
    if (str === 'CENTRO-SUL1' || str === 'CENTRO-SUL 1') return 'CENTRO-SUL 1';
    if (str === 'CENTRO-SUL2' || str === 'CENTRO-SUL 2') return 'CENTRO-SUL 2';
    return str.trim();
}

const rawRows = XLSX.utils.sheet_to_json(wb.Sheets['Sheet1'], { range: 1 });

const distributedLote4 = [];
const stockLote4Seqs = new Set();
const stockLote4Tickets = [];

const lote4Bases = new Set();
const lote4Postos = new Set();
const lote4Veiculos = new Set();

rawRows.forEach((r, idx) => {
    const seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || '');
    const baseRaw = (r['Base'] || '').toString().trim();
    const respRaw = (r['Responsável'] || '').toString().trim();
    const base = cleanBaseName(baseRaw);
    const responsavel = respRaw;
    const litros = parseFloat(r['Litros']) || 0;
    const precoLitro = parseFloat(r['Preço Litro']) || 7.29;
    const valor = parseFloat(r['Valor']) || (litros * precoLitro);
    const posto = (r['Posto'] || 'PETROVAN').toString().trim();
    const veiculo = (r['Veículo'] || 'NÃO INFORMADO').toString().trim();
    const placa = (r['Placa'] || 'NÃO INFORMADO').toString().trim().toUpperCase();
    const combustivel = (r['Tipo Combustível'] || 'Gasolina').toString().trim();
    const dataStr = excelDateToDateStr(r['Data']);

    if (litros > 500 || !seq) return;

    // Se possui Base e Responsável válidos -> DISTRIBUÍDA
    if (baseRaw && baseRaw !== 'NÃO INFORMADO' && !baseRaw.toLowerCase().includes('não informado') && respRaw && respRaw !== 'NÃO INFORMADO' && !respRaw.toLowerCase().includes('não informado')) {
        lote4Bases.add(`${base} - ${responsavel}`);
        if (posto && posto !== 'NÃO INFORMADO') lote4Postos.add(`${posto} - ${precoLitro.toFixed(2)}`);
        if (veiculo && veiculo !== 'NÃO INFORMADO' && placa && placa !== 'NÃO INFORMADO') lote4Veiculos.add(`${placa} - ${veiculo}`);

        distributedLote4.push({
            id: `1789274115605-${Math.random()}-${idx + 1}`,
            date: dataStr,
            inicioSeq: seq,
            fimSeq: seq,
            qtdRequisicoes: 1,
            zona: base,
            responsavel: responsavel,
            posto: posto,
            motorista: responsavel,
            veiculo: veiculo,
            placa: placa,
            combustivel: combustivel,
            litros: litros,
            precoLitro: precoLitro,
            valor: valor,
            lote: 'LOTE 4'
        });
    } else {
        // Sem Base/Responsável -> PERMANECE EM ESTOQUE
        stockLote4Seqs.add(seq);
        stockLote4Tickets.push(`${seq} - ${litros}L (LOTE 4)`);
    }
});

// Adicionar a sequência faltante 1788275438090-089 (30L) ao estoque do LOTE 4 se não estiver presente
if (!distributedLote4.some(r => r.inicioSeq === '1788275438090-089') && !stockLote4Seqs.has('1788275438090-089')) {
    stockLote4Seqs.add('1788275438090-089');
    stockLote4Tickets.push('1788275438090-089 - 30L (LOTE 4)');
}

// 1. Manter requisições distribuídas dos Lotes 1 e 3
const existingLote1And3 = (payload.requisicoes || []).filter(r => r.lote === 'LOTE 1' || r.lote === 'LOTE 3');
const finalDistributed = [...existingLote1And3, ...distributedLote4];

// 2. Reconstruir Estoque Completo (LOTE 2: 83, LOTE 3: 26, LOTE 4: 122)
// LOTE 2:
const lote2Stock = [];
for (let i = 1; i <= 50; i++) lote2Stock.push(`1787069487718-${String(i).padStart(3, '0')} - 20L (LOTE 2)`);
for (let i = 1; i <= 33; i++) lote2Stock.push(`1787069644788-${String(i).padStart(3, '0')} - 30L (LOTE 2)`);

// LOTE 3:
const lote3Stock = [];
for (let i = 75; i <= 100; i++) lote3Stock.push(`1787595670733-${String(i).padStart(3, '0')} - 50L (LOTE 3)`);

// Combinação Final do Estoque
const finalStockPool = [...lote2Stock, ...lote3Stock, ...stockLote4Tickets];

// 3. Atualizar Payload JSON
payload.requisicoes = finalDistributed;
payload.custom_requisicoes = finalStockPool;
payload.custom_bases = Array.from(new Set([...(payload.custom_bases || []), ...lote4Bases])).sort();
payload.custom_postos = Array.from(new Set([...(payload.custom_postos || []), ...lote4Postos])).sort();
payload.custom_veiculos = Array.from(new Set([...(payload.custom_veiculos || []), ...lote4Veiculos])).sort();

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('=== CORREÇÃO DA DISTRIBUIÇÃO DO LOTE 4 APLICADA ===');
console.log('Requisições do LOTE 4 verdadeiramente distribuídas:', distributedLote4.length);
console.log('Requisições do LOTE 4 mantidas no ESTOQUE DISPONÍVEL:', stockLote4Tickets.length);
console.log('  - Exemplo 30L estoque LOTE 4:', stockLote4Tickets.find(s => s.includes('30L')));
console.log('  - Exemplo 50L estoque LOTE 4:', stockLote4Tickets.find(s => s.includes('50L')));
console.log('\n--- TOTALIZADORES DO SISTEMA ---');
console.log('Total de Requisições Distribuídas (Lotes 1, 3 e 4):', finalDistributed.length);
console.log('Total de Requisições em Estoque (Lotes 2, 3 e 4):', finalStockPool.length);
console.log('Soma Geral (Cadastradas):', finalDistributed.length + finalStockPool.length);
