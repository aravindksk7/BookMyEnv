'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Grid,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Drawer,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  Tooltip,
  Stack,
  InputAdornment,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Badge,
} from '@mui/material';
import {
  Search as SearchIcon,
  FilterList as FilterIcon,
  Refresh as RefreshIcon,
  Download as DownloadIcon,
  Visibility as ViewIcon,
  ExpandMore as ExpandMoreIcon,
  Security as SecurityIcon,
  Assessment as ReportIcon,
  History as HistoryIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Close as CloseIcon,
  Save as SaveIcon,
  PlayArrow as GenerateIcon,
  Clear as ClearIcon,
} from '@mui/icons-material';
import { DateTimePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { auditAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface AuditEvent {
  audit_id: string;
  timestamp_utc: string;
  actor_user_id: string | null;
  actor_username: string;
  actor_display_name: string;
  actor_role: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  action_type: string;
  action_description: string | null;
  actor_ip_address: string | null;
  regulatory_tag: string | null;
  session_id: string | null;
  changed_fields: string[] | null;
  before_snapshot: Record<string, unknown> | null;
  after_snapshot: Record<string, unknown> | null;
}

interface AuditStats {
  summary: {
    total_events: string;
    events_today: string;
    events_last_7_days: string;
    events_last_30_days: string;
    failed_events: string;
    unauthorized_events: string;
  };
  topEntityTypes: Array<{ entity_type: string; count: string }>;
  topActors: Array<{ actor_user_name: string; count: string }>;
  actionDistribution: Array<{ action_type: string; count: string }>;
}

interface ReportTemplate {
  template_id: string;
  name: string;
  description: string;
  category: string;
  is_system_template: boolean;
}

interface FilterOptions {
  entityTypes: string[];
  actionTypes: string[];
  sourceChannels: string[];
  regulatoryTags: string[];
  actionResults: string[];
  roles: string[];
}

// Helper functions
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleString();
};

const getActionColor = (action: string): 'success' | 'error' | 'warning' | 'info' | 'default' => {
  switch (action) {
    case 'CREATE': return 'success';
    case 'DELETE': return 'error';
    case 'UPDATE': return 'info';
    case 'LOGIN': return 'default';
    case 'LOGOUT': return 'default';
    case 'FORCE_APPROVE': return 'warning';
    case 'UNAUTHORIZED': return 'error';
    default: return 'default';
  }
};

const getResultColor = (result: string): 'success' | 'error' | 'warning' | 'default' => {
  switch (result) {
    case 'SUCCESS': return 'success';
    case 'FAILED': return 'error';
    case 'UNAUTHORIZED': return 'error';
    case 'PARTIAL': return 'warning';
    default: return 'default';
  }
};

const getResultIcon = (result: string) => {
  switch (result) {
    case 'SUCCESS': return <SuccessIcon color="success" fontSize="small" />;
    case 'FAILED': return <ErrorIcon color="error" fontSize="small" />;
    case 'UNAUTHORIZED': return <WarningIcon color="warning" fontSize="small" />;
    default: return null;
  }
};

export default function AuditPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Events state
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [pagination, setPagination] = useState({
    page: 0,
    rowsPerPage: 25,
    totalCount: 0,
  });

  // Stats state
  const [stats, setStats] = useState<AuditStats | null>(null);

  // Filter state
  const [filters, setFilters] = useState({
    search: '',
    entityTypes: [] as string[],
    actionTypes: [] as string[],
    actorRole: '',
    sourceChannel: '',
    actionResult: '',
    regulatoryTag: '',
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
  });

  // Filter options
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);

  // Detail drawer state
  const [selectedEvent, setSelectedEvent] = useState<AuditEvent | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Report templates
  const [reportTemplates, setReportTemplates] = useState<ReportTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [reportLoading, setReportLoading] = useState(false);

  // Load filter options
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const response = await auditAPI.getFilterOptions();
        setFilterOptions(response.data.data);
      } catch (err) {
        console.error('Failed to load filter options:', err);
      }
    };
    loadOptions();
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const response = await auditAPI.getStats();
      setStats(response.data.data);
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  }, []);

  // Load events
  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: pagination.page + 1,
        limit: pagination.rowsPerPage,
        search: filters.search || undefined,
        entityTypes: filters.entityTypes.length > 0 ? filters.entityTypes.join(',') : undefined,
        actionTypes: filters.actionTypes.length > 0 ? filters.actionTypes.join(',') : undefined,
        actorRole: filters.actorRole || undefined,
        sourceChannel: filters.sourceChannel || undefined,
        actionResult: filters.actionResult || undefined,
        regulatoryTag: filters.regulatoryTag || undefined,
        dateFrom: filters.dateFrom?.toISOString(),
        dateTo: filters.dateTo?.toISOString(),
      };

      const response = await auditAPI.searchEvents(params);
      setEvents(response.data.data);
      setPagination(prev => ({
        ...prev,
        totalCount: response.data.pagination.totalCount,
      }));
    } catch (err) {
      console.error('Failed to load events:', err);
      setError('Failed to load audit events');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.rowsPerPage, filters]);

  // Load report templates
  const loadReportTemplates = useCallback(async () => {
    try {
      const response = await auditAPI.getReportTemplates();
      setReportTemplates(response.data.data);
    } catch (err) {
      console.error('Failed to load report templates:', err);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadEvents();
    loadReportTemplates();
  }, [loadStats, loadEvents, loadReportTemplates]);

  // Handle filter change
  const handleFilterChange = (field: string, value: unknown) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  // Clear filters
  const handleClearFilters = () => {
    setFilters({
      search: '',
      entityTypes: [],
      actionTypes: [],
      actorRole: '',
      sourceChannel: '',
      actionResult: '',
      regulatoryTag: '',
      dateFrom: null,
      dateTo: null,
    });
    setPagination(prev => ({ ...prev, page: 0 }));
  };

  // Handle page change
  const handlePageChange = (_: unknown, newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // Handle rows per page change
  const handleRowsPerPageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPagination({
      page: 0,
      rowsPerPage: parseInt(event.target.value, 10),
      totalCount: pagination.totalCount,
    });
  };

  // Open event detail
  const handleViewEvent = async (event: AuditEvent) => {
    try {
      const response = await auditAPI.getEventById(event.audit_id);
      setSelectedEvent(response.data.data);
      setDrawerOpen(true);
    } catch (err) {
      console.error('Failed to load event details:', err);
    }
  };

  // Export events
  const handleExport = async (format: 'json' | 'csv') => {
    try {
      const response = await auditAPI.exportEvents({
        filters: {
          search: filters.search,
          entityTypes: filters.entityTypes,
          actionTypes: filters.actionTypes,
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
        },
        format,
      });

      if (format === 'csv') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-export-${new Date().toISOString()}.csv`;
        a.click();
      } else {
        const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `audit-export-${new Date().toISOString()}.json`;
        a.click();
      }
    } catch (err) {
      console.error('Failed to export:', err);
      setError('Failed to export audit events');
    }
  };

  // Generate report
  const handleGenerateReport = async () => {
    if (!selectedTemplate) return;
    
    setReportLoading(true);
    try {
      const response = await auditAPI.generateReport({
        templateId: selectedTemplate,
        filters: {
          dateFrom: filters.dateFrom?.toISOString(),
          dateTo: filters.dateTo?.toISOString(),
        },
      });
      
      // Download as JSON
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${response.data.data.templateName}-${new Date().toISOString()}.json`;
      a.click();
    } catch (err) {
      console.error('Failed to generate report:', err);
      setError('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  // Check if user has access
  const hasAccess = user && ['Admin', 'EnvironmentManager', 'ProjectLead'].includes(user.role);

  if (!hasAccess) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">
          You do not have permission to access the Audit & Compliance page.
          This feature is available to Admin, Environment Manager, and Project Lead roles.
        </Alert>
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box sx={{ p: 3 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <SecurityIcon sx={{ fontSize: 32, color: 'primary.main' }} />
            <Typography variant="h4">Audit & Compliance</Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Tooltip title="Refresh">
              <IconButton onClick={() => { loadStats(); loadEvents(); }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {user?.role === 'Admin' && (
              <>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('csv')}
                >
                  Export CSV
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<DownloadIcon />}
                  onClick={() => handleExport('json')}
                >
                  Export JSON
                </Button>
              </>
            )}
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Stats Cards */}
        {stats && (
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="primary">
                    {parseInt(stats.summary.events_today).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Events Today
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="info.main">
                    {parseInt(stats.summary.events_last_7_days).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last 7 Days
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="secondary.main">
                    {parseInt(stats.summary.events_last_30_days).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Last 30 Days
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4">
                    {parseInt(stats.summary.total_events).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Total Events
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="error.main">
                    {parseInt(stats.summary.failed_events).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Failed Events
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 2 }}>
                  <Typography variant="h4" color="warning.main">
                    {parseInt(stats.summary.unauthorized_events).toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Unauthorized
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Tabs */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={activeTab} onChange={(_, v) => setActiveTab(v)}>
            <Tab icon={<HistoryIcon />} label="Audit Events" iconPosition="start" />
            <Tab icon={<ReportIcon />} label="Reports" iconPosition="start" />
          </Tabs>
        </Paper>

        {/* Audit Events Tab */}
        {activeTab === 0 && (
          <>
            {/* Filters */}
            <Accordion defaultExpanded sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <FilterIcon />
                  <Typography>Search & Filters</Typography>
                  {(filters.search || filters.entityTypes.length > 0 || filters.actionTypes.length > 0 || 
                    filters.dateFrom || filters.dateTo) && (
                    <Chip label="Active" size="small" color="primary" />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  {/* Search */}
                  <Grid item xs={12} md={4}>
                    <TextField
                      fullWidth
                      label="Search"
                      placeholder="Search entity name, actor, comment..."
                      value={filters.search}
                      onChange={(e) => handleFilterChange('search', e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon />
                          </InputAdornment>
                        ),
                      }}
                    />
                  </Grid>

                  {/* Date Range */}
                  <Grid item xs={12} sm={6} md={2}>
                    <DateTimePicker
                      label="From Date"
                      value={filters.dateFrom}
                      onChange={(date) => handleFilterChange('dateFrom', date)}
                      slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6} md={2}>
                    <DateTimePicker
                      label="To Date"
                      value={filters.dateTo}
                      onChange={(date) => handleFilterChange('dateTo', date)}
                      slotProps={{ textField: { fullWidth: true, size: 'medium' } }}
                    />
                  </Grid>

                  {/* Entity Types */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Entity Type</InputLabel>
                      <Select
                        multiple
                        value={filters.entityTypes}
                        onChange={(e) => handleFilterChange('entityTypes', e.target.value)}
                        label="Entity Type"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {filterOptions?.entityTypes.map((type) => (
                          <MenuItem key={type} value={type}>{type}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Action Types */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Action</InputLabel>
                      <Select
                        multiple
                        value={filters.actionTypes}
                        onChange={(e) => handleFilterChange('actionTypes', e.target.value)}
                        label="Action"
                        renderValue={(selected) => (
                          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                            {(selected as string[]).map((value) => (
                              <Chip key={value} label={value} size="small" />
                            ))}
                          </Box>
                        )}
                      >
                        {filterOptions?.actionTypes.map((type) => (
                          <MenuItem key={type} value={type}>{type}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Source Channel */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Source</InputLabel>
                      <Select
                        value={filters.sourceChannel}
                        onChange={(e) => handleFilterChange('sourceChannel', e.target.value)}
                        label="Source"
                      >
                        <MenuItem value="">All</MenuItem>
                        {filterOptions?.sourceChannels.map((channel) => (
                          <MenuItem key={channel} value={channel}>{channel}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Result */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Result</InputLabel>
                      <Select
                        value={filters.actionResult}
                        onChange={(e) => handleFilterChange('actionResult', e.target.value)}
                        label="Result"
                      >
                        <MenuItem value="">All</MenuItem>
                        {filterOptions?.actionResults.map((result) => (
                          <MenuItem key={result} value={result}>{result}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Regulatory Tag */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Regulatory Tag</InputLabel>
                      <Select
                        value={filters.regulatoryTag}
                        onChange={(e) => handleFilterChange('regulatoryTag', e.target.value)}
                        label="Regulatory Tag"
                      >
                        <MenuItem value="">All</MenuItem>
                        {filterOptions?.regulatoryTags.map((tag) => (
                          <MenuItem key={tag} value={tag}>{tag}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Role */}
                  <Grid item xs={12} sm={6} md={2}>
                    <FormControl fullWidth>
                      <InputLabel>Actor Role</InputLabel>
                      <Select
                        value={filters.actorRole}
                        onChange={(e) => handleFilterChange('actorRole', e.target.value)}
                        label="Actor Role"
                      >
                        <MenuItem value="">All</MenuItem>
                        {filterOptions?.roles.map((role) => (
                          <MenuItem key={role} value={role}>{role}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  {/* Actions */}
                  <Grid item xs={12}>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        variant="contained"
                        startIcon={<SearchIcon />}
                        onClick={loadEvents}
                      >
                        Search
                      </Button>
                      <Button
                        variant="outlined"
                        startIcon={<ClearIcon />}
                        onClick={handleClearFilters}
                      >
                        Clear Filters
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Events Table */}
            <Paper>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Actor</TableCell>
                      <TableCell>Action</TableCell>
                      <TableCell>Entity Type</TableCell>
                      <TableCell>Entity Name</TableCell>
                      <TableCell>Result</TableCell>
                      <TableCell>Source</TableCell>
                      <TableCell>Tags</TableCell>
                      <TableCell align="center">Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <CircularProgress />
                        </TableCell>
                      </TableRow>
                    ) : events.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} align="center" sx={{ py: 4 }}>
                          <Typography color="text.secondary">No audit events found</Typography>
                        </TableCell>
                      </TableRow>
                    ) : (
                      events.map((event) => (
                        <TableRow key={event.audit_id} hover>
                          <TableCell sx={{ whiteSpace: 'nowrap' }}>
                            {formatDate(event.timestamp_utc)}
                          </TableCell>
                          <TableCell>
                            <Box>
                              <Typography variant="body2">{event.actor_display_name || event.actor_username}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {event.actor_role}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={event.action_type}
                              size="small"
                              color={getActionColor(event.action_type)}
                            />
                          </TableCell>
                          <TableCell>{event.entity_type}</TableCell>
                          <TableCell>
                            <Tooltip title={event.entity_name || 'N/A'}>
                              <Typography
                                variant="body2"
                                sx={{
                                  maxWidth: 200,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {event.entity_name || 'N/A'}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={event.action_type}
                              size="small"
                              color={getActionColor(event.action_type)}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">{event.action_description || '-'}</Typography>
                          </TableCell>
                          <TableCell>
                            {event.regulatory_tag && (
                              <Chip
                                label={event.regulatory_tag}
                                size="small"
                                color="warning"
                                variant="outlined"
                              />
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <IconButton size="small" onClick={() => handleViewEvent(event)}>
                              <ViewIcon fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={pagination.totalCount}
                page={pagination.page}
                onPageChange={handlePageChange}
                rowsPerPage={pagination.rowsPerPage}
                onRowsPerPageChange={handleRowsPerPageChange}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Paper>
          </>
        )}

        {/* Reports Tab */}
        {activeTab === 1 && (
          <Grid container spacing={3}>
            {/* Report Templates */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Report Templates" />
                <CardContent>
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Select Template</InputLabel>
                    <Select
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      label="Select Template"
                    >
                      {reportTemplates.map((template) => (
                        <MenuItem key={template.template_id} value={template.template_id}>
                          <Box>
                            <Typography>{template.name}</Typography>
                            <Typography variant="caption" color="text.secondary">
                              {template.category} • {template.is_system_template ? 'System' : 'Custom'}
                            </Typography>
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  {selectedTemplate && (
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        {reportTemplates.find(t => t.template_id === selectedTemplate)?.description}
                      </Typography>
                    </Box>
                  )}

                  <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                    <DateTimePicker
                      label="From Date"
                      value={filters.dateFrom}
                      onChange={(date) => handleFilterChange('dateFrom', date)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                    <DateTimePicker
                      label="To Date"
                      value={filters.dateTo}
                      onChange={(date) => handleFilterChange('dateTo', date)}
                      slotProps={{ textField: { fullWidth: true } }}
                    />
                  </Box>

                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={reportLoading ? <CircularProgress size={20} /> : <GenerateIcon />}
                    onClick={handleGenerateReport}
                    disabled={!selectedTemplate || reportLoading}
                  >
                    Generate Report
                  </Button>
                </CardContent>
              </Card>
            </Grid>

            {/* Available Templates List */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardHeader title="Available Templates" />
                <CardContent sx={{ p: 0 }}>
                  <List dense>
                    {reportTemplates.map((template) => (
                      <ListItem
                        key={template.template_id}
                        divider
                        sx={{
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' },
                        }}
                        onClick={() => setSelectedTemplate(template.template_id)}
                      >
                        <ListItemText
                          primary={template.name}
                          secondary={
                            <>
                              {template.description}
                              {template.is_system_template && ' • System'}
                              {' • '}
                              {template.category}
                            </>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        )}

        {/* Event Detail Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { width: { xs: '100%', sm: 500 } } }}
        >
          {selectedEvent && (
            <Box sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Audit Event Details</Typography>
                <IconButton onClick={() => setDrawerOpen(false)}>
                  <CloseIcon />
                </IconButton>
              </Box>

              <Divider sx={{ mb: 2 }} />

              {/* Header */}
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                  <Chip
                    label={selectedEvent.action_type}
                    color={getActionColor(selectedEvent.action_type)}
                  />
                  <Chip
                    label={selectedEvent.entity_type}
                    variant="outlined"
                  />
                </Box>
                <Typography variant="h6">{selectedEvent.entity_name || 'N/A'}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {formatDate(selectedEvent.timestamp_utc)}
                </Typography>
              </Box>

              {/* Actor Info */}
              <Card variant="outlined" sx={{ mb: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" gutterBottom>Actor</Typography>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Name</Typography>
                      <Typography variant="body2">{selectedEvent.actor_display_name || selectedEvent.actor_username}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Role</Typography>
                      <Typography variant="body2">{selectedEvent.actor_role}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Description</Typography>
                      <Typography variant="body2">{selectedEvent.action_description || '-'}</Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">IP Address</Typography>
                      <Typography variant="body2">{selectedEvent.actor_ip_address || 'N/A'}</Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Changed Fields */}
              {selectedEvent.changed_fields && selectedEvent.changed_fields.length > 0 && (
                <Card variant="outlined" sx={{ mb: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Changed Fields</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {selectedEvent.changed_fields.map((field) => (
                        <Chip key={field} label={field} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </CardContent>
                </Card>
              )}

              {/* Before/After Comparison */}
              {(selectedEvent.before_snapshot || selectedEvent.after_snapshot) && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2">State Comparison</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Grid container spacing={2}>
                      {selectedEvent.before_snapshot && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">Before</Typography>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'error.light', maxHeight: 200, overflow: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(selectedEvent.before_snapshot, null, 2)}
                            </pre>
                          </Paper>
                        </Grid>
                      )}
                      {selectedEvent.after_snapshot && (
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary">After</Typography>
                          <Paper variant="outlined" sx={{ p: 1, bgcolor: 'success.light', maxHeight: 200, overflow: 'auto' }}>
                            <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                              {JSON.stringify(selectedEvent.after_snapshot, null, 2)}
                            </pre>
                          </Paper>
                        </Grid>
                      )}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* Comment */}
              {selectedEvent.comment && (
                <Card variant="outlined" sx={{ mb: 2, mt: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Comment</Typography>
                    <Typography variant="body2">{selectedEvent.comment}</Typography>
                  </CardContent>
                </Card>
              )}

              {/* Error Message */}
              {selectedEvent.error_message && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  <Typography variant="subtitle2">Error</Typography>
                  <Typography variant="body2">{selectedEvent.error_message}</Typography>
                </Alert>
              )}

              {/* Regulatory Tag */}
              {selectedEvent.regulatory_tag && (
                <Card variant="outlined" sx={{ mt: 2 }}>
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>Regulatory Context</Typography>
                    <Chip label={selectedEvent.regulatory_tag} color="warning" />
                  </CardContent>
                </Card>
              )}

              {/* Technical Metadata */}
              <Accordion sx={{ mt: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Technical Details</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Typography variant="caption" display="block">
                    <strong>Audit ID:</strong> {selectedEvent.audit_id}
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Entity ID:</strong> {selectedEvent.entity_id || 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Correlation ID:</strong> {selectedEvent.correlation_id || 'N/A'}
                  </Typography>
                  <Typography variant="caption" display="block">
                    <strong>Actor User ID:</strong> {selectedEvent.actor_user_id || 'N/A'}
                  </Typography>
                </AccordionDetails>
              </Accordion>
            </Box>
          )}
        </Drawer>
      </Box>
    </LocalizationProvider>
  );
}
