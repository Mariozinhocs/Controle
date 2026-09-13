$wc = New-Object System.Net.WebClient
$wc.Credentials = New-Object System.Net.NetworkCredential('u576215103.controle', '+KVs|jC5')
$wc.UploadFile('ftp://ftp.controle.hubdigital360.com/hml/api/compare_yesterday_vs_now.php', 'STOR', 'scratch/compare_yesterday_vs_now.php')
$wc.Dispose()
Write-Host "Uploaded compare_yesterday_vs_now.php"
