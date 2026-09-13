<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $stmt = $pdo->query("SELECT environment, CHAR_LENGTH(custom_bases) as bases_len, CHAR_LENGTH(custom_postos) as postos_len, CHAR_LENGTH(custom_motoristas) as mot_len, CHAR_LENGTH(custom_veiculos) as veic_len, CHAR_LENGTH(custom_requisicoes) as req_len FROM $table_configuracoes");
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'success' => true,
        'table' => $table_configuracoes,
        'count' => count($rows),
        'rows' => $rows
    ]);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

