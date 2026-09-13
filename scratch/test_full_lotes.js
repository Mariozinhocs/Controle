const fs = require('fs');
const path = require('path');
const XLSX = require(path.join(__dirname, '..', 'libs', 'xlsx.mini.min.js'));

const filePath = path.join(__dirname, '..', 'Lotes', 'lote ok (1).xlsx');
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
const seenDistributedSeqs = new Set();

wb.SheetNames.forEach(sheetName => {
    if (sheetName === 'Planilha1') return;
    const rawRows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { range: 1 });
    
    let loteName = 'LOTE 1 (7K)';
    let groupDefault = '1786981045866';
    if (sheetName.includes('01')) {
        loteName = 'LOTE 1 (7K)';
        groupDefault = '1786981045866';
    } else if (sheetName.includes('02')) {
        loteName = 'LOTE 2 (2K)';
        groupDefault = '1787100001234';
    } else if (sheetName.includes('03')) {
        loteName = 'LOTE 3 (15K)';
        groupDefault = '17875954044257';
    }

    rawRows.forEach((r, idx) => {
        let seq = cleanSeq(r['LOTE 1 Sequência'] || r['Sequência'] || r['CONTROLE INTERNO '] || '');
        // Se a coluna de sequência estiver vazia, gera a sequência com base no item do lote
        if (!seq || seq === String(idx + 1) || /^\d+$/.test(seq)) {
            const numPad = String(idx + 1).padStart(3, '0');
            seq = `${groupDefault}-${numPad}`;
        }

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

        if (litros > 500) return;

        if (base && base !== 'Não Informado' && responsavel && responsavel !== 'Não Informado') {
            basesSet.add(base);
            respSet.add(responsavel);
            if (!seenDistributedSeqs.has(seq)) {
                seenDistributedSeqs.add(seq);
                distributedRows.push({
                    item: distributedRows.length + 1,
                    data: dataStr,
                    inicioSeq: seq,
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
            }
        } else {
            const parts = seq.split('-');
            const grupo = parts[0] || groupDefault;
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
    });
});

// Adicionar os lançamentos reais do LOTE 4 (10K) informados pelo usuário (sem duplicatas)
const lote4Launches = [
    { seq: '1788275751235-048', base: 'LESTE 2', resp: 'PAULO HENRIQUE', combustivel: 'Diesel', litros: 15, preco: 7.29, valor: 109.35, date: '2026-09-08' },
    { seq: '1788275751235-049', base: 'LESTE 2', resp: 'PAULO HENRIQUE', combustivel: 'Diesel', litros: 15, preco: 7.29, valor: 109.35, date: '2026-09-08' },
    { seq: '1788275751235-050', base: 'LESTE 2', resp: 'PAULO HENRIQUE', combustivel: 'Diesel', litros: 15, preco: 7.29, valor: 109.35, date: '2026-09-08' }
];

lote4Launches.forEach(item => {
    if (!seenDistributedSeqs.has(item.seq)) {
        seenDistributedSeqs.add(item.seq);
        basesSet.add(item.base);
        respSet.add(item.resp);
        distributedRows.push({
            item: distributedRows.length + 1,
            data: item.date,
            inicioSeq: item.seq,
            qtdRequisicoes: 1,
            zona: item.base,
            responsavel: item.resp,
            posto: 'PETROVAN',
            veiculo: 'Não Informado',
            placa: '',
            combustivel: item.combustivel,
            litros: item.litros,
            precoLitro: item.preco,
            valor: item.valor,
            lote: 'LOTE 4 (10K)'
        });
    }
});

// Gerar pool restante para LOTE 4 (10K)
for (let i = 1; i <= 100; i++) {
    const seqPad = String(i).padStart(3, '0');
    const seqId = `1788275751235-${seqPad}`;
    if (!seenDistributedSeqs.has(seqId)) {
        availablePool.push({
            id: seqId,
            codigoControle: '1788275751235',
            seq: seqPad,
            numero: i,
            litros: 15,
            lote: 'LOTE 4 (10K)',
            valorEstimado: 109.35
        });
    }
}

console.log('=== NOVO CONSOLIDADO COM TODOS OS 4 LOTES ===');
console.log('Total de Requisições Distribuídas:', distributedRows.length);
console.log('Total de Requisições Disponíveis no Pool:', availablePool.length);

const distByLote = {};
distributedRows.forEach(r => distByLote[r.lote] = (distByLote[r.lote] || 0) + 1);
console.log('Distribuídas por Lote:', distByLote);

const poolByLote = {};
availablePool.forEach(p => poolByLote[p.lote] = (poolByLote[p.lote] || 0) + 1);
console.log('Disponíveis (Pool) por Lote:', poolByLote);

const output = {
    distributedRows,
    availablePool,
    bases: Array.from(basesSet).sort(),
    responsaveis: Array.from(respSet).sort()
};

fs.writeFileSync(path.join(__dirname, '..', 'Lotes', 'dados_consolidados_lotes.json'), JSON.stringify(output, null, 2));
console.log('Salvo em Lotes/dados_consolidados_lotes.json');
