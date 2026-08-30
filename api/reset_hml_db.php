<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

// Verificação estrita de segurança: só permite execução se estiver no diretório /hml/
if (!$isHml) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Acesso negado. A reinicialização só é permitida no ambiente de Homologação (/hml/).'
    ]);
    exit;
}

$empty = isset($_GET['empty']) && $_GET['empty'] === 'true';

try {
    // 1. Limpar e Clonar tabela de requisições PROD para HML
    $pdo->exec("DROP TABLE IF EXISTS hml_requisicoes");
    $pdo->exec("CREATE TABLE hml_requisicoes LIKE requisicoes");
    if (!$empty) {
        $pdo->exec("INSERT INTO hml_requisicoes SELECT * FROM requisicoes");
    }
    try {
        $pdo->exec("ALTER TABLE hml_requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
    } catch (Exception $e) {}

    // 2. Limpar e Clonar tabela de configurações PROD para HML
    $pdo->exec("DROP TABLE IF EXISTS hml_configuracoes");
    $pdo->exec("CREATE TABLE hml_configuracoes LIKE configuracoes");
    if (!$empty) {
        $pdo->exec("INSERT INTO hml_configuracoes SELECT * FROM configuracoes");
    }

    // 3. Limpar e Clonar tabela de veículos contratados PROD para HML
    $pdo->exec("DROP TABLE IF EXISTS hml_veiculos_contratados");
    $pdo->exec("CREATE TABLE hml_veiculos_contratados LIKE veiculos_contratados");
    if (!$empty) {
        $pdo->exec("INSERT INTO hml_veiculos_contratados SELECT * FROM veiculos_contratados");
    }

    // 4. Limpar / Reinicializar logs de atividade HML
    $pdo->exec("DROP TABLE IF EXISTS hml_activity_logs");
    $pdo->exec("CREATE TABLE hml_activity_logs LIKE activity_logs");

    // Registrar log da operação
    $actionName = $empty ? 'RESET_HML_DATABASE_EMPTY' : 'CLONE_PROD_TO_HML_DATABASE';
    $actionMsg = $empty ? 'Banco HML reinicializado vazio' : 'Banco HML sincronizado com dados de produção';
    writeAuditLog($pdo, $actionName, ['msg' => $actionMsg], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => 'Banco de dados de Homologação (HML) reinicializado com sucesso! Todas as tabelas de teste estão limpas e prontas para validação.'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro ao reinicializar banco de dados HML: ' . $e->getMessage()
    ]);
}
