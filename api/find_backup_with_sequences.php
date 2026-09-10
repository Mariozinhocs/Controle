<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$searchTerms = [
    '1788275751235',
    '1788275524001',
    '1788275566848',
    '1788275438090',
    '1788275400861',
    '1788274896260',
    '1788275',
    '1788274'
];

$backupDir = __DIR__ . '/backups';
$matchingBackups = [];

if (is_dir($backupDir)) {
    $files = scandir($backupDir);
    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        $filePath = $backupDir . '/' . $f;
        if (is_file($filePath) && strtolower(pathinfo($f, PATHINFO_EXTENSION)) === 'xlsx') {
            $zip = new ZipArchive();
            if ($zip->open($filePath) === TRUE) {
                $foundMatches = [];
                for ($i = 0; $i < $zip->numFiles; $i++) {
                    $content = $zip->getFromIndex($i);
                    foreach ($searchTerms as $term) {
                        if (strpos($content, $term) !== FALSE) {
                            $foundMatches[$term] = true;
                        }
                    }
                }
                $zip->close();
                
                if (!empty($foundMatches)) {
                    $mtime = filemtime($filePath);
                    $matchingBackups[] = [
                        'file' => $f,
                        'mtime' => date('Y-m-d H:i:s', $mtime),
                        'size' => filesize($filePath),
                        'matched_terms' => array_keys($foundMatches)
                    ];
                }
            }
        }
    }
}

// Ordenar do mais recente para o mais antigo
usort($matchingBackups, function($a, $b) {
    return strcmp($b['mtime'], $a['mtime']);
});

echo json_encode([
    'success' => true,
    'total_matches' => count($matchingBackups),
    'backups' => $matchingBackups
]);
