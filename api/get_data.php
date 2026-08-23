<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

require_once __DIR__ . '/db.php';

$env = isset($_GET['env']) ? trim($_GET['env']) : 'Frota Principal';
if (empty($env)) {
    $env = 'Frota Principal';
}

try {
    // 1. Buscar Lançamentos (Requisicoes)
    $stmt = $pdo->prepare("SELECT * FROM $table_requisicoes WHERE environment = :env");
    $stmt->execute(['env' => $env]);
    $requisicoes = $stmt->fetchAll();

    // 2. Buscar Configurações
    $stmtConfig = $pdo->prepare("SELECT * FROM $table_configuracoes WHERE environment = :env");
    $stmtConfig->execute(['env' => $env]);
    $config = $stmtConfig->fetch();

    // 3. Buscar Lista de Todos os Ambientes cadastrados no banco
    $stmtEnvs1 = $pdo->query("SELECT DISTINCT environment FROM $table_requisicoes");
    $envs1 = $stmtEnvs1->fetchAll(PDO::FETCH_COLUMN);

    $stmtEnvs2 = $pdo->query("SELECT DISTINCT environment FROM $table_configuracoes");
    $envs2 = $stmtEnvs2->fetchAll(PDO::FETCH_COLUMN);

    $allEnvs = array_unique(array_merge(['Frota Principal'], $envs1, $envs2));
    sort($allEnvs);

    echo json_encode([
        'success' => true,
        'environment' => $env,
        'requisicoes' => $requisicoes,
        'configuracoes' => $config ? $config : null,
        'environments' => array_values($allEnvs)
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao carregar dados: ' . $e->getMessage()]);
}
