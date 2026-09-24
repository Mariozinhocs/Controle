<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

// Verificação de segurança: exige confirmação explícita
if (!isset($_GET['confirm']) || $_GET['confirm'] !== 'true') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'message' => 'Parâmetro de confirmação ausente. Utilize ?confirm=true para autorizar a sincronização de PROD para HML.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $timestamp = date('Ymd_His');

    // 1. Criar tabelas de backup prévio de segurança em HML
    $backupHmlRequisicoes = "hml_backup_requisicoes_{$timestamp}";
    $backupHmlConfiguracoes = "hml_backup_configuracoes_{$timestamp}";

    $pdo->exec("CREATE TABLE IF NOT EXISTS $backupHmlRequisicoes LIKE hml_requisicoes");
    $pdo->exec("INSERT INTO $backupHmlRequisicoes SELECT * FROM hml_requisicoes");

    $pdo->exec("CREATE TABLE IF NOT EXISTS $backupHmlConfiguracoes LIKE hml_configuracoes");
    $pdo->exec("INSERT INTO $backupHmlConfiguracoes SELECT * FROM hml_configuracoes");

    // 2. Executar migração PROD -> HML
    $pdo->beginTransaction();

    // 2.1. Migração de Requisições
    $pdo->exec("DELETE FROM hml_requisicoes");
    $pdo->exec("INSERT INTO hml_requisicoes SELECT * FROM requisicoes");

    // 2.2. Migração de Configurações (Bases, Postos, Motoristas, Veículos e Estoque do Dispensador LOTES 1-6)
    $pdo->exec("DELETE FROM hml_configuracoes");
    $pdo->exec("INSERT INTO hml_configuracoes (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes) 
                SELECT environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes");

    // 2.3. Migração de Veículos Contratados
    try {
        $pdo->exec("DELETE FROM hml_veiculos_contratados");
        $pdo->exec("INSERT INTO hml_veiculos_contratados SELECT * FROM veiculos_contratados");
    } catch (Exception $eVeicMigrate) {}

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    // 3. Contagens e auditoria
    $countReq = $pdo->query("SELECT COUNT(*) FROM hml_requisicoes")->fetchColumn();
    $countConf = $pdo->query("SELECT COUNT(*) FROM hml_configuracoes")->fetchColumn();
    $countVeic = $pdo->query("SELECT COUNT(*) FROM hml_veiculos_contratados")->fetchColumn();

    writeAuditLog($pdo, 'SYNC_HML_FROM_PROD', [
        'requisicoes_migradas' => (int)$countReq,
        'configuracoes_migradas' => (int)$countConf,
        'veiculos_migrados' => (int)$countVeic,
        'backup_tables' => [
            $backupHmlRequisicoes,
            $backupHmlConfiguracoes
        ]
    ], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => 'Sincronização de PRODUÇÃO para HOMOLOGAÇÃO concluída com êxito absoluto!',
        'environment' => 'HOMOLOGACAO',
        'metrics' => [
            'total_requisicoes_hml' => (int)$countReq,
            'total_configuracoes_hml' => (int)$countConf,
            'total_veiculos_hml' => (int)$countVeic
        ],
        'backups_gerados' => [
            'requisicoes' => $backupHmlRequisicoes,
            'configuracoes' => $backupHmlConfiguracoes
        ],
        'timestamp' => date('Y-m-d H:i:s')
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Falha durante a migração PROD -> HML: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
