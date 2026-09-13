<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$res = [];

// 1. Logs de atividade do PROD
try {
    $stmt = $pdo->query("SELECT * FROM activity_logs ORDER BY id DESC LIMIT 50");
    $res['prod_activity_logs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $res['prod_activity_logs_error'] = $e->getMessage();
}

// 2. Logs de atividade do HML
try {
    $stmt = $pdo->query("SELECT * FROM hml_activity_logs ORDER BY id DESC LIMIT 50");
    $res['hml_activity_logs'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $res['hml_activity_logs_error'] = $e->getMessage();
}

// 3. Contagem de registros por ambiente em PROD (requisicoes)
try {
    $stmt = $pdo->query("SELECT environment, COUNT(*) as total, MIN(date) as min_date, MAX(date) as max_date FROM requisicoes GROUP BY environment");
    $res['prod_requisicoes_summary'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $res['prod_requisicoes_summary_error'] = $e->getMessage();
}

// 4. Contagem de registros por ambiente em HML (hml_requisicoes)
try {
    $stmt = $pdo->query("SELECT environment, COUNT(*) as total, MIN(date) as min_date, MAX(date) as max_date FROM hml_requisicoes GROUP BY environment");
    $res['hml_requisicoes_summary'] = $stmt->fetchAll(PDO::FETCH_ASSOC);
} catch (Exception $e) {
    $res['hml_requisicoes_summary_error'] = $e->getMessage();
}

// 5. Contagem de custom_requisicoes em PROD vs HML
try {
    $stmt = $pdo->query("SELECT environment, CHAR_LENGTH(custom_requisicoes) as len, custom_requisicoes FROM configuracoes");
    $prodConfs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($prodConfs as &$c) {
        $arr = json_decode($c['custom_requisicoes'], true);
        $c['count_custom_reqs'] = is_array($arr) ? count($arr) : 0;
        unset($c['custom_requisicoes']);
    }
    $res['prod_configuracoes_summary'] = $prodConfs;
} catch (Exception $e) {
    $res['prod_configuracoes_summary_error'] = $e->getMessage();
}

try {
    $stmt = $pdo->query("SELECT environment, CHAR_LENGTH(custom_requisicoes) as len, custom_requisicoes FROM hml_configuracoes");
    $hmlConfs = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($hmlConfs as &$c) {
        $arr = json_decode($c['custom_requisicoes'], true);
        $c['count_custom_reqs'] = is_array($arr) ? count($arr) : 0;
        unset($c['custom_requisicoes']);
    }
    $res['hml_configuracoes_summary'] = $hmlConfs;
} catch (Exception $e) {
    $res['hml_configuracoes_summary_error'] = $e->getMessage();
}

echo json_encode($res, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
