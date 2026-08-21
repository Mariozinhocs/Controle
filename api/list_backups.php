<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

session_start();
header('Content-Type: application/json');

// Validar se o usuário está autenticado no repositório
if (!isset($_SESSION['repo_authenticated']) || $_SESSION['repo_authenticated'] !== true) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Não autorizado']);
    exit;
}

$backupDir = __DIR__ . '/backups';
$backups = [];

if (is_dir($backupDir)) {
    $files = scandir($backupDir);
    
    foreach ($files as $file) {
        if ($file === '.' || $file === '..') continue;
        
        $filePath = $backupDir . '/' . $file;
        if (is_file($filePath)) {
            $ext = strtolower(pathinfo($file, PATHINFO_EXTENSION));
            // Apenas planilhas Excel são listadas
            if ($ext === 'xlsx') {
                $mtime = filemtime($filePath); // Data de modificação
                $sizeBytes = filesize($filePath);
                
                // Formatação do tamanho
                if ($sizeBytes >= 1048576) {
                    $formattedSize = round($sizeBytes / 1048576, 2) . ' MB';
                } elseif ($sizeBytes >= 1024) {
                    $formattedSize = round($sizeBytes / 1024, 2) . ' KB';
                } else {
                    $formattedSize = $sizeBytes . ' B';
                }
                
                $backups[] = [
                    'name' => $file,
                    'mtime' => $mtime,
                    'formatted_date' => date('d/m/Y H:i:s', $mtime),
                    'size' => $sizeBytes,
                    'formatted_size' => $formattedSize
                ];
            }
        }
    }
}

// Ordenar em ordem decrescente por mtime (Data de Envio)
usort($backups, function($a, $b) {
    return $b['mtime'] - $a['mtime'];
});

echo json_encode(['success' => true, 'backups' => $backups]);
