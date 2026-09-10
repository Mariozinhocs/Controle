<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$env = isset($_GET['env']) ? trim($_GET['env']) : 'Frota Principal';

// 1. Agrupamento por lote na tabela hml_requisicoes
$stmt = $pdo->prepare("SELECT lote, COUNT(*) as total FROM $table_requisicoes WHERE environment = :env GROUP BY lote");
$stmt->execute(['env' => $env]);
$reqLotes = $stmt->fetchAll(PDO::FETCH_KEY_PAIR);

// 2. Agrupamento por lote nas custom_requisicoes da tabela hml_configuracoes
$stmtConfig = $pdo->prepare("SELECT custom_requisicoes FROM $table_configuracoes WHERE environment = :env");
$stmtConfig->execute(['env' => $env]);
$configRaw = $stmtConfig->fetchColumn();

$customReqsArr = json_decode($configRaw, true);
$customLotes = [];
if (is_array($customReqsArr)) {
    foreach ($customReqsArr as $cr) {
        if (is_string($cr) && preg_match('/\(LOTE\s*(\d+)\)/i', $cr, $m)) {
            $lName = "LOTE " . $m[1];
        } else {
            $lName = "Sem Lote Especificado / Padrão";
        }
        if (!isset($customLotes[$lName])) $customLotes[$lName] = 0;
        $customLotes[$lName]++;
    }
}

// 3. Checar o arquivo de backup diretamente se fornecido
$filename = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_08-09-2026_165208.xlsx';
$filePath = __DIR__ . '/backups/' . $filename;
if (!file_exists($filePath)) {
    $filePath = dirname(__DIR__, 2) . '/api/backups/' . $filename;
}

$xlsxLoteStats = [];
if (file_exists($filePath)) {
    $zip = new ZipArchive();
    if ($zip->open($filePath) === TRUE) {
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
        
        $sheet5Index = $zip->locateName('xl/worksheets/sheet5.xml');
        if ($sheet5Index !== FALSE) {
            $xmlStr = $zip->getFromIndex($sheet5Index);
            $xml = simplexml_load_string($xmlStr);
            $headers = [];
            if ($xml && isset($xml->sheetData->row)) {
                foreach ($xml->sheetData->row as $row) {
                    $rNum = (int)$row['r'];
                    if ($rNum === 1) {
                        foreach ($row->c as $c) {
                            $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                            $t = (string)$c['t'];
                            $v = (string)$c->v;
                            $headers[$col] = ($t === 's' && isset($sharedStrings[(int)$v])) ? $sharedStrings[(int)$v] : $v;
                        }
                    } else {
                        $loteVal = 'NÃO INFORMADO';
                        foreach ($row->c as $c) {
                            $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                            $hName = isset($headers[$col]) ? $headers[$col] : '';
                            if (trim($hName) === 'Lote') {
                                $t = (string)$c['t'];
                                $v = (string)$c->v;
                                $loteVal = ($t === 's' && isset($sharedStrings[(int)$v])) ? $sharedStrings[(int)$v] : $v;
                            }
                        }
                        if (!isset($xlsxLoteStats[$loteVal])) $xlsxLoteStats[$loteVal] = 0;
                        $xlsxLoteStats[$loteVal]++;
                    }
                }
            }
        }
        $zip->close();
    }
}

echo json_encode([
    'success' => true,
    'environment' => $env,
    'banco_hml_requisicoes_por_lote' => $reqLotes,
    'banco_hml_custom_requisicoes_por_lote' => $customLotes,
    'total_custom_requisicoes' => is_array($customReqsArr) ? count($customReqsArr) : 0,
    'excel_sheet5_lancamentos_por_lote' => $xlsxLoteStats
]);
