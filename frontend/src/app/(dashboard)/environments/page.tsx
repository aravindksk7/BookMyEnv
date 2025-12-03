'use client';

import React, { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import {
  Box,
  Typography,
  Card,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
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
  LinearProgress,
  Alert,
  Snackbar,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Tooltip,
  Paper,
  Divider,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Computer as InstanceIcon,
  Apps as AppIcon,
  Close as CloseIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  Cable as InterfaceIcon,
  Settings as ConfigIcon,
  Terrain as EnvironmentIcon,
} from '@mui/icons-material';
import { environmentsAPI, applicationsAPI } from '@/lib/api';

// Lazy load the other page components
const ApplicationsContent = lazy(() => import('../applications/page'));
const InterfacesContent = lazy(() => import('../interfaces/page'));
const ConfigsContent = lazy(() => import('../configs/page'));

interface Environment {
  environment_id: string;
  name: string;
  environment_category: string;
  description: string;
  lifecycle_stage: string;
  owner_team: string;
  support_group: string;
  data_sensitivity: string;
  instance_count: number;
  created_at: string;
}

interface EnvironmentInstance {
  env_instance_id: string;
  environment_id: string;
  name: string;
  operational_status: string;
  availability_window: string;
  capacity: string;
  primary_location: string;
  bookable: boolean;
  infra_count: number;
  component_count: number;
}

interface Application {
  application_id: string;
  name: string;
  business_domain: string;
  criticality: string;
}

interface AppEnvironmentInstance {
  app_env_instance_id: string;
  application_id: string;
  application_name: string;
  env_instance_id: string;
  deployment_model: string;
  version: string;
  deployment_status: string;
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
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

// Main Tab Panel for top-level navigation
function MainTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box>{children}</Box>}
    </div>
  );
}

export default function EnvironmentsPage() {
  // Main navigation tab
  const [mainTabValue, setMainTabValue] = useState(0);
  
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [relatedConfigs, setRelatedConfigs] = useState<any[]>([]);
  const [relatedInterfaces, setRelatedInterfaces] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [instanceDialogOpen, setInstanceDialogOpen] = useState(false);
  const [editInstanceDialogOpen, setEditInstanceDialogOpen] = useState(false);
  const [deleteInstanceDialogOpen, setDeleteInstanceDialogOpen] = useState(false);
  const [appLinkDialogOpen, setAppLinkDialogOpen] = useState(false);
  const [editAppLinkDialogOpen, setEditAppLinkDialogOpen] = useState(false);
  const [deleteAppLinkDialogOpen, setDeleteAppLinkDialogOpen] = useState(false);
  const [selectedEnv, setSelectedEnv] = useState<Environment | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<EnvironmentInstance | null>(null);
  const [selectedAppEnvInstance, setSelectedAppEnvInstance] = useState<AppEnvironmentInstance | null>(null);
  const [instances, setInstances] = useState<EnvironmentInstance[]>([]);
  const [appEnvInstances, setAppEnvInstances] = useState<AppEnvironmentInstance[]>([]);
  const [tabValue, setTabValue] = useState(0);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });
  
  const [formData, setFormData] = useState({
    name: '',
    environment_category: 'NonProd',
    description: '',
    lifecycle_stage: 'Active',
    owner_team: '',
    support_group: '',
    data_sensitivity: 'NonProdDummy',
  });

  const [instanceFormData, setInstanceFormData] = useState({
    name: '',
    operational_status: 'Available',
    availability_window: '24x7',
    capacity: 10,
    primary_location: '',
    bookable: true,
  });

  const [appLinkFormData, setAppLinkFormData] = useState({
    application_id: '',
    deployment_model: 'Microservices',
    version: '',
    deployment_status: 'Aligned',
  });

  const fetchEnvironments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await environmentsAPI.getAll();
      setEnvironments(response.data.environments || []);
    } catch (error) {
      console.error('Failed to fetch environments:', error);
      showSnackbar('Failed to fetch environments', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchApplications = useCallback(async () => {
    try {
      const response = await applicationsAPI.getAll();
      setApplications(response.data.applications || []);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    }
  }, []);

  useEffect(() => {
    fetchEnvironments();
    fetchApplications();
  }, [fetchEnvironments, fetchApplications]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const resetForm = () => {
    setFormData({
      name: '',
      environment_category: 'NonProd',
      description: '',
      lifecycle_stage: 'Active',
      owner_team: '',
      support_group: '',
      data_sensitivity: 'NonProdDummy',
    });
  };

  // CREATE Environment
  const handleCreateEnvironment = async () => {
    try {
      await environmentsAPI.create(formData);
      setDialogOpen(false);
      resetForm();
      fetchEnvironments();
      showSnackbar('Environment created successfully', 'success');
    } catch (error: any) {
      console.error('Failed to create environment:', error);
      showSnackbar(error.response?.data?.error || 'Failed to create environment', 'error');
    }
  };

  // VIEW Environment
  const handleViewEnvironment = async (env: Environment) => {
    setSelectedEnv(env);
    setTabValue(0);
    setRelatedConfigs([]);
    setRelatedInterfaces([]);
    setInstances([]);
    setAppEnvInstances([]);
    setViewDialogOpen(true);
    
    try {
      // Fetch instances
      const instanceResponse = await environmentsAPI.getInstances(env.environment_id);
      setInstances(instanceResponse.data.instances || []);
      
      // Fetch linked applications
      const appResponse = await environmentsAPI.getAppEnvInstances(env.environment_id);
      setAppEnvInstances(appResponse.data.appEnvInstances || []);
      
      // Fetch related configs and interfaces
      const [configsRes, interfacesRes] = await Promise.all([
        environmentsAPI.getRelatedConfigs(env.environment_id),
        environmentsAPI.getRelatedInterfaces(env.environment_id)
      ]);
      setRelatedConfigs(configsRes.data.configs || []);
      setRelatedInterfaces(interfacesRes.data.interfaces || []);
    } catch (error) {
      console.error('Failed to fetch environment details:', error);
    }
  };

  // EDIT Environment
  const handleEditClick = (env: Environment) => {
    setSelectedEnv(env);
    setFormData({
      name: env.name,
      environment_category: env.environment_category || 'NonProd',
      description: env.description || '',
      lifecycle_stage: env.lifecycle_stage || 'Active',
      owner_team: env.owner_team || '',
      support_group: env.support_group || '',
      data_sensitivity: env.data_sensitivity || 'NonProdDummy',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateEnvironment = async () => {
    if (!selectedEnv) return;
    try {
      await environmentsAPI.update(selectedEnv.environment_id, formData);
      setEditDialogOpen(false);
      resetForm();
      fetchEnvironments();
      showSnackbar('Environment updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update environment:', error);
      showSnackbar(error.response?.data?.error || 'Failed to update environment', 'error');
    }
  };

  // DELETE Environment
  const handleDeleteClick = (env: Environment) => {
    setSelectedEnv(env);
    setDeleteDialogOpen(true);
  };

  const handleDeleteEnvironment = async () => {
    if (!selectedEnv) return;
    try {
      await environmentsAPI.delete(selectedEnv.environment_id);
      setDeleteDialogOpen(false);
      setSelectedEnv(null);
      fetchEnvironments();
      showSnackbar('Environment deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete environment:', error);
      showSnackbar(error.response?.data?.error || 'Failed to delete environment', 'error');
    }
  };

  // CREATE Instance
  const handleCreateInstance = async () => {
    if (!selectedEnv) return;
    try {
      await environmentsAPI.createInstance(selectedEnv.environment_id, instanceFormData);
      setInstanceDialogOpen(false);
      setInstanceFormData({
        name: '',
        operational_status: 'Available',
        availability_window: '24x7',
        capacity: 'Low',
        primary_location: '',
        bookable: true,
      });
      // Refresh instances
      const instanceResponse = await environmentsAPI.getInstances(selectedEnv.environment_id);
      setInstances(instanceResponse.data.instances || []);
      fetchEnvironments(); // Update instance count
      showSnackbar('Instance created successfully', 'success');
    } catch (error: any) {
      console.error('Failed to create instance:', error);
      showSnackbar(error.response?.data?.error || 'Failed to create instance', 'error');
    }
  };

  // EDIT Instance
  const handleEditInstanceClick = (instance: EnvironmentInstance) => {
    setSelectedInstance(instance);
    setInstanceFormData({
      name: instance.name,
      operational_status: instance.operational_status || 'Available',
      availability_window: instance.availability_window || '24x7',
      capacity: instance.capacity || 10,
      primary_location: instance.primary_location || '',
      bookable: instance.bookable !== false,
    });
    setEditInstanceDialogOpen(true);
  };

  const handleUpdateInstance = async () => {
    if (!selectedEnv || !selectedInstance) return;
    try {
      await environmentsAPI.updateInstance(selectedEnv.environment_id, selectedInstance.env_instance_id, instanceFormData);
      setEditInstanceDialogOpen(false);
      setInstanceFormData({
        name: '',
        operational_status: 'Available',
        availability_window: '24x7',
        capacity: 10,
        primary_location: '',
        bookable: true,
      });
      // Refresh instances
      const instanceResponse = await environmentsAPI.getInstances(selectedEnv.environment_id);
      setInstances(instanceResponse.data.instances || []);
      showSnackbar('Instance updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update instance:', error);
      showSnackbar(error.response?.data?.error || 'Failed to update instance', 'error');
    }
  };

  // DELETE Instance
  const handleDeleteInstanceClick = (instance: EnvironmentInstance) => {
    setSelectedInstance(instance);
    setDeleteInstanceDialogOpen(true);
  };

  const handleDeleteInstance = async () => {
    if (!selectedEnv || !selectedInstance) return;
    try {
      await environmentsAPI.deleteInstance(selectedEnv.environment_id, selectedInstance.env_instance_id);
      setDeleteInstanceDialogOpen(false);
      setSelectedInstance(null);
      // Refresh instances
      const instanceResponse = await environmentsAPI.getInstances(selectedEnv.environment_id);
      setInstances(instanceResponse.data.instances || []);
      // Refresh app instances as they may be affected
      const appResponse = await environmentsAPI.getAppEnvInstances(selectedEnv.environment_id);
      setAppEnvInstances(appResponse.data.appEnvInstances || []);
      fetchEnvironments(); // Update instance count
      showSnackbar('Instance deleted successfully', 'success');
    } catch (error: any) {
      console.error('Failed to delete instance:', error);
      showSnackbar(error.response?.data?.error || 'Failed to delete instance', 'error');
    }
  };

  // Link Application to Instance
  const handleLinkApplication = async () => {
    if (!selectedInstance) return;
    try {
      await environmentsAPI.linkApplicationToInstance(selectedInstance.env_instance_id, appLinkFormData);
      setAppLinkDialogOpen(false);
      setAppLinkFormData({
        application_id: '',
        deployment_model: 'Microservices',
        version: '',
        deployment_status: 'Aligned',
      });
      // Refresh app instances
      if (selectedEnv) {
        const appResponse = await environmentsAPI.getAppEnvInstances(selectedEnv.environment_id);
        setAppEnvInstances(appResponse.data.appEnvInstances || []);
      }
      showSnackbar('Application linked successfully', 'success');
    } catch (error: any) {
      console.error('Failed to link application:', error);
      showSnackbar(error.response?.data?.error || 'Failed to link application', 'error');
    }
  };

  // EDIT App Link
  const handleEditAppLinkClick = (appEnvInstance: AppEnvironmentInstance) => {
    setSelectedAppEnvInstance(appEnvInstance);
    setAppLinkFormData({
      application_id: appEnvInstance.application_id,
      deployment_model: appEnvInstance.deployment_model || 'Microservices',
      version: appEnvInstance.version || '',
      deployment_status: appEnvInstance.deployment_status || 'Aligned',
    });
    setEditAppLinkDialogOpen(true);
  };

  const handleUpdateAppLink = async () => {
    if (!selectedAppEnvInstance) return;
    try {
      await environmentsAPI.updateAppEnvInstance(selectedAppEnvInstance.app_env_instance_id, {
        deployment_model: appLinkFormData.deployment_model,
        version: appLinkFormData.version,
        deployment_status: appLinkFormData.deployment_status,
      });
      setEditAppLinkDialogOpen(false);
      setAppLinkFormData({
        application_id: '',
        deployment_model: 'Microservices',
        version: '',
        deployment_status: 'Aligned',
      });
      // Refresh app instances
      if (selectedEnv) {
        const appResponse = await environmentsAPI.getAppEnvInstances(selectedEnv.environment_id);
        setAppEnvInstances(appResponse.data.appEnvInstances || []);
      }
      showSnackbar('Application link updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update application link:', error);
      showSnackbar(error.response?.data?.error || 'Failed to update application link', 'error');
    }
  };

  // DELETE App Link
  const handleDeleteAppLinkClick = (appEnvInstance: AppEnvironmentInstance) => {
    setSelectedAppEnvInstance(appEnvInstance);
    setDeleteAppLinkDialogOpen(true);
  };

  const handleDeleteAppLink = async () => {
    if (!selectedAppEnvInstance) return;
    try {
      await environmentsAPI.deleteAppEnvInstance(selectedAppEnvInstance.app_env_instance_id);
      setDeleteAppLinkDialogOpen(false);
      setSelectedAppEnvInstance(null);
      // Refresh app instances
      if (selectedEnv) {
        const appResponse = await environmentsAPI.getAppEnvInstances(selectedEnv.environment_id);
        setAppEnvInstances(appResponse.data.appEnvInstances || []);
      }
      showSnackbar('Application unlinked successfully', 'success');
    } catch (error: any) {
      console.error('Failed to unlink application:', error);
      showSnackbar(error.response?.data?.error || 'Failed to unlink application', 'error');
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' } = {
      E2E: 'primary',
      Integration: 'secondary',
      Performance: 'warning',
      UAT: 'success',
      Staging: 'info',
      Production: 'error',
    };
    return colors[category] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'default' } = {
      Available: 'success',
      InUse: 'warning',
      Maintenance: 'error',
      Reserved: 'default',
      Active: 'success',
      Deprecated: 'warning',
      Retired: 'error',
    };
    return colors[status] || 'default';
  };

  if (loading && mainTabValue === 0) {
    return <LinearProgress />;
  }

  // Environments content (original page content)
  const EnvironmentsContent = () => (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 600 }}>
          Environments
        </Typography>
        <Box>
          <IconButton onClick={fetchEnvironments} sx={{ mr: 1 }}>
            <RefreshIcon />
          </IconButton>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setDialogOpen(true)}
          >
            New Environment
          </Button>
        </Box>
      </Box>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Category</TableCell>
                <TableCell>Lifecycle</TableCell>
                <TableCell>Owner Team</TableCell>
                <TableCell align="center">Instances</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {environments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No environments found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                environments.map((env) => (
                  <TableRow key={env.environment_id} hover>
                    <TableCell>
                      <Typography fontWeight={500}>{env.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {env.description || 'No description'}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={env.environment_category || 'N/A'} 
                        size="small" 
                        color={getCategoryColor(env.environment_category)} 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={env.lifecycle_stage || 'Active'}
                        size="small"
                        color={getStatusColor(env.lifecycle_stage)}
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>{env.owner_team || '-'}</TableCell>
                    <TableCell align="center">
                      <Chip 
                        icon={<InstanceIcon />} 
                        label={env.instance_count || 0} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton 
                          size="small" 
                          color="primary"
                          onClick={() => handleViewEnvironment(env)}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small"
                          onClick={() => handleEditClick(env)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeleteClick(env)}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>
    </>
  );

  return (
    <Box>
      {/* Main Navigation Tabs */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={mainTabValue} 
          onChange={(_, v) => setMainTabValue(v)}
          variant="fullWidth"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Environments" icon={<EnvironmentIcon />} iconPosition="start" />
          <Tab label="Applications" icon={<AppIcon />} iconPosition="start" />
          <Tab label="Interfaces" icon={<InterfaceIcon />} iconPosition="start" />
          <Tab label="Configs" icon={<ConfigIcon />} iconPosition="start" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <MainTabPanel value={mainTabValue} index={0}>
        <EnvironmentsContent />
      </MainTabPanel>
      
      <MainTabPanel value={mainTabValue} index={1}>
        <Suspense fallback={<LinearProgress />}>
          <ApplicationsContent />
        </Suspense>
      </MainTabPanel>
      
      <MainTabPanel value={mainTabValue} index={2}>
        <Suspense fallback={<LinearProgress />}>
          <InterfacesContent />
        </Suspense>
      </MainTabPanel>
      
      <MainTabPanel value={mainTabValue} index={3}>
        <Suspense fallback={<LinearProgress />}>
          <ConfigsContent />
        </Suspense>
      </MainTabPanel>

      {/* Create Environment Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Environment</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.environment_category}
              label="Category"
              onChange={(e) => setFormData({ ...formData, environment_category: e.target.value })}
            >
              <MenuItem value="NonProd">NonProd</MenuItem>
              <MenuItem value="PreProd">PreProd</MenuItem>
              <MenuItem value="DR">DR</MenuItem>
              <MenuItem value="Training">Training</MenuItem>
              <MenuItem value="Sandpit">Sandpit</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Lifecycle Stage</InputLabel>
            <Select
              value={formData.lifecycle_stage}
              label="Lifecycle Stage"
              onChange={(e) => setFormData({ ...formData, lifecycle_stage: e.target.value })}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Deprecated">Deprecated</MenuItem>
              <MenuItem value="Retired">Retired</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Owner Team"
            fullWidth
            margin="normal"
            value={formData.owner_team}
            onChange={(e) => setFormData({ ...formData, owner_team: e.target.value })}
          />
          <TextField
            label="Support Group"
            fullWidth
            margin="normal"
            value={formData.support_group}
            onChange={(e) => setFormData({ ...formData, support_group: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Data Sensitivity</InputLabel>
            <Select
              value={formData.data_sensitivity}
              label="Data Sensitivity"
              onChange={(e) => setFormData({ ...formData, data_sensitivity: e.target.value })}
            >
              <MenuItem value="PII">PII</MenuItem>
              <MenuItem value="PCI">PCI</MenuItem>
              <MenuItem value="Confidential">Confidential</MenuItem>
              <MenuItem value="NonProdDummy">Non-Prod Dummy</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateEnvironment} disabled={!formData.name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Environment Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Environment</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Category</InputLabel>
            <Select
              value={formData.environment_category}
              label="Category"
              onChange={(e) => setFormData({ ...formData, environment_category: e.target.value })}
            >
              <MenuItem value="NonProd">NonProd</MenuItem>
              <MenuItem value="PreProd">PreProd</MenuItem>
              <MenuItem value="DR">DR</MenuItem>
              <MenuItem value="Training">Training</MenuItem>
              <MenuItem value="Sandpit">Sandpit</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Lifecycle Stage</InputLabel>
            <Select
              value={formData.lifecycle_stage}
              label="Lifecycle Stage"
              onChange={(e) => setFormData({ ...formData, lifecycle_stage: e.target.value })}
            >
              <MenuItem value="Active">Active</MenuItem>
              <MenuItem value="Deprecated">Deprecated</MenuItem>
              <MenuItem value="Retired">Retired</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <TextField
            label="Owner Team"
            fullWidth
            margin="normal"
            value={formData.owner_team}
            onChange={(e) => setFormData({ ...formData, owner_team: e.target.value })}
          />
          <TextField
            label="Support Group"
            fullWidth
            margin="normal"
            value={formData.support_group}
            onChange={(e) => setFormData({ ...formData, support_group: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Data Sensitivity</InputLabel>
            <Select
              value={formData.data_sensitivity}
              label="Data Sensitivity"
              onChange={(e) => setFormData({ ...formData, data_sensitivity: e.target.value })}
            >
              <MenuItem value="PII">PII</MenuItem>
              <MenuItem value="PCI">PCI</MenuItem>
              <MenuItem value="Confidential">Confidential</MenuItem>
              <MenuItem value="NonProdDummy">Non-Prod Dummy</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateEnvironment} disabled={!formData.name}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Environment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedEnv?.name}</strong>? 
            This will also delete all associated instances and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteEnvironment}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Environment Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)} 
        maxWidth="md" 
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            {selectedEnv?.name}
            <Chip 
              label={selectedEnv?.environment_category} 
              size="small" 
              color={getCategoryColor(selectedEnv?.environment_category || '')}
              sx={{ ml: 2 }}
            />
          </Box>
          <IconButton onClick={() => setViewDialogOpen(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              {selectedEnv?.description || 'No description'}
            </Typography>
            <Box sx={{ mt: 1, display: 'flex', gap: 2 }}>
              <Typography variant="caption">
                <strong>Owner:</strong> {selectedEnv?.owner_team || 'N/A'}
              </Typography>
              <Typography variant="caption">
                <strong>Support:</strong> {selectedEnv?.support_group || 'N/A'}
              </Typography>
              <Typography variant="caption">
                <strong>Data Sensitivity:</strong> {selectedEnv?.data_sensitivity || 'N/A'}
              </Typography>
            </Box>
          </Box>
          
          <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)}>
            <Tab label={`Instances (${instances.length})`} icon={<InstanceIcon />} iconPosition="start" />
            <Tab label={`Applications (${appEnvInstances.length})`} icon={<AppIcon />} iconPosition="start" />
            <Tab label={`Interfaces (${relatedInterfaces.length})`} icon={<InterfaceIcon />} iconPosition="start" />
            <Tab label={`Configs (${relatedConfigs.length})`} icon={<ConfigIcon />} iconPosition="start" />
          </Tabs>

          <TabPanel value={tabValue} index={0}>
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                size="small"
                onClick={() => setInstanceDialogOpen(true)}
              >
                Add Instance
              </Button>
            </Box>
            {instances.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <StorageIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">No instances found</Typography>
                <Typography variant="caption" color="text.secondary">
                  Create an instance to make this environment bookable
                </Typography>
              </Paper>
            ) : (
              <List>
                {instances.map((instance) => (
                  <Paper key={instance.env_instance_id} sx={{ mb: 1 }}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Link Application">
                            <IconButton
                              size="small"
                              color="primary"
                              onClick={() => {
                                setSelectedInstance(instance);
                                setAppLinkDialogOpen(true);
                              }}
                            >
                              <LinkIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Edit Instance">
                            <IconButton
                              size="small"
                              onClick={() => handleEditInstanceClick(instance)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete Instance">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteInstanceClick(instance)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        <InstanceIcon color={instance.bookable ? 'primary' : 'disabled'} />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {instance.name}
                            <Chip 
                              label={instance.operational_status} 
                              size="small" 
                              color={getStatusColor(instance.operational_status)}
                            />
                            {instance.bookable && (
                              <Chip label="Bookable" size="small" variant="outlined" color="success" />
                            )}
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'flex', gap: 2 }}>
                            <span>Capacity: {instance.capacity || 'N/A'}</span>
                            <span>Location: {instance.primary_location || 'N/A'}</span>
                            <span>Availability: {instance.availability_window || 'N/A'}</span>
                          </Box>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={1}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="caption" color="text.secondary">
                Applications linked to this environment's instances
              </Typography>
              {instances.length > 0 && (
                <Button
                  variant="outlined"
                  startIcon={<LinkIcon />}
                  size="small"
                  onClick={() => {
                    setSelectedInstance(instances[0]);
                    setAppLinkDialogOpen(true);
                  }}
                >
                  Link Application
                </Button>
              )}
            </Box>
            {appEnvInstances.length === 0 ? (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <AppIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">No applications linked</Typography>
                <Typography variant="caption" color="text.secondary">
                  {instances.length === 0 
                    ? 'Create an instance first, then link applications to it'
                    : 'Click "Link Application" to add applications to this environment'}
                </Typography>
              </Paper>
            ) : (
              <List>
                {appEnvInstances.map((appInst) => (
                  <Paper key={appInst.app_env_instance_id} sx={{ mb: 1 }}>
                    <ListItem
                      secondaryAction={
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <Tooltip title="Edit Application Link">
                            <IconButton
                              size="small"
                              onClick={() => handleEditAppLinkClick(appInst)}
                            >
                              <EditIcon />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Unlink Application">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteAppLinkClick(appInst)}
                            >
                              <DeleteIcon />
                            </IconButton>
                          </Tooltip>
                        </Box>
                      }
                    >
                      <ListItemIcon>
                        <AppIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {appInst.application_name}
                            <Chip 
                              label={appInst.deployment_status} 
                              size="small" 
                              color={appInst.deployment_status === 'Aligned' ? 'success' : 'warning'}
                            />
                          </Box>
                        }
                        secondary={
                          <Box component="span" sx={{ display: 'flex', gap: 2 }}>
                            <span>Model: {appInst.deployment_model || 'N/A'}</span>
                            <span>Version: {appInst.version || 'N/A'}</span>
                          </Box>
                        }
                      />
                    </ListItem>
                  </Paper>
                ))}
              </List>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={2}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Related Interfaces</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Interfaces with endpoints deployed on this environment's instances
            </Typography>
            {relatedInterfaces.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Instance</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell>Pattern</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell align="center">Endpoints</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedInterfaces.map((iface: any, idx: number) => (
                      <TableRow key={`${iface.interface_id}-${idx}`} hover>
                        <TableCell>{iface.name}</TableCell>
                        <TableCell>{iface.instance_name}</TableCell>
                        <TableCell>
                          <Chip label={iface.direction} size="small" color={iface.direction === 'Inbound' ? 'info' : iface.direction === 'Outbound' ? 'warning' : 'default'} />
                        </TableCell>
                        <TableCell>{iface.pattern}</TableCell>
                        <TableCell>{iface.frequency}</TableCell>
                        <TableCell align="center">{iface.endpoint_count || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <InterfaceIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">No interfaces found</Typography>
                <Typography variant="caption" color="text.secondary">
                  Go to Interfaces page to create interface endpoints for this environment's instances
                </Typography>
              </Paper>
            )}
          </TabPanel>

          <TabPanel value={tabValue} index={3}>
            <Typography variant="subtitle1" sx={{ mb: 2 }}>Related Configurations</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
              Configuration sets scoped to this environment's instances
            </Typography>
            {relatedConfigs.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Instance</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Items</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedConfigs.map((config: any) => (
                      <TableRow key={config.config_set_id} hover>
                        <TableCell>{config.name}</TableCell>
                        <TableCell>{config.instance_name}</TableCell>
                        <TableCell>{config.version}</TableCell>
                        <TableCell>
                          <Chip 
                            label={config.status} 
                            size="small" 
                            color={config.status === 'Active' ? 'success' : config.status === 'Draft' ? 'warning' : 'default'} 
                          />
                        </TableCell>
                        <TableCell align="center">{config.item_count || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <ConfigIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                <Typography color="text.secondary">No configurations found</Typography>
                <Typography variant="caption" color="text.secondary">
                  Go to Configs page to create configuration sets scoped to this environment's instances
                </Typography>
              </Paper>
            )}
          </TabPanel>
        </DialogContent>
      </Dialog>

      {/* Create Instance Dialog */}
      <Dialog open={instanceDialogOpen} onClose={() => setInstanceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Instance to {selectedEnv?.name}</DialogTitle>
        <DialogContent>
          <TextField
            label="Instance Name"
            fullWidth
            margin="normal"
            value={instanceFormData.name}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, name: e.target.value })}
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Operational Status</InputLabel>
            <Select
              value={instanceFormData.operational_status}
              label="Operational Status"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, operational_status: e.target.value })}
            >
              <MenuItem value="Available">Available</MenuItem>
              <MenuItem value="InUse">In Use</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
              <MenuItem value="Reserved">Reserved</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Availability Window</InputLabel>
            <Select
              value={instanceFormData.availability_window}
              label="Availability Window"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, availability_window: e.target.value })}
            >
              <MenuItem value="24x7">24x7</MenuItem>
              <MenuItem value="BusinessHours">Business Hours</MenuItem>
              <MenuItem value="OnDemand">On Demand</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Capacity (number of users)"
            fullWidth
            margin="normal"
            type="number"
            value={instanceFormData.capacity}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, capacity: parseInt(e.target.value) || 10 })}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Primary Location"
            fullWidth
            margin="normal"
            value={instanceFormData.primary_location}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, primary_location: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Bookable</InputLabel>
            <Select
              value={instanceFormData.bookable ? 'yes' : 'no'}
              label="Bookable"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, bookable: e.target.value === 'yes' })}
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInstanceDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateInstance} disabled={!instanceFormData.name}>
            Create Instance
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Application Dialog */}
      <Dialog open={appLinkDialogOpen} onClose={() => setAppLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Application to Instance</DialogTitle>
        <DialogContent>
          {instances.length > 1 && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Select Instance</InputLabel>
              <Select
                value={selectedInstance?.env_instance_id || ''}
                label="Select Instance"
                onChange={(e) => {
                  const inst = instances.find(i => i.env_instance_id === e.target.value);
                  if (inst) setSelectedInstance(inst);
                }}
              >
                {instances.map((inst) => (
                  <MenuItem key={inst.env_instance_id} value={inst.env_instance_id}>
                    {inst.name} ({inst.operational_status})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {instances.length === 1 && (
            <Typography variant="body2" sx={{ mt: 2, mb: 1 }}>
              Linking to instance: <strong>{selectedInstance?.name}</strong>
            </Typography>
          )}
          <FormControl fullWidth margin="normal">
            <InputLabel>Application</InputLabel>
            <Select
              value={appLinkFormData.application_id}
              label="Application"
              onChange={(e) => setAppLinkFormData({ ...appLinkFormData, application_id: e.target.value })}
            >
              {applications.map((app) => (
                <MenuItem key={app.application_id} value={app.application_id}>
                  {app.name} ({app.business_domain || 'No domain'})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Deployment Model</InputLabel>
            <Select
              value={appLinkFormData.deployment_model}
              label="Deployment Model"
              onChange={(e) => setAppLinkFormData({ ...appLinkFormData, deployment_model: e.target.value })}
            >
              <MenuItem value="Monolith">Monolith</MenuItem>
              <MenuItem value="Microservices">Microservices</MenuItem>
              <MenuItem value="SaaS">SaaS</MenuItem>
              <MenuItem value="COTS">COTS</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Version"
            fullWidth
            margin="normal"
            value={appLinkFormData.version}
            onChange={(e) => setAppLinkFormData({ ...appLinkFormData, version: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Deployment Status</InputLabel>
            <Select
              value={appLinkFormData.deployment_status}
              label="Deployment Status"
              onChange={(e) => setAppLinkFormData({ ...appLinkFormData, deployment_status: e.target.value })}
            >
              <MenuItem value="Aligned">Aligned</MenuItem>
              <MenuItem value="Mixed">Mixed</MenuItem>
              <MenuItem value="OutOfSync">Out of Sync</MenuItem>
              <MenuItem value="Broken">Broken</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAppLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkApplication} disabled={!appLinkFormData.application_id || !selectedInstance}>
            Link Application
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Instance Dialog */}
      <Dialog open={editInstanceDialogOpen} onClose={() => setEditInstanceDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Instance: {selectedInstance?.name}</DialogTitle>
        <DialogContent>
          <TextField
            label="Instance Name"
            fullWidth
            margin="normal"
            value={instanceFormData.name}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, name: e.target.value })}
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Operational Status</InputLabel>
            <Select
              value={instanceFormData.operational_status}
              label="Operational Status"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, operational_status: e.target.value })}
            >
              <MenuItem value="Available">Available</MenuItem>
              <MenuItem value="InUse">In Use</MenuItem>
              <MenuItem value="Maintenance">Maintenance</MenuItem>
              <MenuItem value="Reserved">Reserved</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Availability Window</InputLabel>
            <Select
              value={instanceFormData.availability_window}
              label="Availability Window"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, availability_window: e.target.value })}
            >
              <MenuItem value="24x7">24x7</MenuItem>
              <MenuItem value="BusinessHours">Business Hours</MenuItem>
              <MenuItem value="OnDemand">On Demand</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Capacity (number of users)"
            fullWidth
            margin="normal"
            type="number"
            value={instanceFormData.capacity}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, capacity: parseInt(e.target.value) || 10 })}
            inputProps={{ min: 1 }}
          />
          <TextField
            label="Primary Location"
            fullWidth
            margin="normal"
            value={instanceFormData.primary_location}
            onChange={(e) => setInstanceFormData({ ...instanceFormData, primary_location: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Bookable</InputLabel>
            <Select
              value={instanceFormData.bookable ? 'yes' : 'no'}
              label="Bookable"
              onChange={(e) => setInstanceFormData({ ...instanceFormData, bookable: e.target.value === 'yes' })}
            >
              <MenuItem value="yes">Yes</MenuItem>
              <MenuItem value="no">No</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditInstanceDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateInstance} disabled={!instanceFormData.name}>
            Update Instance
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Instance Confirmation Dialog */}
      <Dialog open={deleteInstanceDialogOpen} onClose={() => setDeleteInstanceDialogOpen(false)}>
        <DialogTitle>Delete Instance</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete instance <strong>{selectedInstance?.name}</strong>? 
            This will also remove all application links and cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteInstanceDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteInstance}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Application Link Dialog */}
      <Dialog open={editAppLinkDialogOpen} onClose={() => setEditAppLinkDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Application Link: {selectedAppEnvInstance?.application_name}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Deployment Model</InputLabel>
            <Select
              value={appLinkFormData.deployment_model}
              label="Deployment Model"
              onChange={(e) => setAppLinkFormData({ ...appLinkFormData, deployment_model: e.target.value })}
            >
              <MenuItem value="Monolith">Monolith</MenuItem>
              <MenuItem value="Microservices">Microservices</MenuItem>
              <MenuItem value="SaaS">SaaS</MenuItem>
              <MenuItem value="COTS">COTS</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Version"
            fullWidth
            margin="normal"
            value={appLinkFormData.version}
            onChange={(e) => setAppLinkFormData({ ...appLinkFormData, version: e.target.value })}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Deployment Status</InputLabel>
            <Select
              value={appLinkFormData.deployment_status}
              label="Deployment Status"
              onChange={(e) => setAppLinkFormData({ ...appLinkFormData, deployment_status: e.target.value })}
            >
              <MenuItem value="Aligned">Aligned</MenuItem>
              <MenuItem value="Mixed">Mixed</MenuItem>
              <MenuItem value="OutOfSync">Out of Sync</MenuItem>
              <MenuItem value="Broken">Broken</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditAppLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateAppLink}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Application Link Confirmation Dialog */}
      <Dialog open={deleteAppLinkDialogOpen} onClose={() => setDeleteAppLinkDialogOpen(false)}>
        <DialogTitle>Unlink Application</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to unlink <strong>{selectedAppEnvInstance?.application_name}</strong> from this environment instance?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteAppLinkDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteAppLink}>
            Unlink
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleCloseSnackbar}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert onClose={handleCloseSnackbar} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
