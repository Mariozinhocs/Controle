<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
?>
<!-- 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
-->
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <script>
        window.onerror = function(message, source, lineno, colno, error) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = 'none';
            }
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '0';
            errorDiv.style.left = '0';
            errorDiv.style.width = '100%';
            errorDiv.style.height = '100%';
            errorDiv.style.backgroundColor = 'rgba(0,0,0,0.95)';
            errorDiv.style.color = '#ff4d4d';
            errorDiv.style.padding = '2rem';
            errorDiv.style.zIndex = '999999';
            errorDiv.style.fontFamily = 'monospace';
            errorDiv.style.fontSize = '14px';
            errorDiv.style.overflow = 'auto';
            
            errorDiv.innerHTML = '<h2 style="margin-top:0;">🚨 Erro de Sistema Detectado</h2>' +
                '<p><strong>Mensagem:</strong> ' + message + '</p>' +
                '<p><strong>Arquivo:</strong> ' + source + '</p>' +
                '<p><strong>Linha:</strong> ' + lineno + ' | <strong>Coluna:</strong> ' + colno + '</p>' +
                '<p><strong>Pilha de Execução (Stack):</strong><br><pre style="background:#222;color:#eee;padding:1rem;border-radius:6px;margin-top:0.5rem;white-space:pre-wrap;font-size:12px;">' + (error ? error.stack : 'N/A') + '</pre></p>' +
                '<button onclick="window.location.reload(true)" style="background:#ff4d4d;color:#fff;border:none;padding:0.75rem 1.5rem;font-size:14px;border-radius:6px;cursor:pointer;margin-top:1rem;font-weight:bold;">Recarregar Página</button>';
            
            document.body.appendChild(errorDiv);
            return false;
        };
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Controle de Requisições - MGP</title>
    <link rel="icon" type="image/png" href="app_icon.png">
    <link rel="shortcut icon" href="favicon.ico">
    <link rel="apple-touch-icon" href="app_icon.png">
    <link rel="manifest" href="manifest.json">
    <link rel="stylesheet" href="styles.css?v=51">

    <!-- Bibliotecas Locais para funcionamento Offline -->
    <script src="libs/xlsx.mini.min.js"></script>
    <script src="libs/papaparse.min.js"></script>
    <script src="libs/apexcharts.js"></script>
</head>

<body>

    <!-- SPLASH SCREEN DE INICIALIZAÇÃO NATIVA -->
    <div class="splash-screen" id="splash-screen">
        <div class="splash-content">
            <div class="splash-logo-wrap">
                <img src="app_icon.png" alt="Controle Logo" class="splash-logo-img">
            </div>
            <h1 class="splash-title">CONTROLE DE REQUISIÇÕES</h1>
            <p class="splash-subtitle">MGP • Gestão de Abastecimentos & Frota</p>
            <div class="splash-progress-bar">
                <div class="splash-progress-fill" id="splash-progress-fill"></div>
            </div>
            <span class="splash-status-text" id="splash-status-text">Inicializando Software Nativo...</span>
        </div>
    </div>

    <!-- OVERLAY DE VALIDAÇÃO DE CHAVE DE ACESSO (GITHUB LICENSE) -->
    <div class="license-overlay" id="license-overlay" style="display: none;">
        <div class="license-card">
            <div class="license-header">
                <div class="license-icon-wrap">
                    <img src="app_icon.png" alt="Controle Icon" style="width: 44px; height: 44px; border-radius: 8px;">
                </div>
                <h2>Autenticação de Acesso</h2>
                <p>Insira a Chave de Licença para liberar a utilização do <strong>Controle de Requisições</strong>.</p>
            </div>
            <form id="license-form" class="license-form" onsubmit="return false;">
                <div class="license-input-group">
                    <label for="license-key-input">CHAVE DE ACESSO</label>
                    <div class="input-with-icon">
                        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21 2l-2 2m-2-2l2 2m2 0l-7 7m-1.5-1.5L4 16.5V20h3.5l7.5-7.5"/>
                        </svg>
                        <input type="text" id="license-key-input" placeholder="CTRL-XXXX-YYYY-ZZZZ" autocomplete="off" spellcheck="false" required>
                    </div>
                    <span class="license-status-msg" id="license-status-msg"></span>
                </div>
                <div class="license-actions">
                    <button type="submit" class="btn btn-primary btn-block" id="btn-validate-license">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M20 6L9 17l-5-5"/>
                        </svg>
                        Validar Acesso (GitHub)
                    </button>
                </div>
            </form>
            <div class="license-footer">
                <small>🔒 Validação via GitHub | Execução local e privada</small>
            </div>
        </div>
    </div>

    <!-- OVERLAY DE CARREGAMENTO (LOADING SPINNER) -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="spinner"></div>
        <span class="loading-text">Processando planilha de dados...</span>
    </div>

    <div class="app-container" id="app-container">

        <!-- SIDEBAR LATERAL (Métricas Principais) -->
        <aside class="sidebar" id="sidebar">
            <div class="logo-container">
                <div class="logo-brand">
                    <img src="app_icon.png" alt="Controle Icon" class="logo-img-icon">
                    <h2 class="logo-text">Controle</h2>
                </div>
                <button class="btn-sidebar-toggle" id="btn-toggle-sidebar" title="Contrair / Expandir Barra Lateral">
                    <svg id="sidebar-toggle-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>


            <div class="kpi-group">
                <!-- Seletor de Lote -->
                <div class="slicer-box-sidebar" style="margin-bottom: 1rem; width: 100%; padding: 0 0.5rem;">
                    <label style="font-size: 0.65rem; color: var(--text-muted); font-family: var(--font-mono); text-transform: uppercase; font-weight: 700; display: block; margin-bottom: 0.35rem;">Filtro por Lote</label>
                    <select id="select-lote-sidebar" style="background-color: var(--bg-secondary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; width: 100%; font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none; transition: border-color 0.2s;">
                        <option value="TODOS">Todos os Lotes</option>
                    </select>
                </div>

                <div class="kpi-card" id="kpi-req-cadastradas" draggable="true" title="Qtd de Requisições cadastradas">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">REQ. CADASTRADAS</span>
                </div>

                <div class="kpi-card" id="kpi-req-disponiveis" draggable="true" title="Qtd de Requisições Disponíveis">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">REQ. DISPONÍVEIS</span>
                </div>

                <div class="kpi-card" id="kpi-req-distribuidas" draggable="true" title="Qtd de Requisições Distribuídas">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">REQ. DISTRIBUÍDAS</span>
                </div>

                <div class="kpi-card" id="kpi-litros-disponiveis" draggable="true" title="Litros Disponíveis">
                    <span class="kpi-value">0 L</span>
                    <span class="kpi-label">LITROS DISPONÍVEIS</span>
                </div>

                <div class="kpi-card" id="kpi-litros" draggable="true" title="Litros Utilizados">
                    <span class="kpi-value">0 L</span>
                    <span class="kpi-label">LITROS UTILIZADOS</span>
                </div>

                <div class="kpi-card" id="kpi-gasto" draggable="true" title="Total Gasto">
                    <span class="kpi-value">R$ 0,00</span>
                    <span class="kpi-label">TOTAL GASTO</span>
                </div>

                <div class="kpi-card" id="kpi-preco-medio" draggable="true" title="Preço Médio / L">
                    <span class="kpi-value">R$ 0,00</span>
                    <span class="kpi-label">PREÇO MÉDIO / L</span>
                </div>

                <div class="kpi-card highlight-card" id="kpi-maior-gasto" draggable="true" title="Maior Consumo (Veículo)">
                    <span class="kpi-value">-</span>
                    <span class="kpi-label">MAIOR CONSUMO (VEÍCULO)</span>
                </div>

                <div class="kpi-card highlight-card" id="kpi-maior-gasto-base" draggable="true" title="Maior Consumo (Base)">
                    <span class="kpi-value">-</span>
                    <span class="kpi-label">MAIOR CONSUMO (BASE)</span>
                </div>
            </div>

            <!-- Assinatura A-Team -->
            <div class="sidebar-signature">
                <p class="sig-author">© 2026 Controle de Requisições</p>
                <p class="sig-email">Hub Digital 360</p>
                <p class="sig-quote" style="font-family: inherit; font-style: normal; font-size: 0.65rem; opacity: 0.5;">Todos os direitos reservados.</p>
            </div>
        </aside>

        <!-- CONTEÚDO PRINCIPAL -->
        <main class="main-content">
            <!-- HEADER -->
            <header class="header">
                <div class="header-title">
                    <h1>Controle de Requisições - MGP</h1>
                    <div class="header-meta">
                        <span class="subtitle">Análise de abastecimentos e gastos</span>
                        <span class="file-badge">
                            <svg viewBox="0 0 24 24" width="12" height="12" stroke="currentColor" stroke-width="2.5"
                                fill="none" style="margin-right: 4px; vertical-align: middle;">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                                <polyline points="14 2 14 8 20 8"></polyline>
                            </svg>
                            <span id="active-filename">Nenhum arquivo carregado</span>
                        </span>
                          <div class="header-actions">
                    <!-- Seletor de Ambiente / Frota -->
                    <div class="env-selector-container" style="display: flex; align-items: center; gap: 0.5rem; background-color: rgba(255, 255, 255, 0.05); padding: 0.4rem 0.75rem; border-radius: 8px; border: 1px solid var(--border-color); margin-right: 0.5rem;">
                        <label for="select-environment" style="font-size: 0.75rem; font-weight: 700; color: var(--accent-yellow); white-space: nowrap; margin-bottom: 0;">🏢 Gestão:</label>
                        <select id="select-environment" style="background: transparent; border: none; color: var(--text-primary); font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none; padding-right: 1.5rem; background-image: url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%2523ffffff%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E'); background-repeat: no-repeat; background-position: right center; background-size: 8px; -webkit-appearance: none; -moz-appearance: none; appearance: none;">
                            <option value="Frota Principal" style="background-color: var(--bg-secondary); color: var(--text-primary);">Frota Principal</option>
                        </select>
                        <button type="button" id="btn-manage-envs" title="Gerenciar Ambientes (Criar/Excluir)" style="background: transparent; border: none; color: var(--text-secondary); cursor: pointer; padding: 0 0.25rem; display: flex; align-items: center; justify-content: center; outline: none; transition: var(--transition-smooth);">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="pointer-events: none;">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                        </button>
                    </div>
                    <!-- Botão Limpar Dados e Filtros -->
                    <button class="btn btn-danger btn-icon" id="btn-clear-data" title="Limpar todos os dados e filtros">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                            <line x1="10" y1="11" x2="10" y2="17"></line>
                            <line x1="14" y1="11" x2="14" y2="17"></line>
                        </svg>
                        Limpar
                    </button>
                    <!-- Botão Alternar Tema (Claro/Escuro) -->
                    <button class="btn btn-secondary btn-icon" id="btn-toggle-theme" title="Alternar entre modo claro e escuro" style="padding: 0.4rem 0.6rem;">
                        <svg id="theme-toggle-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <path d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m0-12.728l.707.707m11.314 11.314l.707.707M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z" />
                        </svg>
                    </button>
                    <!-- Botão de Tela Cheia -->
                    <button class="btn btn-secondary btn-icon" id="btn-fullscreen" title="Alternar Modo Tela Cheia (Fullscreen)">
                        <svg id="icon-fullscreen" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                        </svg>
                        <span class="btn-fullscreen-label">Tela Cheia</span>
                    </button>
                    <!-- Botão de Gerar Infográfico -->
                    <button class="btn btn-secondary btn-icon" id="btn-open-infografico" title="Gerar infográfico visual de dados">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
                            <line x1="9" y1="17" x2="9" y2="8"/>
                            <line x1="13" y1="17" x2="13" y2="11"/>
                            <line x1="17" y1="17" x2="17" y2="14"/>
                        </svg>
                        Gerar Infográfico
                    </button>
                    <!-- Botão de Imprimir/PDF -->
                    <button class="btn btn-secondary btn-icon" id="btn-print" title="Gerar relatório em PDF / Imprimir">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" style="vertical-align: middle;">
                            <polyline points="6 9 6 2 18 2 18 9" />
                            <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
                            <rect x="6" y="14" width="12" height="8" />
                        </svg>
                        Gerar Relatório
                    </button>
                    <!-- Botão de Relatório Simplificado (à direita de Gerar Relatório) -->
                    <button class="btn btn-secondary btn-icon" id="btn-open-relatorio-simplificado" title="Gerar Relatório Simplificado de Requisições">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right:4px;">
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                            <polyline points="14 2 14 8 20 8"></polyline>
                            <line x1="16" y1="13" x2="8" y2="13"></line>
                            <line x1="16" y1="17" x2="8" y2="17"></line>
                            <polyline points="10 9 9 9 8 9"></polyline>
                        </svg>
                        Relatório Simplificado
                    </button>
                    <!-- Botão de Exportar Excel -->
                    <button class="btn btn-secondary btn-icon" id="btn-export-excel"
                        title="Baixar base de dados atualizada em Excel (.xlsx)">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" style="vertical-align: middle;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Baixar Excel

                    </button>
                    <!-- Botão de Veículos Contratados -->
                    <button class="btn btn-secondary btn-icon" id="btn-goto-veiculos" title="Gerenciar contratos e consumo de veículos contratados" onclick="window.location.href='./veiculos/'" style="display: none;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right:4px;">
                            <rect x="1" y="3" width="15" height="13" rx="2" ry="2"></rect>
                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                        </svg>
                        Veículos Contratados
                    </button>
                    <!-- Botão de Cadastros -->
                    <button class="btn btn-secondary btn-icon" id="btn-open-cadastros" title="Gerenciar cadastros de Bases, Postos e Responsáveis">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                            <circle cx="9" cy="7" r="4"></circle>
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
                            <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
                        </svg>
                        Cadastros
                    </button>
                    <!-- Botão Dispensador Visual -->
                    <button class="btn btn-primary btn-icon" id="btn-open-dispensador" title="Acessar o Dispensador Visual de Requisições por Lotes" style="background: linear-gradient(135deg, #ffb703, #fb8500); color: #000; font-weight: 700; border: none;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right:4px;">
                            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                        </svg>
                        Dispensador Visual
                    </button>
                    <!-- Botão de Nova Requisição -->
                    <button class="btn btn-primary btn-icon" id="btn-open-add-requisicao"
                        title="Registrar novo abastecimento diretamente no painel">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" style="vertical-align: middle;">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Nova Requisição
                    </button>
                    <!-- Botão de Importar Planilha -->
                    <button class="btn btn-primary" id="btn-open-upload"
                        title="Carregar nova planilha Excel (.xlsx) ou CSV para atualizar a base">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" style="vertical-align: middle;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" y1="3" x2="12" y2="15" />
                        </svg>
                        Importar Planilha
                    </button>
                    <!-- Botão de Recarregar Rápido -->
                    <button class="btn btn-secondary btn-icon" id="btn-refresh"
                        title="Recarregar planilha local do disco">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2"
                            fill="none" style="vertical-align: middle;">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
                        </svg>
                        Recarregar
                    </button>
                    <!-- Botão Salvar Backup -->
                    <button class="btn btn-save btn-icon" id="btn-save-data" title="Salvar dados no cache e enviar backup">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                            <polyline points="17 21 17 13 7 13 7 21"></polyline>
                            <polyline points="7 3 7 8 15 8"></polyline>
                        </svg>
                        Salvar
                    </button>
                </div>
            </header>

            <!-- FILTROS (SLICERS INTERATIVOS) -->
            <section class="filters-section">
                <!-- Filtro Lotes -->
                <div class="filter-group">
                    <h3>Lotes de Requisição</h3>
                    <div class="slicers" id="filter-lotes">
                        <!-- Gerado dinamicamente no JS (LOTE 1 (7K), LOTE 2 (2K), LOTE 3 (15K)) -->
                    </div>
                </div>

                <!-- Filtro Bases -->
                <div class="filter-group">
                    <h3>Bases</h3>
                    <div class="slicers" id="filter-zonas">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>

                <!-- Filtro Postos -->
                <div class="filter-group">
                    <h3>Postos</h3>
                    <div class="slicers" id="filter-postos">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>

                <!-- Filtro Combustível -->
                <div class="filter-group">
                    <h3>Tipo de Combustível</h3>
                    <div class="slicers" id="filter-combustiveis">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>

                <!-- Filtro de Período -->
                <div class="filter-group date-filter-group">
                    <h3>Período de Análise</h3>
                    <div class="date-controls-trigger-wrapper">
                        <!-- Botão gatilho para abrir o painel flutuante -->
                        <button type="button" class="btn btn-secondary btn-icon" id="btn-open-calendar" style="min-width: 240px; text-align: left; justify-content: flex-start; gap: 0.5rem;">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none" style="color: var(--accent-yellow);">
                                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                                <line x1="16" y1="2" x2="16" y2="6"></line>
                                <line x1="8" y1="2" x2="8" y2="6"></line>
                                <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                            <span id="calendar-trigger-text">Todo o Período</span>
                        </button>
                        
                        <!-- Inputs ocultos para compatibilidade com a leitura do JS -->
                        <input type="date" id="date-start" style="display: none;">
                        <input type="date" id="date-end" style="display: none;">
                        
                        <!-- PAINEL DO CALENDÁRIO FLUTUANTE -->
                        <div class="calendar-dropdown" id="calendar-dropdown" style="display: none;">
                            <div class="date-presets" style="margin-bottom: 0.5rem; display: grid; grid-template-columns: 1fr 1fr; gap: 4px;">
                                <button class="preset-btn active" id="preset-all">Todo Período</button>
                                <button class="preset-btn" id="preset-today">Hoje</button>
                                <button class="preset-btn" id="preset-7d">7 dias</button>
                                <button class="preset-btn" id="preset-30d">30 dias</button>
                            </div>
                            
                            <div class="calendar-widget" id="calendar-widget">
                                <div class="calendar-header">
                                    <button type="button" class="calendar-nav-btn" id="calendar-prev-month">&lt;</button>
                                    <span class="calendar-current-month" id="calendar-month-year">Setembro 2026</span>
                                    <button type="button" class="calendar-nav-btn" id="calendar-next-month">&gt;</button>
                                </div>
                                <div class="calendar-grid">
                                    <div class="calendar-day-header">Dom</div>
                                    <div class="calendar-day-header">Seg</div>
                                    <div class="calendar-day-header">Ter</div>
                                    <div class="calendar-day-header">Qua</div>
                                    <div class="calendar-day-header">Qui</div>
                                    <div class="calendar-day-header">Sex</div>
                                    <div class="calendar-day-header">Sáb</div>
                                </div>
                                <div class="calendar-grid" id="calendar-days-container">
                                    <!-- Dias gerados dinamicamente no JS -->
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <!-- GRID DE GRÁFICOS -->
            <section class="charts-grid">
                <!-- Rosca: Gasto por Tipo de Combustível -->
                <div class="chart-card donut-card" id="card-combustivel-donut" draggable="true">
                    <div class="chart-card-header">
                        <h3 class="chart-title">GASTO POR TIPO DE COMBUSTÍVEL</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn-config-chart" onclick="toggleChartConfig(this)" title="Personalizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn-maximize-chart" onclick="toggleMaximizeChart(this)" title="Maximizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <polyline points="9 21 3 21 3 15"></polyline>
                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Painel de Configuração Flutuante -->
                    <div class="chart-config-panel" style="display: none;">
                        <h4>Personalizar</h4>
                        <div class="config-row">
                            <label>Visual:</label>
                            <select class="select-chart-type" onchange="changeChartType(this)">
                                <option value="donut">Rosca (Donut)</option>
                                <option value="pie">Pizza</option>
                                <option value="polarArea">Área Polar</option>
                            </select>
                        </div>
                        <div class="config-row checkbox-row">
                            <label><input type="checkbox" class="chk-data-labels" checked onchange="toggleChartLabels(this)"> Rótulos</label>
                            <label><input type="checkbox" class="chk-legend" checked onchange="toggleChartLegend(this)"> Legenda</label>
                        </div>
                    </div>
                    <div id="chart-combustivel-donut"></div>
                </div>

                <!-- Barra Horizontal: Ranking de Gasto por Base -->
                <div class="chart-card donut-card" id="card-zona-donut" draggable="true">
                    <div class="chart-card-header">
                        <h3 class="chart-title">RANKING DE GASTO POR BASE / POSTO</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn-config-chart" onclick="toggleChartConfig(this)" title="Personalizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l-.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn-maximize-chart" onclick="toggleMaximizeChart(this)" title="Maximizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <polyline points="9 21 3 21 3 15"></polyline>
                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Painel de Configuração Flutuante -->
                    <div class="chart-config-panel" style="display: none;">
                        <h4>Personalizar</h4>
                        <div class="config-row">
                            <label>Visual:</label>
                            <select class="select-chart-type" onchange="changeChartType(this)">
                                <option value="bar">Barra Horizontal</option>
                                <option value="bar-v">Barra Vertical</option>
                                <option value="line">Linhas</option>
                            </select>
                        </div>
                        <div class="config-row checkbox-row">
                            <label><input type="checkbox" class="chk-data-labels" checked onchange="toggleChartLabels(this)"> Rótulos</label>
                            <label><input type="checkbox" class="chk-legend" onchange="toggleChartLegend(this)"> Legenda</label>
                        </div>
                    </div>
                    <div id="chart-zona-donut"></div>
                </div>

                <!-- Barras: Gasto Mensal -->
                <div class="chart-card bar-card" id="card-gasto-mensal" draggable="true">
                    <div class="chart-card-header">
                        <h3 class="chart-title">TOTAL GASTO POR MÊS</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn-config-chart" onclick="toggleChartConfig(this)" title="Personalizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l-.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn-maximize-chart" onclick="toggleMaximizeChart(this)" title="Maximizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <polyline points="9 21 3 21 3 15"></polyline>
                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Painel de Configuração Flutuante -->
                    <div class="chart-config-panel" style="display: none;">
                        <h4>Personalizar</h4>
                        <div class="config-row">
                            <label>Visual:</label>
                            <select class="select-chart-type" onchange="changeChartType(this)">
                                <option value="bar">Barras</option>
                                <option value="line">Linhas</option>
                                <option value="area">Área</option>
                            </select>
                        </div>
                        <div class="config-row checkbox-row">
                            <label><input type="checkbox" class="chk-data-labels" checked onchange="toggleChartLabels(this)"> Rótulos</label>
                            <label><input type="checkbox" class="chk-legend" onchange="toggleChartLegend(this)"> Legenda</label>
                        </div>
                    </div>
                    <div id="chart-gasto-mensal"></div>
                </div>

                <!-- Área: Volume Mensal -->
                <div class="chart-card area-card" id="card-volume-mensal" draggable="true">
                    <div class="chart-card-header">
                        <h3 class="chart-title">VOLUME CONSUMIDO POR MÊS (LITROS)</h3>
                        <div style="display: flex; gap: 0.5rem; align-items: center;">
                            <button type="button" class="btn-config-chart" onclick="toggleChartConfig(this)" title="Personalizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <circle cx="12" cy="12" r="3"></circle>
                                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l-.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l-.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                </svg>
                            </button>
                            <button type="button" class="btn-maximize-chart" onclick="toggleMaximizeChart(this)" title="Maximizar gráfico">
                                <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2" fill="none">
                                    <polyline points="15 3 21 3 21 9"></polyline>
                                    <polyline points="9 21 3 21 3 15"></polyline>
                                    <line x1="21" y1="3" x2="14" y2="10"></line>
                                    <line x1="3" y1="21" x2="10" y2="14"></line>
                                </svg>
                            </button>
                        </div>
                    </div>
                    <!-- Painel de Configuração Flutuante -->
                    <div class="chart-config-panel" style="display: none;">
                        <h4>Personalizar</h4>
                        <div class="config-row">
                            <label>Visual:</label>
                            <select class="select-chart-type" onchange="changeChartType(this)">
                                <option value="area">Área</option>
                                <option value="line">Linhas</option>
                                <option value="bar">Barras</option>
                            </select>
                        </div>
                        <div class="config-row checkbox-row">
                            <label><input type="checkbox" class="chk-data-labels" checked onchange="toggleChartLabels(this)"> Rótulos</label>
                            <label><input type="checkbox" class="chk-legend" onchange="toggleChartLegend(this)"> Legenda</label>
                        </div>
                    </div>
                    <div id="chart-volume-mensal"></div>
                </div>
            </section>

            <!-- TABELA DETALHADA E RANKINGS DE BUSCA -->
            <section class="table-section">
                <div class="table-header">
                    <div class="table-title-group">
                        <h2>Detalhamento & Rankings</h2>
                        <span class="subtitle">Visualize lançamentos individuais ou analise rankings de consumo</span>
                    </div>
                    <div class="table-search-group" style="display: flex; gap: 0.75rem; align-items: center;">
                        <button class="btn btn-secondary btn-icon" id="btn-clear-table-filters"
                            title="Limpar todos os filtros, datas e pesquisas">
                            <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2"
                                fill="none" style="vertical-align: middle;">
                                <path
                                    d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                <line x1="10" y1="11" x2="10" y2="17" />
                                <line x1="14" y1="11" x2="14" y2="17" />
                            </svg>
                            Limpar Filtros
                        </button>
                        <div class="search-input-wrapper" style="flex: 1;">
                            <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                                stroke-width="2" fill="none">
                                <circle cx="11" cy="11" r="8"></circle>
                                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                            </svg>
                            <input type="text" id="table-search"
                                placeholder="Pesquisar requisição, motorista, placa, veículo, base...">
                        </div>
                    </div>
                </div>

                <div class="table-tabs">
                    <button class="tab-btn active" id="tab-lancamentos" data-tab="lancamentos">Lançamentos</button>
                    <button class="tab-btn" id="tab-bases" data-tab="bases">Ranking Bases</button>
                    <button class="tab-btn" id="tab-motoristas" data-tab="motoristas">Ranking Motoristas</button>
                    <button class="tab-btn" id="tab-veiculos" data-tab="veiculos">Ranking Veículos</button>
                </div>

                <div class="table-wrapper">
                    <table class="data-table" id="data-table">
                        <thead>
                            <!-- Gerado dinamicamente -->
                        </thead>
                        <tbody id="table-body">
                            <!-- Gerado dinamicamente -->
                        </tbody>
                        <tfoot id="table-footer">
                            <!-- Gerado dinamicamente -->
                        </tfoot>
                    </table>
                </div>
            </section>
            <!-- Rodapé exclusivo para impressão -->
            <div class="print-only-footer">
                Gerado pelo sistema de controle • <span class="print-generation-timestamp">-</span>
            </div>
        </main>

    </div>

    <!-- MODAL DE UPLOAD / CONFIGURAÇÃO -->
    <div class="modal-overlay" id="upload-modal">
        <div class="modal-content">
            <button class="modal-close" id="btn-close-upload">&times;</button>
            <h2>Importar Planilha de Dados</h2>
            <p>Selecione ou arraste o arquivo Excel (.xlsx) ou CSV de controle de combustível para carregar dados para o
                dashboard.</p>

            <div class="upload-mode-selector" style="margin-bottom: 1.25rem; background: rgba(0,0,0,0.25); padding: 0.85rem; border-radius: 10px; border: 1px solid var(--border-color);">
                <label style="display: block; font-size: 0.75rem; font-weight: 700; color: var(--text-muted); margin-bottom: 0.5rem; letter-spacing: 0.05em;">MODO DE IMPORTAÇÃO</label>
                <div style="display: flex; gap: 1.25rem;">
                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem; color: var(--text-primary);">
                        <input type="radio" name="upload-import-mode" value="replace" checked> 🔄 Substituir Base Atual
                    </label>
                    <label style="display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; font-size: 0.85rem; color: var(--accent-yellow); font-weight: 600;">
                        <input type="radio" name="upload-import-mode" value="append"> ➕ Adicionar / Mesclar a Dados Existentes
                    </label>
                </div>
            </div>

            <div class="drop-zone" id="drop-zone">
                <svg class="drop-icon" viewBox="0 0 24 24" width="48" height="48" stroke="currentColor"
                    stroke-width="1.5" fill="none">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <polyline points="9 15 12 12 15 15" />
                </svg>
                <p>Arraste o arquivo Excel aqui ou</p>
                <label class="btn btn-secondary" for="file-input">
                    Procurar Arquivo
                </label>
                <input type="file" id="file-input" accept=".xlsx, .csv" style="display: none;">
            </div>

            <div class="modal-footer">
                <button class="btn btn-text" id="btn-generate-mock">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none"
                        style="margin-right: 6px;">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Gerar Planilha de Teste (.xlsx)
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL DE NOTIFICAÇÃO DE ATUALIZAÇÃO (GITHUB UPDATE) -->
    <div class="modal-overlay" id="update-modal" style="display: none; z-index: 15000;">
        <div class="modal-content" style="max-width: 460px; text-align: center; border: 1px solid rgba(255, 183, 3, 0.4);">
            <div style="width: 56px; height: 56px; background: rgba(255, 183, 3, 0.12); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: var(--accent-yellow);">
                <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
            </div>
            <h2 style="font-size: 1.3rem; margin-bottom: 0.4rem;">Nova Atualização Disponível!</h2>
            <p style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 1rem;" id="update-version-label">
                Uma nova versão do Controle está disponível no GitHub.
            </p>
            <div style="background: rgba(0,0,0,0.3); padding: 0.85rem; border-radius: 8px; font-size: 0.8rem; color: var(--text-muted); text-align: left; margin-bottom: 1.25rem; max-height: 100px; overflow-y: auto;" id="update-notes-box">
                <!-- Notas de atualização -->
            </div>
            <div style="display: flex; gap: 0.75rem;">
                <button type="button" class="btn btn-secondary btn-block" id="btn-ignore-update">Agora Não</button>
                <button type="button" class="btn btn-primary btn-block" id="btn-accept-update">🚀 Baixar Atualização</button>
            </div>
        </div>
    </div>


    <!-- MODAL DE NOVA REQUISIÇÃO (FORMULÁRIO CRUD) -->
    <div class="modal-overlay" id="add-requisicao-modal">
        <div class="modal-content form-modal" style="max-width: 650px;">
            <button class="modal-close" id="btn-close-add-requisicao">&times;</button>
            <h2 id="add-requisicao-modal-title">Nova Requisição</h2>
            <p style="margin-bottom: 1.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                Preencha os campos abaixo para registrar um novo abastecimento diretamente no painel. O valor total será
                calculado automaticamente.
            </p>

            <form id="form-add-requisicao">
                <input type="hidden" id="input-edit-id" value="">
                <div class="form-grid">
                    <!-- Modo de abastecimento (Litros ou Valor) -->
                    <div class="form-group" style="grid-column: span 2;">
                        <label>Modo de Abastecimento</label>
                        <div style="display: flex; gap: 1.5rem; margin-top: 0.25rem;">
                            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; text-transform: none; font-weight: normal; color: var(--text-primary);">
                                <input type="radio" name="input-modo-abastecimento" value="litros" checked style="width: auto; margin: 0;"> Por Litros (Litragem)
                            </label>
                            <label style="display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; text-transform: none; font-weight: normal; color: var(--text-primary);">
                                <input type="radio" name="input-modo-abastecimento" value="valor" style="width: auto; margin: 0;"> Por Valor Total (R$)
                            </label>
                        </div>
                    </div>

                    <!-- Seletor de Lote -->
                    <div class="form-group">
                        <label for="input-add-lote">Lote de Origem</label>
                        <select id="input-add-lote" style="background-color: var(--bg-primary); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; width: 100%;">
                            <option value="LOTE 3 (15K)" selected>LOTE 3 (15K)</option>
                            <option value="LOTE 1 (7K)">LOTE 1 (7K)</option>
                            <option value="LOTE 2 (2K)">LOTE 2 (2K)</option>
                        </select>
                    </div>

                    <div class="form-group">
                        <label for="input-date">Data</label>
                        <input type="date" id="input-date" required>
                    </div>

                    <div class="form-group">
                        <label for="input-zona">Base</label>
                        <input type="text" id="input-zona" list="datalist-bases" placeholder="Digite ou selecione a base..." required>
                    </div>

                    <div class="form-group">
                        <label for="input-responsavel">Responsável</label>
                        <input type="text" id="input-responsavel" list="datalist-responsaveis" placeholder="Digite ou selecione o responsável..." required>
                    </div>

                    <div class="form-group">
                        <label for="input-posto">Posto</label>
                        <input type="text" id="input-posto" list="datalist-postos" placeholder="Digite ou selecione o posto..." required>
                    </div>

                    <div class="form-group">
                        <label for="input-motorista">Motorista</label>
                        <input type="text" id="input-motorista" list="datalist-motoristas" placeholder="Digite ou selecione o motorista..." required>
                    </div>

                    <div class="form-group">
                        <label for="input-veiculo">Veículo (Modelo)</label>
                        <input type="text" id="input-veiculo" list="datalist-veiculos" placeholder="Digite ou selecione o modelo...">
                    </div>

                    <div class="form-group">
                        <label for="input-placa">Placa</label>
                        <input type="text" id="input-placa" list="datalist-placas" placeholder="Digite ou selecione a placa...">
                    </div>

                    <div class="form-group">
                        <label for="input-combustivel">Tipo de Combustível</label>
                        <input type="text" id="input-combustivel" list="datalist-combustiveis" placeholder="Digite ou selecione o combustível..." required>
                    </div>

                    <div class="form-group">
                        <label for="input-km-anterior">KM Anterior</label>
                        <input type="text" id="input-km-anterior" placeholder="Sem registro">
                    </div>

                    <div class="form-group">
                        <label for="input-km">KM Atual</label>
                        <input type="text" id="input-km" placeholder="Ex: 124500">
                    </div>

                    <div class="form-group">
                        <label for="input-inicio-seq">Nº da Requisição</label>
                        <input type="text" id="input-inicio-seq" list="datalist-requisicoes" placeholder="Ex: 1787595670733-001" required>
                    </div>

                    <div class="form-group">
                        <label for="input-qtd-req">Qtd Requisições</label>
                        <input type="number" id="input-qtd-req" value="1" min="1" required>
                    </div>

                    <div class="form-group" id="group-litros">
                        <label for="input-litros">Litros por Requisição</label>
                        <div class="quick-litros-chips">
                            <button type="button" class="btn-quick-litro" data-litro="15">15L</button>
                            <button type="button" class="btn-quick-litro" data-litro="20">20L</button>
                            <button type="button" class="btn-quick-litro" data-litro="25">25L</button>
                            <button type="button" class="btn-quick-litro" data-litro="30">30L</button>
                            <button type="button" class="btn-quick-litro" data-litro="50">50L</button>
                        </div>
                        <input type="number" id="input-litros" step="0.01" min="0" placeholder="Ex: 30.00" required>
                    </div>

                    <div class="form-group" id="group-valor-total" style="display: none;">
                        <label for="input-valor-total">Valor por Requisição (R$)</label>
                        <input type="number" id="input-valor-total" step="0.01" min="0" placeholder="Ex: 218.70">
                    </div>

                    <div class="form-group">
                        <label for="input-preco-litro">Preço por Litro</label>
                        <input type="number" id="input-preco-litro" step="0.001" min="0" placeholder="Ex: 7.290" required>
                    </div>
                </div>

                <div class="form-actions"
                    style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancel-add-requisicao">Cancelar</button>
                    <button type="submit" class="btn btn-primary" id="btn-submit-add-requisicao">Salvar Requisição</button>
                </div>
            </form>
        </div>
    </div>

    <!-- MODAL DO DISPENSADOR VISUAL DE REQUISIÇÕES (SANDBOX INTEGRADA) -->
    <div class="modal-overlay" id="dispensador-modal" style="z-index: 2500;">
        <div class="modal-content" style="max-width: 1400px; width: 95vw; height: 90vh; display: flex; flex-direction: column; padding: 0; background-color: var(--bg-primary); border: 1px solid var(--border-color); overflow: hidden;">
            <button class="modal-close" id="btn-close-dispensador-modal" style="top: 1rem; right: 1.5rem; z-index: 10;">&times;</button>
            
            <div class="dispensador-modal-header" style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center; border-top-left-radius: 16px; border-top-right-radius: 16px;">
                <div>
                    <h2 style="margin: 0; color: var(--accent-yellow); font-weight: 800; display: flex; align-items: center; gap: 0.5rem; font-size: 1.35rem;">
                        ⚡ Dispensador Visual
                    </h2>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">
                        Atribuição rápida de requisições de estoque para postos, bases e motoristas.
                    </p>
                </div>
                <div style="margin-right: 3rem; display: flex; align-items: center; gap: 1rem;">
                    <span style="font-size: 0.8rem; color: var(--text-muted); font-family: var(--font-mono);" id="disp-session-counter">Entregues nesta sessão: 0 reqs</span>
                </div>
            </div>
            
            <div class="dispensador-modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.25rem; background-color: var(--bg-primary);">
                <!-- NÍVEL 1: LOTES -->
                <div class="lotes-bar" style="display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; border-radius: 14px;">
                    <div class="lotes-list" id="disp-lotes-container">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>

                <!-- NÍVEL 2: LITRAGENS (CARDS TÁTEIS) -->
                <div>
                    <div class="touch-section-title">1. Selecione a Litragem Desejada:</div>
                    <div class="litros-grid" id="disp-litros-cards-grid">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>

                <!-- NÍVEL 3: GRUPOS DE CONTROLE (PREFIXOS) -->
                <div id="disp-grupos-container" style="display: none;">
                    <div class="grupos-bar">
                        <span class="grupos-label">2. Grupo de Controle:</span>
                        <div id="disp-grupos-chips-list" style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                            <!-- Gerado dinamicamente -->
                        </div>
                    </div>
                </div>

                <!-- NÍVEL 4: MATRIZ DE TICKETS -->
                <div id="disp-tickets-container" style="display: none;">
                    <div class="tickets-section">
                        <div class="tickets-header">
                            <div class="tickets-title-group">
                                <h3 id="disp-current-group-title" style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-primary);">Sequências Disponíveis</h3>
                                <p style="margin: 0.2rem 0 0 0; font-size: 0.8rem; color: var(--text-secondary);">Clique no número para entregar a requisição ou selecione várias</p>
                            </div>
                            <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                                <input type="text" id="disp-ticket-search" class="ticket-search-input" placeholder="🔍 Buscar ticket (ex: 042)..." style="width: 180px;">
                                <button class="btn btn-secondary" id="disp-btn-select-multiple" style="font-size: 0.8rem; padding: 0.5rem 0.75rem;">
                                    Seleção Múltipla: <strong id="disp-multi-select-status" style="color: var(--text-muted);">DESLIGADA</strong>
                                </button>
                                <button class="btn btn-primary" id="disp-btn-deliver-selected" style="display: none; font-size: 0.8rem; padding: 0.5rem 0.75rem; background: linear-gradient(135deg, #ffb703, #fb8500); border: none; color: #000; font-weight: 700;">
                                    ✅ Entregar Selecionados
                                </button>
                            </div>
                        </div>
                        <div class="tickets-grid" id="disp-tickets-grid">
                            <!-- Gerado dinamicamente -->
                        </div>
                    </div>
                </div>
            </div>

            <!-- DRAWER DESLIZANTE DE ATRIBUIÇÃO (DENTRO DO MODAL) -->
            <div class="drawer-overlay" id="disp-drawer-overlay">
                <div class="drawer-panel" id="disp-drawer-panel">
                    <div class="drawer-header">
                        <h3>⚡ Confirmar Entrega</h3>
                        <button class="drawer-close-btn" id="disp-drawer-close-btn">&times;</button>
                    </div>
                    <div class="drawer-body">
                        <div class="ticket-preview-box">
                            <div class="ticket-preview-number" id="disp-drawer-ticket-number">-</div>
                            <div class="ticket-preview-litros" id="disp-drawer-ticket-litros">-</div>
                        </div>

                        <!-- 1. BASE -->
                        <div>
                            <div class="touch-section-title">1. Selecione a Base:</div>
                            <div class="touch-buttons-grid" id="disp-drawer-bases-grid">
                                <!-- Dinâmico -->
                            </div>
                        </div>

                        <!-- 2. RESPONSÁVEL -->
                        <div id="disp-drawer-container-responsavel" style="display: none;">
                            <div class="touch-section-title">2. Selecione o Responsável:</div>
                            <div class="touch-buttons-grid" id="disp-drawer-responsaveis-grid">
                                <!-- Dinâmico -->
                            </div>
                        </div>

                        <!-- 3. MOTORISTA -->
                        <div id="disp-drawer-container-motorista" style="display: none;">
                            <div class="touch-section-title">3. Selecione o Motorista / Destinatário:</div>
                            <div class="touch-buttons-grid" id="disp-drawer-motoristas-grid">
                                <!-- Dinâmico -->
                            </div>
                            <div style="margin-top: 0.5rem;">
                                <input type="text" id="disp-drawer-custom-motorista" class="ticket-search-input" placeholder="Ou digite o nome do novo motorista..." style="width: 100%;">
                            </div>
                        </div>

                        <!-- 4. VÍNCULOS E KILOMETRAGEM -->
                        <div id="disp-drawer-container-km" style="display: none; border-top: 1px solid var(--border-color); padding-top: 1rem; margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                            <div class="touch-section-title">4. Dados do Veículo & KM:</div>
                            
                            <div style="display: flex; gap: 0.5rem;">
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 2px;">Placa do Veículo</label>
                                    <input type="text" id="disp-drawer-placa" class="ticket-search-input" placeholder="ABC1D23" style="text-transform: uppercase;">
                                </div>
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 2px;">Tipo Veículo (Auto)</label>
                                    <input type="text" id="disp-drawer-veiculo" class="ticket-search-input" readonly placeholder="Veículo" style="background-color: var(--bg-primary); border-color: transparent; opacity: 0.7;">
                                </div>
                            </div>

                            <div style="display: flex; gap: 0.5rem;">
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 2px;">KM Anterior</label>
                                    <input type="number" id="disp-drawer-km-anterior" class="ticket-search-input" placeholder="Ex: 10200">
                                </div>
                                <div style="flex: 1;">
                                    <label style="font-size: 0.65rem; color: var(--text-secondary); display: block; margin-bottom: 2px;">KM Atual</label>
                                    <input type="number" id="disp-drawer-km-atual" class="ticket-search-input" placeholder="Ex: 10350">
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="drawer-footer">
                        <button class="btn btn-secondary" id="disp-drawer-btn-cancel">Cancelar</button>
                        <button class="btn btn-primary" id="disp-drawer-btn-confirm" style="background: linear-gradient(135deg, #ffb703, #fb8500); border: none; color: #000; font-weight: 700;">
                            ✅ Confirmar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- MODAL DE GERENCIAR CADASTROS (CENTRAL ESTRUTURADA) -->
    <div class="modal-overlay" id="cadastros-modal">
        <div class="modal-content" style="max-width: 780px;">
            <button class="modal-close" id="btn-close-cadastros">&times;</button>
            <h2>Central de Cadastros</h2>
            <p style="margin-bottom: 1.25rem; font-size: 0.85rem; color: var(--text-secondary);">
                Cadastre e gerencie Bases, Veículos, Postos e Lotes de Requisições com formulários estruturados.
            </p>
            
            <!-- Abas do Cadastro -->
            <div class="cadastro-tabs">
                <button type="button" class="cadastro-tab-btn active" data-tab-id="tab-cad-bases">🏢 Bases & Resp.</button>
                <button type="button" class="cadastro-tab-btn" data-tab-id="tab-cad-veiculos">🚗 Veículos & Frotas</button>
                <button type="button" class="cadastro-tab-btn" data-tab-id="tab-cad-postos">⛽ Postos & Preços</button>
                <button type="button" class="cadastro-tab-btn" data-tab-id="tab-cad-lotes">📦 Lotes de Requisições</button>
                <button type="button" class="cadastro-tab-btn" data-tab-id="tab-cad-massa">📋 Importação em Massa</button>
            </div>
            
            <!-- Conteúdo Aba 1: Bases & Responsáveis -->
            <div class="cadastro-tab-content active" id="tab-cad-bases">
                <div class="cad-form-card">
                    <h4>➕ Cadastrar Nova Base & Responsável</h4>
                    <div class="cad-form-grid">
                        <div class="form-group">
                            <label>Nome da Base / Setor</label>
                            <input type="text" id="input-new-base-nome" placeholder="Ex: NORTE 5 ou SUL 2">
                        </div>
                        <div class="form-group">
                            <label>Responsável Principal</label>
                            <input type="text" id="input-new-base-resp" placeholder="Ex: CARLOS ALBERTO">
                        </div>
                        <button type="button" class="btn btn-primary" id="btn-add-base-item">
                            Adicionar Base
                        </button>
                    </div>
                </div>

                <!-- Sub-abas / Filtro Visual por Base -->
                <div class="lotes-subtabs" id="bases-subtabs-container">
                    <!-- Gerado dinamicamente via JS -->
                </div>

                <div class="entity-list-wrapper">
                    <div class="entity-list-header">
                        <span>Bases Cadastradas (<strong id="count-cad-bases">0</strong>)</span>
                        <small style="color: var(--text-muted);">Clique no ícone para remover</small>
                    </div>
                    <div class="entity-items-container" id="list-cad-bases">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- Conteúdo Aba 2: Veículos & Placas -->
            <div class="cadastro-tab-content" id="tab-cad-veiculos" style="display: none;">
                <div class="cad-form-card">
                    <h4>➕ Cadastrar Novo Veículo / Placa</h4>
                    <div class="cad-form-grid" style="grid-template-columns: 1fr 1fr 1fr auto;">
                        <div class="form-group">
                            <label>Placa do Veículo</label>
                            <input type="text" id="input-new-veic-placa" placeholder="ABC-1234" style="text-transform: uppercase;">
                        </div>
                        <div class="form-group">
                            <label>Modelo / Tipo</label>
                            <input type="text" id="input-new-veic-tipo" placeholder="Ex: Hilux, Van, Pipa">
                        </div>
                        <div class="form-group">
                            <label>Combustível</label>
                            <select id="input-new-veic-comb">
                                <option value="Diesel">Diesel</option>
                                <option value="Gasolina">Gasolina</option>
                                <option value="Etanol">Etanol</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-primary" id="btn-add-veic-item">
                            Adicionar Veículo
                        </button>
                    </div>
                </div>

                <div class="entity-list-wrapper">
                    <div class="entity-list-header">
                        <span>Veículos e Placas (<strong id="count-cad-veiculos">0</strong>)</span>
                        <small style="color: var(--text-muted);">Vinculados ao sistema</small>
                    </div>
                    <div class="entity-items-container" id="list-cad-veiculos">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- Conteúdo Aba 3: Postos & Preços -->
            <div class="cadastro-tab-content" id="tab-cad-postos" style="display: none;">
                <div class="cad-form-card">
                    <h4>➕ Cadastrar Posto de Combustível</h4>
                    <div class="cad-form-grid">
                        <div class="form-group">
                            <label>Nome do Posto</label>
                            <input type="text" id="input-new-posto-nome" placeholder="Ex: POSTO IPIRANGA">
                        </div>
                        <div class="form-group">
                            <label>Preço Padrão do Litro (R$)</label>
                            <input type="number" id="input-new-posto-preco" step="0.001" placeholder="Ex: 7.290">
                        </div>
                        <button type="button" class="btn btn-primary" id="btn-add-posto-item">
                            Adicionar Posto
                        </button>
                    </div>
                </div>

                <div class="entity-list-wrapper">
                    <div class="entity-list-header">
                        <span>Postos Cadastrados (<strong id="count-cad-postos">0</strong>)</span>
                        <small style="color: var(--text-muted);">Tabela de preços de referência</small>
                    </div>
                    <div class="entity-items-container" id="list-cad-postos">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- Conteúdo Aba 4: Lotes de Requisições -->
            <div class="cadastro-tab-content" id="tab-cad-lotes" style="display: none;">
                <div class="cad-form-card">
                    <h4>⚡ Gerar Faixa Sequencial de Requisições para o Lote</h4>
                    <div class="cad-form-grid" style="grid-template-columns: 1fr 1fr 1fr 1fr auto;">
                        <div class="form-group">
                            <label>Identificador do Lote</label>
                            <input type="text" id="input-new-lote-nome" placeholder="Ex: LOTE 4 (10K)">
                        </div>
                        <div class="form-group">
                            <label>Código de Controle</label>
                            <input type="text" id="input-new-lote-control" placeholder="Ex: 1787595670733">
                        </div>
                        <div class="form-group">
                            <label>Sequência De -> Até</label>
                            <div style="display: flex; gap: 0.25rem;">
                                <input type="number" id="input-new-lote-start" placeholder="001" min="1" style="width: 50%;">
                                <input type="number" id="input-new-lote-end" placeholder="100" min="1" style="width: 50%;">
                            </div>
                        </div>
                        <div class="form-group">
                            <label>Litragem (L)</label>
                            <select id="input-new-lote-litros">
                                <option value="15">15 Litros</option>
                                <option value="20">20 Litros</option>
                                <option value="25">25 Litros</option>
                                <option value="30" selected>30 Litros</option>
                                <option value="50">50 Litros</option>
                            </select>
                        </div>
                        <button type="button" class="btn btn-primary" id="btn-add-lote-range">
                            Gerar Faixa
                        </button>
                    </div>
                </div>

                <!-- Sub-abas / Filtro Visual por Lotes de Requisição -->
                <div class="lotes-subtabs" id="lotes-subtabs-container">
                    <!-- Gerado dinamicamente via JS -->
                </div>

                <div class="entity-list-wrapper">
                    <div class="entity-list-header">
                        <span>Requisições em Estoque no Pool (<strong id="count-cad-reqs">0</strong> disponíveis)</span>
                        <small style="color: var(--text-muted);">Saldo disponível para entrega</small>
                    </div>
                    <div class="entity-items-container" id="list-cad-lotes">
                        <!-- Gerado dinamicamente -->
                    </div>
                </div>
            </div>

            <!-- Conteúdo Aba 5: Importação em Massa (Texto) -->
            <div class="cadastro-tab-content" id="tab-cad-massa" style="display: none;">
                <form id="form-cadastros" style="display: flex; flex-direction: column; gap: 1rem;">
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--accent-yellow); margin-bottom: 0.35rem;">Bases e Responsáveis (um por linha: <code>Base - Responsável</code>)</label>
                        <textarea id="textarea-custom-bases" rows="4" style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; font-family: monospace; font-size: 0.85rem; width: 100%; resize: vertical;"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--accent-yellow); margin-bottom: 0.35rem;">Postos e Preços (um por linha: <code>Posto - Preço</code>)</label>
                        <textarea id="textarea-custom-postos" rows="3" style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; font-family: monospace; font-size: 0.85rem; width: 100%; resize: vertical;"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--accent-yellow); margin-bottom: 0.35rem;">Veículos e Placas (um por linha: <code>Placa - Veículo</code>)</label>
                        <textarea id="textarea-custom-veiculos" rows="4" style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; font-family: monospace; font-size: 0.85rem; width: 100%; resize: vertical;"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--accent-yellow); margin-bottom: 0.35rem;">Requisições em Estoque (um por linha: <code>Código-Seq - Litros (Lote)</code>)</label>
                        <textarea id="textarea-custom-requisicoes" rows="4" style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; font-family: monospace; font-size: 0.85rem; width: 100%; resize: vertical;"></textarea>
                    </div>
                    <div class="form-group">
                        <label style="font-weight: 700; color: var(--accent-yellow); margin-bottom: 0.35rem;">Motoristas (um por linha - opcional: <code>Base - Motorista</code>)</label>
                        <textarea id="textarea-custom-motoristas" rows="3" style="background-color: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-color); border-radius: 8px; color: var(--text-primary); padding: 0.6rem; font-family: monospace; font-size: 0.85rem; width: 100%; resize: vertical;"></textarea>
                    </div>
                    <button type="submit" class="btn btn-primary" style="align-self: flex-end;">Salvar Todas as Listas de Texto</button>
                </form>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                <button type="button" class="btn-delete-active-lote" id="btn-reset-hml-db" onclick="resetHmlDatabase()" title="Limpar e Reinicializar o banco de dados HML para validação limpa" style="display: none;">
                    🔄 Zerar Banco HML (Limpeza de Testes)
                </button>
                <button type="button" class="btn btn-secondary" id="btn-cancel-cadastros">Fechar Central</button>
            </div>
        </div>
    </div>

    <!-- Overlay de Gráficos Maximizados -->
    <div class="chart-overlay" id="chart-overlay"></div>

    <!-- MODAL DE INFOGRÁFICO -->
    <div class="modal-overlay" id="infografico-modal">
        <div class="modal-content infografico-content" style="max-width: 700px; padding: 0;">
            <!-- Botão fechar -->
            <button class="modal-close" id="btn-close-infografico" style="top: 1rem; right: 1rem;">&times;</button>
            
            <!-- Área imprimível do Infográfico -->
            <div id="print-infografico-area" class="infografico-print-wrapper">
                <div class="info-header" style="position: relative;">
                    <!-- Botão de impressão rápido no topo, ocultado na impressão -->
                    <button class="btn btn-secondary btn-icon btn-print-top" id="btn-print-infografico-top" title="Imprimir Infográfico" style="position: absolute; right: 0; top: 0; padding: 0.4rem 0.6rem; border-color: rgba(255, 255, 255, 0.15);">
                        <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" stroke-width="2.5" fill="none" style="vertical-align: middle;">
                            <polyline points="6 9 6 2 18 2 18 9"></polyline>
                            <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                            <rect x="6" y="14" width="12" height="8"></rect>
                        </svg>
                    </button>
                    <h2>Controle de Requisições - MGP</h2>
                    <p>Infográfico de Consumo & Abastecimento</p>
                    <div class="info-period" id="info-period-text">Período: -</div>
                </div>
                
                <div class="info-grid-kpis">
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Total Gasto</span>
                        <span class="info-kpi-val" id="info-kpi-gasto">R$ 0,00</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Volume Consumido</span>
                        <span class="info-kpi-val" id="info-kpi-litros">0 L</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Preço Médio</span>
                        <span class="info-kpi-val" id="info-kpi-preco-medio">R$ 0,00</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Requisições</span>
                        <span class="info-kpi-val" id="info-kpi-req">0</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>PARTICIPAÇÃO POR COMBUSTÍVEL</h3>
                    <div class="info-chart-list" id="info-combustivel-bars">
                        <!-- Gerado dinamicamente no JS -->
                    </div>
                </div>
                
                <div class="info-section">
                    <h3>GASTO POR BASE / POSTO</h3>
                    <div class="info-chart-list" id="info-zona-bars">
                        <!-- Gerado dinamicamente no JS -->
                    </div>
                </div>
                
                <div class="info-section grid-2-col">
                    <div>
                        <h3>Maior Consumo (Responsável)</h3>
                        <div class="leader-box">
                            <span class="leader-title" id="info-leader-motorista">-</span>
                            <span class="leader-subtitle" id="info-leader-motorista-val">R$ 0,00</span>
                        </div>
                    </div>
                    <div>
                        <h3>Maior Consumo (Veículo)</h3>
                        <div class="leader-box">
                            <span class="leader-title" id="info-leader-veiculo">-</span>
                            <span class="leader-subtitle" id="info-leader-veiculo-val">R$ 0,00</span>
                        </div>
                    </div>
                </div>

                <div class="info-footer-brand" id="info-footer-brand-text">
                    Gerado pelo sistema de controle • <span id="info-generation-timestamp">-</span>
                </div>
            </div>

            <!-- Ações do Modal (Não aparecem na impressão) -->
            <div class="info-modal-actions">
                <button class="btn btn-secondary" id="btn-cancel-infografico">Fechar</button>
                <button class="btn btn-primary" id="btn-print-infografico">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Imprimir / Salvar PDF
                </button>
            </div>
        </div>
    </div>

    <!-- MODAL DE RELATÓRIO SIMPLIFICADO -->
    <div class="modal-overlay" id="relatorio-simplificado-modal">
        <div class="modal-content relatorio-simplificado-content" style="max-width: 780px; padding: 0;">
            <!-- Ações do topo do modal (Impressão rápida e Fechar) sem conflito -->
            <div class="modal-top-actions" style="position: absolute; right: 1.25rem; top: 1.25rem; z-index: 10; display: flex; align-items: center; gap: 0.5rem;">
                <button class="btn btn-secondary btn-icon btn-print-top" id="btn-print-relatorio-simplificado-top" title="Imprimir Relatório" style="padding: 0.4rem 0.65rem; border-color: rgba(255, 255, 255, 0.15); display: inline-flex; align-items: center; justify-content: center;">
                    <svg viewBox="0 0 24 24" width="15" height="15" stroke="currentColor" stroke-width="2.2" fill="none" style="vertical-align: middle;">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                </button>
                <button class="modal-close" id="btn-close-relatorio-simplificado" style="position: static; font-size: 1.5rem; line-height: 1; padding: 0.35rem 0.65rem;">&times;</button>
            </div>
            
            <!-- Área imprimível do Relatório -->
            <div id="print-relatorio-simplificado-area" class="relatorio-simplificado-print-wrapper">
                <div class="info-header" style="text-align: center;">
                    <h2>Controle de Requisições - MGP</h2>
                    <p>Relatório Simplificado de Consumo</p>
                    <div class="info-period" id="rel-period-text">Período: -</div>
                </div>
                
                <div class="info-grid-kpis" style="grid-template-columns: repeat(4, 1fr);">
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Qtd. de Responsáveis</span>
                        <span class="info-kpi-val" id="rel-kpi-responsaveis">0</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Requisições Disponíveis</span>
                        <span class="info-kpi-val" id="rel-kpi-disponiveis">0</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Requisições Distribuídas</span>
                        <span class="info-kpi-val" id="rel-kpi-distribuidas">0</span>
                    </div>
                    <div class="info-kpi-card">
                        <span class="info-kpi-label">Volume Total (Litros)</span>
                        <span class="info-kpi-val" id="rel-kpi-litros-total">0 L</span>
                    </div>
                </div>
                
                <div class="info-section">
                    <h3 style="text-align: center;">RESUMO DE CONSUMO POR RESPONSÁVEL</h3>
                    <table class="relatorio-simplificado-table">
                        <thead>
                            <tr>
                                <th>Responsável</th>
                                <th style="text-align: center;">Qtd. Requisições</th>
                                <th style="text-align: center;">Volume (Litros)</th>
                                <th style="text-align: center;">Participação (%)</th>
                            </tr>
                        </thead>
                        <tbody id="rel-responsavel-tbody">
                            <!-- Gerado dinamicamente no JS -->
                        </tbody>
                        <tfoot id="rel-responsavel-tfoot">
                            <!-- Totais gerados dinamicamente no JS -->
                        </tfoot>
                    </table>
                </div>

                <div class="info-footer-brand" id="rel-footer-brand-text">
                    Gerado pelo sistema de controle • <span id="rel-generation-timestamp">-</span>
                </div>
            </div>

            <!-- Ações do Modal (Não aparecem na impressão) -->
            <div class="info-modal-actions">
                <button class="btn btn-secondary" id="btn-cancel-relatorio-simplificado">Fechar</button>
                <button class="btn btn-primary" id="btn-print-relatorio-simplificado">
                    <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                        <polyline points="6 9 6 2 18 2 18 9"></polyline>
                        <path d="M6 18H4a2 2 0 0 0-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
                        <rect x="6" y="14" width="12" height="8"></rect>
                    </svg>
                    Imprimir / Salvar PDF
                </button>
            </div>
        </div>
    </div>

    <!-- Modal de Gerenciar Ambientes -->
    <div class="modal-overlay" id="manage-envs-modal">
        <div class="modal-content" style="max-width: 450px; background-color: var(--bg-secondary); border-radius: 12px; padding: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                <h3 style="color: var(--text-primary); font-size: 1.25rem; margin: 0;">Gerenciar Frotas</h3>
                <button class="modal-close" id="btn-close-manage-envs" style="line-height: 1;">&times;</button>
            </div>
            
            <div style="margin-bottom: 1.5rem;">
                <label style="font-weight: 700; color: var(--accent-yellow); font-size: 0.85rem; display: block; margin-bottom: 0.5rem;">Criar Novo Ambiente / Frota</label>
                <div style="display: flex; gap: 0.5rem;">
                    <input type="text" id="input-new-env-name" placeholder="Ex: Frota B" style="flex: 1; padding: 0.6rem; border-radius: 8px; border: 1px solid var(--border-color); background-color: rgba(0, 0, 0, 0.2); color: var(--text-primary); outline: none;">
                    <button type="button" class="btn btn-primary" id="btn-create-env" style="padding: 0.6rem 1.2rem;">Criar</button>
                </div>
            </div>

            <hr style="border: 0; border-top: 1px solid var(--border-color); margin: 1.5rem 0;">

            <div>
                <label style="font-weight: 700; color: var(--accent-yellow); font-size: 0.85rem; display: block; margin-bottom: 0.5rem;">Ações para o Ambiente Atual</label>
                <div style="display: flex; gap: 0.5rem; justify-content: space-between;">
                    <button type="button" class="btn btn-secondary" id="btn-rename-active-env" style="flex: 1; padding: 0.6rem;">Renomear</button>
                    <button type="button" class="btn btn-danger" id="btn-delete-active-env" style="flex: 1; background-color: var(--accent-red); color: white; padding: 0.6rem;">Excluir</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Datalists para Autocomplete do Formulário de Nova Requisição -->
    <datalist id="datalist-bases"></datalist>
    <datalist id="datalist-responsaveis"></datalist>
    <datalist id="datalist-postos"></datalist>
    <datalist id="datalist-motoristas"></datalist>
    <datalist id="datalist-veiculos"></datalist>
    <datalist id="datalist-placas"></datalist>
    <datalist id="datalist-requisicoes"></datalist>
    <datalist id="datalist-combustiveis"></datalist>

    <!-- Script principal da aplicação -->
    <script src="app.js?v=55" defer></script>
</body>
</html>