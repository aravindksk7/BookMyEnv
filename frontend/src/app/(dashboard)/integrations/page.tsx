'use client';

import React, { useEffect, useState } from 'react';
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
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Sync as SyncIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
} from '@mui/icons-material';
import { integrationsAPI } from '@/lib/api';

interface Integration {
  integration_id: string;
  name: string;
  tool_type: string;
  base_url: string;
  project_key: string;
  is_active: boolean;
  last_sync_at: string;
  linked_items_count: number;
  api_token_encrypted: string;
}

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] = useState<Integration | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    tool_type: 'Jira',
    base_url: '',
    api_token: '',
    project_key: '',
  });
  const [editFormData, setEditFormData] = useState({
    name: '',
    base_url: '',
    api_token: '',
    project_key: '',
  });

  useEffect(() => {
    fetchIntegrations();
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await integrationsAPI.getAll();
      setIntegrations(response.data.integrations || []);
    } catch (error) {
      console.error('Failed to fetch integrations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateIntegration = async () => {
    try {
      await integrationsAPI.create(formData);
      setDialogOpen(false);
      setFormData({ name: '', tool_type: 'Jira', base_url: '', api_token: '', project_key: '' });
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to create integration:', error);
    }
  };

  const handleTestConnection = async (id: string) => {
    try {
      const response = await integrationsAPI.testConnection(id);
      setTestResult(response.data);
    } catch (error: any) {
      setTestResult({ success: false, message: error.response?.data?.error || 'Connection failed' });
    }
  };

  const handleSync = async (id: string) => {
    try {
      await integrationsAPI.sync(id);
      fetchIntegrations();
    } catch (error) {
      console.error('Failed to sync:', error);
    }
  };

  const handleEditClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setEditFormData({
      name: integration.name,
      base_url: integration.base_url,
      api_token: '',
      project_key: integration.project_key || '',
    });
    setEditDialogOpen(true);
  };

  const handleUpdateIntegration = async () => {
    if (!selectedIntegration) return;
    try {
      const updateData = { ...editFormData };
      if (!updateData.api_token) {
        delete (updateData as any).api_token;
      }
      await integrationsAPI.update(selectedIntegration.integration_id, updateData);
      setEditDialogOpen(false);
      setSelectedIntegration(null);
      fetchIntegrations();
      setTestResult({ success: true, message: 'Integration updated successfully' });
    } catch (error) {
      console.error('Failed to update integration:', error);
      setTestResult({ success: false, message: 'Failed to update integration' });
    }
  };

  const handleDeleteClick = (integration: Integration) => {
    setSelectedIntegration(integration);
    setDeleteDialogOpen(true);
  };

  const handleDeleteIntegration = async () => {
    if (!selectedIntegration) return;
    try {
      await integrationsAPI.delete(selectedIntegration.integration_id);
      setDeleteDialogOpen(false);
      setSelectedIntegration(null);
      fetchIntegrations();
      setTestResult({ success: true, message: 'Integration deleted successfully' });
    } catch (error) {
      console.error('Failed to delete integration:', error);
      setTestResult({ success: false, message: 'Failed to delete integration' });
    }
  };

  const getToolColor = (type: string) => {
    const colors: { [key: string]: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info' } = {
      Jira: 'primary',
      GitLab: 'warning',
      ServiceNow: 'success',
      Jenkins: 'error',
      AzureDevOps: 'info',
    };
    return colors[type] || 'default';
  };

  if (loading) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Integrations
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
          Add Integration
        </Button>
      </Box>

      {testResult && (
        <Alert
          severity={testResult.success ? 'success' : 'error'}
          onClose={() => setTestResult(null)}
          sx={{ mb: 2 }}
        >
          {testResult.message}
        </Alert>
      )}

      <Card>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Base URL</TableCell>
                <TableCell>Project Key</TableCell>
                <TableCell align="center">Linked Items</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Last Sync</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {integrations.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center">
                    No integrations configured. Add one to connect with external tools.
                  </TableCell>
                </TableRow>
              ) : (
                integrations.map((integration) => (
                  <TableRow key={integration.integration_id} hover>
                    <TableCell>
                      <Typography fontWeight={500}>{integration.name}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={integration.tool_type} size="small" color={getToolColor(integration.tool_type)} />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {integration.base_url}
                      </Typography>
                    </TableCell>
                    <TableCell>{integration.project_key || '-'}</TableCell>
                    <TableCell align="center">{integration.linked_items_count}</TableCell>
                    <TableCell>
                      {integration.is_active ? (
                        <Chip icon={<CheckIcon />} label="Active" size="small" color="success" />
                      ) : (
                        <Chip icon={<ErrorIcon />} label="Inactive" size="small" color="default" />
                      )}
                    </TableCell>
                    <TableCell>
                      {integration.last_sync_at
                        ? new Date(integration.last_sync_at).toLocaleString()
                        : 'Never'}
                    </TableCell>
                    <TableCell align="right">
                      <IconButton size="small" color="primary" onClick={() => handleTestConnection(integration.integration_id)}>
                        <CheckIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleSync(integration.integration_id)}>
                        <SyncIcon />
                      </IconButton>
                      <IconButton size="small" onClick={() => handleEditClick(integration)}>
                        <EditIcon />
                      </IconButton>
                      <IconButton size="small" color="error" onClick={() => handleDeleteClick(integration)}>
                        <DeleteIcon />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Integration</DialogTitle>
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
            <InputLabel>Tool Type</InputLabel>
            <Select
              value={formData.tool_type}
              label="Tool Type"
              onChange={(e) => setFormData({ ...formData, tool_type: e.target.value })}
            >
              <MenuItem value="Jira">Jira</MenuItem>
              <MenuItem value="GitLab">GitLab</MenuItem>
              <MenuItem value="ServiceNow">ServiceNow</MenuItem>
              <MenuItem value="Jenkins">Jenkins</MenuItem>
              <MenuItem value="AzureDevOps">Azure DevOps</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Base URL"
            fullWidth
            margin="normal"
            value={formData.base_url}
            onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            placeholder="https://your-instance.atlassian.net"
            required
          />
          <TextField
            label="Project Key"
            fullWidth
            margin="normal"
            value={formData.project_key}
            onChange={(e) => setFormData({ ...formData, project_key: e.target.value })}
            placeholder="PROJECT"
          />
          <TextField
            label="API Token"
            fullWidth
            margin="normal"
            type="password"
            value={formData.api_token}
            onChange={(e) => setFormData({ ...formData, api_token: e.target.value })}
            required
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateIntegration}>
            Add
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Integration</DialogTitle>
        <DialogContent>
          <TextField
            label="Name"
            fullWidth
            margin="normal"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />
          <TextField
            label="Base URL"
            fullWidth
            margin="normal"
            value={editFormData.base_url}
            onChange={(e) => setEditFormData({ ...editFormData, base_url: e.target.value })}
            required
          />
          <TextField
            label="Project Key"
            fullWidth
            margin="normal"
            value={editFormData.project_key}
            onChange={(e) => setEditFormData({ ...editFormData, project_key: e.target.value })}
          />
          <TextField
            label="API Token"
            fullWidth
            margin="normal"
            type="password"
            value={editFormData.api_token}
            onChange={(e) => setEditFormData({ ...editFormData, api_token: e.target.value })}
            placeholder="Leave empty to keep existing token"
            helperText="Leave empty to keep the existing API token"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateIntegration}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Integration</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the integration &quot;{selectedIntegration?.name}&quot;? 
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteIntegration}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
