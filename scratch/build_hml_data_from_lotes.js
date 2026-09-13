const fs = require('fs');
const XLSX = require('../libs/xlsx.mini.min.js');

const file1 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 1.xlsx';
const file3 = 'C:\\Users\\mario\\Downloads\\Analiase\\LOTE 3.xlsx';

function parseExcelDate(excelDate) {
    if (!excelDate) return new Date().toISOString().split('T')[0];
    if (typeof excelDate === 'number') {
        const dateObj = new Date(Math.round((excelDate - 25569) * 86400 * 1000));
        return dateObj.toISOString().split('T')[0];
    }
    return String(excelDate).trim();
}

function processLoteFiles() {
    const rawRequisicoes = [];
    const customReqsEstoque = [];
    const basesSet = new Set();
    const postosSet = new Set();
    const motoristasSet = new Set();
    const veiculosSet = new Set();

    function processSheet(filePath, defaultLoteName) {
        const buf = fs.readFileSync(filePath);
        const wb = XLSX.read(buf, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        for (let i = 2; i < rows.length; i++) {
            const r = rows[i];
            if (!r || !r[2]) continue;

            const seqStr = String(r[2]).trim();
            const dateStr = parseExcelDate(r[1]);
            const qtd = parseInt(r[3]) || 1;
            const base = r[4] ? String(r[4]).trim() : '';
            const resp = r[5] ? String(r[5]).trim() : '';
            const posto = r[6] ? String(r[6]).trim() : '';
            const veiculo = r[7] ? String(r[7]).trim() : '';
            const placa = r[8] ? String(r[8]).trim() : '';
            const combustivel = r[9] ? String(r[9]).trim() : 'Gasolina';
            const litros = parseFloat(r[10]) || 0;
            const precoLitro = parseFloat(r[11]) || 0;
            const valor = parseFloat(r[12]) || (litros * precoLitro);

            const isDistributed = (base !== '' || resp !== '');

            if (base && resp) {
                basesSet.add(`${base} - ${resp}`);
            }
            if (posto && precoLitro) {
                postosSet.add(`${posto} - ${precoLitro}`);
            }
            if (placa && veiculo) {
                veiculosSet.add(`${placa} - ${veiculo}`);
            }

            if (isDistributed) {
                rawRequisicoes.push({
                    id: Date.now() + '-' + Math.random() + '-' + i,
                    date: dateStr,
                    month: new Date(dateStr).getMonth(),
                    year: new Date(dateStr).getFullYear(),
                    inicioSeq: seqStr,
                    fimSeq: seqStr,
                    qtdRequisicoes: qtd,
                    zona: base || 'NÃO INFORMADO',
                    responsavel: resp || 'NÃO INFORMADO',
                    posto: posto || 'NÃO INFORMADO',
                    motorista: resp || 'NÃO INFORMADO',
                    veiculo: veiculo || 'NÃO INFORMADO',
                    placa: placa || 'NÃO INFORMADO',
                    kmAnterior: 'NÃO INFORMADO',
                    km: 'NÃO INFORMADO',
                    combustivel: combustivel || 'Gasolina',
                    lote: defaultLoteName,
                    litros: litros,
                    precoLitro: precoLitro,
                    valor: valor
                });
            } else {
                // Stock / Non-distributed item for Dispensador Visual
                // Format: "1787595670733-75 - 50 (LOTE 3)"
                customReqsEstoque.push(`${seqStr} - ${litros} (${defaultLoteName})`);
            }
        }
    }

    processSheet(file1, 'LOTE 1');
    processSheet(file3, 'LOTE 3');

    console.log('==================================================');
    console.log('SUMMARY OF PROCESSED LOTES:');
    console.log('Total Distributed Requisicoes:', rawRequisicoes.length);
    console.log('Total Stock Requisicoes for Dispensador Visual:', customReqsEstoque.length);
    console.log('Unique Bases/Resp extracted:', basesSet.size);
    console.log('Unique Postos/Preços extracted:', postosSet.size);
    console.log('Unique Veículos/Placas extracted:', veiculosSet.size);

    console.log('\nSample Stock Tickets for LOTE 3:');
    console.log(customReqsEstoque.slice(0, 10));

    // Save consolidated json to scratch
    fs.writeFileSync('g:\\Meu Drive\\Dev\'s\\Controle\\scratch\\lotes_payload.json', JSON.stringify({
        requisicoes: rawRequisicoes,
        custom_requisicoes: customReqsEstoque,
        custom_bases: Array.from(basesSet),
        custom_postos: Array.from(postosSet),
        custom_veiculos: Array.from(veiculosSet)
    }, null, 2));

    console.log('\nPayload written to scratch/lotes_payload.json!');
}

processLoteFiles();
