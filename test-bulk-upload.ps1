# Bulk Upload Test Script - Comprehensive Positive and Negative Tests
# Run: .\test-bulk-upload.ps1

$API_URL = "http://localhost:5000/api"
$Global:TOKEN = ""
$Global:TestsPassed = 0
$Global:TestsFailed = 0

# Helper function to make API calls
function Invoke-API {
    param(
        [string]$Method,
        [string]$Endpoint,
        [object]$Body = $null,
        [bool]$ExpectError = $false
    )
    
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    if ($Global:TOKEN) {
        $headers["Authorization"] = "Bearer $Global:TOKEN"
    }
    
    try {
        $params = @{
            Uri = "$API_URL$Endpoint"
            Method = $Method
            Headers = $headers
            ErrorAction = "Stop"
        }
        
        if ($Body) {
            $params["Body"] = ($Body | ConvertTo-Json -Depth 10)
        }
        
        $response = Invoke-RestMethod @params
        return @{ Success = $true; Data = $response; Status = 200 }
    }
    catch {
        $status = $_.Exception.Response.StatusCode.value__
        $errorBody = $_.ErrorDetails.Message | ConvertFrom-Json -ErrorAction SilentlyContinue
        return @{ Success = $false; Error = $errorBody; Status = $status }
    }
}

function Test-Result {
    param(
        [string]$TestName,
        [bool]$Passed,
        [string]$Details = ""
    )
    
    if ($Passed) {
        Write-Host "  [PASS] $TestName" -ForegroundColor Green
        if ($Details) { Write-Host "     $Details" -ForegroundColor Gray }
        $Global:TestsPassed++
    } else {
        Write-Host "  [FAIL] $TestName" -ForegroundColor Red
        if ($Details) { Write-Host "     $Details" -ForegroundColor Yellow }
        $Global:TestsFailed++
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  BULK UPLOAD TEST SUITE"
Write-Host "========================================"
Write-Host ""

# 1. LOGIN
Write-Host "Authenticating..." -ForegroundColor Yellow
$loginResult = Invoke-API -Method "POST" -Endpoint "/auth/login" -Body @{
    email = "admin@bme.local"
    password = "Admin@123"
}

if ($loginResult.Success) {
    $Global:TOKEN = $loginResult.Data.token
    Write-Host "   Logged in as admin" -ForegroundColor Green
    Write-Host ""
} else {
    Write-Host "   Login failed! Exiting." -ForegroundColor Red
    exit 1
}

# ========================================
# POSITIVE TESTS
# ========================================
Write-Host "POSITIVE TEST CASES" -ForegroundColor Cyan
Write-Host "----------------------------------------"

# Test 1: Download Templates
Write-Host ""
Write-Host "Test 1: Download CSV Templates" -ForegroundColor Yellow
$templates = @("environments", "instances", "applications", "interfaces", "components", "app_instances", "infra_components", "interface_endpoints", "component_instances")
foreach ($template in $templates) {
    try {
        $response = Invoke-WebRequest -Uri "$API_URL/bulk-upload/template/$template" -Headers @{ "Authorization" = "Bearer $Global:TOKEN" } -ErrorAction Stop
        Test-Result "Download $template template" ($response.StatusCode -eq 200) "Content-Type: $($response.Headers['Content-Type'])"
    } catch {
        Test-Result "Download $template template" $false $_.Exception.Message
    }
}

# Test 2: Upload Environments (Positive)
Write-Host ""
Write-Host "Test 2: Bulk Upload Environments" -ForegroundColor Yellow
$envCsv = "name,description,environment_category,lifecycle_stage,owner_team,support_group,data_sensitivity`nBulkTest-Env-1,Test environment 1 from bulk upload,NonProd,Active,DevOps,Support,NonProdDummy`nBulkTest-Env-2,Test environment 2 from bulk upload,PreProd,Active,QA Team,Support,Confidential"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $envCsv }
Test-Result "Upload 2 environments" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 3: Upload Instances (Positive)
Write-Host ""
Write-Host "Test 3: Bulk Upload Instances" -ForegroundColor Yellow
$instanceCsv = "environment_name,name,operational_status,availability_window,capacity,primary_location,bookable`nBulkTest-Env-1,BulkTest-Instance-1,Available,24x7,10,DataCenter-1,true`nBulkTest-Env-1,BulkTest-Instance-2,Available,BusinessHours,5,DataCenter-2,true`nBulkTest-Env-2,BulkTest-Instance-3,Available,24x7,15,DataCenter-1,true"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/instances" -Body @{ csvContent = $instanceCsv }
Test-Result "Upload 3 instances" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 4: Upload Applications (Positive)
Write-Host ""
Write-Host "Test 4: Bulk Upload Applications" -ForegroundColor Yellow
$appCsv = "name,business_domain,description,criticality,data_sensitivity,owner_team,test_owner`nBulkTest-App-1,Finance,Financial application for testing,High,PCI,Finance Team,QA Team`nBulkTest-App-2,HR,HR application for testing,Medium,PII,HR Team,QA Team`nBulkTest-App-3,Sales,Sales CRM application,Low,Confidential,Sales Team,QA Team"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/applications" -Body @{ csvContent = $appCsv }
Test-Result "Upload 3 applications" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 5: Upload Interfaces (Positive)
Write-Host ""
Write-Host "Test 5: Bulk Upload Interfaces" -ForegroundColor Yellow
$interfaceCsv = "name,direction,pattern,frequency,protocol,source_application_name,target_application_name,description`nBulkTest-Interface-1,Outbound,REST,RealTime,HTTPS,BulkTest-App-1,BulkTest-App-2,API from App1 to App2`nBulkTest-Interface-2,Inbound,Messaging,Daily,AMQP,BulkTest-App-2,BulkTest-App-3,Message queue interface`nBulkTest-Interface-3,Bidirectional,GraphQL,RealTime,HTTPS,BulkTest-App-1,BulkTest-App-3,GraphQL API"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interfaces" -Body @{ csvContent = $interfaceCsv }
Test-Result "Upload 3 interfaces" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 6: Upload App Components (Positive)
Write-Host ""
Write-Host "Test 6: Bulk Upload App Components" -ForegroundColor Yellow
$componentCsv = "application_name,name,component_type,technology_stack,description`nBulkTest-App-1,BulkTest-Component-1,Service,Node.js,Backend API service`nBulkTest-App-1,BulkTest-Component-2,Database,PostgreSQL,Main database`nBulkTest-App-2,BulkTest-Component-3,Service,Python,ML service`nBulkTest-App-3,BulkTest-Component-4,Frontend,React,Web UI"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/components" -Body @{ csvContent = $componentCsv }
Test-Result "Upload 4 components" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 7: Upload App-Instance Links (Positive)
Write-Host ""
Write-Host "Test 7: Bulk Upload App Deployments" -ForegroundColor Yellow
$appInstCsv = "application_name,instance_name,deployment_model,version,deployment_status`nBulkTest-App-1,BulkTest-Instance-1,Microservices,1.0.0,Aligned`nBulkTest-App-2,BulkTest-Instance-1,Microservices,2.1.0,Aligned`nBulkTest-App-3,BulkTest-Instance-2,Monolith,3.0.0,Aligned`nBulkTest-App-1,BulkTest-Instance-3,Microservices,1.0.0,Aligned"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/app-instances" -Body @{ csvContent = $appInstCsv }
Test-Result "Upload 4 app deployments" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 8: Upload Component Instances (NEW - Positive)
Write-Host ""
Write-Host "Test 8: Bulk Upload Component Instances" -ForegroundColor Yellow
$compInstCsv = "application_name,component_name,instance_name,version,deployment_status`nBulkTest-App-1,BulkTest-Component-1,BulkTest-Instance-1,1.0.0,Deployed`nBulkTest-App-1,BulkTest-Component-2,BulkTest-Instance-1,1.0.0,Deployed`nBulkTest-App-2,BulkTest-Component-3,BulkTest-Instance-1,2.1.0,Deployed`nBulkTest-App-3,BulkTest-Component-4,BulkTest-Instance-2,3.0.0,Deployed"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/component-instances" -Body @{ csvContent = $compInstCsv }
Test-Result "Upload 4 component instances" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 9: Upload Interface Endpoints (NEW - Positive)
Write-Host ""
Write-Host "Test 9: Bulk Upload Interface Endpoints" -ForegroundColor Yellow
$endpointCsv = "interface_name,instance_name,endpoint,test_mode,enabled,source_component_name,target_component_name`nBulkTest-Interface-1,BulkTest-Instance-1,https://api.bulktest.local/v1,Live,true,BulkTest-Component-1,BulkTest-Component-3`nBulkTest-Interface-2,BulkTest-Instance-1,amqp://mq.bulktest.local:5672,Virtualised,true,,`nBulkTest-Interface-3,BulkTest-Instance-2,https://graphql.bulktest.local,Live,true,,BulkTest-Component-4"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interface-endpoints" -Body @{ csvContent = $endpointCsv }
Test-Result "Upload 3 interface endpoints" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"

# Test 10: Upload Infra Components (Positive)
Write-Host ""
Write-Host "Test 10: Bulk Upload Infrastructure" -ForegroundColor Yellow
$infraCsv = "instance_name,name,component_type,hostname,ip_address,os_version,status,owner_team`nBulkTest-Instance-1,BulkTest-Server-1,VM,server1.bulktest.local,192.168.1.10,Ubuntu 22.04,Active,Infra Team`nBulkTest-Instance-1,BulkTest-Server-2,VM,server2.bulktest.local,192.168.1.11,Ubuntu 22.04,Active,Infra Team`nBulkTest-Instance-2,BulkTest-Server-3,Container,k8s-node1.bulktest.local,192.168.2.10,Alpine 3.18,Active,Infra Team"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/infra-components" -Body @{ csvContent = $infraCsv }
Test-Result "Upload 3 infra components" $result.Success "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"


# ========================================
# NEGATIVE TESTS
# ========================================
Write-Host ""
Write-Host ""
Write-Host "NEGATIVE TEST CASES" -ForegroundColor Cyan
Write-Host "----------------------------------------"

# Test 11: Missing Required Fields
Write-Host ""
Write-Host "Test 11: Missing Required Fields" -ForegroundColor Yellow
$invalidCsv = "description,environment_category`nMissing name field,NonProd"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject record with missing name" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 12: Invalid Category Value
Write-Host ""
Write-Host "Test 12: Invalid Category Value" -ForegroundColor Yellow
$invalidCsv = "name,environment_category`nInvalidCategory-Env,InvalidCategory"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid category value" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 13: Non-existent Parent Reference (Instance without Environment)
Write-Host ""
Write-Host "Test 13: Non-existent Environment Reference" -ForegroundColor Yellow
$invalidCsv = "environment_name,name,operational_status`nNonExistent-Env-999,Test-Instance,Available"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/instances" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject instance with non-existent environment" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 14: Non-existent Application Reference (Component)
Write-Host ""
Write-Host "Test 14: Non-existent Application Reference" -ForegroundColor Yellow
$invalidCsv = "application_name,name,component_type`nNonExistent-App-999,Test-Component,Service"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/components" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject component with non-existent application" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 15: Invalid Criticality Value
Write-Host ""
Write-Host "Test 15: Invalid Criticality Value" -ForegroundColor Yellow
$invalidCsv = "name,criticality`nInvalidCriticality-App,SuperCritical"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/applications" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid criticality value" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 16: Invalid Interface Direction
Write-Host ""
Write-Host "Test 16: Invalid Interface Direction" -ForegroundColor Yellow
$invalidCsv = "name,direction,pattern`nInvalidDirection-Interface,SideWays,REST"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interfaces" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid interface direction" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 17: Invalid Interface Pattern
Write-Host ""
Write-Host "Test 17: Invalid Interface Pattern" -ForegroundColor Yellow
$invalidCsv = "name,direction,pattern`nInvalidPattern-Interface,Outbound,FTP"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interfaces" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid interface pattern" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 18: Invalid Component Instance Deployment Status
Write-Host ""
Write-Host "Test 18: Invalid Deployment Status (Component Instance)" -ForegroundColor Yellow
$invalidCsv = "application_name,component_name,instance_name,deployment_status`nBulkTest-App-1,BulkTest-Component-1,BulkTest-Instance-1,InvalidStatus"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/component-instances" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid deployment status" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 19: Invalid Test Mode (Interface Endpoint)
Write-Host ""
Write-Host "Test 19: Invalid Test Mode (Interface Endpoint)" -ForegroundColor Yellow
$invalidCsv = "interface_name,instance_name,test_mode`nBulkTest-Interface-1,BulkTest-Instance-1,InvalidMode"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interface-endpoints" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject invalid test mode" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 20: Non-existent Interface Reference (Endpoint)
Write-Host ""
Write-Host "Test 20: Non-existent Interface Reference" -ForegroundColor Yellow
$invalidCsv = "interface_name,instance_name,endpoint`nNonExistent-Interface-999,BulkTest-Instance-1,https://test.local"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/interface-endpoints" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject endpoint with non-existent interface" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 21: Non-existent Component Reference (Component Instance)
Write-Host ""
Write-Host "Test 21: Non-existent Component Reference" -ForegroundColor Yellow
$invalidCsv = "application_name,component_name,instance_name`nBulkTest-App-1,NonExistent-Component-999,BulkTest-Instance-1"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/component-instances" -Body @{ csvContent = $invalidCsv }
$hasErrors = $result.Data.results.errors.Count -gt 0
Test-Result "Reject with non-existent component" $hasErrors "Errors: $($result.Data.results.errors.Count)"

# Test 22: Empty CSV Content
Write-Host ""
Write-Host "Test 22: Empty CSV Content" -ForegroundColor Yellow
$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = "" }
Test-Result "Reject empty CSV" (-not $result.Success) "Status: $($result.Status)"

# Test 23: CSV with Only Headers (No Data)
Write-Host ""
Write-Host "Test 23: CSV with Only Headers" -ForegroundColor Yellow
$headerOnlyCsv = "name,description,environment_category"
$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $headerOnlyCsv }
$noRecords = $result.Data.results.success.Count -eq 0 -and $result.Data.results.errors.Count -eq 0
Test-Result "Handle CSV with only headers" ($result.Success -or $noRecords) "Records processed: 0"

# Test 24: Unauthorized Access (No Token)
Write-Host ""
Write-Host "Test 24: Unauthorized Access" -ForegroundColor Yellow
$savedToken = $Global:TOKEN
$Global:TOKEN = ""
$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = "name`nTest" }
$Global:TOKEN = $savedToken
Test-Result "Reject unauthenticated request" (-not $result.Success -and $result.Status -eq 401) "Status: $($result.Status)"

# Test 25: Invalid Template Type
Write-Host ""
Write-Host "Test 25: Invalid Template Type" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$API_URL/bulk-upload/template/invalid_type" -Headers @{ "Authorization" = "Bearer $Global:TOKEN" } -ErrorAction Stop
    Test-Result "Reject invalid template type" $false "Unexpected success"
} catch {
    $status = $_.Exception.Response.StatusCode.value__
    Test-Result "Reject invalid template type" ($status -eq 400) "Status: $status"
}

# Test 26: Duplicate Record Handling (Upsert)
Write-Host ""
Write-Host "Test 26: Duplicate Record Handling (Upsert)" -ForegroundColor Yellow
$dupCsv = "name,description,environment_category`nBulkTest-Env-1,Updated description via upsert,NonProd"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $dupCsv }
Test-Result "Handle duplicate via upsert" $result.Success "Success: $($result.Data.results.success.Count) (should update existing)"

# Test 27: Mixed Valid and Invalid Records
Write-Host ""
Write-Host "Test 27: Mixed Valid and Invalid Records" -ForegroundColor Yellow
$mixedCsv = "name,description,environment_category`nValidMixed-Env-1,Valid environment,NonProd`n,Missing name - invalid,NonProd`nValidMixed-Env-2,Another valid environment,PreProd`nInvalidCategory-Env,Invalid category,NotACategory"

$result = Invoke-API -Method "POST" -Endpoint "/bulk-upload/environments" -Body @{ csvContent = $mixedCsv }
$partialSuccess = $result.Data.results.success.Count -gt 0 -and $result.Data.results.errors.Count -gt 0
Test-Result "Process mixed valid/invalid records" $partialSuccess "Success: $($result.Data.results.success.Count), Errors: $($result.Data.results.errors.Count)"


# ========================================
# SUMMARY
# ========================================
Write-Host ""
Write-Host ""
Write-Host "========================================"
Write-Host "  TEST SUMMARY"
Write-Host "========================================"
Write-Host "  Passed: $Global:TestsPassed" -ForegroundColor Green
Write-Host "  Failed: $Global:TestsFailed" -ForegroundColor $(if ($Global:TestsFailed -gt 0) { "Red" } else { "Gray" })
Write-Host "  Total:  $($Global:TestsPassed + $Global:TestsFailed)"
Write-Host "========================================"
Write-Host ""

# Cleanup test data
Write-Host "Cleaning up test data..." -ForegroundColor Yellow

# Delete test environments (cascades to instances, etc.)
$result = Invoke-API -Method "GET" -Endpoint "/environments"
if ($result.Success) {
    foreach ($env in $result.Data.environments) {
        if ($env.name -like "BulkTest-*" -or $env.name -like "ValidMixed-*") {
            $delResult = Invoke-API -Method "DELETE" -Endpoint "/environments/$($env.environment_id)"
            Write-Host "   Deleted environment: $($env.name)" -ForegroundColor Gray
        }
    }
}

# Delete test applications
$result = Invoke-API -Method "GET" -Endpoint "/applications"
if ($result.Success) {
    foreach ($app in $result.Data.applications) {
        if ($app.name -like "BulkTest-*") {
            $delResult = Invoke-API -Method "DELETE" -Endpoint "/applications/$($app.application_id)"
            Write-Host "   Deleted application: $($app.name)" -ForegroundColor Gray
        }
    }
}

# Delete test interfaces
$result = Invoke-API -Method "GET" -Endpoint "/interfaces"
if ($result.Success) {
    foreach ($iface in $result.Data.interfaces) {
        if ($iface.name -like "BulkTest-*") {
            $delResult = Invoke-API -Method "DELETE" -Endpoint "/interfaces/$($iface.interface_id)"
            Write-Host "   Deleted interface: $($iface.name)" -ForegroundColor Gray
        }
    }
}

Write-Host ""
Write-Host "Test complete!" -ForegroundColor Green
Write-Host ""
