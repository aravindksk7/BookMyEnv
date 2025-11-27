# BookMyEnv - SSL Certificate Generator for Windows
# This script generates self-signed SSL certificates for development/testing
# For production, use Let's Encrypt or a commercial CA

param(
    [string]$Domain = "localhost",
    [int]$Days = 365,
    [string]$OutputDir = "./nginx/ssl"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  BookMyEnv SSL Certificate Generator  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if OpenSSL is available
$opensslPath = $null

# Try to find OpenSSL in common locations
$possiblePaths = @(
    "C:\Program Files\OpenSSL-Win64\bin\openssl.exe",
    "C:\Program Files\Git\usr\bin\openssl.exe",
    "C:\Program Files (x86)\Git\usr\bin\openssl.exe",
    "openssl"
)

foreach ($path in $possiblePaths) {
    try {
        $null = & $path version 2>&1
        $opensslPath = $path
        Write-Host "[OK] Found OpenSSL at: $path" -ForegroundColor Green
        break
    } catch {
        continue
    }
}

if (-not $opensslPath) {
    Write-Host "[ERROR] OpenSSL not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install OpenSSL using one of these methods:" -ForegroundColor Yellow
    Write-Host "  1. Install Git for Windows (includes OpenSSL)" -ForegroundColor White
    Write-Host "  2. Download from: https://slproweb.com/products/Win32OpenSSL.html" -ForegroundColor White
    Write-Host "  3. Use winget: winget install ShiningLight.OpenSSL" -ForegroundColor White
    Write-Host ""
    exit 1
}

# Create output directory
if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
    Write-Host "[OK] Created directory: $OutputDir" -ForegroundColor Green
}

$keyFile = Join-Path $OutputDir "server.key"
$crtFile = Join-Path $OutputDir "server.crt"
$csrFile = Join-Path $OutputDir "server.csr"
$configFile = Join-Path $OutputDir "openssl.cnf"

# Create OpenSSL config file
$opensslConfig = @"
[req]
default_bits = 2048
prompt = no
default_md = sha256
distinguished_name = dn
x509_extensions = v3_req
req_extensions = v3_req

[dn]
C = US
ST = State
L = City
O = BookMyEnv
OU = Development
CN = $Domain

[v3_req]
basicConstraints = CA:FALSE
keyUsage = nonRepudiation, digitalSignature, keyEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = $Domain
DNS.2 = *.$Domain
DNS.3 = localhost
DNS.4 = *.localhost
IP.1 = 127.0.0.1
IP.2 = ::1
"@

$opensslConfig | Out-File -FilePath $configFile -Encoding ASCII
Write-Host "[OK] Created OpenSSL config" -ForegroundColor Green

# Generate private key
Write-Host "[...] Generating private key..." -ForegroundColor Yellow
& $opensslPath genrsa -out $keyFile 2048 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Private key generated: $keyFile" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to generate private key" -ForegroundColor Red
    exit 1
}

# Generate certificate
Write-Host "[...] Generating self-signed certificate..." -ForegroundColor Yellow
& $opensslPath req -new -x509 -key $keyFile -out $crtFile -days $Days -config $configFile 2>&1 | Out-Null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Certificate generated: $crtFile" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to generate certificate" -ForegroundColor Red
    exit 1
}

# Display certificate info
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Certificate Information              " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
& $opensslPath x509 -in $crtFile -noout -subject -dates

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  SSL Certificates Generated!          " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Files created:" -ForegroundColor White
Write-Host "  - Private Key: $keyFile" -ForegroundColor White
Write-Host "  - Certificate: $crtFile" -ForegroundColor White
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Start with HTTPS:" -ForegroundColor White
Write-Host "     docker-compose -f docker-compose.https.yml up -d" -ForegroundColor Cyan
Write-Host ""
Write-Host "  2. Access the app:" -ForegroundColor White
Write-Host "     https://localhost" -ForegroundColor Cyan
Write-Host ""
Write-Host "  3. Accept the self-signed certificate warning in your browser" -ForegroundColor White
Write-Host ""
Write-Host "[NOTE] For production, replace with certificates from Let's Encrypt or a CA" -ForegroundColor Yellow
Write-Host ""

# Clean up config file
Remove-Item $configFile -Force -ErrorAction SilentlyContinue
