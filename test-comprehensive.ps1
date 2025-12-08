# BookMyEnv Comprehensive Functional Test Script (Fixed)
# Tests: Backend API, Database, and Frontend (headless)
# Run: powershell -ExecutionPolicy Bypass -File test-comprehensive.ps1

$baseUrl = "http://localhost:5000"
$frontendUrl = "http://localhost:3000"
$passed = 0
$failed = 0
$total = 0

function Log-Pass($msg) { 
    Write-Host "[PASS] $msg" -ForegroundColor Green
    $script:passed++
    $script:total++
}

function Log-Fail($msg) { 
    Write-Host "[FAIL] $msg" -ForegroundColor Red
    $script:failed++
    $script:total++
}

function Log-Section($msg) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "  $msg" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "###############################################" -ForegroundColor Magenta
Write-Host "#   BookMyEnv - Comprehensive Functional Test #" -ForegroundColor Magenta
Write-Host "#   Backend API + Database + Frontend         #" -ForegroundColor Magenta
Write-Host "###############################################" -ForegroundColor Magenta
Write-Host ""
Write-Host "Backend URL: $baseUrl"
Write-Host "Frontend URL: $frontendUrl"
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

# ==============================================================================
# SECTION 1: INFRASTRUCTURE HEALTH
# ==============================================================================
Log-Section "SECTION 1: Infrastructure Health"

# Test 1.1: Backend Health Check
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET -TimeoutSec 10
    if ($r.status -eq "healthy" -and $r.database -eq "connected") {
        Log-Pass "1.1 Backend Health - Status: $($r.status), DB: $($r.database)"
    } else {
        Log-Fail "1.1 Backend Health - Unexpected: $($r | ConvertTo-Json -Compress)"
    }
} catch {
    Log-Fail "1.1 Backend Health - $($_.Exception.Message)"
}

# Test 1.2: Frontend Accessibility
try {
    $r = Invoke-WebRequest -Uri "$frontendUrl" -Method GET -TimeoutSec 15 -UseBasicParsing
    if ($r.StatusCode -eq 200) {
        Log-Pass "1.2 Frontend Accessible - HTTP $($r.StatusCode)"
    } else {
        Log-Fail "1.2 Frontend Accessible - HTTP $($r.StatusCode)"
    }
} catch {
    Log-Fail "1.2 Frontend Accessible - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 2: AUTHENTICATION
# ==============================================================================
Log-Section "SECTION 2: Authentication"

# Test 2.1: Admin Login
$adminToken = $null
$adminHeaders = @{}
try {
    $body = '{"email":"admin@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    if ($r.token -and $r.user.role -eq "Admin") {
        $adminToken = $r.token
        $adminHeaders = @{Authorization = "Bearer $adminToken"}
        Log-Pass "2.1 Admin Login - Role: $($r.user.role)"
    } else {
        Log-Fail "2.1 Admin Login - Invalid response"
    }
} catch {
    Log-Fail "2.1 Admin Login - $($_.Exception.Message)"
}

# Test 2.2: Manager Login
$mgrToken = $null
$mgrHeaders = @{}
try {
    $body = '{"email":"envmgr@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    if ($r.token -and $r.user.role -eq "EnvironmentManager") {
        $mgrToken = $r.token
        $mgrHeaders = @{Authorization = "Bearer $mgrToken"}
        Log-Pass "2.2 Manager Login - Role: $($r.user.role)"
    } else {
        Log-Fail "2.2 Manager Login - Got role: $($r.user.role)"
    }
} catch {
    Log-Fail "2.2 Manager Login - $($_.Exception.Message)"
}

# Test 2.3: Tester Login
$testerToken = $null
$testerHeaders = @{}
try {
    $body = '{"email":"tester@bme.local","password":"Admin@123"}'
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    if ($r.token -and $r.user.role -eq "Tester") {
        $testerToken = $r.token
        $testerHeaders = @{Authorization = "Bearer $testerToken"}
        Log-Pass "2.3 Tester Login - Role: $($r.user.role)"
    } else {
        Log-Fail "2.3 Tester Login - Got role: $($r.user.role)"
    }
} catch {
    Log-Fail "2.3 Tester Login - $($_.Exception.Message)"
}

# Test 2.4: Invalid Login Rejection
try {
    $body = '{"email":"admin@bme.local","password":"wrongpassword"}'
    Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method POST -Body $body -ContentType "application/json" -TimeoutSec 10
    Log-Fail "2.4 Invalid Login - Should have failed"
} catch {
    Log-Pass "2.4 Invalid Login Rejected (401)"
}

# Test 2.5: Unauthenticated Access Blocked
try {
    Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method GET -TimeoutSec 10
    Log-Fail "2.5 Unauthenticated Access - Should fail"
} catch {
    Log-Pass "2.5 Unauthenticated Access Blocked"
}

# Test 2.6: Get Current User Profile
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/auth/me" -Method GET -Headers $adminHeaders -TimeoutSec 10
    if ($r.email -eq "admin@bme.local") {
        Log-Pass "2.6 Get User Profile - $($r.email)"
    } else {
        Log-Fail "2.6 Get User Profile - Unexpected"
    }
} catch {
    Log-Fail "2.6 Get User Profile - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 3: ENVIRONMENTS API
# ==============================================================================
Log-Section "SECTION 3: Environments API"

# Test 3.1: List Environments
$environments = @()
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/environments" -Method GET -Headers $adminHeaders -TimeoutSec 10
    $environments = $r.environments
    if ($environments.Count -gt 0) {
        Log-Pass "3.1 List Environments - Count: $($environments.Count)"
    } else {
        Log-Fail "3.1 List Environments - Empty"
    }
} catch {
    Log-Fail "3.1 List Environments - $($_.Exception.Message)"
}

# Test 3.2: Get Environment by ID (use first environment from list)
if ($environments.Count -gt 0) {
    $testEnvId = $environments[0].environment_id
    try {
        $r = Invoke-RestMethod -Uri "$baseUrl/api/environments/$testEnvId" -Method GET -Headers $adminHeaders -TimeoutSec 10
        if ($r.environment_id) {
            Log-Pass "3.2 Get Environment by ID - $($r.name)"
        } else {
            Log-Fail "3.2 Get Environment by ID - No ID returned"
        }
    } catch {
        Log-Fail "3.2 Get Environment by ID - $($_.Exception.Message)"
    }
} else {
    Log-Fail "3.2 Get Environment by ID - No environments"
}

# Test 3.3: List All Environment Instances (via /instances)
$instances = @()
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/instances" -Method GET -Headers $adminHeaders -TimeoutSec 10
    $instances = $r.instances
    if ($instances.Count -gt 0) {
        Log-Pass "3.3 List Environment Instances - Count: $($instances.Count)"
    } else {
        Log-Fail "3.3 List Environment Instances - Empty"
    }
} catch {
    Log-Fail "3.3 List Environment Instances - $($_.Exception.Message)"
}

# Test 3.4: Environment Statistics
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/environments/statistics" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "3.4 Environment Statistics - Retrieved"
} catch {
    Log-Fail "3.4 Environment Statistics - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 4: APPLICATIONS API
# ==============================================================================
Log-Section "SECTION 4: Applications API"

# Test 4.1: List Applications
$applications = @()
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/applications" -Method GET -Headers $adminHeaders -TimeoutSec 10
    $applications = $r.applications
    if ($applications.Count -gt 0) {
        Log-Pass "4.1 List Applications - Count: $($applications.Count)"
    } else {
        Log-Fail "4.1 List Applications - Empty"
    }
} catch {
    Log-Fail "4.1 List Applications - $($_.Exception.Message)"
}

# Test 4.2: Get Application by ID
if ($applications.Count -gt 0) {
    try {
        $appId = $applications[0].application_id
        $r = Invoke-RestMethod -Uri "$baseUrl/api/applications/$appId" -Method GET -Headers $adminHeaders -TimeoutSec 10
        if ($r.application_id) {
            Log-Pass "4.2 Get Application - $($r.name)"
        } else {
            Log-Fail "4.2 Get Application - No ID returned"
        }
    } catch {
        Log-Fail "4.2 Get Application - $($_.Exception.Message)"
    }
} else {
    Log-Fail "4.2 Get Application - Skipped"
}

# ==============================================================================
# SECTION 5: BOOKINGS API
# ==============================================================================
Log-Section "SECTION 5: Bookings API"

# Test 5.1: List Bookings
$bookings = @()
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method GET -Headers $adminHeaders -TimeoutSec 10
    $bookings = $r.bookings
    Log-Pass "5.1 List Bookings - Count: $($bookings.Count)"
} catch {
    Log-Fail "5.1 List Bookings - $($_.Exception.Message)"
}

# Test 5.2: Check Booking Conflicts API (route: /check-conflicts)
$bookableInstance = $instances | Where-Object { $_.bookable -eq $true } | Select-Object -First 1
if ($bookableInstance) {
    try {
        $startDate = (Get-Date).AddDays(90).ToString("yyyy-MM-ddTHH:mm:ss")
        $endDate = (Get-Date).AddDays(91).ToString("yyyy-MM-ddTHH:mm:ss")
        $body = @{
            resource_type = "EnvironmentInstance"
            resource_id = $bookableInstance.env_instance_id
            start_time = $startDate
            end_time = $endDate
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings/check-conflicts" -Method POST -Headers $adminHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        Log-Pass "5.2 Check Conflicts API - hasConflict: $($r.hasConflict)"
    } catch {
        Log-Fail "5.2 Check Conflicts API - $($_.Exception.Message)"
    }
} else {
    Log-Fail "5.2 Check Conflicts API - No bookable instance"
}

# Test 5.3: Create Booking
$newBookingId = $null
if ($bookableInstance) {
    try {
        $startDate = (Get-Date).AddDays(100).ToString("yyyy-MM-ddTHH:mm:ss")
        $endDate = (Get-Date).AddDays(101).ToString("yyyy-MM-ddTHH:mm:ss")
        $body = @{
            test_phase = "SIT"
            title = "API Test Booking $(Get-Date -Format 'HHmmss')"
            start_datetime = $startDate
            end_datetime = $endDate
            resources = @(
                @{
                    resource_type = "EnvironmentInstance"
                    resource_ref_id = $bookableInstance.env_instance_id
                }
            )
        } | ConvertTo-Json -Depth 3
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings" -Method POST -Headers $testerHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        if ($r.booking_id) {
            $newBookingId = $r.booking_id
            Log-Pass "5.3 Create Booking - Status: $($r.booking_status)"
        } else {
            Log-Fail "5.3 Create Booking - No ID returned"
        }
    } catch {
        Log-Fail "5.3 Create Booking - $($_.Exception.Message)"
    }
} else {
    Log-Fail "5.3 Create Booking - No bookable instance"
}

# Test 5.4: Get Booking by ID
if ($newBookingId) {
    try {
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings/$newBookingId" -Method GET -Headers $testerHeaders -TimeoutSec 10
        if ($r.booking_id -eq $newBookingId) {
            Log-Pass "5.4 Get Booking - $($r.title)"
        } else {
            Log-Fail "5.4 Get Booking - ID mismatch"
        }
    } catch {
        Log-Fail "5.4 Get Booking - $($_.Exception.Message)"
    }
} else {
    Log-Fail "5.4 Get Booking - Skipped"
}

# Test 5.5: Cancel Booking (via status update)
if ($newBookingId) {
    try {
        $body = @{ booking_status = "Cancelled" } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/bookings/$newBookingId/status" -Method PUT -Headers $testerHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        Log-Pass "5.5 Cancel Booking - Status: $($r.booking_status)"
    } catch {
        Log-Fail "5.5 Cancel Booking - $($_.Exception.Message)"
    }
} else {
    Log-Fail "5.5 Cancel Booking - Skipped"
}

# ==============================================================================
# SECTION 6: RELEASES API
# ==============================================================================
Log-Section "SECTION 6: Releases API"

# Test 6.1: List Releases
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/releases" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "6.1 List Releases - Count: $($r.releases.Count)"
} catch {
    Log-Fail "6.1 List Releases - $($_.Exception.Message)"
}

# Test 6.2: Create Release
$newReleaseId = $null
if ($applications.Count -gt 0) {
    try {
        $body = @{
            name = "Test Release $(Get-Date -Format 'yyyyMMddHHmmss')"
            application_id = $applications[0].application_id
            version = "1.0.0-test"
            scheduled_date = (Get-Date).AddDays(14).ToString("yyyy-MM-dd")
            status = "Planned"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/releases" -Method POST -Headers $adminHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        if ($r.release_id) {
            $newReleaseId = $r.release_id
            Log-Pass "6.2 Create Release - $($r.name)"
        } else {
            Log-Fail "6.2 Create Release - No ID"
        }
    } catch {
        Log-Fail "6.2 Create Release - $($_.Exception.Message)"
    }
} else {
    Log-Fail "6.2 Create Release - Skipped"
}

# ==============================================================================
# SECTION 7: INTERFACES API
# ==============================================================================
Log-Section "SECTION 7: Interfaces API"

# Test 7.1: List Interfaces
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/interfaces" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "7.1 List Interfaces - Count: $($r.interfaces.Count)"
} catch {
    Log-Fail "7.1 List Interfaces - $($_.Exception.Message)"
}

# Test 7.2: List All Interface Endpoints
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/interfaces/endpoints/all" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "7.2 List All Endpoints - Count: $($r.endpoints.Count)"
} catch {
    Log-Fail "7.2 List All Endpoints - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 8: CONFIGURATION API
# ==============================================================================
Log-Section "SECTION 8: Configuration API"

# Test 8.1: List Config Sets (via /api/configs)
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/configs" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "8.1 List Config Sets - Count: $($r.configSets.Count)"
} catch {
    Log-Fail "8.1 List Config Sets - $($_.Exception.Message)"
}

# Test 8.2: Create Config Set
$newConfigSetId = $null
if ($applications.Count -gt 0) {
    try {
        $body = @{
            name = "Test Config $(Get-Date -Format 'yyyyMMddHHmmss')"
            scope_type = "Application"
            scope_ref_id = $applications[0].application_id
            version = "1.0"
            status = "Draft"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/configs" -Method POST -Headers $adminHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        if ($r.config_set_id) {
            $newConfigSetId = $r.config_set_id
            Log-Pass "8.2 Create Config Set - $($r.name)"
        } else {
            Log-Fail "8.2 Create Config Set - No ID"
        }
    } catch {
        Log-Fail "8.2 Create Config Set - $($_.Exception.Message)"
    }
} else {
    Log-Fail "8.2 Create Config Set - Skipped"
}

# Test 8.3: Add Config Item
if ($newConfigSetId) {
    try {
        $body = @{
            key = "test.key"
            value = "test-value"
            data_type = "String"
        } | ConvertTo-Json
        $r = Invoke-RestMethod -Uri "$baseUrl/api/configs/$newConfigSetId/items" -Method POST -Headers $adminHeaders -Body $body -ContentType "application/json" -TimeoutSec 10
        if ($r.config_item_id) {
            Log-Pass "8.3 Add Config Item - Key: test.key"
        } else {
            Log-Fail "8.3 Add Config Item - No ID"
        }
    } catch {
        Log-Fail "8.3 Add Config Item - $($_.Exception.Message)"
    }
} else {
    Log-Fail "8.3 Add Config Item - Skipped"
}

# ==============================================================================
# SECTION 9: GROUPS API
# ==============================================================================
Log-Section "SECTION 9: Groups API"

try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/groups" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "9.1 List Groups - Count: $($r.groups.Count)"
} catch {
    Log-Fail "9.1 List Groups - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 10: INTEGRATIONS API
# ==============================================================================
Log-Section "SECTION 10: Integrations API"

try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/integrations" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "10.1 List Integrations - Count: $($r.integrations.Count)"
} catch {
    Log-Fail "10.1 List Integrations - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 11: USER MANAGEMENT & RBAC
# ==============================================================================
Log-Section "SECTION 11: User Management & RBAC"

# Test 11.1: List Users (Admin)
try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/users" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "11.1 List Users (Admin) - Count: $($r.users.Count)"
} catch {
    Log-Fail "11.1 List Users (Admin) - $($_.Exception.Message)"
}

# Test 11.2: Tester Cannot Access Users
try {
    Invoke-RestMethod -Uri "$baseUrl/api/users" -Method GET -Headers $testerHeaders -TimeoutSec 10
    Log-Fail "11.2 RBAC Users Access - Should fail"
} catch {
    Log-Pass "11.2 RBAC - Tester Blocked from Users"
}

# ==============================================================================
# SECTION 12: CHANGES API
# ==============================================================================
Log-Section "SECTION 12: Changes API"

try {
    $r = Invoke-RestMethod -Uri "$baseUrl/api/changes" -Method GET -Headers $adminHeaders -TimeoutSec 10
    Log-Pass "12.1 List Changes - Count: $($r.changes.Count)"
} catch {
    Log-Fail "12.1 List Changes - $($_.Exception.Message)"
}

# ==============================================================================
# SECTION 13: FRONTEND PAGES
# ==============================================================================
Log-Section "SECTION 13: Frontend Pages"

$pages = @(
    @{path="/"; name="Login"},
    @{path="/dashboard"; name="Dashboard"},
    @{path="/environments"; name="Environments"},
    @{path="/bookings"; name="Bookings"},
    @{path="/releases"; name="Releases"},
    @{path="/configs"; name="Configs"},
    @{path="/groups"; name="Groups"},
    @{path="/integrations"; name="Integrations"},
    @{path="/topology"; name="Topology"},
    @{path="/monitoring"; name="Monitoring"},
    @{path="/settings"; name="Settings"}
)

$pageNum = 1
foreach ($page in $pages) {
    try {
        $r = Invoke-WebRequest -Uri "$frontendUrl$($page.path)" -Method GET -TimeoutSec 10 -UseBasicParsing
        Log-Pass "13.$pageNum $($page.name) - HTTP $($r.StatusCode)"
    } catch {
        if ($_.Exception.Response.StatusCode.Value__ -in @(200, 302, 307, 308)) {
            Log-Pass "13.$pageNum $($page.name) - Redirect OK"
        } else {
            Log-Fail "13.$pageNum $($page.name) - $($_.Exception.Message)"
        }
    }
    $pageNum++
}

# ==============================================================================
# CLEANUP
# ==============================================================================
Log-Section "Cleanup"

if ($newReleaseId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/releases/$newReleaseId" -Method DELETE -Headers $adminHeaders -TimeoutSec 10 | Out-Null
        Write-Host "  Deleted test release" -ForegroundColor Gray
    } catch { Write-Host "  Release cleanup failed" -ForegroundColor Gray }
}

if ($newConfigSetId) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/api/configs/$newConfigSetId" -Method DELETE -Headers $adminHeaders -TimeoutSec 10 | Out-Null
        Write-Host "  Deleted test config set" -ForegroundColor Gray
    } catch { Write-Host "  Config cleanup failed" -ForegroundColor Gray }
}

Write-Host "  Cleanup completed" -ForegroundColor Gray

# ==============================================================================
# SUMMARY
# ==============================================================================
Write-Host ""
Write-Host "###############################################" -ForegroundColor Magenta
Write-Host "#              TEST SUMMARY                   #" -ForegroundColor Magenta
Write-Host "###############################################" -ForegroundColor Magenta
Write-Host ""
Write-Host "Total Tests: $total"
Write-Host "Passed:      $passed" -ForegroundColor Green
Write-Host "Failed:      $failed" -ForegroundColor $(if ($failed -gt 0) { "Red" } else { "Green" })
Write-Host ""
$successRate = [math]::Round(($passed / $total) * 100, 1)
Write-Host "Success Rate: $successRate%" -ForegroundColor $(if ($successRate -ge 90) { "Green" } elseif ($successRate -ge 70) { "Yellow" } else { "Red" })
Write-Host ""
Write-Host "Completed: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ""

if ($failed -eq 0) {
    Write-Host "ALL TESTS PASSED!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME TESTS FAILED - Review output above" -ForegroundColor Yellow
    exit 1
}
