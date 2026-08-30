const XLSX = require('../libs/xlsx.mini.min.js');
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'lote ok (1).xlsx');
const buf = fs.readFileSync(filePath);
const wb = XLSX.read(buf, { type: 'buffer' });

function excelDateToDateStr(val) {
    if (!val) return '2026-08-18';
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
    return '2026-08-18';
}

function cleanBaseName(raw) {
    if (!raw) return 'Não Informado';
    let str = raw.toString().trim();
    if (str.includes(' - ')) str = str.split(' - ')[0].trim();
    str = str.replace(/^Base\s*-\s*/i, '');
    if (str === 'CENTRAL ' || str === 'CENTRAL') return 'CENTRAL';
    if (str === 'CENTRO-SUL1' || str === 'CENTRO-SUL 1') return 'CENTRO-SUL 1';
    if (str === 'CENTRO-SUL2' || str === 'CENTRO-SUL 2') return 'CENTRO-SUL 2';
    return str.trim();
}

function cleanSeq(raw) {
    if (!raw) return '';
    return String(raw).trim().replace(/\s+/g, '');
}

const distributedRows = [];
const availablePool = [];
const basesSet = new Set();
const respSet = new Set();

wb.SheetNames.forEach(sheetName => {
    if (sheetName === 'Planilha1') return;
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: 1 });
    
    let loteName = 'LOTE 1';
    if (sheetName.includes('01')) loteName = 'LOTE 1 (7K)';
    else if (sheetName.includes('02')) loteName = 'LOTE 2 (2K)';
    else if (sheetName.includes('03')) loteName = 'LOTE 3 (15K)';

    rawRows.forEach((r, idx) => {
        const seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || '');
        const base = cleanBaseName(r['Base']);
        const responsavel = (r['Responsável'] || '').toString().trim();
        const litros = parseFloat(r['Litros']) || 15;
        const precoLitro = parseFloat(r['Preço Litro']) || 7.29;
        const valor = parseFloat(r['Valor']) || (litros * precoLitro);
        const posto = (r['Posto'] || 'PETROVAN').toString().trim();
        const veiculo = (r['Veículo'] || 'Não Informado').toString().trim();
        const placa = (r['Placa'] || '').toString().trim().toUpperCase();
        const combustivel = (r['Tipo Combustível'] || 'Gasolina').toString().trim();
        const dataStr = excelDateToDateStr(r['Data']);

        // Linhas de total/soma da planilha original
        if (litros > 500) return;

        if (base && base !== 'Não Informado' && responsavel && responsavel !== 'Não Informado') {
            basesSet.add(base);
            respSet.add(responsavel);
            distributedRows.push({
                item: idx + 1,
                data: dataStr,
                inicioSeq: seq || `REQ-${idx + 1}`,
                qtdRequisicoes: 1,
                zona: base,
                responsavel: responsavel,
                posto: posto,
                veiculo: veiculo,
                placa: placa,
                combustivel: combustivel,
                litros: litros,
                precoLitro: precoLitro,
                valor: valor,
                lote: loteName
            });
        } else {
            if (seq) {
                const parts = seq.split('-');
                const grupo = parts[0] || '17875954044257';
                const numStr = parts[1] || String(idx + 1).padStart(3, '0');
                availablePool.push({
                    id: seq,
                    codigoControle: grupo,
                    seq: numStr,
                    numero: parseInt(numStr, 10) || (idx + 1),
                    litros: litros,
                    lote: loteName,
                    valorEstimado: valor
                });
            }
        }
    });
});

console.log('=== CONVERSÃO CONCLUÍDA ===');
console.log('Total de Requisições Distribuídas:', distributedRows.length);
console.log('Total de Requisições Disponíveis em Estoque (Pool):', availablePool.length);
console.log('Bases Únicas (' + basesSet.size + '):', Array.from(basesSet));
console.log('Responsáveis Únicos (' + respSet.size + '):', Array.from(respSet));

const output = {
    distributedRows,
    availablePool,
    bases: Array.from(basesSet).sort(),
    responsaveis: Array.from(respSet).sort()
};

fs.writeFileSync(path.join(__dirname, 'dados_consolidados_lotes.json'), JSON.stringify(output, null, 2));
console.log('Arquivo salvo em ./Lotes/dados_consolidados_lotes.json');
