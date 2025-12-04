'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
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
  Chip,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Extension as ComponentIcon,
  Refresh as RefreshIcon,
  Cable as InterfaceIcon,
  Settings as ConfigIcon,
  Storage as TestDataIcon,
  OpenInNew as OpenInNewIcon,
  CloudUpload as DeployIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { applicationsAPI, environmentsAPI } from '../../../lib/api';
import { useAuth } from '../../../contexts/AuthContext';

interface Application {
  application_id: string;
  name: string;
  description: string;
  business_domain: string;
  criticality: string;
  data_sensitivity: string;
  owner_team: string;
  test_owner: string;
  created_at: string;
  updated_at: string;
  component_count?: number;
  deployment_count?: number;
}

interface Component {
  component_id: string;
  application_id: string;
  name: string;
  component_type: string;
  source_repo: string;
  build_pipeline_id: string;
  runtime_platform: string;
  owner_team: string;
  created_at: string;
  updated_at: string;
}

interface RelatedInterface {
  interface_id: string;
  name: string;
  direction: string;
  pattern: string;
  frequency: string;
  external_party: string;
  endpoint_count: number;
}

interface RelatedConfig {
  config_set_id: string;
  name: string;
  scope_type: string;
  version: string;
  status: string;
  item_count: number;
}

interface RelatedTestData {
  test_data_set_id: string;
  name: string;
  data_type: string;
  source_type: string;
  status: string;
}

interface AppInstance {
  app_env_instance_id: string;
  application_id: string;
  env_instance_id: string;
  instance_name: string;
  environment_name: string;
  environment_category: string;
  deployment_model: string;
  version: string;
  deployment_status: string;
  created_at: string;
  updated_at: string;
}

interface EnvironmentInstance {
  env_instance_id: string;
  name: string;
  environment_name: string;
  environment_category: string;
  operational_status: string;
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const COMPONENT_TYPES = ['API', 'UI', 'Batch', 'RuleEngine', 'DBSchema', 'MessageProcessor', 'Job', 'Lambda', 'Other'];
const RUNTIME_PLATFORMS = ['Docker', 'Kubernetes', 'VM', 'Serverless', 'Bare Metal', 'Cloud Function'];
const CRITICALITY_OPTIONS = ['High', 'Medium', 'Low'];
const DATA_SENSITIVITY_OPTIONS = ['PII', 'PCI', 'Confidential', 'NonProdDummy'];
const DEPLOYMENT_MODELS = ['Monolith', 'Microservices', 'SaaS', 'COTS'];
const DEPLOYMENT_STATUSES = ['Aligned', 'Mixed', 'OutOfSync', 'Broken'];

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [components, setComponents] = useState<{ [key: string]: Component[] }>({});
  const [appInstances, setAppInstances] = useState<AppInstance[]>([]);
  const [availableInstances, setAvailableInstances] = useState<EnvironmentInstance[]>([]);
  const [relatedInterfaces, setRelatedInterfaces] = useState<RelatedInterface[]>([]);
  const [relatedConfigs, setRelatedConfigs] = useState<RelatedConfig[]>([]);
  const [relatedTestData, setRelatedTestData] = useState<RelatedTestData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [editComponentDialogOpen, setEditComponentDialogOpen] = useState(false);
  const [deleteComponentDialogOpen, setDeleteComponentDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [editDeployDialogOpen, setEditDeployDialogOpen] = useState(false);
  const [undeployDialogOpen, setUndeployDialogOpen] = useState(false);

  // Selected items
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);
  const [selectedAppInstance, setSelectedAppInstance] = useState<AppInstance | null>(null);

  // View dialog tab
  const [viewTab, setViewTab] = useState(0);

  // Form states - matching database schema
  const [appForm, setAppForm] = useState({
    name: '',
    description: '',
    business_domain: '',
    criticality: '',
    data_sensitivity: '',
    owner_team: '',
    test_owner: '',
  });

  const [componentForm, setComponentForm] = useState({
    name: '',
    component_type: 'API',
    source_repo: '',
    build_pipeline_id: '',
    runtime_platform: 'Docker',
    owner_team: '',
  });

  const [deployForm, setDeployForm] = useState({
    env_instance_id: '',
    deployment_model: '',
    version: '',
    deployment_status: 'Aligned',
  });

  const canEdit = user?.role === 'Admin' || user?.role === 'ProjectLead';
  const canDeploy = user?.role === 'Admin' || user?.role === 'EnvironmentManager';
  const router = useRouter();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const response = await applicationsAPI.getAll();
      // API returns axios response with { data: { applications: [...] } }
      const responseData = response.data;
      const appList = Array.isArray(responseData) ? responseData : responseData.applications || [];
      setApplications(appList);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchComponents = async (appId: string) => {
    try {
      const response = await applicationsAPI.getComponents(appId);
      const responseData = response.data;
      const compList = Array.isArray(responseData) ? responseData : responseData.components || [];
      setComponents((prev: { [key: string]: Component[] }) => ({ ...prev, [appId]: compList }));
    } catch (err: any) {
      console.error('Failed to fetch components:', err);
    }
  };

  const fetchAppInstances = async (appId: string) => {
    try {
      const response = await applicationsAPI.getInstances(appId);
      const responseData = response.data;
      const instanceList = Array.isArray(responseData) ? responseData : responseData.instances || [];
      setAppInstances(instanceList);
    } catch (err: any) {
      console.error('Failed to fetch app instances:', err);
    }
  };

  const fetchAvailableInstances = async () => {
    try {
      const response = await environmentsAPI.getAllInstances();
      const responseData = response.data;
      const instanceList = Array.isArray(responseData) ? responseData : responseData.instances || [];
      setAvailableInstances(instanceList);
    } catch (err: any) {
      console.error('Failed to fetch available instances:', err);
    }
  };

  // Application CRUD handlers
  const handleCreateApp = async () => {
    try {
      await applicationsAPI.create(appForm);
      setSuccess('Application created successfully');
      setCreateDialogOpen(false);
      resetAppForm();
      fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to create application');
    }
  };

  const handleUpdateApp = async () => {
    if (!selectedApp) return;
    try {
      await applicationsAPI.update(selectedApp.application_id, appForm);
      setSuccess('Application updated successfully');
      setEditDialogOpen(false);
      resetAppForm();
      fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to update application');
    }
  };

  const handleDeleteApp = async () => {
    if (!selectedApp) return;
    try {
      await applicationsAPI.delete(selectedApp.application_id);
      setSuccess('Application deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedApp(null);
      fetchApplications();
    } catch (err: any) {
      setError(err.message || 'Failed to delete application');
    }
  };

  // Component CRUD handlers
  const handleCreateComponent = async () => {
    if (!selectedApp) return;
    try {
      await applicationsAPI.createComponent(selectedApp.application_id, componentForm);
      setSuccess('Component created successfully');
      setComponentDialogOpen(false);
      resetComponentForm();
      fetchComponents(selectedApp.application_id);
    } catch (err: any) {
      setError(err.message || 'Failed to create component');
    }
  };

  const handleUpdateComponent = async () => {
    if (!selectedApp || !selectedComponent) return;
    try {
      await applicationsAPI.updateComponent(selectedApp.application_id, selectedComponent.component_id, componentForm);
      setSuccess('Component updated successfully');
      setEditComponentDialogOpen(false);
      resetComponentForm();
      fetchComponents(selectedApp.application_id);
    } catch (err: any) {
      setError(err.message || 'Failed to update component');
    }
  };

  const handleDeleteComponent = async () => {
    if (!selectedApp || !selectedComponent) return;
    try {
      await applicationsAPI.deleteComponent(selectedApp.application_id, selectedComponent.component_id);
      setSuccess('Component deleted successfully');
      setDeleteComponentDialogOpen(false);
      setSelectedComponent(null);
      fetchComponents(selectedApp.application_id);
    } catch (err: any) {
      setError(err.message || 'Failed to delete component');
    }
  };

  // Deployment CRUD handlers
  const handleDeploy = async () => {
    if (!selectedApp) return;
    try {
      await applicationsAPI.createInstance(selectedApp.application_id, deployForm);
      setSuccess('Application deployed successfully');
      setDeployDialogOpen(false);
      resetDeployForm();
      fetchAppInstances(selectedApp.application_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to deploy application');
    }
  };

  const handleUpdateDeploy = async () => {
    if (!selectedApp || !selectedAppInstance) return;
    try {
      await applicationsAPI.updateInstance(selectedApp.application_id, selectedAppInstance.app_env_instance_id, deployForm);
      setSuccess('Deployment updated successfully');
      setEditDeployDialogOpen(false);
      resetDeployForm();
      fetchAppInstances(selectedApp.application_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update deployment');
    }
  };

  const handleUndeploy = async () => {
    if (!selectedApp || !selectedAppInstance) return;
    try {
      await applicationsAPI.deleteInstance(selectedApp.application_id, selectedAppInstance.app_env_instance_id);
      setSuccess('Application undeployed successfully');
      setUndeployDialogOpen(false);
      setSelectedAppInstance(null);
      fetchAppInstances(selectedApp.application_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to undeploy application');
    }
  };

  // Form helpers
  const resetAppForm = () => {
    setAppForm({
      name: '',
      description: '',
      business_domain: '',
      criticality: '',
      data_sensitivity: '',
      owner_team: '',
      test_owner: '',
    });
  };

  const resetComponentForm = () => {
    setComponentForm({
      name: '',
      component_type: 'API',
      source_repo: '',
      build_pipeline_id: '',
      runtime_platform: 'Docker',
      owner_team: '',
    });
  };

  const resetDeployForm = () => {
    setDeployForm({
      env_instance_id: '',
      deployment_model: '',
      version: '',
      deployment_status: 'Aligned',
    });
  };

  // Dialog openers
  const openCreateDialog = () => {
    resetAppForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (app: Application) => {
    setSelectedApp(app);
    setAppForm({
      name: app.name,
      description: app.description || '',
      business_domain: app.business_domain || '',
      criticality: app.criticality || '',
      data_sensitivity: app.data_sensitivity || '',
      owner_team: app.owner_team || '',
      test_owner: app.test_owner || '',
    });
    setEditDialogOpen(true);
  };

  const openDeleteDialog = (app: Application) => {
    setSelectedApp(app);
    setDeleteDialogOpen(true);
  };

  const openViewDialog = async (app: Application) => {
    setSelectedApp(app);
    setViewTab(0);
    setRelatedInterfaces([]);
    setRelatedConfigs([]);
    setRelatedTestData([]);
    setAppInstances([]);
    setViewDialogOpen(true);
    
    // Fetch components
    try {
      const response = await applicationsAPI.getComponents(app.application_id);
      const responseData = response.data;
      const compList = Array.isArray(responseData) ? responseData : responseData.components || [];
      setComponents((prev: { [key: string]: Component[] }) => ({ ...prev, [app.application_id]: compList }));
    } catch (err) {
      console.error('Failed to fetch components:', err);
    }
    
    // Fetch app instances (deployments)
    try {
      const response = await applicationsAPI.getInstances(app.application_id);
      const responseData = response.data;
      const instanceList = Array.isArray(responseData) ? responseData : responseData.instances || [];
      setAppInstances(instanceList);
    } catch (err) {
      console.error('Failed to fetch app instances:', err);
    }
    
    // Fetch related entities in parallel
    try {
      const [interfacesRes, configsRes, testDataRes] = await Promise.all([
        applicationsAPI.getRelatedInterfaces(app.application_id),
        applicationsAPI.getRelatedConfigs(app.application_id),
        applicationsAPI.getRelatedTestData(app.application_id)
      ]);
      setRelatedInterfaces(interfacesRes.data.interfaces || []);
      setRelatedConfigs(configsRes.data.configs || []);
      setRelatedTestData(testDataRes.data.testDataSets || []);
    } catch (err) {
      console.error('Failed to fetch related entities:', err);
    }
  };

  const openComponentDialog = () => {
    resetComponentForm();
    setComponentDialogOpen(true);
  };

  const openEditComponentDialog = (component: Component) => {
    setSelectedComponent(component);
    setComponentForm({
      name: component.name,
      component_type: component.component_type || 'API',
      source_repo: component.source_repo || '',
      build_pipeline_id: component.build_pipeline_id || '',
      runtime_platform: component.runtime_platform || 'Docker',
      owner_team: component.owner_team || '',
    });
    setEditComponentDialogOpen(true);
  };

  const openDeleteComponentDialog = (component: Component) => {
    setSelectedComponent(component);
    setDeleteComponentDialogOpen(true);
  };

  const openDeployDialog = async () => {
    resetDeployForm();
    await fetchAvailableInstances();
    setDeployDialogOpen(true);
  };

  const openEditDeployDialog = (instance: AppInstance) => {
    setSelectedAppInstance(instance);
    setDeployForm({
      env_instance_id: instance.env_instance_id,
      deployment_model: instance.deployment_model || '',
      version: instance.version || '',
      deployment_status: instance.deployment_status || 'Aligned',
    });
    setEditDeployDialogOpen(true);
  };

  const openUndeployDialog = (instance: AppInstance) => {
    setSelectedAppInstance(instance);
    setUndeployDialogOpen(true);
  };

  const getCriticalityColor = (criticality: string): 'error' | 'warning' | 'success' | 'default' => {
    switch (criticality?.toLowerCase()) {
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'success';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Applications</Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchApplications} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              Add Application
            </Button>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Business Domain</TableCell>
              <TableCell>Owner Team</TableCell>
              <TableCell>Criticality</TableCell>
              <TableCell>Components</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">
                  No applications found
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app: Application) => (
                <TableRow key={app.application_id}>
                  <TableCell>
                    <Typography fontWeight="medium">{app.name}</Typography>
                    {app.description && (
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                        {app.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>{app.business_domain || '-'}</TableCell>
                  <TableCell>{app.owner_team || '-'}</TableCell>
                  <TableCell>
                    {app.criticality ? (
                      <Chip label={app.criticality} color={getCriticalityColor(app.criticality)} size="small" />
                    ) : '-'}
                  </TableCell>
                  <TableCell>{app.component_count || 0}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details & Components">
                      <IconButton size="small" onClick={() => openViewDialog(app)}>
                        <ViewIcon />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <>
                        <Tooltip title="Edit Application">
                          <IconButton size="small" onClick={() => openEditDialog(app)}>
                            <EditIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Application">
                          <IconButton size="small" onClick={() => openDeleteDialog(app)} color="error">
                            <DeleteIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create Application Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create Application</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            required
            value={appForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={appForm.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Business Domain"
            fullWidth
            value={appForm.business_domain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, business_domain: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Criticality</InputLabel>
            <Select
              value={appForm.criticality}
              label="Criticality"
              onChange={(e) => setAppForm({ ...appForm, criticality: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {CRITICALITY_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Data Sensitivity</InputLabel>
            <Select
              value={appForm.data_sensitivity}
              label="Data Sensitivity"
              onChange={(e) => setAppForm({ ...appForm, data_sensitivity: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {DATA_SENSITIVITY_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Owner Team"
            fullWidth
            value={appForm.owner_team}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, owner_team: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Test Owner"
            fullWidth
            value={appForm.test_owner}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, test_owner: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateApp} variant="contained" disabled={!appForm.name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Application Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Application</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            required
            value={appForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, name: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={appForm.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, description: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Business Domain"
            fullWidth
            value={appForm.business_domain}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, business_domain: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Criticality</InputLabel>
            <Select
              value={appForm.criticality}
              label="Criticality"
              onChange={(e) => setAppForm({ ...appForm, criticality: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {CRITICALITY_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Data Sensitivity</InputLabel>
            <Select
              value={appForm.data_sensitivity}
              label="Data Sensitivity"
              onChange={(e) => setAppForm({ ...appForm, data_sensitivity: e.target.value })}
            >
              <MenuItem value="">None</MenuItem>
              {DATA_SENSITIVITY_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>{opt}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Owner Team"
            fullWidth
            value={appForm.owner_team}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, owner_team: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Test Owner"
            fullWidth
            value={appForm.test_owner}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setAppForm({ ...appForm, test_owner: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateApp} variant="contained" disabled={!appForm.name}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Application Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Application</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{selectedApp?.name}</strong>?
            This will also delete all associated components.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteApp} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Application Dialog with Components */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{selectedApp?.name}</Typography>
            {selectedApp?.criticality && (
              <Chip label={selectedApp.criticality} color={getCriticalityColor(selectedApp.criticality)} size="small" />
            )}
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs value={viewTab} onChange={(_: React.SyntheticEvent, newValue: number) => setViewTab(newValue)}>
            <Tab label="Details" />
            <Tab label={`Deployments (${appInstances.length})`} icon={<DeployIcon />} iconPosition="start" />
            <Tab label={`Components (${selectedApp ? (components[selectedApp.application_id]?.length || 0) : 0})`} icon={<ComponentIcon />} iconPosition="start" />
            <Tab label={`Interfaces (${relatedInterfaces.length})`} icon={<InterfaceIcon />} iconPosition="start" />
            <Tab label={`Configs (${relatedConfigs.length})`} icon={<ConfigIcon />} iconPosition="start" />
            <Tab label={`Test Data (${relatedTestData.length})`} icon={<TestDataIcon />} iconPosition="start" />
          </Tabs>

          <TabPanel value={viewTab} index={0}>
            <Box sx={{ display: 'grid', gap: 2 }}>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                <Typography>{selectedApp?.description || 'No description'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Business Domain</Typography>
                <Typography>{selectedApp?.business_domain || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Criticality</Typography>
                <Typography>{selectedApp?.criticality || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Data Sensitivity</Typography>
                <Typography>{selectedApp?.data_sensitivity || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Owner Team</Typography>
                <Typography>{selectedApp?.owner_team || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Test Owner</Typography>
                <Typography>{selectedApp?.test_owner || 'Not specified'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Created At</Typography>
                <Typography>{selectedApp?.created_at ? new Date(selectedApp.created_at).toLocaleString() : '-'}</Typography>
              </Box>
              <Box>
                <Typography variant="subtitle2" color="text.secondary">Updated At</Typography>
                <Typography>{selectedApp?.updated_at ? new Date(selectedApp.updated_at).toLocaleString() : '-'}</Typography>
              </Box>
            </Box>
          </TabPanel>

          <TabPanel value={viewTab} index={1}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Environment Deployments</Typography>
              {canDeploy && (
                <Button size="small" startIcon={<AddIcon />} onClick={openDeployDialog}>
                  Deploy to Environment
                </Button>
              )}
            </Box>
            {appInstances.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Environment</TableCell>
                      <TableCell>Instance</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Model</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {appInstances.map((instance) => (
                      <TableRow key={instance.app_env_instance_id} hover>
                        <TableCell>
                          <Chip label={instance.environment_name} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{instance.instance_name}</TableCell>
                        <TableCell>{instance.version || '-'}</TableCell>
                        <TableCell>{instance.deployment_model || '-'}</TableCell>
                        <TableCell>
                          <Chip 
                            label={instance.deployment_status} 
                            size="small" 
                            color={instance.deployment_status === 'Aligned' ? 'success' : instance.deployment_status === 'Broken' ? 'error' : 'warning'} 
                          />
                        </TableCell>
                        <TableCell align="right">
                          {canDeploy && (
                            <>
                              <Tooltip title="Edit Deployment">
                                <IconButton size="small" onClick={() => openEditDeployDialog(instance)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Undeploy">
                                <IconButton size="small" onClick={() => openUndeployDialog(instance)} color="error">
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                Not deployed to any environments. {canDeploy && 'Click "Deploy to Environment" to add a deployment.'}
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={viewTab} index={2}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Components</Typography>
              {canEdit && (
                <Button size="small" startIcon={<AddIcon />} onClick={openComponentDialog}>
                  Add Component
                </Button>
              )}
            </Box>
            {selectedApp && components[selectedApp.application_id]?.length > 0 ? (
              <List>
                {components[selectedApp.application_id].map((component: Component) => (
                  <ListItem key={component.component_id} divider>
                    <ListItemText
                      primary={
                        <Box display="flex" alignItems="center" gap={1}>
                          {component.name}
                          <Chip label={component.component_type} size="small" variant="outlined" />
                        </Box>
                      }
                      secondary={
                        <Box component="span">
                          <Typography variant="body2" component="span">
                            Platform: {component.runtime_platform || 'Not specified'}
                          </Typography>
                          {component.owner_team && (
                            <Typography variant="body2" component="span" sx={{ ml: 2 }}>
                              Owner: {component.owner_team}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                    {canEdit && (
                      <ListItemSecondaryAction>
                        <Tooltip title="Edit Component">
                          <IconButton size="small" onClick={() => openEditComponentDialog(component)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete Component">
                          <IconButton size="small" onClick={() => openDeleteComponentDialog(component)} color="error">
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No components found. {canEdit && 'Click "Add Component" to create one.'}
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={viewTab} index={3}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Related Interfaces</Typography>
              <Button
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => router.push('/interfaces')}
              >
                Manage Interfaces
              </Button>
            </Box>
            {relatedInterfaces.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Direction</TableCell>
                      <TableCell>Pattern</TableCell>
                      <TableCell>Frequency</TableCell>
                      <TableCell>External Party</TableCell>
                      <TableCell align="center">Endpoints</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedInterfaces.map((iface) => (
                      <TableRow key={iface.interface_id} hover>
                        <TableCell>{iface.name}</TableCell>
                        <TableCell>
                          <Chip label={iface.direction} size="small" color={iface.direction === 'Inbound' ? 'info' : iface.direction === 'Outbound' ? 'warning' : 'default'} />
                        </TableCell>
                        <TableCell>{iface.pattern}</TableCell>
                        <TableCell>{iface.frequency}</TableCell>
                        <TableCell>{iface.external_party || '-'}</TableCell>
                        <TableCell align="center">{iface.endpoint_count || 0}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No interfaces found for this application. Interfaces are linked via component instances.
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={viewTab} index={4}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Related Configurations</Typography>
              <Button
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => router.push('/configs')}
              >
                Manage Configs
              </Button>
            </Box>
            {relatedConfigs.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Scope</TableCell>
                      <TableCell>Version</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="center">Items</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedConfigs.map((config) => (
                      <TableRow key={config.config_set_id} hover>
                        <TableCell>{config.name}</TableCell>
                        <TableCell>
                          <Chip label={config.scope_type} size="small" variant="outlined" />
                        </TableCell>
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
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No configurations found. Go to Configs page to create configs scoped to this application.
              </Typography>
            )}
          </TabPanel>

          <TabPanel value={viewTab} index={5}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="subtitle1">Related Test Data Sets</Typography>
              <Button
                size="small"
                startIcon={<OpenInNewIcon />}
                onClick={() => router.push('/testdata')}
              >
                Manage Test Data
              </Button>
            </Box>
            {relatedTestData.length > 0 ? (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Name</TableCell>
                      <TableCell>Data Type</TableCell>
                      <TableCell>Source Type</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {relatedTestData.map((td) => (
                      <TableRow key={td.test_data_set_id} hover>
                        <TableCell>{td.name}</TableCell>
                        <TableCell>
                          <Chip label={td.data_type} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{td.source_type}</TableCell>
                        <TableCell>
                          <Chip 
                            label={td.status} 
                            size="small" 
                            color={td.status === 'Active' ? 'success' : td.status === 'Stale' ? 'warning' : 'default'} 
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            ) : (
              <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                No test data sets found. Go to Test Data page to create data sets for this application.
              </Typography>
            )}
          </TabPanel>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Create Component Dialog */}
      <Dialog open={componentDialogOpen} onClose={() => setComponentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Component to {selectedApp?.name}</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Component Name"
            fullWidth
            required
            value={componentForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, name: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Component Type</InputLabel>
            <Select
              value={componentForm.component_type}
              label="Component Type"
              onChange={(e) => setComponentForm({ ...componentForm, component_type: e.target.value })}
            >
              {COMPONENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Source Repository"
            fullWidth
            value={componentForm.source_repo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, source_repo: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Build Pipeline ID"
            fullWidth
            value={componentForm.build_pipeline_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, build_pipeline_id: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Runtime Platform</InputLabel>
            <Select
              value={componentForm.runtime_platform}
              label="Runtime Platform"
              onChange={(e) => setComponentForm({ ...componentForm, runtime_platform: e.target.value })}
            >
              {RUNTIME_PLATFORMS.map((platform) => (
                <MenuItem key={platform} value={platform}>{platform}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Owner Team"
            fullWidth
            value={componentForm.owner_team}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, owner_team: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setComponentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateComponent} variant="contained" disabled={!componentForm.name}>
            Add Component
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Component Dialog */}
      <Dialog open={editComponentDialogOpen} onClose={() => setEditComponentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Component</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Component Name"
            fullWidth
            required
            value={componentForm.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, name: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Component Type</InputLabel>
            <Select
              value={componentForm.component_type}
              label="Component Type"
              onChange={(e) => setComponentForm({ ...componentForm, component_type: e.target.value })}
            >
              {COMPONENT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>{type}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Source Repository"
            fullWidth
            value={componentForm.source_repo}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, source_repo: e.target.value })}
          />
          <TextField
            margin="dense"
            label="Build Pipeline ID"
            fullWidth
            value={componentForm.build_pipeline_id}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, build_pipeline_id: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Runtime Platform</InputLabel>
            <Select
              value={componentForm.runtime_platform}
              label="Runtime Platform"
              onChange={(e) => setComponentForm({ ...componentForm, runtime_platform: e.target.value })}
            >
              {RUNTIME_PLATFORMS.map((platform) => (
                <MenuItem key={platform} value={platform}>{platform}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Owner Team"
            fullWidth
            value={componentForm.owner_team}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setComponentForm({ ...componentForm, owner_team: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditComponentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateComponent} variant="contained" disabled={!componentForm.name}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Component Dialog */}
      <Dialog open={deleteComponentDialogOpen} onClose={() => setDeleteComponentDialogOpen(false)}>
        <DialogTitle>Delete Component</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete component <strong>{selectedComponent?.name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteComponentDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeleteComponent} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deploy to Environment Dialog */}
      <Dialog open={deployDialogOpen} onClose={() => setDeployDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Deploy {selectedApp?.name} to Environment</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="dense" required>
            <InputLabel>Environment Instance</InputLabel>
            <Select
              value={deployForm.env_instance_id}
              label="Environment Instance"
              onChange={(e) => setDeployForm({ ...deployForm, env_instance_id: e.target.value })}
            >
              {availableInstances
                .filter(inst => !appInstances.some(ai => ai.env_instance_id === inst.env_instance_id))
                .map((inst) => (
                  <MenuItem key={inst.env_instance_id} value={inst.env_instance_id}>
                    {inst.environment_name} - {inst.name}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
          <TextField
            margin="dense"
            label="Version"
            fullWidth
            placeholder="e.g., 2.5.0"
            value={deployForm.version}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeployForm({ ...deployForm, version: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Deployment Model</InputLabel>
            <Select
              value={deployForm.deployment_model}
              label="Deployment Model"
              onChange={(e) => setDeployForm({ ...deployForm, deployment_model: e.target.value })}
            >
              <MenuItem value="">Not specified</MenuItem>
              {DEPLOYMENT_MODELS.map((model) => (
                <MenuItem key={model} value={model}>{model}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Deployment Status</InputLabel>
            <Select
              value={deployForm.deployment_status}
              label="Deployment Status"
              onChange={(e) => setDeployForm({ ...deployForm, deployment_status: e.target.value })}
            >
              {DEPLOYMENT_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeployDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleDeploy} variant="contained" disabled={!deployForm.env_instance_id}>
            Deploy
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Deployment Dialog */}
      <Dialog open={editDeployDialogOpen} onClose={() => setEditDeployDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Deployment</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Editing deployment to: <strong>{selectedAppInstance?.environment_name} - {selectedAppInstance?.instance_name}</strong>
          </Typography>
          <TextField
            margin="dense"
            label="Version"
            fullWidth
            placeholder="e.g., 2.5.0"
            value={deployForm.version}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDeployForm({ ...deployForm, version: e.target.value })}
          />
          <FormControl fullWidth margin="dense">
            <InputLabel>Deployment Model</InputLabel>
            <Select
              value={deployForm.deployment_model}
              label="Deployment Model"
              onChange={(e) => setDeployForm({ ...deployForm, deployment_model: e.target.value })}
            >
              <MenuItem value="">Not specified</MenuItem>
              {DEPLOYMENT_MODELS.map((model) => (
                <MenuItem key={model} value={model}>{model}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth margin="dense">
            <InputLabel>Deployment Status</InputLabel>
            <Select
              value={deployForm.deployment_status}
              label="Deployment Status"
              onChange={(e) => setDeployForm({ ...deployForm, deployment_status: e.target.value })}
            >
              {DEPLOYMENT_STATUSES.map((status) => (
                <MenuItem key={status} value={status}>{status}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDeployDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUpdateDeploy} variant="contained">
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Undeploy Dialog */}
      <Dialog open={undeployDialogOpen} onClose={() => setUndeployDialogOpen(false)}>
        <DialogTitle>Undeploy Application</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to undeploy <strong>{selectedApp?.name}</strong> from{' '}
            <strong>{selectedAppInstance?.environment_name} - {selectedAppInstance?.instance_name}</strong>?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUndeployDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleUndeploy} color="error" variant="contained">
            Undeploy
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
