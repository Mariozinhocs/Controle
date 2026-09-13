$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"
$file = "api/backups/backup_controle_Frota_Principal_11-09-2026_134459.xlsx"
$localPath = "g:\Meu Drive\Dev's\Controle\scratch\backup_today_11-09-2026.xlsx"

$req = [System.Net.FtpWebRequest]::Create("$ftpHost/$file")
$req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
$req.Method = [System.Net.WebRequestMethods+Ftp]::DownloadFile

$res = $req.GetResponse()
$stream = $res.GetResponseStream()
$out = [System.IO.File]::Create($localPath)
$stream.CopyTo($out)
$out.Close()
$stream.Close()
$res.Close()

$size = (Get-Item $localPath).Length
Write-Host "Downloaded successfully: $localPath ($size bytes)"
