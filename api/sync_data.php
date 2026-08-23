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
    $pdo->beginTransaction();

    // 1. Limpar lançamentos antigos deste ambiente (para substituir pelo novo estado enviado)
    $stmtDel = $pdo->prepare("DELETE FROM $table_requisicoes WHERE environment = :env");
    $stmtDel->execute(['env' => $env]);

    // 2. Inserir os novos lançamentos
    if (isset($input['requisicoes']) && is_array($input['requisicoes'])) {
        $stmtInsert = $pdo->prepare("INSERT INTO $table_requisicoes 
            (id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, kmAnterior, km, combustivel, litros, precoLitro, valor, environment)
            VALUES 
            (:id, :date, :inicioSeq, :fimSeq, :qtdRequisicoes, :zona, :responsavel, :posto, :motorista, :veiculo, :placa, :kmAnterior, :km, :combustivel, :litros, :precoLitro, :valor, :env)");

        foreach ($input['requisicoes'] as $row) {
            $formattedDate = date('Y-m-d', strtotime($row['date']));

            $stmtInsert->execute([
                'id' => $row['id'],
                'date' => $formattedDate,
                'inicioSeq' => isset($row['inicioSeq']) ? $row['inicioSeq'] : '',
                'fimSeq' => isset($row['fimSeq']) ? $row['fimSeq'] : '',
                'qtdRequisicoes' => isset($row['qtdRequisicoes']) ? intval($row['qtdRequisicoes']) : 1,
                'zona' => isset($row['zona']) ? $row['zona'] : 'Não Informado',
                'responsavel' => isset($row['responsavel']) ? $row['responsavel'] : 'Não Informado',
                'posto' => isset($row['posto']) ? $row['posto'] : 'Não Informado',
                'motorista' => isset($row['motorista']) ? $row['motorista'] : 'Não Informado',
                'veiculo' => isset($row['veiculo']) ? $row['veiculo'] : 'Não Informado',
                'placa' => isset($row['placa']) ? $row['placa'] : '',
                'kmAnterior' => (isset($row['kmAnterior']) && $row['kmAnterior'] !== '') ? intval($row['kmAnterior']) : null,
                'km' => (isset($row['km']) && $row['km'] !== '') ? intval($row['km']) : null,
                'combustivel' => isset($row['combustivel']) ? $row['combustivel'] : 'Não Informado',
                'litros' => isset($row['litros']) ? floatval($row['litros']) : 0.0,
                'precoLitro' => isset($row['precoLitro']) ? floatval($row['precoLitro']) : 0.0,
                'valor' => isset($row['valor']) ? floatval($row['valor']) : 0.0,
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
    echo json_encode(['success' => true, 'message' => 'Dados sincronizados com sucesso no MySQL!']);
} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro na sincronização: ' . $e->getMessage()]);
}
