<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$env = 'Frota Principal';

// 1. Fetch requisicoes (state.rawData)
$stmt = $pdo->prepare("SELECT * FROM $table_requisicoes WHERE environment = :env");
$stmt->execute(['env' => $env]);
$requisicoes = $stmt->fetchAll();

// 2. Fetch configuracoes
$stmtConfig = $pdo->prepare("SELECT * FROM $table_configuracoes WHERE environment = :env");
$stmtConfig->execute(['env' => $env]);
$config = $stmtConfig->fetch();

$customReqs = [];
if ($config && !empty($config['custom_requisicoes'])) {
    $customReqs = json_decode($config['custom_requisicoes'], true);
    if (!is_array($customReqs)) $customReqs = [];
}

// Analisar custom_requisicoes (disponíveis no pool)
$poolGroups = [];
foreach ($customReqs as $item) {
    if (!is_string($item)) continue;
    
    $lote = 'OUTROS';
    if (preg_match('/\(LOTE\s*([^)]+)\)/i', $item, $m)) {
        $lote = "LOTE " . trim(preg_replace('/^LOTE\s*/i', '', $m[1]));
    }
    
    $litros = '30L';
    if (preg_match('/(\d+(?:\.\d+)?)\s*(?:L|Litros)/i', $item, $m)) {
        $litros = $m[1] . 'L';
    }
    
    $control = 'AVULSO';
    $seq = '001';
    if (preg_match('/^([^\s-]+)-(\d+)/', $item, $m)) {
        $control = trim($m[1]);
        $seq = trim($m[2]);
    }
    
    $key = "{$lote}___{$control}___{$litros}";
    if (!isset($poolGroups[$key])) {
        $poolGroups[$key] = [
            'lote' => $lote,
            'control' => $control,
            'litros' => $litros,
            'pool_count' => 0,
            'pool_seqs' => []
        ];
    }
    $poolGroups[$key]['pool_count']++;
    $poolGroups[$key]['pool_seqs'][] = intval($seq);
}

// Analisar rawData (lançamentos no banco)
$rawGroups = [];
foreach ($requisicoes as $row) {
    $seqStr = trim($row['inicioSeq'] ?? '');
    $control = 'AVULSO';
    $seq = '001';
    if (strpos($seqStr, '-') !== false) {
        $parts = explode('-', $seqStr);
        $control = trim($parts[0]);
        $seq = trim($parts[1]);
    } elseif (!empty($seqStr)) {
        $control = is_numeric($seqStr) ? 'SEQUENCIAL' : $seqStr;
        $seq = $seqStr;
    }
    
    $lote = trim($row['lote'] ?? '');
    if (empty($lote) || $lote === 'OUTROS') {
        if (preg_match('/(LOTE\s*\d+)/i', $seqStr, $m)) {
            $lote = strtoupper(trim($m[1]));
        }
    }
    if (empty($lote)) $lote = 'OUTROS';
    
    $litros = !empty($row['litros']) ? (float)$row['litros'] . 'L' : '30L';
    
    $key = "{$lote}___{$control}___{$litros}";
    if (!isset($rawGroups[$key])) {
        $rawGroups[$key] = [
            'lote' => $lote,
            'control' => $control,
            'litros' => $litros,
            'raw_count' => 0,
            'raw_seqs' => []
        ];
    }
    $rawGroups[$key]['raw_count']++;
    $num = intval($seq);
    if ($num > 0) $rawGroups[$key]['raw_seqs'][] = $num;
}

echo json_encode([
    'success' => true,
    'total_pool_items' => count($customReqs),
    'total_raw_launches' => count($requisicoes),
    'pool_groups' => array_values($poolGroups),
    'raw_groups' => array_values($rawGroups)
]);
