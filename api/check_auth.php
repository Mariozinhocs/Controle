<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

$isAuthenticated = isset($_SESSION['repo_authenticated']) && $_SESSION['repo_authenticated'] === true;

echo json_encode([
    'authenticated' => $isAuthenticated,
    'user' => $isAuthenticated ? $_SESSION['repo_user'] : null
]);
