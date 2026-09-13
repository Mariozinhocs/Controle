$wc = New-Object System.Net.WebClient
$wc.Credentials = New-Object System.Net.NetworkCredential('u576215103.controle', '+KVs|jC5')
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/api/scratch_audit.php', 'STOR', 'scratch/audit_restore_history.php')
$wc.Dispose()
Write-Host "Uploaded scratch_audit.php"
