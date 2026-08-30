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

$inputData = json_decode(file_get_contents("php://input"), true);

if (!$inputData || !isset($inputData['id'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Dados de entrada inválidos.']);
    exit;
}

$id = intval($inputData['id']);

try {
    // Buscar a placa/detalhes antes de excluir para auditoria
    $stmtFind = $pdo->prepare("SELECT placa, environment FROM $table_veiculos_contratados WHERE id = :id");
    $stmtFind->execute(['id' => $id]);
    $veic = $stmtFind->fetch();
    $placa = $veic ? $veic['placa'] : 'N/A';
    $env = $veic ? $veic['environment'] : 'Frota Principal';

    $stmt = $pdo->prepare("DELETE FROM $table_veiculos_contratados WHERE id = :id");
    $stmt->execute(['id' => $id]);
    
    writeAuditLog($pdo, "Exclusão de Veículo Contratado", [
        'id' => $id,
        'placa' => $placa
    ], $env);
    
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    writeLog('ERROR', "Erro ao deletar veículo contratado ID $id: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao deletar veículo: ' . $e->getMessage()]);
}
