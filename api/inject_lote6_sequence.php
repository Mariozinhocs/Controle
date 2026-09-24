<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

$controlCode = '1789771755740';
$startNum = 1;
$endNum = 100;
$litros = '30L';
$loteName = 'LOTE 6';
$env = 'Frota Principal';

$newTickets = [];
for ($i = $startNum; $i <= $endNum; $i++) {
    $seqPad = str_pad($i, 3, '0', STR_PAD_LEFT);
    $newTickets[] = "{$controlCode}-{$seqPad} - {$litros} ({$loteName})";
}

try {
    $pdo->beginTransaction();

    // 1. Atualizar em configuracoes (PROD)
    $stmtProd = $pdo->prepare("SELECT custom_requisicoes FROM configuracoes WHERE environment = :env");
    $stmtProd->execute(['env' => $env]);
    $rawProd = $stmtProd->fetchColumn();

    $currProd = json_decode($rawProd, true);
    if (!is_array($currProd)) $currProd = [];

    // Mesclar com unicidade
    $updatedProd = array_values(array_unique(array_merge($currProd, $newTickets)));

    $stmtUpdProd = $pdo->prepare("UPDATE configuracoes SET custom_requisicoes = :reqs WHERE environment = :env");
    $stmtUpdProd->execute([
        'reqs' => json_encode($updatedProd, JSON_UNESCAPED_UNICODE),
        'env' => $env
    ]);

    // 2. Atualizar em hml_configuracoes (HML)
    $stmtHml = $pdo->prepare("SELECT custom_requisicoes FROM hml_configuracoes WHERE environment = :env");
    $stmtHml->execute(['env' => $env]);
    $rawHml = $stmtHml->fetchColumn();

    $currHml = json_decode($rawHml, true);
    if (!is_array($currHml)) $currHml = [];

    $updatedHml = array_values(array_unique(array_merge($currHml, $newTickets)));

    $stmtUpdHml = $pdo->prepare("UPDATE hml_configuracoes SET custom_requisicoes = :reqs WHERE environment = :env");
    $stmtUpdHml->execute([
        'reqs' => json_encode($updatedHml, JSON_UNESCAPED_UNICODE),
        'env' => $env
    ]);

    // 3. Garantir espelhamento e paridade total de lançamentos HML -> PROD
    $pdo->exec("DELETE FROM hml_requisicoes");
    $pdo->exec("INSERT INTO hml_requisicoes SELECT * FROM requisicoes");

    $pdo->exec("DELETE FROM hml_configuracoes");
    $pdo->exec("INSERT INTO hml_configuracoes (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes) 
                SELECT environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes");

    $pdo->commit();

    writeAuditLog($pdo, 'INJECT_LOTE6_SEQUENCE', [
        'controlCode' => $controlCode,
        'count' => count($newTickets),
        'totalLitros' => 100 * 30,
        'lote' => $loteName
    ], 'Produção/Homologação');

    echo json_encode([
        'success' => true,
        'message' => "Faixa {$controlCode}-001 a 100 (3.000 Litros no LOTE 6) reinjetada com sucesso em PROD e HML!",
        'total_tickets_added' => count($newTickets),
        'total_disponivel_prod' => count($updatedProd),
        'total_disponivel_hml' => count($updatedProd),
        'sample_tickets' => array_slice($newTickets, 0, 5)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
