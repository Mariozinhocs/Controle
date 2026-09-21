$wc = New-Object System.Net.WebClient
$wc.Credentials = New-Object System.Net.NetworkCredential('u576215103.controle', '+KVs|jC5')
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/api/sync_data.php', 'STOR', "$PSScriptRoot/../api/sync_data.php")
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/api/sync_data.php', 'STOR', "$PSScriptRoot/../api/sync_data.php")
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/lab/api/sync_data.php', 'STOR', "$PSScriptRoot/../api/sync_data.php")
Write-Host "Uploaded api/sync_data.php to PROD and HML"
