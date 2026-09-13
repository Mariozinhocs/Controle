<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json');

require_once __DIR__ . '/logger.php';

$host = 'localhost';
$dbname = 'u576215103_controle';
$username = 'u576215103_controle';
$password = '$wRZZUfQ5m';

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $username, $password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

    // Auto-criação da tabela de logs de atividade se não existir (Princípio da Expansão)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS activity_logs (
            id INT AUTO_INCREMENT PRIMARY KEY,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            level VARCHAR(20) NOT NULL,
            trace_id VARCHAR(100) NOT NULL,
            correlation_id VARCHAR(100) NOT NULL,
            operator_ip VARCHAR(50) NOT NULL,
            action VARCHAR(255) NOT NULL,
            context TEXT,
            environment VARCHAR(100) NOT NULL
        )");
    } catch (PDOException $exLog) {
        // Ignora falha de criação
    }

    // Detecção se estamos no ambiente HML (Homologação) via URL ou diretório físico
    $isHml = false;
    if (isset($_SERVER['REQUEST_URI']) && strpos($_SERVER['REQUEST_URI'], '/hml/') !== false) {
        $isHml = true;
    } elseif (isset($_SERVER['SCRIPT_FILENAME']) && strpos($_SERVER['SCRIPT_FILENAME'], '/hml/') !== false) {
        $isHml = true;
    }

    if ($isHml) {
        $table_requisicoes = 'hml_requisicoes';
        $table_configuracoes = 'hml_configuracoes';
        $table_veiculos_contratados = 'hml_veiculos_contratados';
        $table_activity_logs = 'hml_activity_logs';

        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_activity_logs LIKE activity_logs");
        } catch (PDOException $exHmlLog) {
            // Ignora se activity_logs ainda não existir
        }

        // 1. Garante a tabela hml_requisicoes
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_requisicoes (
                id VARCHAR(100) PRIMARY KEY,
                date DATE,
                month INT,
                year INT,
                inicioSeq VARCHAR(100),
                fimSeq VARCHAR(100),
                qtdRequisicoes INT DEFAULT 1,
                zona VARCHAR(100),
                responsavel VARCHAR(100),
                posto VARCHAR(100),
                motorista VARCHAR(100),
                veiculo VARCHAR(100),
                placa VARCHAR(50),
                kmAnterior DECIMAL(10,2) DEFAULT 0,
                km DECIMAL(10,2) DEFAULT 0,
                combustivel VARCHAR(50),
                lote VARCHAR(50) DEFAULT 'LOTE 1',
                litros DECIMAL(10,2),
                precoLitro DECIMAL(10,3),
                valor DECIMAL(10,2),
                environment VARCHAR(100) DEFAULT 'Frota Principal',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )");
        } catch (Exception $e) {}

        // 2. Garante a tabela hml_configuracoes
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_configuracoes (
                id INT AUTO_INCREMENT PRIMARY KEY,
                environment VARCHAR(100) NOT NULL UNIQUE,
                custom_bases TEXT,
                custom_postos TEXT,
                custom_motoristas TEXT,
                custom_veiculos TEXT,
                custom_requisicoes LONGTEXT,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )");
        } catch (Exception $e) {}
        
        // 3. Garante a tabela hml_veiculos_contratados
        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_veiculos_contratados (
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
        } catch (Exception $e) {}
    } else {
        $table_requisicoes = 'requisicoes';
        $table_configuracoes = 'configuracoes';
        $table_veiculos_contratados = 'veiculos_contratados';
        $table_activity_logs = 'activity_logs';

        // Garante colunas adicionais de produção sem tocar no HML
        try {
            $pdo->exec("ALTER TABLE requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
        } catch (Exception $e) {}
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro de conexão MySQL: ' . $e->getMessage()]);
    exit;
}
