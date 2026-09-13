$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"

function List-Ftp($path) {
    Write-Host "=== Listing $path ===" -ForegroundColor Cyan
    try {
        $req = [System.Net.FtpWebRequest]::Create("$ftpHost/$path")
        $req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::ListDirectory
        $res = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($res.GetResponseStream())
        $content = $reader.ReadToEnd()
        Write-Host $content
        $res.Close()
    } catch {
        Write-Host "Error listing $path : $_" -ForegroundColor Red
    }
}

List-Ftp "api/backups"
List-Ftp "hml/api/backups"
