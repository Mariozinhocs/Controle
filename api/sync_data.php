<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

require_once __DIR__ . '/db.php';

$inputJSON = file_get_contents('php://input');
$input = json_decode($inputJSON, true);

if (!$input || !isset($input['environment'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Parâmetros inválidos']);
    exit;
}

$env = trim($input['environment']);
if (empty($env)) {
    $env = 'Frota Principal';
}

try {
    $reqsCount = isset($input['requisicoes']) && is_array($input['requisicoes']) ? count($input['requisicoes']) : 0;

    writeLog('INFO', "Início do processo de sincronização para o ambiente '$env'", [
        'environment' => $env,
        'requisicoes_count' => $reqsCount
    ]);

    // Trava de proteção anti-purga: Se o payload enviar 0 requisições e o banco de dados possuir registros ativos, bloqueia a zeragem acidental
    if ($reqsCount === 0 && (!isset($input['allow_empty_purge']) || $input['allow_empty_purge'] !== true)) {
        $stmtCheck = $pdo->prepare("SELECT COUNT(*) FROM $table_requisicoes WHERE environment = :env OR (:env = 'Frota Principal' AND (environment IS NULL OR environment = ''))");
        $stmtCheck->execute(['env' => $env]);
        $existingCount = (int)$stmtCheck->fetchColumn();

        if ($existingCount > 0) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'message' => 'Sincronização rejeitada por proteção anti-purga: O payload possui 0 lançamentos, mas o servidor possui ' . $existingCount . ' lançamentos ativos.'
            ], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $pdo->beginTransaction();

    // 1. Limpar lançamentos antigos deste ambiente (para substituir pelo novo estado enviado)
    $stmtDel = $pdo->prepare("DELETE FROM $table_requisicoes WHERE environment = :env");
    $stmtDel->execute(['env' => $env]);

    // 2. Inserir os novos lançamentos com trava estrita anti-duplicidade
    if (isset($input['requisicoes']) && is_array($input['requisicoes'])) {
        $stmtInsert = $pdo->prepare("INSERT INTO $table_requisicoes 
            (id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, kmAnterior, km, combustivel, litros, precoLitro, valor, lote, environment)
            VALUES 
            (:id, :date, :inicioSeq, :fimSeq, :qtdRequisicoes, :zona, :responsavel, :posto, :motorista, :veiculo, :placa, :kmAnterior, :km, :combustivel, :litros, :precoLitro, :valor, :lote, :env)");

        $seenSeqs = [];
        $seenIds = [];

        foreach ($input['requisicoes'] as $row) {
            $rowId = isset($row['id']) ? trim($row['id']) : '';
            $inicioSeq = isset($row['inicioSeq']) ? trim($row['inicioSeq']) : '';

            // Trava anti-duplicidade estrita
            if ($rowId !== '' && isset($seenIds[$rowId])) {
                continue;
            }
            if ($inicioSeq !== '' && isset($seenSeqs[$inicioSeq])) {
                continue;
            }

            if ($rowId !== '') $seenIds[$rowId] = true;
            if ($inicioSeq !== '') $seenSeqs[$inicioSeq] = true;

            $formattedDate = date('Y-m-d', strtotime($row['date']));

            $stmtInsert->execute([
                'id' => $row['id'],
                'date' => $formattedDate,
                'inicioSeq' => $inicioSeq,
                'fimSeq' => isset($row['fimSeq']) ? $row['fimSeq'] : '',
                'qtdRequisicoes' => isset($row['qtdRequisicoes']) ? intval($row['qtdRequisicoes']) : 1,
                'zona' => (isset($row['zona']) && $row['zona'] !== '') ? $row['zona'] : 'NÃO INFORMADO',
                'responsavel' => (isset($row['responsavel']) && $row['responsavel'] !== '') ? $row['responsavel'] : 'NÃO INFORMADO',
                'posto' => (isset($row['posto']) && $row['posto'] !== '') ? $row['posto'] : 'NÃO INFORMADO',
                'motorista' => (isset($row['motorista']) && $row['motorista'] !== '') ? $row['motorista'] : 'NÃO INFORMADO',
                'veiculo' => (isset($row['veiculo']) && $row['veiculo'] !== '') ? $row['veiculo'] : 'NÃO INFORMADO',
                'placa' => (isset($row['placa']) && $row['placa'] !== '') ? $row['placa'] : 'NÃO INFORMADO',
                'kmAnterior' => (isset($row['kmAnterior']) && $row['kmAnterior'] !== '' && $row['kmAnterior'] !== 'NÃO INFORMADO') ? intval($row['kmAnterior']) : null,
                'km' => (isset($row['km']) && $row['km'] !== '' && $row['km'] !== 'NÃO INFORMADO') ? intval($row['km']) : null,
                'combustivel' => (isset($row['combustivel']) && $row['combustivel'] !== '') ? $row['combustivel'] : 'NÃO INFORMADO',
                'litros' => isset($row['litros']) ? floatval($row['litros']) : 0.0,
                'precoLitro' => isset($row['precoLitro']) ? floatval($row['precoLitro']) : 0.0,
                'valor' => isset($row['valor']) ? floatval($row['valor']) : 0.0,
                'lote' => (isset($row['lote']) && $row['lote'] !== '') ? $row['lote'] : 'LOTE 1',
                'env' => $env
            ]);
        }
    }

    // 3. Atualizar configurações do ambiente
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
        'bases' => isset($input['custom_bases']) ? json_encode($input['custom_bases']) : '[]',
        'postos' => isset($input['custom_postos']) ? json_encode($input['custom_postos']) : '[]',
        'motoristas' => isset($input['custom_motoristas']) ? json_encode($input['custom_motoristas']) : '[]',
        'veiculos' => isset($input['custom_veiculos']) ? json_encode($input['custom_veiculos']) : '[]',
        'requisicoes' => isset($input['custom_requisicoes']) ? json_encode($input['custom_requisicoes']) : '[]'
    ]);

    $pdo->commit();

    // Grava auditoria no MySQL
    writeAuditLog($pdo, "Sincronização de Dados Realizada", [
        'environment' => $env,
        'requisicoes_count' => isset($input['requisicoes']) ? count($input['requisicoes']) : 0
    ], $env);

    echo json_encode(['success' => true, 'message' => 'Dados sincronizados com sucesso no MySQL!']);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    writeLog('ERROR', "Erro na sincronização de dados: " . $e->getMessage(), [
        'environment' => $env
    ]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro na sincronização: ' . $e->getMessage()]);
}
