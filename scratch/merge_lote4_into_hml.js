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
    if (!val) return '2026-08-26';
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
    return '2026-08-26';
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

const lote4Requisicoes = [];
const lote4Bases = new Set();
const lote4Postos = new Set();
const lote4Veiculos = new Set();
const lote4Motoristas = new Set();

rawRows.forEach((r, idx) => {
    const seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || '');
    const base = cleanBaseName(r['Base']);
    const responsavel = (r['Responsável'] || '').toString().trim();
    const litros = parseFloat(r['Litros']) || 0;
    const precoLitro = parseFloat(r['Preço Litro']) || 7.29;
    const valor = parseFloat(r['Valor']) || (litros * precoLitro);
    const posto = (r['Posto'] || 'PETROVAN').toString().trim();
    const veiculo = (r['Veículo'] || 'NÃO INFORMADO').toString().trim();
    const placa = (r['Placa'] || 'NÃO INFORMADO').toString().trim().toUpperCase();
    const combustivel = (r['Tipo Combustível'] || 'Gasolina').toString().trim();
    const dataStr = excelDateToDateStr(r['Data']);

    if (litros > 500 || !seq) return;

    if (base && base !== 'NÃO INFORMADO' && responsavel && responsavel !== 'NÃO INFORMADO') {
        lote4Bases.add(`${base} - ${responsavel}`);
        lote4Motoristas.add(responsavel);
    }
    if (posto && posto !== 'NÃO INFORMADO') {
        lote4Postos.add(`${posto} - ${precoLitro.toFixed(2)}`);
    }
    if (veiculo && veiculo !== 'NÃO INFORMADO' && placa && placa !== 'NÃO INFORMADO') {
        lote4Veiculos.add(`${placa} - ${veiculo}`);
    }

    lote4Requisicoes.push({
        id: `1789274115605-${Math.random()}-${idx + 1}`,
        date: dataStr,
        inicioSeq: seq,
        fimSeq: seq,
        qtdRequisicoes: 1,
        zona: base,
        responsavel: responsavel || 'NÃO INFORMADO',
        posto: posto,
        motorista: responsavel || 'NÃO INFORMADO',
        veiculo: veiculo,
        placa: placa,
        combustivel: combustivel,
        litros: litros,
        precoLitro: precoLitro,
        valor: valor,
        lote: 'LOTE 4'
    });
});

console.log('Novas requisições do LOTE 4 lidas:', lote4Requisicoes.length);

// 1. Filtrar requisições existentes para remover duplicatas caso já existam
const existingSeqSet = new Set(lote4Requisicoes.map(r => r.inicioSeq));
const filteredExisting = (payload.requisicoes || []).filter(r => !existingSeqSet.has(r.inicioSeq));

const combinedRequisicoes = [...filteredExisting, ...lote4Requisicoes];

// 2. Abater sequências do estoque (custom_requisicoes)
const remainingStock = (payload.custom_requisicoes || []).filter(stockItem => {
    const parts = stockItem.split(' ');
    const stockSeq = parts[0].trim();
    return !existingSeqSet.has(stockSeq);
});

// 3. Mesclar cadastros de apoio
const mergedBases = Array.from(new Set([...(payload.custom_bases || []), ...lote4Bases])).sort();
const mergedPostos = Array.from(new Set([...(payload.custom_postos || []), ...lote4Postos])).sort();
const mergedVeiculos = Array.from(new Set([...(payload.custom_veiculos || []), ...lote4Veiculos])).sort();

payload.requisicoes = combinedRequisicoes;
payload.custom_requisicoes = remainingStock;
payload.custom_bases = mergedBases;
payload.custom_postos = mergedPostos;
payload.custom_veiculos = mergedVeiculos;

fs.writeFileSync(payloadPath, JSON.stringify(payload, null, 2), 'utf8');

console.log('\n=== RESULTADO DA MESCLAGEM DO LOTE 4 ===');
console.log('Total de Requisições Distribuídas (Lotes 1, 3 e 4):', combinedRequisicoes.length);
console.log('Total de Requisições Restantes no Estoque (Lotes 2 e 3):', remainingStock.length);
console.log('Total de Bases Cadastradas:', mergedBases.length);
console.log('Total de Postos Cadastrados:', mergedPostos.length);
console.log('Total de Veículos Cadastrados:', mergedVeiculos.length);
