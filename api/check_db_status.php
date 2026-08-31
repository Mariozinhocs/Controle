<?php
require_once __DIR__ . '/db.php';
try {
    $stmt = $pdo->query("SELECT * FROM $table_requisicoes");
    $reqs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $stmtConf = $pdo->query("SELECT * FROM $table_configuracoes");
    $confs = $stmtConf->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'requisicoes' => $reqs,
        'configuracoes' => $confs
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo $e->getMessage();
}
