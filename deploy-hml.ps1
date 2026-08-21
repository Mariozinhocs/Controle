# Script de Deploy Automático para Homologação (/hml) via FTP (Subdomínio controle.hubdigital360.com)
# Desenvolvido por Mario Henrique (mariozinhocs) - mariozinhocs@gmail.com
# "si vis pacem para bellum"
$ftpHost = "ftp://ftp.controle.hubdigital360.com"
$username = "u576215103.controle"
$password = "+KVs|jC5"
$localDir = $PSScriptRoot

Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "  CONTROLE MGP - Deploy para HOMOLOGAÇÃO (HML)   " -ForegroundColor Cyan
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

# 1. Cria a estrutura de pastas remotas no ambiente de homologação
Create-FtpDirectory "hml"
Create-FtpDirectory "hml/api"
Create-FtpDirectory "hml/api/backups"
Create-FtpDirectory "hml/libs"

# Remover index.html legado no servidor de HML
Delete-RemoteFile "hml/index.html"

# 2. Upload dos arquivos do Dashboard e Repositório
Upload-File "$localDir\index.php" "hml/index.php"
Upload-File "$localDir\styles.css" "hml/styles.css"
Upload-File "$localDir\app.js" "hml/app.js"
Upload-File "$localDir\app_icon.png" "hml/app_icon.png"

# Upload das bibliotecas auxiliares
Upload-File "$localDir\libs\xlsx.mini.min.js" "hml/libs/xlsx.mini.min.js"
Upload-File "$localDir\libs\papaparse.min.js" "hml/libs/papaparse.min.js"
Upload-File "$localDir\libs\apexcharts.js" "hml/libs/apexcharts.js"

Upload-File "$localDir\backup_login.html" "hml/backup_login.html"
Upload-File "$localDir\backup_repo.html" "hml/backup_repo.html"
Upload-File "$localDir\styles_repo.css" "hml/styles_repo.css"

# 3. Upload das APIs PHP (incluindo sincronização com banco para testar em HML)
Upload-File "$localDir\api\db.php" "hml/api/db.php"
Upload-File "$localDir\api\get_data.php" "hml/api/get_data.php"
Upload-File "$localDir\api\sync_data.php" "hml/api/sync_data.php"
Upload-File "$localDir\api\save_backup.php" "hml/api/save_backup.php"
Upload-File "$localDir\api\login.php" "hml/api/login.php"
Upload-File "$localDir\api\check_auth.php" "hml/api/check_auth.php"
Upload-File "$localDir\api\logout.php" "hml/api/logout.php"
Upload-File "$localDir\api\list_backups.php" "hml/api/list_backups.php"
Upload-File "$localDir\api\delete_backup.php" "hml/api/delete_backup.php"
Upload-File "$localDir\api\download_backup.php" "hml/api/download_backup.php"

# 4. Cria e envia arquivos do subsistema de veículos contratados para HML
Create-FtpDirectory "hml/veiculos"
Create-FtpDirectory "hml/veiculos/api"

Upload-File "$localDir\veiculos\index.php" "hml/veiculos/index.php"
Upload-File "$localDir\veiculos\styles.css" "hml/veiculos/styles.css"
Upload-File "$localDir\veiculos\veiculos.js" "hml/veiculos/veiculos.js"
Upload-File "$localDir\veiculos\api\get_veiculos.php" "hml/veiculos/api/get_veiculos.php"
Upload-File "$localDir\veiculos\api\save_veiculo.php" "hml/veiculos/api/save_veiculo.php"
Upload-File "$localDir\veiculos\api\delete_veiculo.php" "hml/veiculos/api/delete_veiculo.php"

Write-Host "`n=================================================" -ForegroundColor Green
Write-Host " Deploy HML finalizado com sucesso!" -ForegroundColor Green
Write-Host " Painel do Controle HML:  https://controle.hubdigital360.com/hml/" -ForegroundColor Cyan
Write-Host " Veículos Contratados HML: https://controle.hubdigital360.com/hml/veiculos/" -ForegroundColor Cyan
Write-Host "=================================================" -ForegroundColor Green
