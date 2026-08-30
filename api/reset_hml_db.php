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

try {
    // 1. Limpar / Reinicializar tabela de requisições HML
    $pdo->exec("DROP TABLE IF EXISTS hml_requisicoes");
    $pdo->exec("CREATE TABLE hml_requisicoes LIKE requisicoes");
    try {
        $pdo->exec("ALTER TABLE hml_requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
    } catch (Exception $e) {}

    // 2. Limpar / Reinicializar tabela de configurações HML
    $pdo->exec("DROP TABLE IF EXISTS hml_configuracoes");
    $pdo->exec("CREATE TABLE hml_configuracoes LIKE configuracoes");

    // 3. Limpar / Reinicializar tabela de veículos contratados HML
    $pdo->exec("DROP TABLE IF EXISTS hml_veiculos_contratados");
    $pdo->exec("CREATE TABLE hml_veiculos_contratados LIKE veiculos_contratados");

    // 4. Limpar / Reinicializar logs de atividade HML
    $pdo->exec("DROP TABLE IF EXISTS hml_activity_logs");
    $pdo->exec("CREATE TABLE hml_activity_logs LIKE activity_logs");

    // Registrar log da operação
    writeAuditLog($pdo, 'RESET_HML_DATABASE', ['msg' => 'Banco HML reinicializado'], 'Homologacao');

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
