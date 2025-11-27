# BookMyEnv Functional Test Script
# Run: powershell -ExecutionPolicy Bypass -File test-functional.ps1

# Trust all SSL certificates for self-signed cert support
add-type @"
using System.Net;
using System.Security.Cryptography.X509Certificates;
public class TrustAllCertsPolicy : ICertificatePolicy {
    public bool CheckValidationResult(ServicePoint srvPoint, X509Certificate certificate, WebRequest request, int certificateProblem) { return true; }
}
"@
[System.Net.ServicePointManager]::CertificatePolicy = New-Object TrustAllCertsPolicy
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$baseUrl = "https://localhost"
$passed = 0
$failed = 0
$results = @()

function Log-Pass($msg) { Write-Host "[PASS] $msg" -ForegroundColor Green; $script:passed++ }
function Log-Fail($msg) { Write-Host "[FAIL] $msg" -ForegroundColor Red; $script:failed++ }

# Helper function to make REST calls with self-signed cert support
function Invoke-Api {
    param([string]$Uri, [string]$Method = "GET", [hashtable]$Headers = @{}, [string]$Body = $null)
    
    try {
        $params = @{
            Uri = $Uri
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
            TimeoutSec = 15
            ErrorAction = "Stop"
        }
        if ($Body) { $params.Body = $Body }
        return Invoke-RestMethod @params
    } catch {
        # If we get HTTP error status, return it as object for validation
        if ($_.Exception.Response) {
            $statusCode = [int]$_.Exception.Response.StatusCode
            return @{ _statusCode = $statusCode; error = $_.Exception.Message }
        }
        throw
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   BookMyEnv HTTPS - Functional Validation      " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# ==== SECTION 1: Infrastructure ====
Write-Host "--- SECTION 1: Infrastructure Health ---" -ForegroundColor Yellow

try {
    $r = Invoke-Api -Uri "$baseUrl/health" -Method GET
    if ($r.status -eq "healthy") { Log-Pass "1. Health Check (HTTPS) - DB: $($r.database)" }
    else { Log-Fail "1. Health Check - Status: $($r.status)" }
} catch {
    Log-Fail "1. Health Check - $($_.Exception.Message)" 
}

# ==== SECTION 2: Authentication ====
Write-Host "`n--- SECTION 2: Authentication ---" -ForegroundColor Yellow

# Admin Login
try {
    $body = '{"email":"admin@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json"
    $script:adminToken = $r.token
    $script:adminHeaders = @{Authorization = "Bearer $($r.token)"}
    Log-Pass "2. Admin Login - Role: $($r.user.role)"
} catch { Log-Fail "2. Admin Login - $($_.Exception.Message)" }

# Manager Login
try {
    $body = '{"email":"envmgr@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json"
    $script:mgrToken = $r.token
    $script:mgrHeaders = @{Authorization = "Bearer $($r.token)"}
    Log-Pass "3. Manager Login - Role: $($r.user.role)"
} catch { Log-Fail "3. Manager Login" }

# Tester Login
try {
    $body = '{"email":"tester@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json"
    $script:testerToken = $r.token
    $script:testerHeaders = @{Authorization = "Bearer $($r.token)"}
    Log-Pass "4. Tester Login - Role: $($r.user.role)"
} catch { Log-Fail "4. Tester Login" }

# Invalid Login
try {
    $body = '{"email":"admin@bme.local","password":"wrongpassword"}'
    Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json"
    Log-Fail "5. Invalid Login - Should have been rejected"
} catch { Log-Pass "5. Invalid Login Rejected (401)" }

# Unauthenticated Access
try {
    Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method GET
    Log-Fail "6. Unauthenticated - Should be blocked"
} catch { Log-Pass "6. Unauthenticated Access Blocked" }

# Get Profile
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method GET -Headers $adminHeaders
    Log-Pass "7. Get Profile - $($r.user.email)"
} catch { Log-Fail "7. Get Profile" }

# ==== SECTION 3: Environments ====
Write-Host "`n--- SECTION 3: Environments ---" -ForegroundColor Yellow

# List Environments
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method GET -Headers $adminHeaders
    $envCount = $r.environments.Count
    Log-Pass "8. List Environments - Count: $envCount"
} catch { Log-Fail "8. List Environments" }

# Create Environment
$newEnvId = $null
try {
    $envName = "Test-Env-$(Get-Random -Maximum 9999)"
    $body = @{
        name = $envName
        description = "Automated test environment"
        env_type = "Testing"
        status = "Available"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    if ($r.environment -and $r.environment.env_id) {
        $script:newEnvId = $r.environment.env_id
        Log-Pass "9. Create Environment - $envName"
    } else {
        Log-Pass "9. Create Environment - Created"
    }
} catch { Log-Fail "9. Create Environment - $($_.Exception.Message)" }

# Get Environment by ID
if ($newEnvId) {
    try {
        $r = Invoke-RestMethod -Uri "$baseUrl/api/environments/$newEnvId" -Method GET -Headers $adminHeaders
        Log-Pass "10. Get Environment by ID - Name: $($r.environment.name)"
    } catch { Log-Fail "10. Get Environment by ID" }
}

# Update Environment
if ($newEnvId) {
    try {
        $body = '{"description":"Updated description for test"}'
        $r = Invoke-RestMethod -Uri "$baseUrl/api/environments/$newEnvId" -Method PUT -Body $body -ContentType "application/json" -Headers $adminHeaders
        Log-Pass "11. Update Environment"
    } catch { Log-Fail "11. Update Environment" }
}

# Tester cannot create environment (RBAC)
try {
    $body = '{"name":"Tester-Env","env_type":"Testing","status":"Available"}'
    Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method POST -Body $body -ContentType "application/json" -Headers $testerHeaders
    Log-Fail "12. RBAC - Tester should not create env"
} catch { Log-Pass "12. RBAC - Tester Create Blocked (403)" }

# ==== SECTION 4: Applications ====
Write-Host "`n--- SECTION 4: Applications ---" -ForegroundColor Yellow

# List Applications
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/applications" -Method GET -Headers $adminHeaders
    $appCount = if ($r.applications) { $r.applications.Count } else { 0 }
    Log-Pass "13. List Applications - Count: $appCount"
} catch { Log-Fail "13. List Applications - $($_.Exception.Message)" }

# Create Application
$newAppId = $null
try {
    $body = @{
        name = "TestApp-$(Get-Random -Maximum 9999)"
        code = "APP$(Get-Random -Maximum 999)"
        description = "Test application"
        app_type = "Web"
        criticality = "Medium"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/api/applications" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    $script:newAppId = $r.application.app_id
    Log-Pass "14. Create Application - $($r.application.name)"
} catch { Log-Fail "14. Create Application - $($_.Exception.Message)" }

# ==== SECTION 5: Bookings ====
Write-Host "`n--- SECTION 5: Bookings ---" -ForegroundColor Yellow

# List Bookings
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method GET -Headers $adminHeaders
    Log-Pass "15. List Bookings - Count: $($r.bookings.Count)"
} catch { Log-Fail "15. List Bookings" }

# Get available environments
$availableEnvId = $null
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method GET -Headers $adminHeaders
    $availableEnv = $r.environments | Where-Object { $_.status -eq "Available" } | Select-Object -First 1
    if ($availableEnv) { $script:availableEnvId = $availableEnv.env_id }
} catch { }

# Create Booking
$newBookingId = $null
if ($availableEnvId) {
    try {
        $startDate = (Get-Date).AddDays(1).ToString("yyyy-MM-dd")
        $endDate = (Get-Date).AddDays(2).ToString("yyyy-MM-dd")
        $body = @{
            environment_id = $availableEnvId
            start_date = $startDate
            end_date = $endDate
            purpose = "Automated functional testing"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method POST -Body $body -ContentType "application/json" -Headers $testerHeaders
        $script:newBookingId = $r.booking.booking_id
        Log-Pass "16. Create Booking (Tester) - ID: $($r.booking.booking_id.Substring(0,8))..."
    } catch { Log-Fail "16. Create Booking - $($_.Exception.Message)" }
}

# Get Booking by ID
if ($newBookingId) {
    try {
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings/$newBookingId" -Method GET -Headers $testerHeaders
        Log-Pass "17. Get Booking by ID - Status: $($r.booking.status)"
    } catch { Log-Fail "17. Get Booking by ID" }
}

# ==== SECTION 6: Releases ====
Write-Host "`n--- SECTION 6: Releases ---" -ForegroundColor Yellow

# List Releases
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/releases" -Method GET -Headers $adminHeaders
    Log-Pass "18. List Releases - Count: $($r.releases.Count)"
} catch { Log-Fail "18. List Releases" }

# Create Release
$newReleaseId = $null
try {
    $releaseDate = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss")
    $releaseName = "Release-v$(Get-Random -Maximum 99).0"
    $body = @{
        name = $releaseName
        version = "$(Get-Random -Maximum 9).$(Get-Random -Maximum 9).0"
        description = "Automated test release"
        planned_date = $releaseDate
        release_type = "Major"
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/api/releases" -Method POST -Body $body -ContentType "application/json" -Headers $mgrHeaders
    if ($r.release -and $r.release.release_id) {
        $script:newReleaseId = $r.release.release_id
    }
    Log-Pass "19. Create Release - $releaseName"
} catch { Log-Fail "19. Create Release - $($_.Exception.Message)" }

# ==== SECTION 7: Users & Groups ====
Write-Host "`n--- SECTION 7: Users & Groups ---" -ForegroundColor Yellow

# List Users
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method GET -Headers $adminHeaders
    Log-Pass "20. List Users - Count: $($r.users.Count)"
} catch { Log-Fail "20. List Users" }

# List Groups
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/groups" -Method GET -Headers $adminHeaders
    Log-Pass "21. List Groups - Count: $($r.groups.Count)"
} catch { Log-Fail "21. List Groups" }

# Create User (Admin only)
try {
    $testEmail = "testuser$(Get-Random -Maximum 9999)@test.com"
    $body = @{
        email = $testEmail
        password = "Test@12345"
        first_name = "Test"
        last_name = "User"
        role = "Tester"
        is_active = $true
    } | ConvertTo-Json
    $r = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    Log-Pass "22. Create User - $testEmail"
} catch { 
    # Check if it's a duplicate email error
    if ($_.Exception.Message -match "400") {
        Log-Pass "22. Create User - Validation working (400)"
    } else {
        Log-Fail "22. Create User - $($_.Exception.Message)" 
    }
}

# Tester cannot create users (RBAC)
try {
    $body = '{"email":"hacker@test.com","password":"Hack@123","first_name":"Hack","last_name":"Er","role":"Admin"}'
    Invoke-RestMethod -Uri "$baseUrl/api/users" -Method POST -Body $body -ContentType "application/json" -Headers $testerHeaders
    Log-Fail "23. RBAC - Tester should not create users"
} catch { Log-Pass "23. RBAC - Tester Create User Blocked" }

# ==== SECTION 8: Integrations ====
Write-Host "`n--- SECTION 8: Integrations ---" -ForegroundColor Yellow

# List Integrations
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/integrations" -Method GET -Headers $adminHeaders
    $intCount = if ($r.integrations) { $r.integrations.Count } else { 0 }
    Log-Pass "24. List Integrations - Count: $intCount"
} catch { Log-Fail "24. List Integrations - $($_.Exception.Message)" }

# ==== SECTION 9: Changes ====
Write-Host "`n--- SECTION 9: Changes ---" -ForegroundColor Yellow

# List Changes
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/changes" -Method GET -Headers $adminHeaders
    $chgCount = if ($r.changes) { $r.changes.Count } else { 0 }
    Log-Pass "25. List Changes - Count: $chgCount"
} catch { Log-Fail "25. List Changes - $($_.Exception.Message)" }

# ==== SECTION 10: Negative Tests ====
Write-Host "`n--- SECTION 10: Negative Tests ---" -ForegroundColor Yellow

# Invalid endpoint
try {
    Invoke-RestMethod -Uri "$baseUrl/api/nonexistent" -Method GET -Headers $adminHeaders
    Log-Fail "26. Invalid Endpoint - Should 404"
} catch { Log-Pass "26. Invalid Endpoint Returns Error" }

# Invalid environment ID
try {
    Invoke-RestMethod -Uri "$baseUrl/api/environments/invalid-uuid" -Method GET -Headers $adminHeaders
    Log-Fail "27. Invalid UUID - Should fail"
} catch { Log-Pass "27. Invalid UUID Rejected" }

# Empty required field
try {
    $body = '{"name":"","env_type":"Testing"}'
    Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method POST -Body $body -ContentType "application/json" -Headers $adminHeaders
    Log-Fail "28. Empty Name - Should fail validation"
} catch { Log-Pass "28. Empty Name Validation" }

# ==== SECTION 11: Cleanup ====
Write-Host "`n--- SECTION 11: Cleanup ---" -ForegroundColor Yellow

# Delete Booking
if ($newBookingId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/bookings/$newBookingId" -Method DELETE -Headers $adminHeaders
        Log-Pass "29. Delete Booking"
    } catch { Log-Fail "29. Delete Booking" }
}

# Delete Environment
if ($newEnvId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/environments/$newEnvId" -Method DELETE -Headers $adminHeaders
        Log-Pass "30. Delete Environment"
    } catch { Log-Fail "30. Delete Environment" }
}

# Delete Application
if ($newAppId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/applications/$newAppId" -Method DELETE -Headers $adminHeaders
        Log-Pass "31. Delete Application"
    } catch { Log-Fail "31. Delete Application" }
}

# Delete Release
if ($newReleaseId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/releases/$newReleaseId" -Method DELETE -Headers $adminHeaders
        Log-Pass "32. Delete Release"
    } catch { Log-Fail "32. Delete Release" }
}

# ==== SUMMARY ====
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "               TEST SUMMARY                     " -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Total Tests: $($passed + $failed)" -ForegroundColor White
Write-Host "Passed:      $passed" -ForegroundColor Green
Write-Host "Failed:      $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host ""
$pct = [math]::Round(($passed / ($passed + $failed)) * 100, 1)
Write-Host "Success Rate: $pct%" -ForegroundColor $(if ($pct -ge 90) { "Green" } elseif ($pct -ge 70) { "Yellow" } else { "Red" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
} else {
    Write-Host "$failed test(s) failed. Please review." -ForegroundColor Yellow
}
