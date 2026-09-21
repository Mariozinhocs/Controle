<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    // PROD Data
    $prodReqCount = (int)$pdo->query("SELECT COUNT(*) FROM requisicoes")->fetchColumn();
    $prodConf = $pdo->query("SELECT environment, 
        CHAR_LENGTH(custom_bases) as bases_len, 
        CHAR_LENGTH(custom_postos) as postos_len, 
        CHAR_LENGTH(custom_motoristas) as mot_len, 
        CHAR_LENGTH(custom_veiculos) as veic_len, 
        CHAR_LENGTH(custom_requisicoes) as req_len 
        FROM configuracoes WHERE environment = 'Frota Principal'")->fetch(PDO::FETCH_ASSOC);

    $prodVeicCount = (int)$pdo->query("SELECT COUNT(*) FROM veiculos_contratados")->fetchColumn();

    // HML Data
    $hmlReqCount = (int)$pdo->query("SELECT COUNT(*) FROM hml_requisicoes")->fetchColumn();
    $hmlConf = $pdo->query("SELECT environment, 
        CHAR_LENGTH(custom_bases) as bases_len, 
        CHAR_LENGTH(custom_postos) as postos_len, 
        CHAR_LENGTH(custom_motoristas) as mot_len, 
        CHAR_LENGTH(custom_veiculos) as veic_len, 
        CHAR_LENGTH(custom_requisicoes) as req_len 
        FROM hml_configuracoes WHERE environment = 'Frota Principal'")->fetch(PDO::FETCH_ASSOC);

    $hmlVeicCount = (int)$pdo->query("SELECT COUNT(*) FROM hml_veiculos_contratados")->fetchColumn();

    // Sample IDs / Seqs comparison
    $prodReqSample = $pdo->query("SELECT id, date, inicioSeq, fimSeq, zona, responsavel, valor, lote FROM requisicoes LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);
    $hmlReqSample = $pdo->query("SELECT id, date, inicioSeq, fimSeq, zona, responsavel, valor, lote FROM hml_requisicoes LIMIT 5")->fetchAll(PDO::FETCH_ASSOC);

    // Audit Log Activity from HML and PROD
    $hmlLogs = $pdo->query("SELECT * FROM hml_activity_logs ORDER BY id DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);
    $prodLogs = $pdo->query("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 10")->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'prod' => [
            'requisicoes_count' => $prodReqCount,
            'configuracoes' => $prodConf,
            'veiculos_contratados_count' => $prodVeicCount,
            'sample_requisicoes' => $prodReqSample
        ],
        'hml' => [
            'requisicoes_count' => $hmlReqCount,
            'configuracoes' => $hmlConf,
            'veiculos_contratados_count' => $hmlVeicCount,
            'sample_requisicoes' => $hmlReqSample
        ],
        'logs' => [
            'hml_recent_logs' => $hmlLogs,
            'prod_recent_logs' => $prodLogs
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
