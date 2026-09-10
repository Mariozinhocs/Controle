<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json');
require_once __DIR__ . '/db.php';

$action = isset($_GET['action']) ? $_GET['action'] : 'list';
$backupDir = __DIR__ . '/backups';

if ($action === 'list') {
    $files = [];
    if (is_dir($backupDir)) {
        foreach (scandir($backupDir) as $f) {
            if ($f === '.' || $f === '..') continue;
            $files[] = [
                'name' => $f,
                'size' => filesize($backupDir . '/' . $f),
                'mtime' => date('Y-m-d H:i:s', filemtime($backupDir . '/' . $f))
            ];
        }
    }
    // Também checar se existe dados.xlsx na raiz
    $mainDir = dirname(__DIR__);
    $mainDados = $mainDir . '/dados.xlsx';
    $mainExists = file_exists($mainDados);
    
    echo json_encode([
        'success' => true,
        'backup_dir' => $backupDir,
        'files' => $files,
        'dados_xlsx_exists' => $mainExists,
        'dados_xlsx_size' => $mainExists ? filesize($mainDados) : 0,
        'dados_xlsx_mtime' => $mainExists ? date('Y-m-d H:i:s', filemtime($mainDados)) : null
    ]);
    exit;
}

if ($action === 'download' || $action === 'raw') {
    $file = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_09-09-2026_140513.xlsx';
    $filePath = $backupDir . '/' . $file;
    
    if (!file_exists($filePath)) {
        // Tentar na raiz se for dados.xlsx
        if ($file === 'dados.xlsx') {
            $filePath = dirname(__DIR__) . '/dados.xlsx';
        }
    }
    
    if (!file_exists($filePath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => "Arquivo $file não encontrado"]);
        exit;
    }
    
    if ($action === 'raw') {
        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header('Content-Length: ' . filesize($filePath));
        readfile($filePath);
        exit;
    }
    
    // Retornar em base64 se solicitado via json
    echo json_encode([
        'success' => true,
        'filename' => $file,
        'size' => filesize($filePath),
        'base64' => base64_encode(file_get_contents($filePath))
    ]);
    exit;
}
