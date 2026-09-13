<?php
header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

// 1. Ler dados do Backup de Ontem (08-09-2026_165208.xlsx)
$yesterdayFile = __DIR__ . '/backups/backup_controle_Frota_Principal_08-09-2026_165208.xlsx';
if (!file_exists($yesterdayFile)) {
    $yesterdayFile = dirname(__DIR__, 2) . '/api/backups/backup_controle_Frota_Principal_08-09-2026_165208.xlsx';
}

function parseWorkbookLotes($filePath) {
    if (!file_exists($filePath)) return null;
    $zip = new ZipArchive();
    if ($zip->open($filePath) !== TRUE) return null;
    
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
    
    // Sheet 5 (Lançamentos)
    $sheet5Index = $zip->locateName('xl/worksheets/sheet5.xml');
    $rows = [];
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
                        $headers[$col] = trim($getVal($c, $sharedStrings));
                    }
                } else {
                    $cells = [];
                    foreach ($row->c as $c) {
                        $col = preg_replace('/[0-9]/', '', (string)$c['r']);
                        $headersKey = isset($headers[$col]) ? $headers[$col] : $col;
                        $cells[$headersKey] = trim($getVal($c, $sharedStrings));
                    }
                    $rows[] = $cells;
                }
            }
        }
    }
    
    // Sheet 6 (Configurações / custom_requisicoes)
    $sheet6Index = $zip->locateName('xl/worksheets/sheet6.xml');
    $customReqs = [];
    if ($sheet6Index !== FALSE) {
        $xmlStr = $zip->getFromIndex($sheet6Index);
        $xml = simplexml_load_string($xmlStr);
        $headers6 = []; $row6 = [];
        if ($xml && isset($xml->sheetData->row)) {
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
        }
        foreach ($headers6 as $col => $name) {
            if ($name === 'custom_requisicoes') {
                $jsonStr = isset($row6[$col]) ? $row6[$col] : '[]';
                $customReqs = json_decode($jsonStr, true) ?: [];
            }
        }
    }
    
    $zip->close();
    return ['lancamentos' => $rows, 'custom_requisicoes' => $customReqs];
}

$yesterdayData = parseWorkbookLotes($yesterdayFile);

// 2. Ler dados de Agora do Banco PROD
$stmt = $pdo->prepare("SELECT * FROM requisicoes WHERE environment = 'Frota Principal'");
$stmt->execute();
$nowLancamentos = $stmt->fetchAll(PDO::FETCH_ASSOC);

$stmtConf = $pdo->prepare("SELECT custom_requisicoes FROM configuracoes WHERE environment = 'Frota Principal'");
$stmtConf->execute();
$nowCustomReqsRaw = $stmtConf->fetchColumn();
$nowCustomReqs = json_decode($nowCustomReqsRaw ? $nowCustomReqsRaw : '[]', true) ?: [];

// Função de Análise e Agrupamento por Lotes
function analyzeData($lancamentos, $customReqs, $label) {
    $byLote = [];
    
    $normLote = function($l) {
        if (empty($l)) return 'LOTE 1 (7K)';
        $str = strtoupper(trim($l));
        if (strpos($str, 'LOTE 1') !== false || strpos($str, '7K') !== false) return 'LOTE 1 (7K)';
        if (strpos($str, 'LOTE 2') !== false || strpos($str, '2K') !== false) return 'LOTE 2 (2K)';
        if (strpos($str, 'LOTE 3') !== false || strpos($str, '15K') !== false) return 'LOTE 3 (15K)';
        if (strpos($str, 'LOTE 4') !== false || strpos($str, '10K') !== false) return 'LOTE 4 (10K)';
        return $str;
    };
    
    // Processar Lançamentos Efetivados
    foreach ($lancamentos as $r) {
        $rawLote = isset($r['Lote']) ? $r['Lote'] : (isset($r['lote']) ? $r['lote'] : 'LOTE 1');
        $lName = $normLote($rawLote);
        
        if (!isset($byLote[$lName])) {
            $byLote[$lName] = [
                'total_lancamentos' => 0,
                'total_litros' => 0.0,
                'total_valor' => 0.0,
                'controles_seqs' => [],
                'litragens_breakdown' => []
            ];
        }
        
        $qtd = isset($r['Qtd Requisições']) ? intval($r['Qtd Requisições']) : (isset($r['qtdRequisicoes']) ? intval($r['qtdRequisicoes']) : 1);
        $litros = isset($r['Litros']) ? floatval(str_replace(',', '.', $r['Litros'])) : (isset($r['litros']) ? floatval($r['litros']) : 0.0);
        $valor = isset($r['Valor']) ? floatval(str_replace(',', '.', $r['Valor'])) : (isset($r['valor']) ? floatval($r['valor']) : 0.0);
        $seq = isset($r['Nº da Requisição']) ? $r['Nº da Requisição'] : (isset($r['inicioSeq']) ? $r['inicioSeq'] : (isset($r['req_id']) ? $r['req_id'] : (isset($r['id']) ? $r['id'] : '')));
        
        $byLote[$lName]['total_lancamentos'] += $qtd;
        $byLote[$lName]['total_litros'] += $litros;
        $byLote[$lName]['total_valor'] += $valor;
        
        $litragemKey = round($litros, 2) . 'L';
        if (!isset($byLote[$lName]['litragens_breakdown'][$litragemKey])) {
            $byLote[$lName]['litragens_breakdown'][$litragemKey] = 0;
        }
        $byLote[$lName]['litragens_breakdown'][$litragemKey] += $qtd;
        
        if (!empty($seq)) {
            $byLote[$lName]['controles_seqs'][] = $seq;
        }
    }
    
    // Processar Requisições Personalizadas / Disponíveis
    $customByLote = [];
    foreach ($customReqs as $item) {
        if (!is_string($item)) continue;
        
        $matchLote = null;
        if (preg_match('/\(LOTE\s*(\d+)\)/i', $item, $mL)) {
            $matchLote = "LOTE " . $mL[1];
        } elseif (preg_match('/LOTE\s*(\d+)/i', $item, $mL)) {
            $matchLote = "LOTE " . $mL[1];
        }
        $lName = $normLote($matchLote);
        
        if (!isset($customByLote[$lName])) {
            $customByLote[$lName] = [
                'total_custom_reqs' => 0,
                'litragens' => [],
                'controles' => []
            ];
        }
        
        $customByLote[$lName]['total_custom_reqs']++;
        
        // Litragem
        if (preg_match('/-\s*(\d+L)/i', $item, $mLit)) {
            $litKey = strtoupper($mLit[1]);
            if (!isset($customByLote[$lName]['litragens'][$litKey])) $customByLote[$lName]['litragens'][$litKey] = 0;
            $customByLote[$lName]['litragens'][$litKey]++;
        }
        
        // Código de controle
        if (preg_match('/^(\d{13})/', $item, $mCtrl)) {
            $ctrlCode = $mCtrl[1];
            if (!isset($customByLote[$lName]['controles'][$ctrlCode])) $customByLote[$lName]['controles'][$ctrlCode] = 0;
            $customByLote[$lName]['controles'][$ctrlCode]++;
        }
    }
    
    foreach ($byLote as $lName => &$data) {
        sort($data['controles_seqs']);
        $total = count($data['controles_seqs']);
        if ($total > 0) {
            $data['sequencia_range'] = [
                'primeira' => $data['controles_seqs'][0],
                'ultima' => $data['controles_seqs'][$total - 1],
                'amostra' => array_slice($data['controles_seqs'], 0, 5)
            ];
        }
        unset($data['controles_seqs']);
    }
    
    return [
        'label' => $label,
        'lancamentos_efetivados_por_lote' => $byLote,
        'custom_requisicoes_por_lote' => $customByLote
    ];
}

$analysisYesterday = analyzeData($yesterdayData['lancamentos'] ?? [], $yesterdayData['custom_requisicoes'] ?? [], 'Dia de Ontem (08/09/2026)');
$analysisNow = analyzeData($nowLancamentos, $nowCustomReqs, 'Dados de Agora (09/09/2026 - Produção)');

echo json_encode([
    'ontem' => $analysisYesterday,
    'agora' => $analysisNow
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
