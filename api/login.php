<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$username = isset($input['username']) ? trim($input['username']) : '';
$password = isset($input['password']) ? $input['password'] : '';

if (empty($username) || empty($password)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Usuário e senha são obrigatórios']);
    exit;
}

// Credenciais cadastradas para o repositório
$users = [
    'admin' => 'anorak2026',
    'Marcela' => 'ctrl2026mgp1001',
    'marcela' => 'ctrl2026mgp1001'
];

if (isset($users[$username]) && $users[$username] === $password) {
    $_SESSION['repo_authenticated'] = true;
    $_SESSION['repo_user'] = $username;
    
    echo json_encode(['success' => true, 'message' => 'Autenticado com sucesso']);
} else {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Usuário ou senha incorretos']);
}
