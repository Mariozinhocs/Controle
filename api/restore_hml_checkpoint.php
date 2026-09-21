<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

// Segurança: restrito ao ambiente HML ou requisição com parâmetro de forçar
$requestedFile = isset($_GET['file']) ? basename($_GET['file']) : 'hml_checkpoint_official.json';
$filePath = __DIR__ . '/backups/' . $requestedFile;

if (!file_exists($filePath)) {
    $filePath = __DIR__ . '/' . $requestedFile;
}

if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => "Arquivo de checkpoint '$requestedFile' não encontrado."
    ]);
    exit;
}

$rawJson = file_get_contents($filePath);
$data = json_decode($rawJson, true);

if (!$data || !isset($data['hml_requisicoes'])) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => "Conteúdo do checkpoint JSON é inválido ou corrompido."
    ]);
    exit;
}

$targetConfig = 'hml_configuracoes';
$targetReq = 'hml_requisicoes';
$targetVeic = 'hml_veiculos_contratados';

try {
    $pdo->beginTransaction();

    // 1. Limpar tabelas de HML
    $pdo->exec("DELETE FROM $targetReq");
    $pdo->exec("DELETE FROM $targetConfig");
    $pdo->exec("DELETE FROM $targetVeic");

    // 2. Restaurar hml_configuracoes
    if (!empty($data['hml_configuracoes']) && is_array($data['hml_configuracoes'])) {
        $stmtConf = $pdo->prepare("INSERT INTO $targetConfig 
            (id, environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes)
            VALUES (:id, :env, :bases, :postos, :motoristas, :veiculos, :requisicoes)");
        
        foreach ($data['hml_configuracoes'] as $c) {
            $stmtConf->execute([
                'id' => $c['id'],
                'env' => $c['environment'],
                'bases' => $c['custom_bases'],
                'postos' => $c['custom_postos'],
                'motoristas' => $c['custom_motoristas'],
                'veiculos' => $c['custom_veiculos'],
                'requisicoes' => $c['custom_requisicoes']
            ]);
        }
    }

    // 3. Restaurar hml_requisicoes
    $insertedReqs = 0;
    if (!empty($data['hml_requisicoes']) && is_array($data['hml_requisicoes'])) {
        $stmtReq = $pdo->prepare("INSERT INTO $targetReq 
            (id, date, month, year, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, kmAnterior, km, combustivel, lote, litros, precoLitro, valor, environment)
            VALUES 
            (:id, :date, :month, :year, :inicioSeq, :fimSeq, :qtdRequisicoes, :zona, :responsavel, :posto, :motorista, :veiculo, :placa, :kmAnterior, :km, :combustivel, :lote, :litros, :precoLitro, :valor, :environment)");
        
        foreach ($data['hml_requisicoes'] as $r) {
            $stmtReq->execute([
                'id' => $r['id'],
                'date' => $r['date'],
                'month' => isset($r['month']) ? $r['month'] : null,
                'year' => isset($r['year']) ? $r['year'] : null,
                'inicioSeq' => $r['inicioSeq'],
                'fimSeq' => $r['fimSeq'],
                'qtdRequisicoes' => isset($r['qtdRequisicoes']) ? $r['qtdRequisicoes'] : 1,
                'zona' => $r['zona'],
                'responsavel' => $r['responsavel'],
                'posto' => $r['posto'],
                'motorista' => $r['motorista'],
                'veiculo' => $r['veiculo'],
                'placa' => $r['placa'],
                'kmAnterior' => $r['kmAnterior'],
                'km' => $r['km'],
                'combustivel' => $r['combustivel'],
                'lote' => isset($r['lote']) ? $r['lote'] : 'LOTE 1',
                'litros' => $r['litros'],
                'precoLitro' => $r['precoLitro'],
                'valor' => $r['valor'],
                'environment' => isset($r['environment']) ? $r['environment'] : 'Frota Principal'
            ]);
            $insertedReqs++;
        }
    }

    // 4. Restaurar hml_veiculos_contratados
    $insertedVeic = 0;
    if (!empty($data['hml_veiculos_contratados']) && is_array($data['hml_veiculos_contratados'])) {
        $stmtVeic = $pdo->prepare("INSERT INTO $targetVeic 
            (id, tipo_veiculo, ano, placa, empresa, motorista, fone_motorista, local_atuacao, tipo_contrato, combustivel, environment)
            VALUES 
            (:id, :tipo_veiculo, :ano, :placa, :empresa, :motorista, :fone_motorista, :local_atuacao, :tipo_contrato, :combustivel, :environment)");
        
        foreach ($data['hml_veiculos_contratados'] as $v) {
            $stmtVeic->execute([
                'id' => $v['id'],
                'tipo_veiculo' => $v['tipo_veiculo'],
                'ano' => isset($v['ano']) ? $v['ano'] : '',
                'placa' => $v['placa'],
                'empresa' => $v['empresa'],
                'motorista' => isset($v['motorista']) ? $v['motorista'] : '',
                'fone_motorista' => isset($v['fone_motorista']) ? $v['fone_motorista'] : '',
                'local_atuacao' => isset($v['local_atuacao']) ? $v['local_atuacao'] : '',
                'tipo_contrato' => isset($v['tipo_contrato']) ? $v['tipo_contrato'] : 'ALUGADO',
                'combustivel' => isset($v['combustivel']) ? $v['combustivel'] : 'DIESEL',
                'environment' => isset($v['environment']) ? $v['environment'] : 'Frota Principal'
            ]);
            $insertedVeic++;
        }
    }

    $pdo->commit();

    writeAuditLog($pdo, 'RESTORE_HML_CHECKPOINT', [
        'checkpoint_file' => basename($filePath),
        'restored_requisicoes' => $insertedReqs,
        'restored_veiculos' => $insertedVeic
    ], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => "Restauração do checkpoint '$requestedFile' concluída com sucesso no ambiente HML!",
        'restored_counts' => [
            'requisicoes' => $insertedReqs,
            'veiculos_contratados' => $insertedVeic
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
