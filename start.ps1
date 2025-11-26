#!/usr/bin/env pwsh
# BookMyEnv (BME) - Start Script (PowerShell)

Write-Host ""
Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     BOOKMYENV (BME) - Environment Booking System                  ║" -ForegroundColor Cyan
Write-Host "║     Starting Application...                                       ║" -ForegroundColor Cyan
Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is running
try {
    docker info | Out-Null
} catch {
    Write-Host "ERROR: Docker is not running. Please start Docker Desktop first." -ForegroundColor Red
    exit 1
}

Write-Host "Building and starting containers..." -ForegroundColor Yellow
docker-compose up --build -d

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "╔═══════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║     APPLICATION STARTED SUCCESSFULLY!                             ║" -ForegroundColor Green
    Write-Host "╠═══════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║                                                                   ║" -ForegroundColor Green
    Write-Host "║     Frontend:    http://localhost:3000                            ║" -ForegroundColor Green
    Write-Host "║     Backend API: http://localhost:5000                            ║" -ForegroundColor Green
    Write-Host "║     PostgreSQL:  localhost:5432                                   ║" -ForegroundColor Green
    Write-Host "║                                                                   ║" -ForegroundColor Green
    Write-Host "╠═══════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║     Demo Credentials:                                             ║" -ForegroundColor Green
    Write-Host "║     Admin:    admin@bme.local / Admin@123                         ║" -ForegroundColor Green
    Write-Host "║     Manager:  envmgr@bme.local / Manager@123                      ║" -ForegroundColor Green
    Write-Host "║     Lead:     lead@bme.local / Lead@123                           ║" -ForegroundColor Green
    Write-Host "║     Tester:   tester@bme.local / Tester@123                       ║" -ForegroundColor Green
    Write-Host "║                                                                   ║" -ForegroundColor Green
    Write-Host "╠═══════════════════════════════════════════════════════════════════╣" -ForegroundColor Green
    Write-Host "║     To stop: docker-compose down                                  ║" -ForegroundColor Green
    Write-Host "║     To view logs: docker-compose logs -f                          ║" -ForegroundColor Green
    Write-Host "║                                                                   ║" -ForegroundColor Green
    Write-Host "╚═══════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "ERROR: Failed to start containers. Check docker-compose logs for details." -ForegroundColor Red
    exit 1
}
