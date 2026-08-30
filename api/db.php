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

        try {
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_activity_logs LIKE activity_logs");
        } catch (PDOException $exHmlLog) {
            // Ignora falha
        }

        // Criação automática das tabelas HML com a mesma estrutura das oficiais por segurança
        try {
            // 1. Requisicoes
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_requisicoes LIKE requisicoes");
            try {
                $pdo->exec("ALTER TABLE requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
            } catch (Exception $e) {}
            try {
                $pdo->exec("ALTER TABLE hml_requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
            } catch (Exception $e) {}
            $checkReq = $pdo->query("SELECT COUNT(*) FROM hml_requisicoes")->fetchColumn();
            if ($checkReq == 0) {
                $pdo->exec("INSERT INTO hml_requisicoes SELECT * FROM requisicoes");
            }

            // 2. Configuracoes
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_configuracoes LIKE configuracoes");
            $checkConf = $pdo->query("SELECT COUNT(*) FROM hml_configuracoes")->fetchColumn();
            if ($checkConf == 0) {
                $pdo->exec("INSERT INTO hml_configuracoes SELECT * FROM configuracoes");
            }
            
            // 3. Veiculos Contratados
            // Caso a tabela veiculos_contratados ainda não exista, cria a estrutura original básica primeiro
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
            $pdo->exec("CREATE TABLE IF NOT EXISTS hml_veiculos_contratados LIKE veiculos_contratados");
            $checkVeic = $pdo->query("SELECT COUNT(*) FROM hml_veiculos_contratados")->fetchColumn();
            if ($checkVeic == 0) {
                $pdo->exec("INSERT INTO hml_veiculos_contratados SELECT * FROM veiculos_contratados");
            }
        } catch (PDOException $ex) {
            // Em caso de erro na cópia LIKE, prossegue (pode ser que já existam)
        }
    } else {
        $table_requisicoes = 'requisicoes';
        $table_configuracoes = 'configuracoes';
        $table_veiculos_contratados = 'veiculos_contratados';
    }

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Erro de conexão MySQL: ' . $e->getMessage()]);
    exit;
}
