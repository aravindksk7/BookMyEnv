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
} from '@mui/icons-material';
import { applicationsAPI } from '../../../lib/api';
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

export default function ApplicationsPage() {
  const { user } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [components, setComponents] = useState<{ [key: string]: Component[] }>({});
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

  // Selected items
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [selectedComponent, setSelectedComponent] = useState<Component | null>(null);

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

  const canEdit = user?.role === 'Admin' || user?.role === 'ProjectLead';

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
    await fetchComponents(app.application_id);
    setViewDialogOpen(true);
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
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
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
            <Tab label="Components" icon={<ComponentIcon />} iconPosition="start" />
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
    </Box>
  );
}
