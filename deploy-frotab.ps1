# Script de Deploy Automático para Produção via FTP (Pasta Frota_B no Subdomínio controle.hubdigital360.com)
# Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
# "si vis pacem para bellum"
$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"
$localDir = $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONTROLE MGP - Deploy para FILIAL (FROTA B)    " -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Cyan

function Upload-File($localFilePath, $remoteRelativePath) {
    if (-not (Test-Path $localFilePath)) {
        Write-Host " [PULADO] $remoteRelativePath (Arquivo inexistente)" -ForegroundColor DarkGray
        return
    }
    $remoteUri = "$ftpHost/$remoteRelativePath"
    try {
        $wc = New-Object System.Net.WebClient
        $wc.Credentials = New-Object System.Net.NetworkCredential($username, $password)
        $wc.UploadFile($remoteUri, "STOR", $localFilePath)
        $wc.Dispose()
        Write-Host " [OK] $remoteRelativePath" -ForegroundColor Green
    } catch {
        Write-Host " [ERRO] $remoteRelativePath : $_" -ForegroundColor Red
    }
}

function Create-FtpDirectory($remoteRelativePath) {
    $remoteUri = "$ftpHost/$remoteRelativePath"
    $req = [System.Net.FtpWebRequest]::Create($remoteUri)
    $req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
    $req.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
    $req.KeepAlive = $false
    try {
        $response = $req.GetResponse()
        $response.Close()
        Write-Host " [DIR CRIADO] $remoteRelativePath" -ForegroundColor Yellow
    } catch {
        # Diretório já existe
    }
}

function Delete-RemoteFile($remoteRelativePath) {
    $remoteUri = "$ftpHost/$remoteRelativePath"
    try {
        $req = [System.Net.FtpWebRequest]::Create($remoteUri)
        $req.Credentials = New-Object System.Net.NetworkCredential($username, $password)
        $req.Method = [System.Net.WebRequestMethods+Ftp]::DeleteFile
        $req.KeepAlive = $false
        $response = $req.GetResponse()
        $response.Close()
        Write-Host " [REMOVIDO] $remoteRelativePath" -ForegroundColor Magenta
    } catch {
        # Arquivo não existe ou não pôde ser deletado
    }
}

# 1. Cria a estrutura de pastas remotas no ambiente de produção para a Frota_B
Create-FtpDirectory "Frota_B"
Create-FtpDirectory "Frota_B/api"
Create-FtpDirectory "Frota_B/api/backups"
Create-FtpDirectory "Frota_B/libs"

# Remover index.html legado no servidor da filial
Delete-RemoteFile "Frota_B/index.html"

# 2. Upload dos arquivos do Dashboard e Repositório para a pasta Frota_B
Upload-File "$localDir\index.php" "Frota_B/index.php"
Upload-File "$localDir\styles.css" "Frota_B/styles.css"
Upload-File "$localDir\app.js" "Frota_B/app.js"
Upload-File "$localDir\app_icon.png" "Frota_B/app_icon.png"

# Upload das bibliotecas auxiliares (offline/online)
Upload-File "$localDir\libs\xlsx.mini.min.js" "Frota_B/libs/xlsx.mini.min.js"
Upload-File "$localDir\libs\papaparse.min.js" "Frota_B/libs/papaparse.min.js"
Upload-File "$localDir\libs\apexcharts.js" "Frota_B/libs/apexcharts.js"

Upload-File "$localDir\backup_login.html" "Frota_B/backup_login.html"
Upload-File "$localDir\backup_repo.html" "Frota_B/backup_repo.html"
Upload-File "$localDir\styles_repo.css" "Frota_B/styles_repo.css"

# 3. Upload das APIs PHP
Upload-File "$localDir\api\db.php" "Frota_B/api/db.php"
Upload-File "$localDir\api\get_data.php" "Frota_B/api/get_data.php"
Upload-File "$localDir\api\sync_data.php" "Frota_B/api/sync_data.php"
Upload-File "$localDir\api\save_backup.php" "Frota_B/api/save_backup.php"
Upload-File "$localDir\api\login.php" "Frota_B/api/login.php"
Upload-File "$localDir\api\check_auth.php" "Frota_B/api/check_auth.php"
Upload-File "$localDir\api\logout.php" "Frota_B/api/logout.php"
Upload-File "$localDir\api\list_backups.php" "Frota_B/api/list_backups.php"
Upload-File "$localDir\api\delete_backup.php" "Frota_B/api/delete_backup.php"
Upload-File "$localDir\api\download_backup.php" "Frota_B/api/download_backup.php"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " Deploy da FILIAL (FROTA B) finalizado com sucesso!" -ForegroundColor Green
Write-Host " Painel da Filial:  https://controle.hubdigital360.com/Frota_B/" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
