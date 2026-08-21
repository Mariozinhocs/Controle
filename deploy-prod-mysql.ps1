# Script de Deploy Automático para Produção via FTP (Subdomínio controle.hubdigital360.com)
# Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
# "si vis pacem para bellum"
$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"
$localDir = $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONTROLE MGP - Deploy para SUBDOMÍNIO MYSQL    " -ForegroundColor Cyan
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

# 1. Cria a estrutura de pastas remotas no ambiente de produção
Create-FtpDirectory "api"
Create-FtpDirectory "api/backups"
Create-FtpDirectory "libs"

# Remover index.html legado no servidor para dar prioridade ao index.php
Delete-RemoteFile "index.html"

# 2. Upload dos arquivos do Dashboard e Repositório
Upload-File "$localDir\index.php" "index.php"
Upload-File "$localDir\styles.css" "styles.css"
Upload-File "$localDir\app.js" "app.js"
Upload-File "$localDir\app_icon.png" "app_icon.png"

# Upload das bibliotecas auxiliares (offline/online)
Upload-File "$localDir\libs\xlsx.mini.min.js" "libs/xlsx.mini.min.js"
Upload-File "$localDir\libs\papaparse.min.js" "libs/papaparse.min.js"
Upload-File "$localDir\libs\apexcharts.js" "libs/apexcharts.js"

Upload-File "$localDir\backup_login.html" "backup_login.html"
Upload-File "$localDir\backup_repo.html" "backup_repo.html"
Upload-File "$localDir\styles_repo.css" "styles_repo.css"

# 3. Upload das APIs PHP
Upload-File "$localDir\api\db.php" "api/db.php"
Upload-File "$localDir\api\get_data.php" "api/get_data.php"
Upload-File "$localDir\api\sync_data.php" "api/sync_data.php"
Upload-File "$localDir\api\save_backup.php" "api/save_backup.php"
Upload-File "$localDir\api\login.php" "api/login.php"
Upload-File "$localDir\api\check_auth.php" "api/check_auth.php"
Upload-File "$localDir\api\logout.php" "api/logout.php"
Upload-File "$localDir\api\list_backups.php" "api/list_backups.php"
Upload-File "$localDir\api\delete_backup.php" "api/delete_backup.php"
Upload-File "$localDir\api\download_backup.php" "api/download_backup.php"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " Deploy PROD finalizado com sucesso!" -ForegroundColor Green
Write-Host " Painel do Controle:  https://controle.hubdigital360.com/" -ForegroundColor Cyan
Write-Host " Login de Backups:    https://controle.hubdigital360.com/backup_login.html" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
