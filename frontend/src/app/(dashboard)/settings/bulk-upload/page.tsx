'use client';

import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Tabs,
  Tab,
  Alert,
  AlertTitle,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  CloudUpload as UploadIcon,
  Download as DownloadIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Info as InfoIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Computer as EnvironmentIcon,
  Storage as InstanceIcon,
  Apps as ApplicationIcon,
  SwapHoriz as InterfaceIcon,
  Memory as ComponentIcon,
  Link as LinkIcon,
  Dns as InfraIcon,
  Refresh as RefreshIcon,
  Hub as EndpointIcon,
  AccountTree as ComponentInstanceIcon,
} from '@mui/icons-material';
import { bulkUploadAPI } from '@/lib/api';

interface UploadResult {
  success: { row: number; id: string; name: string }[];
  errors: { row: number; error: string }[];
}

interface UploadResponse {
  message: string;
  results: UploadResult;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const uploadTypes = [
  { 
    key: 'environments', 
    label: 'Environments', 
    icon: <EnvironmentIcon />,
    description: 'Upload environment definitions (NonProd, PreProd, DR, Training, Sandpit)',
    fields: ['name*', 'description', 'environment_category', 'lifecycle_stage', 'owner_team', 'support_group', 'data_sensitivity', 'usage_policies']
  },
  { 
    key: 'instances', 
    label: 'Instances', 
    icon: <InstanceIcon />,
    description: 'Upload environment instances (requires existing environments)',
    fields: ['environment_name*', 'name*', 'operational_status', 'availability_window', 'capacity', 'primary_location', 'bookable']
  },
  { 
    key: 'applications', 
    label: 'Applications', 
    icon: <ApplicationIcon />,
    description: 'Upload application definitions',
    fields: ['name*', 'business_domain', 'description', 'criticality', 'data_sensitivity', 'owner_team', 'test_owner']
  },
  { 
    key: 'interfaces', 
    label: 'Interfaces', 
    icon: <InterfaceIcon />,
    description: 'Upload interface definitions (can link to applications by name)',
    fields: ['name*', 'direction', 'pattern', 'frequency', 'protocol', 'source_application_name', 'target_application_name', 'description']
  },
  { 
    key: 'components', 
    label: 'App Components', 
    icon: <ComponentIcon />,
    description: 'Upload application components (requires existing applications)',
    fields: ['application_name*', 'name*', 'component_type', 'technology_stack', 'description']
  },
  { 
    key: 'app_instances', 
    label: 'App Deployments', 
    icon: <LinkIcon />,
    description: 'Link applications to environment instances',
    fields: ['application_name*', 'instance_name*', 'deployment_model', 'version', 'deployment_status']
  },
  { 
    key: 'infra_components', 
    label: 'Infrastructure', 
    icon: <InfraIcon />,
    description: 'Upload infrastructure components (VMs, servers, etc.)',
    fields: ['instance_name*', 'name*', 'component_type', 'hostname', 'ip_address', 'os_version', 'status', 'owner_team']
  },
  { 
    key: 'interface_endpoints', 
    label: 'Interface Endpoints', 
    icon: <EndpointIcon />,
    description: 'Link interfaces to environment instances with endpoint details',
    fields: ['interface_name*', 'instance_name*', 'endpoint', 'test_mode', 'enabled', 'source_component_name', 'target_component_name']
  },
  { 
    key: 'component_instances', 
    label: 'Component Instances', 
    icon: <ComponentInstanceIcon />,
    description: 'Deploy application components to environment instances',
    fields: ['application_name*', 'component_name*', 'instance_name*', 'version', 'deployment_status']
  },
];

export default function BulkUploadPage() {
  const [activeTab, setActiveTab] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentType = uploadTypes[activeTab];

  const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
    setUploadResult(null);
    setError(null);
  };

  const downloadTemplate = async (type: string) => {
    try {
      const response = await bulkUploadAPI.getTemplate(type);
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_template.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to download template');
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.endsWith('.csv')) {
      setError('Please select a CSV file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('File size exceeds 5MB limit');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    try {
      const content = await file.text();
      
      let response;
      switch (currentType.key) {
        case 'environments':
          response = await bulkUploadAPI.uploadEnvironments(content);
          break;
        case 'instances':
          response = await bulkUploadAPI.uploadInstances(content);
          break;
        case 'applications':
          response = await bulkUploadAPI.uploadApplications(content);
          break;
        case 'interfaces':
          response = await bulkUploadAPI.uploadInterfaces(content);
          break;
        case 'components':
          response = await bulkUploadAPI.uploadComponents(content);
          break;
        case 'app_instances':
          response = await bulkUploadAPI.uploadAppInstances(content);
          break;
        case 'infra_components':
          response = await bulkUploadAPI.uploadInfraComponents(content);
          break;
        case 'interface_endpoints':
          response = await bulkUploadAPI.uploadInterfaceEndpoints(content);
          break;
        case 'component_instances':
          response = await bulkUploadAPI.uploadComponentInstances(content);
          break;
        default:
          throw new Error('Invalid upload type');
      }

      setUploadResult(response.data);
      setShowResults(true);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Bulk Upload
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Import data from CSV files to quickly populate environments, applications, and infrastructure.
      </Typography>

      {/* Instructions */}
      <Paper sx={{ p: 2, mb: 3, bgcolor: 'info.lighter' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <InfoIcon color="info" sx={{ mt: 0.5 }} />
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>
              How to use Bulk Upload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              1. Download the CSV template for the data type you want to upload<br />
              2. Fill in your data following the template format (fields marked with * are required)<br />
              3. Upload the completed CSV file<br />
              4. Review the results - successfully imported records and any errors will be shown
            </Typography>
          </Box>
        </Box>
      </Paper>

      {/* Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          {uploadTypes.map((type, index) => (
            <Tab
              key={type.key}
              label={type.label}
              icon={type.icon}
              iconPosition="start"
            />
          ))}
        </Tabs>

        {uploadTypes.map((type, index) => (
          <TabPanel key={type.key} value={activeTab} index={index}>
            <Box sx={{ px: 3 }}>
              <Grid container spacing={3}>
                {/* Upload Card */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined">
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                        {type.icon}
                        <Typography variant="h6">{type.label}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        {type.description}
                      </Typography>
                      
                      <Divider sx={{ my: 2 }} />
                      
                      <Typography variant="subtitle2" gutterBottom>
                        CSV Fields:
                      </Typography>
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
                        {type.fields.map((field) => (
                          <Chip
                            key={field}
                            label={field}
                            size="small"
                            color={field.includes('*') ? 'primary' : 'default'}
                            variant={field.includes('*') ? 'filled' : 'outlined'}
                          />
                        ))}
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0, gap: 1 }}>
                      <Button
                        variant="outlined"
                        startIcon={<DownloadIcon />}
                        onClick={() => downloadTemplate(type.key)}
                      >
                        Download Template
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <UploadIcon />}
                        onClick={triggerFileSelect}
                        disabled={uploading}
                      >
                        {uploading ? 'Uploading...' : 'Upload CSV'}
                      </Button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        hidden
                        onChange={handleFileSelect}
                      />
                    </CardActions>
                  </Card>
                </Grid>

                {/* Results Card */}
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                        <Typography variant="h6">Upload Results</Typography>
                        {uploadResult && (
                          <IconButton size="small" onClick={() => setShowResults(!showResults)}>
                            {showResults ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                          </IconButton>
                        )}
                      </Box>

                      {error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                          <AlertTitle>Error</AlertTitle>
                          {error}
                        </Alert>
                      )}

                      {!uploadResult && !error && (
                        <Box sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                          <UploadIcon sx={{ fontSize: 48, opacity: 0.5, mb: 1 }} />
                          <Typography>Upload a CSV file to see results</Typography>
                        </Box>
                      )}

                      {uploadResult && (
                        <Collapse in={showResults}>
                          <Alert 
                            severity={uploadResult.results.errors.length === 0 ? 'success' : 'warning'}
                            sx={{ mb: 2 }}
                          >
                            <AlertTitle>{uploadResult.message}</AlertTitle>
                            <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                              <Chip
                                icon={<SuccessIcon />}
                                label={`${uploadResult.results.success.length} Successful`}
                                color="success"
                                size="small"
                              />
                              {uploadResult.results.errors.length > 0 && (
                                <Chip
                                  icon={<ErrorIcon />}
                                  label={`${uploadResult.results.errors.length} Errors`}
                                  color="error"
                                  size="small"
                                />
                              )}
                            </Box>
                          </Alert>

                          {uploadResult.results.errors.length > 0 && (
                            <Box sx={{ mb: 2 }}>
                              <Typography variant="subtitle2" color="error" gutterBottom>
                                Errors:
                              </Typography>
                              <TableContainer sx={{ maxHeight: 200 }}>
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, width: 60 }}>Row</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Error</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {uploadResult.results.errors.map((err, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>{err.row}</TableCell>
                                        <TableCell sx={{ color: 'error.main' }}>{err.error}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          )}

                          {uploadResult.results.success.length > 0 && (
                            <Box>
                              <Typography variant="subtitle2" color="success.main" gutterBottom>
                                Successfully Imported:
                              </Typography>
                              <TableContainer sx={{ maxHeight: 200 }}>
                                <Table size="small" stickyHeader>
                                  <TableHead>
                                    <TableRow>
                                      <TableCell sx={{ fontWeight: 600, width: 60 }}>Row</TableCell>
                                      <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {uploadResult.results.success.slice(0, 20).map((item, idx) => (
                                      <TableRow key={idx}>
                                        <TableCell>{item.row}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                      </TableRow>
                                    ))}
                                    {uploadResult.results.success.length > 20 && (
                                      <TableRow>
                                        <TableCell colSpan={2} sx={{ textAlign: 'center', fontStyle: 'italic' }}>
                                          ...and {uploadResult.results.success.length - 20} more
                                        </TableCell>
                                      </TableRow>
                                    )}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          )}
                        </Collapse>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          </TabPanel>
        ))}
      </Paper>

      {/* Quick Reference */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Upload Order Recommendation
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          For best results, upload data in this order to ensure dependencies are met:
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon><Chip label="1" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="Environments" 
              secondary="Base environment definitions (DEV, TEST, UAT, etc.)"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="2" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="Instances" 
              secondary="Environment instances (requires environments to exist)"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="3" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="Applications" 
              secondary="Application definitions"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="4" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="App Components & Interfaces" 
              secondary="Application components and interface definitions"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="5" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="App Deployments & Infrastructure" 
              secondary="Link applications to instances and add infrastructure components"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="6" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="Component Instances" 
              secondary="Deploy app components to environment instances (requires components and instances)"
            />
          </ListItem>
          <ListItem>
            <ListItemIcon><Chip label="7" size="small" color="primary" /></ListItemIcon>
            <ListItemText 
              primary="Interface Endpoints" 
              secondary="Link interfaces to instances with optional component instance references"
            />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
}
