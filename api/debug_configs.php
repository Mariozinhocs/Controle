<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$filename = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_09-09-2026_140513.xlsx';
$filePath = __DIR__ . '/backups/' . $filename;

$zip = new ZipArchive();
if ($zip->open($filePath) !== TRUE) {
    echo json_encode(['success' => false, 'message' => 'Cannot open zip']);
    exit;
}

$sharedStrings = [];
if (($ssIndex = $zip->locateName('xl/sharedStrings.xml')) !== FALSE) {
    $xmlStr = $zip->getFromIndex($ssIndex);
    $xml = simplexml_load_string($xmlStr);
    if ($xml && isset($xml->si)) {
        foreach ($xml->si as $si) {
            if (isset($si->t)) {
                $sharedStrings[] = (string)$si->t;
            } elseif (isset($si->r)) {
                $text = '';
                foreach ($si->r as $r) {
                    $text .= (string)$r->t;
                }
                $sharedStrings[] = $text;
            } else {
                $sharedStrings[] = '';
            }
        }
    }
}

function getCellValue($c, $sharedStrings) {
    $t = (string)$c['t'];
    $v = (string)$c->v;
    if ($t === 's') {
        $idx = intval($v);
        return isset($sharedStrings[$idx]) ? $sharedStrings[$idx] : '';
    }
    if ($t === 'inlineStr' && isset($c->is->t)) {
        return (string)$c->is->t;
    }
    return $v;
}

$sheet6Index = $zip->locateName('xl/worksheets/sheet6.xml');
if ($sheet6Index === FALSE) {
    echo json_encode(['success' => false, 'message' => 'sheet6.xml not found']);
    exit;
}

$xmlStr = $zip->getFromIndex($sheet6Index);
$xml = simplexml_load_string($xmlStr);

$headers = [];
$configRow = [];

if ($xml && isset($xml->sheetData->row)) {
    foreach ($xml->sheetData->row as $row) {
        $rNum = (int)$row['r'];
        if ($rNum === 1) {
            foreach ($row->c as $c) {
                $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                $headers[$col] = getCellValue($c, $sharedStrings);
            }
        } elseif ($rNum === 2) {
            foreach ($row->c as $c) {
                $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                $configRow[$col] = getCellValue($c, $sharedStrings);
            }
        }
    }
}

$zip->close();

$configMapped = [];
foreach ($headers as $col => $name) {
    $val = isset($configRow[$col]) ? $configRow[$col] : '';
    $jsonObj = json_decode($val, true);
    $configMapped[$name] = [
        'length' => strlen($val),
        'is_json' => ($jsonObj !== null),
        'item_count' => is_array($jsonObj) ? count($jsonObj) : null,
        'preview' => is_array($jsonObj) ? array_slice($jsonObj, 0, 3) : substr($val, 0, 100)
    ];
}

echo json_encode(['success' => true, 'config' => $configMapped]);
