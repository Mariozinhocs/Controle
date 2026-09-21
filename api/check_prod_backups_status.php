<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $stmt1 = $pdo->query("SELECT environment, COUNT(*) as total FROM hml_requisicoes GROUP BY environment");
    $hmlEnvs = $stmt1->fetchAll(PDO::FETCH_ASSOC);

    $stmt2 = $pdo->query("SELECT environment, COUNT(*) as total FROM requisicoes GROUP BY environment");
    $prodEnvs = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'hml_requisicoes_by_env' => $hmlEnvs,
        'prod_requisicoes_by_env' => $prodEnvs
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
