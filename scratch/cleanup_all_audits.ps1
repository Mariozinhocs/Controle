$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"

function Delete-Remote($path) {
    try {
        $req = [System.Net.FtpWebRequest]::Create("$ftpHost/$path")
        $req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
        $req.KeepAlive = $false
        $resp = $req.GetResponse()
        $resp.Close()
        Write-Host "Deleted $path"
    } catch {
        Write-Host "Could not delete $path : $_"
    }
}

Delete-Remote "hml/api/scratch_audit.php"
Delete-Remote "hml/api/inspect_all_backups.php"
