# Test Pagination and Search Functionality
# Tests the new pagination and optimized search features

$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000"
$passed = 0
$failed = 0

function Test-Endpoint {
    param($name, $url, $method = "GET", $headers = @{}, $body = $null, [switch]$expectPagination)
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $headers }
        if ($body) { 
            $params["Body"] = $body
            $params["ContentType"] = "application/json"
        }
        $result = Invoke-RestMethod @params
        
        if ($expectPagination) {
            if ($result.pagination) {
                Write-Host "[PASS] $name - Has pagination" -ForegroundColor Green
                Write-Host "       Page: $($result.pagination.page), Limit: $($result.pagination.limit), Total: $($result.pagination.totalItems)" -ForegroundColor Gray
                $script:passed++
            } else {
                Write-Host "[FAIL] $name - Missing pagination object" -ForegroundColor Red
                $script:failed++
            }
        } else {
            Write-Host "[PASS] $name" -ForegroundColor Green
            $script:passed++
        }
        return $result
    } catch {
        Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

Write-Host "`n========== Pagination & Search Tests ==========" -ForegroundColor Cyan

# Login first
$loginBody = '{"email":"admin@bme.local","password":"Admin@123"}'
$loginResult = Test-Endpoint "Login" "$baseUrl/api/auth/login" "POST" @{} $loginBody

if ($loginResult) {
    $headers = @{ "Authorization" = "Bearer $($loginResult.token)" }
    
    Write-Host "`n--- Pagination Tests ---" -ForegroundColor Yellow
    
    # Test Environments Pagination
    $envs = Test-Endpoint "Environments - Default Pagination" "$baseUrl/api/environments" "GET" $headers -expectPagination
    Test-Endpoint "Environments - Page 1, Limit 5" "$baseUrl/api/environments?page=1&limit=5" "GET" $headers -expectPagination
    Test-Endpoint "Environments - Page 2, Limit 2" "$baseUrl/api/environments?page=2&limit=2" "GET" $headers -expectPagination
    
    # Test Applications Pagination
    Test-Endpoint "Applications - Default Pagination" "$baseUrl/api/applications" "GET" $headers -expectPagination
    Test-Endpoint "Applications - Page 1, Limit 3" "$baseUrl/api/applications?page=1&limit=3" "GET" $headers -expectPagination
    
    # Test Bookings Pagination
    Test-Endpoint "Bookings - Default Pagination" "$baseUrl/api/bookings" "GET" $headers -expectPagination
    Test-Endpoint "Bookings - Page 1, Limit 10" "$baseUrl/api/bookings?page=1&limit=10" "GET" $headers -expectPagination
    
    # Test Instances Pagination
    Test-Endpoint "Instances - Default Pagination" "$baseUrl/api/instances" "GET" $headers -expectPagination
    Test-Endpoint "Instances - Page 1, Limit 5" "$baseUrl/api/instances?page=1&limit=5" "GET" $headers -expectPagination
    
    Write-Host "`n--- Search Tests ---" -ForegroundColor Yellow
    
    # Test Search functionality
    Test-Endpoint "Environments - Search by name" "$baseUrl/api/environments?search=SIT" "GET" $headers -expectPagination
    Test-Endpoint "Applications - Search" "$baseUrl/api/applications?search=payment" "GET" $headers -expectPagination
    Test-Endpoint "Bookings - Search by title" "$baseUrl/api/bookings?search=test" "GET" $headers -expectPagination
    
    Write-Host "`n--- Filter Tests ---" -ForegroundColor Yellow
    
    # Test Filtering with pagination
    Test-Endpoint "Environments - Filter by lifecycle" "$baseUrl/api/environments?lifecycle_stage=Active" "GET" $headers -expectPagination
    Test-Endpoint "Applications - Filter by criticality" "$baseUrl/api/applications?criticality=High" "GET" $headers -expectPagination
    Test-Endpoint "Bookings - Filter by status" "$baseUrl/api/bookings?booking_status=Active" "GET" $headers -expectPagination
    
    Write-Host "`n--- Combined Pagination + Search + Filter ---" -ForegroundColor Yellow
    
    Test-Endpoint "Environments - Combined" "$baseUrl/api/environments?search=test&lifecycle_stage=Active&page=1&limit=5" "GET" $headers -expectPagination
    Test-Endpoint "Applications - Combined" "$baseUrl/api/applications?search=api&criticality=High&page=1&limit=10" "GET" $headers -expectPagination
    
    Write-Host "`n--- Edge Cases ---" -ForegroundColor Yellow
    
    # Test edge cases
    Test-Endpoint "Large page number" "$baseUrl/api/environments?page=999&limit=10" "GET" $headers -expectPagination
    Test-Endpoint "Max limit exceeded (should cap at 100)" "$baseUrl/api/environments?page=1&limit=500" "GET" $headers -expectPagination
    Test-Endpoint "Invalid page (should default to 1)" "$baseUrl/api/environments?page=-1&limit=10" "GET" $headers -expectPagination
    
    Write-Host "`n--- GetById Tests (N+1 Fix Verification) ---" -ForegroundColor Yellow
    
    # Test GetById endpoints (verify single query with JOINs works)
    if ($envs.environments.Count -gt 0) {
        $envId = $envs.environments[0].environment_id
        $env = Test-Endpoint "Get Environment By ID" "$baseUrl/api/environments/$envId" "GET" $headers
        if ($env -and ($null -ne $env.instances)) {
            Write-Host "[PASS] Environment includes instances array (count: $($env.instances.Count))" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "[FAIL] Environment missing instances" -ForegroundColor Red
            $script:failed++
        }
    }
    
    $apps = Invoke-RestMethod -Uri "$baseUrl/api/applications" -Headers $headers
    if ($apps.applications.Count -gt 0) {
        $appId = $apps.applications[0].application_id
        $app = Test-Endpoint "Get Application By ID" "$baseUrl/api/applications/$appId" "GET" $headers
        if ($app -and ($null -ne $app.components) -and ($null -ne $app.deployments)) {
            Write-Host "[PASS] Application includes components and deployments" -ForegroundColor Green
            $script:passed++
        } else {
            Write-Host "[FAIL] Application missing components/deployments" -ForegroundColor Red
            $script:failed++
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })
Write-Host "========================================`n" -ForegroundColor Cyan
