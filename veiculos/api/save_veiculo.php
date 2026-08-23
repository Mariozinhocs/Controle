<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../api/db.php';

// Ler corpo da requisição JSON
$inputData = json_decode(file_get_contents("php://input"), true);

if (!$inputData) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Corpo de requisição inválido.']);
    exit;
}

$id = isset($inputData['id']) ? intval($inputData['id']) : 0;
$tipo_veiculo = isset($inputData['tipo_veiculo']) ? trim($inputData['tipo_veiculo']) : '';
$ano = isset($inputData['ano']) ? trim($inputData['ano']) : '';
$placa = isset($inputData['placa']) ? strtoupper(trim($inputData['placa'])) : '';
$empresa = isset($inputData['empresa']) ? trim($inputData['empresa']) : '';
$motorista = isset($inputData['motorista']) ? trim($inputData['motorista']) : '';
$fone_motorista = isset($inputData['fone_motorista']) ? trim($inputData['fone_motorista']) : '';
$local_atuacao = isset($inputData['local_atuacao']) ? trim($inputData['local_atuacao']) : '';
$tipo_contrato = isset($inputData['tipo_contrato']) ? trim($inputData['tipo_contrato']) : 'ALUGADO';
$combustivel = isset($inputData['combustivel']) ? trim($inputData['combustivel']) : 'DIESEL';
$environment = isset($inputData['environment']) ? trim($inputData['environment']) : 'Frota Principal';

if (empty($tipo_veiculo) || empty($placa) || empty($empresa)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Tipo de veículo, placa e empresa são obrigatórios.']);
    exit;
}

try {
    if ($id > 0) {
        // Atualiza veículo contratado existente
        $stmt = $pdo->prepare("
            UPDATE $table_veiculos_contratados 
            SET tipo_veiculo = :tipo_veiculo,
                ano = :ano,
                placa = :placa,
                empresa = :empresa,
                motorista = :motorista,
                fone_motorista = :fone_motorista,
                local_atuacao = :local_atuacao,
                tipo_contrato = :tipo_contrato,
                combustivel = :combustivel,
                environment = :environment
            WHERE id = :id
        ");
        $stmt->execute([
            'tipo_veiculo' => $tipo_veiculo,
            'ano' => $ano,
            'placa' => $placa,
            'empresa' => $empresa,
            'motorista' => $motorista,
            'fone_motorista' => $fone_motorista,
            'local_atuacao' => $local_atuacao,
            'tipo_contrato' => $tipo_contrato,
            'combustivel' => $combustivel,
            'environment' => $environment,
            'id' => $id
        ]);
    } else {
        // Insere novo veículo contratado
        $stmt = $pdo->prepare("
            INSERT INTO $table_veiculos_contratados (
                tipo_veiculo, ano, placa, empresa, motorista, fone_motorista, local_atuacao, tipo_contrato, combustivel, environment
            ) VALUES (
                :tipo_veiculo, :ano, :placa, :empresa, :motorista, :fone_motorista, :local_atuacao, :tipo_contrato, :combustivel, :environment
            )
        ");
        $stmt->execute([
            'tipo_veiculo' => $tipo_veiculo,
            'ano' => $ano,
            'placa' => $placa,
            'empresa' => $empresa,
            'motorista' => $motorista,
            'fone_motorista' => $fone_motorista,
            'local_atuacao' => $local_atuacao,
            'tipo_contrato' => $tipo_contrato,
            'combustivel' => $combustivel,
            'environment' => $environment
        ]);
    }

    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao salvar veículo: ' . $e->getMessage()]);
}
