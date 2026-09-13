$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"

try {
    $req = [System.Net.FtpWebRequest]::Create("$ftpHost/hml/api/check_lotes.php")
    $req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
    $req.KeepAlive = $false
    $resp = $req.GetResponse()
    $resp.Close()
    Write-Host "Deleted temporary check_lotes.php"
} catch {
    Write-Host "Error deleting: $_"
}
