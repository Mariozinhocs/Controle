$wc = New-Object System.Net.WebClient
$wc.Credentials = New-Object System.Net.NetworkCredential('u576215103.controle', '+KVs|jC5')
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/api/check_audit_logs.php', 'STOR', "$PSScriptRoot/../api/check_audit_logs.php")
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/api/check_audit_logs.php', 'STOR', "$PSScriptRoot/../api/check_audit_logs.php")
Write-Host "Uploaded check_audit_logs.php"
