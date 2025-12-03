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
  LinearProgress,
  Card,
  CardContent,
  Grid,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Storage as StorageIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { testDataAPI, environmentsAPI } from '@/lib/api';

interface Environment {
  env_instance_id: string;
  name: string;
  environment_name?: string;
}

interface TestDataSet {
  test_data_set_id: string;
  name: string;
  env_instance_id: string;
  application_id: string | null;
  data_generation_method: string;
  refresh_frequency: string | null;
  last_refreshed_date: string | null;
  data_completeness_score: number | null;
  constraints: string | null;
  env_instance_name?: string;
  environment_name?: string;
  application_name?: string;
  created_at?: string;
  updated_at?: string;
}

interface TestDataFormData {
  name: string;
  env_instance_id: string;
  application_id: string;
  data_generation_method: string;
  refresh_frequency: string;
  data_completeness_score: string;
  constraints: string;
}

const GENERATION_METHODS = ['Masked', 'Synthetic', 'Hybrid'];
const REFRESH_FREQUENCIES = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On-Demand', 'Never'];

export default function TestDataPage() {
  const [testDataSets, setTestDataSets] = useState<TestDataSet[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingData, setEditingData] = useState<TestDataSet | null>(null);
  const [formData, setFormData] = useState<TestDataFormData>({
    name: '',
    env_instance_id: '',
    application_id: '',
    data_generation_method: 'Synthetic',
    refresh_frequency: 'Weekly',
    data_completeness_score: '100',
    constraints: '',
  });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string | null; name: string }>({
    open: false,
    id: null,
    name: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [testDataResponse, envResponse] = await Promise.all([
        testDataAPI.getAll(),
        environmentsAPI.getAllInstances(),
      ]);
      setTestDataSets(testDataResponse.data.testDataSets || []);
      setEnvironments(envResponse.data.instances || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (testData?: TestDataSet) => {
    if (testData) {
      setEditingData(testData);
      setFormData({
        name: testData.name,
        env_instance_id: testData.env_instance_id || '',
        application_id: testData.application_id || '',
        data_generation_method: testData.data_generation_method || 'Synthetic',
        refresh_frequency: testData.refresh_frequency || 'Weekly',
        data_completeness_score: testData.data_completeness_score?.toString() || '100',
        constraints: testData.constraints || '',
      });
    } else {
      setEditingData(null);
      setFormData({
        name: '',
        env_instance_id: environments.length > 0 ? environments[0].env_instance_id : '',
        application_id: '',
        data_generation_method: 'Synthetic',
        refresh_frequency: 'Weekly',
        data_completeness_score: '100',
        constraints: '',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingData(null);
  };

  const handleSave = async () => {
    try {
      const data = {
        name: formData.name,
        env_instance_id: formData.env_instance_id,
        application_id: formData.application_id || null,
        data_generation_method: formData.data_generation_method,
        refresh_frequency: formData.refresh_frequency || null,
        data_completeness_score: formData.data_completeness_score ? parseInt(formData.data_completeness_score) : null,
        constraints: formData.constraints || null,
      };

      if (editingData) {
        await testDataAPI.update(editingData.test_data_set_id, data);
      } else {
        await testDataAPI.create(data);
      }
      handleCloseDialog();
      fetchData();
    } catch (err) {
      setError('Failed to save test data set');
      console.error(err);
    }
  };

  const handleRefresh = async (id: string) => {
    try {
      await testDataAPI.markRefreshed(id);
      fetchData();
    } catch (err) {
      setError('Failed to refresh test data set');
      console.error(err);
    }
  };

  const handleOpenDeleteDialog = (id: string, name: string) => {
    setDeleteDialog({ open: true, id, name });
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialog({ open: false, id: null, name: '' });
  };

  const handleConfirmDelete = async () => {
    if (!deleteDialog.id) return;

    try {
      await testDataAPI.delete(deleteDialog.id);
      handleCloseDeleteDialog();
      fetchData();
    } catch (err) {
      setError('Failed to delete test data set');
      console.error(err);
    }
  };

  const getMethodColor = (method: string): 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' => {
    const colors: Record<string, 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error'> = {
      Masked: 'primary',
      Synthetic: 'success',
      Hybrid: 'warning',
    };
    return colors[method] || 'default';
  };

  const getCompletenessColor = (score: number | null): 'error' | 'warning' | 'success' => {
    if (score === null) return 'warning';
    if (score >= 90) return 'success';
    if (score >= 70) return 'warning';
    return 'error';
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Calculate stats
  const stats = {
    total: testDataSets.length,
    byMethod: GENERATION_METHODS.reduce((acc, method) => {
      acc[method] = testDataSets.filter((d: TestDataSet) => d.data_generation_method === method).length;
      return acc;
    }, {} as Record<string, number>),
    avgCompleteness: testDataSets.length > 0
      ? testDataSets
          .filter((d: TestDataSet) => d.data_completeness_score !== null)
          .reduce((sum: number, d: TestDataSet) => sum + (d.data_completeness_score || 0), 0) /
        (testDataSets.filter((d: TestDataSet) => d.data_completeness_score !== null).length || 1)
      : 0,
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" component="h1">
          <StorageIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
          Test Data Management
        </Typography>
        <Button 
          variant="contained" 
          startIcon={<AddIcon />} 
          onClick={() => handleOpenDialog()}
          disabled={environments.length === 0}
        >
          Add Test Data Set
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {environments.length === 0 && !loading && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No environment instances found. Please create an environment instance first before adding test data sets.
        </Alert>
      )}

      {/* Stats Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Data Sets
              </Typography>
              <Typography variant="h4">{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Synthetic Data Sets
              </Typography>
              <Typography variant="h4">{stats.byMethod['Synthetic'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Masked Data Sets
              </Typography>
              <Typography variant="h4">{stats.byMethod['Masked'] || 0}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Avg. Completeness
              </Typography>
              <Typography variant="h4">{stats.avgCompleteness.toFixed(1)}%</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Environment</TableCell>
              <TableCell>Generation Method</TableCell>
              <TableCell>Refresh Frequency</TableCell>
              <TableCell>Last Refreshed</TableCell>
              <TableCell>Completeness</TableCell>
              <TableCell width={150}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : testDataSets.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center">
                  No test data sets found. Click &quot;Add Test Data Set&quot; to create one.
                </TableCell>
              </TableRow>
            ) : (
              testDataSets.map((testData: TestDataSet) => (
                <TableRow key={testData.test_data_set_id} hover>
                  <TableCell>
                    <Typography variant="body1" fontWeight="medium">
                      {testData.name}
                    </Typography>
                    {testData.application_name && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        App: {testData.application_name}
                      </Typography>
                    )}
                    {testData.constraints && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        Constraints: {testData.constraints}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">
                      {testData.env_instance_name || 'Unknown'}
                    </Typography>
                    {testData.environment_name && (
                      <Typography variant="caption" color="text.secondary">
                        ({testData.environment_name})
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={testData.data_generation_method}
                      color={getMethodColor(testData.data_generation_method)}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{testData.refresh_frequency || 'Not set'}</TableCell>
                  <TableCell>{formatDate(testData.last_refreshed_date)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={testData.data_completeness_score || 0}
                        color={getCompletenessColor(testData.data_completeness_score)}
                        sx={{ width: 60, height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="body2">
                        {testData.data_completeness_score !== null
                          ? `${testData.data_completeness_score}%`
                          : 'N/A'}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Tooltip title="Refresh Data">
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => handleRefresh(testData.test_data_set_id)}
                      >
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenDialog(testData)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() =>
                          handleOpenDeleteDialog(testData.test_data_set_id, testData.name)
                        }
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create/Edit Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingData ? 'Edit Test Data Set' : 'Create Test Data Set'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Name"
              value={formData.name}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
            />
            <FormControl fullWidth required>
              <InputLabel>Environment Instance</InputLabel>
              <Select
                value={formData.env_instance_id}
                label="Environment Instance"
                onChange={(e) => setFormData({ ...formData, env_instance_id: e.target.value })}
              >
                {environments.map((env: Environment) => (
                  <MenuItem key={env.env_instance_id} value={env.env_instance_id}>
                    {env.name} {env.environment_name && `(${env.environment_name})`}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Generation Method</InputLabel>
              <Select
                value={formData.data_generation_method}
                label="Generation Method"
                onChange={(e) => setFormData({ ...formData, data_generation_method: e.target.value })}
              >
                {GENERATION_METHODS.map((method) => (
                  <MenuItem key={method} value={method}>
                    {method}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Refresh Frequency</InputLabel>
              <Select
                value={formData.refresh_frequency}
                label="Refresh Frequency"
                onChange={(e) => setFormData({ ...formData, refresh_frequency: e.target.value })}
              >
                {REFRESH_FREQUENCIES.map((freq) => (
                  <MenuItem key={freq} value={freq}>
                    {freq}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Application ID (Optional)"
              value={formData.application_id}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, application_id: e.target.value })}
              fullWidth
              helperText="UUID of an application to associate with this test data"
            />
            <TextField
              label="Data Completeness Score (%)"
              value={formData.data_completeness_score}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, data_completeness_score: e.target.value })}
              fullWidth
              type="number"
              inputProps={{ min: 0, max: 100 }}
            />
            <TextField
              label="Constraints"
              value={formData.constraints}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFormData({ ...formData, constraints: e.target.value })}
              fullWidth
              multiline
              rows={3}
              helperText="Optional: Define data constraints or rules"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            onClick={handleSave} 
            variant="contained" 
            disabled={!formData.name || !formData.env_instance_id}
          >
            {editingData ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialog.open} onClose={handleCloseDeleteDialog}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete test data set &quot;{deleteDialog.name}&quot;?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDeleteDialog}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
