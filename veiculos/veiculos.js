/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

const GITHUB_KEYS_URL = 'https://raw.githubusercontent.com/Mariozinhocs/Controle/master/keys.json';
const LOCAL_KEYS_FALLBACK = '../keys.json';

const state = {
    activeEnv: 'Frota Principal',
    veiculos: [],
    charts: {
        contrato: null,
        combustivel: null
    }
};

// FUNÇÃO DE HIDE DO LOADER
function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.remove('active');
}

function showLoading(msg = 'Buscando informações...') {
    const overlay = document.getElementById('loading-overlay');
    const text = overlay ? overlay.querySelector('.loading-text') : null;
    if (text) text.textContent = msg;
    if (overlay) overlay.classList.add('active');
}

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    // Determinar ambiente ativo
    state.activeEnv = localStorage.getItem('dashboard_active_environment') || 'Frota Principal';

    // Se estiver em homologação (/hml/), altera título
    if (window.location.pathname.includes('/hml/')) {
        const pageTitle = document.getElementById('page-main-title');
        if (pageTitle) pageTitle.textContent = 'Controle de Veículos Contratados - Homologação';
        document.title = 'Controle de Veículos Contratados - Homologação';
    }

    initLicenseValidation();
    initEventListeners();
});

// VALIDAR LICENÇA COMPARTILHADA
function initLicenseValidation() {
    const overlay = document.getElementById('license-overlay');
    const form = document.getElementById('license-form');
    const input = document.getElementById('license-key-input');
    const statusMsg = document.getElementById('license-status-msg');
    const btnSubmit = document.getElementById('btn-validate-license');

    if (!overlay || !form || !input) return;

    // Bypass automático caso a chave já esteja gravada no dispositivo pelo painel principal
    const savedKey = localStorage.getItem('controle_license_key');
    if (savedKey) {
        overlay.style.display = 'none';
        triggerSplashScreenAndLoadData();
        return;
    }

    input.value = '';
    overlay.style.display = 'flex';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredKey = input.value.trim().toUpperCase();
        if (!enteredKey) {
            showStatus('Por favor, informe a chave.', 'error');
            return;
        }

        btnSubmit.disabled = true;
        showStatus('Verificando chave no GitHub...', 'info');

        try {
            const isValid = await checkKeyOnGithub(enteredKey);
            if (isValid) {
                localStorage.setItem('controle_license_key', enteredKey);
                localStorage.setItem('controle_license_validated_at', new Date().toISOString());
                showStatus('Autenticado com sucesso!', 'success');
                
                setTimeout(() => {
                    overlay.style.display = 'none';
                    btnSubmit.disabled = false;
                    triggerSplashScreenAndLoadData();
                }, 400);
            } else {
                showStatus('Chave de acesso inválida ou inativa.', 'error');
                btnSubmit.disabled = false;
            }
        } catch (err) {
            showStatus('Falha de rede. Tentando validar localmente...', 'info');
            // Tenta validar localmente em fallback offline
            const keysLocal = await fetch(LOCAL_KEYS_FALLBACK).then(r => r.json()).catch(() => []);
            const cleanKey = enteredKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
            const matched = keysLocal.some(k => (k.key || k).toString().replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanKey);
            
            if (matched) {
                localStorage.setItem('controle_license_key', enteredKey);
                localStorage.setItem('controle_license_validated_at', new Date().toISOString());
                overlay.style.display = 'none';
                triggerSplashScreenAndLoadData();
            } else {
                showStatus('Falha na validação offline.', 'error');
                btnSubmit.disabled = false;
            }
        }
    });

    function showStatus(msg, type) {
        if (!statusMsg) return;
        statusMsg.textContent = msg;
        statusMsg.className = `license-status-msg ${type}`;
    }
}

async function checkKeyOnGithub(targetKey) {
    const cleanKey = targetKey.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!cleanKey) return false;

    const response = await fetch(GITHUB_KEYS_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error('Github indisponível');
    
    const keys = await response.json();
    if (Array.isArray(keys)) {
        return keys.some(item => {
            const val = typeof item === 'object' ? item.key : item;
            const active = typeof item === 'object' ? (item.active !== false) : true;
            return active && val.toString().replace(/[^A-Z0-9]/gi, '').toUpperCase() === cleanKey;
        });
    }
    return false;
}

// ANIMAÇÃO DE BOOT (SPLASH SCREEN) E CARREGAMENTO DE DADOS
function triggerSplashScreenAndLoadData() {
    const splash = document.getElementById('splash-screen');
    const fill = document.getElementById('splash-progress-fill');
    const statusText = document.getElementById('splash-status-text');

    if (!splash || !fill) {
        loadData();
        return;
    }

    splash.classList.remove('fade-out');
    fill.style.width = '0%';
    statusText.textContent = 'Carregando dados da filial...';

    setTimeout(() => {
        fill.style.width = '55%';
        statusText.textContent = 'Processando KMs e Consumos...';
    }, 200);

    setTimeout(() => {
        fill.style.width = '90%';
        statusText.textContent = 'Renderizando Gráficos...';
        loadData();
    }, 500);

    setTimeout(() => {
        fill.style.width = '100%';
        statusText.textContent = 'Sistema Pronto!';
    }, 900);

    setTimeout(() => {
        splash.classList.add('fade-out');
    }, 1100);
}

// CARREGAR DADOS DO BACKEND MYSQL
async function loadData() {
    showLoading();
    try {
        const res = await fetch(`./api/get_veiculos.php?env=${encodeURIComponent(state.activeEnv)}`);
        if (!res.ok) throw new Error('Erro na requisição');
        
        const data = await res.json();
        if (data.success) {
            state.veiculos = data.veiculos || [];
            updateKPIs();
            renderTable();
            renderCharts();
        } else {
            console.error('Erro na API:', data.message);
        }
    } catch (e) {
        console.error('Erro ao ler banco de dados contratados:', e);
        alert('Erro ao sincronizar com banco de dados de contratos: ' + e.message);
    } finally {
        hideLoading();
    }
}

// ATUALIZAR MÉTRIQUES DE KPI
function updateKPIs() {
    const total = state.veiculos.length;
    const alugados = state.veiculos.filter(v => v.tipo_contrato === 'ALUGADO').length;
    const cedidos = state.veiculos.filter(v => v.tipo_contrato === 'CEDIDO').length;
    
    const gastoMensal = state.veiculos.reduce((acc, v) => acc + (parseFloat(v.valor_contrato) || 0), 0);

    document.querySelector('#kpi-total-contratados .kpi-value').textContent = total;
    document.querySelector('#kpi-total-alugados .kpi-value').textContent = alugados;
    document.querySelector('#kpi-total-cedidos .kpi-value').textContent = cedidos;
    
    document.querySelector('#kpi-total-gasto .kpi-value').textContent = gastoMensal.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
}

// RENDERIZAR TABELA DADOS
function renderTable(filterQuery = '') {
    const tbody = document.getElementById('table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const cleanQuery = filterQuery.toLowerCase().trim();

    const filtered = state.veiculos.filter(v => {
        if (!cleanQuery) return true;
        return (
            (v.placa || '').toLowerCase().includes(cleanQuery) ||
            (v.tipo_veiculo || '').toLowerCase().includes(cleanQuery) ||
            (v.empresa || '').toLowerCase().includes(cleanQuery) ||
            (v.motorista || '').toLowerCase().includes(cleanQuery) ||
            (v.local_atuacao || '').toLowerCase().includes(cleanQuery)
        );
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="13" style="text-align:center; padding:2rem; color:var(--text-muted);">Nenhum veículo contratado encontrado.</td></tr>`;
        return;
    }

    filtered.forEach(v => {
        const kmRodados = v.km_rodados > 0 ? `${v.km_rodados.toLocaleString('pt-BR')} km` : '-';
        const litros = v.litros_consumidos > 0 ? `${parseFloat(v.litros_consumidos).toLocaleString('pt-BR', {maximumFractionDigits:2})} L` : '-';
        const gastoComb = v.gasto_combustivel > 0 ? v.gasto_combustivel.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${v.tipo_veiculo}</strong></td>
            <td>${v.ano || '-'}</td>
            <td><span class="file-badge" style="background:rgba(255,183,3,0.1); color:var(--accent-yellow); font-weight:700;">${v.placa}</span></td>
            <td>${v.empresa}</td>
            <td>${v.motorista || '-'}</td>
            <td>${v.fone_motorista || '-'}</td>
            <td>${v.local_atuacao || '-'}</td>
            <td><span style="font-weight:700; color:${v.tipo_contrato === 'ALUGADO' ? 'var(--accent-yellow)' : '#4ade80'};">${v.tipo_contrato}</span></td>
            <td>${v.combustivel}</td>
            <td>${kmRodados}</td>
            <td>${litros}</td>
            <td>${gastoComb}</td>
            <td>
                <button class="btn-edit" onclick="editVeiculo(${v.id})" title="Editar veículo contratado">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                        <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                </button>
                <button class="btn-delete" onclick="deleteVeiculo(${v.id})" title="Excluir veículo contratado">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// APEXCHARTS RENDER
function renderCharts() {
    // 1. Gráfico de Rosca (Donut) - Tipos de Contrato
    const alugados = state.veiculos.filter(v => v.tipo_contrato === 'ALUGADO').length;
    const cedidos = state.veiculos.filter(v => v.tipo_contrato === 'CEDIDO').length;

    const optDonut = {
        series: [alugados, cedidos],
        labels: ['Alugado', 'Cedido'],
        chart: {
            type: 'donut',
            height: 240,
            background: 'transparent',
            foreColor: '#888'
        },
        colors: ['#ffb703', '#4ade80'],
        stroke: { show: false },
        dataLabels: { enabled: true },
        legend: { position: 'bottom' },
        plotOptions: {
            pie: {
                donut: {
                    size: '60%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Frota',
                            formatter: () => state.veiculos.length
                        }
                    }
                }
            }
        }
    };

    if (state.charts.contrato) state.charts.contrato.destroy();
    state.charts.contrato = new ApexCharts(document.querySelector("#chart-contrato-donut"), optDonut);
    state.charts.contrato.render();

    // 2. Gráfico de Barras - Combustível por Tipo de Veículo
    const dieselCount = state.veiculos.filter(v => v.combustivel === 'DIESEL').length;
    const gasolinaCount = state.veiculos.filter(v => v.combustivel === 'GASOLINA').length;
    const etanolCount = state.veiculos.filter(v => v.combustivel === 'ETANOL').length;

    const optBar = {
        series: [{
            name: 'Veículos',
            data: [dieselCount, gasolinaCount, etanolCount]
        }],
        chart: {
            type: 'bar',
            height: 240,
            toolbar: { show: false },
            background: 'transparent',
            foreColor: '#888'
        },
        plotOptions: {
            bar: {
                borderRadius: 4,
                horizontal: false,
                columnWidth: '40%'
            }
        },
        colors: ['#fb8500'],
        xaxis: {
            categories: ['DIESEL', 'GASOLINA', 'ETANOL']
        },
        grid: {
            borderColor: 'rgba(255,255,255,0.05)'
        }
    };

    if (state.charts.combustivel) state.charts.combustivel.destroy();
    state.charts.combustivel = new ApexCharts(document.querySelector("#chart-combustivel-bar"), optBar);
    state.charts.combustivel.render();
}

// EVENTOS INTERATIVOS
function initEventListeners() {
    // Abrir cadastro
    const btnOpen = document.getElementById('btn-open-cadastro');
    const modal = document.getElementById('cadastro-modal');
    const form = document.getElementById('form-cadastro');

    if (btnOpen && modal) {
        btnOpen.addEventListener('click', () => {
            form.reset();
            document.getElementById('input-id').value = '';
            document.getElementById('modal-title').textContent = 'Cadastrar Veículo Contratado';
            modal.classList.add('active');
        });
    }

    // Cancelar/Fechar
    const btnClose = document.getElementById('btn-close-cadastro');
    const btnCancel = document.getElementById('btn-cancelar-cadastro');
    
    const closeModal = () => modal.classList.remove('active');

    if (btnClose) btnClose.addEventListener('click', closeModal);
    if (btnCancel) btnCancel.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Submit Cadastro/Edição
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const payload = {
                id: document.getElementById('input-id').value,
                tipo_veiculo: document.getElementById('input-tipo-veiculo').value,
                ano: document.getElementById('input-ano').value,
                placa: document.getElementById('input-placa').value.toUpperCase(),
                empresa: document.getElementById('input-empresa').value,
                motorista: document.getElementById('input-motorista').value,
                fone_motorista: document.getElementById('input-fone-motorista').value,
                local_atuacao: document.getElementById('input-local-atuacao').value,
                valor_contrato: parseFloat(document.getElementById('input-valor-contrato').value) || 0,
                tipo_contrato: document.getElementById('input-tipo-contrato').value,
                combustivel: document.getElementById('input-combustivel').value,
                environment: state.activeEnv
            };

            showLoading('Salvando informações...');
            try {
                const res = await fetch('./api/save_veiculo.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                const resData = await res.json();
                if (resData.success) {
                    closeModal();
                    loadData();
                } else {
                    alert('Erro: ' + resData.message);
                }
            } catch (err) {
                alert('Erro na conexão com o servidor ao salvar.');
            } finally {
                hideLoading();
            }
        });
    }

    // Search bar listener
    const searchInput = document.getElementById('table-search');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            renderTable(e.target.value);
        });
    }

    // Botão Voltar para painel de combustível
    const btnBack = document.getElementById('btn-back-dashboard');
    if (btnBack) {
        btnBack.addEventListener('click', () => {
            // Volta para a página inicial (seja index.php ou index.html)
            window.location.href = '../index.php';
        });
    }

    // Botão Exportar Excel
    const btnExcel = document.getElementById('btn-export-excel');
    if (btnExcel) {
        btnExcel.addEventListener('click', () => {
            exportToExcel();
        });
    }
}

// EDITAR VEÍCULO CONTRATADO
window.editVeiculo = function(id) {
    const item = state.veiculos.find(v => v.id === id);
    if (!item) return;

    document.getElementById('input-id').value = item.id;
    document.getElementById('input-tipo-veiculo').value = item.tipo_veiculo;
    document.getElementById('input-ano').value = item.ano || '';
    document.getElementById('input-placa').value = item.placa;
    document.getElementById('input-empresa').value = item.empresa;
    document.getElementById('input-motorista').value = item.motorista || '';
    document.getElementById('input-fone-motorista').value = item.fone_motorista || '';
    document.getElementById('input-local-atuacao').value = item.local_atuacao || '';
    document.getElementById('input-valor-contrato').value = item.valor_contrato || '';
    document.getElementById('input-tipo-contrato').value = item.tipo_contrato;
    document.getElementById('input-combustivel').value = item.combustivel;

    document.getElementById('modal-title').textContent = 'Editar Veículo Contratado';
    document.getElementById('cadastro-modal').classList.add('active');
};

// EXCLUIR VEÍCULO CONTRATADO
window.deleteVeiculo = async function(id) {
    if (!confirm('Deseja realmente excluir este contrato?')) return;

    showLoading('Excluindo veículo...');
    try {
        const res = await fetch('./api/delete_veiculo.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id })
        });
        const resData = await res.json();
        if (resData.success) {
            loadData();
        } else {
            alert('Erro: ' + resData.message);
        }
    } catch (e) {
        alert('Erro ao excluir contrato do servidor.');
    } finally {
        hideLoading();
    }
};

// EXPORTAR DADOS DA TABELA PARA EXCEL (.XLSX)
function exportToExcel() {
    if (state.veiculos.length === 0) {
        alert('Não há dados cadastrados para exportação.');
        return;
    }

    const data = state.veiculos.map(v => {
        return {
            'Tipo de Veículo': v.tipo_veiculo,
            'Ano': v.ano || '',
            'Placa': v.placa,
            'Empresa': v.empresa,
            'Motorista': v.motorista || '',
            'Telefone': v.fone_motorista || '',
            'Local Atuação': v.local_atuacao || '',
            'Contrato': v.tipo_contrato,
            'Combustível': v.combustivel,
            'Investimento Mensal': parseFloat(v.valor_contrato) || 0,
            'KM Rodados': v.km_rodados || 0,
            'Consumo Litros': parseFloat(v.litros_consumidos) || 0,
            'Gasto Combustível': parseFloat(v.gasto_combustivel) || 0
        };
    });

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Contratos");
        
        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        
        const filename = `contratos_mgp_${dd}-${mm}-${yy}_${hh}${min}.xlsx`;
        XLSX.writeFile(wb, filename);
    } catch (e) {
        console.error(e);
        alert('Erro ao exportar base de contratos para Excel.');
    }
}
