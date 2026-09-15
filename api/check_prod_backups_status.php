<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

try {
    $backupDir = __DIR__ . '/backups';
    $excelAnalysis = [];
    if (is_dir($backupDir)) {
        $files = scandir($backupDir);
        foreach ($files as $f) {
            if ($f === '.' || $f === '..') continue;
            $filePath = $backupDir . '/' . $f;
            if (is_file($filePath) && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'xlsx') {
                $rowCount = 0;
                $zip = new ZipArchive();
                if ($zip->open($filePath) === TRUE) {
                    $sheet5Index = $zip->locateName('xl/worksheets/sheet5.xml');
                    if ($sheet5Index !== FALSE) {
                        $xmlStr = $zip->getFromIndex($sheet5Index);
                        $xml = simplexml_load_string($xmlStr);
                        if ($xml && isset($xml->sheetData->row)) {
                            $rowCount = count($xml->sheetData->row) - 1;
                        }
                    }
                    $zip->close();
                }
                if ($rowCount > 0) {
                    $excelAnalysis[] = [
                        'file' => $f,
                        'size' => filesize($filePath),
                        'mtime' => date('Y-m-d H:i:s', filemtime($filePath)),
                        'launch_count' => $rowCount
                    ];
                }
            }
        }
    }

    // Ordenar por número de lançamentos decrescente
    usort($excelAnalysis, function($a, $b) {
        return $b['launch_count'] - $a['launch_count'];
    });

    echo json_encode([
        'success' => true,
        'total_excel_backups_found' => count($excelAnalysis),
        'top_largest_excel_backups' => array_slice($excelAnalysis, 0, 15)
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
