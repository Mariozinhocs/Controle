$wc = New-Object System.Net.WebClient
$wc.Credentials = New-Object System.Net.NetworkCredential('u576215103.controle', '+KVs|jC5')
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/api/inspect_all_backups.php', 'STOR', 'scratch/inspect_all_backups.php')
$wc.Dispose()
Write-Host "Uploaded inspect_all_backups.php"
