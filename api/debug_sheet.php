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

$results = [];

for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    $name = $stat['name'];
    if (strpos($name, 'xl/worksheets/sheet') === 0) {
        $xmlStr = $zip->getFromIndex($i);
        $xml = simplexml_load_string($xmlStr);
        $rowCount = 0;
        $first3 = [];
        if ($xml && isset($xml->sheetData->row)) {
            $rowCount = count($xml->sheetData->row);
            $cIndex = 0;
            foreach ($xml->sheetData->row as $row) {
                $cIndex++;
                if ($cIndex > 4) break;
                $cells = [];
                foreach ($row->c as $c) {
                    $colRef = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $cells[$colRef] = getCellValue($c, $sharedStrings);
                }
                $first3[] = $cells;
            }
        }
        $results[] = [
            'sheet' => $name,
            'size' => $stat['size'],
            'rows' => $rowCount,
            'first_4_rows' => $first3
        ];
    }
}

$zip->close();

echo json_encode(['success' => true, 'sheets' => $results]);
