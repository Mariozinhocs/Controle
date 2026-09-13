<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $stmt = $pdo->query("SELECT COUNT(*) as cnt, SUM(litros) as total_litros FROM $table_requisicoes WHERE environment = 'Frota Principal' AND lote = 'LOTE 1'");
    $lote1 = $stmt->fetch(PDO::FETCH_ASSOC);

    $stmtAll = $pdo->query("SELECT lote, COUNT(*) as cnt, SUM(litros) as total_litros FROM $table_requisicoes WHERE environment = 'Frota Principal' GROUP BY lote");
    $groups = $stmtAll->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'table' => $table_requisicoes,
        'lote1_summary' => $lote1,
        'lote_groups' => $groups
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
