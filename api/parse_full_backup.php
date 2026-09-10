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

// 1. Extrair Sheet 6 (Configuracoes)
$sheet6Index = $zip->locateName('xl/worksheets/sheet6.xml');
$headers6 = [];
$row6Data = [];
if ($sheet6Index !== FALSE) {
    $xmlStr = $zip->getFromIndex($sheet6Index);
    $xml = simplexml_load_string($xmlStr);
    if ($xml && isset($xml->sheetData->row)) {
        foreach ($xml->sheetData->row as $row) {
            $rNum = (int)$row['r'];
            if ($rNum === 1) {
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $headers6[$col] = getCellValue($c, $sharedStrings);
                }
            } elseif ($rNum === 2) {
                foreach ($row->c as $c) {
                    $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                    $row6Data[$col] = getCellValue($c, $sharedStrings);
                }
            }
        }
    }
}

$configObj = [];
foreach ($headers6 as $col => $name) {
    $val = isset($row6Data[$col]) ? $row6Data[$col] : '';
    $configObj[$name] = json_decode($val, true);
}

// 2. Extrair Sheet 5 (Banco de Dados Completo)
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

// Mapear rows 5 com cabeçalhos
$launcamentos = [];
foreach ($rows5Data as $r) {
    $item = [];
    foreach ($headers5 as $col => $hName) {
        $item[$hName] = isset($r[$col]) ? $r[$col] : '';
    }
    $launcamentos[] = $item;
}

// Estatísticas de custom_requisicoes
$customReqs = isset($configObj['custom_requisicoes']) && is_array($configObj['custom_requisicoes']) ? $configObj['custom_requisicoes'] : [];
$customLoteCounts = [];
foreach ($customReqs as $cr) {
    if (is_string($cr)) {
        if (preg_match('/\(LOTE\s*(\d+)\)/i', $cr, $m)) {
            $lName = "LOTE " . $m[1];
        } else {
            $lName = "Outros";
        }
    } elseif (is_array($cr) && isset($cr['lote'])) {
        $lName = $cr['lote'];
    } else {
        $lName = "Desconhecido";
    }
    if (!isset($customLoteCounts[$lName])) $customLoteCounts[$lName] = 0;
    $customLoteCounts[$lName]++;
}

echo json_encode([
    'success' => true,
    'file' => $filename,
    'total_launcamentos_sheet5' => count($launcamentos),
    'custom_bases_count' => count($configObj['custom_bases'] ?? []),
    'custom_postos_count' => count($configObj['custom_postos'] ?? []),
    'custom_motoristas_count' => count($configObj['custom_motoristas'] ?? []),
    'custom_veiculos_count' => count($configObj['custom_veiculos'] ?? []),
    'custom_requisicoes_count' => count($customReqs),
    'custom_requisicoes_lote_counts' => $customLoteCounts,
    'sample_sheet5_row' => isset($launcamentos[0]) ? $launcamentos[0] : null,
    'sample_custom_req' => isset($customReqs[0]) ? $customReqs[0] : null
]);
