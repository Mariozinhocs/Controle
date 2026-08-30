<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

require_once __DIR__ . '/db.php'; // Carrega logger.php e conexão PDO

if (isset($_SESSION['repo_authenticated']) && $_SESSION['repo_authenticated'] === true) {
    writeAuditLog($pdo, "Encerramento de sessão (Logout) no Repositório de Backups", [
        'username' => $_SESSION['repo_user'] ?? 'N/A'
    ]);
}

// Destruir todas as variáveis de sessão
$_SESSION = array();

// Excluir cookie de sessão se necessário
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000,
        $params["path"], $params["domain"],
        $params["secure"], $params["httponly"]
    );
}

// Destruir a sessão
session_destroy();

echo json_encode(['success' => true]);
