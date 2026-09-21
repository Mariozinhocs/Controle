<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

try {
    // Definir nomes de tabelas de HML
    $targetConfig = 'hml_configuracoes';
    $targetReq = 'hml_requisicoes';
    $targetVeic = 'hml_veiculos_contratados';

    // 1. Extrair hml_configuracoes
    $stmtConf = $pdo->query("SELECT * FROM $targetConfig");
    $configRows = $stmtConf->fetchAll(PDO::FETCH_ASSOC);

    // 2. Extrair hml_requisicoes
    $stmtReq = $pdo->query("SELECT * FROM $targetReq ORDER BY date ASC, id ASC");
    $reqRows = $stmtReq->fetchAll(PDO::FETCH_ASSOC);

    // 3. Extrair hml_veiculos_contratados
    $stmtVeic = $pdo->query("SELECT * FROM $targetVeic ORDER BY id ASC");
    $veicRows = $stmtVeic->fetchAll(PDO::FETCH_ASSOC);

    $checkpointData = [
        'metadata' => [
            'name' => 'Checkpoint Oficial HML - Validação Concluída',
            'timestamp' => date('c'),
            'author' => 'Mario Henrique (mariozinhocs)',
            'counts' => [
                'configuracoes' => count($configRows),
                'requisicoes' => count($reqRows),
                'veiculos_contratados' => count($veicRows)
            ]
        ],
        'hml_configuracoes' => $configRows,
        'hml_requisicoes' => $reqRows,
        'hml_veiculos_contratados' => $veicRows
    ];

    $backupsDir = __DIR__ . '/backups';
    if (!is_dir($backupsDir)) {
        @mkdir($backupsDir, 0755, true);
    }

    $jsonContent = json_encode($checkpointData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    
    $fileOfficial = $backupsDir . '/hml_checkpoint_official.json';
    $fileDated = $backupsDir . '/hml_checkpoint_' . date('Y-m-d_His') . '.json';

    file_put_contents($fileOfficial, $jsonContent);
    file_put_contents($fileDated, $jsonContent);

    writeAuditLog($pdo, 'CREATE_HML_CHECKPOINT', [
        'official_file' => basename($fileOfficial),
        'dated_file' => basename($fileDated),
        'counts' => $checkpointData['metadata']['counts']
    ], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => 'Checkpoint oficial de HML criado com sucesso!',
        'checkpoint' => $checkpointData['metadata'],
        'files_saved' => [
            basename($fileOfficial),
            basename($fileDated)
        ]
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
