<?php
// Controle de Requisições - MGP (Ambiente de Laboratório & Sandbox)
// Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
// "si vis pacem para bellum"

$backUrl = "../hml/";
if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/hml/') !== false) {
    $backUrl = "../";
}
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Laboratório MGP — Dispensador Visual & Relatórios</title>
    <link rel="icon" type="image/png" href="./app_icon.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="./styles.css">
</head>
<body>

    <!-- TOP NAVBAR RESPONSIVA E ISOLADA -->
    <header class="lab-navbar">
        <div class="lab-navbar-top-row">
            <div class="lab-brand">
                <img src="./app_icon.png" alt="MGP" class="lab-logo-img">
                <div class="lab-brand-title">
                    <h1>Dispensador MGP <span class="lab-badge">LAB SANDBOX</span></h1>
                    <p class="lab-brand-subtitle">Ambiente Experimental de Distribuição & Relatórios</p>
                </div>
            </div>
            <a href="<?php echo $backUrl; ?>" class="btn-lab btn-back-top" title="Voltar ao painel principal de homologação">
                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                    <path d="M19 12H5M12 19l-7-7 7-7"/>
                </svg>
                <span class="btn-back-text">Voltar ao Dashboard</span>
            </a>
        </div>

        <!-- SELETOR DE MÓDULOS DO LAB (ISOLADO E RESPONSIVO) -->
        <div class="view-tabs">
            <button class="view-tab-btn active" id="tab-btn-dispensador" data-view="dispensador">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                Dispensador Visual
            </button>
            <button class="view-tab-btn" id="tab-btn-relatorios" data-view="relatorios">
                <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                    <line x1="18" y1="20" x2="18" y2="10"></line>
                    <line x1="12" y1="20" x2="12" y2="4"></line>
                    <line x1="6" y1="20" x2="6" y2="14"></line>
                </svg>
                Relatórios Personalizáveis
            </button>
        </div>

        <div class="lab-nav-actions">
            <span style="font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono);" id="lab-session-counter">Entregues hoje: 0 reqs</span>
            <button class="btn-lab" id="btn-reset-simulacao" title="Recarregar e resetar o lote de requisições de teste">
                <svg viewBox="0 0 24 24" width="13" height="13" stroke="currentColor" stroke-width="2" fill="none">
                    <polyline points="23 4 23 10 17 10"></polyline>
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                </svg>
                Resetar Simulação
            </button>
        </div>
    </header>

    <main class="lab-main">

        <!-- ==========================================
             VIEW 1: DISPENSADOR VISUAL DE REQUISIÇÕES
             ========================================== -->
        <section id="view-dispensador" class="lab-view-section">
            
            <!-- NÍVEL 1: LOTES -->
            <div class="lotes-bar">
                <div class="lotes-list" id="lotes-container">
                    <button class="lote-pill active" data-lote="LOTE 1">
                        <span>LOTE 1</span>
                        <span class="lote-badge-count" id="lote-1-count">0 disp.</span>
                    </button>
                    <button class="lote-pill" data-lote="LOTE 2">
                        <span>LOTE 2</span>
                        <span class="lote-badge-count">0 disp.</span>
                    </button>
                </div>
                <button class="btn-lab" id="btn-novo-lote" style="font-size: 0.75rem;">
                    <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                        <line x1="12" y1="5" x2="12" y2="19"></line>
                        <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    + Criar Novo Lote
                </button>
            </div>

            <!-- NÍVEL 2: LITRAGENS (CARDS TÁTEIS) -->
            <div style="margin-top: 1rem;">
                <div class="touch-section-title">1. Selecione a Litragem Desejada</div>
                <div class="litros-grid" id="litros-cards-grid">
                    <!-- Gerado dinamicamente via JS (15L, 20L, 25L, 30L, 50L) -->
                </div>
            </div>

            <!-- NÍVEL 3: GRUPOS DE CONTROLE (PREFIXOS) -->
            <div style="margin-top: 1.25rem;">
                <div class="grupos-bar" id="grupos-bar-container">
                    <span class="grupos-label">2. Grupo de Controle:</span>
                    <div id="grupos-chips-list" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- NÍVEL 4: MATRIZ DE TICKETS (SEQUÊNCIAS 001-100) -->
            <div style="margin-top: 1.25rem;">
                <div class="tickets-section">
                    <div class="tickets-header">
                        <div class="tickets-title-group">
                            <h3 id="current-group-title">Sequências Disponíveis (001 - 100)</h3>
                            <p id="current-group-subtitle">Clique no número para entregar a requisição ou selecione várias</p>
                        </div>
                        <div class="tickets-actions">
                            <div class="ticket-search-row">
                                <input type="text" id="ticket-search" class="ticket-search-input" placeholder="🔍 Buscar ticket (ex: 042)...">
                            </div>
                            <div class="ticket-buttons-row">
                                <button class="btn-lab" id="btn-select-multiple" title="Alternar modo de seleção múltipla" style="flex: 1; justify-content: center;">
                                    Seleção Múltipla: <strong id="multi-select-status" style="color: var(--text-muted); margin-left: 4px;">DESLIGADA</strong>
                                </button>
                                <button class="btn-lab btn-lab-primary" id="btn-deliver-selected" style="display: none; flex: 1; justify-content: center;">
                                    ⚡ Entregar Selecionadas (<span id="selected-count-badge">0</span>)
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- GRADE DE BOTÕES NUMERADOS -->
                    <div class="tickets-grid" id="tickets-matrix-grid">
                        <!-- Gerado dinamicamente via JS -->
                    </div>
                </div>
            </div>

        </section>

        <!-- ==========================================
             VIEW 2: RELATÓRIOS PERSONALIZÁVEIS
             ========================================== -->
        <section id="view-relatorios" class="lab-view-section" style="display: none;">
            <div class="custom-report-container">
                <div class="tickets-header">
                    <div class="tickets-title-group">
                        <h3>📊 Construtor de Relatórios Dinâmicos</h3>
                        <p>Configure os agrupamentos, colunas de dados e gere tabelas com totalizador estrito no rodapé final</p>
                    </div>
                    <div class="tickets-actions">
                        <button class="btn-lab" id="btn-print-custom-report">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                                <polyline points="6 9 6 2 18 2 18 9"></polyline>
                                <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                                <rect x="6" y="14" width="12" height="8"></rect>
                            </svg>
                            Imprimir / PDF
                        </button>
                        <button class="btn-lab btn-lab-cyan" id="btn-export-custom-excel">
                            <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2" fill="none">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                <polyline points="7 10 12 15 17 10"></polyline>
                                <line x1="12" y1="15" x2="12" y2="3"></line>
                            </svg>
                            Exportar Excel (.xlsx)
                        </button>
                    </div>
                </div>

                <!-- CONTROLES DO CONSTRUTOR DE RELATÓRIO -->
                <div class="report-controls-card">
                    <div class="report-config-row">
                        <div class="config-group">
                            <label for="report-group-by">Agrupar Linhas Por:</label>
                            <select id="report-group-by" class="select-custom">
                                <option value="responsavel">👤 Responsável</option>
                                <option value="base">📍 Base de Atuação</option>
                                <option value="litragem">⛽ Litragem (15L, 20L, 25L...)</option>
                                <option value="lote">🏷️ Lote de Requisição</option>
                                <option value="motorista">🚗 Motorista</option>
                            </select>
                        </div>

                        <div class="config-group">
                            <label>Filtrar Litragem:</label>
                            <select id="report-filter-litro" class="select-custom">
                                <option value="TODOS">Todas as Litragens</option>
                                <option value="15">15 Litros</option>
                                <option value="20">20 Litros</option>
                                <option value="25">25 Litros</option>
                                <option value="30">30 Litros</option>
                                <option value="50">50 Litros</option>
                            </select>
                        </div>

                        <div class="config-group">
                            <input type="text" id="report-search-term" class="ticket-search-input" placeholder="🔍 Filtrar termo..." style="min-width: 180px;">
                        </div>
                    </div>

                    <div class="report-config-row" style="border-top: 1px solid var(--border-color); padding-top: 0.75rem;">
                        <span class="grupos-label">Colunas Visíveis:</span>
                        <div class="checkbox-metrics-group">
                            <label class="checkbox-metric-item">
                                <input type="checkbox" id="col-reqs" checked> Qtd. Requisições
                            </label>
                            <label class="checkbox-metric-item">
                                <input type="checkbox" id="col-litros" checked> Volume Total (Litros)
                            </label>
                            <label class="checkbox-metric-item">
                                <input type="checkbox" id="col-valor" checked> Valor Total (R$)
                            </label>
                            <label class="checkbox-metric-item">
                                <input type="checkbox" id="col-pct" checked> Participação (%)
                            </label>
                            <label class="checkbox-metric-item">
                                <input type="checkbox" id="col-media"> Média L/Req
                            </label>
                        </div>
                    </div>
                </div>

                <!-- TABELA RENDERIZADA -->
                <div class="report-table-wrapper">
                    <table class="custom-report-table" id="custom-report-table-el">
                        <thead>
                            <tr id="custom-report-thead-tr">
                                <!-- Gerado dinamicamente -->
                            </tr>
                        </thead>
                        <tbody id="custom-report-tbody">
                            <!-- Linhas de dados -->
                        </tbody>
                        <tfoot id="custom-report-tfoot">
                            <!-- TOTALIZADOR ESTRITO NO FINAL DA TABELA -->
                        </tfoot>
                    </table>
                </div>
            </div>
        </section>

    </main>

    <!-- ==========================================
         DRAWER LATERAL DE ATRIBUIÇÃO EXPRESSA
         ========================================== -->
    <div class="drawer-overlay" id="drawer-overlay">
        <div class="drawer-panel">
            <div class="drawer-header">
                <h3>
                    <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2.5" fill="none">
                        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                    </svg>
                    Atribuição Expressa
                </h3>
                <button class="drawer-close-btn" id="btn-close-drawer">&times;</button>
            </div>

            <div class="drawer-body">
                <!-- PREVIEW DO TICKET -->
                <div class="ticket-preview-box">
                    <div class="ticket-preview-number" id="drawer-ticket-number">1786981045866-001</div>
                    <div class="ticket-preview-litros" id="drawer-ticket-litros">Litragem: 15 Litros • Lote 1</div>
                </div>

                <!-- PASSO 1: BASE -->
                <div>
                    <div class="touch-section-title">1. Selecione a Base:</div>
                    <div class="touch-buttons-grid" id="drawer-bases-grid">
                        <!-- Gerado dinamicamente via JS -->
                    </div>
                </div>

                <!-- PASSO 2: RESPONSÁVEL -->
                <div id="drawer-container-responsavel" style="display: none; margin-top: 1.25rem;">
                    <div class="touch-section-title">2. Selecione o Responsável:</div>
                    <div class="touch-buttons-grid" id="drawer-responsaveis-grid">
                        <!-- Gerado dinamicamente via JS -->
                    </div>
                </div>

                <!-- PASSO 3: MOTORISTA / NOVO -->
                <div id="drawer-container-motorista" style="display: none; margin-top: 1.25rem;">
                    <div class="touch-section-title">3. Selecione o Motorista / Destinatário:</div>
                    <div class="touch-buttons-grid" id="drawer-motoristas-grid">
                        <!-- Gerado dinamicamente via JS -->
                    </div>
                    <div style="margin-top: 0.5rem;">
                        <input type="text" id="drawer-custom-motorista" class="ticket-search-input" placeholder="Ou digite o nome do novo motorista..." style="width: 100%;">
                    </div>
                </div>
            </div>

            <div class="drawer-footer">
                <button class="btn-lab" id="btn-cancel-drawer">Cancelar</button>
                <button class="btn-lab btn-lab-primary" id="btn-confirm-delivery">
                    ✅ Confirmar Entrega
                </button>
            </div>
        </div>
    </div>

    <!-- SCRIPTS -->
    <script src="./libs/xlsx.mini.min.js"></script>
    <script src="./libs/papaparse.min.js"></script>
    <script src="./dispensador.js?v=41"></script>
</body>
</html>
