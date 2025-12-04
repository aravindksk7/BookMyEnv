'use client';

import { useEffect, useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  LinearProgress,
  Tab,
  Tabs,
  Alert,
  Tooltip,
  Paper,
  TextField,
  InputAdornment,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Badge,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Search as SearchIcon,
  ExpandMore as ExpandMoreIcon,
  Dns as EnvironmentIcon,
  Storage as InstanceIcon,
  Apps as AppsIcon,
  SwapHoriz as InterfaceIcon,
  KeyboardArrowRight as ArrowIcon,
  Circle as DotIcon,
  AccountTree as TopologyIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';
import { topologyAPI } from '@/lib/api';

interface Environment {
  environment_id: string;
  name: string;
  environment_category: string;
  lifecycle_stage: string;
  instance_count: number;
}

interface Instance {
  env_instance_id: string;
  name: string;
  environment_id: string;
  environment_name: string;
  environment_category: string;
  operational_status: string;
  booking_status: string;
  application_count: number;
  infra_count: number;
}

interface Application {
  application_id: string;
  name: string;
  business_domain?: string;
  description?: string;
  criticality?: string;
  data_sensitivity?: string;
  owner_team?: string;
  test_owner?: string;
  instance_count: number;
  interface_count: number;
}

interface Interface {
  interface_id: string;
  name: string;
  direction: string;
  pattern: string;
  frequency: string;
  status: string;
  source_application_id?: string;
  target_application_id?: string;
  source_application_name?: string;
  target_application_name?: string;
  endpoint_count: number;
}

interface AppInstanceMapping {
  app_env_instance_id: string;
  application_id: string;
  env_instance_id: string;
  application_name: string;
  short_code: string;
  instance_name: string;
  environment_name: string;
  version?: string;
  deployment_status?: string;
  deployment_model?: string;
}

interface InterfaceEndpoint {
  interface_endpoint_id: string;
  interface_id: string;
  env_instance_id: string;
  interface_name: string;
  instance_name: string;
  environment_name: string;
  endpoint_url?: string;
  status?: string;
  enabled?: boolean;
  test_mode?: string;
}

interface TopologyData {
  environments: Environment[];
  instances: Instance[];
  applications: Application[];
  interfaces: Interface[];
  appInstanceMappings: AppInstanceMapping[];
  interfaceEndpoints: InterfaceEndpoint[];
  summary: {
    totalEnvironments: number;
    totalInstances: number;
    totalApplications: number;
    totalInterfaces: number;
  };
}

function TabPanel({ children, value, index }: { children: React.ReactNode; value: number; index: number }) {
  return (
    <div hidden={value !== index}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

export default function TopologyPage() {
  const [data, setData] = useState<TopologyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEnv, setExpandedEnv] = useState<string | false>(false);
  const [expandedApp, setExpandedApp] = useState<string | false>(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await topologyAPI.getAll();
      setData(response.data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch topology data');
    } finally {
      setLoading(false);
    }
  };

  // Filter data based on search
  const filteredData = useMemo(() => {
    if (!data || !searchQuery) return data;

    const query = searchQuery.toLowerCase();
    
    const filteredEnvs = data.environments.filter(e => 
      e.name.toLowerCase().includes(query) || 
      e.environment_category?.toLowerCase().includes(query)
    );
    
    const filteredInstances = data.instances.filter(i => 
      i.name.toLowerCase().includes(query) || 
      i.environment_name.toLowerCase().includes(query)
    );
    
    const filteredApps = data.applications.filter(a => 
      a.name.toLowerCase().includes(query) || 
      a.business_domain?.toLowerCase().includes(query) ||
      a.criticality?.toLowerCase().includes(query)
    );
    
    const filteredInterfaces = data.interfaces.filter(i => 
      i.name.toLowerCase().includes(query) || 
      i.source_application_name?.toLowerCase().includes(query) ||
      i.target_application_name?.toLowerCase().includes(query)
    );

    return {
      ...data,
      environments: filteredEnvs,
      instances: filteredInstances,
      applications: filteredApps,
      interfaces: filteredInterfaces
    };
  }, [data, searchQuery]);

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'default' } = {
      Active: 'success',
      Available: 'success',
      Deployed: 'success',
      Maintenance: 'warning',
      Broken: 'error',
      Inactive: 'default',
      Deprecated: 'error',
    };
    return colors[status] || 'default';
  };

  const getInstancesForEnv = (envId: string) => {
    return data?.instances.filter(i => i.environment_id === envId) || [];
  };

  const getAppsForInstance = (instanceId: string) => {
    return data?.appInstanceMappings.filter(m => m.env_instance_id === instanceId) || [];
  };

  const getInterfacesForApp = (appId: string) => {
    return data?.interfaces.filter(i => 
      i.source_application_id === appId || i.target_application_id === appId
    ) || [];
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TopologyIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Topology View
          </Typography>
        </Box>
        <Tooltip title="Refresh">
          <IconButton onClick={fetchData}>
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      {data && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <EnvironmentIcon sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{data.summary.totalEnvironments}</Typography>
                  <Typography variant="body2">Environments</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'success.light', color: 'success.contrastText' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <InstanceIcon sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{data.summary.totalInstances}</Typography>
                  <Typography variant="body2">Instances</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'info.light', color: 'info.contrastText' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <AppsIcon sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{data.summary.totalApplications}</Typography>
                  <Typography variant="body2">Applications</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: 'warning.light', color: 'warning.contrastText' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <InterfaceIcon sx={{ fontSize: 40 }} />
                <Box>
                  <Typography variant="h4">{data.summary.totalInterfaces}</Typography>
                  <Typography variant="body2">Interfaces</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Search */}
      <Card sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          size="small"
          placeholder="Search environments, instances, applications, interfaces..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Card>

      {/* Tabs */}
      <Card>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
          <Tab icon={<TopologyIcon />} iconPosition="start" label="Hierarchical View" />
          <Tab icon={<AppsIcon />} iconPosition="start" label="Applications View" />
          <Tab icon={<InterfaceIcon />} iconPosition="start" label="Interfaces View" />
          <Tab icon={<InstanceIcon />} iconPosition="start" label="Flat List" />
        </Tabs>

        {/* Hierarchical View - Environment > Instance > App */}
        <TabPanel value={tabValue} index={0}>
          <Box sx={{ p: 2 }}>
            {filteredData?.environments.map((env) => (
              <Accordion 
                key={env.environment_id} 
                expanded={expandedEnv === env.environment_id}
                onChange={(_, isExpanded) => setExpandedEnv(isExpanded ? env.environment_id : false)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <EnvironmentIcon color="primary" />
                    <Typography fontWeight={600}>{env.name}</Typography>
                    <Chip label={env.environment_category} size="small" variant="outlined" />
                    <Chip label={env.lifecycle_stage} size="small" color={getStatusColor(env.lifecycle_stage)} />
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                      <Badge badgeContent={env.instance_count} color="primary">
                        <InstanceIcon fontSize="small" />
                      </Badge>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {getInstancesForEnv(env.environment_id).length === 0 ? (
                    <Typography color="text.secondary" sx={{ pl: 4 }}>No instances</Typography>
                  ) : (
                    getInstancesForEnv(env.environment_id).map((instance) => (
                      <Card key={instance.env_instance_id} variant="outlined" sx={{ mb: 1, ml: 4 }}>
                        <CardContent sx={{ py: 1, '&:last-child': { pb: 1 } }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                            <InstanceIcon color="success" fontSize="small" />
                            <Typography fontWeight={500}>{instance.name}</Typography>
                            <Chip label={instance.operational_status} size="small" color={getStatusColor(instance.operational_status)} />
                            {instance.booking_status !== instance.operational_status && (
                              <Chip label={`Booking: ${instance.booking_status}`} size="small" variant="outlined" />
                            )}
                            <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                              <Tooltip title="Applications">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <AppsIcon fontSize="small" color="action" />
                                  <Typography variant="body2">{instance.application_count}</Typography>
                                </Box>
                              </Tooltip>
                              <Tooltip title="Infrastructure">
                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <InstanceIcon fontSize="small" color="action" />
                                  <Typography variant="body2">{instance.infra_count}</Typography>
                                </Box>
                              </Tooltip>
                            </Box>
                          </Box>
                          {/* Apps on this instance */}
                          {getAppsForInstance(instance.env_instance_id).length > 0 && (
                            <Box sx={{ pl: 4, display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                              {getAppsForInstance(instance.env_instance_id).map((mapping) => (
                                <Chip
                                  key={mapping.app_env_instance_id}
                                  icon={<AppsIcon />}
                                  label={`${mapping.application_name} ${mapping.version ? `v${mapping.version}` : ''}`}
                                  size="small"
                                  variant="outlined"
                                  color={mapping.deployment_status === 'Deployed' ? 'success' : 'default'}
                                />
                              ))}
                            </Box>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </TabPanel>

        {/* Applications View - App > Interfaces & Deployments */}
        <TabPanel value={tabValue} index={1}>
          <Box sx={{ p: 2 }}>
            {filteredData?.applications.map((app) => (
              <Accordion 
                key={app.application_id}
                expanded={expandedApp === app.application_id}
                onChange={(_, isExpanded) => setExpandedApp(isExpanded ? app.application_id : false)}
                sx={{ mb: 1 }}
              >
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                    <AppsIcon color="info" />
                    <Box>
                      <Typography fontWeight={600}>{app.name}</Typography>
                      {app.business_domain && (
                        <Typography variant="caption" color="text.secondary">{app.business_domain}</Typography>
                      )}
                    </Box>
                    {app.criticality && <Chip label={app.criticality} size="small" variant="outlined" />}
                    <Box sx={{ ml: 'auto', display: 'flex', gap: 2 }}>
                      <Tooltip title="Deployed Instances">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <InstanceIcon fontSize="small" color="action" />
                          <Typography variant="body2">{app.instance_count}</Typography>
                        </Box>
                      </Tooltip>
                      <Tooltip title="Interfaces">
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <InterfaceIcon fontSize="small" color="action" />
                          <Typography variant="body2">{app.interface_count}</Typography>
                        </Box>
                      </Tooltip>
                    </Box>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {/* Deployments */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        <InstanceIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                        Deployed To
                      </Typography>
                      {data?.appInstanceMappings.filter(m => m.application_id === app.application_id).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No deployments</Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {data?.appInstanceMappings
                            .filter(m => m.application_id === app.application_id)
                            .map((m) => (
                              <Box key={m.app_env_instance_id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Chip
                                  label={`${m.environment_name} / ${m.instance_name}`}
                                  size="small"
                                  variant="outlined"
                                />
                                {m.version && (
                                  <Chip
                                    label={`v${m.version}`}
                                    size="small"
                                    color="primary"
                                  />
                                )}
                                {m.deployment_status && (
                                  <Chip
                                    label={m.deployment_status}
                                    size="small"
                                    color={getStatusColor(m.deployment_status)}
                                  />
                                )}
                              </Box>
                            ))}
                        </Box>
                      )}
                    </Grid>
                    {/* Interfaces */}
                    <Grid item xs={12} md={6}>
                      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                        <InterfaceIcon fontSize="small" sx={{ verticalAlign: 'middle', mr: 1 }} />
                        Interfaces
                      </Typography>
                      {getInterfacesForApp(app.application_id).length === 0 ? (
                        <Typography variant="body2" color="text.secondary">No interfaces</Typography>
                      ) : (
                        <List dense disablePadding>
                          {getInterfacesForApp(app.application_id).map((iface) => (
                            <ListItem key={iface.interface_id} disablePadding sx={{ py: 0.5 }}>
                              <ListItemIcon sx={{ minWidth: 30 }}>
                                <ArrowIcon 
                                  fontSize="small" 
                                  sx={{ 
                                    transform: iface.source_application_id === app.application_id 
                                      ? 'rotate(0deg)' 
                                      : 'rotate(180deg)',
                                    color: iface.source_application_id === app.application_id 
                                      ? 'warning.main' 
                                      : 'info.main'
                                  }} 
                                />
                              </ListItemIcon>
                              <ListItemText
                                primary={iface.name}
                                secondary={
                                  iface.source_application_id === app.application_id
                                    ? `→ ${iface.target_application_name || 'External'}`
                                    : `← ${iface.source_application_name || 'External'}`
                                }
                              />
                              <Chip label={iface.pattern} size="small" variant="outlined" />
                            </ListItem>
                          ))}
                        </List>
                      )}
                    </Grid>
                  </Grid>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </TabPanel>

        {/* Interfaces View */}
        <TabPanel value={tabValue} index={2}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Interface</TableCell>
                  <TableCell>Source Application</TableCell>
                  <TableCell align="center">Direction</TableCell>
                  <TableCell>Target Application</TableCell>
                  <TableCell>Pattern</TableCell>
                  <TableCell>Frequency</TableCell>
                  <TableCell align="center">Endpoints</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredData?.interfaces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center">
                      <Typography color="text.secondary">No interfaces found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData?.interfaces.map((iface) => (
                    <TableRow key={iface.interface_id} hover>
                      <TableCell>
                        <Typography fontWeight={500}>{iface.name}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={<AppsIcon />} 
                          label={iface.source_application_name || 'External'} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip
                          label={iface.direction}
                          size="small"
                          color={iface.direction === 'Inbound' ? 'info' : iface.direction === 'Outbound' ? 'warning' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          icon={<AppsIcon />} 
                          label={iface.target_application_name || 'External'} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>{iface.pattern}</TableCell>
                      <TableCell>{iface.frequency}</TableCell>
                      <TableCell align="center">
                        <Chip label={iface.endpoint_count} size="small" />
                      </TableCell>
                      <TableCell>
                        <Chip label={iface.status} size="small" color={getStatusColor(iface.status)} />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
          
          {/* Interface Endpoints Section */}
          {data?.interfaceEndpoints && data.interfaceEndpoints.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2 }}>
                <InstanceIcon color="success" /> Interface Endpoints ({data.interfaceEndpoints.length})
              </Typography>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Interface</TableCell>
                      <TableCell>Environment</TableCell>
                      <TableCell>Instance</TableCell>
                      <TableCell>Endpoint URL</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.interfaceEndpoints.map((endpoint) => (
                      <TableRow key={endpoint.interface_endpoint_id} hover>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>{endpoint.interface_name}</Typography>
                        </TableCell>
                        <TableCell>{endpoint.environment_name}</TableCell>
                        <TableCell>
                          <Chip 
                            icon={<InstanceIcon />} 
                            label={endpoint.instance_name} 
                            size="small" 
                            variant="outlined"
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                            {endpoint.endpoint_url || '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={endpoint.status || 'Unknown'} 
                            size="small" 
                            color={getStatusColor(endpoint.status || 'Unknown')}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </TabPanel>

        {/* Flat List View */}
        <TabPanel value={tabValue} index={3}>
          <Grid container spacing={2} sx={{ p: 2 }}>
            {/* Environments */}
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <EnvironmentIcon color="primary" /> Environments
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {filteredData?.environments.map((env) => (
                    <ListItem key={env.environment_id}>
                      <ListItemText
                        primary={env.name}
                        secondary={`${env.environment_category} • ${env.instance_count} instances`}
                      />
                      <Chip label={env.lifecycle_stage} size="small" color={getStatusColor(env.lifecycle_stage)} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Instances */}
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InstanceIcon color="success" /> Instances
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {filteredData?.instances.map((inst) => (
                    <ListItem key={inst.env_instance_id}>
                      <ListItemText
                        primary={inst.name}
                        secondary={`${inst.environment_name} • ${inst.application_count} apps`}
                      />
                      <Chip label={inst.operational_status} size="small" color={getStatusColor(inst.operational_status)} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Applications */}
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <AppsIcon color="info" /> Applications
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {filteredData?.applications.map((app) => (
                    <ListItem key={app.application_id}>
                      <ListItemText
                        primary={app.name}
                        secondary={`${app.business_domain || 'N/A'} • ${app.criticality || 'N/A'} • ${app.instance_count} instances`}
                      />
                      {app.criticality && <Chip label={app.criticality} size="small" color={getStatusColor(app.criticality)} />}
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            {/* Interfaces */}
            <Grid item xs={12} md={6} lg={3}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <InterfaceIcon color="warning" /> Interfaces
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 400, overflow: 'auto' }}>
                <List dense>
                  {filteredData?.interfaces.map((iface) => (
                    <ListItem key={iface.interface_id}>
                      <ListItemText
                        primary={iface.name}
                        secondary={`${iface.pattern} • ${iface.direction}`}
                      />
                      <Chip label={iface.status} size="small" color={getStatusColor(iface.status)} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </TabPanel>
      </Card>
    </Box>
  );
}
