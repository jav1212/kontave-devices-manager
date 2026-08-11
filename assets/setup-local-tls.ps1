param([Parameter(Mandatory = $true)][string]$ConfigPath)
$ErrorActionPreference = "Stop"
$agentDir = Split-Path -Parent $ConfigPath
New-Item -ItemType Directory -Force -Path $agentDir | Out-Null
$pfxPath = Join-Path $agentDir "localhost-device-manager.pfx"
$passwordText = [Guid]::NewGuid().ToString("N")
$password = ConvertTo-SecureString -String $passwordText -Force -AsPlainText
$cert = New-SelfSignedCertificate -Subject "CN=localhost" -DnsName "localhost" -CertStoreLocation "Cert:\CurrentUser\My" -KeyAlgorithm RSA -KeyLength 2048 -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(3) -FriendlyName "Kontave Device Manager localhost"
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null
$rootStore = New-Object System.Security.Cryptography.X509Certificates.X509Store("Root", "CurrentUser")
try { $rootStore.Open("ReadWrite"); $rootStore.Add($cert) } finally { $rootStore.Close() }
$config = if (Test-Path -LiteralPath $ConfigPath) { Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json } else { New-Object PSObject }
if ($null -eq $config.websocketPort) { $config | Add-Member -NotePropertyName websocketPort -NotePropertyValue 47831 }
if ($null -eq $config.baudRate) { $config | Add-Member -NotePropertyName baudRate -NotePropertyValue 9600 }
if ($null -eq $config.allowedOrigins) { $config | Add-Member -NotePropertyName allowedOrigins -NotePropertyValue @("https://kontave.com", "https://www.kontave.com", "http://localhost:3000") }
$config | Add-Member -Force -NotePropertyName tlsPfxPath -NotePropertyValue $pfxPath
$config | Add-Member -Force -NotePropertyName tlsPfxPassphrase -NotePropertyValue $passwordText
$config | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath $ConfigPath -Encoding UTF8
