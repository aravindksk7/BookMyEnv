# Sample Data for Bulk Upload

This folder contains sample CSV files for bulk uploading data into BookMyEnv.

## Files

| # | File | Description | Records |
|---|------|-------------|---------|
| 1 | `01-environments.csv` | Environment definitions | 8 |
| 2 | `02-applications.csv` | Application definitions | 12 |
| 3 | `03-instances.csv` | Environment instances | 12 |
| 4 | `04-interfaces.csv` | Application interfaces | 13 |
| 5 | `05-components.csv` | Application components | 19 |
| 6 | `06-app-instances.csv` | App-to-instance mappings | 19 |
| 7 | `07-infra-components.csv` | Infrastructure components | 16 |

## Upload Order

**Important:** Upload files in numerical order (01, 02, 03...) because later files reference data from earlier files.

1. **Environments** (01) - No dependencies
2. **Applications** (02) - No dependencies  
3. **Instances** (03) - Requires environments
4. **Interfaces** (04) - References applications
5. **Components** (05) - Requires applications
6. **App-Instances** (06) - Requires applications and instances
7. **Infra-Components** (07) - Requires instances

## How to Upload

1. Log in to BookMyEnv as an Admin
2. Go to **Settings** → **Data Management** → **Bulk Upload**
3. Select the entity type tab (e.g., "Environments")
4. Click "Download Template" to see the expected format
5. Drag and drop the corresponding CSV file
6. Review the preview
7. Click "Upload" to process
8. Check results for any errors

## Sample Scenario

This sample data represents a typical banking/financial services IT landscape:

### Environments
- Development environments for two teams (Alpha, Beta)
- Shared integration testing environment
- UAT environment
- Performance testing environment
- DR failover environment
- Training environment
- Innovation sandbox

### Applications
- Customer-facing portals (Web and Mobile)
- Core banking services (Payments, Accounts)
- Supporting services (Auth, Notifications, Fraud)
- Platform services (API Gateway)

### Architecture
```
Customer Portal ──┬──► User Authentication
                  ├──► Account Management ──► Notifications
                  ├──► Payment Gateway ───┬──► Fraud Detection
                  └──► Transaction History │        │
                                           └───────►└──► Notifications
Mobile App ───────┴──► (same services)
```

## Customizing the Data

Feel free to modify these files for your organization:

1. Open in Excel, Google Sheets, or any CSV editor
2. Change names, descriptions, and values
3. Add or remove rows as needed
4. Save as CSV (comma-separated)
5. Upload to BookMyEnv

## Tips

- Keep names unique within each entity type
- Use consistent naming conventions
- Reference exact names when linking entities
- Test with a few rows before uploading everything
