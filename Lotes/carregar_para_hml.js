const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, 'dados_consolidados_lotes.json');
const raw = JSON.parse(fs.readFileSync(dataFile, 'utf8'));

// Format payload for sync_data.php
const payload = {
    environment: 'Frota Principal',
    requisicoes: raw.distributedRows.map((r, idx) => ({
        id: r.inicioSeq || `REQ-${idx + 1}`,
        date: r.data || '2026-08-18',
        inicioSeq: r.inicioSeq || '',
        fimSeq: '',
        qtdRequisicoes: 1,
        zona: r.zona || 'NÃO INFORMADO',
        responsavel: r.responsavel || 'NÃO INFORMADO',
        posto: r.posto || 'PETROVAN',
        motorista: r.responsavel || 'NÃO INFORMADO',
        veiculo: r.veiculo || 'NÃO INFORMADO',
        placa: r.placa || '',
        kmAnterior: null,
        km: null,
        combustivel: r.combustivel || 'Gasolina',
        litros: r.litros || 15,
        precoLitro: r.precoLitro || 7.29,
        valor: r.valor || 109.35,
        lote: r.lote || 'LOTE 1'
    })),
    custom_bases: raw.bases.map(b => `${b} - Responsável`),
    custom_postos: ['PETROVAN'],
    custom_motoristas: raw.responsaveis,
    custom_veiculos: [],
    custom_requisicoes: raw.availablePool.map(p => `${p.id} - ${p.litros}L (${p.lote})`)
};

console.log(`Preparando envio de ${payload.requisicoes.length} requisições e ${payload.custom_requisicoes.length} disponíveis no pool para Homologação...`);

fetch('https://controle.hubdigital360.com/hml/api/sync_data.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-Trace-ID': 'trace-hml-migration-' + Date.now(),
        'X-Correlation-ID': 'corr-hml-migration'
    },
    body: JSON.stringify(payload)
})
.then(res => res.json())
.then(res => {
    console.log('Resposta da API HML:', res);
})
.catch(err => {
    console.error('Erro na sincronização:', err);
});
