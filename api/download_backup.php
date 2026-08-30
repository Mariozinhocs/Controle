<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();

require_once __DIR__ . '/db.php'; // Carrega logger.php e conexão PDO

// Validar se o usuário está autenticado
if (!isset($_SESSION['repo_authenticated']) || $_SESSION['repo_authenticated'] !== true) {
    writeLog('WARN', "Tentativa não autorizada de baixar backup");
    http_response_code(401);
    echo "Não autorizado. Por favor, faça login.";
    exit;
}

$filename = isset($_GET['file']) ? trim($_GET['file']) : '';

if (empty($filename)) {
    http_response_code(400);
    echo "Nome do arquivo não especificado.";
    exit;
}

// Higienizar e prevenir Directory Traversal
$filename = basename($filename);
$backupDir = __DIR__ . '/backups';
$filePath = $backupDir . '/' . $filename;

// Validar se o arquivo existe e possui a extensão correta
if (is_file($filePath)) {
    $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($ext !== 'xlsx') {
        http_response_code(400);
        echo "Extensão de arquivo não permitida.";
        exit;
    }
    
    // Configurar headers para forçar download seguro do arquivo Excel
    header('Content-Description: File Transfer');
    header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    header('Content-Disposition: attachment; filename="' . $filename . '"');
    header('Expires: 0');
    header('Cache-Control: must-revalidate');
    header('Pragma: public');
    header('Content-Length: ' . filesize($filePath));
    
    // Limpar output buffer para evitar arquivos corrompidos
    cleanAllOutputBuffers();
    
    // Gravar log de auditoria
    writeAuditLog($pdo, "Download de Backup", [
        'filename' => $filename,
        'operator' => $_SESSION['repo_user'] ?? 'N/A'
    ]);
    
    // Ler e entregar o arquivo
    readfile($filePath);
    exit;
} else {
    http_response_code(404);
    echo "Arquivo não encontrado.";
    exit;
}

// Função auxiliar para limpar todos os buffers ativos de saída do PHP
function cleanAllOutputBuffers() {
    while (ob_get_level() > 0) {
        ob_end_clean();
    }
}
