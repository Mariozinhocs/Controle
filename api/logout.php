<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

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
