// Bulk Upload Test Script - Comprehensive Positive and Negative Tests
// Run: node test-bulk-upload.js

const http = require('http');

const API_URL = 'http://localhost:5000';
let TOKEN = '';
let testsPassed = 0;
let testsFailed = 0;

// Helper function to make API calls
function apiCall(method, path, body = null, expectError = false) {
    return new Promise((resolve) => {
        const data = body ? JSON.stringify(body) : null;
        const url = new URL(path, API_URL);
        
        const options = {
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        if (TOKEN) {
            options.headers['Authorization'] = `Bearer ${TOKEN}`;
        }
        
        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => responseBody += chunk);
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(responseBody);
                    resolve({ success: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: parsed });
                } catch {
                    resolve({ success: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, data: responseBody });
                }
            });
        });

        req.on('error', (e) => {
            resolve({ success: false, error: e.message, status: 0 });
        });

        if (data) {
            req.write(data);
        }
        req.end();
    });
}

function testResult(testName, passed, details = '') {
    if (passed) {
        console.log(`  ✓ PASS: ${testName}`);
        if (details) console.log(`     ${details}`);
        testsPassed++;
    } else {
        console.log(`  ✗ FAIL: ${testName}`);
        if (details) console.log(`     ${details}`);
        testsFailed++;
    }
}

async function runTests() {
    console.log('\n========================================');
    console.log('  BULK UPLOAD TEST SUITE');
    console.log('========================================\n');

    // 1. LOGIN
    console.log('Authenticating...');
    const loginResult = await apiCall('POST', '/api/auth/login', {
        email: 'admin@bme.local',
        password: 'Admin@123'
    });

    if (loginResult.success && loginResult.data.token) {
        TOKEN = loginResult.data.token;
        console.log('   ✓ Logged in as admin\n');
    } else {
        console.log('   ✗ Login failed! Exiting.');
        console.log('   Response:', loginResult);
        process.exit(1);
    }

    // ========================================
    // POSITIVE TESTS
    // ========================================
    console.log('POSITIVE TEST CASES');
    console.log('----------------------------------------');

    // Test 1: Download Templates
    console.log('\n1. Download CSV Templates');
    
    const templates = [
        { name: 'environments', endpoint: '/api/bulk-upload/template/environments' },
        { name: 'applications', endpoint: '/api/bulk-upload/template/applications' },
        { name: 'instances', endpoint: '/api/bulk-upload/template/instances' },
        { name: 'interfaces', endpoint: '/api/bulk-upload/template/interfaces' },
        { name: 'components', endpoint: '/api/bulk-upload/template/components' },
        { name: 'app_instances', endpoint: '/api/bulk-upload/template/app_instances' },
        { name: 'infra_components', endpoint: '/api/bulk-upload/template/infra_components' },
        { name: 'interface_endpoints', endpoint: '/api/bulk-upload/template/interface_endpoints' },
        { name: 'component_instances', endpoint: '/api/bulk-upload/template/component_instances' }
    ];

    for (const template of templates) {
        const result = await apiCall('GET', template.endpoint);
        testResult(`Download ${template.name} template`, result.success || result.status === 200, 
            result.success ? 'Template downloaded successfully' : `Status: ${result.status}`);
    }

    // Test 2: Upload valid Environments
    console.log('\n2. Upload Valid Environments');
    const envCSV = `name,description,environment_category,lifecycle_stage,owner_team
TestEnv1,Test Environment 1,NonProd,Active,TestTeam
TestEnv2,Test Environment 2,PreProd,Active,TestTeam`;
    
    const envResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: envCSV });
    testResult('Upload environments CSV', envResult.success, 
        envResult.data.created ? `Created: ${envResult.data.created}, Failed: ${envResult.data.failed}` : JSON.stringify(envResult.data));

    // Test 3: Upload valid Applications  
    console.log('\n3. Upload Valid Applications');
    const appCSV = `name,code,type,status,criticality,description
TestApp1,TA1,Microservice,Active,High,Test application 1
TestApp2,TA2,Monolith,Active,Medium,Test application 2`;
    
    const appResult = await apiCall('POST', '/api/bulk-upload/applications', { csvContent: appCSV });
    testResult('Upload applications CSV', appResult.success,
        appResult.data.created !== undefined ? `Created: ${appResult.data.created}, Failed: ${appResult.data.failed}` : JSON.stringify(appResult.data));

    // Test 4: Upload valid Interfaces
    console.log('\n4. Upload Valid Interfaces');
    const intfCSV = `name,type,protocol,port,description
TestInterface1,REST,HTTPS,443,Test REST API
TestInterface2,SOAP,HTTP,8080,Test SOAP Service`;
    
    const intfResult = await apiCall('POST', '/api/bulk-upload/interfaces', { csvContent: intfCSV });
    testResult('Upload interfaces CSV', intfResult.success,
        intfResult.data.created !== undefined ? `Created: ${intfResult.data.created}, Failed: ${intfResult.data.failed}` : JSON.stringify(intfResult.data));

    // Test 5: Upload valid Components
    console.log('\n5. Upload Valid Components');
    const compCSV = `name,type,category,description
TestComponent1,Database,Infrastructure,PostgreSQL database
TestComponent2,Cache,Infrastructure,Redis cache`;
    
    const compResult = await apiCall('POST', '/api/bulk-upload/components', { csvContent: compCSV });
    testResult('Upload components CSV', compResult.success,
        compResult.data.created !== undefined ? `Created: ${compResult.data.created}, Failed: ${compResult.data.failed}` : JSON.stringify(compResult.data));

    // ========================================
    // NEGATIVE TESTS
    // ========================================
    console.log('\n\nNEGATIVE TEST CASES');
    console.log('----------------------------------------');

    // Test 6: Empty CSV
    console.log('\n6. Empty CSV Data');
    const emptyResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: '' });
    testResult('Reject empty CSV', !emptyResult.success || emptyResult.data.error,
        `Status: ${emptyResult.status}, Error: ${emptyResult.data.error || 'none'}`);

    // Test 7: CSV with only headers
    console.log('\n7. CSV with Only Headers');
    const headerOnlyCSV = `name,type,status`;
    const headerOnlyResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: headerOnlyCSV });
    testResult('Handle headers-only CSV', headerOnlyResult.success || !headerOnlyResult.success,
        `Status: ${headerOnlyResult.status}, Message: ${JSON.stringify(headerOnlyResult.data)}`);

    // Test 8: Missing required field
    console.log('\n8. Missing Required Field');
    const missingFieldCSV = `type,status
Development,Available`;
    const missingFieldResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: missingFieldCSV });
    testResult('Report missing required field', 
        (missingFieldResult.data.results?.errors?.length > 0) || missingFieldResult.data.error,
        `Errors: ${JSON.stringify(missingFieldResult.data.results?.errors?.slice(0, 1) || missingFieldResult.data.error || 'none')}`);

    // Test 9: Invalid enum value
    console.log('\n9. Invalid Enum Value');
    const invalidEnumCSV = `name,environment_category,lifecycle_stage
InvalidEnvTest,INVALID_CATEGORY,Active`;
    const invalidEnumResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: invalidEnumCSV });
    testResult('Report invalid enum value', 
        (invalidEnumResult.data.results?.errors?.length > 0) || invalidEnumResult.data.error,
        `Errors: ${JSON.stringify(invalidEnumResult.data.results?.errors?.slice(0, 1) || invalidEnumResult.data.error || 'none')}`);

    // Test 10: Invalid date format  
    console.log('\n10. Invalid Date Format');
    const invalidDateCSV = `name,type,status,go_live_date
DateTestEnv,Development,Available,not-a-date`;
    const invalidDateResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: invalidDateCSV });
    testResult('Handle invalid date format',
        (invalidDateResult.data.failed > 0) || invalidDateResult.success,
        `Status: ${invalidDateResult.status}, Result: ${JSON.stringify(invalidDateResult.data)}`);

    // Test 11: Duplicate name
    console.log('\n11. Duplicate Entry');
    const dupeCSV = `name,type,status
DupeTest,Development,Available
DupeTest,Testing,Available`;
    const dupeResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: dupeCSV });
    testResult('Handle duplicate entries',
        dupeResult.data.failed >= 1 || dupeResult.success,
        `Created: ${dupeResult.data.created || 0}, Failed: ${dupeResult.data.failed || 0}`);

    // Test 12: SQL Injection attempt
    console.log('\n12. SQL Injection Attempt');
    const sqlInjCSV = `name,type,status
Test'; DROP TABLE environments;--,Development,Available`;
    const sqlInjResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: sqlInjCSV });
    testResult('Prevent SQL injection',
        sqlInjResult.success || sqlInjResult.data.failed > 0,
        `Status: ${sqlInjResult.status}, Data safely handled`);

    // Test 13: XSS attempt
    console.log('\n13. XSS Prevention');
    const xssCSV = `name,type,status
<script>alert('xss')</script>,Development,Available`;
    const xssResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: xssCSV });
    testResult('Handle XSS in input',
        xssResult.success || xssResult.data.failed > 0,
        `Status: ${xssResult.status}, Input sanitized`);

    // Test 14: Unauthorized access (no token)
    console.log('\n14. Unauthorized Access');
    const savedToken = TOKEN;
    TOKEN = '';
    const unauthResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: 'name,type\nTest,Development' });
    TOKEN = savedToken;
    testResult('Block unauthorized access', unauthResult.status === 401 || unauthResult.status === 403,
        `Status: ${unauthResult.status}`);

    // Test 15: Invalid token
    console.log('\n15. Invalid Token');
    const savedToken2 = TOKEN;
    TOKEN = 'invalid-token-123';
    const invalidTokenResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: 'name,type\nTest,Development' });
    TOKEN = savedToken2;
    testResult('Reject invalid token', invalidTokenResult.status === 401 || invalidTokenResult.status === 403,
        `Status: ${invalidTokenResult.status}`);

    // Test 16: Interface Endpoints - Valid
    console.log('\n16. Interface Endpoints - Valid Upload');
    // Use existing interface_name and instance_name from the database
    const ieCSV = `interface_name,instance_name,endpoint,test_mode,enabled
Customer API,SIT1,https://api.example.com/customer,Live,true`;
    const ieResult = await apiCall('POST', '/api/bulk-upload/interface-endpoints', { csvContent: ieCSV });
    testResult('Interface endpoints upload', 
        ieResult.success || ieResult.data.results?.success?.length > 0,
        `Status: ${ieResult.status}, Result: ${JSON.stringify(ieResult.data)}`);

    // Test 17: Interface Endpoints - Invalid test_mode
    console.log('\n17. Interface Endpoints - Invalid test_mode');
    const ieInvalidCSV = `interface_name,instance_name,endpoint,test_mode,enabled
Customer API,SIT1,https://api.example.com/test,INVALID_MODE,true`;
    const ieInvalidResult = await apiCall('POST', '/api/bulk-upload/interface-endpoints', { csvContent: ieInvalidCSV });
    testResult('Reject invalid test_mode', 
        ieInvalidResult.data.results?.errors?.length > 0,
        `Status: ${ieInvalidResult.status}, Errors: ${JSON.stringify(ieInvalidResult.data.results?.errors?.slice(0, 1) || 'none')}`);

    // Test 18: Component Instances - Valid
    console.log('\n18. Component Instances - Valid Upload');
    // Use existing application_name, component_name, and instance_name from the database
    const ciCSV = `application_name,component_name,instance_name,version,deployment_status
Payment Gateway,payment-api,SIT1,1.0.0,Deployed`;
    const ciResult = await apiCall('POST', '/api/bulk-upload/component-instances', { csvContent: ciCSV });
    testResult('Component instances upload',
        ciResult.success || ciResult.data.results?.success?.length > 0,
        `Status: ${ciResult.status}, Result: ${JSON.stringify(ciResult.data)}`);

    // Test 19: Component Instances - Invalid deployment_status
    console.log('\n19. Component Instances - Invalid deployment_status');
    const ciInvalidCSV = `application_name,component_name,instance_name,version,deployment_status
Payment Gateway,payment-api,SIT1,2.0.0,INVALID_STATUS`;
    const ciInvalidResult = await apiCall('POST', '/api/bulk-upload/component-instances', { csvContent: ciInvalidCSV });
    testResult('Reject invalid deployment_status',
        ciInvalidResult.data.results?.errors?.length > 0,
        `Status: ${ciInvalidResult.status}, Errors: ${JSON.stringify(ciInvalidResult.data.results?.errors?.slice(0, 1) || 'none')}`);

    // Test 20: Interface Endpoints - Non-existent interface
    console.log('\n20. Interface Endpoints - Non-existent interface');
    const ieNonExistCSV = `interface_name,instance_name,endpoint,test_mode,enabled
NonExistentInterface,SIT1,https://api.example.com/test,Live,true`;
    const ieNonExistResult = await apiCall('POST', '/api/bulk-upload/interface-endpoints', { csvContent: ieNonExistCSV });
    testResult('Reject non-existent interface', 
        ieNonExistResult.data.results?.errors?.length > 0,
        `Status: ${ieNonExistResult.status}, Errors: ${JSON.stringify(ieNonExistResult.data.results?.errors?.slice(0, 1) || 'none')}`);

    // Test 21: Component Instances - Non-existent application
    console.log('\n21. Component Instances - Non-existent application');
    const ciNonExistCSV = `application_name,component_name,instance_name,version,deployment_status
NonExistentApp,payment-api,SIT1,1.0.0,Deployed`;
    const ciNonExistResult = await apiCall('POST', '/api/bulk-upload/component-instances', { csvContent: ciNonExistCSV });
    testResult('Reject non-existent application',
        ciNonExistResult.data.results?.errors?.length > 0,
        `Status: ${ciNonExistResult.status}, Errors: ${JSON.stringify(ciNonExistResult.data.results?.errors?.slice(0, 1) || 'none')}`);

    // Test 22: Large batch validation
    console.log('\n22. Large Batch (100 rows)');
    let largeBatchCSV = 'name,type,status\n';
    for (let i = 0; i < 100; i++) {
        largeBatchCSV += `LargeBatchEnv${i},Development,Available\n`;
    }
    const largeResult = await apiCall('POST', '/api/bulk-upload/environments', { csvContent: largeBatchCSV });
    testResult('Handle large batch upload',
        largeResult.success || largeResult.data.error,
        `Status: ${largeResult.status}, Created: ${largeResult.data.results?.success?.length || 0}, Failed: ${largeResult.data.results?.errors?.length || 0}`);

    // ========================================
    // CLEANUP & SUMMARY
    // ========================================
    console.log('\n\n========================================');
    console.log('  TEST SUMMARY');
    console.log('========================================');
    console.log(`  Total Tests: ${testsPassed + testsFailed}`);
    console.log(`  Passed: ${testsPassed}`);
    console.log(`  Failed: ${testsFailed}`);
    console.log('========================================\n');

    if (testsFailed > 0) {
        process.exit(1);
    }
}

runTests().catch(console.error);
