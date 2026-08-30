/**
 * DISPENSADOR VISUAL DE REQUISIÇÕES & CONSTRUTOR DE RELATÓRIOS (LAB)
 * Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
 * "si vis pacem para bellum"
 */

// ESTADO GLOBAL DO LABORATÓRIO
const labState = {
    activeView: 'dispensador',
    activeLote: 'LOTE 1',
    activeLitragem: 15,
    activeGrupo: null,
    selectedTickets: new Set(),
    isMultiSelect: false,
    deliveredSessionCount: 0,
    
    // Dados mestres reais extraídos do sistema
    pool: [],          // Requisições disponíveis em estoque
    lancamentos: [],   // Requisições já distribuídas
    bases: [],         // Lista de nomes limpos de bases
    responsaveis: [],  // Lista de responsáveis
    motoristas: [],    // Lista de motoristas
    mappings: {
        baseToResp: {},
        respToBase: {},
        baseToMotoristas: {}
    },
    
    // Configurações do Drawer
    drawerSelection: {
        tickets: [],
        base: '',
        responsavel: '',
        motorista: ''
    },

    // Configurações do Relatório Personalizado
    reportConfig: {
        groupBy: 'responsavel',
        filterLitro: 'TODOS',
        searchTerm: '',
        cols: {
            reqs: true,
            litros: true,
            valor: true,
            pct: true,
            media: false
        }
    }
};

// AUXILIAR: LIMPEZA DO NOME DA BASE (APENAS O NOME DA BASE)
function cleanBaseName(raw) {
    if (!raw) return '';
    let str = raw.toString().trim();
    // Se estiver no formato "Nome da Base - Responsável", extrai apenas a Base
    if (str.includes(' - ')) {
        str = str.split(' - ')[0].trim();
    }
    // Remove eventuais prefixos duplicados como "Base - "
    str = str.replace(/^Base\s*-\s*/i, '');
    return str.trim();
}

// INICIALIZAÇÃO
document.addEventListener('DOMContentLoaded', () => {
    initViewTabs();
    loadLabData();
    initDispensadorEvents();
    initReportEvents();
});

// 1. ALTERNAR ABAS DO LABORATÓRIO (DISPENSADOR vs RELATÓRIOS)
function initViewTabs() {
    const tabBtns = document.querySelectorAll('.view-tab-btn');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const targetView = btn.dataset.view;
            labState.activeView = targetView;

            document.getElementById('view-dispensador').style.display = targetView === 'dispensador' ? 'block' : 'none';
            document.getElementById('view-relatorios').style.display = targetView === 'relatorios' ? 'block' : 'none';

            if (targetView === 'relatorios') {
                renderCustomReport();
            }
        });
    });
}

// 2. CARREGAR DADOS DO SISTEMA (BASES, PESSOAS E POOL DE REQUISIÇÕES)
function loadLabData() {
    // 1. Tentar restaurar estado local
    try {
        const savedPool = localStorage.getItem('lab_dispensador_pool');
        const savedLancamentos = localStorage.getItem('lab_dispensador_lancamentos');
        const savedCount = localStorage.getItem('lab_session_counter');

        if (savedCount) labState.deliveredSessionCount = parseInt(savedCount, 10);
        updateSessionCounterUI();

        if (savedPool) labState.pool = JSON.parse(savedPool);
        if (savedLancamentos) labState.lancamentos = JSON.parse(savedLancamentos);
    } catch (e) {}

    // 2. Se a base estiver vazia, gera o pool simulado completo
    if (!labState.pool || labState.pool.length === 0) {
        generateInitialMockPool();
    }

    // 3. Carregar bases e pessoas do localStorage e API do sistema
    loadSystemEntities();
}

// Carrega as bases e pessoas reais do sistema
function loadSystemEntities() {
    const basesSet = new Set();
    const respSet = new Set();
    const motSet = new Set();

    // 1. Do localStorage do sistema
    try {
        const customBases = JSON.parse(localStorage.getItem('custom_bases') || '[]');
        customBases.forEach(line => {
            if (line.includes(' - ')) {
                const parts = line.split(' - ');
                const b = cleanBaseName(parts[0]);
                const r = parts[1].trim();
                if (b) {
                    basesSet.add(b);
                    if (r) {
                        respSet.add(r);
                        labState.mappings.baseToResp[b.toLowerCase()] = r;
                        labState.mappings.respToBase[r.toLowerCase()] = b;
                    }
                }
            } else {
                const b = cleanBaseName(line);
                if (b) basesSet.add(b);
            }
        });

        const customMotoristas = JSON.parse(localStorage.getItem('custom_motoristas') || '[]');
        customMotoristas.forEach(m => {
            if (m && m.trim()) motSet.add(m.trim());
        });
    } catch (e) {}

    // 2. Tentar buscar dados ao vivo da API PHP do MySQL
    fetch('./api/get_data.php?env=Frota%20Principal')
        .then(res => res.json())
        .then(res => {
            if (res.success && res.config) {
                // Bases customizadas salvas
                if (res.config.custom_bases) {
                    try {
                        const parsedBases = JSON.parse(res.config.custom_bases);
                        parsedBases.forEach(line => {
                            if (line.includes(' - ')) {
                                const parts = line.split(' - ');
                                const b = cleanBaseName(parts[0]);
                                const r = parts[1].trim();
                                if (b) {
                                    basesSet.add(b);
                                    if (r) {
                                        respSet.add(r);
                                        labState.mappings.baseToResp[b.toLowerCase()] = r;
                                    }
                                }
                            } else {
                                const b = cleanBaseName(line);
                                if (b) basesSet.add(b);
                            }
                        });
                    } catch (e) {}
                }

                // Requisições disponíveis em estoque no pool real
                if (res.config.custom_requisicoes) {
                    try {
                        const parsedReqs = JSON.parse(res.config.custom_requisicoes);
                        if (parsedReqs && parsedReqs.length > 0) {
                            const livePool = [];
                            parsedReqs.forEach((line, idx) => {
                                const parts = line.split(' - ');
                                const id = parts[0].trim();
                                let litros = 15;
                                let lote = 'LOTE 3 (15K)';
                                if (parts.length > 1) {
                                    const lMatch = parts[1].match(/(\d+)L/);
                                    if (lMatch) litros = parseInt(lMatch[1], 10);
                                    const loteMatch = parts[1].match(/\((.*?)\)/);
                                    if (loteMatch) lote = loteMatch[1];
                                }
                                const idParts = id.split('-');
                                const grupo = idParts[0] || '1787595670733';
                                const seq = idParts[1] || String(idx + 1).padStart(3, '0');
                                livePool.push({
                                    id: id,
                                    codigoControle: grupo,
                                    seq: seq,
                                    numero: parseInt(seq, 10) || (idx + 1),
                                    litros: litros,
                                    lote: lote,
                                    valorEstimado: litros * 7.29
                                });
                            });
                            if (livePool.length > 0) {
                                labState.pool = livePool;
                                savePool();
                            }
                        }
                    } catch(e) {}
                }
            }

            // Da lista de lançamentos reais (hml_requisicoes)
            if (res.success && Array.isArray(res.requisicoes) && res.requisicoes.length > 0) {
                labState.lancamentos = res.requisicoes.map(r => ({
                    id: r.id,
                    lote: r.lote || 'LOTE 1 (7K)',
                    litros: parseFloat(r.litros) || 15,
                    codigoControle: (r.inicioSeq || '').split('-')[0] || '',
                    seq: (r.inicioSeq || '').split('-')[1] || '',
                    base: cleanBaseName(r.zona),
                    responsavel: r.responsavel,
                    motorista: r.motorista,
                    valor: parseFloat(r.valor) || 0,
                    data: r.date
                }));
                savePool();

                res.requisicoes.forEach(row => {
                    if (row.zona && row.zona !== 'Não Informado') {
                        const b = cleanBaseName(row.zona);
                        if (b) basesSet.add(b);
                    }
                    if (row.responsavel && row.responsavel !== 'Não Informado') {
                        respSet.add(row.responsavel.trim());
                    }
                    if (row.motorista && row.motorista !== 'Não Informado') {
                        motSet.add(row.motorista.trim());
                    }
                });
            }

            applyEntitiesSets(basesSet, respSet, motSet);
        })
        .catch(err => {
            console.warn('Usando base local para entidades:', err);
            applyEntitiesSets(basesSet, respSet, motSet);
        });

    // Buscar veículos para mapear motoristas às bases
    fetch('../veiculos/api/get_veiculos.php?env=Frota%20Principal')
        .then(r => r.json())
        .then(res => {
            if (res.success && Array.isArray(res.veiculos)) {
                res.veiculos.forEach(v => {
                    const base = cleanBaseName(v.local_atuacao);
                    const mot = v.motorista ? v.motorista.trim() : '';
                    if (base && mot && mot !== 'Não Informado') {
                        const lowerBase = base.toLowerCase();
                        if (!labState.mappings.baseToMotoristas[lowerBase]) {
                            labState.mappings.baseToMotoristas[lowerBase] = new Set();
                        }
                        labState.mappings.baseToMotoristas[lowerBase].add(mot);
                    }
                });
            }
        })
        .catch(err => {
            console.warn('Erro ao carregar veículos para lab:', err);
        });
}

function applyEntitiesSets(basesSet, respSet, motSet) {
    // Fallbacks inteligentes se a base estiver zerada
    if (basesSet.size === 0) {
        ['Araguari', 'Uberlândia', 'Patos de Minas', 'Ituiutaba', 'Araxá', 'Monte Carmelo'].forEach(b => basesSet.add(b));
    }
    if (respSet.size === 0) {
        ['Carlos Eduardo', 'Roberto Lima', 'Fernanda Souza', 'Marcos Paulo', 'Lucas Silva', 'Valdir Santos'].forEach(r => respSet.add(r));
    }
    if (motSet.size === 0) {
        ['João Pedro', 'Antônio Carlos', 'Marcelo Vieira', 'José Ferreira', 'Paulo Henrique', 'Cláudio Mendes'].forEach(m => motSet.add(m));
    }

    labState.bases = Array.from(basesSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    labState.responsaveis = Array.from(respSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    labState.motoristas = Array.from(motSet).sort((a, b) => a.localeCompare(b, 'pt-BR'));

    // Não selecionar base ou responsável padrão por padrão
    renderDispensador();
}

// Gerador de pool simulado rico (LOTE 1, LOTE 2, LOTE 3)
function generateInitialMockPool() {
    const pool = [];
    const gruposConfig = [
        // LOTE 1 (~430 requisições)
        { grupo: '1786981045866', litros: 15, lote: 'LOTE 1', count: 100 },
        { grupo: '1786980886172', litros: 15, lote: 'LOTE 1', count: 80 },
        { grupo: '1786980942947', litros: 20, lote: 'LOTE 1', count: 100 },
        { grupo: '1786981005372', litros: 25, lote: 'LOTE 1', count: 60 },
        { grupo: '1786982001144', litros: 30, lote: 'LOTE 1', count: 50 },
        { grupo: '1786983008899', litros: 50, lote: 'LOTE 1', count: 40 },
        
        // LOTE 2 (~250 requisições)
        { grupo: '1787100001234', litros: 15, lote: 'LOTE 2', count: 100 },
        { grupo: '1787100005678', litros: 20, lote: 'LOTE 2', count: 100 },
        { grupo: '1787100009988', litros: 30, lote: 'LOTE 2', count: 50 },

        // LOTE 3 (~130 requisições)
        { grupo: '1787200007711', litros: 20, lote: 'LOTE 3', count: 80 },
        { grupo: '1787200008822', litros: 50, lote: 'LOTE 3', count: 50 }
    ];

    gruposConfig.forEach(cfg => {
        for (let i = 1; i <= cfg.count; i++) {
            const seqStr = String(i).padStart(3, '0');
            pool.push({
                id: `${cfg.grupo}-${seqStr}`,
                codigoControle: cfg.grupo,
                seq: seqStr,
                numero: i,
                litros: cfg.litros,
                lote: cfg.lote,
                valorEstimado: cfg.litros * 5.89
            });
        }
    });

    labState.pool = pool;
    savePool();
}

function savePool() {
    try {
        localStorage.setItem('lab_dispensador_pool', JSON.stringify(labState.pool));
        localStorage.setItem('lab_dispensador_lancamentos', JSON.stringify(labState.lancamentos));
        localStorage.setItem('lab_session_counter', labState.deliveredSessionCount.toString());
    } catch (e) {}
}

function updateSessionCounterUI() {
    const el = document.getElementById('lab-session-counter');
    if (el) el.textContent = `Entregues hoje: ${labState.deliveredSessionCount} reqs`;
}

// 3. RENDERIZADOR PRINCIPAL DO DISPENSADOR
function renderDispensador() {
    renderLotes();
    renderLitrosCards();
    renderGruposChips();
    renderTicketsMatrix();
}

// Renderiza botões de lotes
function renderLotes() {
    const container = document.getElementById('lotes-container');
    if (!container) return;

    // Obter todos os lotes únicos presentes no pool
    const lotesSet = new Set(labState.pool.map(item => item.lote));
    if (lotesSet.size === 0) {
        lotesSet.add('LOTE 1');
        lotesSet.add('LOTE 2');
        lotesSet.add('LOTE 3');
    }
    const lotes = Array.from(lotesSet).sort();

    if (!lotes.includes(labState.activeLote)) {
        labState.activeLote = lotes[0];
    }

    container.innerHTML = '';

    lotes.forEach(lote => {
        const count = labState.pool.filter(item => item.lote === lote).length;
        const btn = document.createElement('button');
        btn.className = `lote-pill ${labState.activeLote === lote ? 'active' : ''}`;
        btn.dataset.lote = lote;
        btn.innerHTML = `
            <span>${lote}</span>
            <span class="lote-badge-count">${count} disp.</span>
        `;
        btn.addEventListener('click', () => {
            labState.activeLote = lote;
            labState.activeGrupo = null;
            labState.selectedTickets.clear();
            renderDispensador();
        });
        container.appendChild(btn);
    });
}

// Renderiza os cards táteis de litragens
function renderLitrosCards() {
    const grid = document.getElementById('litros-cards-grid');
    if (!grid) return;

    const litragens = [15, 20, 25, 30, 50];
    grid.innerHTML = '';

    litragens.forEach(litro => {
        const availableInLote = labState.pool.filter(item => item.lote === labState.activeLote && item.litros === litro);
        const count = availableInLote.length;
        const isAvailable = count > 0;
        const isActive = labState.activeLitragem === litro;

        const card = document.createElement('div');
        card.className = `litro-card ${isActive ? 'active' : ''} ${!isAvailable ? 'disabled' : ''}`;
        card.innerHTML = `
            <div class="litro-val">${litro}L</div>
            <div class="litro-status-badge ${isAvailable ? 'available' : 'empty'}">
                ${isAvailable ? '● DISPONÍVEL' : '○ ESGOTADO'}
            </div>
            <div class="litro-count-info">${count} requisições no lote</div>
        `;

        if (isAvailable) {
            card.addEventListener('click', () => {
                labState.activeLitragem = litro;
                labState.activeGrupo = null; // Auto-seleciona primeiro grupo
                labState.selectedTickets.clear();
                renderDispensador();
            });
        }

        grid.appendChild(card);
    });
}

// Renderiza os chips de grupos de controle da litragem selecionada
function renderGruposChips() {
    const list = document.getElementById('grupos-chips-list');
    if (!list) return;

    const items = labState.pool.filter(item => item.lote === labState.activeLote && item.litros === labState.activeLitragem);
    const gruposMap = {};

    items.forEach(item => {
        gruposMap[item.codigoControle] = (gruposMap[item.codigoControle] || 0) + 1;
    });

    const grupos = Object.keys(gruposMap);
    list.innerHTML = '';

    if (grupos.length === 0) {
        list.innerHTML = `<span style="font-size: 0.8rem; color: var(--text-muted);">Nenhum grupo ativo para esta litragem.</span>`;
        labState.activeGrupo = null;
        return;
    }

    if (!labState.activeGrupo || !grupos.includes(labState.activeGrupo)) {
        labState.activeGrupo = grupos[0];
    }

    grupos.forEach(grupo => {
        const count = gruposMap[grupo];
        const chip = document.createElement('div');
        chip.className = `grupo-chip ${labState.activeGrupo === grupo ? 'active' : ''}`;
        chip.innerHTML = `<span>${grupo}</span> <strong style="color: var(--accent-yellow); margin-left: 4px;">(${count})</strong>`;
        chip.addEventListener('click', () => {
            labState.activeGrupo = grupo;
            labState.selectedTickets.clear();
            renderDispensador();
        });
        list.appendChild(chip);
    });
}

// Renderiza a matriz de tickets (sequências de 001 a 100)
function renderTicketsMatrix() {
    const grid = document.getElementById('tickets-matrix-grid');
    const titleEl = document.getElementById('current-group-title');
    const subtitleEl = document.getElementById('current-group-subtitle');
    const searchTerm = (document.getElementById('ticket-search')?.value || '').trim();

    if (!grid) return;

    if (!labState.activeGrupo) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">Selecione uma litragem com estoque disponível acima.</div>`;
        return;
    }

    let tickets = labState.pool.filter(item => 
        item.lote === labState.activeLote && 
        item.litros === labState.activeLitragem && 
        item.codigoControle === labState.activeGrupo
    );

    if (searchTerm) {
        tickets = tickets.filter(t => t.id.includes(searchTerm) || t.seq.includes(searchTerm));
    }

    // Atualiza cabeçalhos
    if (titleEl) titleEl.textContent = `Controle: ${labState.activeGrupo} (${labState.activeLitragem} Litros)`;
    if (subtitleEl) subtitleEl.textContent = `${tickets.length} requisições disponíveis em estoque neste bloco`;

    grid.innerHTML = '';

    if (tickets.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 2rem;">Todas as requisições deste grupo já foram distribuídas!</div>`;
        return;
    }

    tickets.forEach(ticket => {
        const isSelected = labState.selectedTickets.has(ticket.id);
        const btn = document.createElement('button');
        btn.className = `ticket-btn ${isSelected ? 'selected' : ''}`;
        btn.id = `ticket-btn-${ticket.id}`;
        btn.innerHTML = `
            <span>${ticket.seq}</span>
            <span class="ticket-tag-litros">${ticket.litros}L</span>
        `;

        btn.addEventListener('click', () => {
            if (labState.isMultiSelect) {
                // Modo seleção múltipla
                if (labState.selectedTickets.has(ticket.id)) {
                    labState.selectedTickets.delete(ticket.id);
                    btn.classList.remove('selected');
                } else {
                    labState.selectedTickets.add(ticket.id);
                    btn.classList.add('selected');
                }
                updateMultiSelectUI();
            } else {
                // Modo unitário direto: abre drawer para esse ticket
                openDrawerForTickets([ticket]);
            }
        });

        grid.appendChild(btn);
    });

    updateMultiSelectUI();
}

function updateMultiSelectUI() {
    const badge = document.getElementById('selected-count-badge');
    const deliverBtn = document.getElementById('btn-deliver-selected');
    const count = labState.selectedTickets.size;

    if (badge) badge.textContent = count;
    if (deliverBtn) deliverBtn.style.display = count > 0 ? 'inline-flex' : 'none';
}

// 4. ATRIBUIÇÃO EXPRESSA (DRAWER LATERAL)
function openDrawerForTickets(ticketsList) {
    if (!ticketsList || ticketsList.length === 0) return;

    labState.drawerSelection.tickets = ticketsList;
    labState.drawerSelection.base = '';
    labState.drawerSelection.responsavel = '';
    labState.drawerSelection.motorista = '';
    const customMotInput = document.getElementById('drawer-custom-motorista');
    if (customMotInput) customMotInput.value = '';

    const overlay = document.getElementById('drawer-overlay');
    const numberEl = document.getElementById('drawer-ticket-number');
    const litrosEl = document.getElementById('drawer-ticket-litros');

    if (ticketsList.length === 1) {
        const t = ticketsList[0];
        if (numberEl) numberEl.textContent = t.id;
        if (litrosEl) litrosEl.textContent = `Litragem: ${t.litros} Litros • ${t.lote}`;
    } else {
        const totalL = ticketsList.reduce((acc, cur) => acc + cur.litros, 0);
        if (numberEl) numberEl.textContent = `${ticketsList.length} Requisições Selecionadas`;
        if (litrosEl) litrosEl.textContent = `Litragem Total: ${totalL} Litros (${ticketsList[0].litros}L cada) • ${ticketsList[0].lote}`;
    }

    renderDrawerTouchButtons();

    if (overlay) overlay.classList.add('active');
}

function closeDrawer() {
    const overlay = document.getElementById('drawer-overlay');
    if (overlay) overlay.classList.remove('active');
}

function getRelatedResponsaveis(baseName) {
    if (!baseName) return [];
    const lowerBase = baseName.toLowerCase();
    const related = new Set();
    
    // 1. Dos mapeamentos de configuração
    if (labState.mappings.baseToResp[lowerBase]) {
        related.add(labState.mappings.baseToResp[lowerBase]);
    }
    
    // 2. Dos lançamentos históricos
    labState.lancamentos.forEach(row => {
        if (row.base && row.base.toLowerCase() === lowerBase && row.responsavel && row.responsavel !== 'Não Informado') {
            related.add(row.responsavel.trim());
        }
    });
    
    return Array.from(related).sort();
}

function getRelatedMotoristas(baseName) {
    if (!baseName) return [];
    const lowerBase = baseName.toLowerCase();
    const related = new Set();
    
    // 1. Dos veículos alocados à base
    if (labState.mappings.baseToMotoristas && labState.mappings.baseToMotoristas[lowerBase]) {
        labState.mappings.baseToMotoristas[lowerBase].forEach(m => related.add(m));
    }
    
    // 2. Dos lançamentos históricos
    labState.lancamentos.forEach(row => {
        if (row.base && row.base.toLowerCase() === lowerBase && row.motorista && row.motorista !== 'Não Informado') {
            related.add(row.motorista.trim());
        }
    });
    
    return Array.from(related).sort();
}

function renderDrawerTouchButtons() {
    const selectedBase = labState.drawerSelection.base;
    
    // 1. Grid de Bases (APENAS O NOME DA BASE)
    const basesGrid = document.getElementById('drawer-bases-grid');
    if (basesGrid) {
        basesGrid.innerHTML = '';
        labState.bases.forEach(baseRaw => {
            const cleanBase = cleanBaseName(baseRaw);
            if (!cleanBase) return;
            const btn = document.createElement('button');
            btn.className = `touch-btn ${selectedBase === cleanBase ? 'active' : ''}`;
            btn.textContent = cleanBase;
            btn.title = `Base: ${cleanBase}`;
            btn.addEventListener('click', () => {
                labState.drawerSelection.base = cleanBase;
                
                // Exibir apenas os responsáveis relacionados a essa base
                const relatedResps = getRelatedResponsaveis(cleanBase);
                if (relatedResps.length === 1) {
                    labState.drawerSelection.responsavel = relatedResps[0];
                } else {
                    labState.drawerSelection.responsavel = '';
                }
                
                // Limpar motorista selecionado ao trocar de base
                labState.drawerSelection.motorista = '';
                const customMotInput = document.getElementById('drawer-custom-motorista');
                if (customMotInput) customMotInput.value = '';

                renderDrawerTouchButtons();
            });
            basesGrid.appendChild(btn);
        });
    }

    // 2. Controlar exibição e preencher Responsáveis relacionados
    const containerResp = document.getElementById('drawer-container-responsavel');
    const respGrid = document.getElementById('drawer-responsaveis-grid');
    
    if (containerResp) {
        if (selectedBase) {
            containerResp.style.display = 'block';
            if (respGrid) {
                respGrid.innerHTML = '';
                const relatedResps = getRelatedResponsaveis(selectedBase);
                relatedResps.forEach(resp => {
                    const btn = document.createElement('button');
                    btn.className = `touch-btn ${labState.drawerSelection.responsavel === resp ? 'active' : ''}`;
                    btn.textContent = resp;
                    btn.title = `Responsável: ${resp}`;
                    btn.addEventListener('click', () => {
                        labState.drawerSelection.responsavel = resp;
                        renderDrawerTouchButtons();
                    });
                    respGrid.appendChild(btn);
                });
            }
        } else {
            containerResp.style.display = 'none';
        }
    }

    // 3. Controlar exibição e preencher Motoristas relacionados (só se disponível)
    const containerMot = document.getElementById('drawer-container-motorista');
    const motGrid = document.getElementById('drawer-motoristas-grid');
    
    if (containerMot) {
        const relatedMots = selectedBase ? getRelatedMotoristas(selectedBase) : [];
        if (selectedBase && relatedMots.length > 0) {
            containerMot.style.display = 'block';
            if (motGrid) {
                motGrid.innerHTML = '';
                relatedMots.forEach(mot => {
                    const btn = document.createElement('button');
                    btn.className = `touch-btn ${labState.drawerSelection.motorista === mot ? 'active' : ''}`;
                    btn.textContent = mot;
                    btn.title = `Motorista: ${mot}`;
                    btn.addEventListener('click', () => {
                        labState.drawerSelection.motorista = mot;
                        const customInput = document.getElementById('drawer-custom-motorista');
                        if (customInput) customInput.value = '';
                        renderDrawerTouchButtons();
                    });
                    motGrid.appendChild(btn);
                });
            }
        } else {
            containerMot.style.display = 'none';
        }
    }
}

// Confirma a entrega e abate do estoque
function confirmDelivery() {
    const tickets = labState.drawerSelection.tickets;
    if (!tickets || tickets.length === 0) return;

    if (!labState.drawerSelection.base) {
        alert("Por favor, selecione uma Base de Atuação.");
        return;
    }
    if (!labState.drawerSelection.responsavel) {
        alert("Por favor, selecione o Responsável.");
        return;
    }

    let finalMotorista = labState.drawerSelection.motorista;
    const customMotInput = document.getElementById('drawer-custom-motorista');
    if (customMotInput && customMotInput.value.trim()) {
        finalMotorista = customMotInput.value.trim();
        if (!labState.motoristas.includes(finalMotorista)) {
            labState.motoristas.push(finalMotorista);
        }
    }

    if (!finalMotorista) {
        finalMotorista = 'Não Informado';
    }

    const now = new Date();
    const dataStr = now.toISOString().split('T')[0];

    // Cria os registros distribuídos e remove do pool
    const ticketIdsToRemove = new Set(tickets.map(t => t.id));

    tickets.forEach(t => {
        labState.lancamentos.push({
            id: t.id,
            lote: t.lote,
            litros: t.litros,
            codigoControle: t.codigoControle,
            seq: t.seq,
            base: labState.drawerSelection.base,
            responsavel: labState.drawerSelection.responsavel,
            motorista: finalMotorista,
            valor: t.valorEstimado,
            data: dataStr
        });
    });

    // Remove do pool de estoque
    labState.pool = labState.pool.filter(item => !ticketIdsToRemove.has(item.id));
    labState.deliveredSessionCount += tickets.length;
    labState.selectedTickets.clear();

    savePool();
    updateSessionCounterUI();
    closeDrawer();

    // Feedback visual e redesenho
    renderDispensador();

    if (labState.activeView === 'relatorios') {
        renderCustomReport();
    }
}

// 5. EVENTOS DO DISPENSADOR
function initDispensadorEvents() {
    // Busca de ticket
    const searchInput = document.getElementById('ticket-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => renderTicketsMatrix());
    }

    // Botão de resetar simulação
    const btnReset = document.getElementById('btn-reset-simulacao');
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            if (confirm('Deseja recarregar o estoque completo de simulação? Todas as requisições de teste voltarão ao estado inicial.')) {
                generateInitialMockPool();
                labState.deliveredSessionCount = 0;
                labState.lancamentos = [];
                savePool();
                updateSessionCounterUI();
                renderDispensador();
                if (labState.activeView === 'relatorios') renderCustomReport();
            }
        });
    }

    // Botão de zerar tudo (limpar cache e banco local)
    const btnClearAll = document.getElementById('btn-clear-all');
    if (btnClearAll) {
        btnClearAll.addEventListener('click', () => {
            if (confirm('Deseja limpar TODO o estoque local e histórico do laboratório para iniciar de forma 100% vazia?')) {
                localStorage.removeItem('lab_dispensador_pool');
                localStorage.removeItem('lab_dispensador_lancamentos');
                localStorage.removeItem('lab_session_counter');
                
                labState.pool = [];
                labState.lancamentos = [];
                labState.deliveredSessionCount = 0;
                
                updateSessionCounterUI();
                renderDispensador();
                if (labState.activeView === 'relatorios') renderCustomReport();
            }
        });
    }

    // Alternar seleção múltipla
    const btnMulti = document.getElementById('btn-select-multiple');
    const statusMulti = document.getElementById('multi-select-status');
    if (btnMulti) {
        btnMulti.addEventListener('click', () => {
            labState.isMultiSelect = !labState.isMultiSelect;
            labState.selectedTickets.clear();
            if (statusMulti) {
                statusMulti.textContent = labState.isMultiSelect ? 'LIGADA (Tocar para selecionar)' : 'DESLIGADA';
                statusMulti.style.color = labState.isMultiSelect ? 'var(--accent-yellow)' : 'var(--text-muted)';
            }
            renderTicketsMatrix();
        });
    }

    // Botão de entregar selecionadas
    const btnDeliverSelected = document.getElementById('btn-deliver-selected');
    if (btnDeliverSelected) {
        btnDeliverSelected.addEventListener('click', () => {
            const selectedList = labState.pool.filter(item => labState.selectedTickets.has(item.id));
            if (selectedList.length > 0) {
                openDrawerForTickets(selectedList);
            }
        });
    }

    // Botão de novo lote
    const btnNovoLote = document.getElementById('btn-novo-lote');
    if (btnNovoLote) {
        btnNovoLote.addEventListener('click', () => {
            const nomeLote = prompt('Informe o nome do novo lote (ex: LOTE 4):', `LOTE ${labState.pool.length ? 4 : 1}`);
            if (nomeLote && nomeLote.trim()) {
                const cleanNome = nomeLote.trim().toUpperCase();
                // Adiciona 50 requisições de teste no novo lote
                const novoGrupo = '178730000' + Math.floor(1000 + Math.random() * 9000);
                for (let i = 1; i <= 50; i++) {
                    const seqStr = String(i).padStart(3, '0');
                    labState.pool.push({
                        id: `${novoGrupo}-${seqStr}`,
                        codigoControle: novoGrupo,
                        seq: seqStr,
                        numero: i,
                        litros: 20,
                        lote: cleanNome,
                        valorEstimado: 20 * 5.89
                    });
                }
                labState.activeLote = cleanNome;
                savePool();
                renderDispensador();
            }
        });
    }

    // Drawer events
    const closeBtn = document.getElementById('btn-close-drawer');
    const cancelBtn = document.getElementById('btn-cancel-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const confirmBtn = document.getElementById('btn-confirm-delivery');

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (cancelBtn) cancelBtn.addEventListener('click', closeDrawer);
    if (confirmBtn) confirmBtn.addEventListener('click', confirmDelivery);
    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) closeDrawer();
        });
    }
}

// =========================================================
// 6. SISTEMA DE RELATÓRIOS PERSONALIZÁVEIS
// =========================================================
function initReportEvents() {
    const groupBySelect = document.getElementById('report-group-by');
    const filterLitroSelect = document.getElementById('report-filter-litro');
    const searchTermInput = document.getElementById('report-search-term');

    if (groupBySelect) {
        groupBySelect.addEventListener('change', (e) => {
            labState.reportConfig.groupBy = e.target.value;
            renderCustomReport();
        });
    }

    if (filterLitroSelect) {
        filterLitroSelect.addEventListener('change', (e) => {
            labState.reportConfig.filterLitro = e.target.value;
            renderCustomReport();
        });
    }

    if (searchTermInput) {
        searchTermInput.addEventListener('input', (e) => {
            labState.reportConfig.searchTerm = e.target.value.toLowerCase().trim();
            renderCustomReport();
        });
    }

    // Checkboxes de colunas
    const colIds = ['col-reqs', 'col-litros', 'col-valor', 'col-pct', 'col-media'];
    colIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', () => {
                const key = id.replace('col-', '');
                labState.reportConfig.cols[key] = el.checked;
                renderCustomReport();
            });
        }
    });

    // Botão de impressão do relatório
    const btnPrint = document.getElementById('btn-print-custom-report');
    if (btnPrint) {
        btnPrint.addEventListener('click', () => window.print());
    }

    // Botão de exportar Excel
    const btnExcel = document.getElementById('btn-export-custom-excel');
    if (btnExcel) {
        btnExcel.addEventListener('click', exportReportToExcel);
    }
}

function renderCustomReport() {
    const theadTr = document.getElementById('custom-report-thead-tr');
    const tbody = document.getElementById('custom-report-tbody');
    const tfoot = document.getElementById('custom-report-tfoot');

    if (!theadTr || !tbody || !tfoot) return;

    // 1. Filtrar lançamentos
    let dataset = [...labState.lancamentos];

    if (labState.reportConfig.filterLitro !== 'TODOS') {
        const targetL = parseInt(labState.reportConfig.filterLitro, 10);
        dataset = dataset.filter(row => row.litros === targetL);
    }

    if (labState.reportConfig.searchTerm) {
        const term = labState.reportConfig.searchTerm;
        dataset = dataset.filter(row => 
            (row.responsavel && row.responsavel.toLowerCase().includes(term)) ||
            (row.base && row.base.toLowerCase().includes(term)) ||
            (row.motorista && row.motorista.toLowerCase().includes(term)) ||
            (row.lote && row.lote.toLowerCase().includes(term)) ||
            (row.codigoControle && row.codigoControle.includes(term))
        );
    }

    // 2. Agrupar dados
    const groupKey = labState.reportConfig.groupBy;
    const grouped = {};
    let grandTotalReqs = 0;
    let grandTotalLitros = 0;
    let grandTotalValor = 0;

    dataset.forEach(row => {
        let keyVal = row[groupKey] || 'Não Informado';
        if (groupKey === 'litragem') keyVal = `${row.litros} Litros`;

        if (!grouped[keyVal]) {
            grouped[keyVal] = { key: keyVal, reqs: 0, litros: 0, valor: 0 };
        }

        grouped[keyVal].reqs += 1;
        grouped[keyVal].litros += row.litros;
        grouped[keyVal].valor += (row.valor || (row.litros * 5.89));

        grandTotalReqs += 1;
        grandTotalLitros += row.litros;
        grandTotalValor += (row.valor || (row.litros * 5.89));
    });

    const rows = Object.values(grouped).sort((a, b) => b.litros - a.litros);

    // 3. Montar Cabeçalhos Dinâmicos
    const groupLabels = {
        responsavel: 'Responsável',
        base: 'Base de Atuação',
        litragem: 'Litragem',
        lote: 'Lote',
        motorista: 'Motorista'
    };

    let headerHtml = `<th>${groupLabels[groupKey] || 'Item'}</th>`;
    if (labState.reportConfig.cols.reqs) headerHtml += `<th class="numeric">Qtd. Requisições</th>`;
    if (labState.reportConfig.cols.litros) headerHtml += `<th class="numeric">Volume (Litros)</th>`;
    if (labState.reportConfig.cols.valor) headerHtml += `<th class="numeric">Valor Total (R$)</th>`;
    if (labState.reportConfig.cols.pct) headerHtml += `<th class="numeric">Participação (%)</th>`;
    if (labState.reportConfig.cols.media) headerHtml += `<th class="numeric">Média (L/Req)</th>`;

    theadTr.innerHTML = headerHtml;

    // 4. Montar Linhas de Dados
    tbody.innerHTML = '';

    if (rows.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Nenhum registro encontrado para o filtro aplicado. Distribua requisições no dispensador para visualizar aqui.</td></tr>`;
    } else {
        rows.forEach(r => {
            const pct = grandTotalLitros > 0 ? (r.litros / grandTotalLitros) * 100 : 0;
            const media = r.reqs > 0 ? (r.litros / r.reqs) : 0;

            let rowHtml = `<td style="font-weight: 600; color: var(--text-primary);">${r.key}</td>`;
            if (labState.reportConfig.cols.reqs) rowHtml += `<td class="numeric">${r.reqs.toLocaleString('pt-BR')}</td>`;
            if (labState.reportConfig.cols.litros) rowHtml += `<td class="numeric" style="font-weight: bold; color: var(--accent-yellow);">${Math.round(r.litros).toLocaleString('pt-BR')} L</td>`;
            if (labState.reportConfig.cols.valor) rowHtml += `<td class="numeric">${r.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>`;
            if (labState.reportConfig.cols.pct) rowHtml += `<td class="numeric">${pct.toFixed(1)}%</td>`;
            if (labState.reportConfig.cols.media) rowHtml += `<td class="numeric">${media.toFixed(1)} L</td>`;

            const tr = document.createElement('tr');
            tr.innerHTML = rowHtml;
            tbody.appendChild(tr);
        });
    }

    // 5. TOTALIZADOR FINAL NO RODAPÉ (ESTRITO NO FIM DA TABELA)
    let footerHtml = `<td>TOTAL DO RELATÓRIO (${rows.length} ${groupLabels[groupKey]})</td>`;
    if (labState.reportConfig.cols.reqs) footerHtml += `<td class="numeric total-highlight">${grandTotalReqs.toLocaleString('pt-BR')}</td>`;
    if (labState.reportConfig.cols.litros) footerHtml += `<td class="numeric total-highlight">${Math.round(grandTotalLitros).toLocaleString('pt-BR')} L</td>`;
    if (labState.reportConfig.cols.valor) footerHtml += `<td class="numeric total-highlight">${grandTotalValor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>`;
    if (labState.reportConfig.cols.pct) footerHtml += `<td class="numeric total-highlight">100%</td>`;
    if (labState.reportConfig.cols.media) {
        const avgTotal = grandTotalReqs > 0 ? (grandTotalLitros / grandTotalReqs) : 0;
        footerHtml += `<td class="numeric total-highlight">${avgTotal.toFixed(1)} L</td>`;
    }

    tfoot.innerHTML = `<tr>${footerHtml}</tr>`;
}

// 7. EXPORTAÇÃO EXCEL (.XLSX)
function exportReportToExcel() {
    if (typeof XLSX === 'undefined') {
        alert('Biblioteca SheetJS não carregada.');
        return;
    }

    const table = document.getElementById('custom-report-table-el');
    if (!table) return;

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.table_to_sheet(table);

    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio_Personalizado');
    
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yyyy = now.getFullYear();

    XLSX.writeFile(wb, `Relatorio_Personalizado_MGP_${dd}${mm}${yyyy}.xlsx`);
}
