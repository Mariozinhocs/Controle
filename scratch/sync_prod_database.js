/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
const fs = require('fs');
const path = require('path');

const payloadPath = path.join(__dirname, '../api/lotes_payload.json');
const payload = JSON.parse(fs.readFileSync(payloadPath, 'utf8'));

const syncPayload = {
    environment: 'Frota Principal',
    requisicoes: payload.requisicoes,
    custom_bases: payload.custom_bases,
    custom_postos: payload.custom_postos,
    custom_motoristas: payload.custom_motoristas || [],
    custom_veiculos: payload.custom_veiculos,
    custom_requisicoes: payload.custom_requisicoes
};

console.log('=== POPULANDO BANCO DE DADOS DE PRODUÇÃO (PROD) ===');
console.log('Recompondo ambiente Frota Principal com:');
console.log(' - Requisições Distribuídas:', syncPayload.requisicoes.length);
console.log(' - Tickets no Estoque Disponível:', syncPayload.custom_requisicoes.length);
console.log(' - Bases Cadastradas:', syncPayload.custom_bases.length);

const bodyStr = JSON.stringify(syncPayload);
console.log('Tamanho do payload JSON:', (bodyStr.length / 1024).toFixed(2), 'KB');

fetch('https://controle.hubdigital360.com/api/sync_data.php', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: bodyStr
})
.then(res => res.json())
.then(data => {
    console.log('\n=== RESPOSTA DO SERVIDOR PROD ===');
    console.log(JSON.stringify(data, null, 2));
})
.catch(err => {
    console.error('Erro ao sincronizar PROD:', err);
});
