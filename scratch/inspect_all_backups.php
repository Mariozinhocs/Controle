<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$backupDirs = [
    __DIR__ . '/backups',
    dirname(__DIR__) . '/backups',
    dirname(__DIR__, 2) . '/api/backups'
];

$files = [];
foreach ($backupDirs as $dir) {
    if (is_dir($dir)) {
        $found = glob($dir . '/*.xlsx');
        if (!empty($found)) {
            $files = array_merge($files, $found);
        }
    }
}
$files = array_unique($files);

$results = [];

foreach ($files as $filePath) {
    $filename = basename($filePath);
    $zip = new ZipArchive();
    if ($zip->open($filePath) !== TRUE) {
        continue;
    }
    
    $sharedStrings = [];
    if (($ssIndex = $zip->locateName('xl/sharedStrings.xml')) !== FALSE) {
        $xmlStr = $zip->getFromIndex($ssIndex);
        $xml = simplexml_load_string($xmlStr);
        if ($xml && isset($xml->si)) {
            foreach ($xml->si as $si) {
                if (isset($si->t)) $sharedStrings[] = (string)$si->t;
                elseif (isset($si->r)) {
                    $text = '';
                    foreach ($si->r as $r) $text .= (string)$r->t;
                    $sharedStrings[] = $text;
                } else $sharedStrings[] = '';
            }
        }
    }
    
    $sheet5Count = 0;
    $sheet5Index = $zip->locateName('xl/worksheets/sheet5.xml');
    if ($sheet5Index !== FALSE) {
        $xmlStr = $zip->getFromIndex($sheet5Index);
        $xml = simplexml_load_string($xmlStr);
        if ($xml && isset($xml->sheetData->row)) {
            $sheet5Count = max(0, count($xml->sheetData->row) - 1);
        }
    }
    
    $customReqsCount = 0;
    $sheet6Index = $zip->locateName('xl/worksheets/sheet6.xml');
    if ($sheet6Index !== FALSE) {
        $xmlStr = $zip->getFromIndex($sheet6Index);
        $xml = simplexml_load_string($xmlStr);
        if ($xml && isset($xml->sheetData->row)) {
            $headers = [];
            $row2 = [];
            foreach ($xml->sheetData->row as $row) {
                $rNum = (int)$row['r'];
                if ($rNum === 1) {
                    foreach ($row->c as $c) {
                        $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                        $t = (string)$c['t']; $v = (string)$c->v;
                        $headers[$col] = ($t === 's' && isset($sharedStrings[(int)$v])) ? $sharedStrings[(int)$v] : $v;
                    }
                } elseif ($rNum === 2) {
                    foreach ($row->c as $c) {
                        $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                        $t = (string)$c['t']; $v = (string)$c->v;
                        $row2[$col] = ($t === 's' && isset($sharedStrings[(int)$v])) ? $sharedStrings[(int)$v] : $v;
                    }
                }
            }
            foreach ($headers as $col => $name) {
                if ($name === 'custom_requisicoes') {
                    $jsonStr = isset($row2[$col]) ? $row2[$col] : '[]';
                    $arr = json_decode($jsonStr, true);
                    $customReqsCount = is_array($arr) ? count($arr) : 0;
                }
            }
        }
    }
    
    $zip->close();
    
    $results[] = [
        'file' => $filename,
        'size_kb' => round(filesize($filePath) / 1024, 2),
        'mtime' => date('Y-m-d H:i:s', filemtime($filePath)),
        'sheet5_lancamentos' => $sheet5Count,
        'custom_requisicoes' => $customReqsCount
    ];
}

usort($results, function($a, $b) {
    return strcmp($b['mtime'], $a['mtime']);
});

echo json_encode(['backups' => array_slice($results, 0, 30)], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
