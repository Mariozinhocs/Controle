# Script de Deploy para LABORATORIO (/lab) via FTP
# Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
# "si vis pacem para bellum"
$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"
$localDir = $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONTROLE MGP - Deploy para LABORATORIO (LAB)   " -ForegroundColor Cyan
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
        # Diretorio ja existe
    }
}

# 1. Cria a estrutura de pastas remotas no ambiente de laboratorio
Create-FtpDirectory "lab"
Create-FtpDirectory "lab/libs"
Create-FtpDirectory "lab/api"

# 2. Upload dos arquivos do Modulo de Laboratorio
Upload-File "$localDir\lab\index.php" "lab/index.php"
Upload-File "$localDir\lab\styles.css" "lab/styles.css"
Upload-File "$localDir\lab\dispensador.js" "lab/dispensador.js"
Upload-File "$localDir\app_icon.png" "lab/app_icon.png"

# Upload das bibliotecas auxiliares necessarias
Upload-File "$localDir\libs\xlsx.mini.min.js" "lab/libs/xlsx.mini.min.js"
Upload-File "$localDir\libs\papaparse.min.js" "lab/libs/papaparse.min.js"

# Upload das APIs auxiliares para leitura/escrita
Upload-File "$localDir\api\logger.php" "lab/api/logger.php"
Upload-File "$localDir\api\db.php" "lab/api/db.php"
Upload-File "$localDir\api\get_data.php" "lab/api/get_data.php"
Upload-File "$localDir\api\sync_data.php" "lab/api/sync_data.php"

Write-Host "=================================================" -ForegroundColor Green
Write-Host " Deploy LAB finalizado com sucesso!" -ForegroundColor Green
Write-Host " URL do Laboratorio (Dispensador): https://controle.hubdigital360.com/lab/" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
