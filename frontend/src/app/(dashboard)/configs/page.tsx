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
  Collapse,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Grid,
  Card,
  CardContent,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Settings as SettingsIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { configsAPI, applicationsAPI, environmentsAPI, componentInstancesAPI, interfacesAPI } from '@/lib/api';

interface Application {
  application_id: string;
  name: string;
}

interface Environment {
  env_instance_id: string;
  name: string;
  environment_name?: string;
}

interface ComponentInstance {
  component_instance_id: string;
  component_name?: string;
  application_name?: string;
  env_instance_name?: string;
  environment_name?: string;
}

interface InterfaceEndpoint {
  interface_endpoint_id: string;
  endpoint?: string;
  interface_name?: string;
  env_instance_name?: string;
  environment_name?: string;
}

interface ConfigItem {
  config_item_id: string;
  config_set_id: string;
  key: string;
  value: string;
  data_type: string;
  description: string | null;
}

interface ConfigSet {
  config_set_id: string;
  name: string;
  scope_type: string;
  scope_ref_id: string;
  scope_entity_name: string | null;
  parent_name: string | null;
  version: string;
  status: string;
  created_by_name: string | null;
  item_count: number;
  items?: ConfigItem[];
}

interface ConfigSetFormData {
  name: string;
  scope_type: string;
  scope_ref_id: string;
  version: string;
  status: string;
}

interface ConfigItemFormData {
  key: string;
  value: string;
  data_type: string;
  description: string;
}

const SCOPE_TYPES = ['Application', 'EnvironmentInstance', 'ComponentInstance', 'InterfaceEndpoint'];
const STATUSES = ['Draft', 'Active', 'Deprecated'];
const DATA_TYPES = ['String', 'Int', 'Boolean', 'JSON', 'SecretRef'];

export default function ConfigsPage() {
  const [configSets, setConfigSets] = useState<ConfigSet[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [componentInstances, setComponentInstances] = useState<ComponentInstance[]>([]);
  const [interfaceEndpoints, setInterfaceEndpoints] = useState<InterfaceEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  // Config Set Dialog
  const [openSetDialog, setOpenSetDialog] = useState(false);
  const [editingSet, setEditingSet] = useState<ConfigSet | null>(null);
  const [setFormData, setSetFormData] = useState<ConfigSetFormData>({
    name: '',
    scope_type: 'Application',
    scope_ref_id: '',
    version: '1.0',
    status: 'Draft',
  });

  // Config Item Dialog
  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<ConfigItem | null>(null);
  const [currentSetId, setCurrentSetId] = useState<string | null>(null);
  const [itemFormData, setItemFormData] = useState<ConfigItemFormData>({
    key: '',
    value: '',
    data_type: 'String',
    description: '',
  });

  // Delete Dialog
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    type: 'set' | 'item';
    id: string | null;
    setId?: string | null;
    name: string;
  }>({ open: false, type: 'set', id: null, setId: null, name: '' });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [configsRes, appsRes, envsRes, compInstancesRes, endpointsRes] = await Promise.all([
        configsAPI.getAll(),
        applicationsAPI.getAll(),
        environmentsAPI.getAllInstances(),
        componentInstancesAPI.getAll(),
        interfacesAPI.getAllEndpoints(),
      ]);
      setConfigSets(configsRes.data.configSets || []);
      setApplications(appsRes.data.applications || []);
      setEnvironments(envsRes.data.instances || []);
      setComponentInstances(compInstancesRes.data.componentInstances || []);
      setInterfaceEndpoints(endpointsRes.data.endpoints || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleRowExpansion = async (setId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(setId)) {
      newExpanded.delete(setId);
    } else {
      newExpanded.add(setId);
      const cs = configSets.find((s: ConfigSet) => s.config_set_id === setId);
      if (cs && !cs.items) {
        try {
          const response = await configsAPI.getItems(setId);
          setConfigSets((prev: ConfigSet[]) =>
            prev.map((s: ConfigSet) =>
              s.config_set_id === setId ? { ...s, items: response.data.items || [] } : s
            )
          );
        } catch (err) {
          console.error('Failed to fetch items:', err);
        }
      }
    }
    setExpandedRows(newExpanded);
  };

  // Config Set handlers
  const handleOpenSetDialog = (configSet?: ConfigSet) => {
    if (configSet) {
      setEditingSet(configSet);
      setSetFormData({
        name: configSet.name,
        scope_type: configSet.scope_type || 'Application',
        scope_ref_id: configSet.scope_ref_id || '',
        version: configSet.version || '1.0',
        status: configSet.status || 'Draft',
      });
    } else {
      setEditingSet(null);
      setSetFormData({
        name: '',
        scope_type: 'Application',
        scope_ref_id: applications.length > 0 ? applications[0].application_id : '',
        version: '1.0',
        status: 'Draft',
      });
    }
    setOpenSetDialog(true);
  };

  const handleCloseSetDialog = () => {
    setOpenSetDialog(false);
    setEditingSet(null);
  };

  const handleSaveSet = async () => {
    try {
      if (editingSet) {
        await configsAPI.update(editingSet.config_set_id, setFormData);
      } else {
        await configsAPI.create(setFormData);
      }
      handleCloseSetDialog();
      fetchData();
    } catch (err) {
      setError('Failed to save configuration set');
      console.error(err);
    }
  };

  // Config Item handlers
  const handleOpenItemDialog = (setId: string, item?: ConfigItem) => {
    setCurrentSetId(setId);
    if (item) {
      setEditingItem(item);
      setItemFormData({
        key: item.key,
        value: item.value,
        data_type: item.data_type || 'String',
        description: item.description || '',
      });
    } else {
      setEditingItem(null);
      setItemFormData({
        key: '',
        value: '',
        data_type: 'String',
        description: '',
      });
    }
    setOpenItemDialog(true);
  };

  const handleCloseItemDialog = () => {
    setOpenItemDialog(false);
    setEditingItem(null);
    setCurrentSetId(null);
  };

  const handleSaveItem = async () => {
    if (!currentSetId) return;

    try {
      if (editingItem) {
        await configsAPI.updateItem(currentSetId, editingItem.config_item_id, itemFormData);
      } else {
        await configsAPI.createItem(currentSetId, itemFormData);
      }
      handleCloseItemDialog();
      
      const response = await configsAPI.getItems(currentSetId);
      setConfigSets((prev: ConfigSet[]) =>
        prev.map((s: ConfigSet) =>
          s.config_set_id === currentSetId ? { ...s, items: response.data.items || [] } : s
        )
      );
      fetchData();
    } catch (err) {
      setError('Failed to save configuration item');
      console.error(err);
    }
  };

  // Delete handlers
  const handleOpenDeleteDialog = (type: 'set' | 'item', id: string, name: string, setId?: string) => {
    setDeleteDialog({ open: true, type, id, setId: setId || null, name });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, type: 'set', id: null, setId: null, name: '' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      if (deleteDialog.type === 'set') {
        await configsAPI.delete(deleteDialog.id);
        fetchData();
      } else if (deleteDialog.setId) {
        await configsAPI.deleteItem(deleteDialog.setId, deleteDialog.id);
        const response = await configsAPI.getItems(deleteDialog.setId);
        setConfigSets((prev: ConfigSet[]) =>
          prev.map((s: ConfigSet) =>
            s.config_set_id === deleteDialog.setId ? { ...s, items: response.data.items || [] } : s
          )
        );
        fetchData();
      }
      handleCloseDeleteDialog();
    } catch (err) {
      setError(`Failed to delete ${deleteDialog.type}`);
      console.error(err);
    }
  };

  const getDataTypeColor = (dataType: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      String: 'primary',
      Int: 'secondary',
      Boolean: 'success',
      JSON: 'warning',
      SecretRef: 'error',
    };
    return colors[dataType] || 'default';
  };

  const getStatusColor = (status: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      Draft: 'default',
      Active: 'success',
      Deprecated: 'warning',
    };
    return colors[status] || 'default';
  };

  const getScopeTypeColor = (scopeType: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      Application: 'primary',
      EnvironmentInstance: 'success',
      ComponentInstance: 'secondary',
      InterfaceEndpoint: 'warning',
    };
    return colors[scopeType] || 'default';
  };

  // Get available scope options based on scope type
  const getScopeOptions = () => {
    switch (setFormData.scope_type) {
      case 'Application':
        return applications.map((app: Application) => ({ id: app.application_id, label: app.name }));
      case 'EnvironmentInstance':
        return environments.map((env: Environment) => ({ 
          id: env.env_instance_id, 
          label: `${env.environment_name || 'Unknown'} / ${env.name}` 
        }));
      case 'ComponentInstance':
        return componentInstances.map((ci: ComponentInstance) => ({ 
          id: ci.component_instance_id, 
          label: `${ci.application_name || 'Unknown'} / ${ci.component_name || 'Unknown'} (${ci.env_instance_name || 'Unknown'})` 
        }));
      case 'InterfaceEndpoint':
        return interfaceEndpoints.map((ep: InterfaceEndpoint) => ({ 
          id: ep.interface_endpoint_id, 
          label: `${ep.interface_name || 'Unknown'} / ${ep.env_instance_name || ep.environment_name || ep.endpoint || 'Endpoint'}` 
        }));
      default:
        return [];
    }
  };

  const stats = {
    total: configSets.length,
    byStatus: STATUSES.reduce((acc, status) => {
      acc[status] = configSets.filter((cs: ConfigSet) => cs.status === status).length;
      return acc;
    }, {} as Record<string, number>),
    totalItems: configSets.reduce((sum: number, cs: ConfigSet) => sum + (cs.item_count || 0), 0),
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <SettingsIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Configuration Management
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpenSetDialog()}>
          Add Config Set
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
              <Typography color="text.secondary" gutterBottom>Total Config Sets</Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Active</Typography>
              <Typography variant="h4" color="success.main">{stats.byStatus['Active'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Draft</Typography>
              <Typography variant="h4">{stats.byStatus['Draft'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>Total Items</Typography>
              <Typography variant="h4">{stats.totalItems}</Typography>
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
              <TableCell>Scope</TableCell>
              <TableCell>Linked To</TableCell>
              <TableCell>Version</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Items</TableCell>
              <TableCell width={120}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} align="center">Loading...</TableCell>
              </TableRow>
            ) : configSets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} align="center">
                  No configuration sets found. Click &quot;Add Config Set&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              configSets.map((configSet: ConfigSet) => (
                <React.Fragment key={configSet.config_set_id}>
                  <TableRow hover>
                    <TableCell>
                      <IconButton size="small" onClick={() => toggleRowExpansion(configSet.config_set_id)}>
                        {expandedRows.has(configSet.config_set_id) ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body1" fontWeight="medium">{configSet.name}</Typography>
                      {configSet.created_by_name && (
                        <Typography variant="caption" color="text.secondary">by {configSet.created_by_name}</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip label={configSet.scope_type} color={getScopeTypeColor(configSet.scope_type)} size="small" />
                    </TableCell>
                    <TableCell>
                      {configSet.scope_entity_name ? (
                        <Box>
                          <Typography variant="body2">{configSet.scope_entity_name}</Typography>
                          {configSet.parent_name && (
                            <Typography variant="caption" color="text.secondary">({configSet.parent_name})</Typography>
                          )}
                        </Box>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          {configSet.scope_ref_id.substring(0, 8)}...
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{configSet.version}</TableCell>
                    <TableCell>
                      <Chip label={configSet.status} color={getStatusColor(configSet.status)} size="small" />
                    </TableCell>
                    <TableCell>
                      <Chip label={configSet.item_count || 0} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Tooltip title="Edit">
                        <IconButton size="small" onClick={() => handleOpenSetDialog(configSet)}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog('set', configSet.config_set_id, configSet.name)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell colSpan={8} sx={{ py: 0 }}>
                      <Collapse in={expandedRows.has(configSet.config_set_id)} timeout="auto" unmountOnExit>
                        <Box sx={{ p: 2, bgcolor: 'grey.50' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="subtitle2">Configuration Items</Typography>
                            <Button size="small" startIcon={<AddIcon />} onClick={() => handleOpenItemDialog(configSet.config_set_id)}>
                              Add Item
                            </Button>
                          </Box>
                          {configSet.items && configSet.items.length > 0 ? (
                            <List dense>
                              {configSet.items.map((item: ConfigItem, index: number) => (
                                <React.Fragment key={item.config_item_id}>
                                  {index > 0 && <Divider />}
                                  <ListItem>
                                    <ListItemText
                                      primary={
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                          <Typography variant="body2" fontWeight="medium">{item.key}</Typography>
                                          <Chip label={item.data_type} size="small" color={getDataTypeColor(item.data_type)} />
                                        </Box>
                                      }
                                      secondary={
                                        <>
                                          <Typography variant="body2" color="text.secondary" component="span">
                                            Value: {item.data_type === 'SecretRef' ? '••••••••' : item.value}
                                          </Typography>
                                          {item.description && (
                                            <Typography variant="caption" display="block" color="text.secondary">
                                              {item.description}
                                            </Typography>
                                          )}
                                        </>
                                      }
                                    />
                                    <ListItemSecondaryAction>
                                      <IconButton size="small" onClick={() => handleOpenItemDialog(configSet.config_set_id, item)}>
                                        <EditIcon fontSize="small" />
                                      </IconButton>
                                      <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog('item', item.config_item_id, item.key, configSet.config_set_id)}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </ListItemSecondaryAction>
                                  </ListItem>
                                </React.Fragment>
                              ))}
                            </List>
                          ) : (
                            <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>
                              No configuration items. Click &quot;Add Item&quot; to create one.
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

      {/* Config Set Dialog */}
      <Dialog open={openSetDialog} onClose={handleCloseSetDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingSet ? 'Edit Configuration Set' : 'Create Configuration Set'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={setFormData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetFormData({ ...setFormData, name: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Scope Type</InputLabel>
              <Select
                value={setFormData.scope_type}
                label="Scope Type"
                onChange={(e) => setSetFormData({ ...setFormData, scope_type: e.target.value, scope_ref_id: '' })}
              >
                {SCOPE_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <Autocomplete
              options={getScopeOptions()}
              getOptionLabel={(option) => option.label}
              value={getScopeOptions().find((o) => o.id === setFormData.scope_ref_id) || null}
              onChange={(_, newValue) => setSetFormData({ ...setFormData, scope_ref_id: newValue?.id || '' })}
              noOptionsText={`No ${setFormData.scope_type}s available`}
              renderInput={(params) => (
                <TextField {...params} label={`Select ${setFormData.scope_type}`} required />
              )}
            />
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField
                  label="Version"
                  value={setFormData.version}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSetFormData({ ...setFormData, version: e.target.value })}
                  fullWidth
                  placeholder="1.0"
                />
              </Grid>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Status</InputLabel>
                  <Select
                    value={setFormData.status}
                    label="Status"
                    onChange={(e) => setSetFormData({ ...setFormData, status: e.target.value })}
                  >
                    {STATUSES.map((status) => (
                      <MenuItem key={status} value={status}>{status}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseSetDialog}>Cancel</Button>
          <Button onClick={handleSaveSet} variant="contained" disabled={!setFormData.name || !setFormData.scope_ref_id}>
            {editingSet ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Config Item Dialog */}
      <Dialog open={openItemDialog} onClose={handleCloseItemDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingItem ? 'Edit Configuration Item' : 'Add Configuration Item'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Key"
              value={itemFormData.key}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemFormData({ ...itemFormData, key: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Data Type</InputLabel>
              <Select
                value={itemFormData.data_type}
                label="Data Type"
                onChange={(e) => setItemFormData({ ...itemFormData, data_type: e.target.value })}
              >
                {DATA_TYPES.map((type) => (
                  <MenuItem key={type} value={type}>{type}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Value"
              value={itemFormData.value}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemFormData({ ...itemFormData, value: e.target.value })}
              fullWidth
              required
              type={itemFormData.data_type === 'SecretRef' ? 'password' : 'text'}
              multiline={itemFormData.data_type === 'JSON'}
              rows={itemFormData.data_type === 'JSON' ? 4 : 1}
            />
            <TextField
              label="Description"
              value={itemFormData.description}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setItemFormData({ ...itemFormData, description: e.target.value })}
              fullWidth
              multiline
              rows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseItemDialog}>Cancel</Button>
          <Button onClick={handleSaveItem} variant="contained" disabled={!itemFormData.key || !itemFormData.value}>
            {editingItem ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete {deleteDialog.type === 'set' ? 'configuration set' : 'item'} &quot;{deleteDialog.name}&quot;?
            {deleteDialog.type === 'set' && ' This will also delete all associated configuration items.'}
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
