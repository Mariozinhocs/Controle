<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
require_once __DIR__ . '/db.php';

$filename = isset($_GET['file']) ? basename($_GET['file']) : 'backup_controle_Frota_Principal_09-09-2026_140513.xlsx';
$env = isset($_GET['env']) ? trim($_GET['env']) : 'Frota Principal';

$filePath = __DIR__ . '/backups/' . $filename;
if (!file_exists($filePath)) {
    $filePath = dirname(__DIR__, 2) . '/api/backups/' . $filename;
}
if (!file_exists($filePath)) {
    $filePath = dirname(__DIR__) . '/backups/' . $filename;
}
if (!file_exists($filePath)) {
    http_response_code(404);
    echo json_encode(['success' => false, 'message' => "Arquivo $filename não encontrado no servidor"]);
    exit;
}

$zip = new ZipArchive();
if ($zip->open($filePath) !== TRUE) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Não foi possível abrir o arquivo ZIP XLSX']);
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

// 2. Localizar a aba de Configurações (Sheet 6 ou nome que contenha 'Configuracoes')
$configRaw = [
    'custom_bases' => '[]',
    'custom_postos' => '[]',
    'custom_motoristas' => '[]',
    'custom_veiculos' => '[]',
    'custom_requisicoes' => '[]'
];

$sheet6Index = $zip->locateName('xl/worksheets/sheet6.xml');
if ($sheet6Index !== FALSE) {
    $xmlStr = $zip->getFromIndex($sheet6Index);
    $xml = simplexml_load_string($xmlStr);
    $headers6 = [];
    $row6 = [];
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
                    $row6[$col] = getCellValue($c, $sharedStrings);
                }
            }
        }
    }
    foreach ($headers6 as $col => $name) {
        $val = isset($row6[$col]) ? $row6[$col] : '';
        if (array_key_exists($name, $configRaw)) {
            $configRaw[$name] = $val;
        }
    }
}

// 3. Localizar a aba principal de Lançamentos (Sheet 5 ou a maior planilha)
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

if (empty($rows5Data)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Nenhum lançamento encontrado na planilha de dados']);
    exit;
}

// Mapear os lançamentos da planilha 5 para o formato da tabela de requisições
$requisicoesToInsert = [];
$seenSeqs = [];
$seenIds = [];
$seqCounter = 1;

foreach ($rows5Data as $r) {
    $item = [];
    foreach ($headers5 as $col => $hName) {
        $item[trim($hName)] = isset($r[$col]) ? trim($r[$col]) : '';
    }
    
    // Extrair ID / Número da Requisição
    $reqId = isset($item['Nº da Requisição']) && !empty($item['Nº da Requisição']) ? $item['Nº da Requisição'] : '';
    if (empty($reqId)) {
        $reqId = "REC-" . sprintf("%06d", $seqCounter);
    }
    
    $seq = $seqCounter++;
    
    // Trava de deduplicação estrita
    if ($reqId !== '' && isset($seenIds[$reqId])) {
        continue;
    }
    if (isset($seenSeqs[$seq])) {
        continue;
    }
    
    $seenIds[$reqId] = true;
    $seenSeqs[$seq] = true;
    
    // Data
    $rawDate = isset($item['Data']) ? $item['Data'] : '';
    $formattedDate = '2026-08-30';
    if (!empty($rawDate)) {
        if (preg_match('/^(\d{2})\/(\d{2})\/(\d{4})$/', $rawDate, $m)) {
            $formattedDate = "{$m[3]}-{$m[2]}-{$m[1]}";
        } else {
            $ts = strtotime($rawDate);
            if ($ts) $formattedDate = date('Y-m-d', $ts);
        }
    }
    
    $zona = !empty($item['Base']) ? $item['Base'] : 'NÃO INFORMADO';
    $responsavel = !empty($item['Responsável']) ? $item['Responsável'] : 'NÃO INFORMADO';
    $motorista = !empty($item['Motorista']) ? $item['Motorista'] : 'NÃO INFORMADO';
    $posto = !empty($item['Posto']) ? $item['Posto'] : 'NÃO INFORMADO';
    $veiculo = !empty($item['Veículo']) ? $item['Veículo'] : 'NÃO INFORMADO';
    $placa = !empty($item['Placa']) ? $item['Placa'] : 'NÃO INFORMADO';
    $combustivel = !empty($item['Tipo Combustível']) ? $item['Tipo Combustível'] : 'DIESEL';
    
    $litros = isset($item['Litros']) ? floatval(str_replace(',', '.', $item['Litros'])) : 0.0;
    $precoLitro = isset($item['Preço Litro']) ? floatval(str_replace(',', '.', $item['Preço Litro'])) : 0.0;
    $valor = isset($item['Valor']) ? floatval(str_replace(',', '.', $item['Valor'])) : 0.0;
    $qtdReq = isset($item['Qtd Requisições']) ? intval($item['Qtd Requisições']) : 1;
    $lote = isset($item['Lote']) && !empty($item['Lote']) ? $item['Lote'] : 'LOTE 1';
    
    $kmAnt = (isset($item['KM Anterior']) && $item['KM Anterior'] !== 'NÃO INFORMADO' && $item['KM Anterior'] !== '') ? intval($item['KM Anterior']) : null;
    $kmAtual = (isset($item['KM Atual']) && $item['KM Atual'] !== 'NÃO INFORMADO' && $item['KM Atual'] !== '') ? intval($item['KM Atual']) : null;
    
    $requisicoesToInsert[] = [
        'id' => $reqId,
        'date' => $formattedDate,
        'inicioSeq' => $reqId,
        'fimSeq' => $reqId,
        'qtdRequisicoes' => $qtdReq,
        'zona' => $zona,
        'responsavel' => $responsavel,
        'posto' => $posto,
        'motorista' => $motorista,
        'veiculo' => $veiculo,
        'placa' => $placa,
        'kmAnterior' => $kmAnt,
        'km' => $kmAtual,
        'combustivel' => $combustivel,
        'litros' => $litros,
        'precoLitro' => $precoLitro,
        'valor' => $valor,
        'lote' => $lote
    ];
}

// 4. Executar transação no banco MySQL
$pdo->beginTransaction();
try {
    // A) Limpar registros existentes do ambiente
    $stmtDel = $pdo->prepare("DELETE FROM $table_requisicoes WHERE environment = :env");
    $stmtDel->execute(['env' => $env]);
    
    // B) Inserir requisições restauradas
    $stmtInsert = $pdo->prepare("INSERT INTO $table_requisicoes 
        (id, date, inicioSeq, fimSeq, qtdRequisicoes, zona, responsavel, posto, motorista, veiculo, placa, kmAnterior, km, combustivel, litros, precoLitro, valor, lote, environment)
        VALUES 
        (:id, :date, :inicioSeq, :fimSeq, :qtdRequisicoes, :zona, :responsavel, :posto, :motorista, :veiculo, :placa, :kmAnterior, :km, :combustivel, :litros, :precoLitro, :valor, :lote, :env)");
        
    foreach ($requisicoesToInsert as $row) {
        $stmtInsert->execute([
            'id' => $row['id'],
            'date' => $row['date'],
            'inicioSeq' => $row['inicioSeq'],
            'fimSeq' => $row['fimSeq'],
            'qtdRequisicoes' => $row['qtdRequisicoes'],
            'zona' => $row['zona'],
            'responsavel' => $row['responsavel'],
            'posto' => $row['posto'],
            'motorista' => $row['motorista'],
            'veiculo' => $row['veiculo'],
            'placa' => $row['placa'],
            'kmAnterior' => $row['kmAnterior'],
            'km' => $row['km'],
            'combustivel' => $row['combustivel'],
            'litros' => $row['litros'],
            'precoLitro' => $row['precoLitro'],
            'valor' => $row['valor'],
            'lote' => $row['lote'],
            'env' => $env
        ]);
    }
    
    // C) Atualizar configurações
    $stmtConf = $pdo->prepare("INSERT INTO $table_configuracoes 
        (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes)
        VALUES (:env, :bases, :postos, :motoristas, :veiculos, :requisicoes)
        ON DUPLICATE KEY UPDATE 
        custom_bases = :bases,
        custom_postos = :postos,
        custom_motoristas = :motoristas,
        custom_veiculos = :veiculos,
        custom_requisicoes = :requisicoes");
        
    $stmtConf->execute([
        'env' => $env,
        'bases' => $configRaw['custom_bases'],
        'postos' => $configRaw['custom_postos'],
        'motoristas' => $configRaw['custom_motoristas'],
        'veiculos' => $configRaw['custom_veiculos'],
        'requisicoes' => $configRaw['custom_requisicoes']
    ]);
    
    $pdo->commit();
    
    // Sobrescrever dados.xlsx na raiz para manter o arquivo de contingência atualizado
    $mainDir = dirname(__DIR__);
    @copy($filePath, $mainDir . '/dados.xlsx');
    
    // Contagem de custom_requisicoes por lote para auditoria
    $customReqsArr = json_decode($configRaw['custom_requisicoes'], true);
    $loteStats = [];
    if (is_array($customReqsArr)) {
        foreach ($customReqsArr as $cr) {
            if (is_string($cr) && preg_match('/\(LOTE\s*(\d+)\)/i', $cr, $m)) {
                $lName = "LOTE " . $m[1];
            } else {
                $lName = "Outros";
            }
            if (!isset($loteStats[$lName])) $loteStats[$lName] = 0;
            $loteStats[$lName]++;
        }
    }
    
    writeAuditLog($pdo, "Restauração Completa de Backup Executada", [
        'file' => $filename,
        'environment' => $env,
        'launcamentos_restaurados' => count($requisicoesToInsert),
        'custom_requisicoes_restauradas' => is_array($customReqsArr) ? count($customReqsArr) : 0,
        'lote_stats' => $loteStats
    ], $env);
    
    echo json_encode([
        'success' => true,
        'message' => "Backup $filename restaurado com sucesso!",
        'environment' => $env,
        'launcamentos_restaurados' => count($requisicoesToInsert),
        'custom_requisicoes_count' => is_array($customReqsArr) ? count($customReqsArr) : 0,
        'lotes_distribuicao' => $loteStats
    ]);
    
} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro na restauração: ' . $e->getMessage()]);
}
