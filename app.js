/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
// A-Team Protocol: Rastreamento Distribuído (Tracing)
(function() {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const traceId = 'trace-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);
        const correlationId = 'corr-' + Date.now() + '-' + Math.random().toString(36).substring(2, 15);

        let isLocal = false;
        if (typeof input === 'string') {
            isLocal = !input.startsWith('http://') && !input.startsWith('https://');
        }

        if (isLocal) {
            init = init || {};
            init.headers = init.headers || {};
            if (init.headers instanceof Headers) {
                init.headers.set('X-Trace-ID', traceId);
                init.headers.set('X-Correlation-ID', correlationId);
            } else if (Array.isArray(init.headers)) {
                init.headers.push(['X-Trace-ID', traceId]);
                init.headers.push(['X-Correlation-ID', correlationId]);
            } else {
                init.headers['X-Trace-ID'] = traceId;
                init.headers['X-Correlation-ID'] = correlationId;
            }
        }
        return originalFetch(input, init);
    };
})();

// Helper para detecção e isolamento de ambiente (HML / PROD)
function isHmlEnvironment() {
    return window.location.pathname.includes('/hml/') || window.location.href.includes('/hml/');
}

function getEnvKey(key) {
    return isHmlEnvironment() ? `hml_${key}` : key;
}

// ESTADO DA APLICAÇÃO
const state = {
    rawData: [],      // Dados originais limpos
    filteredData: [], // Dados filtrados ativos
    filename: 'Nenhum arquivo carregado',
    filters: {
        zonas: new Set(),
        postos: new Set(),
        combustiveis: new Set(),
        lotes: new Set()
    },
    dateRange: {
        start: null,
        end: null
    },
    fullDateRange: {
        start: null,
        end: null
    },
    activeTab: 'lancamentos', // lancamentos, responsaveis, veiculos
    searchText: '',
    sortColumn: 'date',
    sortDirection: 'desc',
    charts: {
        donut: null,
        zonaDonut: null,
        bar: null,
        area: null
    },
    customBases: [],
    customPostos: [],
    customMotoristas: [],
    customVeiculos: [],
    customRequisicoes: [],
    veiculosContratados: [],
    activeEnv: 'Frota Principal',
    environments: ['Frota Principal'],
    mappings: {
        baseToResponsavel: {},
        responsavelToBase: {},
        placaToVeiculo: {},
        veiculoToPlacas: {}
    }
};

function getEnvKey(key) {
    const active = state.activeEnv || 'Frota Principal';
    if (active === 'Frota Principal' || active === 'Padrao') {
        return key;
    }
    return `${key}_env_${active.replace(/\s+/g, '_')}`;
}

// FUNÇÃO AUXILIAR PARA DIVIDIR STRINGS DE RELACIONAMENTO TRATANDO ESPAÇAMENTOS AO REDOR DO HÍFEN
function splitByRelationalHyphen(str) {
    if (!str) return [];
    // Divide por hífen que possua ao menos um espaço de um dos lados (para não quebrar Centro-Sul ou placas ABC-1234)
    const parts = str.toString().split(/\s+-\s*|\s*-\s+/);
    return parts.map(p => p.trim());
}

// FUNÇÃO AUXILIAR PARA ANALISAR NÚMEROS DE SEQUÊNCIA (TRATANDO FORMATOS COM HÍFEN COMO 1786981045866-001)
function parseSeqString(str) {
    if (!str) return { prefix: "", num: NaN };
    const s = str.toString().trim();
    const match = s.match(/^(.*)-(\d+)$/);
    if (match) {
        return {
            prefix: match[1].trim(),
            num: parseInt(match[2], 10)
        };
    }
    return {
        prefix: "",
        num: parseInt(s, 10)
    };
}

// Auxiliar para preencher datalist
function populateDatalist(id, list) {
    const dl = document.getElementById(id);
    if (dl) {
        dl.innerHTML = '';
        if (list && list.length > 0) {
            list.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                dl.appendChild(opt);
            });
        }
    }
}

// Auxiliar para preencher datalist de requisições mostrando informações adicionais
function populateRequisicoesDatalist(id, list) {
    const dl = document.getElementById(id);
    if (dl) {
        dl.innerHTML = '';
        if (list && list.length > 0) {
            list.forEach(line => {
                const parts = splitByRelationalHyphen(line);
                if (parts.length > 0) {
                    const num = parts[0].trim();
                    const opt = document.createElement('option');
                    opt.value = num;
                    if (parts.length > 1) {
                        opt.textContent = parts.slice(1).join(' - ');
                    }
                    dl.appendChild(opt);
                }
            });
        }
    }
}

// Auxiliar para buscar e preencher kilometragem anterior do veículo
function updateKmAnterior(placa) {
    const inputKmAnterior = document.getElementById('input-km-anterior');
    if (!inputKmAnterior) return;

    if (!placa) {
        inputKmAnterior.value = '';
        return;
    }

    const valUpper = placa.toUpperCase().trim();
    if (state.rawData && state.rawData.length > 0) {
        const records = state.rawData.filter(row => row.placa && row.placa.trim().toUpperCase() === valUpper);
        if (records.length > 0) {
            const sortedRecords = [...records].sort((a, b) => b.date - a.date);
            const lastKm = sortedRecords[0].km;
            if (lastKm !== undefined && lastKm !== null && lastKm !== '') {
                inputKmAnterior.value = lastKm;
            } else {
                inputKmAnterior.value = 'Sem registro';
            }
        } else {
            inputKmAnterior.value = 'Sem registro';
        }
    } else {
        inputKmAnterior.value = 'Sem registro';
    }
}

// FUNÇÃO AUXILIAR PARA ATUALIZAR MAPEAMENTOS DE RELACIONAMENTO
function updateRelationsMappings() {
    state.mappings = {
        baseToResponsavel: {},
        responsavelToBase: {},
        placaToVeiculo: {},
        veiculoToPlacas: {}
    };

    // Obter bases e responsáveis conhecidos dos dados brutos para auto-correção de inversão
    const knownBases = new Set();
    const knownResps = new Set();
    if (state.rawData) {
        state.rawData.forEach(row => {
            if (row.zona && row.zona !== 'Não Informado') knownBases.add(row.zona.toString().toLowerCase().trim());
            if (row.responsavel && row.responsavel !== 'Não Informado') knownResps.add(row.responsavel.toString().toLowerCase().trim());
        });
    }

    // 1. Processar Bases e Responsáveis Vinculados
    (state.customBases || []).forEach(line => {
        const parts = splitByRelationalHyphen(line);
        if (parts.length >= 2) {
            let base = parts[0];
            let resp = parts[1];

            // Auto-correção se o usuário inseriu invertido "Responsável - Base"
            const p0 = base.toLowerCase().trim();
            const p1 = resp.toLowerCase().trim();
            const p0IsBase = knownBases.has(p0) || p0.includes('zona') || p0.includes('base');
            const p1IsBase = knownBases.has(p1) || p1.includes('zona') || p1.includes('base');
            const p0IsResp = knownResps.has(p0);
            const p1IsResp = knownResps.has(p1);

            if ((p1IsBase && !p0IsBase) || (p0IsResp && !p1IsResp)) {
                base = parts[1];
                resp = parts[0];
            }

            state.mappings.baseToResponsavel[base.toLowerCase()] = resp;
            state.mappings.responsavelToBase[resp.toLowerCase()] = base;
        }
    });

    // 2. Processar Placas e Veículos Vinculados
    (state.customVeiculos || []).forEach(line => {
        const parts = splitByRelationalHyphen(line);
        if (parts.length >= 2) {
            let placa = parts[0];
            let veiculo = parts[1];

            // Auto-correção se o usuário inseriu invertido "Veículo - Placa"
            // Placas geralmente contém números (ex: ABC-1234 ou ABC1D23)
            const p0HasDigits = /[0-9]/.test(placa);
            const p1HasDigits = /[0-9]/.test(veiculo);

            if (p1HasDigits && !p0HasDigits) {
                placa = parts[1];
                veiculo = parts[0];
            }

            const placaUpper = placa.trim().toUpperCase();
            const veiculoTrim = veiculo.trim();

            state.mappings.placaToVeiculo[placaUpper] = veiculoTrim;

            if (!state.mappings.veiculoToPlacas[veiculoTrim.toLowerCase()]) {
                state.mappings.veiculoToPlacas[veiculoTrim.toLowerCase()] = [];
            }
            state.mappings.veiculoToPlacas[veiculoTrim.toLowerCase()].push(placaUpper);
        }
    });

    // 3. Processar Postos e Preços Vinculados
    state.mappings.postoToPrice = {};
    (state.customPostos || []).forEach(line => {
        const parts = splitByRelationalHyphen(line);
        if (parts.length >= 2) {
            const name = parts[0].trim();
            const price = parseFloat(parts[1]) || 0;
            state.mappings.postoToPrice[name.toLowerCase()] = price;
        }
    });

    // 4. Processar Requisições e Combustível/Litros Vinculados
    state.mappings.reqToFuelAndLiters = {};
    (state.customRequisicoes || []).forEach(line => {
        const parts = splitByRelationalHyphen(line);
        if (parts.length >= 2) {
            const reqNum = parts[0].trim();
            let fuel = '';
            let liters = '';
            if (parts.length >= 3) {
                fuel = parts[1].trim();
                liters = parts[2].trim();
            } else {
                const val = parts[1].trim();
                if (!isNaN(parseFloat(val.replace(',', '.')))) {
                    liters = val;
                } else {
                    fuel = val;
                }
            }
            state.mappings.reqToFuelAndLiters[reqNum] = {
                fuel: fuel,
                liters: liters
            };
        }
    });
}

// CONFIGURAÇÃO DOS GRÁFICOS (Tema Escuro e Cores Reativas)
const chartTheme = {
    get fontFamily() {
        return 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    },
    get foreColor() {
        return document.body.classList.contains('light-theme') ? '#475569' : '#94a3b8';
    },
    get gridColor() {
        return document.body.classList.contains('light-theme') ? 'rgba(0, 0, 0, 0.06)' : 'rgba(255, 255, 255, 0.05)';
    },
    get valueColor() {
        return document.body.classList.contains('light-theme') ? '#0f172a' : '#ffffff';
    },
    get strokeColor() {
        return document.body.classList.contains('light-theme') ? '#ffffff' : '#121824';
    },
    get tooltipTheme() {
        return document.body.classList.contains('light-theme') ? 'light' : 'dark';
    }
};

// CONTROLE DE TEMA (CLARO / ESCURO)
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    const body = document.body;
    const themeBtn = document.getElementById('btn-toggle-theme');
    
    if (savedTheme === 'light') {
        body.classList.add('light-theme');
        updateThemeIcon(true);
    } else {
        body.classList.remove('light-theme');
        updateThemeIcon(false);
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const isLight = body.classList.toggle('light-theme');
            localStorage.setItem('theme', isLight ? 'light' : 'dark');
            updateThemeIcon(isLight);
            
            // Redesenhar os gráficos com as novas cores do tema
            if (typeof renderCombustivelDonut === 'function') {
                renderCombustivelDonut();
            }
            if (typeof renderZonaDonut === 'function') {
                renderZonaDonut();
            }
            if (typeof renderGastoMensalBar === 'function') {
                renderGastoMensalBar();
            }
            if (typeof renderAreaChart === 'function') {
                renderAreaChart();
            }
        });
    }
}

function updateThemeIcon(isLight) {
    const icon = document.getElementById('theme-toggle-icon');
    if (!icon) return;
    if (isLight) {
        icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />`;
        icon.setAttribute('title', 'Ativar modo escuro');
    } else {
        icon.innerHTML = `<path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />`;
        icon.setAttribute('title', 'Ativar modo claro');
    }
}

// NOMES DOS MESES EM PORTUGUÊS
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

// FUNÇÕES DE LOADING
function showLoading(text = 'Processando planilha de dados...') {
    const overlay = document.getElementById('loading-overlay');
    overlay.querySelector('.loading-text').textContent = text;
    overlay.classList.add('active');
}

function hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
}

// FUNÇÕES DE INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    initTheme(); // Inicializa o Modo Claro / Escuro
    // Ajustar títulos dinamicamente para Frota B se for acessado por essa subpasta
    if (window.location.pathname.includes('Frota_B') || window.location.pathname.includes('Frota-B')) {
        const titleEl = document.querySelector('.header-title h1');
        if (titleEl) titleEl.textContent = 'Controle de Requisições - Frota B';
        const splashTitle = document.querySelector('.splash-title');
        if (splashTitle) splashTitle.textContent = 'CONTROLE DE REQUISIÇÕES - FROTA B';
        document.title = 'Controle de Requisições - Frota B';
    }

    // Exibir botão de veículos contratados apenas em homologação
    if (window.location.pathname.includes('/hml/')) {
        const btnVeiculos = document.getElementById('btn-goto-veiculos');
        if (btnVeiculos) btnVeiculos.style.display = 'inline-flex';
    }

    // Ocultar splash inicial para exibir o modal de autenticação em primeiro lugar
    const splash = document.getElementById('splash-screen');
    if (splash) splash.classList.add('fade-out');

    initLicenseValidation(); // Exige senha com a caixa de texto LIMPA
    initSidebarToggle();     // Sistema de Sidebar Retrátil (Ícone)
    initFullscreenToggle();  // Sistema de Painel em Tela Cheia
    initEnvironmentEvents(); // Gestão de múltiplos ambientes/frotas
    initEventListeners();
    checkUrlParams();
    buildFilterButtons(); // Carrega os botões de filtros imediatamente
    initDragAndDrop();    // Inicializa o drag & drop de KPIs e Gráficos
    initCalendarWidget(); // Inicializa o calendário
});

// SISTEMA DE GESTÃO MULTIAMBIENTE (FROTAS)
function populateEnvironmentSelector() {
    const select = document.getElementById('select-environment');
    if (select) {
        select.innerHTML = '';
        state.environments.forEach(env => {
            const opt = document.createElement('option');
            opt.value = env;
            opt.textContent = env;
            opt.style.backgroundColor = 'var(--bg-secondary)';
            opt.style.color = 'var(--text-primary)';
            if (env === state.activeEnv) {
                opt.selected = true;
            }
            select.appendChild(opt);
        });
    }
}

function initEnvironmentEvents() {
    const select = document.getElementById('select-environment');
    const btnManage = document.getElementById('btn-manage-envs');
    const modalManage = document.getElementById('manage-envs-modal');
    const btnCloseManage = document.getElementById('btn-close-manage-envs');
    const btnCreate = document.getElementById('btn-create-env');
    const btnRename = document.getElementById('btn-rename-active-env');
    const btnDelete = document.getElementById('btn-delete-active-env');
    const inputNewName = document.getElementById('input-new-env-name');

    if (select) {
        select.addEventListener('change', function() {
            state.activeEnv = this.value;
            localStorage.setItem('dashboard_active_environment', state.activeEnv);
            loadInitialData(false);
        });
    }

    if (btnManage && modalManage) {
        btnManage.addEventListener('click', () => modalManage.classList.add('active'));
    }

    if (btnCloseManage && modalManage) {
        btnCloseManage.addEventListener('click', () => modalManage.classList.remove('active'));
    }

    if (modalManage) {
        modalManage.addEventListener('click', (e) => {
            if (e.target === modalManage) modalManage.classList.remove('active');
        });
    }

    if (btnCreate) {
        btnCreate.addEventListener('click', async () => {
            const name = inputNewName.value.trim();
            if (!name) {
                alert('Por favor, digite um nome para a nova frota.');
                return;
            }
            const exists = state.environments.some(env => env.toLowerCase() === name.toLowerCase());
            if (exists) {
                alert('Já existe uma frota com este nome (mesmo que com maiúsculas/minúsculas diferentes).');
                return;
            }
            if (state.rawData.length > 0) {
                const saveConfirm = confirm('Para criar uma nova frota, você deve primeiro salvar o trabalho atual fazendo backup. Deseja fazer isso agora?');
                if (!saveConfirm) {
                    return;
                }
                await saveBackup();
            }
            state.environments.push(name);
            state.activeEnv = name;
            
            localStorage.setItem('dashboard_environments', JSON.stringify(state.environments));
            localStorage.setItem('dashboard_active_environment', state.activeEnv);
            
            inputNewName.value = '';
            modalManage.classList.remove('active');
            
            loadInitialData(false);
        });
    }

    if (btnRename) {
        btnRename.addEventListener('click', () => {
            const active = state.activeEnv;
            if (active === 'Frota Principal') {
                alert('O ambiente "Frota Principal" é o padrão do sistema e não pode ser renomeado.');
                return;
            }
            const newName = prompt('Digite o novo nome para esta frota:', active);
            if (!newName || newName.trim() === '' || newName.trim() === active) return;
            
            const trimmed = newName.trim();
            const exists = state.environments.some(env => env.toLowerCase() === trimmed.toLowerCase());
            if (exists) {
                alert('Já existe uma frota com este nome (mesmo que com maiúsculas/minúsculas diferentes).');
                return;
            }

            const keysToMigrate = [
                'combustivel_dashboard_data',
                'combustivel_dashboard_filename',
                'custom_bases',
                'custom_postos',
                'custom_motoristas',
                'custom_veiculos',
                'custom_requisicoes'
            ];

            const activeSanitized = active.replace(/\s+/g, '_');
            const trimmedSanitized = trimmed.replace(/\s+/g, '_');

            keysToMigrate.forEach(k => {
                const oldVal = localStorage.getItem(`${k}_env_${activeSanitized}`);
                if (oldVal !== null) {
                    localStorage.setItem(`${k}_env_${trimmedSanitized}`, oldVal);
                    localStorage.removeItem(`${k}_env_${activeSanitized}`);
                }
            });

            state.environments = state.environments.map(e => e === active ? trimmed : e);
            state.activeEnv = trimmed;

            localStorage.setItem('dashboard_environments', JSON.stringify(state.environments));
            localStorage.setItem('dashboard_active_environment', state.activeEnv);

            modalManage.classList.remove('active');
            loadInitialData(false);
        });
    }

    if (btnDelete) {
        btnDelete.addEventListener('click', () => {
            const active = state.activeEnv;
            if (active === 'Frota Principal') {
                alert('O ambiente "Frota Principal" não pode ser excluído.');
                return;
            }
            if (confirm(`Tem certeza de que deseja excluir permanentemente o ambiente "${active}"?\nEsta ação apagará todo o histórico e configurações deste ambiente localmente.`)) {
                const keysToRemove = [
                    'combustivel_dashboard_data',
                    'combustivel_dashboard_filename',
                    'custom_bases',
                    'custom_postos',
                    'custom_motoristas',
                    'custom_veiculos',
                    'custom_requisicoes'
                ];

                const activeSanitized = active.replace(/\s+/g, '_');
                keysToRemove.forEach(k => {
                    localStorage.removeItem(`${k}_env_${activeSanitized}`);
                });

                state.environments = state.environments.filter(e => e !== active);
                state.activeEnv = 'Frota Principal';

                localStorage.setItem('dashboard_environments', JSON.stringify(state.environments));
                localStorage.setItem('dashboard_active_environment', state.activeEnv);

                modalManage.classList.remove('active');
                loadInitialData(false);
            }
        });
    }
}

// 1. EVENT LISTENERS
function initEventListeners() {
    // Modal Upload
    const modal = document.getElementById('upload-modal');
    const btnOpenUpload = document.getElementById('btn-open-upload');
    const btnCloseUpload = document.getElementById('btn-close-upload');

    if (btnOpenUpload && modal) {
        btnOpenUpload.addEventListener('click', () => modal.classList.add('active'));
    }
    if (btnCloseUpload && modal) {
        btnCloseUpload.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    }

    // Drag & Drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    if (dropZone) {
        dropZone.addEventListener('click', (e) => {
            if (fileInput && e.target !== fileInput && !e.target.closest('label')) {
                fileInput.click();
            }
        });

        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('dragover');
        });

        dropZone.addEventListener('dragleave', () => {
            dropZone.classList.remove('dragover');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                handleUploadedFile(files[0]);
            }
        });
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = e.target.files;
            if (files.length > 0) {
                handleUploadedFile(files[0]);
            }
        });
    }

    // Gerar Planilha de Teste
    const btnGenerateMock = document.getElementById('btn-generate-mock');
    if (btnGenerateMock) {
        btnGenerateMock.addEventListener('click', () => {
            generateAndDownloadMockData();
        });
    }

    // Filtros de Data
    const dateStart = document.getElementById('date-start');
    if (dateStart) {
        dateStart.addEventListener('change', (e) => {
            state.dateRange.start = parseInputDate(e.target.value);
            setActivePreset(null);
            updateDashboard();
        });
    }

    const dateEnd = document.getElementById('date-end');
    if (dateEnd) {
        dateEnd.addEventListener('change', (e) => {
            state.dateRange.end = parseInputDate(e.target.value);
            setActivePreset(null);
            updateDashboard();
        });
    }

    // Presets de Data
    const presetAll = document.getElementById('preset-all');
    if (presetAll) {
        presetAll.addEventListener('click', () => {
            state.dateRange.start = new Date(state.fullDateRange.start);
            state.dateRange.end = new Date(state.fullDateRange.end);
            const ds = document.getElementById('date-start');
            const de = document.getElementById('date-end');
            if (ds) ds.value = formatDateIso(state.dateRange.start);
            if (de) de.value = formatDateIso(state.dateRange.end);
            setActivePreset('all');
            updateDashboard();
            const drop = document.getElementById('calendar-dropdown');
            if (drop) drop.style.display = 'none';
        });
    }

    const presetToday = document.getElementById('preset-today');
    if (presetToday) {
        presetToday.addEventListener('click', () => {
            const today = new Date();
            state.dateRange.start = today;
            state.dateRange.end = today;
            const ds = document.getElementById('date-start');
            const de = document.getElementById('date-end');
            if (ds) ds.value = formatDateIso(today);
            if (de) de.value = formatDateIso(today);
            setActivePreset('today');
            updateDashboard();
            const drop = document.getElementById('calendar-dropdown');
            if (drop) drop.style.display = 'none';
        });
    }

    const preset7d = document.getElementById('preset-7d');
    if (preset7d) {
        preset7d.addEventListener('click', () => {
            applyPresetRange(7);
            setActivePreset('7d');
            const drop = document.getElementById('calendar-dropdown');
            if (drop) drop.style.display = 'none';
        });
    }

    const preset30d = document.getElementById('preset-30d');
    if (preset30d) {
        preset30d.addEventListener('click', () => {
            applyPresetRange(30);
            setActivePreset('30d');
            const drop = document.getElementById('calendar-dropdown');
            if (drop) drop.style.display = 'none';
        });
    }

    // Abas da Tabela de Busca
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTab = btn.dataset.tab;
            renderTable();
        });
    });

    // Input de Busca com atualização em tempo real de todo o Dashboard
    const searchInputEl = document.getElementById('table-search');
    if (searchInputEl) {
        searchInputEl.addEventListener('input', (e) => {
            state.searchText = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
            updateDashboard();
        });
    }

    // Botão Recarregar do Cabeçalho
    const btnRefresh = document.getElementById('btn-refresh');
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            loadInitialData(true);
        });
    }

    // Botão de Imprimir/PDF
    const btnPrint = document.getElementById('btn-print');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => {
            if (typeof updatePrintTimestamps === 'function') {
                updatePrintTimestamps();
            }
            
            // Salvar título original e definir título formatado (ddmmaaaa - hhmm) para o nome do arquivo PDF
            const originalTitle = document.title;
            const now = new Date();
            const dd = String(now.getDate()).padStart(2, '0');
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const yyyy = now.getFullYear();
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            
            document.title = `Controle de Requisições - MGP - ${dd}${mm}${yyyy} - ${hh}${min}`;
            
            // Mudar gráficos para tema claro antes de imprimir
            if (typeof toggleChartsTheme === 'function') {
                toggleChartsTheme(true);
            }
            
            // Delay ligeiramente maior para garantir que os gráficos foram redesenhados sem animações
            setTimeout(() => {
                window.print();
                
                // Restaurar os gráficos para tema escuro e o título original
                setTimeout(() => {
                    if (typeof toggleChartsTheme === 'function') {
                        toggleChartsTheme(false);
                    }
                    document.title = originalTitle;
                }, 1500);
            }, 700);
        });
    }

    // Botão Limpar Filtros da Tabela
    const btnClearTableFilters = document.getElementById('btn-clear-table-filters');
    if (btnClearTableFilters) {
        btnClearTableFilters.addEventListener('click', () => {
            state.filters.zonas.clear();
            state.filters.postos.clear();
            state.filters.combustiveis.clear();

            state.dateRange.start = new Date(state.fullDateRange.start);
            state.dateRange.end = new Date(state.fullDateRange.end);
            document.getElementById('date-start').value = formatDateIso(state.dateRange.start);
            document.getElementById('date-end').value = formatDateIso(state.dateRange.end);
            setActivePreset('all');

            state.searchText = '';
            const searchInput = document.getElementById('table-search');
            if (searchInput) searchInput.value = '';

            buildFilterButtons();
            updateDashboard();
        });
    }

    // Botão Limpar Dados Gerais (Destrutivo)
    const btnClearData = document.getElementById('btn-clear-data');
    if (btnClearData) {
        btnClearData.addEventListener('click', () => {
            if (confirm("Tem certeza de que deseja limpar todos os lançamentos do dashboard? Esta ação não pode ser desfeita!")) {
                state.rawData = [];
                state.filteredData = [];
                state.filename = 'Nenhum arquivo carregado';
                updateFilenameDisplay();

                localStorage.removeItem('combustivel_dashboard_data');
                localStorage.removeItem('combustivel_dashboard_filename');

                // Limpar filtros também
                state.filters.zonas.clear();
                state.filters.postos.clear();
                state.filters.combustiveis.clear();
                state.searchText = '';
                const searchEl = document.getElementById('table-search');
                if (searchEl) searchEl.value = '';
                const nlqEl = document.getElementById('nlq-input');
                if (nlqEl) nlqEl.value = '';
                
                buildFilterButtons();
                updateDashboard();

                // Exibir modal de importação para carregar nova planilha
                const uploadModal = document.getElementById('upload-modal');
                if (uploadModal) uploadModal.classList.add('active');
                alert('Todos os dados foram limpos do navegador!');
            }
        });
    }

    // Botão Salvar Backup (Manual)
    const btnSaveData = document.getElementById('btn-save-data');
    if (btnSaveData) {
        btnSaveData.addEventListener('click', () => {
            saveBackup();
        });
    }

    // Seletor de Lote da Barra Lateral
    const selectLoteSidebar = document.getElementById('select-lote-sidebar');
    if (selectLoteSidebar) {
        selectLoteSidebar.addEventListener('change', (e) => {
            const val = e.target.value;
            if (val === 'TODOS') {
                state.filters.lotes.clear();
            } else {
                state.filters.lotes.clear();
                state.filters.lotes.add(val);
            }
            buildFilterButtons();
            updateDashboard();
        });
    }

    // Abrir modal de Nova Requisição
    const btnOpenAddReq = document.getElementById('btn-open-add-requisicao');
    if (btnOpenAddReq) {
        btnOpenAddReq.addEventListener('click', () => {
            const editIdInput = document.getElementById('input-edit-id');
            if (editIdInput) editIdInput.value = '';
            const modalTitle = document.getElementById('add-requisicao-modal-title');
            if (modalTitle) modalTitle.textContent = 'Nova Requisição';
            const submitBtn = document.getElementById('btn-submit-add-requisicao');
            if (submitBtn) submitBtn.textContent = 'Salvar';

            const today = new Date();
            const inputDate = document.getElementById('input-date');
            if (inputDate) inputDate.value = formatDateIso(today);
            
            // Atualizar todas as datalists com os dados mais recentes do banco
            if (typeof buildFilterButtons === 'function') {
                buildFilterButtons();
            }

            // Popular a lista de requisições de uso único disponíveis
            populateRequisicoesDatalist('datalist-requisicoes', state.customRequisicoes);
            
            const inputKmAnterior = document.getElementById('input-km-anterior');
            if (inputKmAnterior) inputKmAnterior.value = '';
            
            const addReqModal = document.getElementById('add-requisicao-modal');
            if (addReqModal) addReqModal.classList.add('active');
        });
    }

    // Função para calcular automaticamente a quantidade de requisições
    function calculateQtdRequisicoes() {
        const inicioVal = document.getElementById('input-inicio-seq').value.trim();
        const fimVal = document.getElementById('input-fim-seq').value.trim();
        const inputQtd = document.getElementById('input-qtd-req');
        if (inicioVal && fimVal && inputQtd) {
            if (inicioVal === fimVal) {
                inputQtd.value = 1;
                return;
            }
            const inicio = parseInt(inicioVal);
            const fim = parseInt(fimVal);
            if (!isNaN(inicio) && !isNaN(fim)) {
                if (fim >= inicio) {
                    inputQtd.value = (fim - inicio) + 1;
                } else {
                    inputQtd.value = 1;
                }
            } else {
                inputQtd.value = 1;
            }
        }
    }

    // Preencher automaticamente combustível/litros a partir do vínculo da requisição
    const inputInicioSeq = document.getElementById('input-inicio-seq');
    if (inputInicioSeq) {
        inputInicioSeq.addEventListener('input', function() {
            const val = this.value.trim();

            // Auto-preencher tipo de combustível e litros a partir do vínculo da requisição
            if (state.mappings.reqToFuelAndLiters && state.mappings.reqToFuelAndLiters[val]) {
                const info = state.mappings.reqToFuelAndLiters[val];
                if (info.fuel) {
                    const selectComb = document.getElementById('input-combustivel');
                    if (selectComb) {
                        selectComb.value = info.fuel;
                    }
                }
                if (info.liters) {
                    const litersVal = parseFloat(info.liters.replace(',', '.'));
                    if (!isNaN(litersVal)) {
                        // Forçar modo litros
                        const modeLitros = document.querySelector('input[name="input-modo-abastecimento"][value="litros"]');
                        if (modeLitros) {
                            modeLitros.checked = true;
                            document.getElementById('group-litros').style.display = 'flex';
                            document.getElementById('group-valor-total').style.display = 'none';
                        }
                        const inputLitros = document.getElementById('input-litros');
                        if (inputLitros) {
                            inputLitros.value = litersVal;
                        }
                    }
                }
            }
        });
    }

    const inputDate = document.getElementById('input-date');
    if (inputDate) {
        inputDate.addEventListener('click', function() {
            if (typeof this.showPicker === 'function') {
                try {
                    this.showPicker();
                } catch (e) {
                    console.error('Falha ao exibir o seletor de data:', e);
                }
            }
        });
    }

    // Fechar modal de Nova Requisição
    document.getElementById('btn-close-add-requisicao').addEventListener('click', () => {
        document.getElementById('add-requisicao-modal').classList.remove('active');
    });

    document.getElementById('btn-cancel-add-requisicao').addEventListener('click', () => {
        document.getElementById('add-requisicao-modal').classList.remove('active');
    });

    // Autocompletes relacionais no formulário de Nova Requisição
    const inputZona = document.getElementById('input-zona');
    const inputResponsavel = document.getElementById('input-responsavel');
    const inputPlaca = document.getElementById('input-placa');
    const inputVeiculo = document.getElementById('input-veiculo');
    const inputPosto = document.getElementById('input-posto');
    const inputPrecoLitro = document.getElementById('input-preco-litro');

    if (inputZona) {
        inputZona.addEventListener('input', function() {
            const valLower = this.value.toLowerCase().trim();
            if (state.mappings.baseToResponsavel[valLower]) {
                inputResponsavel.value = state.mappings.baseToResponsavel[valLower];
            }
        });
    }

    if (inputResponsavel) {
        inputResponsavel.addEventListener('input', function() {
            const valLower = this.value.toLowerCase().trim();
            if (state.mappings.responsavelToBase[valLower]) {
                inputZona.value = state.mappings.responsavelToBase[valLower];
            }
        });
    }

    if (inputPlaca) {
        inputPlaca.addEventListener('input', function() {
            const valUpper = this.value.toUpperCase().trim();
            if (state.mappings.placaToVeiculo[valUpper]) {
                inputVeiculo.value = state.mappings.placaToVeiculo[valUpper];
            }
            
            // Preenchimento inteligente adicional para veículos contratados
            if (state.mappings.contratados && state.mappings.contratados[valUpper]) {
                const info = state.mappings.contratados[valUpper];
                
                const inputCombustivel = document.getElementById('input-combustivel');
                if (inputCombustivel && info.combustivel) {
                    inputCombustivel.value = info.combustivel;
                }
                
                const inputMotorista = document.getElementById('input-motorista');
                if (inputMotorista && info.motorista) {
                    inputMotorista.value = info.motorista;
                }
                
                const inputZona = document.getElementById('input-zona');
                if (inputZona && info.base) {
                    inputZona.value = info.base;
                    // Forçar o preenchimento de responsável se mapeado
                    const baseLower = info.base.toLowerCase().trim();
                    if (state.mappings.baseToResponsavel[baseLower]) {
                        const inputResponsavel = document.getElementById('input-responsavel');
                        if (inputResponsavel) {
                            inputResponsavel.value = state.mappings.baseToResponsavel[baseLower];
                        }
                    }
                }
            }

            updateKmAnterior(valUpper);
        });
    }

    if (inputVeiculo) {
        inputVeiculo.addEventListener('input', function() {
            const val = this.value.trim();
            updatePlacaDatalistOptions(val);

            // Se o veículo corresponder a exatamente uma placa, preenche ela automaticamente
            const valLower = val.toLowerCase();
            const plates = [];
            for (const key in state.mappings.placaToVeiculo) {
                if (state.mappings.placaToVeiculo[key].toLowerCase() === valLower) {
                    plates.push(key);
                }
            }
            if (plates.length === 1) {
                if (inputPlaca) inputPlaca.value = plates[0];
                updateKmAnterior(plates[0]);
            }
        });
        inputVeiculo.addEventListener('blur', function() {
            if (!this.value.trim()) {
                updatePlacaDatalistOptions('');
            }
        });
    }

    if (inputPosto) {
        inputPosto.addEventListener('input', function() {
            const valLower = this.value.toLowerCase().trim();
            if (state.mappings.postoToPrice && state.mappings.postoToPrice[valLower] !== undefined) {
                if (inputPrecoLitro) {
                    inputPrecoLitro.value = state.mappings.postoToPrice[valLower];
                }
            }
        });
    }

    // Submissão do Formulário de Nova Requisição
    document.getElementById('form-add-requisicao').addEventListener('submit', (e) => {
        e.preventDefault();

        const inicioSeq = document.getElementById('input-inicio-seq').value.trim();
        const inputFimEl = document.getElementById('input-fim-seq');
        const fimSeq = inputFimEl ? inputFimEl.value.trim() : inicioSeq;

        // Validar unicidade da sequência de requisição informada
        if (inicioSeq) {
            const duplicateNum = isRequisitionRangeUsed(inicioSeq, fimSeq);
            if (duplicateNum !== null) {
                alert(`A requisição nº ${duplicateNum} já foi utilizada em outro lançamento! Insira uma sequência única.`);
                return;
            }
        }

        const dateVal = parseInputDate(document.getElementById('input-date').value);
        const zona = document.getElementById('input-zona').value.trim();
        const responsavel = document.getElementById('input-responsavel').value.trim();
        const posto = document.getElementById('input-posto').value.trim();
        const motorista = document.getElementById('input-motorista').value.trim();
        const veiculo = document.getElementById('input-veiculo').value.trim();
        const placa = document.getElementById('input-placa').value.trim().toUpperCase();
        const combustivel = document.getElementById('input-combustivel').value.trim();
        const kmAnterior = document.getElementById('input-km-anterior').value.trim();
        const km = document.getElementById('input-km').value.trim();

        const qtdRequisicoes = parseInt(document.getElementById('input-qtd-req').value) || 1;
        const precoLitro = parseFloat(document.getElementById('input-preco-litro').value) || 0;

        const modo = document.querySelector('input[name="input-modo-abastecimento"]:checked').value;
        let litros = 0;
        let valor = 0;

        if (modo === 'litros') {
            litros = parseFloat(document.getElementById('input-litros').value) || 0;
            valor = qtdRequisicoes * litros * precoLitro;
        } else {
            const valorPorReq = parseFloat(document.getElementById('input-valor-total').value) || 0;
            valor = qtdRequisicoes * valorPorReq;
            litros = precoLitro > 0 ? (valorPorReq / precoLitro) : 0;
        }

        const newRecord = {
            id: Date.now() + '-' + Math.random(),
            date: dateVal,
            month: dateVal.getMonth(),
            year: dateVal.getFullYear(),
            inicioSeq: inicioSeq,
            fimSeq: fimSeq,
            qtdRequisicoes: qtdRequisicoes,
            zona: zona || 'NÃO INFORMADO',
            responsavel: responsavel || 'NÃO INFORMADO',
            posto: posto || 'NÃO INFORMADO',
            motorista: motorista || 'NÃO INFORMADO',
            veiculo: veiculo || 'NÃO INFORMADO',
            placa: placa || 'NÃO INFORMADO',
            kmAnterior: kmAnterior || 'NÃO INFORMADO',
            km: km || 'NÃO INFORMADO',
            combustivel: combustivel || 'NÃO INFORMADO',
            lote: document.getElementById('input-add-lote')?.value || 'LOTE 3 (15K)',
            litros: litros,
            precoLitro: precoLitro,
            valor: valor
        };

        // Remover número(s) da sequência da lista de requisições disponíveis (uso único) de forma transacional pós-sucesso
        const isFileProtocol = window.location.protocol === 'file:';
        const editId = document.getElementById('input-edit-id') ? document.getElementById('input-edit-id').value : '';

        if (isFileProtocol) {
            // Se for offline (local), salva apenas no localStorage e atualiza a UI
            if (editId) {
                if (state.oldEditSeqs && (state.oldEditSeqs.inicioSeq !== inicioSeq || state.oldEditSeqs.fimSeq !== fimSeq)) {
                    restoreSeqsToPool(state.oldEditSeqs.inicioSeq, state.oldEditSeqs.fimSeq);
                    if (inicioSeq) {
                        removeUsedRequisitions();
                    }
                }
                const index = state.rawData.findIndex(row => row.id === editId);
                if (index !== -1) {
                    newRecord.id = editId;
                    state.rawData[index] = newRecord;
                }
            } else {
                if (inicioSeq) {
                    removeUsedRequisitions();
                }
                state.rawData.push(newRecord);
            }
            localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
            finalizeAddRequisition();
        } else {
            // Se for online (servidor), faz a sincronização de forma síncrona
            showLoading('Salvando lançamento no banco de dados...');
            
            // Preparar o payload completo
            let tempRawData = [...state.rawData];
            if (editId) {
                const index = tempRawData.findIndex(row => row.id === editId);
                if (index !== -1) {
                    newRecord.id = editId;
                    tempRawData[index] = newRecord;
                }
            } else {
                tempRawData.push(newRecord);
            }

            let tempCustomRequisicoes = state.customRequisicoes || [];
            
            if (editId) {
                if (state.oldEditSeqs && (state.oldEditSeqs.inicioSeq !== inicioSeq || state.oldEditSeqs.fimSeq !== fimSeq)) {
                    tempCustomRequisicoes = restoreSeqsToPoolTemp(tempCustomRequisicoes, state.oldEditSeqs.inicioSeq, state.oldEditSeqs.fimSeq);
                    if (inicioSeq) {
                        tempCustomRequisicoes = removeUsedRequisitionsTemp(tempCustomRequisicoes, inicioSeq, fimSeq);
                    }
                }
            } else {
                if (inicioSeq) {
                    tempCustomRequisicoes = removeUsedRequisitionsTemp(tempCustomRequisicoes, inicioSeq, fimSeq);
                }
            }

            const syncPayload = {
                environment: state.activeEnv,
                requisicoes: tempRawData,
                custom_bases: state.customBases,
                custom_postos: state.customPostos,
                custom_motoristas: state.customMotoristas,
                custom_veiculos: state.customVeiculos,
                custom_requisicoes: tempCustomRequisicoes
            };

            fetch('./api/sync_data.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(syncPayload)
            })
            .then(res => {
                if (!res.ok) throw new Error('Falha HTTP na resposta do servidor.');
                return res.json();
            })
            .then(result => {
                if (result.success) {
                    // Confirma a inserção/edição no estado da aplicação
                    if (editId) {
                        if (state.oldEditSeqs && (state.oldEditSeqs.inicioSeq !== inicioSeq || state.oldEditSeqs.fimSeq !== fimSeq)) {
                            restoreSeqsToPool(state.oldEditSeqs.inicioSeq, state.oldEditSeqs.fimSeq);
                            if (inicioSeq) {
                                removeUsedRequisitions();
                            }
                        }
                        const index = state.rawData.findIndex(row => row.id === editId);
                        if (index !== -1) {
                            newRecord.id = editId;
                            state.rawData[index] = newRecord;
                        }
                    } else {
                        if (inicioSeq) {
                            removeUsedRequisitions();
                        }
                        state.rawData.push(newRecord);
                    }
                    localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
                    
                    finalizeAddRequisition();
                    hideLoading();
                } else {
                    throw new Error(result.message || 'Erro desconhecido retornado pelo servidor.');
                }
            })
            .catch(err => {
                hideLoading();
                console.error(err);
                alert('Erro ao salvar no banco de dados online: ' + err.message + '\n\nO lançamento NÃO foi registrado. Por favor, verifique sua conexão e tente novamente.');
            });
        }

        function removeUsedRequisitions() {
            const startObj = parseSeqString(inicioSeq);
            const endObj = parseSeqString(fimSeq || inicioSeq);
            const usedNumbers = [];
            if (!isNaN(startObj.num)) {
                const startNum = startObj.num;
                const endNum = isNaN(endObj.num) ? startNum : endObj.num;
                for (let n = startNum; n <= endNum; n++) {
                    if (startObj.prefix) {
                        const match = inicioSeq.toString().trim().match(/^(.*)-(\d+)$/);
                        const padLength = match ? match[2].length : 3;
                        usedNumbers.push(`${startObj.prefix}-${n.toString().padStart(padLength, '0')}`);
                    } else {
                        usedNumbers.push(n.toString());
                    }
                }
            } else {
                usedNumbers.push(inicioSeq.toString().trim());
            }

            state.customRequisicoes = (state.customRequisicoes || []).filter(line => {
                const parts = splitByRelationalHyphen(line);
                const reqNum = parts.length > 0 ? parts[0].trim() : '';
                return !usedNumbers.includes(reqNum);
            });
            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            populateRequisicoesDatalist('datalist-requisicoes', state.customRequisicoes);
        }

        function restoreSeqsToPool(inicio, fim) {
            if (!inicio) return;
            const startObj = parseSeqString(inicio);
            const endObj = parseSeqString(fim || inicio);
            const restoredNumbers = [];
            if (!isNaN(startObj.num)) {
                const startNum = startObj.num;
                const endNum = isNaN(endObj.num) ? startNum : endObj.num;
                for (let n = startNum; n <= endNum; n++) {
                    if (startObj.prefix) {
                        const match = inicio.toString().trim().match(/^(.*)-(\d+)$/);
                        const padLength = match ? match[2].length : 3;
                        restoredNumbers.push(`${startObj.prefix}-${n.toString().padStart(padLength, '0')}`);
                    } else {
                        restoredNumbers.push(n.toString());
                    }
                }
            } else {
                restoredNumbers.push(inicio.toString().trim());
            }
            
            const currentPool = state.customRequisicoes || [];
            const newPool = Array.from(new Set([...currentPool, ...restoredNumbers])).sort((a, b) => {
                const aObj = parseSeqString(a);
                const bObj = parseSeqString(b);
                if (aObj.prefix !== bObj.prefix) {
                    return aObj.prefix.localeCompare(bObj.prefix);
                }
                return aObj.num - bObj.num;
            });
            state.customRequisicoes = newPool;
            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            populateRequisicoesDatalist('datalist-requisicoes', state.customRequisicoes);
        }

        function removeUsedRequisitionsTemp(pool, inicio, fim) {
            const startObj = parseSeqString(inicio);
            const endObj = parseSeqString(fim || inicio);
            const usedNumbers = [];
            if (!isNaN(startObj.num)) {
                const startNum = startObj.num;
                const endNum = isNaN(endObj.num) ? startNum : endObj.num;
                for (let n = startNum; n <= endNum; n++) {
                    if (startObj.prefix) {
                        const match = inicio.toString().trim().match(/^(.*)-(\d+)$/);
                        const padLength = match ? match[2].length : 3;
                        usedNumbers.push(`${startObj.prefix}-${n.toString().padStart(padLength, '0')}`);
                    } else {
                        usedNumbers.push(n.toString());
                    }
                }
            } else {
                usedNumbers.push(inicio.toString().trim());
            }

            return pool.filter(line => {
                const parts = splitByRelationalHyphen(line);
                const reqNum = parts.length > 0 ? parts[0].trim() : '';
                return !usedNumbers.includes(reqNum);
            });
        }

        function restoreSeqsToPoolTemp(pool, inicio, fim) {
            if (!inicio) return pool;
            const startObj = parseSeqString(inicio);
            const endObj = parseSeqString(fim || inicio);
            const restoredNumbers = [];
            if (!isNaN(startObj.num)) {
                const startNum = startObj.num;
                const endNum = isNaN(endObj.num) ? startNum : endObj.num;
                for (let n = startNum; n <= endNum; n++) {
                    if (startObj.prefix) {
                        const match = inicio.toString().trim().match(/^(.*)-(\d+)$/);
                        const padLength = match ? match[2].length : 3;
                        restoredNumbers.push(`${startObj.prefix}-${n.toString().padStart(padLength, '0')}`);
                    } else {
                        restoredNumbers.push(n.toString());
                    }
                }
            } else {
                restoredNumbers.push(inicio.toString().trim());
            }

            return Array.from(new Set([...pool, ...restoredNumbers])).sort((a, b) => {
                const aObj = parseSeqString(a);
                const bObj = parseSeqString(b);
                if (aObj.prefix !== bObj.prefix) {
                    return aObj.prefix.localeCompare(bObj.prefix);
                }
                return aObj.num - bObj.num;
            });
        }

        function finalizeAddRequisition() {
            document.getElementById('add-requisicao-modal').classList.remove('active');
            document.getElementById('form-add-requisicao').reset();
            
            // Resetar para modo litros padrão
            const radioLitros = document.querySelector('input[name="input-modo-abastecimento"][value="litros"]');
            if (radioLitros) radioLitros.checked = true;
            
            const groupLitros = document.getElementById('group-litros');
            if (groupLitros) groupLitros.style.display = 'flex';
            
            const groupValTotal = document.getElementById('group-valor-total');
            if (groupValTotal) groupValTotal.style.display = 'none';
            
            const inputLitros = document.getElementById('input-litros');
            if (inputLitros) inputLitros.setAttribute('required', '');
            
            const inputValTotal = document.getElementById('input-valor-total');
            if (inputValTotal) inputValTotal.removeAttribute('required');

            // Atualizar range de datas para contemplar a nova requisição
            initDateFilterRange();

            buildFilterButtons();
            updateDashboard();
        }
    });

    // Alternância de abas no modal de cadastros
    document.querySelectorAll('.cadastro-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-tab-id');
            
            // Ativar botão
            document.querySelectorAll('.cadastro-tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Alternar conteúdos
            document.querySelectorAll('.cadastro-tab-content').forEach(content => {
                content.style.display = 'none';
            });
            const targetContent = document.getElementById(targetId);
            if (targetContent) {
                targetContent.style.display = 'block';
            }
        });
    });

    // Modal Cadastros
    // Modal Central de Cadastros Estruturada
    const cadastrosModal = document.getElementById('cadastros-modal');
    const btnOpenCadastros = document.getElementById('btn-open-cadastros');
    const btnCloseCadastros = document.getElementById('btn-close-cadastros');
    const btnCancelCadastros = document.getElementById('btn-cancel-cadastros');

    // Inicializar Abas da Central de Cadastros
    document.querySelectorAll('.cadastro-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.cadastro-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.cadastro-tab-content').forEach(c => {
                c.classList.remove('active');
                c.style.display = 'none';
            });

            btn.classList.add('active');
            const targetContent = document.getElementById(btn.dataset.tabId);
            if (targetContent) {
                targetContent.classList.add('active');
                targetContent.style.display = 'block';
            }
        });
    });

    if (btnOpenCadastros) {
        btnOpenCadastros.addEventListener('click', () => {
            // Abrir na primeira aba por padrão
            const firstTab = document.querySelector('.cadastro-tab-btn');
            if (firstTab) firstTab.click();

            renderStructuredCadastrosUI();
            cadastrosModal.classList.add('active');
        });
    }

    if (btnCloseCadastros) btnCloseCadastros.addEventListener('click', () => cadastrosModal.classList.remove('active'));
    if (btnCancelCadastros) btnCancelCadastros.addEventListener('click', () => cadastrosModal.classList.remove('active'));

    if (cadastrosModal) {
        cadastrosModal.addEventListener('click', (e) => {
            if (e.target === cadastrosModal) cadastrosModal.classList.remove('active');
        });
    }

    // 1. Adicionar / Salvar Base Estruturada
    const btnAddBase = document.getElementById('btn-add-base-item');
    if (btnAddBase) {
        btnAddBase.addEventListener('click', () => {
            const inputNome = document.getElementById('input-new-base-nome');
            const inputResp = document.getElementById('input-new-base-resp');
            const nome = inputNome ? inputNome.value.trim().toUpperCase() : '';
            const resp = inputResp ? inputResp.value.trim().toUpperCase() : '';

            if (!nome) {
                alert('Informe o nome da Base.');
                return;
            }

            const itemStr = resp ? `${nome} - ${resp}` : nome;
            if (!state.customBases) state.customBases = [];

            const editIdx = btnAddBase.dataset.editIndex;
            if (editIdx !== undefined && editIdx !== '') {
                state.customBases[parseInt(editIdx, 10)] = itemStr;
                btnAddBase.dataset.editIndex = '';
                btnAddBase.textContent = 'Adicionar Base';
            } else {
                state.customBases.push(itemStr);
            }

            localStorage.setItem(getEnvKey('custom_bases'), JSON.stringify(state.customBases));
            syncWithServerSilent();

            if (inputNome) inputNome.value = '';
            if (inputResp) inputResp.value = '';

            updateRelationsMappings();
            buildFilterButtons();
            renderStructuredCadastrosUI();
        });
    }

    // 2. Adicionar / Salvar Veículo Estruturado
    const btnAddVeic = document.getElementById('btn-add-veic-item');
    if (btnAddVeic) {
        btnAddVeic.addEventListener('click', () => {
            const inputPlaca = document.getElementById('input-new-veic-placa');
            const inputTipo = document.getElementById('input-new-veic-tipo');
            const inputComb = document.getElementById('input-new-veic-comb');

            const placa = inputPlaca ? inputPlaca.value.trim().toUpperCase() : '';
            const tipo = inputTipo ? inputTipo.value.trim() : '';

            if (!placa) {
                alert('Informe a Placa do veículo.');
                return;
            }

            const itemStr = tipo ? `${placa} - ${tipo}` : placa;
            if (!state.customVeiculos) state.customVeiculos = [];

            const editIdx = btnAddVeic.dataset.editIndex;
            if (editIdx !== undefined && editIdx !== '') {
                state.customVeiculos[parseInt(editIdx, 10)] = itemStr;
                btnAddVeic.dataset.editIndex = '';
                btnAddVeic.textContent = 'Adicionar Veículo';
            } else {
                state.customVeiculos.push(itemStr);
            }

            localStorage.setItem(getEnvKey('custom_veiculos'), JSON.stringify(state.customVeiculos));
            syncWithServerSilent();

            if (inputPlaca) inputPlaca.value = '';
            if (inputTipo) inputTipo.value = '';

            updateRelationsMappings();
            buildFilterButtons();
            renderStructuredCadastrosUI();
        });
    }

    // 3. Adicionar / Salvar Posto Estruturado
    const btnAddPosto = document.getElementById('btn-add-posto-item');
    if (btnAddPosto) {
        btnAddPosto.addEventListener('click', () => {
            const inputNome = document.getElementById('input-new-posto-nome');
            const inputPreco = document.getElementById('input-new-posto-preco');

            const nome = inputNome ? inputNome.value.trim().toUpperCase() : '';
            const preco = inputPreco ? parseFloat(inputPreco.value) || 0 : 0;

            if (!nome) {
                alert('Informe o nome do Posto.');
                return;
            }

            const itemStr = preco > 0 ? `${nome} - ${preco.toFixed(3)}` : nome;
            if (!state.customPostos) state.customPostos = [];

            const editIdx = btnAddPosto.dataset.editIndex;
            if (editIdx !== undefined && editIdx !== '') {
                state.customPostos[parseInt(editIdx, 10)] = itemStr;
                btnAddPosto.dataset.editIndex = '';
                btnAddPosto.textContent = 'Adicionar Posto';
            } else {
                state.customPostos.push(itemStr);
            }

            localStorage.setItem(getEnvKey('custom_postos'), JSON.stringify(state.customPostos));
            syncWithServerSilent();

            if (inputNome) inputNome.value = '';
            if (inputPreco) inputPreco.value = '';

            updateRelationsMappings();
            buildFilterButtons();
            renderStructuredCadastrosUI();
        });
    }

    // 4. Gerar Faixa Sequencial de Requisições para o Lote
    const btnAddLoteRange = document.getElementById('btn-add-lote-range');
    if (btnAddLoteRange) {
        btnAddLoteRange.addEventListener('click', () => {
            const loteNome = document.getElementById('input-new-lote-nome')?.value.trim() || 'LOTE 4 (10K)';
            const controlCode = document.getElementById('input-new-lote-control')?.value.trim() || '1787595670733';
            const startSeq = parseInt(document.getElementById('input-new-lote-start')?.value, 10) || 1;
            const endSeq = parseInt(document.getElementById('input-new-lote-end')?.value, 10) || 100;
            const litros = parseInt(document.getElementById('input-new-lote-litros')?.value, 10) || 30;

            if (endSeq < startSeq) {
                alert('A sequência final deve ser maior ou igual à sequência inicial.');
                return;
            }

            if (!state.customRequisicoes) state.customRequisicoes = [];

            let addedCount = 0;
            for (let i = startSeq; i <= endSeq; i++) {
                const seqPad = String(i).padStart(3, '0');
                const reqStr = `${controlCode}-${seqPad} - ${litros}L (${loteNome})`;
                if (!state.customRequisicoes.includes(reqStr)) {
                    state.customRequisicoes.push(reqStr);
                    addedCount++;
                }
            }

            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            syncWithServerSilent();

            alert(`✅ ${addedCount} requisições geradas com sucesso para o ${loteNome}!`);
            updateRelationsMappings();
            populateDatalist('datalist-requisicoes', state.customRequisicoes);
            buildFilterButtons();
            renderStructuredCadastrosUI();
        });
    }

    // 5. Salvar Importação em Massa (Texto)
    const formCadastros = document.getElementById('form-cadastros');
    if (formCadastros) {
        formCadastros.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const basesText = document.getElementById('textarea-custom-bases')?.value || '';
            const postosText = document.getElementById('textarea-custom-postos')?.value || '';
            const motoristasText = document.getElementById('textarea-custom-motoristas')?.value || '';
            const veiculosText = document.getElementById('textarea-custom-veiculos')?.value || '';
            const requisicoesText = document.getElementById('textarea-custom-requisicoes')?.value || '';
            
            state.customBases = basesText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customPostos = postosText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customMotoristas = motoristasText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customVeiculos = veiculosText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customRequisicoes = requisicoesText.split('\n').map(s => s.trim()).filter(Boolean);
            
            localStorage.setItem(getEnvKey('custom_bases'), JSON.stringify(state.customBases));
            localStorage.setItem(getEnvKey('custom_postos'), JSON.stringify(state.customPostos));
            localStorage.setItem(getEnvKey('custom_motoristas'), JSON.stringify(state.customMotoristas));
            localStorage.setItem(getEnvKey('custom_veiculos'), JSON.stringify(state.customVeiculos));
            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            syncWithServerSilent();
            
            populateDatalist('datalist-requisicoes', state.customRequisicoes);
            updateRelationsMappings();
            buildFilterButtons();
            renderStructuredCadastrosUI();
            alert('Cadastros salvos com sucesso!');
        });
    }

    // Chips de Litragem Rápida no formulário de Nova Requisição
    document.querySelectorAll('.btn-quick-litro').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.btn-quick-litro').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const litros = parseFloat(this.dataset.litro);
            const inputLitros = document.getElementById('input-litros');
            if (inputLitros) {
                inputLitros.value = litros;
                inputLitros.dispatchEvent(new Event('input'));
            }
        });
    });

    // Modo de Abastecimento (Litros ou Valor) no Formulário
    document.querySelectorAll('input[name="input-modo-abastecimento"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            const groupLitros = document.getElementById('group-litros');
            const groupValor = document.getElementById('group-valor-total');
            const inputLitros = document.getElementById('input-litros');
            const inputValorTotal = document.getElementById('input-valor-total');
            
            if (mode === 'litros') {
                groupLitros.style.display = 'flex';
                groupValor.style.display = 'none';
                inputValorTotal.value = '';
                inputLitros.setAttribute('required', '');
                inputValorTotal.removeAttribute('required');
            } else {
                groupLitros.style.display = 'none';
                groupValor.style.display = 'flex';
                inputLitros.value = '';
                inputValorTotal.setAttribute('required', '');
                inputLitros.removeAttribute('required');
            }
        });
    });

    // Exportar base atualizada para Excel
    document.getElementById('btn-export-excel').addEventListener('click', () => {
        exportToExcel();
    });

    // Toggle do Assistente NLQ
    const nlqToggle = document.getElementById('nlq-toggle');
    const nlqContainer = document.getElementById('nlq-container');
    if (nlqToggle && nlqContainer) {
        nlqToggle.addEventListener('click', () => {
            nlqContainer.classList.toggle('collapsed');
        });
    }

    // Modal Infográfico
    const infoModal = document.getElementById('infografico-modal');
    const btnOpenInfo = document.getElementById('btn-open-infografico');
    const btnCloseInfo = document.getElementById('btn-close-infografico');
    const btnCancelInfo = document.getElementById('btn-cancel-infografico');
    const btnPrintInfo = document.getElementById('btn-print-infografico');

    if (btnOpenInfo) {
        btnOpenInfo.addEventListener('click', () => {
            populateInfografico();
            infoModal.classList.add('active');
        });
    }

    if (btnCloseInfo) btnCloseInfo.addEventListener('click', () => infoModal.classList.remove('active'));
    if (btnCancelInfo) btnCancelInfo.addEventListener('click', () => infoModal.classList.remove('active'));

    infoModal.addEventListener('click', (e) => {
        if (e.target === infoModal) infoModal.classList.remove('active');
    });

    const triggerPrint = () => {
        if (typeof updatePrintTimestamps === 'function') {
            updatePrintTimestamps();
        }
        document.body.classList.add('printing-infografico');
        window.print();
        setTimeout(() => {
            document.body.classList.remove('printing-infografico');
        }, 1000);
    };

    if (btnPrintInfo) btnPrintInfo.addEventListener('click', triggerPrint);
    const btnPrintInfoTop = document.getElementById('btn-print-infografico-top');
    if (btnPrintInfoTop) btnPrintInfoTop.addEventListener('click', triggerPrint);

    // Modal Relatório Simplificado
    const relModal = document.getElementById('relatorio-simplificado-modal');
    const btnOpenRel = document.getElementById('btn-open-relatorio-simplificado');
    const btnCloseRel = document.getElementById('btn-close-relatorio-simplificado');
    const btnCancelRel = document.getElementById('btn-cancel-relatorio-simplificado');
    const btnPrintRel = document.getElementById('btn-print-relatorio-simplificado');
    const btnPrintRelTop = document.getElementById('btn-print-relatorio-simplificado-top');

    if (btnOpenRel && relModal) {
        btnOpenRel.addEventListener('click', () => {
            populateRelatorioSimplificado();
            relModal.classList.add('active');
        });
    }

    if (btnCloseRel && relModal) btnCloseRel.addEventListener('click', () => relModal.classList.remove('active'));
    if (btnCancelRel && relModal) btnCancelRel.addEventListener('click', () => relModal.classList.remove('active'));

    if (relModal) {
        relModal.addEventListener('click', (e) => {
            if (e.target === relModal) relModal.classList.remove('active');
        });
    }

    const triggerPrintRel = () => {
        if (typeof updatePrintTimestamps === 'function') {
            updatePrintTimestamps();
        }
        const originalTitle = document.title;
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        document.title = `Relatorio_Simplificado_Consumo_MGP_${dd}${mm}${yyyy}`;

        document.body.classList.add('printing-relatorio-simplificado');
        setTimeout(() => {
            window.print();
            setTimeout(() => {
                document.body.classList.remove('printing-relatorio-simplificado');
                document.title = originalTitle;
            }, 800);
        }, 150);
    };

    if (btnPrintRel) btnPrintRel.addEventListener('click', triggerPrintRel);
    if (btnPrintRelTop) btnPrintRelTop.addEventListener('click', triggerPrintRel);
}

// 2. VERIFICAR SE FOI SOLICITADO UPDATE VIA PARAMETROS URL
function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('update')) {
        document.getElementById('upload-modal').classList.add('active');
        window.history.replaceState({}, document.title, window.location.pathname);
    }
}

// 3. CARREGAR DADOS INICIAIS (AUTO-LINK E LOCALSTORAGE FALLBACK)
function loadInitialData(forceFetch = false) {
    // Carregar configurações de ambiente
    try {
        let defaultEnv = 'Frota Principal';
        if (window.location.pathname.includes('Frota_B') || window.location.pathname.includes('Frota-B')) {
            defaultEnv = 'Frota B';
        }
        state.environments = JSON.parse(localStorage.getItem('dashboard_environments') || `["${defaultEnv}"]`);
        state.activeEnv = localStorage.getItem('dashboard_active_environment') || defaultEnv;
        
        // Se mudou o ambiente padrão com base no caminho e não está na lista de frotas salvas, adiciona
        if (!state.environments.includes(defaultEnv)) {
            state.environments.push(defaultEnv);
            localStorage.setItem('dashboard_environments', JSON.stringify(state.environments));
        }

        populateEnvironmentSelector();
    } catch (e) {
        let defaultEnv = 'Frota Principal';
        if (window.location.pathname.includes('Frota_B') || window.location.pathname.includes('Frota-B')) {
            defaultEnv = 'Frota B';
        }
        state.environments = [defaultEnv];
        state.activeEnv = defaultEnv;
    }

    try {
        state.customBases = JSON.parse(localStorage.getItem(getEnvKey('custom_bases')) || '[]');
        state.customPostos = JSON.parse(localStorage.getItem(getEnvKey('custom_postos')) || '[]');
        state.customMotoristas = JSON.parse(localStorage.getItem(getEnvKey('custom_motoristas')) || '[]');
        state.customVeiculos = JSON.parse(localStorage.getItem(getEnvKey('custom_veiculos')) || '[]');
        state.customRequisicoes = JSON.parse(localStorage.getItem(getEnvKey('custom_requisicoes')) || '[]');
        updateRelationsMappings();
    } catch (e) {}

    const isFileProtocol = window.location.protocol === 'file:';
    const savedData = localStorage.getItem(getEnvKey('combustivel_dashboard_data'));
    const savedFilename = localStorage.getItem(getEnvKey('combustivel_dashboard_filename'));

    // SE ESTIVER ONLINE (HOSPEDADO NO SERVIDOR WEB), TENTA CONECTAR AO BANCO MYSQL PRIMEIRO
    if (!isFileProtocol && !forceFetch) {
        showLoading('Sincronizando com banco de dados MySQL...');
        fetch(`./api/get_data.php?env=${encodeURIComponent(state.activeEnv)}`)
            .then(res => {
                if (!res.ok) throw new Error('Falha HTTP ao contatar API de sincronização');
                return res.json();
            })
            .then(result => {
                if (result.success) {
                    // Mapear lançamentos vindos do banco
                    state.rawData = (result.requisicoes || []).map(row => {
                        return {
                            ...row,
                            date: new Date(row.date),
                            qtdRequisicoes: parseInt(row.qtdRequisicoes) || 1,
                            kmAnterior: row.kmAnterior !== null && row.kmAnterior !== undefined ? row.kmAnterior : '',
                            km: row.km !== null && row.km !== undefined ? row.km : '',
                            litros: parseFloat(row.litros) || 0,
                            precoLitro: parseFloat(row.precoLitro) || 0,
                            valor: parseFloat(row.valor) || 0
                        };
                    });
                    
                    state.filename = `Nuvem MySQL: ${state.activeEnv}`;
                    localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
                    localStorage.setItem(getEnvKey('combustivel_dashboard_filename'), state.filename);
                    updateFilenameDisplay();

                    if (result.environments && result.environments.length > 0) {
                        state.environments = result.environments;
                        localStorage.setItem('dashboard_environments', JSON.stringify(state.environments));
                        populateEnvironmentSelector();
                    }

                    // Se vierem configurações customizadas do servidor, sincroniza no navegador
                    if (result.configuracoes) {
                        try {
                            const conf = result.configuracoes;
                            state.customBases = JSON.parse(conf.custom_bases || '[]');
                            state.customPostos = JSON.parse(conf.custom_postos || '[]');
                            state.customMotoristas = JSON.parse(conf.custom_motoristas || '[]');
                            state.customVeiculos = JSON.parse(conf.custom_veiculos || '[]');
                            state.customRequisicoes = JSON.parse(conf.custom_requisicoes || '[]');
                            
                            localStorage.setItem(getEnvKey('custom_bases'), conf.custom_bases || '[]');
                            localStorage.setItem(getEnvKey('custom_postos'), conf.custom_postos || '[]');
                            localStorage.setItem(getEnvKey('custom_motoristas'), conf.custom_motoristas || '[]');
                            localStorage.setItem(getEnvKey('custom_veiculos'), conf.custom_veiculos || '[]');
                            localStorage.setItem(getEnvKey('custom_requisicoes'), conf.custom_requisicoes || '[]');
                            
                            updateRelationsMappings();
                        } catch (e) {
                            console.error('Erro ao fundir configurações remotas:', e);
                        }
                    }

                    // Sincronizar autocompletes dos veículos contratados em paralelo
                    fetchContratadosForAutocomplete();

                    try {
                        processData(state.rawData, false);
                    } catch (e) {
                        console.error('Erro no processamento dos dados:', e);
                        hideLoading();
                        alert('Erro ao carregar os dados no dashboard: ' + e.message);
                    }
                } else {
                    throw new Error(result.message || 'Erro desconhecido na resposta da API');
                }
            })
            .catch(err => {
                console.warn('Banco online inacessível ou falhou. Recaindo para cache local.', err);
                try {
                    if (savedData) {
                        state.rawData = JSON.parse(savedData);
                        state.filename = savedFilename || 'Cache Local (Offline)';
                        updateFilenameDisplay();
                        processData(state.rawData, false);
                    } else {
                        state.rawData = [];
                        state.filename = 'Ambiente Limpo (Offline)';
                        updateFilenameDisplay();
                        updateDashboard();
                        hideLoading();
                    }
                } catch (e) {
                    console.error('Erro no processamento do fallback offline:', e);
                    hideLoading();
                }
            });
        return;
    }

    // FALLBACK PARA MODO TOTALMENTE OFFLINE / LOCAL (FILE PROTOCOL)
    if (!forceFetch && savedData) {
        try {
            showLoading('Carregando dados do cache local...');
            state.rawData = JSON.parse(savedData);
            state.filename = savedFilename || 'Arquivo salvo no cache';
            updateFilenameDisplay();
            processData(state.rawData, false);
            return;
        } catch (err) {
            console.error('Erro ao ler cache do navegador, recaindo para arquivo físico.', err);
        }
    }

    const suffix = forceFetch ? `?t=${Date.now()}` : '';
    showLoading(forceFetch ? 'Re-lendo planilha local de dados...' : 'Buscando planilha local de dados...');

    const envSanitized = state.activeEnv.replace(/\s+/g, '_');
    const serverFileName = envSanitized === 'Frota_Principal' || envSanitized === 'Padrao' ? 'dados.xlsx' : `dados_${envSanitized}.xlsx`;

    fetch(`./${serverFileName}${suffix}`)
        .then(response => {
            if (!response.ok) throw new Error(`${serverFileName} não encontrado`);
            return response.arrayBuffer();
        })
        .then(buffer => {
            state.filename = serverFileName;
            updateFilenameDisplay();
            parseExcelBuffer(buffer);
        })
        .catch(() => {
            fetch(`./dados.csv${suffix}`)
                .then(response => {
                    if (!response.ok) throw new Error('dados.csv não encontrado');
                    return response.text();
                })
                .then(csvText => {
                    state.filename = 'dados.csv';
                    updateFilenameDisplay();
                    parseCsvText(csvText);
                })
                .catch((e) => {
                    if (savedData) {
                        try {
                            state.rawData = JSON.parse(savedData);
                            state.filename = savedFilename || 'Arquivo salvo no cache';
                            updateFilenameDisplay();
                            processData(state.rawData, false);
                        } catch (err) {
                            console.error('Erro ao ler cache do navegador.', err);
                            hideLoading();
                            document.getElementById('upload-modal').classList.add('active');
                        }
                    } else {
                        state.rawData = [];
                        state.filename = 'Novo Ambiente';
                        updateFilenameDisplay();
                        updateDashboard();
                        hideLoading();
                    }
                });
        });
}

function updateFilenameDisplay() {
    document.getElementById('active-filename').textContent = state.filename;
}

// 4. PARSER DE ARQUIVOS
function handleUploadedFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    state.filename = file.name;
    localStorage.setItem(getEnvKey('combustivel_dashboard_filename'), file.name);
    updateFilenameDisplay();

    showLoading('Carregando e processando arquivo...');

    if (ext === 'xlsx') {
        const reader = new FileReader();
        reader.onload = function (e) {
            parseExcelBuffer(e.target.result);
        };
        reader.readAsArrayBuffer(file);
    } else if (ext === 'csv') {
        const reader = new FileReader();
        reader.onload = function (e) {
            parseCsvText(e.target.result);
        };
        reader.readAsText(file, 'UTF-8');
    } else {
        hideLoading();
        alert('Por favor, envie um arquivo Excel (.xlsx) ou CSV.');
    }
}

function parseExcelBuffer(buffer) {
    try {
        const data = new Uint8Array(buffer);
        const workbook = XLSX.read(data, { type: 'array' });

        // Tentar carregar preferências de layout
        loadConfigFromWorkbook(workbook);

        let json = [];
        let foundSheet = false;

        for (const sheetName of workbook.SheetNames) {
            const worksheet = workbook.Sheets[sheetName];
            const sheetData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });

            // Procurar linha de cabeçalho
            let headerIndex = -1;
            let headers = [];
            for (let i = 0; i < sheetData.length; i++) {
                const row = sheetData[i];
                if (!row || row.length === 0) continue;
                const normalizedRow = row.map(cell => cleanKey(cell));
                if (normalizedRow.includes('data') && (normalizedRow.includes('litros') || normalizedRow.includes('valor'))) {
                    headerIndex = i;
                    headers = normalizedRow;
                    break;
                }
            }

            if (headerIndex !== -1) {
                const dataRows = [];
                for (let i = headerIndex + 1; i < sheetData.length; i++) {
                    const row = sheetData[i];
                    if (!row || row.every(cell => cell === "")) continue;

                    const rowObj = {};
                    for (let j = 0; j < headers.length; j++) {
                        const headerKey = headers[j];
                        if (headerKey) {
                            rowObj[headerKey] = row[j] !== undefined ? row[j] : "";
                        }
                    }
                    dataRows.push(rowObj);
                }
                json = dataRows;
                foundSheet = true;
                break;
            }
        }

        if (!foundSheet) {
            hideLoading();
            alert('Não foi possível encontrar uma planilha de dados com as colunas necessárias (Data, Litros ou Valor) neste arquivo Excel.');
            return;
        }

        processData(json, true);
        document.getElementById('upload-modal').classList.remove('active');
    } catch (e) {
        hideLoading();
        console.error(e);
        alert('Erro ao processar arquivo Excel: ' + e.message + '\n' + e.stack);
    }
}

function parseCsvText(text) {
    Papa.parse(text, {
        header: false,
        skipEmptyLines: true,
        complete: function (results) {
            const sheetData = results.data;
            let headerIndex = -1;
            let headers = [];
            for (let i = 0; i < sheetData.length; i++) {
                const row = sheetData[i];
                if (!row || row.length === 0) continue;
                const normalizedRow = row.map(cell => cleanKey(cell));
                if (normalizedRow.includes('data') && (normalizedRow.includes('litros') || normalizedRow.includes('valor'))) {
                    headerIndex = i;
                    headers = normalizedRow;
                    break;
                }
            }

            if (headerIndex === -1) {
                hideLoading();
                alert('Não foi possível identificar as colunas de dados (Data, Litros ou Valor) no arquivo CSV.');
                return;
            }

            const dataRows = [];
            for (let i = headerIndex + 1; i < sheetData.length; i++) {
                const row = sheetData[i];
                if (!row || row.every(cell => cell === "")) continue;

                const rowObj = {};
                for (let j = 0; j < headers.length; j++) {
                    const headerKey = headers[j];
                    if (headerKey) {
                        rowObj[headerKey] = row[j] !== undefined ? row[j] : "";
                    }
                }
                dataRows.push(rowObj);
            }

            processData(dataRows, true);
            document.getElementById('upload-modal').classList.remove('active');
        },
        error: function (err) {
            hideLoading();
            console.error(err);
            alert('Erro ao processar arquivo CSV.');
        }
    });
}

// 5. HELPER PARA NÚMEROS E DATAS
function cleanKey(key) {
    if (key === undefined || key === null) return '';
    return key.toString().toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function parseBrazilianNumber(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;

    let clean = val.toString().replace(/R\$\s?/, '').trim();
    if (clean.includes(',') && clean.includes('.')) {
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        clean = clean.replace(',', '.');
    }

    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
}

function parseExcelDate(val) {
    if (val === undefined || val === null || val === '') return null;

    // Converter strings numéricas para número (ex: "46251" -> 46251)
    let numVal = Number(val);
    if (!isNaN(numVal) && typeof val !== 'object' && val.toString().trim() !== '') {
        val = numVal;
    }

    if (typeof val === 'number') {
        const date = new Date((val - 25569) * 86400 * 1000);
        return date;
    }

    if (typeof val === 'string') {
        const parts = val.split(/[-/.]/); // Divide por -, / ou .
        if (parts.length === 3) {
            let year = parseInt(parts[2]);
            let month = parseInt(parts[1]) - 1;
            let day = parseInt(parts[0]);
            
            // Se o primeiro termo for o ano (formato YYYY-MM-DD ou YY-MM-DD)
            if (parts[0].trim().length === 4 || (parts[0].trim().length === 2 && parseInt(parts[0]) > 31)) {
                year = parseInt(parts[0]);
                month = parseInt(parts[1]) - 1;
                day = parseInt(parts[2]);
            }
            
            if (year < 100) {
                year += 2000;
            }
            
            const d = new Date(year, month, day);
            if (!isNaN(d.getTime())) return d;
        }
    }

    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

function formatDateIso(date) {
    if (!date) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function parseInputDate(str) {
    if (!str) return null;
    const parts = str.split('-');
    if (parts.length === 3) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
    }
    return new Date(str);
}

function safeParseDate(val) {
    if (!val) return null;
    if (val instanceof Date) return val;
    const str = val.toString().trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
        const parts = str.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    if (/^\d{4}-\d{2}-\d{2}T/.test(str)) {
        const parts = str.split('T')[0].split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }
    return new Date(str);
}

function normalizeDate(d) {
    if (!d) return null;
    const newD = new Date(d);
    newD.setHours(0, 0, 0, 0);
    return newD;
}

// 6. PROCESSAMENTO DOS DADOS DA PLANILHA
function processData(rows, shouldCache = false) {
    if (!rows || rows.length === 0) {
        hideLoading();
        return;
    }

    const processed = [];

    rows.forEach((row, idx) => {
        // Se a linha já foi processada anteriormente (veio do localStorage)
        if (row.date && (row.zona !== undefined || row.combustivel !== undefined)) {
            let parsedDate = safeParseDate(row.date);
            if (isNaN(parsedDate.getTime()) && row.date) {
                parsedDate = parseExcelDate(row.date);
            }

            let zona = row.zona || 'NÃO INFORMADO';
            let responsavel = row.responsavel || 'NÃO INFORMADO';
            let veiculo = row.veiculo || 'NÃO INFORMADO';
            let placa = row.placa || 'NÃO INFORMADO';

            const zonaLower = (zona || '').toString().trim().toLowerCase();
            const respLower = (responsavel || '').toString().trim().toLowerCase();

            if (state.mappings.responsavelToBase[zonaLower]) {
                if (responsavel === 'Não Informado' || responsavel === '') {
                    responsavel = zona;
                }
                zona = state.mappings.responsavelToBase[zonaLower];
            }
            if ((responsavel === 'Não Informado' || responsavel === '') && state.mappings.baseToResponsavel[zonaLower]) {
                responsavel = state.mappings.baseToResponsavel[zonaLower];
            }
            if ((zona === 'Não Informado' || zona === '') && state.mappings.responsavelToBase[respLower]) {
                zona = state.mappings.responsavelToBase[respLower];
            }

            const veicUpper = (veiculo || '').toString().trim().toUpperCase();
            if (state.mappings.placaToVeiculo[veicUpper]) {
                if (!placa) {
                    placa = veicUpper;
                }
                veiculo = state.mappings.placaToVeiculo[veicUpper];
            }
            const placaUpper = (placa || '').toString().trim().toUpperCase();
            if ((veiculo === 'Não Informado' || veiculo === '') && state.mappings.placaToVeiculo[placaUpper]) {
                veiculo = state.mappings.placaToVeiculo[placaUpper];
            }

            const finalDate = (parsedDate && !isNaN(parsedDate.getTime())) ? parsedDate : new Date();

            processed.push({
                ...row,
                id: row.id || (Date.now() + '-' + Math.random() + '-' + idx),
                date: finalDate,
                month: finalDate.getMonth(),
                year: finalDate.getFullYear(),
                zona: zona,
                responsavel: responsavel,
                veiculo: veiculo,
                placa: placaUpper,
                lote: row.lote || (row.inicioSeq && row.inicioSeq.startsWith('1787') ? 'LOTE 3 (15K)' : 'LOTE 1 (7K)'),
                kmAnterior: (row.kmAnterior !== undefined && row.kmAnterior !== null && row.kmAnterior !== '' && row.kmAnterior !== 0) ? row.kmAnterior : 'NÃO INFORMADO',
                km: (row.km !== null && row.km !== undefined && row.km !== '' && row.km !== 0) ? row.km : 'NÃO INFORMADO'
            });
            return;
        }

        const cleanedRow = {};
        for (const k in row) {
            cleanedRow[cleanKey(k)] = row[k];
        }

        const dateVal = parseExcelDate(cleanedRow['data']);
        if (!dateVal) return;

        const qtdRequisicoes = parseBrazilianNumber(cleanedRow['qtd requisicoes']) || 1;
        const litros = parseBrazilianNumber(cleanedRow['litros']);
        const precoLitro = parseBrazilianNumber(cleanedRow['preco litro']);

        let valor = parseBrazilianNumber(cleanedRow['valor']);
        if (valor === 0 && litros > 0 && precoLitro > 0) {
            valor = qtdRequisicoes * litros * precoLitro;
        }

        let zona = cleanedRow['base'] || cleanedRow['bases'] || cleanedRow['zona'] || cleanedRow['zonas de manaus'] || 'NÃO INFORMADO';
        let responsavel = cleanedRow['responsavel'] || 'NÃO INFORMADO';
        let posto = cleanedRow['posto'] || cleanedRow['postos'] || 'NÃO INFORMADO';
        let motorista = cleanedRow['motorista'] || cleanedRow['motoristas'] || 'NÃO INFORMADO';
        let veiculo = cleanedRow['veiculo'] || 'NÃO INFORMADO';
        let placa = cleanedRow['placa'] || 'NÃO INFORMADO';

        const zonaLower = (zona || '').toString().trim().toLowerCase();
        const respLower = (responsavel || '').toString().trim().toLowerCase();

        if (state.mappings.responsavelToBase[zonaLower]) {
            if (responsavel === 'Não Informado' || responsavel === '') {
                responsavel = zona;
            }
            zona = state.mappings.responsavelToBase[zonaLower];
        }
        if ((responsavel === 'Não Informado' || responsavel === '') && state.mappings.baseToResponsavel[zonaLower]) {
            responsavel = state.mappings.baseToResponsavel[zonaLower];
        }
        if ((zona === 'Não Informado' || zona === '') && state.mappings.responsavelToBase[respLower]) {
            zona = state.mappings.responsavelToBase[respLower];
        }

        const veicUpper = (veiculo || '').toString().trim().toUpperCase();
        if (state.mappings.placaToVeiculo[veicUpper]) {
            if (!placa) {
                placa = veicUpper;
            }
            veiculo = state.mappings.placaToVeiculo[veicUpper];
        }
        const placaUpper = (placa || '').toString().trim().toUpperCase();
        if ((veiculo === 'Não Informado' || veiculo === '') && state.mappings.placaToVeiculo[placaUpper]) {
            veiculo = state.mappings.placaToVeiculo[placaUpper];
        }

        processed.push({
            id: Date.now() + '-' + Math.random() + '-' + idx,
            date: dateVal,
            month: dateVal.getMonth(),
            year: dateVal.getFullYear(),
            inicioSeq: cleanedRow['inicio da sequencia'] || '',
            fimSeq: cleanedRow['fim da sequencia'] || '',
            qtdRequisicoes: qtdRequisicoes,
            zona: zona,
            responsavel: responsavel,
            posto: posto,
            motorista: motorista,
            veiculo: veiculo,
            placa: placaUpper,
            lote: cleanedRow['lote'] || row.lote || (cleanedRow['inicio da sequencia'] && cleanedRow['inicio da sequencia'].startsWith('1787') ? 'LOTE 3 (15K)' : 'LOTE 1 (7K)'),
            kmAnterior: parseBrazilianNumber(cleanedRow['km anterior']) || parseBrazilianNumber(cleanedRow['kilometragem anterior']) || 'NÃO INFORMADO',
            km: parseBrazilianNumber(cleanedRow['km']) || parseBrazilianNumber(cleanedRow['kilometragem']) || parseBrazilianNumber(cleanedRow['km/odor']) || parseBrazilianNumber(cleanedRow['km atual']) || 'NÃO INFORMADO',
            combustivel: cleanedRow['tipo combustivel'] || 'Não Informado',
            litros: litros,
            precoLitro: precoLitro,
            valor: valor
        });
    });

    if (processed.length === 0) {
        hideLoading();
        alert('Nenhum dado válido encontrado na planilha.');
        return;
    }

    // Verificar se o usuário escolheu o modo "append" (Mesclar dados com a base existente)
    const importMode = document.querySelector('input[name="upload-import-mode"]:checked')?.value || 'replace';

    if (importMode === 'append' && state.rawData && state.rawData.length > 0) {
        const getFingerprint = r => `${r.date ? formatDateIso(new Date(r.date)) : ''}_${r.inicioSeq || ''}_${r.fimSeq || ''}_${r.valor || ''}_${r.veiculo || ''}_${r.placa || ''}_${r.responsavel || ''}`;
        const existingSet = new Set(state.rawData.map(getFingerprint));

        const newRecords = processed.filter(r => !existingSet.has(getFingerprint(r)));
        const dupesCount = processed.length - newRecords.length;

        state.rawData = state.rawData.concat(newRecords);

        setTimeout(() => {
            alert(`➕ Carga Incremental Concluída!\n\n• ${newRecords.length} novos registros adicionados à base.\n• ${dupesCount} registros duplicados ignorados.`);
        }, 600);
    } else {
        state.rawData = processed;
    }

    // Compilar conjunto de datas com consumo
    state.consumptionDates = new Set();
    state.rawData.forEach(row => {
        if (row.date && (row.litros > 0 || row.valor > 0)) {
            state.consumptionDates.add(formatDateIso(row.date));
        }
    });

    if (shouldCache) {
        localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
        syncWithServerSilent();
    }


    // Resetar Filtros
    state.filters.zonas.clear();
    state.filters.postos.clear();
    state.filters.combustiveis.clear();

    // Inicializa Filtro de Datas
    initDateFilterRange();

    buildFilterButtons();
    updateRelationsMappings();

    // Delay estético de processamento para suavizar transição
    setTimeout(() => {
        updateDashboard();
        hideLoading();
    }, 550);
}

// ==============================================================================
// CENTRAL DE CADASTROS ESTRUTURADA & MAPEAMENTOS RELACIONAIS
// ==============================================================================
function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function renderStructuredCadastrosUI() {
    // 1. BASES & RESPONSÁVEIS COM CARDS AGRUPADOS E SUB-ABAS
    const listBases = document.getElementById('list-cad-bases');
    const countBases = document.getElementById('count-cad-bases');
    const subtabsBases = document.getElementById('bases-subtabs-container');
    const allBases = state.customBases || [];

    if (!state.activeBaseCadTab) state.activeBaseCadTab = 'TODAS';

    // Agrupar responsáveis por Base
    const baseGroupsMap = new Map();
    const baseCounts = { 'TODAS': allBases.length };

    allBases.forEach((item, originalIdx) => {
        const parts = item.includes(' - ') ? item.split(' - ') : [item];
        const baseName = parts[0] || item;
        const respName = parts[1] || '';

        baseCounts[baseName] = (baseCounts[baseName] || 0) + 1;

        if (!baseGroupsMap.has(baseName)) {
            baseGroupsMap.set(baseName, {
                baseName,
                items: []
            });
        }
        baseGroupsMap.get(baseName).items.push({
            respName,
            originalIdx,
            fullStr: item
        });
    });

    // Ordenar bases alfabeticamente com ordenação natural (ex: LESTE 1, LESTE 2, NORTE 1, etc.)
    const sortedBaseNames = Array.from(baseGroupsMap.keys()).sort((a, b) => 
        a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' })
    );

    const baseTabsList = ['TODAS', ...sortedBaseNames];

    // Renderizar barra de Sub-abas por Base (em ordem alfabética)
    if (subtabsBases) {
        subtabsBases.innerHTML = baseTabsList.map(bName => {
            const count = baseCounts[bName] || 0;
            const isActive = state.activeBaseCadTab === bName;
            return `
                <button type="button" class="lote-subtab-btn ${isActive ? 'active' : ''}" onclick="setCadBaseSubTab('${escapeHtml(bName)}')">
                    ${bName === 'TODAS' ? '🌐' : '🏢'} ${escapeHtml(bName)}
                    <span class="lote-subtab-badge">${count}</span>
                </button>
            `;
        }).join('');
    }

    // Filtrar e ordenar grupos pela base ativa (em ordem alfabética)
    let baseGroups = sortedBaseNames
        .map(bName => baseGroupsMap.get(bName))
        .filter(Boolean);

    if (state.activeBaseCadTab !== 'TODAS') {
        baseGroups = baseGroups.filter(g => g.baseName === state.activeBaseCadTab);
    }

    // Ordenar responsáveis dentro de cada base alfabeticamente
    baseGroups.forEach(g => {
        g.items.sort((a, b) => (a.respName || '').localeCompare(b.respName || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    });

    const currentBaseTabCount = baseGroups.reduce((acc, g) => acc + g.items.length, 0);
    if (countBases) {
        countBases.textContent = state.activeBaseCadTab === 'TODAS' 
            ? `${allBases.length}` 
            : `${currentBaseTabCount} de ${allBases.length}`;
    }

    if (listBases) {
        if (baseGroups.length === 0) {
            listBases.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1.5rem;">Nenhuma base cadastrada para <strong>${escapeHtml(state.activeBaseCadTab)}</strong>. Cadastre uma acima.</div>`;
        } else {
            listBases.innerHTML = baseGroups.map((g, gIdx) => {
                const cardId = `base-card-${gIdx}`;
                return `
                    <div class="lote-group-card open" id="${cardId}">
                        <div class="lote-group-header" onclick="toggleLoteGroupCard('${cardId}')">
                            <div class="lote-group-meta">
                                <span class="lote-group-title">🏢 ${escapeHtml(g.baseName)}</span>
                                <span class="lote-badge-count">👤 ${g.items.length} Responsáveis</span>
                            </div>
                            <div class="lote-group-actions" onclick="event.stopPropagation();">
                                <button type="button" class="entity-delete-btn" onclick="removeBaseGroup('${escapeHtml(g.baseName)}')" title="Excluir Base Completa">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                                <button type="button" class="btn-lote-toggle-droplet" onclick="toggleLoteGroupCard('${cardId}')" title="Expandir/Recolher Responsáveis">
                                    <span>Responsáveis</span>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="lote-group-droplet">
                            <div class="resp-chips-grid">
                                ${g.items.map(it => `
                                    <div class="resp-chip">
                                        <span class="resp-chip-name" title="${escapeHtml(it.respName || 'Sem nome')}">👤 ${escapeHtml(it.respName || 'Padrão')}</span>
                                        <div class="entity-actions-group">
                                            <button type="button" class="entity-edit-btn" onclick="editCadEntity('bases', ${it.originalIdx})" title="Editar Responsável">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                            </button>
                                            <button type="button" class="entity-delete-btn" onclick="removeCadEntity('bases', ${it.originalIdx})" title="Remover Responsável">
                                                <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                            </button>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 2. VEÍCULOS & PLACAS (Ordenados Alfabeticamente)
    const listVeics = document.getElementById('list-cad-veiculos');
    const countVeics = document.getElementById('count-cad-veiculos');
    const allVeiculos = state.customVeiculos || [];
    if (countVeics) countVeics.textContent = allVeiculos.length;
    if (listVeics) {
        if (allVeiculos.length === 0) {
            listVeics.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">Nenhum veículo cadastrado.</div>';
        } else {
            const sortedVeiculos = allVeiculos.map((item, originalIdx) => ({ item, originalIdx })).sort((a, b) => 
                a.item.localeCompare(b.item, 'pt-BR', { numeric: true, sensitivity: 'base' })
            );
            listVeics.innerHTML = sortedVeiculos.map(({ item, originalIdx }) => {
                const parts = item.includes(' - ') ? item.split(' - ') : [item];
                const placa = parts[0] || item;
                const modelo = parts[1] || '';
                return `
                    <div class="entity-item-row">
                        <div class="entity-item-info">
                            <span class="entity-item-title">${escapeHtml(placa)}</span>
                            ${modelo ? `<span class="entity-item-badge-secondary">🚗 ${escapeHtml(modelo)}</span>` : ''}
                        </div>
                        <div class="entity-actions-group">
                            <button type="button" class="entity-edit-btn" onclick="editCadEntity('veiculos', ${originalIdx})" title="Editar Veículo">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button type="button" class="entity-delete-btn" onclick="removeCadEntity('veiculos', ${originalIdx})" title="Remover Veículo">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 3. POSTOS & PREÇOS (Ordenados Alfabeticamente)
    const listPostos = document.getElementById('list-cad-postos');
    const countPostos = document.getElementById('count-cad-postos');
    const allPostos = state.customPostos || [];
    if (countPostos) countPostos.textContent = allPostos.length;
    if (listPostos) {
        if (allPostos.length === 0) {
            listPostos.innerHTML = '<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1rem;">Nenhum posto cadastrado.</div>';
        } else {
            const sortedPostos = allPostos.map((item, originalIdx) => ({ item, originalIdx })).sort((a, b) => 
                a.item.localeCompare(b.item, 'pt-BR', { numeric: true, sensitivity: 'base' })
            );
            listPostos.innerHTML = sortedPostos.map(({ item, originalIdx }) => {
                const parts = item.includes(' - ') ? item.split(' - ') : [item];
                const postoName = parts[0] || item;
                const preco = parts[1] || '';
                return `
                    <div class="entity-item-row">
                        <div class="entity-item-info">
                            <span class="entity-item-title">${escapeHtml(postoName)}</span>
                            ${preco ? `<span class="entity-item-badge">⛽ R$ ${escapeHtml(preco)}/L</span>` : ''}
                        </div>
                        <div class="entity-actions-group">
                            <button type="button" class="entity-edit-btn" onclick="editCadEntity('postos', ${originalIdx})" title="Editar Posto">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button type="button" class="entity-delete-btn" onclick="removeCadEntity('postos', ${originalIdx})" title="Remover Posto">
                                <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // 4. LOTES & REQUISIÇÕES COM CARDS AGRUPADOS E DROPLET DE SEQUÊNCIAS
    const listReqs = document.getElementById('list-cad-lotes');
    const countReqs = document.getElementById('count-cad-reqs');
    const subtabsContainer = document.getElementById('lotes-subtabs-container');
    const allReqs = state.customRequisicoes || [];

    if (!state.activeLoteCadTab) state.activeLoteCadTab = 'TODOS';

    // Helper para extrair metadados da requisição
    function parseReqMeta(str) {
        if (!str) return { control: 'AVULSO', seq: '000', litros: '30L', lote: 'OUTROS' };
        
        let lote = 'OUTROS';
        const matchLote = str.match(/\((LOTE[^)]*)\)/i) || str.match(/(LOTE\s*[^-\n,)]+)/i);
        if (matchLote && matchLote[1]) lote = matchLote[1].trim();

        let litros = '30L';
        const matchLitros = str.match(/(\d+(?:\.\d+)?)\s*(?:L|Litros)/i);
        if (matchLitros && matchLitros[1]) litros = `${matchLitros[1]}L`;

        let control = 'AVULSO';
        let seq = '';
        const matchFull = str.match(/^([^\s-]+)-(\d+)/);
        if (matchFull) {
            control = matchFull[1].trim();
            seq = matchFull[2].trim();
        } else {
            const firstPart = str.split('-')[0].trim();
            if (/^\d+$/.test(firstPart)) {
                seq = firstPart;
                control = 'SEQUENCIAL';
            } else {
                control = firstPart || 'AVULSO';
                seq = str.split('-')[1]?.trim() || '001';
            }
        }

        return { control, seq, litros, lote };
    }

    // Agrupar requisições por Lote + Código de Controle + Litragem
    const groupsMap = new Map();
    const loteCounts = { 'TODOS': allReqs.length };
    const discoveredLots = new Set();

    allReqs.forEach((item, originalIdx) => {
        const meta = parseReqMeta(item);
        if (meta.lote) {
            discoveredLots.add(meta.lote);
            loteCounts[meta.lote] = (loteCounts[meta.lote] || 0) + 1;
        }

        const groupKey = `${meta.lote}___${meta.control}___${meta.litros}`;
        if (!groupsMap.has(groupKey)) {
            groupsMap.set(groupKey, {
                key: groupKey,
                lote: meta.lote,
                control: meta.control,
                litros: meta.litros,
                items: []
            });
        }
        groupsMap.get(groupKey).items.push({
            seq: meta.seq,
            originalIdx,
            fullStr: item
        });
    });

    const lotTabsList = ['TODOS', ...Array.from(discoveredLots).filter(l => l !== 'TODOS')];

    // Se a aba ativa não existe mais entre os lotes, voltar para TODOS
    if (state.activeLoteCadTab !== 'TODOS' && !discoveredLots.has(state.activeLoteCadTab)) {
        state.activeLoteCadTab = 'TODOS';
    }

    // Renderizar barra de Sub-abas por Lote com botão de Excluir
    if (subtabsContainer) {
        subtabsContainer.innerHTML = lotTabsList.map(loteName => {
            const count = loteCounts[loteName] || 0;
            const isActive = state.activeLoteCadTab === loteName;
            return `
                <button type="button" class="lote-subtab-btn ${isActive ? 'active' : ''}" onclick="setCadLoteSubTab('${escapeHtml(loteName)}')">
                    ${loteName === 'TODOS' ? '🌐' : '📦'} ${escapeHtml(loteName)}
                    <span class="lote-subtab-badge">${count}</span>
                    ${loteName !== 'TODOS' ? `
                        <span class="lote-subtab-del" onclick="event.stopPropagation(); removeEntireLote('${escapeHtml(loteName)}')" title="Excluir Todo o ${escapeHtml(loteName)}">&times;</span>
                    ` : ''}
                </button>
            `;
        }).join('');
    }

    // Filtrar grupos pelo lote ativo
    let groups = Array.from(groupsMap.values());
    if (state.activeLoteCadTab !== 'TODOS') {
        groups = groups.filter(g => g.lote === state.activeLoteCadTab);
    }

    const currentTabCount = groups.reduce((acc, g) => acc + g.items.length, 0);
    if (countReqs) {
        countReqs.textContent = state.activeLoteCadTab === 'TODOS' 
            ? `${allReqs.length}` 
            : `${currentTabCount} de ${allReqs.length}`;
    }

    if (listReqs) {
        if (groups.length === 0) {
            listReqs.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem; text-align: center; padding: 1.5rem;">Nenhum grupo de requisições no estoque para o <strong>${escapeHtml(state.activeLoteCadTab)}</strong>. Gere uma nova faixa acima.</div>`;
        } else {
            listReqs.innerHTML = groups.map((g, gIdx) => {
                const seqNums = g.items.map(i => parseInt(i.seq, 10)).filter(n => !isNaN(n)).sort((a, b) => a - b);
                const minSeq = seqNums.length > 0 ? String(seqNums[0]).padStart(3, '0') : (g.items[0]?.seq || '001');
                const maxSeq = seqNums.length > 0 ? String(seqNums[seqNums.length - 1]).padStart(3, '0') : (g.items[g.items.length - 1]?.seq || '001');
                const cardId = `lote-card-${gIdx}`;

                return `
                    <div class="lote-group-card open" id="${cardId}">
                        <div class="lote-group-header" onclick="toggleLoteGroupCard('${cardId}')">
                            <div class="lote-group-meta">
                                <span class="lote-group-title">📦 ${escapeHtml(g.lote)}</span>
                                <span class="lote-badge-control">Controle: ${escapeHtml(g.control)}</span>
                                <span class="lote-badge-litros">⛽ ${escapeHtml(g.litros)}</span>
                                <span class="lote-badge-range">🔢 Faixa: ${minSeq} → ${maxSeq}</span>
                                <span class="lote-badge-count">🏷️ ${g.items.length} reqs</span>
                            </div>
                            <div class="lote-group-actions" onclick="event.stopPropagation();">
                                <button type="button" class="entity-delete-btn" onclick="removeLoteGroup('${escapeHtml(g.key)}')" title="Excluir Faixa Completa">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                                <button type="button" class="btn-lote-toggle-droplet" onclick="toggleLoteGroupCard('${cardId}')" title="Expandir/Recolher Sequências">
                                    <span>Sequências</span>
                                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                            </div>
                        </div>
                        <div class="lote-group-droplet">
                            <div class="seq-chips-grid">
                                ${g.items.map(it => `
                                    <div class="seq-chip" title="${escapeHtml(it.fullStr)}">
                                        <span>${escapeHtml(it.seq)}</span>
                                        <button type="button" class="seq-chip-del" onclick="removeCadEntity('requisicoes', ${it.originalIdx})" title="Remover nº ${escapeHtml(it.seq)}">&times;</button>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }

    // Sincronizar textareas do modo em massa
    const taBases = document.getElementById('textarea-custom-bases');
    const taPostos = document.getElementById('textarea-custom-postos');
    const taVeics = document.getElementById('textarea-custom-veiculos');
    const taReqs = document.getElementById('textarea-custom-requisicoes');
    const taMots = document.getElementById('textarea-custom-motoristas');

    if (taBases) taBases.value = (state.customBases || []).join('\n');
    if (taPostos) taPostos.value = (state.customPostos || []).join('\n');
    if (taVeics) taVeics.value = (state.customVeiculos || []).join('\n');
    if (taReqs) taReqs.value = (state.customRequisicoes || []).join('\n');
    if (taMots) taMots.value = (state.customMotoristas || []).join('\n');

    // Exibir botão de reset HML apenas em homologação
    const btnResetHml = document.getElementById('btn-reset-hml-db');
    if (btnResetHml) {
        btnResetHml.style.display = isHmlEnvironment() ? 'inline-flex' : 'none';
    }
}

// Alternar sub-aba de base no cadastro
window.setCadBaseSubTab = function(baseName) {
    state.activeBaseCadTab = baseName;
    const inputBaseNome = document.getElementById('input-new-base-nome');
    if (inputBaseNome && baseName !== 'TODAS') {
        inputBaseNome.value = baseName;
    }
    renderStructuredCadastrosUI();
};

// Excluir base completa e seus responsáveis
window.removeBaseGroup = function(baseName) {
    if (!confirm(`Deseja realmente excluir a base "${baseName}" e todos os seus responsáveis?`)) return;
    state.customBases = (state.customBases || []).filter(item => {
        const parts = item.includes(' - ') ? item.split(' - ') : [item];
        const b = parts[0] || item;
        return b !== baseName;
    });
    localStorage.setItem(getEnvKey('custom_bases'), JSON.stringify(state.customBases));
    syncWithServerSilent();
    updateRelationsMappings();
    populateDatalist('datalist-bases', state.customBases);
    buildFilterButtons();
    renderStructuredCadastrosUI();
};

// Alternar sub-aba de lote no cadastro
window.setCadLoteSubTab = function(loteName) {
    state.activeLoteCadTab = loteName;
    const inputLoteNome = document.getElementById('input-new-lote-nome');
    if (inputLoteNome && loteName !== 'TODOS') {
        inputLoteNome.value = loteName;
    }
    renderStructuredCadastrosUI();
};

// Expandir / Recolher Droplet do Grupo de Lote
window.toggleLoteGroupCard = function(cardId) {
    const card = document.getElementById(cardId);
    if (card) {
        card.classList.toggle('open');
    }
};

// Excluir faixa inteira agrupada de requisições
window.removeLoteGroup = function(groupKey) {
    if (!confirm('Deseja realmente excluir toda esta faixa de requisições do estoque?')) return;
    const parts = groupKey.split('___');
    const lote = parts[0];
    const control = parts[1];
    const litros = parts[2];

    function parseReqMetaLocal(str) {
        if (!str) return { control: 'AVULSO', seq: '000', litros: '30L', lote: 'OUTROS' };
        let l = 'OUTROS';
        const mLote = str.match(/\((LOTE[^)]*)\)/i) || str.match(/(LOTE\s*[^-\n,)]+)/i);
        if (mLote && mLote[1]) l = mLote[1].trim();

        let lit = '30L';
        const mLit = str.match(/(\d+(?:\.\d+)?)\s*(?:L|Litros)/i);
        if (mLit && mLit[1]) lit = `${mLit[1]}L`;

        let ctrl = 'AVULSO';
        const mFull = str.match(/^([^\s-]+)-(\d+)/);
        if (mFull) {
            ctrl = mFull[1].trim();
        } else {
            const first = str.split('-')[0].trim();
            ctrl = /^\d+$/.test(first) ? 'SEQUENCIAL' : (first || 'AVULSO');
        }
        return { control: ctrl, litros: lit, lote: l };
    }

    state.customRequisicoes = (state.customRequisicoes || []).filter(item => {
        const meta = parseReqMetaLocal(item);
        return !(meta.lote === lote && meta.control === control && meta.litros === litros);
    });

    localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
    syncWithServerSilent();
    updateRelationsMappings();
    populateDatalist('datalist-requisicoes', state.customRequisicoes);
    buildFilterButtons();
    renderStructuredCadastrosUI();
};

// Excluir lote inteiro e todas as suas requisições
window.removeEntireLote = function(loteName) {
    if (!confirm(`Deseja realmente excluir o lote "${loteName}" e todas as suas requisições do estoque?`)) return;

    function parseReqMetaLocal(str) {
        if (!str) return { lote: 'OUTROS' };
        let l = 'OUTROS';
        const mLote = str.match(/\((LOTE[^)]*)\)/i) || str.match(/(LOTE\s*[^-\n,)]+)/i);
        if (mLote && mLote[1]) l = mLote[1].trim();
        return { lote: l };
    }

    state.customRequisicoes = (state.customRequisicoes || []).filter(item => {
        const meta = parseReqMetaLocal(item);
        return meta.lote !== loteName && !item.includes(loteName);
    });

    state.activeLoteCadTab = 'TODOS';
    localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
    syncWithServerSilent();
    updateRelationsMappings();
    populateDatalist('datalist-requisicoes', state.customRequisicoes);
    buildFilterButtons();
    renderStructuredCadastrosUI();
};

// Reinicializar / Zerar o banco de dados de Homologação (HML)
window.resetHmlDatabase = async function() {
    if (!confirm('⚠️ ATENÇÃO: Deseja realmente zerar todo o banco de dados de Homologação (HML)?\n\nIsso limpará todas as tabelas de teste em HML (requisições, bases, postos e veículos) para que você comece as validações 100% do zero.')) return;

    try {
        const response = await fetch('api/reset_hml_db.php', {
            method: 'POST',
            headers: {
                'X-Trace-ID': 'trace-reset-hml-' + Date.now()
            }
        });
        const result = await response.json();
        if (result.success) {
            // Limpar localStorage de HML
            const keysToRemove = [
                'hml_custom_bases',
                'hml_custom_veiculos',
                'hml_custom_postos',
                'hml_custom_requisicoes',
                'hml_custom_motoristas',
                'hml_records',
                'hml_abastecimentos',
                'hml_last_sync',
                'custom_bases',
                'custom_veiculos',
                'custom_postos',
                'custom_requisicoes',
                'custom_motoristas'
            ];
            keysToRemove.forEach(k => localStorage.removeItem(k));

            alert('✅ ' + result.message);
            location.reload();
        } else {
            alert('❌ ' + (result.error || 'Erro ao reinicializar banco HML'));
        }
    } catch (e) {
        alert('❌ Erro na requisição: ' + e.message);
    }
};

// Editar entidade cadastrada
window.editCadEntity = function(type, index) {
    if (type === 'bases' && state.customBases && state.customBases[index]) {
        const item = state.customBases[index];
        const parts = item.includes(' - ') ? item.split(' - ') : [item];
        const inputNome = document.getElementById('input-new-base-nome');
        const inputResp = document.getElementById('input-new-base-resp');
        const btnAdd = document.getElementById('btn-add-base-item');

        if (inputNome) inputNome.value = parts[0] || '';
        if (inputResp) inputResp.value = parts[1] || '';
        if (btnAdd) {
            btnAdd.dataset.editIndex = index;
            btnAdd.textContent = '💾 Salvar Alterações';
        }
        if (inputNome) inputNome.focus();
    } else if (type === 'veiculos' && state.customVeiculos && state.customVeiculos[index]) {
        const item = state.customVeiculos[index];
        const parts = item.includes(' - ') ? item.split(' - ') : [item];
        const inputPlaca = document.getElementById('input-new-veic-placa');
        const inputTipo = document.getElementById('input-new-veic-tipo');
        const btnAdd = document.getElementById('btn-add-veic-item');

        if (inputPlaca) inputPlaca.value = parts[0] || '';
        if (inputTipo) inputTipo.value = parts[1] || '';
        if (btnAdd) {
            btnAdd.dataset.editIndex = index;
            btnAdd.textContent = '💾 Salvar Alterações';
        }
        if (inputPlaca) inputPlaca.focus();
    } else if (type === 'postos' && state.customPostos && state.customPostos[index]) {
        const item = state.customPostos[index];
        const parts = item.includes(' - ') ? item.split(' - ') : [item];
        const inputNome = document.getElementById('input-new-posto-nome');
        const inputPreco = document.getElementById('input-new-posto-preco');
        const btnAdd = document.getElementById('btn-add-posto-item');

        if (inputNome) inputNome.value = parts[0] || '';
        if (inputPreco) inputPreco.value = parts[1] ? parseFloat(parts[1]) || '' : '';
        if (btnAdd) {
            btnAdd.dataset.editIndex = index;
            btnAdd.textContent = '💾 Salvar Alterações';
        }
        if (inputNome) inputNome.focus();
    } else if (type === 'requisicoes' && state.customRequisicoes && state.customRequisicoes[index]) {
        const currentVal = state.customRequisicoes[index];
        const newVal = prompt('Editar Sequência / Requisição:', currentVal);
        if (newVal !== null && newVal.trim() !== '') {
            state.customRequisicoes[index] = newVal.trim();
            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            syncWithServerSilent();
            updateRelationsMappings();
            populateDatalist('datalist-requisicoes', state.customRequisicoes);
            buildFilterButtons();
            renderStructuredCadastrosUI();
        }
    }
};

// Remover entidade cadastrada pelo índice
window.removeCadEntity = function(type, index) {
    if (type === 'bases' && state.customBases) {
        state.customBases.splice(index, 1);
        localStorage.setItem(getEnvKey('custom_bases'), JSON.stringify(state.customBases));
    } else if (type === 'veiculos' && state.customVeiculos) {
        state.customVeiculos.splice(index, 1);
        localStorage.setItem(getEnvKey('custom_veiculos'), JSON.stringify(state.customVeiculos));
    } else if (type === 'postos' && state.customPostos) {
        state.customPostos.splice(index, 1);
        localStorage.setItem(getEnvKey('custom_postos'), JSON.stringify(state.customPostos));
    } else if (type === 'requisicoes' && state.customRequisicoes) {
        state.customRequisicoes.splice(index, 1);
        localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
    }
    syncWithServerSilent();
    updateRelationsMappings();
    buildFilterButtons();
    renderStructuredCadastrosUI();
};

// Atualizar Datalists de sugestão
function updateRelationsMappings() {
    // Bases
    const baseNames = (state.customBases || []).map(b => (b.includes(' - ') ? b.split(' - ')[0] : b).trim()).filter(Boolean);
    populateDatalist('datalist-bases', baseNames);

    // Responsaveis
    const responsaveis = (state.customBases || []).map(b => {
        const parts = b.includes(' - ') ? b.split(' - ') : [b];
        return parts.length > 1 ? parts[1].trim() : '';
    }).filter(Boolean);
    populateDatalist('datalist-responsaveis', responsaveis);

    // Postos
    const postoNames = (state.customPostos || []).map(p => (p.includes(' - ') ? p.split(' - ')[0] : p).trim()).filter(Boolean);
    populateDatalist('datalist-postos', postoNames);

    // Placas e Veículos
    const placas = (state.customVeiculos || []).map(v => (v.includes(' - ') ? v.split(' - ')[0] : v).trim()).filter(Boolean);
    populateDatalist('datalist-placas', placas);

    const modelos = (state.customVeiculos || []).map(v => {
        const parts = v.includes(' - ') ? v.split(' - ') : [v];
        return parts.length > 1 ? parts[1].trim() : '';
    }).filter(Boolean);
    populateDatalist('datalist-veiculos', modelos);

    // Motoristas (extrai o nome do motorista de 'Base - Motorista' ou usa plano se não houver hífen)
    const motoristaNames = (state.customMotoristas || []).map(m => {
        if (m.includes(' - ')) {
            const parts = m.split(' - ');
            return parts.length > 1 ? parts[1].trim() : '';
        }
        return m.trim();
    }).filter(Boolean);
    populateDatalist('datalist-motoristas', motoristaNames);

    // Requisições
    populateDatalist('datalist-requisicoes', state.customRequisicoes || []);
}

function populateDatalist(datalistId, items) {
    let dl = document.getElementById(datalistId);
    if (!dl) {
        dl = document.createElement('datalist');
        dl.id = datalistId;
        document.body.appendChild(dl);
    }
    const uniqueItems = Array.from(new Set(items));
    dl.innerHTML = uniqueItems.map(item => `<option value="${escapeHtml(item)}"></option>`).join('');
}

// 7. INICIALIZAÇÃO DE RANGE DE DATAS
function initDateFilterRange() {
    if (state.rawData.length === 0) return;

    let minD = state.rawData[0].date;
    let maxD = state.rawData[0].date;

    state.rawData.forEach(row => {
        if (row.date < minD) minD = row.date;
        if (row.date > maxD) maxD = row.date;
    });

    state.fullDateRange.start = minD;
    state.fullDateRange.end = maxD;

    // Inicializar por padrão com o período da última semana (últimos 7 dias de dados disponíveis)
    const end = new Date(maxD);
    const start = new Date(maxD);
    start.setDate(end.getDate() - 7);

    state.dateRange.start = start;
    state.dateRange.end = end;

    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');

    startInput.min = formatDateIso(minD);
    startInput.max = formatDateIso(maxD);
    endInput.min = formatDateIso(minD);
    endInput.max = formatDateIso(maxD);

    startInput.value = formatDateIso(state.dateRange.start);
    endInput.value = formatDateIso(state.dateRange.end);

    setActivePreset('7d');
}

// Preset logic helper
function applyPresetRange(days) {
    if (state.rawData.length === 0) return;

    let maxD = state.rawData[0].date;
    state.rawData.forEach(row => {
        if (row.date > maxD) maxD = row.date;
    });

    const end = new Date(maxD);
    const start = new Date(maxD);
    start.setDate(end.getDate() - days);

    state.dateRange.start = start;
    state.dateRange.end = end;

    document.getElementById('date-start').value = formatDateIso(start);
    document.getElementById('date-end').value = formatDateIso(end);

    updateDashboard();
}

function setActivePreset(presetId) {
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (presetId) {
        const btn = document.getElementById(`preset-${presetId}`);
        if (btn) btn.classList.add('active');
    }
}

// 8. BOTOES FILTROS (SLICERS)
function buildFilterButtons() {
    // Analisar a planilha para definir os botões de Bases (Zonas), Postos e Combustíveis
    const zonasUnicas = new Set();
    const postosUnicos = new Set();
    const combustiveisUnicos = new Set(['Gasolina', 'Etanol', 'Diesel']);

    if (state.rawData && state.rawData.length > 0) {
        state.rawData.forEach(row => {
            const zLower = row.zona ? row.zona.trim().toLowerCase() : '';
            const pLower = row.posto ? row.posto.trim().toLowerCase() : '';

            if (zLower && zLower !== 'não informado') {
                zonasUnicas.add(row.zona);
            }
            if (pLower && pLower !== 'não informado') {
                postosUnicos.add(row.posto);
            }
            if (row.combustivel && row.combustivel !== 'Não Informado') {
                combustiveisUnicos.add(row.combustivel);
            }
        });
    }

    const sortedZonas = Array.from(zonasUnicas).sort();
    const sortedComb = Array.from(combustiveisUnicos).sort();

    // Zonas (Bases)
    const containerZonas = document.getElementById('filter-zonas');
    if (containerZonas) {
        containerZonas.innerHTML = '';

        // Botão "Todas"
        const btnTodasZonas = document.createElement('button');
        btnTodasZonas.className = `slicer-btn ${state.filters.zonas.size === 0 ? 'active' : ''}`;
        btnTodasZonas.textContent = 'Todas';
        btnTodasZonas.addEventListener('click', () => {
            state.filters.zonas.clear();
            buildFilterButtons();
            updateDashboard();
        });
        containerZonas.appendChild(btnTodasZonas);

        // Ordenar bases alfabeticamente para um visual mais organizado
        sortedZonas.forEach(zona => {
            const btn = document.createElement('button');
            btn.className = `slicer-btn ${state.filters.zonas.has(zona) ? 'active' : ''}`;
            btn.textContent = zona;
            btn.addEventListener('click', () => toggleFilter('zonas', zona));
            containerZonas.appendChild(btn);
        });
    }

    // Postos
    const containerPostos = document.getElementById('filter-postos');
    if (containerPostos) {
        containerPostos.innerHTML = '';

        // Botão "Todos"
        const btnTodosPostos = document.createElement('button');
        btnTodosPostos.className = `slicer-btn ${state.filters.postos.size === 0 ? 'active' : ''}`;
        btnTodosPostos.textContent = 'Todos';
        btnTodosPostos.addEventListener('click', () => {
            state.filters.postos.clear();
            buildFilterButtons();
            updateDashboard();
        });
        containerPostos.appendChild(btnTodosPostos);

        // Ordenar postos alfabeticamente
        const sortedPostos = Array.from(postosUnicos).sort();
        sortedPostos.forEach(posto => {
            const btn = document.createElement('button');
            btn.className = `slicer-btn ${state.filters.postos.has(posto) ? 'active' : ''}`;
            btn.textContent = posto;
            btn.addEventListener('click', () => toggleFilter('postos', posto));
            containerPostos.appendChild(btn);
        });
    }

    // Combustíveis
    const containerCombustiveis = document.getElementById('filter-combustiveis');
    if (containerCombustiveis) {
        containerCombustiveis.innerHTML = '';

        // Botão "Todos"
        const btnTodosComb = document.createElement('button');
        btnTodosComb.className = `slicer-btn ${state.filters.combustiveis.size === 0 ? 'active' : ''}`;
        btnTodosComb.textContent = 'Todos';
        btnTodosComb.addEventListener('click', () => {
            state.filters.combustiveis.clear();
            buildFilterButtons();
            updateDashboard();
        });
        containerCombustiveis.appendChild(btnTodosComb);

        // Ordenar combustíveis alfabeticamente
        sortedComb.forEach(comb => {
            const btn = document.createElement('button');
            btn.className = `slicer-btn ${state.filters.combustiveis.has(comb) ? 'active' : ''}`;
            btn.textContent = comb;
            btn.addEventListener('click', () => toggleFilter('combustiveis', comb));
            containerCombustiveis.appendChild(btn);
        });
    }

    // Lotes de Requisição
    const containerLotes = document.getElementById('filter-lotes');
    if (containerLotes) {
        containerLotes.innerHTML = '';
        if (!state.filters.lotes) state.filters.lotes = new Set();
        
        const lotesUnicos = new Set();
        if (state.customRequisicoes && state.customRequisicoes.length > 0) {
            state.customRequisicoes.forEach(item => {
                const match = item.match(/\((.*?)\)/);
                if (match && match[1]) {
                    lotesUnicos.add(match[1].trim());
                } else {
                    const loteMatch = item.match(/(LOTE\s*\d+)/i);
                    if (loteMatch) lotesUnicos.add(loteMatch[1].toUpperCase());
                }
            });
        }
        if (state.rawData && state.rawData.length > 0) {
            state.rawData.forEach(row => {
                if (row.lote && row.lote !== 'Não Informado') lotesUnicos.add(row.lote);
            });
        }
        const sortedLotes = Array.from(lotesUnicos).sort();

        // Botão "Todos os Lotes"
        const btnTodosLotes = document.createElement('button');
        btnTodosLotes.className = `slicer-btn ${state.filters.lotes.size === 0 ? 'active' : ''}`;
        btnTodosLotes.textContent = 'Todos os Lotes';
        btnTodosLotes.addEventListener('click', () => {
            state.filters.lotes.clear();
            buildFilterButtons();
            updateDashboard();
        });
        containerLotes.appendChild(btnTodosLotes);

        sortedLotes.forEach(lote => {
            const btn = document.createElement('button');
            btn.className = `slicer-btn ${state.filters.lotes.has(lote) ? 'active' : ''}`;
            btn.textContent = lote;
            btn.addEventListener('click', () => toggleFilter('lotes', lote));
            containerLotes.appendChild(btn);
        });
    }

    // 1. Popular Bases
    let basesList = [];
    if (state.customBases && state.customBases.length > 0) {
        basesList = state.customBases.map(line => {
            const parts = splitByRelationalHyphen(line);
            return parts.length > 0 ? parts[0] : '';
        }).filter(Boolean);
    } else {
        basesList = sortedZonas;
    }
    // Mesclar com bases existentes na base de dados
    state.rawData.forEach(row => {
        if (row.zona && row.zona !== 'Não Informado') basesList.push(row.zona);
    });
    populateDatalist('datalist-bases', Array.from(new Set(basesList)).sort());

    // 2. Popular Responsáveis
    let respList = [];
    if (state.customBases && state.customBases.length > 0) {
        respList = state.customBases.map(line => {
            const parts = splitByRelationalHyphen(line);
            return parts.length >= 2 ? parts[1] : '';
        }).filter(Boolean);
    } else {
        const respSet = new Set();
        state.rawData.forEach(row => {
            if (row.responsavel && row.responsavel !== 'Não Informado') respSet.add(row.responsavel);
        });
        respList = Array.from(respSet);
    }
    // Mesclar com responsáveis existentes na base de dados
    state.rawData.forEach(row => {
        if (row.responsavel && row.responsavel !== 'Não Informado') respList.push(row.responsavel);
    });
    populateDatalist('datalist-responsaveis', Array.from(new Set(respList)).sort());

    // 3. Popular Postos
    let postList = [];
    if (state.customPostos && state.customPostos.length > 0) {
        postList = state.customPostos.map(p => {
            const parts = splitByRelationalHyphen(p);
            return parts.length > 0 ? parts[0] : '';
        }).filter(Boolean);
    } else {
        const postSet = new Set();
        state.rawData.forEach(row => {
            if (row.posto && row.posto !== 'Não Informado') postSet.add(row.posto);
        });
        postList = Array.from(postSet);
    }
    // Mesclar com postos existentes na base de dados
    state.rawData.forEach(row => {
        if (row.posto && row.posto !== 'Não Informado') postList.push(row.posto);
    });
    populateDatalist('datalist-postos', Array.from(new Set(postList)).sort());

    // 4. Popular Motoristas
    let motoristasList = [];
    if (state.customMotoristas && state.customMotoristas.length > 0) {
        motoristasList = state.customMotoristas.map(m => m ? m.toString().trim() : '').filter(Boolean);
    } else {
        const motoristaSet = new Set();
        state.rawData.forEach(row => {
            if (row.motorista && row.motorista !== 'Não Informado') motoristaSet.add(row.motorista);
        });
        motoristasList = Array.from(motoristaSet);
    }
    // Mesclar com motoristas existentes na base de dados
    state.rawData.forEach(row => {
        if (row.motorista && row.motorista !== 'Não Informado') motoristasList.push(row.motorista);
    });
    populateDatalist('datalist-motoristas', Array.from(new Set(motoristasList)).sort());

    // 5. Popular Veículos
    let veicList = [];
    if (state.customVeiculos && state.customVeiculos.length > 0) {
        veicList = state.customVeiculos.map(line => {
            const parts = splitByRelationalHyphen(line);
            return parts.length >= 2 ? parts[1] : '';
        }).filter(Boolean);
    } else {
        const veicSet = new Set();
        state.rawData.forEach(row => {
            if (row.veiculo && row.veiculo !== 'Não Informado') veicSet.add(row.veiculo);
        });
        veicList = Array.from(veicSet);
    }
    // Mesclar com veículos existentes na base de dados
    state.rawData.forEach(row => {
        if (row.veiculo && row.veiculo !== 'Não Informado') veicList.push(row.veiculo);
    });
    populateDatalist('datalist-veiculos', Array.from(new Set(veicList)).sort());

    // 6. Popular Placas (inicialmente sem filtro de veículo)
    updatePlacaDatalistOptions('');

    // Popular o datalist de combustível do formulário de Nova Requisição
    populateDatalist('datalist-combustiveis', sortedComb);

    // Sincronizar o seletor do lote da barra lateral
    const selectLoteSidebar = document.getElementById('select-lote-sidebar');
    if (selectLoteSidebar) {
        const lotesUnicos = new Set();
        if (state.customRequisicoes && state.customRequisicoes.length > 0) {
            state.customRequisicoes.forEach(item => {
                const match = item.match(/\((.*?)\)/);
                if (match && match[1]) {
                    lotesUnicos.add(match[1].trim());
                } else {
                    const loteMatch = item.match(/(LOTE\s*\d+)/i);
                    if (loteMatch) lotesUnicos.add(loteMatch[1].toUpperCase());
                }
            });
        }
        if (state.rawData && state.rawData.length > 0) {
            state.rawData.forEach(row => {
                if (row.lote && row.lote !== 'Não Informado') lotesUnicos.add(row.lote);
            });
        }
        const sortedLotes = Array.from(lotesUnicos).sort();
        
        selectLoteSidebar.innerHTML = '<option value="TODOS">Todos os Lotes</option>';
        sortedLotes.forEach(lote => {
            const opt = document.createElement('option');
            opt.value = lote;
            opt.textContent = lote;
            selectLoteSidebar.appendChild(opt);
        });
        
        if (state.filters.lotes && state.filters.lotes.size === 1) {
            const activeLote = Array.from(state.filters.lotes)[0];
            selectLoteSidebar.value = activeLote;
        } else {
            selectLoteSidebar.value = 'TODOS';
        }
    }
}

function updatePlacaDatalistOptions(selectedVeiculo = '') {
    let placaList = [];
    if (state.customVeiculos && state.customVeiculos.length > 0) {
        if (selectedVeiculo) {
            // Filtrar apenas placas associadas a este veículo
            state.customVeiculos.forEach(line => {
                const parts = splitByRelationalHyphen(line);
                if (parts.length >= 2) {
                    const placa = parts[0].toUpperCase();
                    const veiculo = parts[1];
                    if (veiculo.toLowerCase() === selectedVeiculo.toLowerCase()) {
                        placaList.push(placa);
                    }
                }
            });
        } else {
            // Exibir todas as placas
            placaList = state.customVeiculos.map(line => {
                const parts = splitByRelationalHyphen(line);
                return parts.length > 0 ? parts[0].toUpperCase() : '';
            }).filter(Boolean);
        }
    }

    // Mesclar sempre com as placas existentes na base de dados (rawData)
    state.rawData.forEach(row => {
        if (row.placa && (selectedVeiculo === '' || (row.veiculo && row.veiculo.toLowerCase() === selectedVeiculo.toLowerCase()))) {
            placaList.push(row.placa.toUpperCase());
        }
    });

    const dl = document.getElementById('datalist-placas');
    if (dl) {
        dl.innerHTML = '';
        Array.from(new Set(placaList)).sort().forEach(placa => {
            const opt = document.createElement('option');
            opt.value = placa;
            dl.appendChild(opt);
        });
    }
}

function toggleFilter(category, value) {
    const filterSet = state.filters[category];

    if (filterSet.has(value)) {
        filterSet.delete(value);
    } else {
        filterSet.add(value);
    }

    buildFilterButtons();
    updateDashboard();
}

// 9. MOTOR DE INTERPRETAÇÃO DE LINGUAGEM NATURAL (NLQ)
function applyNlqQuery() {
    const inputEl = document.getElementById('nlq-input');
    const query = inputEl.value;
    if (!query) return;

    const cleanQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

    // 1. Identificar comandos de limpar
    if (cleanQuery.match(/(limpar|resetar|remover|limpa|tudo|todos|completo)/)) {
        state.filters.zonas.clear();
        state.filters.postos.clear();
        state.filters.combustiveis.clear();
        state.dateRange.start = new Date(state.fullDateRange.start);
        state.dateRange.end = new Date(state.fullDateRange.end);

        document.getElementById('date-start').value = formatDateIso(state.dateRange.start);
        document.getElementById('date-end').value = formatDateIso(state.dateRange.end);
        setActivePreset('all');

        document.getElementById('table-search').value = '';
        state.searchText = '';

        document.getElementById('nlq-feedback').innerHTML = "🧹 Todos os filtros foram limpos!";
        document.getElementById('nlq-feedback').style.color = 'var(--text-secondary)';

        buildFilterButtons();
        updateDashboard();
        return;
    }

    // Limpar filtros atuais para receber nova intenção
    state.filters.zonas.clear();
    state.filters.postos.clear();
    state.filters.combustiveis.clear();

    const filtersApplied = [];

    // 2. Identificar Zonas
    if (cleanQuery.includes('sul')) {
        state.filters.zonas.add('Zona Sul');
        filtersApplied.push('Zona Sul');
    }
    if (cleanQuery.includes('norte')) {
        state.filters.zonas.add('Zona Norte');
        filtersApplied.push('Zona Norte');
    }
    if (cleanQuery.includes('leste')) {
        state.filters.zonas.add('Zona Leste');
        filtersApplied.push('Zona Leste');
    }
    if (cleanQuery.includes('oeste')) {
        state.filters.zonas.add('Zona Oeste');
        filtersApplied.push('Zona Oeste');
    }
    if (cleanQuery.includes('centro-sul') || cleanQuery.includes('centro sul')) {
        state.filters.zonas.add('Zona Centro-Sul');
        filtersApplied.push('Zona Centro-Sul');
    }

    // 3. Identificar Combustível
    if (cleanQuery.includes('gasolina')) {
        state.filters.combustiveis.add('Gasolina');
        filtersApplied.push('Gasolina');
    }
    if (cleanQuery.includes('diesel')) {
        state.filters.combustiveis.add('Diesel');
        filtersApplied.push('Diesel');
    }
    if (cleanQuery.includes('etanol')) {
        state.filters.combustiveis.add('Etanol');
        filtersApplied.push('Etanol');
    }

    // 4. Identificar Períodos
    let datePresetLabel = '';
    if (cleanQuery.includes('hoje')) {
        const today = new Date();
        state.dateRange.start = today;
        state.dateRange.end = today;
        document.getElementById('date-start').value = formatDateIso(today);
        document.getElementById('date-end').value = formatDateIso(today);
        setActivePreset('today');
        datePresetLabel = 'Hoje';
    } else if (cleanQuery.includes('7 dias') || cleanQuery.includes('semana') || cleanQuery.includes('7d')) {
        // Preset de 7 dias
        let maxD = state.rawData[0].date;
        state.rawData.forEach(row => {
            if (row.date > maxD) maxD = row.date;
        });
        const end = new Date(maxD);
        const start = new Date(maxD);
        start.setDate(end.getDate() - 7);
        state.dateRange.start = start;
        state.dateRange.end = end;

        document.getElementById('date-start').value = formatDateIso(start);
        document.getElementById('date-end').value = formatDateIso(end);
        setActivePreset('7d');
        datePresetLabel = 'Últimos 7 dias';
    } else if (cleanQuery.includes('30 dias') || cleanQuery.includes('mes') || cleanQuery.includes('30d')) {
        // Preset de 30 dias
        let maxD = state.rawData[0].date;
        state.rawData.forEach(row => {
            if (row.date > maxD) maxD = row.date;
        });
        const end = new Date(maxD);
        const start = new Date(maxD);
        start.setDate(end.getDate() - 30);
        state.dateRange.start = start;
        state.dateRange.end = end;

        document.getElementById('date-start').value = formatDateIso(start);
        document.getElementById('date-end').value = formatDateIso(end);
        setActivePreset('30d');
        datePresetLabel = 'Últimos 30 dias';
    } else if (cleanQuery.includes('ontem')) {
        let maxD = state.rawData[0].date;
        state.rawData.forEach(row => {
            if (row.date > maxD) maxD = row.date;
        });
        const yesterday = new Date(maxD);
        yesterday.setDate(yesterday.getDate() - 1);
        state.dateRange.start = yesterday;
        state.dateRange.end = yesterday;

        document.getElementById('date-start').value = formatDateIso(yesterday);
        document.getElementById('date-end').value = formatDateIso(yesterday);
        setActivePreset(null);
        datePresetLabel = 'Ontem';
    }

    if (datePresetLabel) {
        filtersApplied.push(`Período: ${datePresetLabel}`);
    }

    // 5. Identificar busca textual específica (Motoristas / Placa / Veículos)
    const motoristasConhecidos = ['joao', 'maria', 'carlos', 'ana', 'paulo'];
    const veiculosConhecidos = ['caminhao', 'van', 'uno', 'onix'];

    let textSearchApplied = '';

    // Buscar motorista na pergunta
    motoristasConhecidos.forEach(mot => {
        if (cleanQuery.includes(mot)) {
            // Capitalizar primeiro caractere
            const nameCap = mot.charAt(0).toUpperCase() + mot.slice(1);
            state.searchText = mot;
            document.getElementById('table-search').value = nameCap;
            textSearchApplied = `Busca motorista: "${nameCap}"`;

            // Força aba de motoristas ou lançamentos
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-responsaveis').classList.add('active');
            state.activeTab = 'responsaveis';
        }
    });

    // Buscar veículo/placa se motorista não foi encontrado
    if (!textSearchApplied) {
        veiculosConhecidos.forEach(veic => {
            if (cleanQuery.includes(veic)) {
                const veicCap = veic.charAt(0).toUpperCase() + veic.slice(1);
                state.searchText = veic;
                document.getElementById('table-search').value = veicCap;
                textSearchApplied = `Busca veículo: "${veicCap}"`;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.getElementById('tab-veiculos').classList.add('active');
                state.activeTab = 'veiculos';
            }
        });

        // Mapeia placas (Formato ABC-1234 ou 7 dígitos juntos)
        const plateMatch = cleanQuery.match(/[a-z]{3}-?[0-9]{4}/);
        if (plateMatch) {
            const plateStr = plateMatch[0].toUpperCase();
            state.searchText = plateStr.toLowerCase();
            document.getElementById('table-search').value = plateStr;
            textSearchApplied = `Busca placa: "${plateStr}"`;

            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('tab-lancamentos').classList.add('active');
            state.activeTab = 'lancamentos';
        }
    }

    if (textSearchApplied) {
        filtersApplied.push(textSearchApplied);
    }

    // Mostrar feedback
    const feedbackEl = document.getElementById('nlq-feedback');
    if (filtersApplied.length > 0) {
        feedbackEl.innerHTML = `✅ Filtros ativos: <strong>${filtersApplied.join(' | ')}</strong>`;
        feedbackEl.style.color = 'var(--accent-yellow)';
    } else {
        feedbackEl.innerHTML = `⚠️ Pergunta não compreendida. Tente citar <em>Diesel</em>, <em>Zona Sul</em>, <em>7 dias</em> ou nomes de motoristas.`;
        feedbackEl.style.color = '#f87171'; // soft red
    }

    // Re-desenhar botões (que serão ativados reativamente pelo novo estado de state.filters)
    buildFilterButtons();
    updateDashboard();
}

// FUNÇÃO AUXILIAR PARA CORRESPONDÊNCIA DE BUSCA GLOBAL
function matchesSearchTerm(row, search) {
    if (!search) return true;
    
    // Verificação de intervalo numérico ou correspondência parcial para sequências / requisições
    let seqMatch = false;
    const startObj = parseSeqString(row.inicioSeq);
    const endObj = parseSeqString(row.fimSeq || row.inicioSeq);
    
    if (!isNaN(startObj.num)) {
        const startNum = startObj.num;
        const endNum = isNaN(endObj.num) ? startNum : endObj.num;
        const match = (row.inicioSeq || '').toString().trim().match(/^(.*)-(\d+)$/);
        const padLength = match ? match[2].length : 3;
        
        const limitNum = Math.min(endNum, startNum + 1000);
        for (let n = startNum; n <= limitNum; n++) {
            const seqStr = startObj.prefix ? 
                `${startObj.prefix}-${n.toString().padStart(padLength, '0')}` : 
                n.toString();
            
            if (seqStr.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search)) {
                seqMatch = true;
                break;
            }
        }
    } else {
        const startStr = row.inicioSeq ? String(row.inicioSeq).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        const endStr = row.fimSeq ? String(row.fimSeq).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
        if (startStr.includes(search) || endStr.includes(search)) {
            seqMatch = true;
        }
    }

    const clean = (val) => (val || '').toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    return seqMatch ||
        clean(row.responsavel).includes(search) ||
        clean(row.motorista).includes(search) ||
        clean(row.veiculo).includes(search) ||
        clean(row.placa).includes(search) ||
        clean(row.zona).includes(search) ||
        clean(row.posto).includes(search) ||
        clean(row.combustivel).includes(search);
}

// 10. ATUALIZAÇÃO DO PAINEL GERAL (REATIVIDADE GLOBAL)
function updateDashboard() {
    state.filteredData = state.rawData.filter(row => {
        const matchZona = state.filters.zonas.size === 0 || state.filters.zonas.has(row.zona);
        const matchPosto = state.filters.postos.size === 0 || state.filters.postos.has(row.posto);
        const matchComb = state.filters.combustiveis.size === 0 || state.filters.combustiveis.has(row.combustivel);
        const matchLote = !state.filters.lotes || state.filters.lotes.size === 0 || state.filters.lotes.has(row.lote);

        const rowDate = normalizeDate(row.date);
        const matchStart = !state.dateRange.start || rowDate >= normalizeDate(state.dateRange.start);
        const matchEnd = !state.dateRange.end || rowDate <= normalizeDate(state.dateRange.end);

        const matchSearch = matchesSearchTerm(row, state.searchText);

        return matchZona && matchPosto && matchComb && matchLote && matchStart && matchEnd && matchSearch;
    });

    calculateKPIs();
    renderCombustivelDonut();
    renderZonaDonut();
    renderBarChart();
    renderAreaChart();
    renderTable();

    if (typeof renderCalendar === 'function') {
        renderCalendar();
    }
    if (typeof updateCalendarTriggerText === 'function') {
        updateCalendarTriggerText();
    }
    updateChartTitles();
}

function updateChartTitles() {
    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    let periodStr = 'Todo o Período';
    if (state.dateRange.start && state.dateRange.end) {
        const startStr = fmt(state.dateRange.start);
        const endStr = fmt(state.dateRange.end);
        
        const isFullRange = state.fullDateRange.start && state.fullDateRange.end &&
                            normalizeDate(state.dateRange.start).getTime() === normalizeDate(state.fullDateRange.start).getTime() &&
                            normalizeDate(state.dateRange.end).getTime() === normalizeDate(state.fullDateRange.end).getTime();

        if (isFullRange) {
            periodStr = 'Todo o Período';
        } else if (startStr === endStr) {
            periodStr = startStr;
        } else {
            periodStr = `${startStr} a ${endStr}`;
        }
    }

    const titles = {
        '#card-combustivel-donut .chart-title': 'GASTO POR TIPO DE COMBUSTÍVEL',
        '#card-zona-donut .chart-title': 'RANKING DE GASTO POR BASE / POSTO',
        '#card-gasto-mensal .chart-title': 'TOTAL GASTO POR MÊS',
        '#card-volume-mensal .chart-title': 'VOLUME CONSUMIDO POR MÊS (LITROS)'
    };

    for (const selector in titles) {
        const el = document.querySelector(selector);
        if (el) {
            el.innerHTML = `${titles[selector]} <span class="chart-title-date" style="font-size: 0.7rem; font-weight: normal; color: var(--text-secondary); margin-left: 6px; text-transform: none;">(${periodStr})</span>`;
        }
    }
}
function calculateKPIs() {
    let totalGasto = 0;
    let totalLitros = 0;
    let totalReq = 0;
    const veiculosGasto = {};
    const basesGasto = {};

    state.filteredData.forEach(row => {
        totalGasto += row.valor;
        totalLitros += (row.litros * row.qtdRequisicoes);
        totalReq += row.qtdRequisicoes;

        if (row.veiculo && row.veiculo !== 'Não Informado') {
            veiculosGasto[row.veiculo] = (veiculosGasto[row.veiculo] || 0) + row.valor;
        }
        if (row.zona && row.zona !== 'Não Informado') {
            basesGasto[row.zona] = (basesGasto[row.zona] || 0) + row.valor;
        }
    });

    const precoMedio = totalLitros > 0 ? (totalGasto / totalLitros) : 0;

    let maiorVeiculo = '-';
    let maiorValor = 0;
    for (const v in veiculosGasto) {
        if (veiculosGasto[v] > maiorValor) {
            maiorValor = veiculosGasto[v];
            maiorVeiculo = v;
        }
    }

    let maiorBase = '-';
    let maiorBaseValor = 0;
    for (const b in basesGasto) {
        if (basesGasto[b] > maiorBaseValor) {
            maiorBaseValor = basesGasto[b];
            maiorBase = b;
        }
    }

    // Calcular as requisições disponíveis em estoque
    let totalDisponiveis = 0;
    if (state.customRequisicoes) {
        state.customRequisicoes.forEach(item => {
            let lote = 'OUTROS';
            const match = item.match(/\((.*?)\)/);
            if (match && match[1]) {
                lote = match[1].trim();
            } else {
                const loteMatch = item.match(/(LOTE\s*\d+)/i);
                if (loteMatch) lote = loteMatch[1].toUpperCase();
            }
            if (state.filters.lotes.size === 0 || state.filters.lotes.has(lote)) {
                totalDisponiveis++;
            }
        });
    }
    const totalCadastradas = totalReq + totalDisponiveis;

    // Atualizar os KPIs na tela
    document.querySelector('#kpi-gasto .kpi-value').textContent = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.querySelector('#kpi-litros .kpi-value').textContent = Math.round(totalLitros).toLocaleString('pt-BR') + ' L';
    
    // Novas KPIs
    const reqCadEl = document.getElementById('kpi-req-cadastradas');
    if (reqCadEl) reqCadEl.querySelector('.kpi-value').textContent = totalCadastradas.toLocaleString('pt-BR');
    
    const reqDistEl = document.getElementById('kpi-req-distribuidas');
    if (reqDistEl) reqDistEl.querySelector('.kpi-value').textContent = totalReq.toLocaleString('pt-BR');
    
    const reqDispEl = document.getElementById('kpi-req-disponiveis');
    if (reqDispEl) reqDispEl.querySelector('.kpi-value').textContent = totalDisponiveis.toLocaleString('pt-BR');

    // KPI legado caso exista na página
    const reqEl = document.querySelector('#kpi-requisicoes .kpi-value');
    if (reqEl) reqEl.textContent = totalReq.toLocaleString('pt-BR');
    
    document.querySelector('#kpi-preco-medio .kpi-value').textContent = precoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

    const maiorVeicEl = document.querySelector('#kpi-maior-gasto .kpi-value');
    maiorVeicEl.textContent = maiorVeiculo;
    if (maiorVeiculo.length > 18) {
        maiorVeicEl.style.fontSize = '1.05rem';
    } else {
        maiorVeicEl.style.fontSize = '1.25rem';
    }

    const maiorBaseEl = document.querySelector('#kpi-maior-gasto-base .kpi-value');
    if (maiorBaseEl) {
        maiorBaseEl.textContent = maiorBase;
        if (maiorBase.length > 18) {
            maiorBaseEl.style.fontSize = '1.05rem';
        } else {
            maiorBaseEl.style.fontSize = '1.25rem';
        }
    }
}
// 11. GRÁFICOS (APEXCHARTS)
// Donut: Gasto por Combustível
function renderCombustivelDonut() {
    const dataGroup = {};
    state.filteredData.forEach(row => {
        dataGroup[row.combustivel] = (dataGroup[row.combustivel] || 0) + row.valor;
    });

    const series = [];
    const labels = [];

    for (const key in dataGroup) {
        labels.push(key);
        series.push(parseFloat(dataGroup[key].toFixed(2)));
    }

    // Obter preferências
    const prefs = getChartPrefs('chart-combustivel-donut');
    const chartType = prefs.type || 'donut';
    const showLabels = prefs.dataLabels !== undefined ? prefs.dataLabels : true;
    const showLegend = prefs.legend !== undefined ? prefs.legend : true;

    const options = {
        chart: {
            type: chartType,
            height: 290,
            fontFamily: chartTheme.fontFamily,
            foreColor: chartTheme.foreColor,
        },
        series: series,
        labels: labels,
        colors: ['#ffb703', '#8338ec', '#fb5607', '#3a86c8', '#ff006e'],
        dataLabels: {
            enabled: showLabels,
            formatter: (val) => Math.round(val) + "%",
            style: { fontSize: '11px', fontWeight: 'bold', colors: ['#fff'] },
            dropShadow: { enabled: false }
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '68%',
                    background: 'transparent',
                    labels: {
                        show: true,
                        name: { show: true, fontSize: '12px', fontWeight: '600', color: '#64748b' },
                        value: {
                            show: true,
                            fontSize: '18px',
                            fontWeight: '700',
                            color: chartTheme.valueColor,
                            formatter: (val) => 'R$ ' + Math.round(val).toLocaleString('pt-BR')
                        },
                        total: {
                            show: true,
                            label: 'Total',
                            color: '#64748b',
                            formatter: (w) => {
                                const sum = w.globals.seriesTotals.reduce((a, b) => a + b, 0);
                                return 'R$ ' + Math.round(sum).toLocaleString('pt-BR');
                            }
                        }
                    }
                }
            }
        },
        stroke: { show: true, width: 2, colors: [chartTheme.strokeColor] },
        legend: { show: showLegend, position: 'bottom', fontSize: '11px', markers: { radius: 4 } },
        tooltip: {
            theme: chartTheme.tooltipTheme,
            y: { formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        }
    };

    if (state.charts.donut) {
        state.charts.donut.destroy();
    }
    state.charts.donut = new ApexCharts(document.querySelector("#chart-combustivel-donut"), options);
    state.charts.donut.render();
}

// Donut: Gasto por Zona
function renderZonaDonut() {
    const dataGroup = {};
    state.filteredData.forEach(row => {
        dataGroup[row.zona] = (dataGroup[row.zona] || 0) + row.valor;
    });

    // Ordenar decrescente
    const sortedData = Object.entries(dataGroup)
        .sort((a, b) => b[1] - a[1]);

    const seriesData = [];
    const categories = [];

    sortedData.forEach(([zona, valor]) => {
        categories.push(zona);
        seriesData.push(parseFloat(valor.toFixed(2)));
    });

    // Obter preferências
    const prefs = getChartPrefs('chart-zona-donut');
    let chartType = prefs.type || 'bar';
    let isHorizontal = true;
    if (chartType === 'bar-v') {
        chartType = 'bar';
        isHorizontal = false;
    } else if (chartType === 'line') {
        isHorizontal = false;
    }
    const showLabels = prefs.dataLabels !== undefined ? prefs.dataLabels : true;
    const showLegend = prefs.legend !== undefined ? prefs.legend : false;

    const options = {
        chart: {
            type: chartType,
            height: 290,
            fontFamily: chartTheme.fontFamily,
            foreColor: chartTheme.foreColor,
            toolbar: { show: false }
        },
        plotOptions: {
            bar: {
                horizontal: isHorizontal,
                barHeight: '60%',
                borderRadius: 4,
                distributed: true
            }
        },
        colors: ['#06d6a0', '#118ab2', '#ffd166', '#ef476f', '#073b4c'],
        dataLabels: {
            enabled: showLabels,
            textAnchor: isHorizontal ? 'start' : 'middle',
            style: {
                colors: isHorizontal ? ['#fff'] : [chartTheme.foreColor],
                fontWeight: '600',
                fontSize: '11px'
            },
            formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            offsetY: isHorizontal ? 0 : -20
        },
        series: [{
            name: 'Gasto',
            data: seriesData
        }],
        xaxis: {
            categories: categories,
            labels: {
                formatter: (val) => 'R$ ' + Math.round(val).toLocaleString('pt-BR')
            }
        },
        yaxis: {
            labels: {
                show: true,
                minWidth: 95,
                maxWidth: 110,
                style: {
                    fontSize: '11px',
                    fontWeight: 'bold'
                }
            }
        },
        grid: {
            borderColor: chartTheme.gridColor,
            xaxis: { lines: { show: true } },
            yaxis: { lines: { show: false } }
        },
        legend: { show: showLegend },
        tooltip: {
            theme: chartTheme.tooltipTheme,
            y: { formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        }
    };

    if (state.charts.zonaDonut) {
        state.charts.zonaDonut.destroy();
    }
    state.charts.zonaDonut = new ApexCharts(document.querySelector("#chart-zona-donut"), options);
    state.charts.zonaDonut.render();
}
// Barras: Gasto Mensal
function renderBarChart() {
    const monthlyData = {};

    state.filteredData.forEach(row => {
        const key = `${row.year}-${row.month}`;
        monthlyData[key] = (monthlyData[key] || 0) + row.valor;
    });

    const sortedKeys = Object.keys(monthlyData).sort((a, b) => {
        const [yA, mA] = a.split('-').map(Number);
        const [yB, mB] = b.split('-').map(Number);
        return yA !== yB ? yA - yB : mA - mB;
    });

    const categories = [];
    const seriesData = [];

    sortedKeys.forEach(key => {
        const [year, monthIndex] = key.split('-').map(Number);
        categories.push(`${MESES[monthIndex]} / ${year.toString().slice(-2)}`);
        seriesData.push(Math.round(monthlyData[key]));
    });

    // Obter preferências
    const prefs = getChartPrefs('chart-gasto-mensal');
    const chartType = prefs.type || 'bar';
    const showLabels = prefs.dataLabels !== undefined ? prefs.dataLabels : true;
    const showLegend = prefs.legend !== undefined ? prefs.legend : false;

    const options = {
        chart: {
            type: chartType,
            height: 290,
            fontFamily: chartTheme.fontFamily,
            foreColor: chartTheme.foreColor,
            toolbar: { show: false }
        },
        series: [{
            name: 'Gasto Total',
            data: seriesData
        }],
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '45%',
                borderRadius: 6,
                dataLabels: { position: 'top' }
            }
        },
        dataLabels: {
            enabled: showLabels,
            formatter: (val) => 'R$ ' + Math.round(val / 1000) + 'k',
            offsetY: -20,
            style: { fontSize: '10px', fontWeight: '600', colors: [chartTheme.foreColor] }
        },
        colors: ['#ffb703'],
        fill: {
            type: 'gradient',
            gradient: {
                shade: 'dark',
                type: 'vertical',
                shadeIntensity: 0.5,
                gradientToColors: ['#fb5607'],
                inverseColors: true,
                opacityFrom: 1,
                opacityTo: 0.9,
                stops: [0, 100]
            }
        },
        xaxis: {
            categories: categories,
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            show: true,
            labels: { formatter: (val) => 'R$ ' + val.toLocaleString('pt-BR') }
        },
        grid: {
            borderColor: chartTheme.gridColor,
            strokeDashArray: 4,
            yaxis: { lines: { show: true } }
        },
        legend: { show: showLegend },
        tooltip: {
            theme: chartTheme.tooltipTheme,
            y: { formatter: (val) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
        }
    };

    if (state.charts.bar) {
        state.charts.bar.destroy();
    }
    state.charts.bar = new ApexCharts(document.querySelector("#chart-gasto-mensal"), options);
    state.charts.bar.render();
}

// Área: Volume Mensal
function renderAreaChart() {
    const monthlyVolume = {};

    state.filteredData.forEach(row => {
        const key = `${row.year}-${row.month}`;
        monthlyVolume[key] = (monthlyVolume[key] || 0) + (row.litros * row.qtdRequisicoes);
    });

    const sortedKeys = Object.keys(monthlyVolume).sort((a, b) => {
        const [yA, mA] = a.split('-').map(Number);
        const [yB, mB] = b.split('-').map(Number);
        return yA !== yB ? yA - yB : mA - mB;
    });

    const categories = [];
    const seriesData = [];

    sortedKeys.forEach(key => {
        const [year, monthIndex] = key.split('-').map(Number);
        categories.push(`${MESES[monthIndex]} / ${year.toString().slice(-2)}`);
        seriesData.push(Math.round(monthlyVolume[key]));
    });

    // Obter preferências
    const prefs = getChartPrefs('chart-volume-mensal');
    const chartType = prefs.type || 'area';
    const showLabels = prefs.dataLabels !== undefined ? prefs.dataLabels : true;
    const showLegend = prefs.legend !== undefined ? prefs.legend : false;

    const options = {
        chart: {
            type: chartType,
            height: 290,
            fontFamily: chartTheme.fontFamily,
            foreColor: chartTheme.foreColor,
            toolbar: { show: false }
        },
        series: [{
            name: 'Volume Consumido',
            data: seriesData
        }],
        dataLabels: {
            enabled: showLabels,
            formatter: (val) => val.toLocaleString('pt-BR') + ' L',
            style: { fontSize: '10px', colors: ['#fff'], fontWeight: '600' },
            background: {
                enabled: true,
                foreColor: '#fff',
                padding: 4,
                borderRadius: 4,
                borderWidth: 1,
                borderColor: '#8338ec',
                opacity: 0.8
            }
        },
        colors: ['#8338ec'],
        stroke: { curve: 'smooth', width: 3 },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.45,
                opacityTo: 0.05,
                stops: [0, 90, 100]
            }
        },
        xaxis: {
            categories: categories,
            axisBorder: { show: false },
            axisTicks: { show: false }
        },
        yaxis: {
            show: true,
            labels: { formatter: (val) => val.toLocaleString('pt-BR') + ' L' }
        },
        grid: { borderColor: chartTheme.gridColor, strokeDashArray: 4 },
        legend: { show: showLegend },
        tooltip: {
            theme: chartTheme.tooltipTheme,
            y: { formatter: (val) => val.toLocaleString('pt-BR') + ' Litros' }
        }
    };

    if (state.charts.area) {
        state.charts.area.destroy();
    }
    state.charts.area = new ApexCharts(document.querySelector("#chart-volume-mensal"), options);
    state.charts.area.render();
}
// FUNÇÃO AUXILIAR DE ORDENAÇÃO UNIVERSAL
function sortRecords(list, col, dir) {
    if (!col) return list;
    const isAsc = dir === 'asc';
    return list.slice().sort((a, b) => {
        let valA = a[col];
        let valB = b[col];

        if (col === 'date') {
            const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
            const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
            return isAsc ? timeA - timeB : timeB - timeA;
        }

        if (col === 'totalLitros') {
            valA = (a.litros || 0) * (a.qtdRequisicoes || 1);
            valB = (b.litros || 0) * (b.qtdRequisicoes || 1);
            return isAsc ? valA - valB : valB - valA;
        }

        if (typeof valA === 'number' || typeof valB === 'number') {
            const numA = Number(valA) || 0;
            const numB = Number(valB) || 0;
            return isAsc ? numA - numB : numB - numA;
        }

        const strA = (valA || '').toString();
        const strB = (valB || '').toString();
        return isAsc ? strA.localeCompare(strB, 'pt-BR', { numeric: true, sensitivity: 'base' }) : strB.localeCompare(strA, 'pt-BR', { numeric: true, sensitivity: 'base' });
    });
}

// HANDLER GLOBAL DE ORDENAÇÃO DE COLUNAS
window.handleTableSort = function(columnKey) {
    if (state.sortColumn === columnKey) {
        state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
        state.sortColumn = columnKey;
        const numCols = ['date', 'valor', 'totalGasto', 'litros', 'totalLitros', 'qtdRequisicoes', 'totalReq', 'km', 'kmAnterior'];
        state.sortDirection = numCols.includes(columnKey) ? 'desc' : 'asc';
    }
    renderTable();
};

function getSortHeaderHtml(label, key, extraClasses = '') {
    const isSorted = state.sortColumn === key;
    const sortClass = isSorted ? `sorted-${state.sortDirection}` : '';
    const arrow = isSorted ? (state.sortDirection === 'asc' ? '▲' : '▼') : '↕';
    return `<th class="sortable ${sortClass} ${extraClasses}" onclick="handleTableSort('${key}')" title="Clique para ordenar por ${label}">${label} <span class="sort-icon">${arrow}</span></th>`;
}

// 12. SISTEMA DE TABELAS DINÂMICAS, TOTALIZADORES E RANKINGS DE BUSCA
function renderTable() {
    const table = document.getElementById('data-table');
    if (!table) return;
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('table-body');
    const tfoot = document.getElementById('table-footer');

    if (thead) thead.innerHTML = '';
    if (tbody) tbody.innerHTML = '';
    if (tfoot) tfoot.innerHTML = '';

    if (state.activeTab === 'lancamentos') {
        if (thead) {
            thead.innerHTML = `
                <tr>
                    ${getSortHeaderHtml('Data', 'date')}
                    ${getSortHeaderHtml('Nº Requisição', 'inicioSeq')}
                    ${getSortHeaderHtml('Qtd Req', 'qtdRequisicoes', 'col-number')}
                    ${getSortHeaderHtml('Base', 'zona')}
                    ${getSortHeaderHtml('Responsável', 'responsavel')}
                    ${getSortHeaderHtml('Motorista', 'motorista')}
                    ${getSortHeaderHtml('Posto', 'posto')}
                    ${getSortHeaderHtml('Veículo', 'veiculo')}
                    ${getSortHeaderHtml('KM Ant.', 'kmAnterior')}
                    ${getSortHeaderHtml('KM', 'km')}
                    ${getSortHeaderHtml('Combustível', 'combustivel')}
                    ${getSortHeaderHtml('L/Req', 'litros', 'col-number')}
                    ${getSortHeaderHtml('Total Litros', 'totalLitros', 'col-number')}
                    ${getSortHeaderHtml('Total Gasto', 'valor', 'col-number')}
                    <th class="th-actions">Ações</th>
                </tr>
            `;
        }

        const filtered = state.filteredData || [];
        const sorted = sortRecords(filtered, state.sortColumn || 'date', state.sortDirection || 'desc');

        if (sorted.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="15" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Nenhum lançamento encontrado para a pesquisa.</td></tr>`;
            return;
        }

        let sumQtdReq = 0;
        let sumLitros = 0;
        let sumValor = 0;

        sorted.forEach(row => {
            sumQtdReq += (row.qtdRequisicoes || 1);
            sumLitros += ((row.litros || 0) * (row.qtdRequisicoes || 1));
            sumValor += (row.valor || 0);

            const tr = document.createElement('tr');
            const dObj = safeParseDate(row.date);
            const dia = String(isNaN(dObj.getTime()) ? 1 : dObj.getDate()).padStart(2, '0');
            const mes = String(isNaN(dObj.getTime()) ? 1 : dObj.getMonth() + 1).padStart(2, '0');
            const ano = isNaN(dObj.getTime()) ? 2026 : dObj.getFullYear();
            const dataFmt = `${dia}/${mes}/${ano}`;
            const totalLitros = (row.litros || 0) * (row.qtdRequisicoes || 1);

            tr.innerHTML = `
                <td>${dataFmt}</td>
                <td>${row.inicioSeq}</td>
                <td class="col-number">${row.qtdRequisicoes}</td>
                <td>${row.zona}</td>
                <td><span class="text-highlight">${row.responsavel}</span></td>
                <td>${row.motorista || 'NÃO INFORMADO'}</td>
                <td>${row.posto || 'NÃO INFORMADO'}</td>
                <td>${row.veiculo} ${row.placa ? `(${row.placa})` : ''}</td>
                <td>${row.kmAnterior !== undefined && row.kmAnterior !== null && row.kmAnterior !== '' && row.kmAnterior !== 0 && row.kmAnterior !== 'NÃO INFORMADO' ? (isNaN(row.kmAnterior) ? row.kmAnterior : Number(row.kmAnterior).toLocaleString('pt-BR')) : 'NÃO INFORMADO'}</td>
                <td>${row.km !== undefined && row.km !== null && row.km !== '' && row.km !== 0 && row.km !== 'NÃO INFORMADO' ? (isNaN(row.km) ? row.km : Number(row.km).toLocaleString('pt-BR')) : 'NÃO INFORMADO'}</td>
                <td>${row.combustivel}</td>
                <td class="col-number">${row.litros} L</td>
                <td class="col-number">${Math.round(totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="td-actions">
                    <button class="btn-edit" onclick="editRecord('${row.id}')" title="Editar requisição">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="btn-delete" onclick="deleteRecord('${row.id}')" title="Excluir requisição">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                    </button>
                </td>
            `;
            if (tbody) tbody.appendChild(tr);
        });

        // LINHA DE TOTAL DO FILTRO NO RODAPÉ
        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="2"><span class="total-label">📊 TOTAL DO FILTRO (${sorted.length} registros)</span></td>
                    <td class="col-number"><span class="total-value">${sumQtdReq.toLocaleString('pt-BR')}</span></td>
                    <td colspan="9" style="text-align: right; color: var(--text-muted); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;">Somas do Filtro:</td>
                    <td class="col-number"><span class="total-value">${Math.round(sumLitros).toLocaleString('pt-BR')} L</span></td>
                    <td class="col-number"><span class="total-value">${sumValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                    <td></td>
                </tr>
            `;
        }

    } else if (state.activeTab === 'bases') {
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="col-rank">Pos</th>
                    ${getSortHeaderHtml('Base', 'base')}
                    ${getSortHeaderHtml('Qtd Requisições', 'totalReq', 'col-number')}
                    ${getSortHeaderHtml('Total Consumido (Litros)', 'totalLitros', 'col-number')}
                    ${getSortHeaderHtml('Total Gasto (BRL)', 'totalGasto', 'col-number')}
                </tr>
            `;
        }

        const agg = {};
        state.filteredData.forEach(row => {
            const baseKey = row.zona || 'Não Informado';
            if (!agg[baseKey]) {
                agg[baseKey] = { base: baseKey, totalGasto: 0, totalLitros: 0, totalReq: 0 };
            }
            agg[baseKey].totalGasto += row.valor;
            agg[baseKey].totalLitros += (row.litros * row.qtdRequisicoes);
            agg[baseKey].totalReq += row.qtdRequisicoes;
        });

        const activeSortCol = ['base', 'totalReq', 'totalLitros', 'totalGasto'].includes(state.sortColumn) ? state.sortColumn : 'totalGasto';
        const sorted = sortRecords(Object.values(agg), activeSortCol, state.sortDirection || 'desc');

        if (sorted.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Nenhuma base encontrada para a pesquisa.</td></tr>`;
            return;
        }

        let sumQtdReq = 0;
        let sumLitros = 0;
        let sumValor = 0;

        sorted.forEach((row, idx) => {
            sumQtdReq += row.totalReq;
            sumLitros += row.totalLitros;
            sumValor += row.totalGasto;

            const tr = document.createElement('tr');
            const isTop = idx === 0 && !state.searchText;
            if (isTop) tr.style.backgroundColor = 'rgba(255, 183, 3, 0.04)';

            tr.innerHTML = `
                <td class="col-rank">${idx + 1}º</td>
                <td><span class="text-highlight" style="${isTop ? 'font-size: 1.05rem;' : ''}">${row.base}</span> ${isTop ? '👑 <span class="file-badge" style="margin-left:8px; font-size: 10px;">MAIOR CONSUMO</span>' : ''}</td>
                <td class="col-number">${row.totalReq.toLocaleString('pt-BR')}</td>
                <td class="col-number">${Math.round(row.totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            `;
            if (tbody) tbody.appendChild(tr);
        });

        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="2"><span class="total-label">📊 TOTAL DO FILTRO (${sorted.length} bases)</span></td>
                    <td class="col-number"><span class="total-value">${sumQtdReq.toLocaleString('pt-BR')}</span></td>
                    <td class="col-number"><span class="total-value">${Math.round(sumLitros).toLocaleString('pt-BR')} L</span></td>
                    <td class="col-number"><span class="total-value">${sumValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                </tr>
            `;
        }

    } else if (state.activeTab === 'motoristas') {
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="col-rank">Pos</th>
                    ${getSortHeaderHtml('Motorista', 'motorista')}
                    ${getSortHeaderHtml('Qtd Requisições', 'totalReq', 'col-number')}
                    ${getSortHeaderHtml('Total Consumido (Litros)', 'totalLitros', 'col-number')}
                    ${getSortHeaderHtml('Total Gasto (BRL)', 'totalGasto', 'col-number')}
                </tr>
            `;
        }

        const agg = {};
        state.filteredData.forEach(row => {
            const motoristaKey = row.motorista || 'Não Informado';
            if (!agg[motoristaKey]) {
                agg[motoristaKey] = { motorista: motoristaKey, totalGasto: 0, totalLitros: 0, totalReq: 0 };
            }
            agg[motoristaKey].totalGasto += row.valor;
            agg[motoristaKey].totalLitros += (row.litros * row.qtdRequisicoes);
            agg[motoristaKey].totalReq += row.qtdRequisicoes;
        });

        const activeSortCol = ['motorista', 'totalReq', 'totalLitros', 'totalGasto'].includes(state.sortColumn) ? state.sortColumn : 'totalGasto';
        const sorted = sortRecords(Object.values(agg), activeSortCol, state.sortDirection || 'desc');

        if (sorted.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Nenhum motorista encontrado para a pesquisa.</td></tr>`;
            return;
        }

        let sumQtdReq = 0;
        let sumLitros = 0;
        let sumValor = 0;

        sorted.forEach((row, idx) => {
            sumQtdReq += row.totalReq;
            sumLitros += row.totalLitros;
            sumValor += row.totalGasto;

            const tr = document.createElement('tr');
            const isTop = idx === 0 && !state.searchText;
            if (isTop) tr.style.backgroundColor = 'rgba(255, 183, 3, 0.04)';

            tr.innerHTML = `
                <td class="col-rank">${idx + 1}º</td>
                <td><span class="text-highlight" style="${isTop ? 'font-size: 1.05rem;' : ''}">${row.motorista}</span> ${isTop ? '👑 <span class="file-badge" style="margin-left:8px; font-size: 10px;">MAIOR CONSUMO</span>' : ''}</td>
                <td class="col-number">${row.totalReq.toLocaleString('pt-BR')}</td>
                <td class="col-number">${Math.round(row.totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            `;
            if (tbody) tbody.appendChild(tr);
        });

        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="2"><span class="total-label">📊 TOTAL DO FILTRO (${sorted.length} motoristas)</span></td>
                    <td class="col-number"><span class="total-value">${sumQtdReq.toLocaleString('pt-BR')}</span></td>
                    <td class="col-number"><span class="total-value">${Math.round(sumLitros).toLocaleString('pt-BR')} L</span></td>
                    <td class="col-number"><span class="total-value">${sumValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                </tr>
            `;
        }

    } else if (state.activeTab === 'veiculos') {
        if (thead) {
            thead.innerHTML = `
                <tr>
                    <th class="col-rank">Pos</th>
                    ${getSortHeaderHtml('Veículo', 'veiculo')}
                    <th>Placas Associadas</th>
                    ${getSortHeaderHtml('Qtd Requisições', 'totalReq', 'col-number')}
                    ${getSortHeaderHtml('Total Consumido (Litros)', 'totalLitros', 'col-number')}
                    ${getSortHeaderHtml('Total Gasto (BRL)', 'totalGasto', 'col-number')}
                </tr>
            `;
        }

        const agg = {};
        state.filteredData.forEach(row => {
            const veicKey = row.veiculo || 'Não Informado';
            if (!agg[veicKey]) {
                agg[veicKey] = { veiculo: veicKey, totalGasto: 0, totalLitros: 0, totalReq: 0, placas: new Set() };
            }
            agg[veicKey].totalGasto += row.valor;
            agg[veicKey].totalLitros += (row.litros * row.qtdRequisicoes);
            agg[veicKey].totalReq += row.qtdRequisicoes;
            if (row.placa && row.placa !== 'Não Informado' && row.placa !== 'NÃO INFORMADO') agg[veicKey].placas.add(row.placa);
        });

        const activeSortCol = ['veiculo', 'totalReq', 'totalLitros', 'totalGasto'].includes(state.sortColumn) ? state.sortColumn : 'totalGasto';
        const sorted = sortRecords(Object.values(agg), activeSortCol, state.sortDirection || 'desc');

        if (sorted.length === 0) {
            if (tbody) tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2.5rem;">Nenhum veículo encontrado para a pesquisa.</td></tr>`;
            return;
        }

        let sumQtdReq = 0;
        let sumLitros = 0;
        let sumValor = 0;

        sorted.forEach((row, idx) => {
            sumQtdReq += row.totalReq;
            sumLitros += row.totalLitros;
            sumValor += row.totalGasto;

            const tr = document.createElement('tr');
            const isTop = idx === 0 && !state.searchText;
            if (isTop) tr.style.backgroundColor = 'rgba(255, 183, 3, 0.04)';

            const placasStr = Array.from(row.placas).join(', ') || '-';

            tr.innerHTML = `
                <td class="col-rank">${idx + 1}º</td>
                <td><span class="text-highlight" style="${isTop ? 'font-size: 1.05rem;' : ''}">${row.veiculo}</span></td>
                <td>${placasStr}</td>
                <td class="col-number">${row.totalReq.toLocaleString('pt-BR')}</td>
                <td class="col-number">${Math.round(row.totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            `;
            if (tbody) tbody.appendChild(tr);
        });

        if (tfoot) {
            tfoot.innerHTML = `
                <tr>
                    <td colspan="3"><span class="total-label">📊 TOTAL DO FILTRO (${sorted.length} veículos)</span></td>
                    <td class="col-number"><span class="total-value">${sumQtdReq.toLocaleString('pt-BR')}</span></td>
                    <td class="col-number"><span class="total-value">${Math.round(sumLitros).toLocaleString('pt-BR')} L</span></td>
                    <td class="col-number"><span class="total-value">${sumValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span></td>
                </tr>
            `;
        }
    }
}

// 12. GERADOR E EXPORTADOR DE PLANILHA DE TESTE EXCEL (SHEETJS BROWSER-SIDE)
function generateAndDownloadMockData() {
    const data = [];

    const ZONAS = ['Zona Sul', 'Zona Norte', 'Zona Leste', 'Zona Oeste', 'Zona Centro-Sul'];
    const RESPONSAVEIS = ['João Silva', 'Maria Souza', 'Carlos Lima', 'Ana Oliveira', 'Paulo Santos'];

    const VEICULOS = [
        { nome: 'Caminhão 1', placa: 'ABC-1234', combustivel: 'Diesel' },
        { nome: 'Caminhão 2', placa: 'XYZ-5678', combustivel: 'Diesel' },
        { nome: 'Van Frota', placa: 'MNO-9012', combustivel: 'Gasolina' },
        { nome: 'Fiat Uno Cargo', placa: 'QWE-3456', combustivel: 'Etanol' },
        { nome: 'Chevrolet Onix', placa: 'JKL-7890', combustivel: 'Gasolina' },
        { nome: 'Hyundai HB20', placa: 'OPQ-1122', combustivel: 'Etanol' },
        { nome: 'Toyota Hilux', placa: 'RST-3344', combustivel: 'Diesel' },
        { nome: 'Ford Ka Sedan', placa: 'UVW-5566', combustivel: 'Gasolina' },
        { nome: 'Renault Master', placa: 'XYZ-7788', combustivel: 'Diesel' },
        { nome: 'Volkswagen Gol', placa: 'ABC-9900', combustivel: 'Gasolina' },
        { nome: 'Fiat Fiorino', placa: 'FIO-2026', combustivel: 'Etanol' },
        { nome: 'Jeep Compass', placa: 'JEP-3040', combustivel: 'Diesel' }
    ];

    const PRECOS = {
        'Gasolina': 6.15,
        'Diesel': 5.89,
        'Etanol': 4.25
    };

    const kmAcumulado = {
        'ABC-1234': 85000,
        'XYZ-5678': 120000,
        'MNO-9012': 45000,
        'QWE-3456': 62000,
        'JKL-7890': 28000,
        'OPQ-1122': 31000,
        'RST-3344': 95000,
        'UVW-5566': 54000,
        'XYZ-7788': 140000,
        'ABC-9900': 73000,
        'FIO-2026': 18000,
        'JEP-3040': 67000
    };

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 45); // 45 dias atrás

    let seqNumber = 1;

    function padZero(num, size) {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    for (let d = 0; d < 45; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + d);

        const dia = padZero(currentDate.getDate(), 2);
        const mes = padZero(currentDate.getMonth() + 1, 2);
        const ano = currentDate.getFullYear();
        const dataFormatada = `${dia}/${mes}/${ano}`;

        const abastecimentosNoDia = Math.floor(Math.random() * 3) + 1;

        for (let a = 0; a < abastecimentosNoDia; a++) {
            const veic = VEICULOS[Math.floor(Math.random() * VEICULOS.length)];
            const resp = RESPONSAVEIS[Math.floor(Math.random() * RESPONSAVEIS.length)];
            const zona = ZONAS[Math.floor(Math.random() * ZONAS.length)];

            const combustivel = veic.combustivel;
            const precoLitro = PRECOS[combustivel] + (Math.random() * 0.4 - 0.2);
            const precoFormatado = precoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const qtdRequisicoes = Math.floor(Math.random() * 10) + 1;
            const litros = Math.floor(Math.random() * 35) + 15;

            const inicioSeq = padZero(seqNumber, 7);
            seqNumber += qtdRequisicoes;
            const fimSeq = padZero(seqNumber - 1, 7);

            const valorTotal = qtdRequisicoes * litros * precoLitro;
            const valorFormatado = valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const POSTOS = ['Posto Ipiranga', 'Posto Shell', 'Posto Petrobras', 'Posto Texaco'];
            const posto = POSTOS[Math.floor(Math.random() * POSTOS.length)];

            const MOTORISTAS = ['Marcos Oliveira', 'Felipe Costa', 'Roberto Souza', 'Thiago Santos', 'Bruno Lima'];
            const motorista = MOTORISTAS[Math.floor(Math.random() * MOTORISTAS.length)];

            // Simulação de kilometragem progressiva coerente
            const kmAnt = kmAcumulado[veic.placa];
            const kmPercorrido = Math.round(litros * qtdRequisicoes * (veic.combustivel === 'Diesel' ? (Math.random() * 2 + 4) : (Math.random() * 3 + 8)));
            const kmAtu = kmAnt + kmPercorrido;
            kmAcumulado[veic.placa] = kmAtu;

            data.push({
                'Data': dataFormatada,
                'Início da Sequência': inicioSeq,
                'Fim da Sequência': fimSeq,
                'Qtd Requisições': qtdRequisicoes,
                'Base': zona,
                'Responsável': resp,
                'Motorista': motorista,
                'Posto': posto,
                'Veículo': veic.nome,
                'Placa': veic.placa,
                'KM Anterior': kmAnt,
                'KM Atual': kmAtu,
                'Tipo Combustível': combustivel,
                'Litros': litros,
                'Preço Litro': `R$ ${precoFormatado}`,
                'Valor': `R$ ${valorFormatado}`
            });
        }
    }

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Controle");

        XLSX.writeFile(wb, "dados.xlsx");
        alert('Planilha "dados.xlsx" com 45 dias de dados de teste (incluindo kilometragens realistas) gerada com sucesso! Importe-a no painel para testar.');
    } catch (e) {
        console.error(e);
        alert('Erro ao gerar planilha fictícia.');
    }
}

// EDITAR REGISTRO
window.editRecord = function (id) {
    const record = state.rawData.find(row => row.id === id);
    if (!record) {
        alert('Lançamento não encontrado.');
        return;
    }

    // Setar ID do registro sob edição
    const editIdInput = document.getElementById('input-edit-id');
    if (editIdInput) editIdInput.value = id;

    // Atualizar título do modal e botão
    const modalTitle = document.getElementById('add-requisicao-modal-title');
    if (modalTitle) modalTitle.textContent = 'Editar Requisição';
    const submitBtn = document.getElementById('btn-submit-add-requisicao');
    if (submitBtn) submitBtn.textContent = 'Salvar Alterações';

    // Salvar seqs antigas para controle do pool
    state.oldEditSeqs = { inicioSeq: record.inicioSeq, fimSeq: record.fimSeq };

    // Popular os campos
    const recordDate = (record.date instanceof Date) ? record.date : new Date(record.date);
    document.getElementById('input-date').value = formatDateIso(recordDate);
    document.getElementById('input-zona').value = record.zona === 'NÃO INFORMADO' ? '' : record.zona;
    document.getElementById('input-responsavel').value = record.responsavel === 'NÃO INFORMADO' ? '' : record.responsavel;
    document.getElementById('input-posto').value = record.posto === 'NÃO INFORMADO' ? '' : record.posto;
    document.getElementById('input-motorista').value = record.motorista === 'NÃO INFORMADO' ? '' : record.motorista;
    document.getElementById('input-veiculo').value = record.veiculo === 'NÃO INFORMADO' ? '' : record.veiculo;
    document.getElementById('input-placa').value = record.placa === 'NÃO INFORMADO' ? '' : record.placa;
    document.getElementById('input-combustivel').value = record.combustivel === 'NÃO INFORMADO' ? '' : record.combustivel;
    document.getElementById('input-km-anterior').value = record.kmAnterior === 'NÃO INFORMADO' ? '' : record.kmAnterior;
    document.getElementById('input-km').value = record.km === 'NÃO INFORMADO' ? '' : record.km;
    document.getElementById('input-inicio-seq').value = record.inicioSeq || '';
    const inputFimEl = document.getElementById('input-fim-seq');
    if (inputFimEl) inputFimEl.value = record.fimSeq || '';
    document.getElementById('input-qtd-req').value = record.qtdRequisicoes || 1;
    document.getElementById('input-preco-litro').value = record.precoLitro || 0;

    // Determinar e ajustar modo de abastecimento (Litros ou Valor)
    const radioLitros = document.querySelector('input[name="input-modo-abastecimento"][value="litros"]');
    const radioValor = document.querySelector('input[name="input-modo-abastecimento"][value="valor"]');
    const groupLitros = document.getElementById('group-litros');
    const groupValTotal = document.getElementById('group-valor-total');
    const inputLitros = document.getElementById('input-litros');
    const inputValTotal = document.getElementById('input-valor-total');

    // Por padrão populamos os litros
    if (radioLitros) radioLitros.checked = true;
    if (groupLitros) groupLitros.style.display = 'flex';
    if (groupValTotal) groupValTotal.style.display = 'none';
    if (inputLitros) {
        inputLitros.value = record.litros || 0;
        inputLitros.setAttribute('required', '');
    }
    if (inputValTotal) {
        inputValTotal.value = '';
        inputValTotal.removeAttribute('required');
    }

    // Abrir o modal
    document.getElementById('add-requisicao-modal').classList.add('active');
};

// EXCLUIR REGISTRO GLOBAL
window.deleteRecord = function (id) {
    if (confirm("Tem certeza de que deseja excluir esta requisição?")) {
        const record = state.rawData.find(row => row.id === id);
        if (record && record.inicioSeq) {
            const startObj = parseSeqString(record.inicioSeq);
            const endObj = parseSeqString(record.fimSeq || record.inicioSeq);
            const restoredNumbers = [];
            if (!isNaN(startObj.num)) {
                const startNum = startObj.num;
                const endNum = isNaN(endObj.num) ? startNum : endObj.num;
                for (let n = startNum; n <= endNum; n++) {
                    if (startObj.prefix) {
                        const match = record.inicioSeq.toString().trim().match(/^(.*)-(\d+)$/);
                        const padLength = match ? match[2].length : 3;
                        restoredNumbers.push(`${startObj.prefix}-${n.toString().padStart(padLength, '0')}`);
                    } else {
                        restoredNumbers.push(n.toString());
                    }
                }
            } else {
                restoredNumbers.push(record.inicioSeq.toString().trim());
            }
            
            // Adicionar de volta à lista de requisições personalizadas se não estiverem lá
            const currentPool = state.customRequisicoes || [];
            const newPool = Array.from(new Set([...currentPool, ...restoredNumbers])).sort((a, b) => {
                const aObj = parseSeqString(a);
                const bObj = parseSeqString(b);
                if (aObj.prefix !== bObj.prefix) {
                    return aObj.prefix.localeCompare(bObj.prefix);
                }
                return aObj.num - bObj.num;
            });
            state.customRequisicoes = newPool;
            localStorage.setItem(getEnvKey('custom_requisicoes'), JSON.stringify(state.customRequisicoes));
            
            // Atualizar datalist
            populateRequisicoesDatalist('datalist-requisicoes', state.customRequisicoes);
        }

        state.rawData = state.rawData.filter(row => row.id !== id);
        localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
        syncWithServerSilent();
        updateDashboard();
    }
};

// EXPORTAR DADOS ATUALIZADOS PARA PLANILHA EXCEL (.XLSX)
function generateExcelWorkbook() {
    function padZero(num, size) {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    // 1. Aba "Lançamentos Filtrados" (respeitando rigorosamente a ordenação e filtros ativos na tela)
    const sortedFiltrados = sortRecords(state.filteredData || [], state.sortColumn || 'date', state.sortDirection || 'desc');
    const filtradosData = sortedFiltrados.map(row => {
        const dObj = safeParseDate(row.date);
        const dia = padZero(isNaN(dObj.getTime()) ? 1 : dObj.getDate(), 2);
        const mes = padZero(isNaN(dObj.getTime()) ? 1 : dObj.getMonth() + 1, 2);
        const ano = isNaN(dObj.getTime()) ? 2026 : dObj.getFullYear();
        const dataFmt = `${dia}/${mes}/${ano}`;

        const totalLitros = row.litros * row.qtdRequisicoes;
        const precoNum = Number(row.precoLitro);
        const valorNum = Number(row.valor);

        return {
            'Data': dataFmt,
            'Nº da Requisição': row.inicioSeq,
            'Qtd Requisições': row.qtdRequisicoes,
            'Base': row.zona,
            'Responsável': row.responsavel,
            'Motorista': row.motorista || 'Não Informado',
            'Posto': row.posto || 'Não Informado',
            'Veículo': row.veiculo,
            'Placa': row.placa,
            'KM Anterior': (row.kmAnterior !== undefined && row.kmAnterior !== null && row.kmAnterior !== '' && row.kmAnterior !== 0 && row.kmAnterior !== 'NÃO INFORMADO') ? row.kmAnterior : 'NÃO INFORMADO',
            'KM Atual': (row.km !== undefined && row.km !== null && row.km !== '' && row.km !== 0 && row.km !== 'NÃO INFORMADO') ? row.km : 'NÃO INFORMADO',
            'Tipo Combustível': row.combustivel,
            'Litros/Req': row.litros,
            'Total Litros': totalLitros,
            'Preço Litro (R$)': precoNum,
            'Valor Total (R$)': valorNum
        };
    });

    // 2. Aba "Resumo por Base"
    const aggBases = {};
    state.filteredData.forEach(row => {
        const baseKey = row.zona || 'Não Informado';
        if (!aggBases[baseKey]) {
            aggBases[baseKey] = { 'Base': baseKey, 'Qtd Requisições': 0, 'Total Consumido (Litros)': 0, 'Total Gasto (R$)': 0 };
        }
        aggBases[baseKey]['Qtd Requisições'] += row.qtdRequisicoes;
        aggBases[baseKey]['Total Consumido (Litros)'] += (row.litros * row.qtdRequisicoes);
        aggBases[baseKey]['Total Gasto (R$)'] += row.valor;
    });
    const basesData = Object.values(aggBases).sort((a, b) => b['Total Gasto (R$)'] - a['Total Gasto (R$)']);

    // 3. Aba "Resumo por Motorista"
    const aggMotoristas = {};
    state.filteredData.forEach(row => {
        const motKey = row.motorista || 'Não Informado';
        if (!aggMotoristas[motKey]) {
            aggMotoristas[motKey] = { 'Motorista': motKey, 'Qtd Requisições': 0, 'Total Consumido (Litros)': 0, 'Total Gasto (R$)': 0 };
        }
        aggMotoristas[motKey]['Qtd Requisições'] += row.qtdRequisicoes;
        aggMotoristas[motKey]['Total Consumido (Litros)'] += (row.litros * row.qtdRequisicoes);
        aggMotoristas[motKey]['Total Gasto (R$)'] += row.valor;
    });
    const motoristasData = Object.values(aggMotoristas).sort((a, b) => b['Total Gasto (R$)'] - a['Total Gasto (R$)']);

    // 4. Aba "Resumo por Veículo"
    const aggVeiculos = {};
    state.filteredData.forEach(row => {
        const veicKey = row.veiculo || 'Não Informado';
        if (!aggVeiculos[veicKey]) {
            aggVeiculos[veicKey] = { 'Veículo': veicKey, 'Placas Associadas': new Set(), 'Qtd Requisições': 0, 'Total Consumido (Litros)': 0, 'Total Gasto (R$)': 0 };
        }
        aggVeiculos[veicKey]['Qtd Requisições'] += row.qtdRequisicoes;
        aggVeiculos[veicKey]['Total Consumido (Litros)'] += (row.litros * row.qtdRequisicoes);
        aggVeiculos[veicKey]['Total Gasto (R$)'] += row.valor;
        if (row.placa) aggVeiculos[veicKey]['Placas Associadas'].add(row.placa);
    });
    const veiculosData = Object.values(aggVeiculos).map(row => {
        return {
            'Veículo': row['Veículo'],
            'Placas Associadas': Array.from(row['Placas Associadas']).join(', '),
            'Qtd Requisições': row['Qtd Requisições'],
            'Total Consumido (Litros)': row['Total Consumido (Litros)'],
            'Total Gasto (R$)': row['Total Gasto (R$)']
        };
    }).sort((a, b) => b['Total Gasto (R$)'] - a['Total Gasto (R$)']);

    // 5. Aba "Banco de Dados Completo"
    const backupData = state.rawData.map(row => {
        const dObj = safeParseDate(row.date);
        const dia = padZero(isNaN(dObj.getTime()) ? 1 : dObj.getDate(), 2);
        const mes = padZero(isNaN(dObj.getTime()) ? 1 : dObj.getMonth() + 1, 2);
        const dataFmt = `${dia}/${mes}/${isNaN(dObj.getTime()) ? 2026 : dObj.getFullYear()}`;

        return {
            'Data': dataFmt,
            'Nº da Requisição': row.inicioSeq,
            'Qtd Requisições': row.qtdRequisicoes,
            'Base': row.zona,
            'Responsável': row.responsavel,
            'Motorista': row.motorista || 'Não Informado',
            'Posto': row.posto || 'Não Informado',
            'Veículo': row.veiculo,
            'Placa': row.placa,
            'KM Anterior': (row.kmAnterior !== undefined && row.kmAnterior !== null && row.kmAnterior !== '' && row.kmAnterior !== 0 && row.kmAnterior !== 'NÃO INFORMADO') ? row.kmAnterior : 'NÃO INFORMADO',
            'KM Atual': (row.km !== undefined && row.km !== null && row.km !== '' && row.km !== 0 && row.km !== 'NÃO INFORMADO') ? row.km : 'NÃO INFORMADO',
            'Tipo Combustível': row.combustivel,
            'Litros': row.litros,
            'Preço Litro': row.precoLitro,
            'Valor': row.valor
        };
    });

    const wb = XLSX.utils.book_new();
    
    // Anexar abas ao workbook
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(filtradosData), "Lançamentos Filtrados");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(basesData), "Resumo por Base");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(motoristasData), "Resumo por Motorista");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(veiculosData), "Resumo por Veículo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(backupData), "Banco de Dados Completo");

    // Aba extra com configurações para restauração de backups
    const configData = [{
        kpi_order: localStorage.getItem('kpi_cards_order') || "",
        charts_order: localStorage.getItem('charts_grid_order') || "",
        chart_prefs: getChartPreferencesString(),
        custom_bases: JSON.stringify(state.customBases || []),
        custom_postos: JSON.stringify(state.customPostos || []),
        custom_motoristas: JSON.stringify(state.customMotoristas || []),
        custom_veiculos: JSON.stringify(state.customVeiculos || []),
        custom_requisicoes: JSON.stringify(state.customRequisicoes || [])
    }];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(configData), "Configuracoes");

    return wb;
}

function exportToExcel() {
    if (state.rawData.length === 0) {
        alert('Não há dados disponíveis para exportar.');
        return;
    }

    try {
        const wb = generateExcelWorkbook();

        const now = new Date();
        const yy = String(now.getFullYear()).slice(-2);
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        const filename = `dados_atualizados_${dd}-${mm}-${yy}_${hh}${min}.xlsx`;
        XLSX.writeFile(wb, filename);
    } catch (e) {
        console.error(e);
        alert('Erro ao exportar base de dados para Excel.');
    }
}

async function saveBackup() {
    if (state.rawData.length === 0) {
        alert('Não há dados disponíveis para salvar ou fazer backup.');
        return;
    }

    const isFileProtocol = window.location.protocol === 'file:';

    // 1. Salvar no localStorage escopado
    localStorage.setItem(getEnvKey('combustivel_dashboard_data'), JSON.stringify(state.rawData));
    localStorage.setItem(getEnvKey('combustivel_dashboard_filename'), state.filename);

    // 2. Se estiver online (servidor), sincroniza no MySQL
    if (!isFileProtocol) {
        const syncPayload = {
            environment: state.activeEnv,
            requisicoes: state.rawData,
            custom_bases: state.customBases,
            custom_postos: state.customPostos,
            custom_motoristas: state.customMotoristas,
            custom_veiculos: state.customVeiculos,
            custom_requisicoes: state.customRequisicoes
        };

        fetch('./api/sync_data.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(syncPayload)
        })
        .then(res => res.json())
        .then(result => {
            if (result.success) {
                console.log('Dados sincronizados com o MySQL com sucesso.');
            } else {
                console.warn('Erro ao sincronizar com MySQL:', result.message);
            }
        })
        .catch(err => {
            console.error('Erro de conexão ao sincronizar com MySQL:', err);
        });
    }

    const wb = generateExcelWorkbook();

    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    
    const envSanitized = state.activeEnv.replace(/[^a-zA-Z0-9_\-]/g, '_');
    const filename = `backup_controle_${envSanitized}_${dd}-${mm}-${yyyy}_${hh}${min}${ss}.xlsx`;

    if (isFileProtocol) {
        // Modo Local sem servidor (file:///) -> Download e abre aba do Drive
        try {
            XLSX.writeFile(wb, filename);
            
            // Abrir a pasta do Google Drive em uma nova aba para facilitar o upload/sincronização
            window.open('https://drive.google.com/drive/folders/1XAIlrw6BLJFWrLVOKwKkoyZl9IDYiKqH?usp=sharing', '_blank');
            
            alert('Configurações salvas no navegador!\n\nGeramos o arquivo Excel e abrimos a pasta do Google Drive em uma nova aba para você arrastar o backup.');
        } catch (e) {
            console.error(e);
            alert('Erro ao gerar planilha de backup.');
        }
    } else {
        // Com servidor rodando (localhost ou site de produção) -> Envia silenciosamente para o local/servidor
        try {
            const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/octet-stream' });
            
            const formData = new FormData();
            formData.append('backup_file', blob, filename);
            formData.append('env', state.activeEnv);
            
            fetch('./api/save_backup.php', {
                method: 'POST',
                body: formData
            })
            .then(res => res.json())
            .then(result => {
                if (result.success) {
                    console.log('Backup salvo de maneira sigilosa no servidor: ' + filename);
                } else {
                    console.warn('Erro ao salvar backup sigiloso no servidor:', result.message);
                }
            })
            .catch(err => {
                console.error('Erro de conexão ao enviar backup sigiloso:', err);
            });
        } catch (e) {
            console.error('Erro ao compilar backup sigiloso:', e);
        }
        
        alert('Dados salvos com sucesso!');
    }
}

function syncWithServerSilent() {
    const isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) return;

    const syncPayload = {
        environment: state.activeEnv,
        requisicoes: state.rawData,
        custom_bases: state.customBases,
        custom_postos: state.customPostos,
        custom_motoristas: state.customMotoristas,
        custom_veiculos: state.customVeiculos,
        custom_requisicoes: state.customRequisicoes
    };

    fetch('./api/sync_data.php', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(syncPayload)
    })
    .then(res => res.json())
    .then(result => {
        if (result.success) {
            console.log('Dados sincronizados com o MySQL em background com sucesso.');
        } else {
            console.warn('Erro ao sincronizar com MySQL em background:', result.message);
        }
    })
    .catch(err => {
        console.error('Erro de conexão ao sincronizar com MySQL em background:', err);
    });
}

// MAXIMIZAR E MINIMIZAR GRÁFICOS
window.toggleMaximizeChart = function(btn) {
    const card = btn.closest('.chart-card');
    const overlay = document.getElementById('chart-overlay');
    
    const isMaximized = card.classList.toggle('maximized');
    
    if (isMaximized) {
        overlay.classList.add('active');
        btn.title = "Minimizar gráfico";
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="4 14 10 14 10 20"></polyline>
                <polyline points="20 10 14 10 14 4"></polyline>
                <line x1="14" y1="10" x2="21" y2="3"></line>
                <line x1="10" y1="14" x2="3" y2="21"></line>
            </svg>
        `;
    } else {
        overlay.classList.remove('active');
        btn.title = "Maximizar gráfico";
        btn.innerHTML = `
            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
        `;
    }
    
    const chartId = card.querySelector('[id^="chart-"]').id;
    let chartInstance = null;
    if (chartId.includes('combustivel-donut')) chartInstance = state.charts.donut;
    else if (chartId.includes('zona-donut')) chartInstance = state.charts.zonaDonut;
    else if (chartId.includes('gasto-mensal')) chartInstance = state.charts.bar;
    else if (chartId.includes('volume-mensal')) chartInstance = state.charts.area;
    
    if (chartInstance) {
        const newHeight = isMaximized ? window.innerHeight * 0.7 : 290;
        chartInstance.updateOptions({
            chart: { height: newHeight }
        });
    }
};

// 14. GERADOR DE CONTEÚDO DO INFOGRÁFICO
function populateInfografico() {
    // 1. Período
    const startFmt = state.dateRange.start ? String(state.dateRange.start.getDate()).padStart(2, '0') + '/' + String(state.dateRange.start.getMonth() + 1).padStart(2, '0') + '/' + state.dateRange.start.getFullYear() : '-';
    const endFmt = state.dateRange.end ? String(state.dateRange.end.getDate()).padStart(2, '0') + '/' + String(state.dateRange.end.getMonth() + 1).padStart(2, '0') + '/' + state.dateRange.end.getFullYear() : '-';
    document.getElementById('info-period-text').textContent = `Período: ${startFmt} até ${endFmt}`;

    // 2. Arquivo e Timestamp de geração
    updatePrintTimestamps();

    // 3. KPIs
    let totalGasto = 0;
    let totalLitros = 0;
    let totalReq = 0;
    const combustiveisGasto = {};
    const zonasGasto = {};
    const veiculosGasto = {};
    const motoristasGasto = {};

    state.filteredData.forEach(row => {
        totalGasto += row.valor;
        totalLitros += (row.litros * row.qtdRequisicoes);
        totalReq += row.qtdRequisicoes;

        // Agrupamentos
        combustiveisGasto[row.combustivel] = (combustiveisGasto[row.combustivel] || 0) + row.valor;
        zonasGasto[row.zona] = (zonasGasto[row.zona] || 0) + row.valor;

        if (row.veiculo && row.veiculo !== 'Não Informado') {
            veiculosGasto[row.veiculo] = (veiculosGasto[row.veiculo] || 0) + row.valor;
        }
        if (row.responsavel && row.responsavel !== 'Não Informado') {
            motoristasGasto[row.responsavel] = (motoristasGasto[row.responsavel] || 0) + row.valor;
        }
    });

    const precoMedio = totalLitros > 0 ? (totalGasto / totalLitros) : 0;

    document.getElementById('info-kpi-gasto').textContent = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('info-kpi-litros').textContent = Math.round(totalLitros).toLocaleString('pt-BR') + ' L';
    document.getElementById('info-kpi-preco-medio').textContent = precoMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('info-kpi-req').textContent = totalReq.toLocaleString('pt-BR');

    // 4. Barras de Combustível
    const combContainer = document.getElementById('info-combustivel-bars');
    combContainer.innerHTML = '';
    const sortedComb = Object.entries(combustiveisGasto).sort((a, b) => b[1] - a[1]);

    const combColors = {
        'Gasolina': '#ffb703',
        'Diesel': '#8338ec',
        'Etanol': '#fb5607'
    };

    sortedComb.forEach(([comb, val]) => {
        const pct = totalGasto > 0 ? (val / totalGasto) * 100 : 0;
        const color = combColors[comb] || '#22c55e';
        const barItem = document.createElement('div');
        barItem.className = 'info-bar-item';
        barItem.innerHTML = `
            <div class="info-bar-info">
                <span class="info-bar-label">${comb} (${Math.round(pct)}%)</span>
                <span class="info-bar-value">${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div class="info-bar-bg">
                <div class="info-bar-fill" style="width: ${pct}%; background-color: ${color};"></div>
            </div>
        `;
        combContainer.appendChild(barItem);
    });

    // 5. Barras de Zona
    const zonaContainer = document.getElementById('info-zona-bars');
    zonaContainer.innerHTML = '';
    const sortedZonas = Object.entries(zonasGasto).sort((a, b) => b[1] - a[1]);

    sortedZonas.forEach(([zona, val]) => {
        const pct = totalGasto > 0 ? (val / totalGasto) * 100 : 0;
        const barItem = document.createElement('div');
        barItem.className = 'info-bar-item';
        barItem.innerHTML = `
            <div class="info-bar-info">
                <span class="info-bar-label">${zona} (${Math.round(pct)}%)</span>
                <span class="info-bar-value">${val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
            <div class="info-bar-bg">
                <div class="info-bar-fill" style="width: ${pct}%; background-color: #118ab2;"></div>
            </div>
        `;
        zonaContainer.appendChild(barItem);
    });

    // 6. Líderes (4 bases com maiores consumos em um grid 2x2)
    const sortedZonasGasto = Object.entries(zonasGasto)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4);

    const gridContainer = document.getElementById('info-bases-leader-grid');
    if (gridContainer) {
        gridContainer.innerHTML = '';
        
        const displayItems = [...sortedZonasGasto];
        while (displayItems.length < 4) {
            displayItems.push(['-', 0]);
        }
        
        displayItems.forEach(([zona, val]) => {
            const card = document.createElement('div');
            card.className = 'leader-box';
            card.innerHTML = `
                <span class="leader-title">${zona}</span>
                <span class="leader-subtitle">${val > 0 ? val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00'}</span>
            `;
            gridContainer.appendChild(card);
        });
    }
}

// 14.1 GERADOR DE CONTEÚDO DO RELATÓRIO SIMPLIFICADO
function populateRelatorioSimplificado() {
    // 1. Período
    const startFmt = state.dateRange.start ? String(state.dateRange.start.getDate()).padStart(2, '0') + '/' + String(state.dateRange.start.getMonth() + 1).padStart(2, '0') + '/' + state.dateRange.start.getFullYear() : '-';
    const endFmt = state.dateRange.end ? String(state.dateRange.end.getDate()).padStart(2, '0') + '/' + String(state.dateRange.end.getMonth() + 1).padStart(2, '0') + '/' + state.dateRange.end.getFullYear() : '-';
    const periodText = document.getElementById('rel-period-text');
    if (periodText) periodText.textContent = `Período: ${startFmt} até ${endFmt}`;

    // 2. Timestamp de geração
    const timestampEl = document.getElementById('rel-generation-timestamp');
    if (timestampEl) {
        const now = new Date();
        const dd = String(now.getDate()).padStart(2, '0');
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const yyyy = now.getFullYear();
        const hh = String(now.getHours()).padStart(2, '0');
        const min = String(now.getMinutes()).padStart(2, '0');
        timestampEl.textContent = `${dd}/${mm}/${yyyy} às ${hh}:${min}`;
    }

    // 3. Cálculos de KPIs
    let totalLitros = 0;
    let totalReq = 0;
    const responsavelMetrics = {};

    state.filteredData.forEach(row => {
        const reqs = row.qtdRequisicoes || 0;
        const litros = (row.litros || 0) * reqs;
        
        totalLitros += litros;
        totalReq += reqs;

        if (row.responsavel) {
            const resp = row.responsavel.trim();
            if (!responsavelMetrics[resp]) {
                responsavelMetrics[resp] = { reqs: 0, litros: 0 };
            }
            responsavelMetrics[resp].reqs += reqs;
            responsavelMetrics[resp].litros += litros;
        }
    });

    const qtdResponsaveis = Object.keys(responsavelMetrics).length;
    const reqsDisponiveis = state.customRequisicoes ? state.customRequisicoes.length : 0;
    const reqsDistribuidas = totalReq;
    const volumeTotalLitros = totalLitros;

    const kpiResponsaveis = document.getElementById('rel-kpi-responsaveis');
    const kpiDisponiveis = document.getElementById('rel-kpi-disponiveis');
    const kpiDistribuidas = document.getElementById('rel-kpi-distribuidas');
    const kpiLitros = document.getElementById('rel-kpi-litros-total');

    if (kpiResponsaveis) kpiResponsaveis.textContent = qtdResponsaveis.toLocaleString('pt-BR');
    if (kpiDisponiveis) kpiDisponiveis.textContent = reqsDisponiveis.toLocaleString('pt-BR');
    if (kpiDistribuidas) kpiDistribuidas.textContent = reqsDistribuidas.toLocaleString('pt-BR');
    if (kpiLitros) kpiLitros.textContent = Math.round(volumeTotalLitros).toLocaleString('pt-BR') + ' L';

    // 4. Preencher Tabela de Responsáveis
    const tbody = document.getElementById('rel-responsavel-tbody');
    const tfoot = document.getElementById('rel-responsavel-tfoot');

    if (tbody) {
        tbody.innerHTML = '';
        
        const sortedResponsaveis = Object.entries(responsavelMetrics).sort((a, b) => b[1].litros - a[1].litros);

        sortedResponsaveis.forEach(([resp, metrics]) => {
            const pct = totalLitros > 0 ? (metrics.litros / totalLitros) * 100 : 0;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600; color: var(--text-primary);">${resp}</td>
                <td style="text-align: center;">${metrics.reqs.toLocaleString('pt-BR')}</td>
                <td style="text-align: center; font-weight: bold; color: var(--accent-yellow);">${Math.round(metrics.litros).toLocaleString('pt-BR')} L</td>
                <td style="text-align: center;">${pct.toFixed(1)}%</td>
            `;
            tbody.appendChild(tr);
        });

        if (sortedResponsaveis.length === 0) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="4" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Nenhum dado encontrado para o período filtrado.</td>`;
            tbody.appendChild(tr);
        }
    }

    if (tfoot) {
        tfoot.innerHTML = `
            <tr>
                <td style="font-weight: 700; color: var(--text-primary);">TOTAL (${qtdResponsaveis} Responsáveis)</td>
                <td style="text-align: center; font-weight: 700; color: var(--text-primary);">${totalReq.toLocaleString('pt-BR')}</td>
                <td style="text-align: center; font-weight: 800; color: var(--accent-yellow);">${Math.round(totalLitros).toLocaleString('pt-BR')} L</td>
                <td style="text-align: center; font-weight: 700; color: var(--text-primary);">100%</td>
            </tr>
        `;
    }
}

// Função para alternar o tema dos gráficos do dashboard (para impressão clara)
function toggleChartsTheme(isLight) {
    const themeMode = isLight ? 'light' : 'dark';
    const textColor = isLight ? '#334155' : '#94a3b8';
    const gridColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.05)';
    const chartHeight = isLight ? 260 : 290; // Aumentado para 260px para dar espaço para a legenda inferior do donut
    
    // 1. Gasto por Combustível (Sempre Donut)
    if (state.charts.donut) {
        state.charts.donut.updateOptions({
            theme: { mode: themeMode },
            chart: {
                height: chartHeight,
                foreColor: textColor,
                animations: { enabled: !isLight } // Desativa animação para renderizar 100% instantâneo na impressão
            },
            plotOptions: {
                pie: {
                    donut: {
                        labels: {
                            value: { color: isLight ? '#0f172a' : '#ffffff' }
                        }
                    }
                }
            },
            legend: {
                show: true,
                position: 'bottom',
                labels: { colors: textColor }
            }
        }, true); // O segundo parâmetro true força o redesenho completo de caminhos e textos
    }
    
    // 2. Gasto por Zona (Pode ser Donut ou Barra Horizontal/Vertical ou Linha)
    if (state.charts.zonaDonut) {
        const type = state.charts.zonaDonut.w?.config?.chart?.type || 'donut';
        if (type === 'donut' || type === 'pie') {
            state.charts.zonaDonut.updateOptions({
                theme: { mode: themeMode },
                chart: {
                    height: chartHeight,
                    foreColor: textColor,
                    animations: { enabled: !isLight }
                },
                plotOptions: {
                    pie: {
                        donut: {
                            labels: {
                                value: { color: isLight ? '#0f172a' : '#ffffff' }
                            }
                        }
                    }
                },
                legend: {
                    show: true,
                    position: 'bottom',
                    labels: { colors: textColor }
                }
            }, true);
        } else {
            // Se for Barra ou Linha
            const isHoriz = state.charts.zonaDonut.w?.config?.plotOptions?.bar?.horizontal;
            state.charts.zonaDonut.updateOptions({
                theme: { mode: themeMode },
                chart: {
                    height: chartHeight,
                    foreColor: textColor,
                    animations: { enabled: !isLight }
                },
                dataLabels: {
                    style: {
                        colors: isLight ? ['#000000'] : (isHoriz ? ['#ffffff'] : ['#94a3b8'])
                    }
                },
                yaxis: {
                    labels: {
                        show: true,
                        minWidth: 95,
                        maxWidth: 110
                    }
                },
                grid: { borderColor: gridColor }
            }, true);
        }
    }
    
    // 3. Gasto Mensal (Barra Vertical)
    if (state.charts.bar) {
        state.charts.bar.updateOptions({
            theme: { mode: themeMode },
            chart: {
                height: chartHeight,
                foreColor: textColor,
                animations: { enabled: !isLight }
            },
            dataLabels: {
                style: {
                    colors: isLight ? ['#000000'] : ['#94a3b8']
                }
            },
            grid: { borderColor: gridColor }
        }, true);
    }
    
    // 4. Volume Mensal (Área)
    if (state.charts.area) {
        state.charts.area.updateOptions({
            theme: { mode: themeMode },
            chart: {
                height: chartHeight,
                foreColor: textColor,
                animations: { enabled: !isLight }
            },
            dataLabels: {
                style: {
                    colors: isLight ? ['#000000'] : ['#ffffff']
                }
            },
            grid: { borderColor: gridColor }
        }, true);
    }
}

// ==========================================
// 15. PORTABILIDADE E PREFERÊNCIAS DE LAYOUT
// ==========================================

function getChartPreferencesString() {
    const prefs = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('chart_pref_')) {
            prefs[key] = localStorage.getItem(key);
        }
    }
    return JSON.stringify(prefs);
}

function getChartPrefs(chartId) {
    const prefKey = `chart_pref_${chartId}`;
    try {
        const saved = localStorage.getItem(prefKey);
        if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {};
}

function loadConfigFromWorkbook(workbook) {
    if (workbook.SheetNames.includes('Configuracoes')) {
        try {
            const ws = workbook.Sheets['Configuracoes'];
            const json = XLSX.utils.sheet_to_json(ws);
            if (json && json.length > 0) {
                const config = json[0];
                if (config.kpi_order) {
                    localStorage.setItem('kpi_cards_order', config.kpi_order);
                }
                if (config.charts_order) {
                    localStorage.setItem('charts_grid_order', config.charts_order);
                }
                if (config.chart_prefs) {
                    const prefs = JSON.parse(config.chart_prefs);
                    for (const key in prefs) {
                        localStorage.setItem(key, prefs[key]);
                    }
                }
                if (config.custom_bases) {
                    localStorage.setItem('custom_bases', config.custom_bases);
                    state.customBases = JSON.parse(config.custom_bases);
                }
                if (config.custom_postos) {
                    localStorage.setItem('custom_postos', config.custom_postos);
                    state.customPostos = JSON.parse(config.custom_postos);
                }
                if (config.custom_motoristas) {
                    localStorage.setItem('custom_motoristas', config.custom_motoristas);
                    state.customMotoristas = JSON.parse(config.custom_motoristas);
                }
                if (config.custom_veiculos) {
                    localStorage.setItem('custom_veiculos', config.custom_veiculos);
                    state.customVeiculos = JSON.parse(config.custom_veiculos);
                }
                if (config.custom_requisicoes) {
                    localStorage.setItem('custom_requisicoes', config.custom_requisicoes);
                    state.customRequisicoes = JSON.parse(config.custom_requisicoes);
                }
                updateRelationsMappings();
                applyLoadedPreferences();
            }
        } catch (e) {
            console.error('Erro ao ler a aba de configurações do Excel', e);
        }
    }
}

function applyLoadedPreferences() {
    // 1. Reordenar KPIs
    const kpiOrderStr = localStorage.getItem('kpi_cards_order');
    if (kpiOrderStr) {
        try {
            const kpiOrder = kpiOrderStr.split(',');
            const kpiGroup = document.querySelector('.kpi-group');
            if (kpiGroup) {
                kpiOrder.forEach(id => {
                    const card = document.getElementById(id);
                    if (card) kpiGroup.appendChild(card);
                });
            }
        } catch (e) {
            console.error('Erro ao aplicar ordem de KPIs', e);
        }
    }

    // 2. Reordenar Gráficos
    const chartsOrderStr = localStorage.getItem('charts_grid_order');
    if (chartsOrderStr) {
        try {
            const chartsOrder = chartsOrderStr.split(',');
            const chartsGrid = document.querySelector('.charts-grid');
            if (chartsGrid) {
                chartsOrder.forEach(id => {
                    const card = document.getElementById(id);
                    if (card) chartsGrid.appendChild(card);
                });
            }
        } catch (e) {
            console.error('Erro ao aplicar ordem dos gráficos', e);
        }
    }

    // 3. Re-renderizar todos os gráficos para atualizar os tipos/rótulos/legendas customizados
    if (state.rawData && state.rawData.length > 0) {
        renderCombustivelDonut();
        renderZonaDonut();
        renderBarChart();
        renderAreaChart();
    }
}

// ==========================================
// 16. DRAG AND DROP (KPIs & GRÁFICOS)
// ==========================================

function initDragAndDrop() {
    applyLoadedPreferences();

    // 1. Drag and Drop de KPIs
    const kpiGroup = document.querySelector('.kpi-group');
    if (kpiGroup) {
        kpiGroup.querySelectorAll('.kpi-card').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.id);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                const newOrder = Array.from(kpiGroup.querySelectorAll('.kpi-card')).map(c => c.id);
                localStorage.setItem('kpi_cards_order', newOrder.join(','));
            });
        });

        kpiGroup.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingCard = kpiGroup.querySelector('.kpi-card.dragging');
            if (!draggingCard) return;
            const afterElement = getDragAfterElement(kpiGroup, e.clientX, e.clientY, true);
            if (afterElement == null) {
                kpiGroup.appendChild(draggingCard);
            } else {
                kpiGroup.insertBefore(draggingCard, afterElement);
            }
        });
    }

    // 2. Drag and Drop de Gráficos
    const chartsGrid = document.querySelector('.charts-grid');
    if (chartsGrid) {
        chartsGrid.querySelectorAll('.chart-card').forEach(card => {
            const header = card.querySelector('.chart-card-header');
            if (header) {
                header.addEventListener('mousedown', () => {
                    card.setAttribute('draggable', 'true');
                });
            }

            card.addEventListener('dragstart', (e) => {
                card.classList.add('dragging');
                e.dataTransfer.setData('text/plain', card.id);
                const panel = card.querySelector('.chart-config-panel');
                if (panel) panel.style.display = 'none';
            });

            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                card.removeAttribute('draggable');
                const newOrder = Array.from(chartsGrid.querySelectorAll('.chart-card')).map(c => c.id);
                localStorage.setItem('charts_grid_order', newOrder.join(','));
            });
        });

        chartsGrid.addEventListener('dragover', (e) => {
            e.preventDefault();
            const draggingCard = chartsGrid.querySelector('.chart-card.dragging');
            if (!draggingCard) return;
            const afterElement = getDragAfterElement(chartsGrid, e.clientX, e.clientY, false);
            if (afterElement == null) {
                chartsGrid.appendChild(draggingCard);
            } else {
                chartsGrid.insertBefore(draggingCard, afterElement);
            }
        });
    }
}

function getDragAfterElement(container, x, y, isVertical = false) {
    const draggableElements = Array.from(container.querySelectorAll('.kpi-card:not(.dragging), .chart-card:not(.dragging)'));

    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        let offset;
        if (isVertical) {
            offset = y - (box.top + box.height / 2);
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            }
        } else {
            const centerX = box.left + box.width / 2;
            const centerY = box.top + box.height / 2;
            offset = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
            if (offset < closest.offset) {
                const isBefore = (x < centerX && y < box.bottom) || (y < centerY);
                return { offset: offset, element: isBefore ? child : closest.element };
            }
        }
        return closest;
    }, { offset: isVertical ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY, element: null }).element;
}

// ==========================================
// 17. WIDGET DE CALENDÁRIO CUSTOMIZADO
// ==========================================

let calendarCurrentMonth = new Date().getMonth();
let calendarCurrentYear = new Date().getFullYear();

function initCalendarWidget() {
    const triggerBtn = document.getElementById('btn-open-calendar');
    const dropdown = document.getElementById('calendar-dropdown');

    if (triggerBtn && dropdown) {
        triggerBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display === 'flex';
            dropdown.style.display = isOpen ? 'none' : 'flex';
        });
    }

    const prevBtn = document.getElementById('calendar-prev-month');
    const nextBtn = document.getElementById('calendar-next-month');

    if (prevBtn) {
        prevBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarCurrentMonth--;
            if (calendarCurrentMonth < 0) {
                calendarCurrentMonth = 11;
                calendarCurrentYear--;
            }
            renderCalendar();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            calendarCurrentMonth++;
            if (calendarCurrentMonth > 11) {
                calendarCurrentMonth = 0;
                calendarCurrentYear++;
            }
            renderCalendar();
        });
    }

    // Fechar painéis de config e dropdown ao clicar fora
    document.addEventListener('click', (e) => {
        document.querySelectorAll('.chart-config-panel').forEach(p => {
            p.style.display = 'none';
        });
        
        const wrapper = document.querySelector('.date-controls-trigger-wrapper');
        if (dropdown && wrapper && !wrapper.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
}

function formatDateIso(d) {
    if (!d) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function renderCalendar() {
    const monthYearEl = document.getElementById('calendar-month-year');
    const container = document.getElementById('calendar-days-container');
    if (!monthYearEl || !container) return;

    const nomesMeses = [
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    ];
    monthYearEl.textContent = `${nomesMeses[calendarCurrentMonth]} ${calendarCurrentYear}`;
    container.innerHTML = '';

    const firstDay = new Date(calendarCurrentYear, calendarCurrentMonth, 1).getDay();
    const daysInMonth = new Date(calendarCurrentYear, calendarCurrentMonth + 1, 0).getDate();

    // Dias vazios
    for (let i = 0; i < firstDay; i++) {
        const emptyCell = document.createElement('div');
        emptyCell.className = 'calendar-day empty';
        container.appendChild(emptyCell);
    }

    // Dias reais
    for (let day = 1; day <= daysInMonth; day++) {
        const dayCell = document.createElement('div');
        dayCell.className = 'calendar-day';
        dayCell.textContent = day;

        const cellDate = new Date(calendarCurrentYear, calendarCurrentMonth, day);
        const cellDateIso = formatDateIso(cellDate);

        if (state.consumptionDates && state.consumptionDates.has(cellDateIso)) {
            dayCell.classList.add('has-consumption');
        }

        const normCell = normalizeDate(cellDate);
        const normStart = state.dateRange.start ? normalizeDate(state.dateRange.start) : null;
        const normEnd = state.dateRange.end ? normalizeDate(state.dateRange.end) : null;

        if (normStart && normCell.getTime() === normStart.getTime()) {
            dayCell.classList.add('selected-start');
        }
        if (normEnd && normCell.getTime() === normEnd.getTime()) {
            dayCell.classList.add('selected-end');
        }
        if (normStart && normEnd && normCell > normStart && normCell < normEnd) {
            dayCell.classList.add('in-range');
        }

        dayCell.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCalendarDayClick(cellDate);
        });

        container.appendChild(dayCell);
    }
}

function handleCalendarDayClick(date) {
    if (!state.dateRange.start || (state.dateRange.start && state.dateRange.end)) {
        state.dateRange.start = date;
        state.dateRange.end = null;
        document.getElementById('date-start').value = formatDateIso(date);
        document.getElementById('date-end').value = '';
    } else {
        if (date >= state.dateRange.start) {
            state.dateRange.end = date;
            document.getElementById('date-end').value = formatDateIso(date);
        } else {
            state.dateRange.start = date;
            document.getElementById('date-start').value = formatDateIso(date);
        }
    }
    
    // Resetar botões de preset ativo
    document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
    
    renderCalendar();
    
    if (state.dateRange.start && state.dateRange.end) {
        updateDashboard();
        const drop = document.getElementById('calendar-dropdown');
        if (drop) drop.style.display = 'none';
    }
}

function updateCalendarTriggerText() {
    const textEl = document.getElementById('calendar-trigger-text');
    if (!textEl) return;

    if (!state.dateRange.start || !state.dateRange.end) {
        textEl.textContent = 'Todo o Período';
        return;
    }

    const fmt = (d) => {
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    };

    const startStr = fmt(state.dateRange.start);
    const endStr = fmt(state.dateRange.end);

    const isFullRange = state.fullDateRange.start && state.fullDateRange.end &&
                        normalizeDate(state.dateRange.start).getTime() === normalizeDate(state.fullDateRange.start).getTime() &&
                        normalizeDate(state.dateRange.end).getTime() === normalizeDate(state.fullDateRange.end).getTime();

    if (isFullRange) {
        textEl.textContent = 'Todo o Período';
    } else if (startStr === endStr) {
        textEl.textContent = startStr;
    } else {
        textEl.textContent = `${startStr} - ${endStr}`;
    }
}

// ==========================================
// 18. CUSTOMIZAÇÃO DOS GRÁFICOS (OPÇÕES)
// ==========================================

window.toggleChartConfig = function(btn) {
    event.stopPropagation();
    const card = btn.closest('.chart-card');
    const panel = card.querySelector('.chart-config-panel');
    
    document.querySelectorAll('.chart-config-panel').forEach(p => {
        if (p !== panel) p.style.display = 'none';
    });

    if (panel.style.display === 'none') {
        panel.style.display = 'flex';
        syncConfigPanelInputs(card);
    } else {
        panel.style.display = 'none';
    }
};

function syncConfigPanelInputs(card) {
    const chartId = card.querySelector('[id^="chart-"]').id;
    const prefs = getChartPrefs(chartId);

    const select = card.querySelector('.select-chart-type');
    const chkLabels = card.querySelector('.chk-data-labels');
    const chkLegend = card.querySelector('.chk-legend');

    if (select) select.value = prefs.type || select.options[0].value;
    if (chkLabels) chkLabels.checked = prefs.dataLabels !== undefined ? prefs.dataLabels : true;
    if (chkLegend) chkLegend.checked = prefs.legend !== undefined ? prefs.legend : (chartId.includes('donut') || chartId.includes('combustivel'));
}

window.changeChartType = function(select) {
    const card = select.closest('.chart-card');
    const chartId = card.querySelector('[id^="chart-"]').id;
    const type = select.value;
    updateChartPreference(chartId, { type });
};

window.toggleChartLabels = function(chk) {
    const card = chk.closest('.chart-card');
    const chartId = card.querySelector('[id^="chart-"]').id;
    const dataLabels = chk.checked;
    updateChartPreference(chartId, { dataLabels });
};

window.toggleChartLegend = function(chk) {
    const card = chk.closest('.chart-card');
    const chartId = card.querySelector('[id^="chart-"]').id;
    const legend = chk.checked;
    updateChartPreference(chartId, { legend });
};

function updateChartPreference(chartId, newPrefs) {
    const prefKey = `chart_pref_${chartId}`;
    let prefs = {};
    try {
        const saved = localStorage.getItem(prefKey);
        if (saved) prefs = JSON.parse(saved);
    } catch (e) {}

    prefs = { ...prefs, ...newPrefs };
    localStorage.setItem(prefKey, JSON.stringify(prefs));

    if (chartId.includes('combustivel-donut')) renderCombustivelDonut();
    else if (chartId.includes('zona-donut')) renderZonaDonut();
    else if (chartId.includes('gasto-mensal')) renderBarChart();
    else if (chartId.includes('volume-mensal')) renderAreaChart();
}

function updatePrintTimestamps() {
    const now = new Date();
    const dia = String(now.getDate()).padStart(2, '0');
    const mes = String(now.getMonth() + 1).padStart(2, '0');
    const ano = now.getFullYear();
    const hora = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ts = `${dia}/${mes}/${ano} ${hora}:${min}`;

    const infoTs = document.getElementById('info-generation-timestamp');
    if (infoTs) infoTs.textContent = ts;

    document.querySelectorAll('.print-generation-timestamp').forEach(el => {
        el.textContent = ts;
    });
}

// ==========================================
// 19. SISTEMA DE LICENÇA E VALIDAÇÃO GITHUB
// ==========================================
// URL do repositório/gist do GitHub contendo a lista de chaves de acesso válidas em JSON.
// Altere para a URL Raw do seu repositório público ou GitHub Gist.
const GITHUB_KEYS_URL = 'https://raw.githubusercontent.com/Mariozinhocs/Controle/master/keys.json';
const LOCAL_KEYS_FALLBACK = './keys.json';


const CURRENT_APP_VERSION = '1.0.0';
const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/Mariozinhocs/Controle/master/version.json';
const LOCAL_VERSION_FALLBACK = './version.json';

function initLicenseValidation() {
    const overlay = document.getElementById('license-overlay');
    const form = document.getElementById('license-form');
    const input = document.getElementById('license-key-input');
    const statusMsg = document.getElementById('license-status-msg');
    const btnSubmit = document.getElementById('btn-validate-license');

    if (!overlay || !form || !input) return;

    // Se já existe uma chave salva no localStorage (evita pedir senha no F5 e reaberturas), prossegue
    const savedKey = localStorage.getItem('controle_license_key');
    if (savedKey) {
        overlay.style.display = 'none';
        triggerSplashScreenAndLoadData();
        checkSystemUpdates();
        return;
    }

    // Login Obrigatório a Cada Inicialização: A caixa de texto fica TOTALMENTE LIMPA
    input.value = '';
    overlay.style.display = 'flex';

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const enteredKey = input.value.trim().toUpperCase();
        if (!enteredKey) {
            showLicenseStatus('Por favor, informe a chave de acesso.', 'error');
            return;
        }

        btnSubmit.disabled = true;
        showLicenseStatus('Conectando ao GitHub para validar chave...', 'info');

        try {
            const isValid = await checkKeyOnGithub(enteredKey);
            if (isValid) {
                localStorage.setItem('controle_license_key', enteredKey);
                localStorage.setItem('controle_license_validated_at', new Date().toISOString());
                sessionStorage.setItem('controle_license_session_validated', 'true');
                showLicenseStatus('Chave autenticada com sucesso!', 'success');
                
                setTimeout(() => {
                    overlay.style.display = 'none';
                    btnSubmit.disabled = false;
                    
                    // Exibir o Splash Screen para carregar a planilha após a senha
                    triggerSplashScreenAndLoadData();

                    // Checar se há atualizações do sistema no GitHub
                    checkSystemUpdates();
                }, 400);
            } else {
                showLicenseStatus('Chave de acesso inválida, inativa ou não encontrada no GitHub.', 'error');
                btnSubmit.disabled = false;
            }
        } catch (err) {
            console.error('Erro na validação da licença:', err);
            showLicenseStatus('Falha de conexão com o GitHub. Verifique sua rede.', 'error');
            btnSubmit.disabled = false;
        }
    });

    function showLicenseStatus(msg, type) {
        if (!statusMsg) return;
        statusMsg.textContent = msg;
        statusMsg.className = `license-status-msg ${type}`;
    }
}


async function checkSystemUpdates() {
    let versionData = null;

    try {
        const response = await fetch(GITHUB_VERSION_URL, { cache: 'no-cache' });
        if (response.ok) {
            versionData = await response.json();
        }
    } catch (e) {
        console.warn('Não foi possível verificar versão no GitHub. Tentando versão local...', e);
    }

    if (!versionData) {
        try {
            const resLocal = await fetch(LOCAL_VERSION_FALLBACK, { cache: 'no-cache' });
            if (resLocal.ok) versionData = await resLocal.json();
        } catch (e) {}
    }

    if (!versionData || !versionData.version) return;

    const remoteVer = versionData.version;
    if (isNewerVersion(remoteVer, CURRENT_APP_VERSION)) {
        showUpdateModal(versionData);
    }
}

function isNewerVersion(remote, current) {
    const rParts = remote.split('.').map(Number);
    const cParts = current.split('.').map(Number);
    for (let i = 0; i < Math.max(rParts.length, cParts.length); i++) {
        const r = rParts[i] || 0;
        const c = cParts[i] || 0;
        if (r > c) return true;
        if (r < c) return false;
    }
    return false;
}

function showUpdateModal(verData) {
    const updateModal = document.getElementById('update-modal');
    const versionLabel = document.getElementById('update-version-label');
    const notesBox = document.getElementById('update-notes-box');
    const btnAccept = document.getElementById('btn-accept-update');
    const btnIgnore = document.getElementById('btn-ignore-update');

    if (!updateModal) return;

    if (versionLabel) versionLabel.textContent = `Nova versão v${verData.version} disponível no GitHub (Sua versão: v${CURRENT_APP_VERSION}).`;
    if (notesBox) notesBox.innerHTML = `<strong>Notas da Versão:</strong><br>${verData.notes || 'Melhorias de desempenho e correções de segurança.'}`;

    updateModal.style.display = 'flex';

    if (btnIgnore) {
        btnIgnore.onclick = () => {
            updateModal.style.display = 'none';
        };
    }

    if (btnAccept) {
        btnAccept.onclick = () => {
            if (verData.download_url) {
                window.open(verData.download_url, '_blank');
            } else {
                alert('Acesse o repositório do GitHub para baixar o instalador atualizado.');
            }
            updateModal.style.display = 'none';
        };
    }
}


async function checkKeyOnGithub(targetKey) {
    let keysData = null;

    // Normalizador de chave: remove hífens, espaços e caracteres especiais para comparação insensível a formato
    const cleanKey = (str) => (str || '').toString().replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const targetClean = cleanKey(targetKey);

    if (!targetClean) return false;

    // 1. Tentar buscar da URL online do GitHub
    try {
        const response = await fetch(GITHUB_KEYS_URL, { cache: 'no-cache' });
        if (response.ok) {
            keysData = await response.json();
        }
    } catch (e) {
        console.warn('Não foi possível acessar a URL principal do GitHub. Tentando fallback local...', e);
    }

    // 2. Se falhar, tentar buscar do arquivo local keys.json de contingência
    if (!keysData) {
        try {
            const responseLocal = await fetch(LOCAL_KEYS_FALLBACK, { cache: 'no-cache' });
            if (responseLocal.ok) {
                keysData = await responseLocal.json();
            }
        } catch (e) {
            console.warn('Fallback local keys.json também não encontrado.', e);
        }
    }

    if (!keysData) return false;

    // Tratar se keysData é um Array de strings ou Array de Objetos
    if (Array.isArray(keysData)) {
        return keysData.some(item => {
            if (typeof item === 'string') {
                return cleanKey(item) === targetClean;
            } else if (typeof item === 'object' && item !== null) {
                const itemKeyClean = cleanKey(item.key || item.chave);
                const isActive = item.active !== false && item.ativo !== false;
                return itemKeyClean === targetClean && isActive;
            }
            return false;
        });
    }

    return false;
}


// ==========================================
// 20. SISTEMA DE SIDEBAR RETRÁTIL (ÍCONE)
// ==========================================
function initSidebarToggle() {
    const btnToggle = document.getElementById('btn-toggle-sidebar');
    const container = document.getElementById('app-container');

    if (!btnToggle || !container) return;

    // Restaurar estado salvo no localStorage
    const savedState = localStorage.getItem('controle_sidebar_collapsed');
    if (savedState === 'true') {
        container.classList.add('sidebar-collapsed');
    }

    btnToggle.addEventListener('click', () => {
        container.classList.toggle('sidebar-collapsed');
        const isCollapsed = container.classList.contains('sidebar-collapsed');
        localStorage.setItem('controle_sidebar_collapsed', isCollapsed ? 'true' : 'false');

        // Disparar evento de resize da janela para redimensionar os gráficos ApexCharts automaticamente
        setTimeout(() => {
            window.dispatchEvent(new Event('resize'));
        }, 300);
    });
}

// ==========================================
// 21. SISTEMA DE PAINEL EM TELA CHEIA (FULLSCREEN)
// ==========================================
function initFullscreenToggle() {
    const btnFullscreen = document.getElementById('btn-fullscreen');
    const iconSvg = document.getElementById('icon-fullscreen');
    const labelSpan = document.querySelector('.btn-fullscreen-label');

    if (!btnFullscreen) return;

    btnFullscreen.addEventListener('click', () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.error(`Erro ao ativar tela cheia: ${err.message}`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    });

    document.addEventListener('fullscreenchange', () => {
        const isFS = !!document.fullscreenElement;
        if (labelSpan) {
            labelSpan.textContent = isFS ? 'Sair Tela Cheia' : 'Tela Cheia';
        }
        if (iconSvg) {
            iconSvg.innerHTML = isFS ?
                `<path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>` :
                `<path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>`;
        }
    });
}

// ==========================================
// 22. SISTEMA DE SPLASH SCREEN
// ==========================================
function triggerSplashScreenAndLoadData() {
    const splash = document.getElementById('splash-screen');
    const fill = document.getElementById('splash-progress-fill');
    const statusText = document.getElementById('splash-status-text');

    if (!splash || !fill) {
        loadInitialData();
        return;
    }

    splash.classList.remove('fade-out');
    fill.style.width = '0%';
    if (statusText) statusText.textContent = 'Autenticação Confirmada!...';

    // Etapas da animação de carregamento do Splash Screen após validação de senha
    setTimeout(() => {
        fill.style.width = '45%';
        if (statusText) statusText.textContent = 'Carregando Módulos e Gráficos...';
    }, 200);

    setTimeout(() => {
        fill.style.width = '85%';
        if (statusText) statusText.textContent = 'Carregando Planilha de Dados...';
        loadInitialData();
    }, 500);

    setTimeout(() => {
        fill.style.width = '100%';
        if (statusText) statusText.textContent = 'Inicialização Concluída!';
    }, 950);

    setTimeout(() => {
        splash.classList.add('fade-out');
    }, 1300);
}

// ==========================================
// 23. INTEGRAÇÃO COM SUBSISTEMA DE CONTRATADOS
// ==========================================
function fetchContratadosForAutocomplete() {
    const isFileProtocol = window.location.protocol === 'file:';
    if (isFileProtocol) return;

    fetch(`./veiculos/api/get_veiculos.php?env=${encodeURIComponent(state.activeEnv)}`)
        .then(res => res.json())
        .then(result => {
            if (result.success && result.veiculos) {
                state.veiculosContratados = result.veiculos;
                updateContratadosMappings();
            }
        })
        .catch(err => {
            console.warn('Não foi possível obter veículos contratados para autocomplete:', err);
        });
}

function updateContratadosMappings() {
    if (!state.veiculosContratados) return;

    if (!state.mappings.contratados) {
        state.mappings.contratados = {};
    }

    state.veiculosContratados.forEach(v => {
        const placaUpper = v.placa.toUpperCase().trim();
        // Adicionar ao mapeamento de placas para veículos
        state.mappings.placaToVeiculo[placaUpper] = v.tipo_veiculo;
        
        // Mapear dados detalhados para preenchimento automático
        state.mappings.contratados[placaUpper] = {
            veiculo: v.tipo_veiculo,
            combustivel: v.combustivel,
            motorista: v.motorista,
            base: v.local_atuacao
        };
    });

    // Re-popular datalists de placa e veículo para incluir os veículos contratados
    const placasSet = new Set(Object.keys(state.mappings.placaToVeiculo));
    populateDatalist('datalist-placas', Array.from(placasSet));

    const veiculosSet = new Set(Object.values(state.mappings.placaToVeiculo));
    populateDatalist('datalist-veiculos', Array.from(veiculosSet));
}

// Auxiliar para validar unicidade da faixa de requisições
function isRequisitionRangeUsed(rawInicioSeq, rawFimSeq) {
    if (!rawInicioSeq) return null;
    const startObj = parseSeqString(rawInicioSeq);
    const endObj = parseSeqString(rawFimSeq || rawInicioSeq);

    if (isNaN(startObj.num)) return null;

    const startNum = startObj.num;
    const endNum = isNaN(endObj.num) ? startNum : endObj.num;

    for (const r of state.rawData) {
        if (!r.inicioSeq) continue;

        const rStartObj = parseSeqString(r.inicioSeq);
        const rFimSeq = r.fimSeq || r.inicioSeq;
        const rEndObj = parseSeqString(rFimSeq);

        if (isNaN(rStartObj.num)) continue;

        const rStart = rStartObj.num;
        const rEnd = isNaN(rEndObj.num) ? rStart : rEndObj.num;

        // Se os prefixos forem diferentes, não há conflito!
        if (startObj.prefix !== rStartObj.prefix) {
            continue;
        }

        // Verificar se há interseção
        for (let num = startNum; num <= endNum; num++) {
            if (num >= rStart && num <= rEnd) {
                if (startObj.prefix) {
                    const match = rawInicioSeq.toString().trim().match(/^(.*)-(\d+)$/);
                    const padLength = match ? match[2].length : 3;
                    return `${startObj.prefix}-${num.toString().padStart(padLength, '0')}`;
                } else {
                    return num;
                }
            }
        }
    }
    return null;
}

