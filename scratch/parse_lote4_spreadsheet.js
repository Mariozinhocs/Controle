/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const xlsxPath = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 4.xlsx';
const buf = fs.readFileSync(xlsxPath);
const wb = XLSX.read(buf, { type: 'buffer' });

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

const distributedLote4 = [];
const basesSet = new Set();
const respSet = new Set();
const postosSet = new Set();
const veicSet = new Set();

let totalLitros = 0;
let totalValor = 0;
let emptySeqCount = 0;

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

    // Ignore header repeats or summary totals
    if (litros > 500) return;
    if (!seq) {
        emptySeqCount++;
        return;
    }

    if (base && base !== 'NÃO INFORMADO' && responsavel && responsavel !== 'NÃO INFORMADO') {
        basesSet.add(`${base} - ${responsavel}`);
        respSet.add(responsavel);
    }
    if (posto && posto !== 'NÃO INFORMADO') {
        postosSet.add(`${posto} - ${precoLitro.toFixed(2)}`);
    }
    if (veiculo && veiculo !== 'NÃO INFORMADO' && placa && placa !== 'NÃO INFORMADO') {
        veicSet.add(`${placa} - ${veiculo}`);
    }

    totalLitros += litros;
    totalValor += valor;

    distributedLote4.push({
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

console.log('=== ANÁLISE DE PROCESSAMENTO DO LOTE 4.xlsx ===');
console.log('Total de linhas lidas:', rawRows.length);
console.log('Total de requisições distribuídas extraídas:', distributedLote4.length);
console.log('Linhas sem sequência (ignoradas/vazias):', emptySeqCount);
console.log('Soma Total de Litros:', totalLitros, 'L');
console.log('Soma Total de Valor: R$', totalValor.toFixed(2));
console.log('\nPrimeira requisição:', distributedLote4[0]);
console.log('Última requisição:', distributedLote4[distributedLote4.length - 1]);
