<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

// Validar se o usuário está autenticado
if (!isset($_SESSION['repo_authenticated']) || $_SESSION['repo_authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
$filename = isset($input['file']) ? trim($input['file']) : '';

if (empty($filename)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nome do arquivo não especificado']);
    exit;
}

// Higienizar e prevenir Directory Traversal
$filename = basename($filename);
$backupDir = __DIR__ . '/backups';
$filePath = $backupDir . '/' . $filename;

// Validar se o arquivo realmente existe e é do tipo correto
if (is_file($filePath)) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($ext !== 'xlsx') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Extensão de arquivo não permitida']);
        exit;
    }
    
    // Deletar o arquivo do disco
    if (unlink($filePath)) {
        echo json_encode(['success' => true, 'message' => 'Arquivo excluído com sucesso']);
    } else {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Falha ao tentar excluir o arquivo do servidor']);
    }
} else {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => 'Arquivo não encontrado']);
}
