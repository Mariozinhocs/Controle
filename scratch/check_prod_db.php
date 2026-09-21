<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/../api/db.php';

$env = 'Frota Principal';

try {
    // 1. Requisições distribuídas em PROD (tabela requisicoes)
    $stmtReq = $pdo->prepare("SELECT lote, COUNT(*) as total FROM requisicoes WHERE environment = :env GROUP BY lote");
    $stmtReq->execute(['env' => $env]);
    $reqByLote = $stmtReq->fetchAll(PDO::FETCH_KEY_PAIR);

    $stmtTotalReq = $pdo->prepare("SELECT COUNT(*) FROM requisicoes WHERE environment = :env");
    $stmtTotalReq->execute(['env' => $env]);
    $totalReq = (int)$stmtTotalReq->fetchColumn();

    // 2. Configurações e Estoque em PROD (tabela configuracoes)
    $stmtConf = $pdo->prepare("SELECT custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes WHERE environment = :env");
    $stmtConf->execute(['env' => $env]);
    $conf = $stmtConf->fetch(PDO::FETCH_ASSOC);

    $stockReqs = $conf && !empty($conf['custom_requisicoes']) ? json_decode($conf['custom_requisicoes'], true) : [];
    if (!is_array($stockReqs)) $stockReqs = [];

    $stockByLote = [];
    foreach ($stockReqs as $item) {
        if (preg_match('/\(LOTE\s*(\d+)\)/i', $item, $m)) {
            $lName = "LOTE " . $m[1];
        } else {
            $lName = "Sem Lote Especificado";
        }
        if (!isset($stockByLote[$lName])) $stockByLote[$lName] = 0;
        $stockByLote[$lName]++;
    }

    $bases = $conf && !empty($conf['custom_bases']) ? json_decode($conf['custom_bases'], true) : [];
    $postos = $conf && !empty($conf['custom_postos']) ? json_decode($conf['custom_postos'], true) : [];
    $motoristas = $conf && !empty($conf['custom_motoristas']) ? json_decode($conf['custom_motoristas'], true) : [];
    $veiculos = $conf && !empty($conf['custom_veiculos']) ? json_decode($conf['custom_veiculos'], true) : [];

    echo json_encode([
        'success' => true,
        'environment' => $env,
        'prod_requisicoes_distribuidas_total' => $totalReq,
        'prod_requisicoes_distribuidas_por_lote' => $reqLoteSummary = $reqByLote,
        'prod_estoque_dispensador_total' => count($stockReqs),
        'prod_estoque_dispensador_por_lote' => $stockByLote,
        'prod_total_cadastradas' => $totalReq + count($stockReqs),
        'bases_count' => is_array($bases) ? count($bases) : 0,
        'postos_count' => is_array($postos) ? count($postos) : 0,
        'motoristas_count' => is_array($motoristas) ? count($motoristas) : 0,
        'veiculos_count' => is_array($veiculos) ? count($veiculos) : 0
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
