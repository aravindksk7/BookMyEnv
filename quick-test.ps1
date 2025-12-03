# Quick API Test Script
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:5000"
$passed = 0
$failed = 0

function Test-Endpoint {
    param($name, $url, $method = "GET", $headers = @{}, $body = $null)
    try {
        $params = @{ Uri = $url; Method = $method; Headers = $headers }
        if ($body) { 
            $params["Body"] = $body
            $params["ContentType"] = "application/json"
        }
        $result = Invoke-RestMethod @params
        Write-Host "[PASS] $name" -ForegroundColor Green
        $script:passed++
        return $result
    } catch {
        Write-Host "[FAIL] $name - $($_.Exception.Message)" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

Write-Host "`n========== BookMyEnv API Tests ==========" -ForegroundColor Cyan

# 1. Health Check
Test-Endpoint "Health Check" "$baseUrl/health"

# 2. Login
$loginBody = '{"email":"admin@bme.local","password":"Admin@123"}'
$loginResult = Test-Endpoint "Login" "$baseUrl/api/auth/login" "POST" @{} $loginBody

if ($loginResult) {
    $headers = @{ "Authorization" = "Bearer $($loginResult.token)" }
    
    # 3. List Endpoints
    $envs = Test-Endpoint "List Environments" "$baseUrl/api/environments" "GET" $headers
    $apps = Test-Endpoint "List Applications" "$baseUrl/api/applications" "GET" $headers
    $ifaces = Test-Endpoint "List Interfaces" "$baseUrl/api/interfaces" "GET" $headers
    $configs = Test-Endpoint "List Configs" "$baseUrl/api/configs" "GET" $headers
    Test-Endpoint "List Bookings" "$baseUrl/api/bookings" "GET" $headers
    Test-Endpoint "List Releases" "$baseUrl/api/releases" "GET" $headers
    Test-Endpoint "List Users" "$baseUrl/api/users" "GET" $headers
    Test-Endpoint "List Groups" "$baseUrl/api/groups" "GET" $headers
    Test-Endpoint "List Instances" "$baseUrl/api/instances" "GET" $headers
    Test-Endpoint "List Test Data" "$baseUrl/api/test-data" "GET" $headers
    Test-Endpoint "List Integrations" "$baseUrl/api/integrations" "GET" $headers
    Test-Endpoint "Dashboard Stats" "$baseUrl/api/dashboard/stats" "GET" $headers
    Test-Endpoint "Activities" "$baseUrl/api/activities" "GET" $headers
    Test-Endpoint "Topology" "$baseUrl/api/topology" "GET" $headers
    
    # 4. Relationship Endpoints
    if ($apps.applications.Count -gt 0) {
        $appId = $apps.applications[0].application_id
        Test-Endpoint "App Related Interfaces" "$baseUrl/api/applications/$appId/related-interfaces" "GET" $headers
        Test-Endpoint "App Related Configs" "$baseUrl/api/applications/$appId/related-configs" "GET" $headers
    }
    
    if ($envs.environments.Count -gt 0) {
        $envId = $envs.environments[0].environment_id
        Test-Endpoint "Env Applications" "$baseUrl/api/environments/$envId/applications" "GET" $headers
        Test-Endpoint "Env Related Interfaces" "$baseUrl/api/environments/$envId/related-interfaces" "GET" $headers
        Test-Endpoint "Env Related Configs" "$baseUrl/api/environments/$envId/related-configs" "GET" $headers
    }
    
    # 5. CRUD Operations
    Write-Host "`n--- CRUD Tests ---" -ForegroundColor Yellow
    
    # Create Interface with App
    if ($apps.applications.Count -gt 0) {
        $appId = $apps.applications[0].application_id
        $ts = Get-Date -Format "HHmmss"
        $ifaceBody = @{ name = "TestIface$ts"; direction = "Outbound"; pattern = "REST"; frequency = "RealTime"; source_application_id = $appId } | ConvertTo-Json
        $newIface = Test-Endpoint "Create Interface" "$baseUrl/api/interfaces" "POST" $headers $ifaceBody
        
        if ($newIface) {
            # Verify relationship shows up
            $related = Invoke-RestMethod -Uri "$baseUrl/api/applications/$appId/related-interfaces" -Headers $headers
            $found = $related.interfaces | Where-Object { $_.interface_id -eq $newIface.interface_id }
            if ($found) {
                Write-Host "[PASS] Interface-App Relationship Verified" -ForegroundColor Green
                $script:passed++
            } else {
                Write-Host "[FAIL] Interface-App Relationship Not Found" -ForegroundColor Red
                $script:failed++
            }
            
            # Delete test interface
            Test-Endpoint "Delete Interface" "$baseUrl/api/interfaces/$($newIface.interface_id)" "DELETE" $headers
        }
    }
    
    # Config Items CRUD
    if ($configs.configSets.Count -gt 0) {
        $configId = $configs.configSets[0].config_set_id
        $ts = Get-Date -Format "HHmmss"
        $itemBody = @{ key = "TEST_KEY_$ts"; value = "test_value"; data_type = "String"; description = "Test item" } | ConvertTo-Json
        $newItem = Test-Endpoint "Create Config Item" "$baseUrl/api/configs/$configId/items" "POST" $headers $itemBody
        
        if ($newItem) {
            # Update
            $updateBody = @{ value = "updated_value" } | ConvertTo-Json
            Test-Endpoint "Update Config Item" "$baseUrl/api/configs/$configId/items/$($newItem.config_item_id)" "PUT" $headers $updateBody
            
            # Read items
            Test-Endpoint "List Config Items" "$baseUrl/api/configs/$configId/items" "GET" $headers
            
            # Delete
            Test-Endpoint "Delete Config Item" "$baseUrl/api/configs/$configId/items/$($newItem.config_item_id)" "DELETE" $headers
        }
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Results: $passed passed, $failed failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Yellow" })
Write-Host "========================================`n" -ForegroundColor Cyan
