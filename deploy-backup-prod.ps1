# Script de Deploy Automático APENAS dos arquivos de Backup para Produção (/controle) via FTP
# Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
# "si vis pacem para bellum"
$ftpHost = "ftp://ftp.anorak.hubdigital360.com"
$username = "u576215103.anorak"
$password = ":jJbLt|E5"
$localDir = $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONTROLE MGP - Deploy do Backup para PRODUÇÃO  " -ForegroundColor Cyan
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

# 1. Cria a estrutura de pastas remotas no ambiente de produção
Create-FtpDirectory "controle"
Create-FtpDirectory "controle/api"
Create-FtpDirectory "controle/api/backups"

# 2. Upload APENAS dos arquivos do Repositório de Backups
Upload-File "$localDir\backup_login.html" "controle/backup_login.html"
Upload-File "$localDir\backup_repo.html" "controle/backup_repo.html"
Upload-File "$localDir\styles_repo.css" "controle/styles_repo.css"

# 3. Upload das APIs PHP de Backup e Autenticação
Upload-File "$localDir\api\save_backup.php" "controle/api/save_backup.php"
Upload-File "$localDir\api\login.php" "controle/api/login.php"
Upload-File "$localDir\api\check_auth.php" "controle/api/check_auth.php"
Upload-File "$localDir\api\logout.php" "controle/api/logout.php"
Upload-File "$localDir\api\list_backups.php" "controle/api/list_backups.php"
Upload-File "$localDir\api\delete_backup.php" "controle/api/delete_backup.php"
Upload-File "$localDir\api\download_backup.php" "controle/api/download_backup.php"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " Deploy PROD (Apenas Backup) finalizado com sucesso!" -ForegroundColor Green
Write-Host " Login de Backups:    http://anorak.hubdigital360.com/controle/backup_login.html" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
