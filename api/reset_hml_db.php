<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

header('Content-Type: application/json; charset=utf-8');
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/logger.php';

// Verificação estrita de segurança: só permite execução se estiver no diretório /hml/
if (!$isHml) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'Acesso negado. A reinicialização só é permitida no ambiente de Homologação (/hml/).'
    ]);
    exit;
}

$empty = isset($_GET['empty']) && $_GET['empty'] === 'true';
$cadastrosOnly = isset($_GET['cadastros_only']) && $_GET['cadastros_only'] === 'true';

try {
    // 1. Tabela de requisições HML (Zera se $empty ou $cadastrosOnly)
    $pdo->exec("DROP TABLE IF EXISTS hml_requisicoes");
    $pdo->exec("CREATE TABLE hml_requisicoes LIKE requisicoes");
    if (!$empty && !$cadastrosOnly) {
        $pdo->exec("INSERT INTO hml_requisicoes SELECT * FROM requisicoes");
    }
    try {
        $pdo->exec("ALTER TABLE hml_requisicoes ADD COLUMN lote VARCHAR(50) DEFAULT 'LOTE 1'");
    } catch (Exception $e) {}

    // 2. Tabela de configurações HML (Copia bases, postos, motoristas, veiculos de PROD, mas zera custom_requisicoes se $cadastrosOnly)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS hml_configuracoes LIKE configuracoes");
        $pdo->exec("TRUNCATE TABLE hml_configuracoes");
        if (!$empty) {
            $pdo->exec("INSERT INTO hml_configuracoes SELECT * FROM configuracoes");
            if ($cadastrosOnly) {
                $pdo->exec("UPDATE hml_configuracoes SET custom_requisicoes = '[]'");
            }
        }
    } catch (Exception $eConfig) {
        // Contingência se LIKE falhar
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
        $pdo->exec("TRUNCATE TABLE hml_configuracoes");
        if (!$empty) {
            $pdo->exec("INSERT INTO hml_configuracoes (environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes) SELECT environment, custom_bases, custom_postos, custom_motoristas, custom_veiculos, custom_requisicoes FROM configuracoes");
            if ($cadastrosOnly) {
                $pdo->exec("UPDATE hml_configuracoes SET custom_requisicoes = '[]'");
            }
        }
    }

    // 3. Tabela de veículos contratados HML (Copia de PROD se não for $empty)
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS hml_veiculos_contratados LIKE veiculos_contratados");
        $pdo->exec("TRUNCATE TABLE hml_veiculos_contratados");
        if (!$empty) {
            $pdo->exec("INSERT INTO hml_veiculos_contratados SELECT * FROM veiculos_contratados");
        }
    } catch (Exception $eVeic) {
        // Contingência
    }

    // 4. Limpar / Reinicializar logs de atividade HML
    $pdo->exec("DROP TABLE IF EXISTS hml_activity_logs");
    $pdo->exec("CREATE TABLE hml_activity_logs LIKE activity_logs");

    // Registrar log da operação
    $actionName = $cadastrosOnly ? 'COPY_CADASTROS_PROD_TO_HML' : ($empty ? 'RESET_HML_DATABASE_EMPTY' : 'CLONE_PROD_TO_HML_DATABASE');
    $actionMsg = $cadastrosOnly ? 'Cadastros de PROD copiados para HML (sem lotes e sem distribuições)' : ($empty ? 'Banco HML reinicializado vazio' : 'Banco HML sincronizado com dados de produção');
    writeAuditLog($pdo, $actionName, ['msg' => $actionMsg], 'Homologacao');

    echo json_encode([
        'success' => true,
        'message' => 'Cadastros de Bases, Postos, Motoristas e Veículos copiados com sucesso de PROD para HML! Lotes e Distribuições permanecem limpos.'
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Erro ao reinicializar banco de dados HML: ' . $e->getMessage()
    ]);
}
