<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';

try {
    $env = 'Frota Principal';

    // 1. Comparação de Requisições Distribuídas (Linha a Linha por ID e inicioSeq)
    $stmtProdReq = $pdo->prepare("SELECT id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, combustivel, litros, precoLitro, valor, lote FROM requisicoes WHERE environment = :env ORDER BY inicioSeq ASC, id ASC");
    $stmtProdReq->execute(['env' => $env]);
    $prodReqs = $stmtProdReq->fetchAll(PDO::FETCH_ASSOC);

    $stmtHmlReq = $pdo->prepare("SELECT id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, combustivel, litros, precoLitro, valor, lote FROM hml_requisicoes WHERE environment = :env ORDER BY inicioSeq ASC, id ASC");
    $stmtHmlReq->execute(['env' => $env]);
    $hmlReqs = $stmtHmlReq->fetchAll(PDO::FETCH_ASSOC);

    $prodReqsMap = [];
    foreach ($prodReqs as $r) {
        $key = !empty($r['inicioSeq']) ? $r['inicioSeq'] : $r['id'];
        $prodReqsMap[$key] = $r;
    }

    $hmlReqsMap = [];
    foreach ($hmlReqs as $r) {
        $key = !empty($r['inicioSeq']) ? $r['inicioSeq'] : $r['id'];
        $hmlReqsMap[$key] = $r;
    }

    $reqsOnlyInProd = array_diff_key($prodReqsMap, $hmlReqsMap);
    $reqsOnlyInHml = array_diff_key($hmlReqsMap, $prodReqsMap);

    $mismatchedReqs = [];
    foreach ($prodReqsMap as $key => $pRow) {
        if (isset($hmlReqsMap[$key])) {
            $hRow = $hmlReqsMap[$key];
            $diffs = [];
            foreach ($pRow as $col => $val) {
                if ((string)$val !== (string)$hRow[$col]) {
                    $diffs[$col] = ['PROD' => $val, 'HML' => $hRow[$col]];
                }
            }
            if (!empty($diffs)) {
                $mismatchedReqs[$key] = $diffs;
            }
        }
    }

    // 2. Comparação de Configurações
    $stmtProdConf = $pdo->prepare("SELECT custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes WHERE environment = :env");
    $stmtProdConf->execute(['env' => $env]);
    $prodConf = $stmtProdConf->fetch(PDO::FETCH_ASSOC);

    $stmtHmlConf = $pdo->prepare("SELECT custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM hml_configuracoes WHERE environment = :env");
    $stmtHmlConf->execute(['env' => $env]);
    $hmlConf = $stmtHmlConf->fetch(PDO::FETCH_ASSOC);

    $prodBases = $prodConf && !empty($prodConf['custom_bases']) ? json_decode($prodConf['custom_bases'], true) : [];
    $hmlBases = $hmlConf && !empty($hmlConf['custom_bases']) ? json_decode($hmlConf['custom_bases'], true) : [];

    $prodPostos = $prodConf && !empty($prodConf['custom_postos']) ? json_decode($prodConf['custom_postos'], true) : [];
    $hmlPostos = $hmlConf && !empty($hmlConf['custom_postos']) ? json_decode($hmlConf['custom_postos'], true) : [];

    $prodMotoristas = $prodConf && !empty($prodConf['custom_motoristas']) ? json_decode($prodConf['custom_motoristas'], true) : [];
    $hmlMotoristas = $hmlConf && !empty($hmlConf['custom_motoristas']) ? json_decode($hmlConf['custom_motoristas'], true) : [];

    $prodVeiculos = $prodConf && !empty($prodConf['custom_veiculos']) ? json_decode($prodConf['custom_veiculos'], true) : [];
    $hmlVeiculos = $hmlConf && !empty($hmlConf['custom_veiculos']) ? json_decode($hmlConf['custom_veiculos'], true) : [];

    $prodStock = $prodConf && !empty($prodConf['custom_requisicoes']) ? json_decode($prodConf['custom_requisicoes'], true) : [];
    $hmlStock = $hmlConf && !empty($hmlConf['custom_requisicoes']) ? json_decode($hmlConf['custom_requisicoes'], true) : [];

    if (!is_array($prodBases)) $prodBases = [];
    if (!is_array($hmlBases)) $hmlBases = [];
    if (!is_array($prodPostos)) $prodPostos = [];
    if (!is_array($hmlPostos)) $hmlPostos = [];
    if (!is_array($prodMotoristas)) $prodMotoristas = [];
    if (!is_array($hmlMotoristas)) $hmlMotoristas = [];
    if (!is_array($prodVeiculos)) $prodVeiculos = [];
    if (!is_array($hmlVeiculos)) $hmlVeiculos = [];
    if (!is_array($prodStock)) $prodStock = [];
    if (!is_array($hmlStock)) $hmlStock = [];

    // 3. Comparação de Veículos Contratados
    $stmtProdVeic = $pdo->query("SELECT * FROM veiculos_contratados");
    $prodVeics = $stmtProdVeic->fetchAll(PDO::FETCH_ASSOC);

    $stmtHmlVeic = $pdo->query("SELECT * FROM hml_veiculos_contratados");
    $hmlVeics = $stmtHmlVeic->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'diagnostico_detalhado' => [
            'requisicoes_distribuidas' => [
                'prod_total' => count($prodReqs),
                'hml_total' => count($hmlReqs),
                'apenas_em_prod_count' => count($reqsOnlyInProd),
                'apenas_em_hml_count' => count($reqsOnlyInHml),
                'divergencias_de_conteudo_count' => count($mismatchedReqs),
                'divergencias_detalhes' => $mismatchedReqs
            ],
            'cadastros_apoio' => [
                'bases' => [
                    'prod_count' => count($prodBases),
                    'hml_count' => count($hmlBases),
                    'diferencas' => array_values(array_symmetric_diff($prodBases, $hmlBases))
                ],
                'postos' => [
                    'prod_count' => count($prodPostos),
                    'hml_count' => count($hmlPostos),
                    'diferencas' => array_values(array_symmetric_diff($prodPostos, $hmlPostos))
                ],
                'motoristas' => [
                    'prod_count' => count($prodMotoristas),
                    'hml_count' => count($hmlMotoristas),
                    'diferencas' => array_values(array_symmetric_diff($prodMotoristas, $hmlMotoristas))
                ],
                'veiculos' => [
                    'prod_count' => count($prodVeiculos),
                    'hml_count' => count($hmlVeiculos),
                    'diferencas' => array_values(array_symmetric_diff($prodVeiculos, $hmlVeiculos))
                ]
            ],
            'estoque_dispensador_custom_requisicoes' => [
                'prod_total_tickets' => count($prodStock),
                'hml_total_tickets' => count($hmlStock),
                'diferenca_liquida' => count($prodStock) - count($hmlStock),
                'tickets_apenas_em_prod_count' => count(array_diff($prodStock, $hmlStock)),
                'tickets_apenas_em_hml_count' => count(array_diff($hmlStock, $prodStock))
            ],
            'veiculos_contratados' => [
                'prod_count' => count($prodVeics),
                'hml_count' => count($hmlVeics)
            ]
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}

function array_symmetric_diff($a, $b) {
    return array_merge(array_diff($a, $b), array_diff($b, $a));
}
