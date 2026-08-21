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
    $stmt = $pdo->prepare("DELETE FROM veiculos_contratados WHERE id = :id");
    $stmt->execute(['id' => $id]);
    echo json_encode(['success' => true]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao deletar veículo: ' . $e->getMessage()]);
}
