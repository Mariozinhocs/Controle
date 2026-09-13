$url = "https://controle.hubdigital360.com/app.js?v=70"
$outFile = "g:\Meu Drive\Dev's\Controle\scratch\prod_app_v70.js"
$web = New-Object System.Net.WebClient
$web.Encoding = [System.Text.Encoding]::UTF8
$content = $web.DownloadString($url)
[System.IO.File]::WriteAllText($outFile, $content)
Write-Host "Prod app.js size: $($content.Length) chars"
