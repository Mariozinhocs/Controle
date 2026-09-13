<?php
$filePath = __DIR__ . '/backup_today_11-09-2026.xlsx';
if (!file_exists($filePath)) {
    echo "File not found\n";
    exit;
}

$zip = new ZipArchive();
if ($zip->open($filePath) !== TRUE) {
    echo "Failed to open zip\n";
    exit;
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

$getVal = function($c, $ss) {
    $t = (string)$c['t']; $v = (string)$c->v;
    if ($t === 's') return isset($ss[(int)$v]) ? $ss[(int)$v] : '';
    return $v;
};

// Worksheets list
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
        $headers6 = []; $row6 = [];
        foreach ($xml->sheetData->row as $row) {
            $rNum = (int)$row['r'];
            if ($rNum === 1) {
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $headers6[$col] = trim($getVal($c, $sharedStrings));
                }
            } elseif ($rNum === 2) {
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $row6[$col] = trim($getVal($c, $sharedStrings));
                }
            }
        }
        foreach ($headers6 as $col => $name) {
            if ($name === 'custom_requisicoes') {
                $jsonStr = isset($row6[$col]) ? $row6[$col] : '[]';
                $arr = json_decode($jsonStr, true);
                $customReqsCount = is_array($arr) ? count($arr) : 0;
            }
        }
    }
}

$zip->close();

echo json_encode([
    'file' => basename($filePath),
    'size_mb' => round(filesize($filePath) / (1024 * 1024), 2),
    'mtime' => date('Y-m-d H:i:s', filemtime($filePath)),
    'total_lancamentos' => $sheet5Count,
    'total_requisicoes_customizadas' => $customReqsCount
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
