/* 
  Desenvolvido por Mario Henrique (mariozinhocs@gmail.com)
  "si vis pacem para bellum"
*/
// ESTADO DA APLICAÇÃO
const state = {
    rawData: [],      // Dados originais limpos
    filteredData: [], // Dados filtrados ativos
    filename: 'Nenhum arquivo carregado',
    filters: {
        zonas: new Set(),
        postos: new Set(),
        combustiveis: new Set()
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
    mappings: {
        baseToResponsavel: {},
        responsavelToBase: {},
        placaToVeiculo: {},
        veiculoToPlacas: {}
    }
};

// FUNÇÃO AUXILIAR PARA DIVIDIR STRINGS DE RELACIONAMENTO TRATANDO ESPAÇAMENTOS AO REDOR DO HÍFEN
function splitByRelationalHyphen(str) {
    if (!str) return [];
    // Divide por hífen que possua ao menos um espaço de um dos lados (para não quebrar Centro-Sul ou placas ABC-1234)
    const parts = str.toString().split(/\s+-\s*|\s*-\s+/);
    return parts.map(p => p.trim());
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
            if (row.zona && row.zona !== 'Não Informado') knownBases.add(row.zona.toLowerCase().trim());
            if (row.responsavel && row.responsavel !== 'Não Informado') knownResps.add(row.responsavel.toLowerCase().trim());
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
}

// CONFIGURAÇÃO DOS GRÁFICOS (Tema Escuro e Cores)
const chartTheme = {
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    foreColor: '#94a3b8',
    gridColor: 'rgba(255, 255, 255, 0.05)'
};

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
    initEventListeners();
    checkUrlParams();
    buildFilterButtons(); // Carrega os botões de filtros imediatamente
    initDragAndDrop();    // Inicializa o drag & drop de KPIs e Gráficos
    initCalendarWidget(); // Inicializa o calendário
    loadInitialData();
});

// 1. EVENT LISTENERS
function initEventListeners() {
    // Modal Upload
    const modal = document.getElementById('upload-modal');
    const btnOpenUpload = document.getElementById('btn-open-upload');
    const btnCloseUpload = document.getElementById('btn-close-upload');

    btnOpenUpload.addEventListener('click', () => modal.classList.add('active'));
    btnCloseUpload.addEventListener('click', () => modal.classList.remove('active'));

    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.classList.remove('active');
    });

    // Drag & Drop
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');

    dropZone.addEventListener('click', (e) => {
        if (e.target !== fileInput && !e.target.closest('label')) {
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

    fileInput.addEventListener('change', (e) => {
        const files = e.target.files;
        if (files.length > 0) {
            handleUploadedFile(files[0]);
        }
    });

    // Gerar Planilha de Teste
    document.getElementById('btn-generate-mock').addEventListener('click', () => {
        generateAndDownloadMockData();
    });

    // Filtros de Data
    document.getElementById('date-start').addEventListener('change', (e) => {
        state.dateRange.start = parseInputDate(e.target.value);
        setActivePreset(null);
        updateDashboard();
    });

    document.getElementById('date-end').addEventListener('change', (e) => {
        state.dateRange.end = parseInputDate(e.target.value);
        setActivePreset(null);
        updateDashboard();
    });

    // Presets de Data
    document.getElementById('preset-all').addEventListener('click', () => {
        state.dateRange.start = new Date(state.fullDateRange.start);
        state.dateRange.end = new Date(state.fullDateRange.end);
        document.getElementById('date-start').value = formatDateIso(state.dateRange.start);
        document.getElementById('date-end').value = formatDateIso(state.dateRange.end);
        setActivePreset('all');
        updateDashboard();
        const drop = document.getElementById('calendar-dropdown');
        if (drop) drop.style.display = 'none';
    });

    document.getElementById('preset-today').addEventListener('click', () => {
        const today = new Date();
        state.dateRange.start = today;
        state.dateRange.end = today;
        document.getElementById('date-start').value = formatDateIso(today);
        document.getElementById('date-end').value = formatDateIso(today);
        setActivePreset('today');
        updateDashboard();
        const drop = document.getElementById('calendar-dropdown');
        if (drop) drop.style.display = 'none';
    });

    document.getElementById('preset-7d').addEventListener('click', () => {
        applyPresetRange(7);
        setActivePreset('7d');
        const drop = document.getElementById('calendar-dropdown');
        if (drop) drop.style.display = 'none';
    });

    document.getElementById('preset-30d').addEventListener('click', () => {
        applyPresetRange(30);
        setActivePreset('30d');
        const drop = document.getElementById('calendar-dropdown');
        if (drop) drop.style.display = 'none';
    });

    // Abas da Tabela de Busca
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeTab = btn.dataset.tab;
            renderTable();
        });
    });

    // Input de Busca
    document.getElementById('table-search').addEventListener('input', (e) => {
        state.searchText = e.target.value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
        renderTable();
    });

    // Botão Recarregar do Cabeçalho
    document.getElementById('btn-refresh').addEventListener('click', () => {
        loadInitialData(true);
    });

    // Botão de Imprimir/PDF
    document.getElementById('btn-print').addEventListener('click', () => {
        if (typeof updatePrintTimestamps === 'function') {
            updatePrintTimestamps();
        }
        window.print();
    });

    // Assistente NLQ
    document.getElementById('btn-nlq-apply').addEventListener('click', () => {
        applyNlqQuery();
    });

    document.getElementById('nlq-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            applyNlqQuery();
        }
    });

    // Botão Limpar Filtros da Tabela
    document.getElementById('btn-clear-table-filters').addEventListener('click', () => {
        state.filters.zonas.clear();
        state.filters.postos.clear();
        state.filters.combustiveis.clear();

        state.dateRange.start = new Date(state.fullDateRange.start);
        state.dateRange.end = new Date(state.fullDateRange.end);
        document.getElementById('date-start').value = formatDateIso(state.dateRange.start);
        document.getElementById('date-end').value = formatDateIso(state.dateRange.end);
        setActivePreset('all');

        state.searchText = '';
        document.getElementById('table-search').value = '';

        document.getElementById('nlq-input').value = '';
        document.getElementById('nlq-feedback').textContent = "Filtros limpos com sucesso.";
        document.getElementById('nlq-feedback').style.color = 'var(--text-secondary)';

        buildFilterButtons();
        updateDashboard();
    });

    // Abrir modal de Nova Requisição
    document.getElementById('btn-open-add-requisicao').addEventListener('click', () => {
        const today = new Date();
        document.getElementById('input-date').value = formatDateIso(today);
        document.getElementById('add-requisicao-modal').classList.add('active');
    });

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
        });
    }

    if (inputVeiculo) {
        inputVeiculo.addEventListener('input', function() {
            const val = this.value.trim();
            updatePlacaDatalistOptions(val);
        });
        inputVeiculo.addEventListener('blur', function() {
            if (!this.value.trim()) {
                updatePlacaDatalistOptions('');
            }
        });
    }

    // Submissão do Formulário de Nova Requisição
    document.getElementById('form-add-requisicao').addEventListener('submit', (e) => {
        e.preventDefault();

        const dateVal = parseInputDate(document.getElementById('input-date').value);
        const zona = document.getElementById('input-zona').value;
        const responsavel = document.getElementById('input-responsavel').value;
        const posto = document.getElementById('input-posto').value;
        const motorista = document.getElementById('input-motorista').value;
        const veiculo = document.getElementById('input-veiculo').value.trim();
        const placa = document.getElementById('input-placa').value.trim().toUpperCase();
        const combustivel = document.getElementById('input-combustivel').value;

        const inicioSeq = document.getElementById('input-inicio-seq').value.trim();
        const fimSeq = document.getElementById('input-fim-seq').value.trim();

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
            zona: zona,
            responsavel: responsavel,
            posto: posto || 'Não Informado',
            motorista: motorista || 'Não Informado',
            veiculo: veiculo,
            placa: placa,
            combustivel: combustivel,
            litros: litros,
            precoLitro: precoLitro,
            valor: valor
        };

        state.rawData.push(newRecord);
        localStorage.setItem('combustivel_dashboard_data', JSON.stringify(state.rawData));

        document.getElementById('add-requisicao-modal').classList.remove('active');
        document.getElementById('form-add-requisicao').reset();
        
        // Resetar para modo litros padrão
        document.querySelector('input[name="input-modo-abastecimento"][value="litros"]').checked = true;
        document.getElementById('group-litros').style.display = 'flex';
        document.getElementById('group-valor-total').style.display = 'none';

        // Atualizar range de datas para contemplar a nova requisição
        initDateFilterRange();

        buildFilterButtons();
        updateDashboard();
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
    const cadastrosModal = document.getElementById('cadastros-modal');
    const btnOpenCadastros = document.getElementById('btn-open-cadastros');
    const btnCloseCadastros = document.getElementById('btn-close-cadastros');
    const btnCancelCadastros = document.getElementById('btn-cancel-cadastros');
    const formCadastros = document.getElementById('form-cadastros');

    if (btnOpenCadastros) {
        btnOpenCadastros.addEventListener('click', () => {
            // Resetar para a primeira aba por padrão
            const firstTab = document.querySelector('.cadastro-tab-btn');
            if (firstTab) firstTab.click();

            document.getElementById('textarea-custom-bases').value = state.customBases.join('\n');
            document.getElementById('textarea-custom-postos').value = state.customPostos.join('\n');
            document.getElementById('textarea-custom-motoristas').value = state.customMotoristas.join('\n');
            document.getElementById('textarea-custom-veiculos').value = state.customVeiculos.join('\n');
            cadastrosModal.classList.add('active');
        });
    }

    if (btnCloseCadastros) btnCloseCadastros.addEventListener('click', () => cadastrosModal.classList.remove('active'));
    if (btnCancelCadastros) btnCancelCadastros.addEventListener('click', () => cadastrosModal.classList.remove('active'));

    cadastrosModal.addEventListener('click', (e) => {
        if (e.target === cadastrosModal) cadastrosModal.classList.remove('active');
    });

    if (formCadastros) {
        formCadastros.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const basesText = document.getElementById('textarea-custom-bases').value;
            const postosText = document.getElementById('textarea-custom-postos').value;
            const motoristasText = document.getElementById('textarea-custom-motoristas').value;
            const veiculosText = document.getElementById('textarea-custom-veiculos').value;
            
            state.customBases = basesText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customPostos = postosText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customMotoristas = motoristasText.split('\n').map(s => s.trim()).filter(Boolean);
            state.customVeiculos = veiculosText.split('\n').map(s => s.trim()).filter(Boolean);
            
            localStorage.setItem('custom_bases', JSON.stringify(state.customBases));
            localStorage.setItem('custom_postos', JSON.stringify(state.customPostos));
            localStorage.setItem('custom_motoristas', JSON.stringify(state.customMotoristas));
            localStorage.setItem('custom_veiculos', JSON.stringify(state.customVeiculos));
            
            // Atualizar mapeamentos relacionais
            updateRelationsMappings();
            
            cadastrosModal.classList.remove('active');
            
            buildFilterButtons();
            updateDashboard();
        });
    }

    // Modo de Abastecimento (Litros ou Valor) no Formulário
    document.querySelectorAll('input[name="input-modo-abastecimento"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            const mode = e.target.value;
            const groupLitros = document.getElementById('group-litros');
            const groupValor = document.getElementById('group-valor-total');
            
            if (mode === 'litros') {
                groupLitros.style.display = 'flex';
                groupValor.style.display = 'none';
                document.getElementById('input-valor-total').value = '';
            } else {
                groupLitros.style.display = 'none';
                groupValor.style.display = 'flex';
                document.getElementById('input-litros').value = '';
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
    try {
        state.customBases = JSON.parse(localStorage.getItem('custom_bases') || '[]');
        state.customPostos = JSON.parse(localStorage.getItem('custom_postos') || '[]');
        state.customMotoristas = JSON.parse(localStorage.getItem('custom_motoristas') || '[]');
        state.customVeiculos = JSON.parse(localStorage.getItem('custom_veiculos') || '[]');
        updateRelationsMappings();
    } catch (e) {}

    const savedData = localStorage.getItem('combustivel_dashboard_data');
    const savedFilename = localStorage.getItem('combustivel_dashboard_filename');

    // Se não for carregamento forçado e tivermos dados no cache local, prioriza o cache
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

    fetch(`./dados.xlsx${suffix}`)
        .then(response => {
            if (!response.ok) throw new Error('dados.xlsx não encontrado');
            return response.arrayBuffer();
        })
        .then(buffer => {
            state.filename = 'dados.xlsx';
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
                    if (forceFetch && !savedData) {
                        alert('Não foi possível ler dados.xlsx ou dados.csv na pasta local do projeto. Certifique-se de que o arquivo existe nessa pasta.');
                    }

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
                        hideLoading();
                        document.getElementById('upload-modal').classList.add('active');
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
    localStorage.setItem('combustivel_dashboard_filename', file.name);
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
            let parsedDate = new Date(row.date);
            if (isNaN(parsedDate.getTime()) && row.date) {
                parsedDate = parseExcelDate(row.date);
            }

            let zona = row.zona || 'Não Informado';
            let responsavel = row.responsavel || 'Não Informado';
            let veiculo = row.veiculo || 'Não Informado';
            let placa = row.placa || '';

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
                ...row,
                id: row.id || (Date.now() + '-' + Math.random() + '-' + idx),
                date: isNaN(parsedDate.getTime()) ? new Date() : parsedDate,
                zona: zona,
                responsavel: responsavel,
                veiculo: veiculo,
                placa: placaUpper
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

        let zona = cleanedRow['base'] || cleanedRow['bases'] || cleanedRow['zona'] || cleanedRow['zonas de manaus'] || 'Não Informado';
        let responsavel = cleanedRow['responsavel'] || 'Não Informado';
        let posto = cleanedRow['posto'] || cleanedRow['postos'] || 'Não Informado';
        let motorista = cleanedRow['motorista'] || cleanedRow['motoristas'] || 'Não Informado';
        let veiculo = cleanedRow['veiculo'] || 'Não Informado';
        let placa = cleanedRow['placa'] || '';

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

    state.rawData = processed;

    // Compilar conjunto de datas com consumo
    state.consumptionDates = new Set();
    state.rawData.forEach(row => {
        if (row.date && (row.litros > 0 || row.valor > 0)) {
            state.consumptionDates.add(formatDateIso(row.date));
        }
    });

    if (shouldCache) {
        localStorage.setItem('combustivel_dashboard_data', JSON.stringify(processed));
    }

    // Resetar Filtros
    state.filters.zonas.clear();
    state.filters.postos.clear();
    state.filters.combustiveis.clear();

    // Inicializa Filtro de Datas
    initDateFilterRange();

    buildFilterButtons();

    // Delay estético de processamento para suavizar transição
    setTimeout(() => {
        updateDashboard();
        hideLoading();
    }, 550);
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

    state.dateRange.start = new Date(minD);
    state.dateRange.end = new Date(maxD);

    const startInput = document.getElementById('date-start');
    const endInput = document.getElementById('date-end');

    startInput.min = formatDateIso(minD);
    startInput.max = formatDateIso(maxD);
    endInput.min = formatDateIso(minD);
    endInput.max = formatDateIso(maxD);

    startInput.value = formatDateIso(state.dateRange.start);
    endInput.value = formatDateIso(state.dateRange.end);

    setActivePreset('all');
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
    const combustiveisUnicos = new Set();

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

    // Auxiliar para preencher datalist
    function populateDatalist(id, list) {
        const dl = document.getElementById(id);
        if (dl) {
            dl.innerHTML = '';
            list.forEach(val => {
                const opt = document.createElement('option');
                opt.value = val;
                dl.appendChild(opt);
            });
        }
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
    populateDatalist('datalist-responsaveis', Array.from(new Set(respList)).sort());

    // 3. Popular Postos
    let postList = [];
    if (state.customPostos && state.customPostos.length > 0) {
        postList = state.customPostos.map(p => p ? p.toString().trim() : '').filter(Boolean);
    } else {
        const postSet = new Set();
        state.rawData.forEach(row => {
            if (row.posto && row.posto !== 'Não Informado') postSet.add(row.posto);
        });
        postList = Array.from(postSet);
    }
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
    populateDatalist('datalist-veiculos', Array.from(new Set(veicList)).sort());

    // 6. Popular Placas (inicialmente sem filtro de veículo)
    updatePlacaDatalistOptions('');

    // Popular o select de combustível do formulário de Nova Requisição (este se mantém select por facilidade)
    const selectComb = document.getElementById('input-combustivel');
    if (selectComb) {
        const currentVal = selectComb.value;
        selectComb.innerHTML = '<option value="">Selecione...</option>';
        sortedComb.forEach(comb => {
            const opt = document.createElement('option');
            opt.value = comb;
            opt.textContent = comb;
            selectComb.appendChild(opt);
        });
        selectComb.value = currentVal;
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
    } else {
        // Fallback para as placas presentes nos dados da planilha
        const placaSet = new Set();
        state.rawData.forEach(row => {
            if (row.placa && (selectedVeiculo === '' || row.veiculo.toLowerCase() === selectedVeiculo.toLowerCase())) {
                placaSet.add(row.placa.toUpperCase());
            }
        });
        placaList = Array.from(placaSet);
    }

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

// 10. ATUALIZAÇÃO DO PAINEL GERAL
function updateDashboard() {
    state.filteredData = state.rawData.filter(row => {
        const matchZona = state.filters.zonas.size === 0 || state.filters.zonas.has(row.zona);
        const matchPosto = state.filters.postos.size === 0 || state.filters.postos.has(row.posto);
        const matchComb = state.filters.combustiveis.size === 0 || state.filters.combustiveis.has(row.combustivel);

        const rowDate = normalizeDate(row.date);
        const matchStart = !state.dateRange.start || rowDate >= normalizeDate(state.dateRange.start);
        const matchEnd = !state.dateRange.end || rowDate <= normalizeDate(state.dateRange.end);

        return matchZona && matchPosto && matchComb && matchStart && matchEnd;
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

    document.querySelector('#kpi-gasto .kpi-value').textContent = totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.querySelector('#kpi-litros .kpi-value').textContent = Math.round(totalLitros).toLocaleString('pt-BR') + ' L';
    document.querySelector('#kpi-requisicoes .kpi-value').textContent = totalReq.toLocaleString('pt-BR');
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
                            color: '#ffffff',
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
        stroke: { show: true, width: 2, colors: ['#121824'] },
        legend: { show: showLegend, position: 'bottom', fontSize: '11px', markers: { radius: 4 } },
        tooltip: {
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
                colors: isHorizontal ? ['#fff'] : ['#94a3b8'],
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
            theme: 'dark',
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
            style: { fontSize: '10px', fontWeight: '600', colors: ['#94a3b8'] }
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
            y: { formatter: (val) => val.toLocaleString('pt-BR') + ' Litros' }
        }
    };

    if (state.charts.area) {
        state.charts.area.destroy();
    }
    state.charts.area = new ApexCharts(document.querySelector("#chart-volume-mensal"), options);
    state.charts.area.render();
}
// 12. SISTEMA DE TABELAS DINÂMICAS E RANKINGS DE BUSCA
function renderTable() {
    const table = document.getElementById('data-table');
    const thead = table.querySelector('thead');
    const tbody = document.getElementById('table-body');

    thead.innerHTML = '';
    tbody.innerHTML = '';

    const search = state.searchText;

    if (state.activeTab === 'lancamentos') {
        thead.innerHTML = `
            <tr>
                <th>Data</th>
                <th>Início Seq</th>
                <th>Fim Seq</th>
                <th class="col-number">Qtd Req</th>
                <th>Base</th>
                <th>Responsável</th>
                <th>Motorista</th>
                <th>Posto</th>
                <th>Veículo</th>
                <th>Combustível</th>
                <th class="col-number">L/Req</th>
                <th class="col-number">Total Litros</th>
                <th class="col-number">Total Gasto</th>
                <th class="th-actions">Ações</th>
            </tr>
        `;

        const filtered = state.filteredData.filter(row => {
            if (!search) return true;
            return row.responsavel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search) ||
                (row.motorista && row.motorista.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search)) ||
                row.veiculo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search) ||
                row.placa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search) ||
                row.zona.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search) ||
                (row.posto && row.posto.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search)) ||
                row.combustivel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search);
        });

        filtered.sort((a, b) => b.date - a.date);

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="14" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum lançamento encontrado para a pesquisa.</td></tr>`;
            return;
        }

        filtered.forEach(row => {
            const tr = document.createElement('tr');
            const dia = String(row.date.getDate()).padStart(2, '0');
            const mes = String(row.date.getMonth() + 1).padStart(2, '0');
            const dataFmt = `${dia}/${mes}/${row.date.getFullYear()}`;
            const totalLitros = row.litros * row.qtdRequisicoes;

            tr.innerHTML = `
                <td>${dataFmt}</td>
                <td>${row.inicioSeq}</td>
                <td>${row.fimSeq}</td>
                <td class="col-number">${row.qtdRequisicoes}</td>
                <td>${row.zona}</td>
                <td><span class="text-highlight">${row.responsavel}</span></td>
                <td>${row.motorista || 'Não Informado'}</td>
                <td>${row.posto || 'Não Informado'}</td>
                <td>${row.veiculo} ${row.placa ? `(${row.placa})` : ''}</td>
                <td>${row.combustivel}</td>
                <td class="col-number">${row.litros} L</td>
                <td class="col-number">${Math.round(totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
                <td class="td-actions">
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
            tbody.appendChild(tr);
        });

    } else if (state.activeTab === 'responsaveis') {
        thead.innerHTML = `
            <tr>
                <th class="col-rank">Pos</th>
                <th>Motorista (Responsável)</th>
                <th class="col-number">Qtd Requisições</th>
                <th class="col-number">Total Consumido (Litros)</th>
                <th class="col-number">Total Gasto (BRL)</th>
            </tr>
        `;

        const agg = {};
        state.filteredData.forEach(row => {
            if (!agg[row.responsavel]) {
                agg[row.responsavel] = { responsavel: row.responsavel, totalGasto: 0, totalLitros: 0, totalReq: 0 };
            }
            agg[row.responsavel].totalGasto += row.valor;
            agg[row.responsavel].totalLitros += (row.litros * row.qtdRequisicoes);
            agg[row.responsavel].totalReq += row.qtdRequisicoes;
        });

        const sorted = Object.values(agg).sort((a, b) => b.totalGasto - a.totalGasto);

        const filtered = sorted.filter(row => {
            if (!search) return true;
            return row.responsavel.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search);
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum responsável encontrado para a pesquisa.</td></tr>`;
            return;
        }

        filtered.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const isTop = idx === 0 && !search;
            if (isTop) tr.style.backgroundColor = 'rgba(255, 183, 3, 0.04)';

            tr.innerHTML = `
                <td class="col-rank">${idx + 1}º</td>
                <td><span class="text-highlight" style="${isTop ? 'font-size: 1.05rem;' : ''}">${row.responsavel}</span> ${isTop ? '👑 <span class="file-badge" style="margin-left:8px; font-size: 10px;">MAIOR CONSUMO</span>' : ''}</td>
                <td class="col-number">${row.totalReq.toLocaleString('pt-BR')}</td>
                <td class="col-number">${Math.round(row.totalLitros).toLocaleString('pt-BR')} L</td>
                <td class="col-number text-highlight">${row.totalGasto.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
            `;
            tbody.appendChild(tr);
        });

    } else if (state.activeTab === 'veiculos') {
        thead.innerHTML = `
            <tr>
                <th class="col-rank">Pos</th>
                <th>Veículo</th>
                <th>Placas Associadas</th>
                <th class="col-number">Qtd Requisições</th>
                <th class="col-number">Total Consumido (Litros)</th>
                <th class="col-number">Total Gasto (BRL)</th>
            </tr>
        `;

        const agg = {};
        state.filteredData.forEach(row => {
            if (!agg[row.veiculo]) {
                agg[row.veiculo] = { veiculo: row.veiculo, totalGasto: 0, totalLitros: 0, totalReq: 0, placas: new Set() };
            }
            agg[row.veiculo].totalGasto += row.valor;
            agg[row.veiculo].totalLitros += (row.litros * row.qtdRequisicoes);
            agg[row.veiculo].totalReq += row.qtdRequisicoes;
            if (row.placa) agg[row.veiculo].placas.add(row.placa);
        });

        const sorted = Object.values(agg).sort((a, b) => b.totalGasto - a.totalGasto);

        const filtered = sorted.filter(row => {
            if (!search) return true;
            const matchVeiculo = row.veiculo.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search);
            const matchPlaca = Array.from(row.placas).some(p => p.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").includes(search));
            return matchVeiculo || matchPlaca;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum veículo encontrado para a pesquisa.</td></tr>`;
            return;
        }

        filtered.forEach((row, idx) => {
            const tr = document.createElement('tr');
            const isTop = idx === 0 && !search;
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
            tbody.appendChild(tr);
        });
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
        { nome: 'Chevrolet Onix', placa: 'JKL-7890', combustivel: 'Gasolina' }
    ];

    const PRECOS = {
        'Gasolina': 6.15,
        'Diesel': 5.89,
        'Etanol': 4.25
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
        alert('Planilha "dados.xlsx" com 45 dias de dados de teste gerada com sucesso! Importe-a no painel para testar os novos recursos.');
    } catch (e) {
        console.error(e);
        alert('Erro ao gerar planilha fictícia.');
    }
}

// EXCLUIR REGISTRO GLOBAL
window.deleteRecord = function (id) {
    if (confirm("Tem certeza de que deseja excluir esta requisição?")) {
        state.rawData = state.rawData.filter(row => row.id !== id);
        localStorage.setItem('combustivel_dashboard_data', JSON.stringify(state.rawData));
        updateDashboard();
    }
};

// EXPORTAR DADOS ATUALIZADOS PARA PLANILHA EXCEL (.XLSX)
function exportToExcel() {
    if (state.rawData.length === 0) {
        alert('Não há dados disponíveis para exportar.');
        return;
    }

    function padZero(num, size) {
        let s = num + "";
        while (s.length < size) s = "0" + s;
        return s;
    }

    const data = state.rawData.map(row => {
        const dia = padZero(row.date.getDate(), 2);
        const mes = padZero(row.date.getMonth() + 1, 2);
        const ano = row.date.getFullYear();
        const dataFmt = `${dia}/${mes}/${ano}`;

        const precoFormatado = row.precoLitro.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const valorFormatado = row.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        return {
            'Data': dataFmt,
            'Início da Sequência': row.inicioSeq,
            'Fim da Sequência': row.fimSeq,
            'Qtd Requisições': row.qtdRequisicoes,
            'Base': row.zona,
            'Responsável': row.responsavel,
            'Motorista': row.motorista || 'Não Informado',
            'Posto': row.posto || 'Não Informado',
            'Veículo': row.veiculo,
            'Placa': row.placa,
            'Tipo Combustível': row.combustivel,
            'Litros': row.litros,
            'Preço Litro': `R$ ${precoFormatado}`,
            'Valor': `R$ ${valorFormatado}`
        };
    });

    try {
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Controle");

        // Salvar preferências em uma aba extra "Configuracoes"
        const configData = [{
            kpi_order: localStorage.getItem('kpi_cards_order') || "",
            charts_order: localStorage.getItem('charts_grid_order') || "",
            chart_prefs: getChartPreferencesString(),
            custom_bases: JSON.stringify(state.customBases || []),
            custom_postos: JSON.stringify(state.customPostos || []),
            custom_motoristas: JSON.stringify(state.customMotoristas || []),
            custom_veiculos: JSON.stringify(state.customVeiculos || [])
        }];
        const wsConfig = XLSX.utils.json_to_sheet(configData);
        XLSX.utils.book_append_sheet(wb, wsConfig, "Configuracoes");

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

    // 6. Líderes
    let maiorVeiculo = '-';
    let maiorVeiculoVal = 0;
    for (const v in veiculosGasto) {
        if (veiculosGasto[v] > maiorVeiculoVal) {
            maiorVeiculoVal = veiculosGasto[v];
            maiorVeiculo = v;
        }
    }
    document.getElementById('info-leader-veiculo').textContent = maiorVeiculo;
    document.getElementById('info-leader-veiculo-val').textContent = maiorVeiculoVal > 0 ? maiorVeiculoVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';

    let maiorMotorista = '-';
    let maiorMotoristaVal = 0;
    for (const m in motoristasGasto) {
        if (motoristasGasto[m] > maiorMotoristaVal) {
            maiorMotoristaVal = motoristasGasto[m];
            maiorMotorista = m;
        }
    }
    document.getElementById('info-leader-motorista').textContent = maiorMotorista;
    document.getElementById('info-leader-motorista-val').textContent = maiorMotoristaVal > 0 ? maiorMotoristaVal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ 0,00';
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
