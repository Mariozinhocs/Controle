<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    // 1. hml_configuracoes summary
    $stmtConfig = $pdo->query("SELECT environment, 
        CHAR_LENGTH(custom_bases) as bases_len, 
        CHAR_LENGTH(custom_postos) as postos_len, 
        CHAR_LENGTH(custom_motoristas) as mot_len, 
        CHAR_LENGTH(custom_veiculos) as veic_len, 
        CHAR_LENGTH(custom_requisicoes) as req_len 
        FROM $table_configuracoes");
    $configRows = $stmtConfig->fetchAll(PDO::FETCH_ASSOC);

    // 2. hml_requisicoes summary
    $stmtReq = $pdo->query("SELECT COUNT(*) as total_requisicoes FROM $table_requisicoes");
    $reqCount = $stmtReq->fetchColumn();

    // 3. hml_veiculos_contratados summary
    $stmtVeic = $pdo->query("SELECT COUNT(*) as total_veiculos_contratados FROM $table_veiculos_contratados");
    $veicCount = $stmtVeic->fetchColumn();

    echo json_encode([
        'success' => true,
        'environment_mode' => $isHml ? 'HML' : 'PROD',
        'table_configuracoes' => $table_configuracoes,
        'config_count' => count($configRows),
        'config_environments' => $configRows,
        'table_requisicoes' => $table_requisicoes,
        'requisicoes_count' => (int)$reqCount,
        'table_veiculos_contratados' => $table_veiculos_contratados,
        'veiculos_contratados_count' => (int)$veicCount
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
