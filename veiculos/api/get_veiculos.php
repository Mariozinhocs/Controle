<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Cache-Control: post-check=0, pre-check=0", false);
header("Pragma: no-cache");
header("Content-Type: application/json; charset=UTF-8");

require_once __DIR__ . '/../../api/db.php';

$env = isset($_GET['env']) ? trim($_GET['env']) : 'Frota Principal';
if (empty($env)) {
    $env = 'Frota Principal';
}

try {
    // 1. Garantir que a tabela veiculos_contratados existe no MySQL
    $pdo->exec("CREATE TABLE IF NOT EXISTS veiculos_contratados (
        id INT AUTO_INCREMENT PRIMARY KEY,
        tipo_veiculo VARCHAR(100) NOT NULL,
        ano VARCHAR(10) DEFAULT '',
        placa VARCHAR(20) NOT NULL,
        empresa VARCHAR(100) NOT NULL,
        motorista VARCHAR(100) DEFAULT '',
        fone_motorista VARCHAR(50) DEFAULT '',
        local_atuacao VARCHAR(100) DEFAULT '',
        tipo_contrato VARCHAR(50) NOT NULL DEFAULT 'ALUGADO',
        combustivel VARCHAR(50) NOT NULL DEFAULT 'DIESEL',
        environment VARCHAR(100) NOT NULL DEFAULT 'Frota Principal',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )");

    // 2. Buscar veículos contratados cadastrados para o ambiente ativo
    $stmt = $pdo->prepare("SELECT * FROM veiculos_contratados WHERE environment = :env ORDER BY tipo_veiculo ASC, placa ASC");
    $stmt->execute(['env' => $env]);
    $veiculos = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Buscar lançamentos para cruzamento de consumo em PHP (robusto contra tipos strings/varchars de KM)
    $stmtStats = $pdo->prepare("SELECT placa, kmAnterior, km, litros, valor FROM requisicoes WHERE environment = :env");
    $stmtStats->execute(['env' => $env]);
    $allReqs = $stmtStats->fetchAll(PDO::FETCH_ASSOC);

    $statsMap = [];
    foreach ($allReqs as $row) {
        $placa = strtoupper(trim($row['placa']));
        if (empty($placa)) continue;

        if (!isset($statsMap[$placa])) {
            $statsMap[$placa] = [
                'litros' => 0.0,
                'gasto' => 0.0,
                'kms' => []
            ];
        }

        $statsMap[$placa]['litros'] += floatval($row['litros']);
        $statsMap[$placa]['gasto'] += floatval($row['valor']);

        // Extrair KM numérico
        $kmAnt = trim($row['kmAnterior']);
        $kmAt = trim($row['km']);

        if (!empty($kmAnt) && is_numeric($kmAnt) && intval($kmAnt) > 0) {
            $statsMap[$placa]['kms'][] = intval($kmAnt);
        }
        if (!empty($kmAt) && is_numeric($kmAt) && intval($kmAt) > 0) {
            $statsMap[$placa]['kms'][] = intval($kmAt);
        }
    }

    // Calcular KM rodados (Max KM - Min KM)
    foreach ($statsMap as $placa => &$data) {
        $kmRodados = 0;
        if (count($data['kms']) > 1) {
            $minKm = min($data['kms']);
            $maxKm = max($data['kms']);
            if ($maxKm > $minKm) {
                $kmRodados = $maxKm - $minKm;
            }
        }
        $data['km_rodados'] = $kmRodados;
        unset($data['kms']); // Limpar array auxiliar
    }

    // Unir estatísticas de consumo com a lista de veículos contratados
    foreach ($veiculos as &$v) {
        $placaKey = strtoupper(trim($v['placa']));
        if (isset($statsMap[$placaKey])) {
            $v['litros_consumidos'] = $statsMap[$placaKey]['litros'];
            $v['gasto_combustivel'] = $statsMap[$placaKey]['gasto'];
            $v['km_rodados'] = $statsMap[$placaKey]['km_rodados'];
        } else {
            $v['litros_consumidos'] = 0;
            $v['gasto_combustivel'] = 0;
            $v['km_rodados'] = 0;
        }
    }

    echo json_encode([
        'success' => true,
        'environment' => $env,
        'veiculos' => $veiculos
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro ao carregar veículos: ' . $e->getMessage()]);
}
