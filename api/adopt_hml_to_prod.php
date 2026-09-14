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
        'message' => 'Parâmetro de confirmação ausente. Utilize ?confirm=true para autorizar a migração de HML para PROD.'
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $timestamp = date('Ymd_His');

    // 1. Criar tabelas de backup prévio de segurança em PROD
    $backupRequisicoes = "prod_backup_requisicoes_{$timestamp}";
    $backupConfiguracoes = "prod_backup_configuracoes_{$timestamp}";
    $backupVeiculos = "prod_backup_veiculos_{$timestamp}";

    $pdo->exec("CREATE TABLE IF NOT EXISTS $backupRequisicoes LIKE requisicoes");
    $pdo->exec("INSERT INTO $backupRequisicoes SELECT * FROM requisicoes");

    $pdo->exec("CREATE TABLE IF NOT EXISTS $backupConfiguracoes LIKE configuracoes");
    $pdo->exec("INSERT INTO $backupConfiguracoes SELECT * FROM configuracoes");

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS $backupVeiculos LIKE veiculos_contratados");
        $pdo->exec("INSERT INTO $backupVeiculos SELECT * FROM veiculos_contratados");
    } catch (Exception $eVeicBackup) {}

    // 2. Garantir coluna 'lote' na tabela requisicoes de PROD se ainda não existir
    try {
        $pdo->exec("ALTER TABLE requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
    } catch (Exception $eCol) {}

    // 3. Executar migração HML -> PROD
    $pdo->beginTransaction();

    // 3.1. Migração de Requisições
    $pdo->exec("DELETE FROM requisicoes");
    $pdo->exec("INSERT INTO requisicoes SELECT * FROM hml_requisicoes");

    // 3.2. Migração de Configurações (Bases, Postos, Motoristas, Veículos e Estoque Dispensador LOTE 3)
    $pdo->exec("DELETE FROM configuracoes");
    $pdo->exec("INSERT INTO configuracoes (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes) 
                SELECT environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM hml_configuracoes");

    // 3.3. Migração de Veículos Contratados (se houver dados em hml_veiculos_contratados)
    try {
        $pdo->exec("DELETE FROM veiculos_contratados");
        $pdo->exec("INSERT INTO veiculos_contratados SELECT * FROM hml_veiculos_contratados");
    } catch (Exception $eVeicMigrate) {}

    if ($pdo->inTransaction()) {
        $pdo->commit();
    }

    // 4. Contagens e auditoria
    $countReq = $pdo->query("SELECT COUNT(*) FROM requisicoes")->fetchColumn();
    $countConf = $pdo->query("SELECT COUNT(*) FROM configuracoes")->fetchColumn();
    $countVeic = $pdo->query("SELECT COUNT(*) FROM veiculos_contratados")->fetchColumn();

    writeAuditLog($pdo, 'ADOPT_HML_TO_PROD', [
        'requisicoes_migradas' => (int)$countReq,
        'configuracoes_migradas' => (int)$countConf,
        'veiculos_migrados' => (int)$countVeic,
        'backup_tables' => [
            $backupRequisicoes,
            $backupConfiguracoes,
            $backupVeiculos
        ]
    ], 'Producao');

    echo json_encode([
        'success' => true,
        'message' => 'Migração de HML para PRODUÇÃO concluída com êxito absoluto!',
        'environment' => 'PRODUCAO',
        'metrics' => [
            'total_requisicoes_prod' => (int)$countReq,
            'total_configuracoes_prod' => (int)$countConf,
            'total_veiculos_prod' => (int)$countVeic
        ],
        'backups_gerados' => [
            'requisicoes' => $backupRequisicoes,
            'configuracoes' => $backupConfiguracoes,
            'veiculos' => $backupVeiculos
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
        'error' => 'Falha durante a migração HML -> PROD: ' . $e->getMessage()
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
