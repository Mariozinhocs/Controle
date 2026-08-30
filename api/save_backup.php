<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json');

require_once __DIR__ . '/db.php'; // Carrega logger.php e conexão PDO

// Permitir apenas requisições POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Método não permitido']);
    exit;
}

if (!isset($_FILES['backup_file'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Nenhum arquivo enviado']);
    exit;
}

$file = $_FILES['backup_file'];

// Validar se houve erro no envio
if ($file['error'] !== UPLOAD_ERR_OK) {
    writeLog('ERROR', "Erro no upload do arquivo de backup: " . $file['error']);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro no upload do arquivo: ' . $file['error']]);
    exit;
}

// Validar extensão (apenas .xlsx)
$ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
if ($ext !== 'xlsx') {
    writeLog('WARN', "Tentativa de upload de formato inválido: " . $file['name']);
    http_response_code(400);
    echo json_encode(['success' => false, 'message' => 'Formato de arquivo inválido. Apenas .xlsx é permitido.']);
    exit;
}

// Diretório de backups
$backupDir = __DIR__ . '/backups';

// Capturar e higienizar ambiente
$env = isset($_POST['env']) ? trim($_POST['env']) : 'Frota Principal';
$envSanitized = preg_replace('/[^a-zA-Z0-9_\-]/', '_', str_replace(' ', '_', $env));

// Criar o diretório de backups se não existir
if (!is_dir($backupDir)) {
    if (!mkdir($backupDir, 0755, true)) {
        writeLog('ERROR', "Falha ao criar diretório de backups no servidor");
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Falha ao criar diretório de backups no servidor']);
        exit;
    }
}

// Higienizar nome do arquivo
$filename = basename($file['name']);
$filename = preg_replace('/[^a-zA-Z0-9_\-\.]/', '', $filename);

$destination = $backupDir . '/' . $filename;

// Mover arquivo temporário para o destino final
if (move_uploaded_file($file['tmp_name'], $destination)) {
    // Sobrescrever o arquivo de dados correspondente no diretório pai para manter a base atualizada
    $mainDir = dirname(__DIR__);
    $mainFile = ($envSanitized === 'Frota_Principal' || $envSanitized === 'Padrao') ? 'dados.xlsx' : "dados_{$envSanitized}.xlsx";
    @copy($destination, $mainDir . '/' . $mainFile);

    // Limpeza automática de backups antigos (Opção A: mais de 60 dias, mantendo dia 01)
    try {
        $allBackups = glob($backupDir . '/*.xlsx');
        $sixtyDaysAgo = time() - (60 * 24 * 3600);
        foreach ($allBackups as $backupFile) {
            if (!is_file($backupFile)) continue;
            $mtime = filemtime($backupFile);
            if ($mtime < $sixtyDaysAgo) {
                $isFirstOfMonth = false;
                $baseName = basename($backupFile);
                if (preg_match('/_(\d{2})-\d{2}-\d{4}_\d{6}\.xlsx$/i', $baseName, $matches)) {
                    if ($matches[1] === '01') {
                        $isFirstOfMonth = true;
                    }
                } else {
                    if (date('d', $mtime) === '01') {
                        $isFirstOfMonth = true;
                    }
                }
                if (!$isFirstOfMonth) {
                    @unlink($backupFile);
                }
            }
        }
    } catch (Exception $ex) {
        // Ignora
    }

    // Gravar logs de auditoria
    writeAuditLog($pdo, "Envio e Salvamento de Backup", [
        'filename' => $filename,
        'environment' => $env
    ], $env);

    echo json_encode(['success' => true, 'message' => 'Backup salvo com sucesso no servidor!', 'file' => $filename]);
} else {
    writeLog('ERROR', "Falha ao mover arquivo temporário de backup para o destino final", [
        'destination' => $destination
    ]);
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Falha ao salvar o arquivo no diretório de destino']);
}
