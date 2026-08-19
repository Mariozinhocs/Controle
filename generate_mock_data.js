const fs = require('fs');
const path = require('path');

// Ensure xlsx is installed, otherwise log instruction
try {
    require('xlsx');
} catch (e) {
    console.log("Instalando a biblioteca 'xlsx' para gerar o arquivo de teste...");
    const { execSync } = require('child_process');
    execSync('npm install xlsx', { stdio: 'inherit' });
}

const XLSX = require('xlsx');

// Configurações para geração de dados
const ZONAS = ['Zona Sul', 'Zona Norte', 'Zona Leste', 'Zona Oeste', 'Zona Centro-Sul'];
const RESPONSAVEIS = ['João Silva', 'Maria Souza', 'Carlos Lima', 'Ana Oliveira', 'Paulo Santos'];
const VEICULOS = [
    { nome: 'Caminhão 1', placa: 'ABC-1234', combustivel: 'Diesel' },
    { nome: 'Caminhão 2', placa: 'XYZ-5678', combustivel: 'Diesel' },
    { nome: 'Van Frota', placa: 'MNO-9012', combustivel: 'Gasolina' },
    { nome: 'Fiat Uno Cargo', placa: 'QWE-3456', combustivel: 'Etanol' },
    { nome: 'Chevrolet Onix', placa: 'JKL-7890', combustivel: 'Gasolina' }
];

const PRECOS = {
    'Gasolina': 6.15,
    'Diesel': 5.89,
    'Etanol': 4.25
};

// Gerar dados para os últimos 45 dias
const rows = [];
const startDate = new Date();
startDate.setDate(startDate.getDate() - 45);

let seqNumber = 1;

function padZero(num, size) {
    let s = num + "";
    while (s.length < size) s = "0" + s;
    return s;
}

for (let d = 0; d < 45; d++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + d);
    
    // Formatar data como DD/MM/YYYY
    const dia = padZero(currentDate.getDate(), 2);
    const mes = padZero(currentDate.getMonth() + 1, 2);
    const ano = currentDate.getFullYear();
    const dataFormatada = `${dia}/${mes}/${ano}`;
    
    // 1 a 3 abastecimentos por dia
    const abastecimentosNoDia = Math.floor(Math.random() * 3) + 1;
    
    for (let a = 0; a < abastecimentosNoDia; a++) {
        // Selecionar veículo e motorista aleatórios
        const veicObj = VEICULOS[Math.floor(Math.random() * VEICULOS.length)];
        const resp = RESPONSAVEIS[Math.floor(Math.random() * RESPONSAVEIS.length)];
        const zona = ZONAS[Math.floor(Math.random() * ZONAS.length)];
        
        const combustivel = veicObj.combustivel;
        const precoLitro = PRECOS[combustivel] + (Math.random() * 0.3 - 0.15); // Pequena variação no preço
        const precoFormatado = precoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        const qtdRequisicoes = Math.floor(Math.random() * 10) + 1; // 1 a 10 requisições
        const litros = Math.floor(Math.random() * 40) + 15; // 15 a 55 litros
        
        // Sequências
        const inicioSeq = padZero(seqNumber, 7);
        seqNumber += qtdRequisicoes;
        const fimSeq = padZero(seqNumber - 1, 7);
        
        // Valor total: Qtd * Litros * Preço
        const valorTotal = qtdRequisicoes * litros * precoLitro;
        const valorFormatado = valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        
        rows.push({
            'Data': dataFormatada,
            'Início da Sequência': inicioSeq,
            'Fim da Sequência': fimSeq,
            'Qtd Requisições': qtdRequisicoes,
            'Zonas de Manaus': zona,
            'Responsável': resp,
            'Veículo': veicObj.nome,
            'Placa': veicObj.placa,
            'Tipo Combustível': combustivel,
            'Litros': litros,
            'Preço Litro': `R$ ${precoFormatado}`,
            'Valor': `R$ ${valorFormatado}`
        });
    }
}

// Criar planilha Excel usando SheetJS
console.log(`Gerando planilha com ${rows.length} registros...`);
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "Controle");

const destPath = path.join(__dirname, 'dados.xlsx');
XLSX.writeFile(wb, destPath);

console.log(`Planilha de dados fictícios criada com sucesso em: ${destPath}`);
