# BookMyEnv - HTTPS Startup Script for Windows
# This script sets up SSL certificates and starts the application with HTTPS

param(
    [switch]$Build,
    [switch]$GenerateCert,
    [switch]$Stop
)

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     BookMyEnv HTTPS Launcher          " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop containers if requested
if ($Stop) {
    Write-Host "[...] Stopping containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.https.yml down
    Write-Host "[OK] Containers stopped" -ForegroundColor Green
    exit 0
}

# Check if Docker is running
try {
    $null = docker info 2>&1
} catch {
    Write-Host "[ERROR] Docker is not running!" -ForegroundColor Red
    Write-Host "Please start Docker Desktop and try again." -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Docker is running" -ForegroundColor Green

# Check/Generate SSL certificates
$sslDir = "./nginx/ssl"
$keyFile = "$sslDir/server.key"
$crtFile = "$sslDir/server.crt"

if ($GenerateCert -or -not (Test-Path $keyFile) -or -not (Test-Path $crtFile)) {
    Write-Host "[...] Generating SSL certificates..." -ForegroundColor Yellow
    & ./generate-ssl.ps1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to generate SSL certificates" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "[OK] SSL certificates found" -ForegroundColor Green
}

# Build containers if requested
if ($Build) {
    Write-Host ""
    Write-Host "[...] Building containers..." -ForegroundColor Yellow
    docker-compose -f docker-compose.https.yml build
    Write-Host "[OK] Build complete" -ForegroundColor Green
}

# Start containers
Write-Host ""
Write-Host "[...] Starting containers..." -ForegroundColor Yellow
docker-compose -f docker-compose.https.yml up -d

# Wait for services to be ready
Write-Host ""
Write-Host "[...] Waiting for services to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

# Check container status
$containers = docker-compose -f docker-compose.https.yml ps --format json 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Containers started successfully" -ForegroundColor Green
}

# Display status
Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "     BookMyEnv is now running!         " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Access the application:" -ForegroundColor White
Write-Host "  HTTPS: " -NoNewline
Write-Host "https://localhost" -ForegroundColor Cyan
Write-Host "  HTTP:  " -NoNewline
Write-Host "http://localhost" -ForegroundColor Cyan
Write-Host "         (redirects to HTTPS)" -ForegroundColor Gray
Write-Host ""
Write-Host "API Endpoints:" -ForegroundColor White
Write-Host "  Health: https://localhost/health" -ForegroundColor Cyan
Write-Host "  API:    https://localhost/api" -ForegroundColor Cyan
Write-Host ""
Write-Host "Default Login:" -ForegroundColor White
Write-Host "  Email:    admin@bme.local" -ForegroundColor Cyan
Write-Host "  Password: Admin@123" -ForegroundColor Cyan
Write-Host ""
Write-Host "[NOTE] Accept the self-signed certificate warning in your browser" -ForegroundColor Yellow
Write-Host ""
Write-Host "Commands:" -ForegroundColor White
Write-Host "  View logs:       docker-compose -f docker-compose.https.yml logs -f" -ForegroundColor Gray
Write-Host "  Stop:            ./start-https.ps1 -Stop" -ForegroundColor Gray
Write-Host "  Rebuild:         ./start-https.ps1 -Build" -ForegroundColor Gray
Write-Host "  Regenerate SSL:  ./start-https.ps1 -GenerateCert" -ForegroundColor Gray
Write-Host ""
