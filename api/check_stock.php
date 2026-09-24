<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$env = 'Frota Principal';

$stmtP = $pdo->prepare("SELECT custom_requisicoes FROM configuracoes WHERE environment = :env");
$stmtP->execute(['env' => $env]);
$prodJson = $stmtP->fetchColumn();
$prodStock = $prodJson ? json_decode($prodJson, true) : [];

$stmtH = $pdo->prepare("SELECT custom_requisicoes FROM hml_configuracoes WHERE environment = :env");
$stmtH->execute(['env' => $env]);
$hmlJson = $stmtH->fetchColumn();
$hmlStock = $hmlJson ? json_decode($hmlJson, true) : [];

if (!is_array($prodStock)) $prodStock = [];
if (!is_array($hmlStock)) $hmlStock = [];

$prodByLote = [];
foreach ($prodStock as $item) {
    if (preg_match('/\(LOTE\s*([^)]+)\)/i', $item, $m)) {
        $lName = "LOTE " . trim($m[1]);
    } else {
        $lName = "Sem Lote";
    }
    if (!isset($prodByLote[$lName])) $prodByLote[$lName] = 0;
    $prodByLote[$lName]++;
}

$hmlByLote = [];
foreach ($hmlStock as $item) {
    if (preg_match('/\(LOTE\s*([^)]+)\)/i', $item, $m)) {
        $lName = "LOTE " . trim($m[1]);
    } else {
        $lName = "Sem Lote";
    }
    if (!isset($hmlByLote[$lName])) $hmlByLote[$lName] = 0;
    $hmlByLote[$lName]++;
}

echo json_encode([
    'PROD' => [
        'total_stock' => count($prodStock),
        'by_lote' => $prodByLote,
        'sample' => array_slice($prodStock, 0, 3)
    ],
    'HML' => [
        'total_stock' => count($hmlStock),
        'by_lote' => $hmlByLote,
        'sample' => array_slice($hmlStock, 0, 3)
    ]
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
