<?php
/* 
  Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
  "si vis pacem para bellum"
*/

function getHeaderCompat($headerName) {
    $formattedName = 'HTTP_' . strtoupper(str_replace('-', '_', $headerName));
    if (isset($_SERVER[$formattedName])) {
        return $_SERVER[$formattedName];
    }
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $name => $value) {
            if (strcasecmp($name, $headerName) === 0) {
                return $value;
            }
        }
    }
    return null;
}

// Retrieve or generate Trace-ID and Correlation-ID
$traceId = getHeaderCompat('X-Trace-ID');
$correlationId = getHeaderCompat('X-Correlation-ID');

if (empty($traceId)) {
    $traceId = 'trace-srv-' . uniqid() . '-' . bin2hex(random_bytes(4));
}
if (empty($correlationId)) {
    $correlationId = 'corr-srv-' . uniqid() . '-' . bin2hex(random_bytes(4));
}

// Expose headers in response for visibility
header('X-Trace-ID: ' . $traceId);
header('X-Correlation-ID: ' . $correlationId);

/**
 * Registra um log estruturado JSON em arquivo local.
 */
function writeLog($level, $message, $context = []) {
    global $traceId, $correlationId;
    
    $logDir = __DIR__ . '/logs';
    if (!is_dir($logDir)) {
        @mkdir($logDir, 0755, true);
    }
    
    $logFile = $logDir . '/controle_activity.log';
    
    $logData = [
        'timestamp' => date('Y-m-d H:i:s'),
        'level' => strtoupper($level),
        'service' => 'Controle-MGP',
        'trace_id' => $traceId,
        'correlation_id' => $correlationId,
        'user' => [
            'ip' => $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? 'N/A'
        ],
        'message' => $message,
        'context' => $context
    ];
    
    @file_put_contents($logFile, json_encode($logData, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) . PHP_EOL, FILE_APPEND);
}

/**
 * Registra uma trilha de auditoria indelével no banco de dados MySQL.
 */
function writeAuditLog($pdo, $action, $context = [], $env = 'Frota Principal') {
    global $traceId, $correlationId, $table_requisicoes;
    
    $logTable = 'activity_logs';
    if (isset($table_requisicoes) && strpos($table_requisicoes, 'hml_') === 0) {
        $logTable = 'hml_activity_logs';
    }
    
    try {
        $ip = $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1';
        $ctxStr = json_encode($context, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        
        $sql = "INSERT INTO $logTable (level, trace_id, correlation_id, operator_ip, action, context, environment) 
                VALUES (:level, :trace_id, :correlation_id, :ip, :action, :context, :env)";
                
        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'level' => 'INFO',
            'trace_id' => $traceId,
            'correlation_id' => $correlationId,
            'ip' => $ip,
            'action' => $action,
            'context' => $ctxStr,
            'env' => $env
        ]);
        
        writeLog('INFO', "AUDIT: $action", $context);
    } catch (Exception $e) {
        writeLog('ERROR', "Falha ao gravar log de auditoria no MySQL: " . $e->getMessage(), [
            'action' => $action,
            'context' => $context
        ]);
    }
}
