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

$sheet5Index = $zip->locateName('xl/worksheets/sheet5.xml');
$headers5 = [];
$rows5Data = [];
if ($sheet5Index !== FALSE) {
    $xmlStr = $zip->getFromIndex($sheet5Index);
    $xml = simplexml_load_string($xmlStr);
    if ($xml && isset($xml->sheetData->row)) {
        foreach ($xml->sheetData->row as $row) {
            $rNum = (int)$row['r'];
            if ($rNum === 1) {
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $headers5[$col] = getCellValue($c, $sharedStrings);
                }
            } else {
                $cells = [];
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $cells[$col] = getCellValue($c, $sharedStrings);
                }
                $rows5Data[] = $cells;
            }
        }
    }
}
$zip->close();

$sheet5LoteCounts = [];
$sampleLotes = [];
foreach ($rows5Data as $idx => $r) {
    $item = [];
    foreach ($headers5 as $col => $hName) {
        $item[$hName] = isset($r[$col]) ? $r[$col] : '';
    }
    $lVal = isset($item['Lote']) ? $item['Lote'] : (isset($item['lote']) ? $item['lote'] : 'Sem Coluna Lote');
    if (!isset($sheet5LoteCounts[$lVal])) $sheet5LoteCounts[$lVal] = 0;
    $sheet5LoteCounts[$lVal]++;
    if ($idx < 5) $sampleLotes[] = $item;
}

echo json_encode([
    'headers' => array_values($headers5),
    'sheet5_lote_counts' => $sheet5LoteCounts,
    'sample_first_5' => $sampleLotes
]);
