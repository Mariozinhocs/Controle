<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';

$env = 'Frota Principal';

try {
    // ==========================================
    // 1. DADOS DE PRODUÇÃO (PROD)
    // ==========================================
    // Recompor totais de requisições distribuídas em PROD
    $stmtProdReq = $pdo->prepare("SELECT 
        COUNT(*) as total_reqs, 
        COALESCE(SUM(litros), 0) as total_litros, 
        COALESCE(SUM(valor), 0) as total_valor,
        MIN(date) as min_date,
        MAX(date) as max_date
        FROM requisicoes WHERE environment = :env");
    $stmtProdReq->execute(['env' => $env]);
    $prodReqSummary = $stmtProdReq->fetch(PDO::FETCH_ASSOC);

    // Por lote em PROD
    $stmtProdLote = $pdo->prepare("SELECT lote, COUNT(*) as qty, COALESCE(SUM(litros), 0) as litros, COALESCE(SUM(valor), 0) as valor FROM requisicoes WHERE environment = :env GROUP BY lote");
    $stmtProdLote->execute(['env' => $env]);
    $prodLoteRows = $stmtProdLote->fetchAll(PDO::FETCH_ASSOC);
    $prodLotesMap = [];
    foreach ($prodLoteRows as $r) {
        $lName = !empty($r['lote']) ? trim($r['lote']) : 'Sem Lote';
        $prodLotesMap[$lName] = [
            'distribuidos' => (int)$r['qty'],
            'litros' => round((float)$r['litros'], 2),
            'valor' => round((float)$r['valor'], 2)
        ];
    }

    // Configurações em PROD
    $stmtProdConf = $pdo->prepare("SELECT custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes WHERE environment = :env");
    $stmtProdConf->execute(['env' => $env]);
    $prodConf = $stmtProdConf->fetch(PDO::FETCH_ASSOC);

    $prodBases = $prodConf && !empty($prodConf['custom_bases']) ? json_decode($prodConf['custom_bases'], true) : [];
    $prodPostos = $prodConf && !empty($prodConf['custom_postos']) ? json_decode($prodConf['custom_postos'], true) : [];
    $prodMotoristas = $prodConf && !empty($prodConf['custom_motoristas']) ? json_decode($prodConf['custom_motoristas'], true) : [];
    $prodVeiculos = $prodConf && !empty($prodConf['custom_veiculos']) ? json_decode($prodConf['custom_veiculos'], true) : [];
    $prodStockReqs = $prodConf && !empty($prodConf['custom_requisicoes']) ? json_decode($prodConf['custom_requisicoes'], true) : [];

    if (!is_array($prodBases)) $prodBases = [];
    if (!is_array($prodPostos)) $prodPostos = [];
    if (!is_array($prodMotoristas)) $prodMotoristas = [];
    if (!is_array($prodVeiculos)) $prodVeiculos = [];
    if (!is_array($prodStockReqs)) $prodStockReqs = [];

    $prodStockLotes = [];
    foreach ($prodStockReqs as $item) {
        if (is_string($item) && preg_match('/\(LOTE\s*([^)]+)\)/i', $item, $m)) {
            $lName = "LOTE " . trim($m[1]);
        } else {
            $lName = "Sem Lote";
        }
        if (!isset($prodStockLotes[$lName])) $prodStockLotes[$lName] = 0;
        $prodStockLotes[$lName]++;
    }

    // Veículos Contratados em PROD
    $stmtProdVeicCont = $pdo->query("SELECT COUNT(*) FROM veiculos_contratados");
    $prodVeicContCount = (int)$stmtProdVeicCont->fetchColumn();


    // ==========================================
    // 2. DADOS DE HOMOLOGAÇÃO (HML)
    // ==========================================
    $stmtHmlReq = $pdo->prepare("SELECT 
        COUNT(*) as total_reqs, 
        COALESCE(SUM(litros), 0) as total_litros, 
        COALESCE(SUM(valor), 0) as total_valor,
        MIN(date) as min_date,
        MAX(date) as max_date
        FROM hml_requisicoes WHERE environment = :env");
    $stmtHmlReq->execute(['env' => $env]);
    $hmlReqSummary = $stmtHmlReq->fetch(PDO::FETCH_ASSOC);

    // Por lote em HML
    $stmtHmlLote = $pdo->prepare("SELECT lote, COUNT(*) as qty, COALESCE(SUM(litros), 0) as litros, COALESCE(SUM(valor), 0) as valor FROM hml_requisicoes WHERE environment = :env GROUP BY lote");
    $stmtHmlLote->execute(['env' => $env]);
    $hmlLoteRows = $stmtHmlLote->fetchAll(PDO::FETCH_ASSOC);
    $hmlLotesMap = [];
    foreach ($hmlLoteRows as $r) {
        $lName = !empty($r['lote']) ? trim($r['lote']) : 'Sem Lote';
        $hmlLotesMap[$lName] = [
            'distribuidos' => (int)$r['qty'],
            'litros' => round((float)$r['litros'], 2),
            'valor' => round((float)$r['valor'], 2)
        ];
    }

    // Configurações em HML
    $stmtHmlConf = $pdo->prepare("SELECT custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM hml_configuracoes WHERE environment = :env");
    $stmtHmlConf->execute(['env' => $env]);
    $hmlConf = $stmtHmlConf->fetch(PDO::FETCH_ASSOC);

    $hmlBases = $hmlConf && !empty($hmlConf['custom_bases']) ? json_decode($hmlConf['custom_bases'], true) : [];
    $hmlPostos = $hmlConf && !empty($hmlConf['custom_postos']) ? json_decode($hmlConf['custom_postos'], true) : [];
    $hmlMotoristas = $hmlConf && !empty($hmlConf['custom_motoristas']) ? json_decode($hmlConf['custom_motoristas'], true) : [];
    $hmlVeiculos = $hmlConf && !empty($hmlConf['custom_veiculos']) ? json_decode($hmlConf['custom_veiculos'], true) : [];
    $hmlStockReqs = $hmlConf && !empty($hmlConf['custom_requisicoes']) ? json_decode($hmlConf['custom_requisicoes'], true) : [];

    if (!is_array($hmlBases)) $hmlBases = [];
    if (!is_array($hmlPostos)) $hmlPostos = [];
    if (!is_array($hmlMotoristas)) $hmlMotoristas = [];
    if (!is_array($hmlVeiculos)) $hmlVeiculos = [];
    if (!is_array($hmlStockReqs)) $hmlStockReqs = [];

    $hmlStockLotes = [];
    foreach ($hmlStockReqs as $item) {
        if (is_string($item) && preg_match('/\(LOTE\s*([^)]+)\)/i', $item, $m)) {
            $lName = "LOTE " . trim($m[1]);
        } else {
            $lName = "Sem Lote";
        }
        if (!isset($hmlStockLotes[$lName])) $hmlStockLotes[$lName] = 0;
        $hmlStockLotes[$lName]++;
    }

    // Veículos Contratados em HML
    $stmtHmlVeicCont = $pdo->query("SELECT COUNT(*) FROM hml_veiculos_contratados");
    $hmlVeicContCount = (int)$stmtHmlVeicCont->fetchColumn();


    // ==========================================
    // 3. ANÁLISE COMPARATIVA SIDE-BY-SIDE
    // ==========================================
    $allLotesSet = array_unique(array_merge(array_keys($prodLotesMap), array_keys($hmlLotesMap), array_keys($prodStockLotes), array_keys($hmlStockLotes)));
    sort($allLotesSet);

    $lotesComparison = [];
    foreach ($allLotesSet as $lName) {
        $pDist = isset($prodLotesMap[$lName]) ? $prodLotesMap[$lName]['distribuidos'] : 0;
        $hDist = isset($hmlLotesMap[$lName]) ? $hmlLotesMap[$lName]['distribuidos'] : 0;
        $pStock = isset($prodStockLotes[$lName]) ? $prodStockLotes[$lName] : 0;
        $hStock = isset($hmlStockLotes[$lName]) ? $hmlStockLotes[$lName] : 0;

        $lotesComparison[$lName] = [
            'PROD' => [
                'distribuidos' => $pDist,
                'estoque_pool' => $pStock,
                'total_lote' => $pDist + $pStock
            ],
            'HML' => [
                'distribuidos' => $hDist,
                'estoque_pool' => $hStock,
                'total_lote' => $hDist + $hStock
            ],
            'diferenca_total' => ($hDist + $hStock) - ($pDist + $pStock)
        ];
    }

    // Comparação de Apoios
    $basesDiff = [
        'apenas_em_prod' => array_values(array_diff($prodBases, $hmlBases)),
        'apenas_em_hml' => array_values(array_diff($hmlBases, $prodBases)),
        'iguais' => count(array_intersect($prodBases, $hmlBases))
    ];

    echo json_encode([
        'success' => true,
        'timestamp' => date('c'),
        'resumo_geral' => [
            'PROD' => [
                'requisicoes_distribuidas' => (int)$prodReqSummary['total_reqs'],
                'volume_litros' => round((float)$prodReqSummary['total_litros'], 2),
                'valor_total_reais' => round((float)$prodReqSummary['total_valor'], 2),
                'periodo' => $prodReqSummary['min_date'] . ' até ' . $prodReqSummary['max_date'],
                'estoque_dispensador' => count($prodStockReqs),
                'total_geral_cadastrados' => (int)$prodReqSummary['total_reqs'] + count($prodStockReqs),
                'cadastros' => [
                    'bases' => count($prodBases),
                    'postos' => count($prodPostos),
                    'motoristas' => count($prodMotoristas),
                    'veiculos' => count($prodVeiculos),
                    'veiculos_contratados' => $prodVeicContCount
                ]
            ],
            'HML' => [
                'requisicoes_distribuidas' => (int)$hmlReqSummary['total_reqs'],
                'volume_litros' => round((float)$hmlReqSummary['total_litros'], 2),
                'valor_total_reais' => round((float)$hmlReqSummary['total_valor'], 2),
                'periodo' => $hmlReqSummary['min_date'] . ' até ' . $hmlReqSummary['max_date'],
                'estoque_dispensador' => count($hmlStockReqs),
                'total_geral_cadastrados' => (int)$hmlReqSummary['total_reqs'] + count($hmlStockReqs),
                'cadastros' => [
                    'bases' => count($hmlBases),
                    'postos' => count($hmlPostos),
                    'motoristas' => count($hmlMotoristas),
                    'veiculos' => count($hmlVeiculos),
                    'veiculos_contratados' => $hmlVeicContCount
                ]
            ],
            'diferenca_liquida' => [
                'requisicoes_distribuidas' => (int)$hmlReqSummary['total_reqs'] - (int)$prodReqSummary['total_reqs'],
                'estoque_dispensador' => count($hmlStockReqs) - count($prodStockReqs),
                'total_geral_cadastrados' => ((int)$hmlReqSummary['total_reqs'] + count($hmlStockReqs)) - ((int)$prodReqSummary['total_reqs'] + count($prodStockReqs))
            ]
        ],
        'comparativo_por_lote' => $lotesComparison,
        'comparativo_cadastros_bases' => [
            'prod_total' => count($prodBases),
            'hml_total' => count($hmlBases),
            'diferencas' => $basesDiff
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
