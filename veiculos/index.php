<?php
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Expires: Mon, 26 Jul 1997 05:00:00 GMT");
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <script>
        // Captura global de erros para depuração visual em homologação
        window.onerror = function(message, source, lineno, colno, error) {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) overlay.style.display = 'none';
            const errorDiv = document.createElement('div');
            errorDiv.style.position = 'fixed';
            errorDiv.style.top = '0'; errorDiv.style.left = '0';
            errorDiv.style.width = '100%'; errorDiv.style.height = '100%';
            errorDiv.style.backgroundColor = 'rgba(0,0,0,0.95)';
            errorDiv.style.color = '#ff4d4d'; errorDiv.style.padding = '2rem';
            errorDiv.style.zIndex = '999999'; errorDiv.style.fontFamily = 'monospace';
            
            errorDiv.innerHTML = '<h2 style="margin-top:0;">🚨 Erro de Sistema (Veículos Contratados)</h2>' +
                '<p><strong>Mensagem:</strong> ' + message + '</p>' +
                '<p><strong>Arquivo:</strong> ' + source + '</p>' +
                '<p><strong>Linha:</strong> ' + lineno + ' | <strong>Coluna:</strong> ' + colno + '</p>' +
                '<p><strong>Stack Trace:</strong><br><pre style="background:#222;color:#eee;padding:1rem;border-radius:6px;margin-top:0.5rem;white-space:pre-wrap;font-size:12px;">' + (error ? error.stack : 'N/A') + '</pre></p>' +
                '<button onclick="window.location.reload(true)" style="background:#ff4d4d;color:#fff;border:none;padding:0.75rem 1.5rem;font-size:14px;border-radius:6px;cursor:pointer;margin-top:1rem;font-weight:bold;">Recarregar Página</button>';
            document.body.appendChild(errorDiv);
            return false;
        };
    </script>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Veículos Contratados - MGP</title>
    <link rel="icon" type="image/png" href="../app_icon.png">
    <link rel="stylesheet" href="../styles.css">
    <link rel="stylesheet" href="styles.css">
    
    <!-- Bibliotecas Locais para funcionamento Offline -->
    <script src="../libs/xlsx.mini.min.js"></script>
    <script src="../libs/apexcharts.js"></script>
</head>
<body>
    <!-- SPLASH SCREEN DE INICIALIZAÇÃO NATIVA -->
    <div class="splash-screen" id="splash-screen">
        <div class="splash-content">
            <div class="splash-logo-wrap">
                <img src="../app_icon.png" alt="Controle Logo" class="splash-logo-img">
            </div>
            <h1 class="splash-title">VEÍCULOS CONTRATADOS</h1>
            <p class="splash-subtitle">MGP • Gestão de Contratos & Atuação</p>
            <div class="splash-progress-bar">
                <div class="splash-progress-fill" id="splash-progress-fill"></div>
            </div>
            <span class="splash-status-text" id="splash-status-text">Inicializando Módulo de Veículos...</span>
        </div>
    </div>

    <!-- OVERLAY DE VALIDAÇÃO DE CHAVE DE ACESSO (GITHUB LICENSE - Compartilhada via localStorage) -->
    <div class="license-overlay" id="license-overlay" style="display: none;">
        <div class="license-card">
            <div class="license-header">
                <div class="license-icon-wrap">
                    <img src="../app_icon.png" alt="Controle Icon" style="width: 44px; height: 44px; border-radius: 8px;">
                </div>
                <h2>Autenticação de Acesso</h2>
                <p>Insira a Chave de Licença para liberar a utilização do <strong>Controle de Veículos Contratados</strong>.</p>
            </div>
            <form id="license-form" class="license-form" onsubmit="return false;">
                <div class="license-input-group">
                    <label for="license-key-input">CHAVE DE ACESSO</label>
                    <input type="text" id="license-key-input" placeholder="CTRL-XXXX-YYYY-ZZZZ" autocomplete="off" required style="width:100%; padding:0.75rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; text-transform:uppercase;">
                    <span class="license-status-msg" id="license-status-msg"></span>
                </div>
                <div class="license-actions" style="margin-top:1.25rem;">
                    <button type="submit" class="btn btn-primary btn-block" id="btn-validate-license">
                        Validar Acesso
                    </button>
                </div>
            </form>
        </div>
    </div>

    <!-- OVERLAY DE CARREGAMENTO (LOADING SPINNER) -->
    <div class="loading-overlay" id="loading-overlay">
        <div class="spinner"></div>
        <span class="loading-text">Buscando informações dos contratos...</span>
    </div>

    <div class="app-container" id="app-container">
        <!-- SIDEBAR LATERAL -->
        <aside class="sidebar" id="sidebar">
            <div class="logo-container">
                <div class="logo-brand">
                    <img src="../app_icon.png" alt="Controle Icon" class="logo-img-icon">
                    <h2 class="logo-text">Contratos</h2>
                </div>
                <button class="btn-sidebar-toggle" id="btn-toggle-sidebar" title="Contrair / Expandir Barra Lateral">
                    <svg id="sidebar-toggle-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                </button>
            </div>
            
            <div class="kpi-group">
                <div class="kpi-card highlight-card" id="kpi-total-contratados">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">FROTA CONTRATADA</span>
                </div>
                <div class="kpi-card" id="kpi-total-alugados">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">VEÍCULOS ALUGADOS</span>
                </div>
                <div class="kpi-card" id="kpi-total-cedidos">
                    <span class="kpi-value">0</span>
                    <span class="kpi-label">VEÍCULOS CEDIDOS</span>
                </div>
                <div class="kpi-card" id="kpi-total-gasto">
                    <span class="kpi-value">R$ 0,00</span>
                    <span class="kpi-label">INVESTIDO MENSAL</span>
                </div>
            </div>

            <div class="sidebar-signature">
                <p class="sig-author">Desenvolvido por MzN</p>
                <p class="sig-quote">"si vis pacem para bellum"</p>
            </div>
        </aside>

        <!-- CONTEÚDO PRINCIPAL -->
        <main class="main-content">
            <header class="header">
                <div class="header-title">
                    <h1 id="page-main-title">Controle de Veículos Contratados</h1>
                    <div class="header-meta">
                        <span class="subtitle">Gestão de proprietários, atuação e consumo agregados</span>
                    </div>
                </div>
                <div class="header-actions" style="display:flex; gap:0.5rem;">
                    <!-- Botão Voltar para o Dashboard Principal -->
                    <button class="btn btn-secondary btn-icon" id="btn-back-dashboard" title="Voltar para o Painel de Combustível">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle; margin-right:4px;">
                            <polyline points="15 18 9 12 15 6"></polyline>
                        </svg>
                        Painel Combustível
                    </button>
                    <!-- Exportar Excel -->
                    <button class="btn btn-secondary btn-icon" id="btn-export-excel" title="Exportar veículos contratados para Excel">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="7 10 12 15 17 10" />
                            <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        Exportar Excel
                    </button>
                    <!-- Novo Cadastro -->
                    <button class="btn btn-primary btn-icon" id="btn-open-cadastro" title="Cadastrar novo veículo contratado">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="vertical-align: middle;">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Cadastrar Veículo
                    </button>
                </div>
            </header>

            <!-- GRÁFICOS DO SUBSISTEMA -->
            <section class="charts-grid" style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem; margin-bottom: 1.5rem;">
                <div class="chart-card">
                    <h3 class="chart-title">PROPORÇÃO DE CONTRATOS</h3>
                    <div id="chart-contrato-donut"></div>
                </div>
                <div class="chart-card">
                    <h3 class="chart-title">TIPO DE VEÍCULOS POR COMBUSTÍVEL</h3>
                    <div id="chart-combustivel-bar"></div>
                </div>
            </section>

            <!-- TABELA DETALHADA -->
            <section class="table-section">
                <div class="table-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem;">
                    <h2>Veículos & Locadoras</h2>
                    <div class="search-input-wrapper" style="position:relative; width: 300px;">
                        <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" stroke-width="2" fill="none" style="position:absolute; left:10px; top:12px; color:var(--text-secondary);">
                            <circle cx="11" cy="11" r="8"></circle>
                            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                        </svg>
                        <input type="text" id="table-search" placeholder="Pesquisar..." style="width:100%; padding:0.6rem 1rem 0.6rem 2.2rem; border-radius:8px; background:rgba(255,255,255,0.05); border:1px solid var(--border-color); color:var(--text-primary); outline:none;">
                    </div>
                </div>

                <div class="table-tabs" style="display: flex; gap: 0.5rem; border-bottom: 1px solid var(--border-color); margin-bottom: 1rem;">
                    <button class="tab-btn active" id="tab-veiculos" data-tab="veiculos">Relação de Veículos</button>
                    <button class="tab-btn" id="tab-empresas" data-tab="empresas">Relação de Empresas</button>
                </div>

                <div class="table-wrapper">
                    <table class="data-table">
                        <thead id="table-head">
                            <!-- Gerado dinamicamente -->
                        </thead>
                        <tbody id="table-body">
                            <!-- Gerado dinamicamente -->
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    </div>

    <!-- MODAL DE CADASTRO / EDIÇÃO -->
    <div class="modal-overlay" id="cadastro-modal">
        <div class="modal-content" style="max-width: 600px;">
            <button class="modal-close" id="btn-close-cadastro">&times;</button>
            <h2 id="modal-title">Cadastrar Veículo Contratado</h2>
            <p>Insira as especificações contratuais e do motorista responsável.</p>
            
            <form id="form-cadastro" style="margin-top:1.5rem;">
                <input type="hidden" id="input-id">
                
                <div style="display:grid; grid-template-columns: 1.5fr 0.5fr; gap:1rem; margin-bottom:1rem;">
                    <div class="form-group">
                        <label for="input-tipo-veiculo">TIPO DE VEÍCULO *</label>
                        <input type="text" id="input-tipo-veiculo" placeholder="Ex: ÔNIBUS 44 LUGARES" required style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                    <div class="form-group">
                        <label for="input-ano">ANO</label>
                        <input type="text" id="input-ano" placeholder="Ex: 2020" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div class="form-group">
                        <label for="input-placa">PLACA *</label>
                        <input type="text" id="input-placa" placeholder="Ex: JXU-7037" required style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; text-transform:uppercase; outline:none;">
                    </div>
                    <div class="form-group">
                        <label for="input-empresa">EMPRESA *</label>
                        <input type="text" id="input-empresa" placeholder="Ex: DANTAS" required style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div class="form-group">
                        <label for="input-motorista">MOTORISTA</label>
                        <input type="text" id="input-motorista" placeholder="Nome do motorista" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                    <div class="form-group">
                        <label for="input-fone-motorista">FONE DO MOTORISTA</label>
                        <input type="text" id="input-fone-motorista" placeholder="(92) 99999-9999" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1rem;">
                    <div class="form-group">
                        <label for="input-local-atuacao">LOCAL DE ATUAÇÃO</label>
                        <input type="text" id="input-local-atuacao" placeholder="Ex: Base Manaus" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                    <div class="form-group">
                        <label for="input-valor-contrato">VALOR MENSAL DO CONTRATO (R$)</label>
                        <input type="number" step="0.01" id="input-valor-contrato" placeholder="0.00" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; outline:none;">
                    </div>
                </div>

                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:1rem; margin-bottom:1.5rem;">
                    <div class="form-group">
                        <label for="input-tipo-contrato">CEDIDO / ALUGADO</label>
                        <select id="input-tipo-contrato" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; cursor:pointer; outline:none;">
                            <option value="ALUGADO">ALUGADO</option>
                            <option value="CEDIDO">CEDIDO</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label for="input-combustivel">COMBUSTÍVEL</label>
                        <select id="input-combustivel" style="width:100%; padding:0.6rem; border-radius:6px; background:#222; border:1px solid #444; color:#fff; cursor:pointer; outline:none;">
                            <option value="DIESEL">DIESEL</option>
                            <option value="GASOLINA">GASOLINA</option>
                            <option value="ETANOL">ETANOL</option>
                        </select>
                    </div>
                </div>

                <div style="display:flex; justify-content:flex-end; gap:0.5rem;">
                    <button type="button" class="btn btn-secondary" id="btn-cancelar-cadastro">Cancelar</button>
                    <button type="submit" class="btn btn-primary" id="btn-salvar-cadastro">Salvar Registro</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Script de lógica específica -->
    <script src="veiculos.js?v=3" defer></script>
</body>
</html>
