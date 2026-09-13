<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

// Segurança: permite execução apenas no ambiente HML (/hml/)
if (!$isHml) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Acesso negado. Esta carga é restrita ao ambiente de Homologação (/hml/).'
    ]);
    exit;
}

$jsonFile = __DIR__ . '/lotes_payload.json';
if (!file_exists($jsonFile)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'Arquivo lotes_payload.json não encontrado no diretório api.'
    ]);
    exit;
}

$payload = json_decode(file_get_contents($jsonFile), true);
if (!$payload) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Payload JSON inválido.'
    ]);
    exit;
}

$env = 'Frota Principal';

try {
    $pdo->beginTransaction();

    // 1. Limpar lançamentos antigos no HML
    $stmtDel = $pdo->prepare("DELETE FROM $table_requisicoes WHERE environment = :env");
    $stmtDel->execute(['env' => $env]);

    // 2. Inserir lançamentos (787 requisições distribuídas de LOTE 1 e LOTE 3)
    $stmtInsert = $pdo->prepare("INSERT INTO $table_requisicoes 
        (id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, kmAnterior, km, combustivel, litros, precoLitro, valor, lote, environment)
        VALUES 
        (:id, :date, :inicioSeq, :fimSeq, :qtdRequisicoes, :zona, :responsavel, :posto, :motorista, :veiculo, :placa, :kmAnterior, :km, :combustivel, :litros, :precoLitro, :valor, :lote, :env)");

    $insertedCount = 0;
    foreach ($payload['requisicoes'] as $row) {
        $formattedDate = date('Y-m-d', strtotime($row['date']));
        $stmtInsert->execute([
            'id' => $row['id'],
            'date' => $formattedDate,
            'inicioSeq' => $row['inicioSeq'],
            'fimSeq' => $row['fimSeq'],
            'qtdRequisicoes' => (int)$row['qtdRequisicoes'],
            'zona' => $row['zona'],
            'responsavel' => $row['responsavel'],
            'posto' => $row['posto'],
            'motorista' => $row['motorista'],
            'veiculo' => $row['veiculo'],
            'placa' => $row['placa'],
            'kmAnterior' => null,
            'km' => null,
            'combustivel' => $row['combustivel'],
            'litros' => (float)$row['litros'],
            'precoLitro' => (float)$row['precoLitro'],
            'valor' => (float)$row['valor'],
            'lote' => $row['lote'],
            'env' => $env
        ]);
        $insertedCount++;
    }

    // 3. Buscar apoio existente em hml_configuracoes para preservar os cadastros trazidos de PROD
    $stmtConfig = $pdo->prepare("SELECT * FROM $table_configuracoes WHERE environment = :env");
    $stmtConfig->execute(['env' => $env]);
    $existingConfig = $stmtConfig->fetch(PDO::FETCH_ASSOC);

    $existingBases = $existingConfig && !empty($existingConfig['custom_bases']) ? json_decode($existingConfig['custom_bases'], true) : [];
    $existingPostos = $existingConfig && !empty($existingConfig['custom_postos']) ? json_decode($existingConfig['custom_postos'], true) : [];
    $existingMotoristas = $existingConfig && !empty($existingConfig['custom_motoristas']) ? json_decode($existingConfig['custom_motoristas'], true) : [];
    $existingVeiculos = $existingConfig && !empty($existingConfig['custom_veiculos']) ? json_decode($existingConfig['custom_veiculos'], true) : [];

    if (!is_array($existingBases)) $existingBases = [];
    if (!is_array($existingPostos)) $existingPostos = [];
    if (!is_array($existingMotoristas)) $existingMotoristas = [];
    if (!is_array($existingVeiculos)) $existingVeiculos = [];

    // Mesclar itens novos extraídos das planilhas LOTE 1 e LOTE 3
    $mergedBases = array_values(array_unique(array_merge($existingBases, $payload['custom_bases'])));
    $mergedPostos = array_values(array_unique(array_merge($existingPostos, $payload['custom_postos'])));
    $mergedVeiculos = array_values(array_unique(array_merge($existingVeiculos, $payload['custom_veiculos'])));
    $mergedMotoristas = array_values(array_unique(array_merge($existingMotoristas, array_map(function($b) {
        $parts = explode(' - ', $b);
        return count($parts) >= 2 ? $parts[1] : $b;
    }, $payload['custom_bases']))));

    // 4. Salvar em hml_configuracoes as requisições em estoque do LOTE 3 (26 tickets não distribuídos)
    $stockTickets = $payload['custom_requisicoes'];

    $stmtConf = $pdo->prepare("INSERT INTO $table_configuracoes 
        (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes)
        VALUES (:env, :bases, :postos, :motoristas, :veiculos, :requisicoes)
        ON DUPLICATE KEY UPDATE 
        custom_bases = :bases,
        custom_postos = :postos,
        custom_motoristas = :motoristas,
        custom_veiculos = :veiculos,
        custom_requisicoes = :requisicoes");

    $stmtConf->execute([
        'env' => $env,
        'bases' => json_encode($mergedBases, JSON_UNESCAPED_UNICODE),
        'postos' => json_encode($mergedPostos, JSON_UNESCAPED_UNICODE),
        'motoristas' => json_encode($mergedMotoristas, JSON_UNESCAPED_UNICODE),
        'veiculos' => json_encode($mergedVeiculos, JSON_UNESCAPED_UNICODE),
        'requisicoes' => json_encode($stockTickets, JSON_UNESCAPED_UNICODE)
    ]);

    $pdo->commit();

    writeAuditLog($pdo, 'LOAD_LOTES_1_AND_3_TO_HML', [
        'environment' => $env,
        'distributed_count' => $insertedCount,
        'stock_count' => count($stockTickets)
    ], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => 'Carga de LOTE 1 e LOTE 3 concluída com sucesso no HML!',
        'distributed_requisicoes' => $insertedCount,
        'stock_requisicoes_dispensador' => count($stockTickets),
        'sample_stock_tickets' => array_slice($stockTickets, 0, 5)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
