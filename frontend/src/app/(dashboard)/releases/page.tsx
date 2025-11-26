'use client';

import { useEffect, useState } from 'react';
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
  Tab,
  Tabs,
  Grid,
  Alert,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  ListItemSecondaryAction,
  CircularProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Rocket as RocketIcon,
  Refresh as RefreshIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
  BugReport as JiraIcon,
  PlayArrow as StartIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { releasesAPI, integrationsAPI, applicationsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Release {
  release_id: string;
  name: string;
  description: string;
  release_type: string;
  status: string;
  planned_start_datetime: string;
  planned_end_datetime: string;
  actual_start_datetime: string;
  actual_end_datetime: string;
  release_manager_name: string;
  owning_group_name: string;
  jira_release_key: string;
  git_tag: string;
  servicenow_change_batch_id: string;
  application_count: number;
  environment_count: number;
  created_at: string;
}

interface Integration {
  integration_id: string;
  name: string;
  tool_type: string;
  base_url: string;
  project_key: string;
  is_active: boolean;
}

interface IntegrationLink {
  integration_link_id: string;
  integration_id: string;
  external_key: string;
  external_url: string;
  link_type: string;
  integration_name?: string;
}

interface Application {
  application_id: string;
  name: string;
}

const RELEASE_TYPES = ['Major', 'Minor', 'Hotfix', 'ServicePack', 'Other'];
const RELEASE_STATUSES = ['Planned', 'InProgress', 'CodeComplete', 'Testing', 'ReadyForProd', 'Deployed', 'Failed', 'RolledBack', 'Cancelled'];

export default function ReleasesPage() {
  const { user } = useAuth();
  const [releases, setReleases] = useState<Release[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Tab and filter state
  const [tabValue, setTabValue] = useState(0);
  const [searchText, setSearchText] = useState('');

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [jiraDialogOpen, setJiraDialogOpen] = useState(false);

  // Selected release and details
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [releaseDetails, setReleaseDetails] = useState<any>(null);
  const [releaseLinks, setReleaseLinks] = useState<IntegrationLink[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    release_type: 'Minor',
    status: 'Planned',
    planned_start_datetime: '',
    planned_end_datetime: '',
    jira_release_key: '',
    git_tag: '',
  });

  // Jira link state
  const [jiraForm, setJiraForm] = useState({
    integration_id: '',
    external_key: '',
    link_type: 'Release',
  });
  const [jiraLoading, setJiraLoading] = useState(false);

  const canEdit = user?.role === 'Admin' || user?.role === 'ReleaseManager' || user?.role === 'ProjectLead';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [releasesRes, integrationsRes, appsRes] = await Promise.all([
        releasesAPI.getAll(),
        integrationsAPI.getAll(),
        applicationsAPI.getAll(),
      ]);
      setReleases(releasesRes.data.releases || []);
      setIntegrations((integrationsRes.data.integrations || []).filter((i: Integration) => i.is_active));
      const appData = appsRes.data;
      setApplications(Array.isArray(appData) ? appData : appData.applications || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchReleaseDetails = async (releaseId: string) => {
    try {
      const [detailsRes, linksRes] = await Promise.all([
        releasesAPI.getById(releaseId),
        integrationsAPI.getLinksForEntity('Release', releaseId).catch(() => ({ data: { links: [] } })),
      ]);
      setReleaseDetails(detailsRes.data);
      setReleaseLinks(linksRes.data.links || linksRes.data || []);
    } catch (err: any) {
      console.error('Failed to fetch release details:', err);
    }
  };

  const handleCreateRelease = async () => {
    try {
      await releasesAPI.create(formData);
      setSuccess('Release created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create release');
    }
  };

  const handleUpdateRelease = async () => {
    if (!selectedRelease) return;
    try {
      // Update basic release info
      await releasesAPI.update(selectedRelease.release_id, formData);
      
      // If status changed, also call the status update endpoint
      if (formData.status && formData.status !== selectedRelease.status) {
        await releasesAPI.updateStatus(selectedRelease.release_id, { status: formData.status });
      }
      
      setSuccess('Release updated successfully');
      setEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update release');
    }
  };

  const handleDeleteRelease = async () => {
    if (!selectedRelease) return;
    try {
      await releasesAPI.delete(selectedRelease.release_id);
      setSuccess('Release deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedRelease(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete release');
    }
  };

  const handleUpdateStatus = async (releaseId: string, newStatus: string) => {
    try {
      await releasesAPI.updateStatus(releaseId, { status: newStatus });
      setSuccess(`Release status updated to ${newStatus}`);
      fetchData();
      if (viewDialogOpen && selectedRelease?.release_id === releaseId) {
        fetchReleaseDetails(releaseId);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update status');
    }
  };

  const handleLinkJira = async () => {
    if (!selectedRelease || !jiraForm.integration_id || !jiraForm.external_key) return;
    try {
      setJiraLoading(true);
      const integration = integrations.find(i => i.integration_id === jiraForm.integration_id);
      await integrationsAPI.createLink({
        integration_id: jiraForm.integration_id,
        linked_entity_type: 'Release',
        linked_entity_id: selectedRelease.release_id,
        external_key: jiraForm.external_key,
        external_url: integration ? `${integration.base_url}/browse/${jiraForm.external_key}` : '',
        link_type: jiraForm.link_type,
      });
      setSuccess('Jira issue linked successfully');
      setJiraDialogOpen(false);
      setJiraForm({ integration_id: '', external_key: '', link_type: 'Release' });
      fetchReleaseDetails(selectedRelease.release_id);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to link Jira issue');
    } finally {
      setJiraLoading(false);
    }
  };

  const handleUnlinkJira = async (linkId: string) => {
    try {
      await integrationsAPI.deleteLink(linkId);
      setSuccess('Jira link removed');
      if (selectedRelease) {
        fetchReleaseDetails(selectedRelease.release_id);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to remove link');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      release_type: 'Minor',
      status: 'Planned',
      planned_start_datetime: '',
      planned_end_datetime: '',
      jira_release_key: '',
      git_tag: '',
    });
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (release: Release) => {
    setSelectedRelease(release);
    setFormData({
      name: release.name,
      description: release.description || '',
      release_type: release.release_type || 'Minor',
      status: release.status || 'Planned',
      planned_start_datetime: release.planned_start_datetime ? release.planned_start_datetime.slice(0, 16) : '',
      planned_end_datetime: release.planned_end_datetime ? release.planned_end_datetime.slice(0, 16) : '',
      jira_release_key: release.jira_release_key || '',
      git_tag: release.git_tag || '',
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = async (release: Release) => {
    setSelectedRelease(release);
    await fetchReleaseDetails(release.release_id);
    setViewDialogOpen(true);
  };

  const openDeleteDialog = (release: Release) => {
    setSelectedRelease(release);
    setDeleteDialogOpen(true);
  };

  const openJiraDialog = (release: Release) => {
    setSelectedRelease(release);
    setJiraForm({ integration_id: '', external_key: '', link_type: 'Release' });
    setJiraDialogOpen(true);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' | 'secondary' => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'info' | 'default' | 'primary' | 'secondary' } = {
      Planned: 'info',
      InProgress: 'warning',
      CodeComplete: 'secondary',
      Testing: 'secondary',
      ReadyForProd: 'primary',
      Deployed: 'success',
      Failed: 'error',
      RolledBack: 'error',
      Cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'info' | 'default' } = {
      Major: 'error',
      Minor: 'warning',
      Hotfix: 'success',
      ServicePack: 'info',
      Other: 'default',
    };
    return colors[type] || 'default';
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const statusFlow: { [key: string]: string } = {
      Planned: 'InProgress',
      InProgress: 'CodeComplete',
      CodeComplete: 'Testing',
      Testing: 'ReadyForProd',
      ReadyForProd: 'Deployed',
    };
    return statusFlow[currentStatus] || null;
  };

  const filteredReleases = releases.filter((release) => {
    // Tab filter
    let tabMatch = true;
    if (tabValue === 1) tabMatch = ['Planned', 'InProgress', 'CodeComplete', 'Testing', 'ReadyForProd'].includes(release.status);
    else if (tabValue === 2) tabMatch = release.status === 'Deployed';
    else if (tabValue === 3) tabMatch = ['Failed', 'Cancelled', 'RolledBack'].includes(release.status);

    // Search filter
    const searchMatch = !searchText || 
      release.name.toLowerCase().includes(searchText.toLowerCase()) ||
      release.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      release.jira_release_key?.toLowerCase().includes(searchText.toLowerCase());

    return tabMatch && searchMatch;
  });

  const jiraIntegrations = integrations.filter(i => i.tool_type === 'Jira');

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Releases
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              New Release
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

      {/* Search */}
      <Card sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search releases by name, description, or Jira key..."
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          size="small"
        />
      </Card>

      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={`All (${releases.length})`} />
          <Tab label={`In Progress (${releases.filter((r) => ['Planned', 'InProgress', 'CodeComplete', 'Testing', 'ReadyForProd'].includes(r.status)).length})`} />
          <Tab label={`Deployed (${releases.filter((r) => r.status === 'Deployed').length})`} />
          <Tab label="Failed/Cancelled" />
        </Tabs>
      </Card>

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Release</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Manager</TableCell>
                <TableCell>Planned Start</TableCell>
                <TableCell>Jira</TableCell>
                <TableCell align="center">Apps</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReleases.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No releases found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredReleases.map((release) => (
                  <TableRow key={release.release_id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RocketIcon color="primary" fontSize="small" />
                        <Box>
                          <Typography fontWeight={500}>{release.name}</Typography>
                          {release.description && (
                            <Typography variant="caption" color="text.secondary">
                              {release.description.substring(0, 40)}...
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={release.release_type || 'N/A'} size="small" color={getTypeColor(release.release_type)} />
                    </TableCell>
                    <TableCell>{release.release_manager_name || '-'}</TableCell>
                    <TableCell>
                      {release.planned_start_datetime
                        ? new Date(release.planned_start_datetime).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {release.jira_release_key ? (
                        <Chip
                          icon={<JiraIcon />}
                          label={release.jira_release_key}
                          size="small"
                          color="info"
                          variant="outlined"
                        />
                      ) : (
                        <Typography variant="caption" color="text.secondary">-</Typography>
                      )}
                    </TableCell>
                    <TableCell align="center">{release.application_count || 0}</TableCell>
                    <TableCell>
                      <Chip label={release.status} size="small" color={getStatusColor(release.status)} />
                    </TableCell>
                    <TableCell align="right">
                      <Tooltip title="View Details">
                        <IconButton size="small" onClick={() => openViewDialog(release)}>
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      {canEdit && (
                        <>
                          <Tooltip title="Link to Jira">
                            <IconButton size="small" color="info" onClick={() => openJiraDialog(release)}>
                              <JiraIcon />
                            </IconButton>
                          </Tooltip>
                          {!['Deployed', 'Failed', 'Cancelled', 'RolledBack'].includes(release.status) && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => openEditDialog(release)}>
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              {getNextStatus(release.status) && (
                                <Tooltip title={`Move to ${getNextStatus(release.status)}`}>
                                  <IconButton
                                    size="small"
                                    color="success"
                                    onClick={() => handleUpdateStatus(release.release_id, getNextStatus(release.status)!)}
                                  >
                                    <StartIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Cancel">
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleUpdateStatus(release.release_id, 'Cancelled')}
                                >
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                            </>
                          )}
                          <Tooltip title="Delete">
                            <IconButton size="small" color="error" onClick={() => openDeleteDialog(release)}>
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
      </Card>

      {/* Create Release Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Release</DialogTitle>
        <DialogContent>
          <TextField
            label="Release Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Release Type</InputLabel>
                <Select
                  value={formData.release_type}
                  label="Release Type"
                  onChange={(e) => setFormData({ ...formData, release_type: e.target.value })}
                >
                  {RELEASE_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Jira Release Key"
                fullWidth
                value={formData.jira_release_key}
                onChange={(e) => setFormData({ ...formData, jira_release_key: e.target.value })}
                placeholder="e.g., REL-123"
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="Planned Start"
                type="datetime-local"
                fullWidth
                value={formData.planned_start_datetime}
                onChange={(e) => setFormData({ ...formData, planned_start_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Planned End"
                type="datetime-local"
                fullWidth
                value={formData.planned_end_datetime}
                onChange={(e) => setFormData({ ...formData, planned_end_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <TextField
            label="Git Tag"
            fullWidth
            margin="normal"
            value={formData.git_tag}
            onChange={(e) => setFormData({ ...formData, git_tag: e.target.value })}
            placeholder="e.g., v1.2.3"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRelease} disabled={!formData.name}>
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Release Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Release</DialogTitle>
        <DialogContent>
          <TextField
            label="Release Name"
            fullWidth
            margin="normal"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={3}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Release Type</InputLabel>
                <Select
                  value={formData.release_type}
                  label="Release Type"
                  onChange={(e) => setFormData({ ...formData, release_type: e.target.value })}
                >
                  {RELEASE_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={formData.status}
                  label="Status"
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                >
                  {RELEASE_STATUSES.map((status) => (
                    <MenuItem key={status} value={status}>
                      <Chip label={status} size="small" color={getStatusColor(status)} sx={{ mr: 1 }} />
                      {status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={4}>
              <TextField
                label="Jira Release Key"
                fullWidth
                value={formData.jira_release_key}
                onChange={(e) => setFormData({ ...formData, jira_release_key: e.target.value })}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="Planned Start"
                type="datetime-local"
                fullWidth
                value={formData.planned_start_datetime}
                onChange={(e) => setFormData({ ...formData, planned_start_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Planned End"
                type="datetime-local"
                fullWidth
                value={formData.planned_end_datetime}
                onChange={(e) => setFormData({ ...formData, planned_end_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
          <TextField
            label="Git Tag"
            fullWidth
            margin="normal"
            value={formData.git_tag}
            onChange={(e) => setFormData({ ...formData, git_tag: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateRelease} disabled={!formData.name}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Release Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box display="flex" alignItems="center" gap={1}>
              <RocketIcon color="primary" />
              <Typography variant="h6">{selectedRelease?.name}</Typography>
            </Box>
            <Box>
              <Chip label={selectedRelease?.release_type} color={getTypeColor(selectedRelease?.release_type || '')} sx={{ mr: 1 }} />
              <Chip label={selectedRelease?.status} color={getStatusColor(selectedRelease?.status || '')} />
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Description</Typography>
              <Typography>{selectedRelease?.description || 'No description'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Planned Start</Typography>
              <Typography>
                {selectedRelease?.planned_start_datetime
                  ? new Date(selectedRelease.planned_start_datetime).toLocaleString()
                  : '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Planned End</Typography>
              <Typography>
                {selectedRelease?.planned_end_datetime
                  ? new Date(selectedRelease.planned_end_datetime).toLocaleString()
                  : '-'}
              </Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Release Manager</Typography>
              <Typography>{selectedRelease?.release_manager_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Owning Group</Typography>
              <Typography>{selectedRelease?.owning_group_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Git Tag</Typography>
              <Typography>{selectedRelease?.git_tag || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Jira Release Key</Typography>
              <Typography>{selectedRelease?.jira_release_key || '-'}</Typography>
            </Grid>
          </Grid>

          {/* Jira Links Section */}
          <Box sx={{ mt: 3 }}>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography variant="subtitle1">
                <JiraIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Jira Links ({releaseLinks.length})
              </Typography>
              {canEdit && (
                <Button
                  size="small"
                  startIcon={<LinkIcon />}
                  onClick={() => selectedRelease && openJiraDialog(selectedRelease)}
                >
                  Link Jira Issue
                </Button>
              )}
            </Box>
            {releaseLinks.length > 0 ? (
              <List dense>
                {releaseLinks.map((link) => (
                  <ListItem key={link.integration_link_id}>
                    <ListItemIcon>
                      <JiraIcon color="info" />
                    </ListItemIcon>
                    <ListItemText
                      primary={link.external_key}
                      secondary={link.link_type}
                    />
                    {link.external_url && (
                      <Button
                        size="small"
                        href={link.external_url}
                        target="_blank"
                        sx={{ mr: 1 }}
                      >
                        Open
                      </Button>
                    )}
                    {canEdit && (
                      <ListItemSecondaryAction>
                        <Tooltip title="Remove Link">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleUnlinkJira(link.integration_link_id)}
                          >
                            <LinkOffIcon />
                          </IconButton>
                        </Tooltip>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                No Jira issues linked. Click "Link Jira Issue" to add one.
              </Typography>
            )}
          </Box>

          {/* Applications Section */}
          {releaseDetails?.applications?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Applications ({releaseDetails.applications.length})
              </Typography>
              <List dense>
                {releaseDetails.applications.map((app: any) => (
                  <ListItem key={app.application_id}>
                    <ListItemText
                      primary={app.application_name}
                      secondary={`Target Version: ${app.target_version || 'N/A'}`}
                    />
                    <Chip label={app.criticality || 'N/A'} size="small" />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Environments Section */}
          {releaseDetails?.environments?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>
                Environments ({releaseDetails.environments.length})
              </Typography>
              <List dense>
                {releaseDetails.environments.map((env: any) => (
                  <ListItem key={env.release_env_id}>
                    <ListItemText
                      primary={`${env.environment_name} - ${env.instance_name}`}
                      secondary={`Deployment: ${env.deployment_window_start ? new Date(env.deployment_window_start).toLocaleString() : 'Not scheduled'}`}
                    />
                    <Chip label={env.status || 'Pending'} size="small" />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {canEdit && selectedRelease && !['Deployed', 'Failed', 'Cancelled', 'RolledBack'].includes(selectedRelease.status) && (
            <>
              {getNextStatus(selectedRelease.status) && (
                <Button
                  color="success"
                  startIcon={<StartIcon />}
                  onClick={() => {
                    handleUpdateStatus(selectedRelease.release_id, getNextStatus(selectedRelease.status)!);
                  }}
                >
                  Move to {getNextStatus(selectedRelease.status)}
                </Button>
              )}
              <Button
                color="error"
                onClick={() => {
                  handleUpdateStatus(selectedRelease.release_id, 'Cancelled');
                  setViewDialogOpen(false);
                }}
              >
                Cancel Release
              </Button>
            </>
          )}
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Release</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete release "{selectedRelease?.name}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteRelease}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link Jira Dialog */}
      <Dialog open={jiraDialogOpen} onClose={() => setJiraDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <JiraIcon color="info" />
            Link Jira Issue to Release
          </Box>
        </DialogTitle>
        <DialogContent>
          {jiraIntegrations.length === 0 ? (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No active Jira integrations found. Please configure a Jira integration first in the Integrations page.
            </Alert>
          ) : (
            <>
              <FormControl fullWidth margin="normal">
                <InputLabel>Jira Integration</InputLabel>
                <Select
                  value={jiraForm.integration_id}
                  label="Jira Integration"
                  onChange={(e) => setJiraForm({ ...jiraForm, integration_id: e.target.value })}
                >
                  {jiraIntegrations.map((integration) => (
                    <MenuItem key={integration.integration_id} value={integration.integration_id}>
                      {integration.name} ({integration.project_key})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                label="Jira Issue Key"
                fullWidth
                margin="normal"
                value={jiraForm.external_key}
                onChange={(e) => setJiraForm({ ...jiraForm, external_key: e.target.value.toUpperCase() })}
                placeholder="e.g., PROJ-123"
                helperText="Enter the Jira issue key (e.g., PROJ-123)"
              />
              <FormControl fullWidth margin="normal">
                <InputLabel>Link Type</InputLabel>
                <Select
                  value={jiraForm.link_type}
                  label="Link Type"
                  onChange={(e) => setJiraForm({ ...jiraForm, link_type: e.target.value })}
                >
                  <MenuItem value="Release">Release</MenuItem>
                  <MenuItem value="Epic">Epic</MenuItem>
                  <MenuItem value="Story">Story</MenuItem>
                  <MenuItem value="Task">Task</MenuItem>
                  <MenuItem value="Bug">Bug</MenuItem>
                </Select>
              </FormControl>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setJiraDialogOpen(false)}>Cancel</Button>
          {jiraIntegrations.length > 0 && (
            <Button
              variant="contained"
              onClick={handleLinkJira}
              disabled={!jiraForm.integration_id || !jiraForm.external_key || jiraLoading}
              startIcon={jiraLoading ? <CircularProgress size={20} /> : <LinkIcon />}
            >
              Link Issue
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}
