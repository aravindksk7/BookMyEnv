'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Tooltip,
  Alert,
  Switch,
  FormControlLabel,
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Api as ApiIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { interfacesAPI, environmentsAPI, componentInstancesAPI, applicationsAPI } from '@/lib/api';

interface Application {
  application_id: string;
  name: string;
}

interface ComponentInstance {
  component_instance_id: string;
  component_name: string;
  application_name: string;
  env_instance_name: string;
  environment_name: string;
}

interface Environment {
  env_instance_id: string;
  name: string;
  environment_name?: string;
}

interface InterfaceEndpoint {
  interface_endpoint_id: string;
  interface_id: string;
  env_instance_id: string;
  env_instance_name: string;
  environment_name: string;
  source_component_instance_id: string | null;
  source_component_name: string | null;
  source_application_name: string | null;
  target_component_instance_id: string | null;
  target_component_name: string | null;
  target_application_name: string | null;
  external_stub_id: string | null;
  endpoint: string | null;
  enabled: boolean;
  test_mode: string;
}

interface Interface {
  interface_id: string;
  name: string;
  direction: string;
  pattern: string;
  frequency: string;
  external_party: string | null;
  sla: string | null;
  contract_id: string | null;
  source_application_id: string | null;
  target_application_id: string | null;
  source_application_name: string | null;
  target_application_name: string | null;
  endpoint_count: number;
  endpoints?: InterfaceEndpoint[];
}

interface InterfaceFormData {
  name: string;
  direction: string;
  pattern: string;
  frequency: string;
  external_party: string;
  sla: string;
  contract_id: string;
  source_application_id: string;
  target_application_id: string;
}

interface EndpointFormData {
  env_instance_id: string;
  source_component_instance_id: string;
  target_component_instance_id: string;
  external_stub_id: string;
  endpoint: string;
  enabled: boolean;
  test_mode: string;
}

const DIRECTIONS = ['Inbound', 'Outbound', 'Bidirectional'];
const PATTERNS = ['REST', 'SOAP', 'MQ', 'Kafka', 'FileDrop', 'FTP', 'SFTP', 'FIX', 'Other'];
const FREQUENCIES = ['RealTime', 'NearRealTime', 'Batch'];
const TEST_MODES = ['Live', 'Virtualised', 'Stubbed', 'Disabled'];

export default function InterfacesPage() {
  const [interfaces, setInterfaces] = useState<Interface[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [componentInstances, setComponentInstances] = useState<ComponentInstance[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Interface Dialog
  const [openInterfaceDialog, setOpenInterfaceDialog] = useState(false);
  const [editingInterface, setEditingInterface] = useState<Interface | null>(null);
  const [interfaceFormData, setInterfaceFormData] = useState<InterfaceFormData>({
    name: '',
    direction: 'Outbound',
    pattern: 'REST',
    frequency: 'RealTime',
    external_party: '',
    sla: '',
    contract_id: '',
    source_application_id: '',
    target_application_id: '',
  });

  // Endpoint Dialog
  const [openEndpointDialog, setOpenEndpointDialog] = useState(false);
  const [editingEndpoint, setEditingEndpoint] = useState<InterfaceEndpoint | null>(null);
  const [currentInterfaceId, setCurrentInterfaceId] = useState<string | null>(null);
  const [endpointFormData, setEndpointFormData] = useState<EndpointFormData>({
    env_instance_id: '',
    source_component_instance_id: '',
    target_component_instance_id: '',
    external_stub_id: '',
    endpoint: '',
    enabled: true,
    test_mode: 'Live',
  });

  // Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'interface' | 'endpoint';
    id: string | null;
    interfaceId?: string | null;
    name: string;
  }>({ open: false, type: 'interface', id: null, interfaceId: null, name: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [interfacesRes, envsRes, compRes, appsRes] = await Promise.all([
        interfacesAPI.getAll(),
        environmentsAPI.getAllInstances(),
        componentInstancesAPI.getAll(),
        applicationsAPI.getAll(),
      ]);
      setInterfaces(interfacesRes.data.interfaces || []);
      setEnvironments(envsRes.data.instances || []);
      setComponentInstances(compRes.data.componentInstances || []);
      setApplications(appsRes.data.applications || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = async (interfaceId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(interfaceId)) {
      newExpanded.delete(interfaceId);
    } else {
      newExpanded.add(interfaceId);
      // Fetch endpoints if not loaded
      const iface = interfaces.find((i: Interface) => i.interface_id === interfaceId);
      if (iface && !iface.endpoints) {
        try {
          const response = await interfacesAPI.getEndpoints(interfaceId);
          setInterfaces((prev: Interface[]) =>
            prev.map((i: Interface) =>
              i.interface_id === interfaceId ? { ...i, endpoints: response.data.endpoints || [] } : i
            )
          );
        } catch (err) {
          console.error('Failed to fetch endpoints:', err);
        }
      }
    }
    setExpandedRows(newExpanded);
  };

  // Interface handlers
  const handleOpenInterfaceDialog = (iface?: Interface) => {
    if (iface) {
      setEditingInterface(iface);
      setInterfaceFormData({
        name: iface.name,
        direction: iface.direction || 'Outbound',
        pattern: iface.pattern || 'REST',
        frequency: iface.frequency || 'RealTime',
        external_party: iface.external_party || '',
        sla: iface.sla || '',
        contract_id: iface.contract_id || '',
        source_application_id: iface.source_application_id || '',
        target_application_id: iface.target_application_id || '',
      });
    } else {
      setEditingInterface(null);
      setInterfaceFormData({
        name: '',
        direction: 'Outbound',
        pattern: 'REST',
        frequency: 'RealTime',
        external_party: '',
        sla: '',
        contract_id: '',
        source_application_id: '',
        target_application_id: '',
      });
    }
    setOpenInterfaceDialog(true);
  };

  const handleCloseInterfaceDialog = () => {
    setOpenInterfaceDialog(false);
    setEditingInterface(null);
  };

  const handleSaveInterface = async () => {
    try {
      if (editingInterface) {
        await interfacesAPI.update(editingInterface.interface_id, interfaceFormData);
      } else {
        await interfacesAPI.create(interfaceFormData);
      }
      handleCloseInterfaceDialog();
      fetchData();
    } catch (err) {
      setError('Failed to save interface');
      console.error(err);
    }
  };

  // Endpoint handlers
  const handleOpenEndpointDialog = (interfaceId: string, endpoint?: InterfaceEndpoint) => {
    setCurrentInterfaceId(interfaceId);
    if (endpoint) {
      setEditingEndpoint(endpoint);
      setEndpointFormData({
        env_instance_id: endpoint.env_instance_id || '',
        source_component_instance_id: endpoint.source_component_instance_id || '',
        target_component_instance_id: endpoint.target_component_instance_id || '',
        external_stub_id: endpoint.external_stub_id || '',
        endpoint: endpoint.endpoint || '',
        enabled: endpoint.enabled !== false,
        test_mode: endpoint.test_mode || 'Live',
      });
    } else {
      setEditingEndpoint(null);
      setEndpointFormData({
        env_instance_id: environments.length > 0 ? environments[0].env_instance_id : '',
        source_component_instance_id: '',
        target_component_instance_id: '',
        external_stub_id: '',
        endpoint: '',
        enabled: true,
        test_mode: 'Live',
      });
    }
    setOpenEndpointDialog(true);
  };

  const handleCloseEndpointDialog = () => {
    setOpenEndpointDialog(false);
    setEditingEndpoint(null);
    setCurrentInterfaceId(null);
  };

  const handleSaveEndpoint = async () => {
    if (!currentInterfaceId) return;

    try {
      const data = {
        ...endpointFormData,
        source_component_instance_id: endpointFormData.source_component_instance_id || null,
        target_component_instance_id: endpointFormData.target_component_instance_id || null,
        external_stub_id: endpointFormData.external_stub_id || null,
        endpoint: endpointFormData.endpoint || null,
      };

      if (editingEndpoint) {
        await interfacesAPI.updateEndpoint(currentInterfaceId, editingEndpoint.interface_endpoint_id, data);
      } else {
        await interfacesAPI.createEndpoint(currentInterfaceId, data);
      }
      handleCloseEndpointDialog();
      
      // Refresh endpoints
      const response = await interfacesAPI.getEndpoints(currentInterfaceId);
      setInterfaces((prev: Interface[]) =>
        prev.map((i: Interface) =>
          i.interface_id === currentInterfaceId ? { ...i, endpoints: response.data.endpoints || [] } : i
        )
      );
      fetchData(); // Refresh counts
    } catch (err) {
      setError('Failed to save endpoint');
      console.error(err);
    }
  };

  // Delete handlers
  const handleOpenDeleteDialog = (type: 'interface' | 'endpoint', id: string, name: string, interfaceId?: string) => {
    setDeleteDialog({ open: true, type, id, interfaceId: interfaceId || null, name });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, type: 'interface', id: null, interfaceId: null, name: '' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      if (deleteDialog.type === 'interface') {
        await interfacesAPI.delete(deleteDialog.id);
        fetchData();
      } else if (deleteDialog.interfaceId) {
        await interfacesAPI.deleteEndpoint(deleteDialog.interfaceId, deleteDialog.id);
        const response = await interfacesAPI.getEndpoints(deleteDialog.interfaceId);
        setInterfaces((prev: Interface[]) =>
          prev.map((i: Interface) =>
            i.interface_id === deleteDialog.interfaceId ? { ...i, endpoints: response.data.endpoints || [] } : i
          )
        );
        fetchData(); // Refresh counts
      }
      handleCloseDeleteDialog();
    } catch (err) {
      setError(`Failed to delete ${deleteDialog.type}`);
      console.error(err);
    }
  };

  const getDirectionColor = (direction: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      Inbound: 'success',
      Outbound: 'primary',
      Bidirectional: 'warning',
    };
    return colors[direction] || 'default';
  };

  const getTestModeColor = (mode: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      Live: 'success',
      Virtualised: 'primary',
      Stubbed: 'warning',
      Disabled: 'error',
    };
    return colors[mode] || 'default';
  };

  // Filter component instances by selected environment
  const filteredComponentInstances = endpointFormData.env_instance_id
    ? componentInstances.filter((ci: ComponentInstance) => 
        ci.env_instance_name === environments.find((e: Environment) => e.env_instance_id === endpointFormData.env_instance_id)?.name
      )
    : componentInstances;

  // Stats
  const stats = {
    total: interfaces.length,
    byDirection: DIRECTIONS.reduce((acc, dir) => {
      acc[dir] = interfaces.filter((i: Interface) => i.direction === dir).length;
      return acc;
    }, {} as Record<string, number>),
    totalEndpoints: interfaces.reduce((sum: number, i: Interface) => sum + (i.endpoint_count || 0), 0),
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <ApiIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Interface Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenInterfaceDialog()}>
          Add Interface
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Total Interfaces</Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Inbound</Typography>
              <Typography variant="h4">{stats.byDirection['Inbound'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Outbound</Typography>
              <Typography variant="h4">{stats.byDirection['Outbound'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Total Endpoints</Typography>
              <Typography variant="h4">{stats.totalEndpoints}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell width={50}></TableCell>
              <TableCell>Name</TableCell>
              <TableCell>Source App</TableCell>
              <TableCell>Target App</TableCell>
              <TableCell>Direction</TableCell>
              <TableCell>Pattern</TableCell>
              <TableCell>Frequency</TableCell>
              <TableCell>External Party</TableCell>
              <TableCell>Endpoints</TableCell>
              <TableCell width={120}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={10} align="center">Loading...</TableCell>
              </TableRow>
            ) : interfaces.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} align="center">
                  No interfaces found. Click &quot;Add Interface&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              interfaces.map((iface: Interface) => (
                <React.Fragment key={iface.interface_id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleRowExpansion(iface.interface_id)}>
                        {expandedRows.has(iface.interface_id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">{iface.name}</Typography>
                      {iface.sla && (
                        <Typography variant="caption" color="text.secondary">SLA: {iface.sla}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      {iface.source_application_name ? (
                        <Chip label={iface.source_application_name} size="small" color="info" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {iface.target_application_name ? (
                        <Chip label={iface.target_application_name} size="small" color="success" variant="outlined" />
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      <Chip label={iface.direction} color={getDirectionColor(iface.direction)} size="small" />
                    </TableCell>
                    <TableCell><Chip label={iface.pattern} size="small" variant="outlined" /></TableCell>
                    <TableCell>{iface.frequency}</TableCell>
                    <TableCell>{iface.external_party || '-'}</TableCell>
                    <TableCell>
                      <Chip label={iface.endpoint_count || 0} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenInterfaceDialog(iface)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog('interface', iface.interface_id, iface.name)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={10} sx={{ py: 0 }}>
                      <Collapse in={expandedRows.has(iface.interface_id)} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2">
                              <LinkIcon sx={{ mr: 0.5, fontSize: 16, verticalAlign: 'middle' }} />
                              Environment Endpoints
                            </Typography>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleOpenEndpointDialog(iface.interface_id)}>
                              Add Endpoint
                            </Button>
                          </Box>
                          {iface.endpoints && iface.endpoints.length > 0 ? (
                            <List dense>
                              {iface.endpoints.map((ep: InterfaceEndpoint, index: number) => (
                                <React.Fragment key={ep.interface_endpoint_id}>
                                  {index > 0 && <Divider />}
                                  <ListItem>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="body2" fontWeight="medium">
                                            {ep.environment_name} / {ep.env_instance_name}
                                          </Typography>
                                          <Chip label={ep.test_mode} size="small" color={getTestModeColor(ep.test_mode)} />
                                          {!ep.enabled && <Chip label="Disabled" size="small" color="error" variant="outlined" />}
                                        </Box>
                                      }
                                      secondary={
                                        <Box sx={{ mt: 0.5 }}>
                                          {ep.source_application_name && (
                                            <Typography variant="caption" display="block" color="text.secondary">
                                              Source: {ep.source_application_name} / {ep.source_component_name}
                                            </Typography>
                                          )}
                                          {ep.target_application_name && (
                                            <Typography variant="caption" display="block" color="text.secondary">
                                              Target: {ep.target_application_name} / {ep.target_component_name}
                                            </Typography>
                                          )}
                                          {ep.endpoint && (
                                            <Typography variant="caption" display="block" color="primary">
                                              Endpoint: {ep.endpoint}
                                            </Typography>
                                          )}
                                          {ep.external_stub_id && (
                                            <Typography variant="caption" display="block" color="warning.main">
                                              Stub ID: {ep.external_stub_id}
                                            </Typography>
                                          )}
                                        </Box>
                                      }
                                    />
                                    <ListItemSecondaryAction>
                                      <IconButton size="small" onClick={() => handleOpenEndpointDialog(iface.interface_id, ep)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog('endpoint', ep.interface_endpoint_id, `${ep.env_instance_name} endpoint`, iface.interface_id)}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </ListItemSecondaryAction>
                                  </ListItem>
                                </React.Fragment>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                              No endpoints configured. Click &quot;Add Endpoint&quot; to link this interface to an environment.
                            </Typography>
                          )}
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Interface Dialog */}
      <Dialog open={openInterfaceDialog} onClose={handleCloseInterfaceDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingInterface ? 'Edit Interface' : 'Create Interface'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={interfaceFormData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterfaceFormData({ ...interfaceFormData, name: e.target.value })}
              fullWidth
              required
            />
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Direction</InputLabel>
                  <Select value={interfaceFormData.direction} label="Direction" onChange={(e) => setInterfaceFormData({ ...interfaceFormData, direction: e.target.value })}>
                    {DIRECTIONS.map((d) => <MenuItem key={d} value={d}>{d}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Pattern</InputLabel>
                  <Select value={interfaceFormData.pattern} label="Pattern" onChange={(e) => setInterfaceFormData({ ...interfaceFormData, pattern: e.target.value })}>
                    {PATTERNS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={4}>
                <FormControl fullWidth>
                  <InputLabel>Frequency</InputLabel>
                  <Select value={interfaceFormData.frequency} label="Frequency" onChange={(e) => setInterfaceFormData({ ...interfaceFormData, frequency: e.target.value })}>
                    {FREQUENCIES.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
            <TextField
              label="External Party"
              value={interfaceFormData.external_party}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterfaceFormData({ ...interfaceFormData, external_party: e.target.value })}
              fullWidth
              helperText="Name of the external system or partner"
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="SLA"
                  value={interfaceFormData.sla}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterfaceFormData({ ...interfaceFormData, sla: e.target.value })}
                  fullWidth
                  placeholder="99.9%"
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Contract ID"
                  value={interfaceFormData.contract_id}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setInterfaceFormData({ ...interfaceFormData, contract_id: e.target.value })}
                  fullWidth
                />
              </Grid>
            </Grid>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Source Application</InputLabel>
                  <Select
                    value={interfaceFormData.source_application_id}
                    label="Source Application"
                    onChange={(e) => setInterfaceFormData({ ...interfaceFormData, source_application_id: e.target.value as string })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {applications.map((app: Application) => (
                      <MenuItem key={app.application_id} value={app.application_id}>{app.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Target Application</InputLabel>
                  <Select
                    value={interfaceFormData.target_application_id}
                    label="Target Application"
                    onChange={(e) => setInterfaceFormData({ ...interfaceFormData, target_application_id: e.target.value as string })}
                  >
                    <MenuItem value="">None</MenuItem>
                    {applications.map((app: Application) => (
                      <MenuItem key={app.application_id} value={app.application_id}>{app.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInterfaceDialog}>Cancel</Button>
          <Button onClick={handleSaveInterface} variant="contained" disabled={!interfaceFormData.name}>
            {editingInterface ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Endpoint Dialog */}
      <Dialog open={openEndpointDialog} onClose={handleCloseEndpointDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingEndpoint ? 'Edit Endpoint' : 'Add Endpoint'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth required>
              <InputLabel>Environment Instance</InputLabel>
              <Select
                value={endpointFormData.env_instance_id}
                label="Environment Instance"
                onChange={(e) => setEndpointFormData({ ...endpointFormData, env_instance_id: e.target.value, source_component_instance_id: '', target_component_instance_id: '' })}
              >
                {environments.map((env: Environment) => (
                  <MenuItem key={env.env_instance_id} value={env.env_instance_id}>
                    {env.environment_name} / {env.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Source Component</InputLabel>
              <Select
                value={endpointFormData.source_component_instance_id}
                label="Source Component"
                onChange={(e) => setEndpointFormData({ ...endpointFormData, source_component_instance_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {filteredComponentInstances.map((ci: ComponentInstance) => (
                  <MenuItem key={ci.component_instance_id} value={ci.component_instance_id}>
                    {ci.application_name} / {ci.component_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Target Component</InputLabel>
              <Select
                value={endpointFormData.target_component_instance_id}
                label="Target Component"
                onChange={(e) => setEndpointFormData({ ...endpointFormData, target_component_instance_id: e.target.value })}
              >
                <MenuItem value="">None</MenuItem>
                {filteredComponentInstances.map((ci: ComponentInstance) => (
                  <MenuItem key={ci.component_instance_id} value={ci.component_instance_id}>
                    {ci.application_name} / {ci.component_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Endpoint URL"
              value={endpointFormData.endpoint}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpointFormData({ ...endpointFormData, endpoint: e.target.value })}
              fullWidth
              placeholder="https://api.example.com/v1"
            />
            <TextField
              label="External Stub ID"
              value={endpointFormData.external_stub_id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEndpointFormData({ ...endpointFormData, external_stub_id: e.target.value })}
              fullWidth
              helperText="ID for virtual/stub service"
            />
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Test Mode</InputLabel>
                  <Select
                    value={endpointFormData.test_mode}
                    label="Test Mode"
                    onChange={(e) => setEndpointFormData({ ...endpointFormData, test_mode: e.target.value })}
                  >
                    {TEST_MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={endpointFormData.enabled}
                      onChange={(e) => setEndpointFormData({ ...endpointFormData, enabled: e.target.checked })}
                    />
                  }
                  label="Enabled"
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEndpointDialog}>Cancel</Button>
          <Button onClick={handleSaveEndpoint} variant="contained" disabled={!endpointFormData.env_instance_id}>
            {editingEndpoint ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteDialog.type} &quot;{deleteDialog.name}&quot;?
            {deleteDialog.type === 'interface' && ' This will also delete all associated endpoints.'}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
