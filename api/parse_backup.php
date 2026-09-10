<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$filename = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_09-09-2026_140513.xlsx';
$doRestore = isset($_GET['restore']) && $_GET['restore'] === 'true';
$env = isset($_GET['env']) ? trim($_GET['env']) : 'Frota Principal';

$filePath = __DIR__ . '/backups/' . $filename;
if (!file_exists($filePath)) {
    echo json_encode(['success' => false, 'message' => "Arquivo $filename não encontrado no servidor"]);
    exit;
}

$zip = new ZipArchive();
if ($zip->open($filePath) !== TRUE) {
    echo json_encode(['success' => false, 'message' => 'Não foi possível abrir o arquivo XLSX como ZIP']);
    exit;
}

// 1. Ler sharedStrings.xml
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

function parseSheet($zip, $sheetName, $sharedStrings) {
    $rowsData = [];
    if (($idx = $zip->locateName($sheetName)) === FALSE) {
        return $rowsData;
    }
    $xmlStr = $zip->getFromIndex($idx);
    $xml = simplexml_load_string($xmlStr);
    if (!$xml || !isset($xml->sheetData->row)) {
        return $rowsData;
    }
    
    foreach ($xml->sheetData->row as $row) {
        $rowNum = (int)$row['r'];
        $cells = [];
        foreach ($row->c as $c) {
            $colRef = (string)$c['r'];
            $colLetter = preg_replace('/[0-9]/', '', $colRef);
            $val = getCellValue($c, $sharedStrings);
            $cells[$colLetter] = $val;
        }
        $rowsData[$rowNum] = $cells;
    }
    return $rowsData;
}

// Procurar todas as planilhas dentro do arquivo ZIP
$sheetsFound = [];
for ($i = 0; $i < $zip->numFiles; $i++) {
    $stat = $zip->statIndex($i);
    if (strpos($stat['name'], 'xl/worksheets/sheet') === 0) {
        $sheetsFound[] = [
            'name' => $stat['name'],
            'size' => $stat['size']
        ];
    }
}

// Ordenar por tamanho decrescente
usort($sheetsFound, function($a, $b) {
    return $b['size'] - $a['size'];
});

if (empty($sheetsFound)) {
    echo json_encode(['success' => false, 'message' => 'Nenhuma planilha encontrada']);
    exit;
}

// Maior planilha é a de lançamentos
$mainSheetName = $sheetsFound[0]['name'];
$configSheetName = isset($sheetsFound[1]) ? $sheetsFound[1]['name'] : null;

$sheet1Rows = parseSheet($zip, $mainSheetName, $sharedStrings);

$configDataRaw = null;
if ($configSheetName) {
    $sheet2Rows = parseSheet($zip, $configSheetName, $sharedStrings);
}

$zip->close();

if (empty($sheet1Rows)) {
    echo json_encode(['success' => false, 'message' => "Planilha principal ($mainSheetName) vazia"]);
    exit;
}

// Reconstruir o cabeçalho
$headerRow1 = reset($sheet1Rows);
$headerMap1 = [];
foreach ($headerRow1 as $col => $val) {
    $headerMap1[$col] = trim($val);
}

$parsedRequisicoes = [];
$seqCounter = 1;

foreach ($sheet1Rows as $rowIdx => $row) {
    if ($rowIdx === 1) continue; // Pular linha 1 (cabeçalho)
    
    $record = [];
    $hasData = false;
    foreach ($row as $col => $val) {
        $colName = isset($headerMap1[$col]) ? $headerMap1[$col] : $col;
        $record[$colName] = $val;
        if ($val !== '' && $val !== null) $hasData = true;
    }
    if (!$hasData) continue;
    
    // Normalizar colunas de acordo com o cabeçalho gerado pelo app
    // seq, data, hora, base, posto, motorista, veiculo, placa, combustivel, litros, km, valor, lote, id, etc.
    $seqVal = null;
    foreach ($record as $k => $v) {
        $kl = mb_strtolower(trim($k));
        if ($kl === 'seq' || $kl === 'nº' || $kl === 'no' || $kl === 'numero') {
            $seqVal = intval($v);
            break;
        }
    }
    $seq = ($seqVal && $seqVal > 0) ? $seqVal : $seqCounter;
    $seqCounter = max($seqCounter, $seq + 1);

    // ID
    $reqId = null;
    foreach ($record as $k => $v) {
        $kl = mb_strtolower(trim($k));
        if ($kl === 'id' || $kl === 'req_id' || $kl === 'requisicao_id') {
            $reqId = trim($v);
            break;
        }
    }
    if (empty($reqId)) {
        $reqId = "REC-" . sprintf("%06d", $seq);
    }
    
    // Pegar demais campos flexivelmente
    $getVal = function($possibleKeys) use ($record) {
        foreach ($possibleKeys as $pk) {
            foreach ($record as $k => $v) {
                if (mb_strtolower(trim($k)) === mb_strtolower(trim($pk))) {
                    return trim($v);
                }
            }
        }
        return '';
    };
    
    $fecha = $getVal(['data', 'fecha', 'date']);
    $hora = $getVal(['hora', 'time']);
    $base = $getVal(['base', 'unidade']);
    $posto = $getVal(['posto', 'posto de combustivel']);
    $motorista = $getVal(['motorista', 'condutor']);
    $veiculo = $getVal(['veículo', 'veiculo', 'modelo']);
    $placa = $getVal(['placa']);
    $combustivel = $getVal(['combustível', 'combustivel', 'tipo de combustivel']);
    $litrosRaw = $getVal(['litros', 'qtd litros', 'quantidade']);
    $kmRaw = $getVal(['km', 'odometro', 'km atual']);
    $valorRaw = $getVal(['valor', 'valor total', 'valor (r$)', 'total']);
    $lote = $getVal(['lote', 'lote de abastecimento']);
    $status = $getVal(['status']);
    if (empty($status)) $status = 'Finalizado';
    
    $litros = floatval(str_replace(['.', ','], ['', '.'], $litrosRaw));
    $km = floatval(str_replace(['.', ','], ['', '.'], $kmRaw));
    $valor = floatval(str_replace(['.', ','], ['', '.'], $valorRaw));
    
    $parsedRequisicoes[] = [
        'id' => $reqId,
        'seq' => $seq,
        'data' => $fecha,
        'hora' => $hora,
        'base' => $base,
        'posto' => $posto,
        'motorista' => $motorista,
        'veiculo' => $veiculo,
        'placa' => $placa,
        'combustivel' => $combustivel,
        'litros' => $litros,
        'km' => $km,
        'valor' => $valor,
        'lote' => $lote,
        'status' => $status
    ];
}

// Deduplicação estrita
$cleanRequisicoes = [];
$seenSeqs = [];
$seenIds = [];
$loteStats = [];

foreach ($parsedRequisicoes as $r) {
    if (in_array($r['seq'], $seenSeqs) || in_array($r['id'], $seenIds)) {
        continue;
    }
    $seenSeqs[] = $r['seq'];
    $seenIds[] = $r['id'];
    $cleanRequisicoes[] = $r;
    
    $lKey = !empty($r['lote']) ? $r['lote'] : 'Sem Lote';
    if (!isset($loteStats[$lKey])) $loteStats[$lKey] = 0;
    $loteStats[$lKey]++;
}

// Se restore=true, efetuar restauração transacional
if ($doRestore) {
    $pdo->beginTransaction();
    try {
        // Limpar requisições anteriores para esse ambiente
        $stmtDel = $pdo->prepare("DELETE FROM $table_requisicoes WHERE environment = :env");
        $stmtDel->execute(['env' => $env]);
        
        $stmtIns = $pdo->prepare("INSERT INTO $table_requisicoes 
            (environment, req_id, seq, fecha, hora, base, posto, motorista, veiculo, placa, combustivel, litros, km, valor_total, lote, status, data_criacao)
            VALUES (:env, :req_id, :seq, :fecha, :hora, :base, :posto, :motorista, :veiculo, :placa, :combustivel, :litros, :km, :valor_total, :lote, :status, NOW())");
            
        foreach ($cleanRequisicoes as $cr) {
            $stmtIns->execute([
                'env' => $env,
                'req_id' => $cr['id'],
                'seq' => $cr['seq'],
                'fecha' => $cr['data'],
                'hora' => $cr['hora'],
                'base' => $cr['base'],
                'posto' => $cr['posto'],
                'motorista' => $cr['motorista'],
                'veiculo' => $cr['veiculo'],
                'placa' => $cr['placa'],
                'combustivel' => $cr['combustivel'],
                'litros' => $cr['litros'],
                'km' => $cr['km'],
                'valor_total' => $cr['valor'],
                'lote' => $cr['lote'],
                'status' => $cr['status']
            ]);
        }
        
        $pdo->commit();
        
        writeAuditLog($pdo, "Restauração de Backup Concluída", [
            'file' => $filename,
            'environment' => $env,
            'total_inserted' => count($cleanRequisicoes),
            'lote_stats' => $loteStats
        ], $env);
        
    } catch (Exception $ex) {
        $pdo->rollBack();
        echo json_encode(['success' => false, 'message' => 'Erro ao restaurar banco: ' . $ex->getMessage()]);
        exit;
    }
}

echo json_encode([
    'success' => true,
    'file' => $filename,
    'restored_to_db' => $doRestore,
    'main_sheet_used' => $mainSheetName,
    'total_raw_rows' => count($parsedRequisicoes),
    'total_clean_rows' => count($cleanRequisicoes),
    'lote_distribution' => $loteStats,
    'detected_headers' => array_values($headerMap1),
    'sample_first_3' => array_slice($cleanRequisicoes, 0, 3)
]);
