'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
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
  Alert,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Autocomplete,
  Collapse,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  CalendarMonth as CalendarIcon,
  TableRows as TableIcon,
  Warning as WarningIcon,
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  ArrowForward as ArrowForwardIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  Apps as AppsIcon,
  SwapHoriz as InterfaceIcon,
  Storage as InstanceIcon,
  Link as LinkIcon,
} from '@mui/icons-material';
import { bookingsAPI, environmentsAPI, applicationsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface Booking {
  booking_id: string;
  booking_type: string;
  project_id: string;
  test_phase: string;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  booking_status: string;
  conflict_status: string;
  conflict_notes: string;
  requested_by_name: string;
  approved_by_name: string;
  owning_group_name: string;
  resource_count: number;
  created_at: string;
  resources?: Array<{
    environment_id: string;
    instance_name: string;
    environment_name: string;
  }>;
}

interface Environment {
  environment_id: string;
  name: string;
  environment_type: string;
}

interface EnvironmentInstance {
  env_instance_id: string;
  name: string;
  environment_name: string;
}

interface ConflictInfo {
  resource_type: string;
  resource_ref_id: string;
  resource_name: string;
  conflicting_booking_id: string;
  conflicting_title: string;
  conflicting_start: string;
  conflicting_end: string;
}

interface Application {
  application_id: string;
  name: string;
  short_code: string;
  tier: string;
  status: string;
  owning_group_name?: string;
}

interface Interface {
  interface_id: string;
  name: string;
  direction: string;
  pattern: string;
  frequency: string;
  status: string;
  source_application_name?: string;
  target_application_name?: string;
}

interface Instance {
  env_instance_id: string;
  name: string;
  environment_name: string;
  environment_category: string;
  operational_status: string;
  logical_role?: string;
  resource_booking_status?: string;
}

const TEST_PHASES = ['SIT', 'UAT', 'NFT', 'Performance', 'DRRehearsal', 'PenTest', 'Other'];
const BOOKING_TYPES = ['SingleEnv', 'MultiEnvE2E'];
const BOOKING_STATUSES = ['Requested', 'PendingApproval', 'Approved', 'Active', 'Completed', 'Cancelled'];
const LOGICAL_ROLES = ['SystemUnderTest', 'UpstreamDependency', 'DownstreamDependency', 'SharedInfra', 'DataStore', 'MessageBroker', 'SupportService', 'Other'];

export default function BookingsPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [instances, setInstances] = useState<EnvironmentInstance[]>([]);
  const [allApplications, setAllApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Main tab - Booking List vs Booking View
  const [mainTab, setMainTab] = useState<'list' | 'view'>('list');
  const [viewingBooking, setViewingBooking] = useState<Booking | null>(null);
  const [viewTabValue, setViewTabValue] = useState(0);
  
  // Related data for Booking View
  const [relatedApplications, setRelatedApplications] = useState<Application[]>([]);
  const [relatedInterfaces, setRelatedInterfaces] = useState<Interface[]>([]);
  const [relatedInstances, setRelatedInstances] = useState<Instance[]>([]);
  const [loadingRelated, setLoadingRelated] = useState(false);

  // View mode
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  const [tabValue, setTabValue] = useState(0);

  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterTestPhase, setFilterTestPhase] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterEnvironment, setFilterEnvironment] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);

  // Calendar state
  const [currentDate, setCurrentDate] = useState(new Date());

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [conflictDialogOpen, setConflictDialogOpen] = useState(false);

  // Selected booking
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [detailedBooking, setDetailedBooking] = useState<any>(null);
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);

  // Form state
  const [formData, setFormData] = useState({
    booking_type: 'SingleEnv',
    project_id: '',
    test_phase: 'SIT',
    title: '',
    description: '',
    start_datetime: '',
    end_datetime: '',
    resources: [] as { resource_type: string; resource_ref_id: string; logical_role: string }[],
  });

  const [selectedInstances, setSelectedInstances] = useState<EnvironmentInstance[]>([]);

  const canEdit = user?.role === 'Admin' || user?.role === 'EnvironmentManager' || user?.role === 'ProjectLead';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bookingsRes, envsRes, appsRes] = await Promise.all([
        bookingsAPI.getAll(),
        environmentsAPI.getAll(),
        applicationsAPI.getAll(),
      ]);
      setBookings(bookingsRes.data.bookings || []);
      setEnvironments(envsRes.data.environments || []);
      setAllApplications(appsRes.data.applications || []);

      // Fetch all instances
      const envs = envsRes.data.environments || [];
      const allInstances: EnvironmentInstance[] = [];
      for (const env of envs) {
        try {
          const instancesRes = await environmentsAPI.getInstances(env.environment_id);
          const envInstances = instancesRes.data.instances || instancesRes.data || [];
          envInstances.forEach((inst: any) => {
            allInstances.push({
              ...inst,
              environment_name: env.name,
            });
          });
        } catch (e) {
          // Ignore errors for individual environments
        }
      }
      setInstances(allInstances);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const fetchBookingDetails = async (bookingId: string) => {
    try {
      const response = await bookingsAPI.getById(bookingId);
      setDetailedBooking(response.data);
    } catch (err: any) {
      setError('Failed to fetch booking details');
    }
  };

  // Fetch related entities for Booking View
  const fetchBookingRelatedData = useCallback(async (bookingId: string) => {
    try {
      setLoadingRelated(true);
      const [appsRes, interfacesRes, instancesRes] = await Promise.all([
        bookingsAPI.getRelatedApplications(bookingId),
        bookingsAPI.getRelatedInterfaces(bookingId),
        bookingsAPI.getRelatedInstances(bookingId),
      ]);
      setRelatedApplications(appsRes.data.applications || []);
      setRelatedInterfaces(interfacesRes.data.interfaces || []);
      setRelatedInstances(instancesRes.data.instances || []);
    } catch (err: any) {
      console.error('Failed to fetch related data:', err);
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  // Open Booking View
  const openBookingView = async (booking: Booking) => {
    setViewingBooking(booking);
    setViewTabValue(0);
    setMainTab('view');
    await fetchBookingDetails(booking.booking_id);
    await fetchBookingRelatedData(booking.booking_id);
  };

  // Close Booking View and return to list
  const closeBookingView = () => {
    setMainTab('list');
    setViewingBooking(null);
    setDetailedBooking(null);
    setRelatedApplications([]);
    setRelatedInterfaces([]);
    setRelatedInstances([]);
  };

  const checkConflicts = async () => {
    if (!formData.start_datetime || !formData.end_datetime || selectedInstances.length === 0) {
      setConflicts([]);
      return [];
    }

    try {
      // Check for overlapping bookings for each selected instance
      const conflictList: ConflictInfo[] = [];
      
      for (const instance of selectedInstances) {
        // Filter bookings that overlap with the selected time range and have this instance
        const overlappingBookings = bookings.filter(b => {
          const bookingStart = new Date(b.start_datetime);
          const bookingEnd = new Date(b.end_datetime);
          const formStart = new Date(formData.start_datetime);
          const formEnd = new Date(formData.end_datetime);
          
          // Check time overlap
          const hasOverlap = bookingStart < formEnd && bookingEnd > formStart;
          
          // Skip completed or cancelled bookings
          const isActive = !['Completed', 'Cancelled'].includes(b.booking_status);
          
          return hasOverlap && isActive;
        });

        for (const booking of overlappingBookings) {
          conflictList.push({
            resource_type: 'EnvironmentInstance',
            resource_ref_id: instance.env_instance_id,
            resource_name: instance.name,
            conflicting_booking_id: booking.booking_id,
            conflicting_title: booking.title || 'Untitled Booking',
            conflicting_start: booking.start_datetime,
            conflicting_end: booking.end_datetime,
          });
        }
      }

      setConflicts(conflictList);
      return conflictList;
    } catch (err) {
      console.error('Error checking conflicts:', err);
      return [];
    }
  };

  useEffect(() => {
    if (createDialogOpen || editDialogOpen) {
      checkConflicts();
    }
  }, [formData.start_datetime, formData.end_datetime, selectedInstances, createDialogOpen, editDialogOpen]);

  const handleCreateBooking = async () => {
    try {
      // Prepare resources - use valid logical_role value or null
      const resources = selectedInstances.map(inst => ({
        resource_type: 'EnvironmentInstance',
        resource_ref_id: inst.env_instance_id,
        logical_role: 'SystemUnderTest',
      }));

      await bookingsAPI.create({
        ...formData,
        resources,
      });
      setSuccess('Booking created successfully');
      setCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to create booking');
    }
  };

  const handleUpdateBooking = async () => {
    if (!selectedBooking) return;
    try {
      await bookingsAPI.update(selectedBooking.booking_id, formData);
      setSuccess('Booking updated successfully');
      setEditDialogOpen(false);
      resetForm();
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update booking');
    }
  };

  const handleDeleteBooking = async () => {
    if (!selectedBooking) return;
    try {
      await bookingsAPI.delete(selectedBooking.booking_id);
      setSuccess('Booking deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedBooking(null);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to delete booking');
    }
  };

  const handleUpdateStatus = async (bookingId: string, newStatus: string) => {
    try {
      await bookingsAPI.updateStatus(bookingId, { booking_status: newStatus });
      setSuccess(`Booking status updated to ${newStatus}`);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Failed to update status');
    }
  };

  const resetForm = () => {
    setFormData({
      booking_type: 'SingleEnv',
      project_id: '',
      test_phase: 'SIT',
      title: '',
      description: '',
      start_datetime: '',
      end_datetime: '',
      resources: [],
    });
    setSelectedInstances([]);
    setConflicts([]);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const openEditDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setFormData({
      booking_type: booking.booking_type,
      project_id: booking.project_id || '',
      test_phase: booking.test_phase,
      title: booking.title || '',
      description: booking.description || '',
      start_datetime: booking.start_datetime ? booking.start_datetime.slice(0, 16) : '',
      end_datetime: booking.end_datetime ? booking.end_datetime.slice(0, 16) : '',
      resources: [],
    });
    setEditDialogOpen(true);
  };

  const openViewDialog = async (booking: Booking) => {
    setSelectedBooking(booking);
    await fetchBookingDetails(booking.booking_id);
    setViewDialogOpen(true);
  };

  const openDeleteDialog = (booking: Booking) => {
    setSelectedBooking(booking);
    setDeleteDialogOpen(true);
  };

  const getStatusColor = (status: string): 'success' | 'warning' | 'error' | 'info' | 'default' => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'info' | 'default' } = {
      Active: 'success',
      Approved: 'success',
      Requested: 'info',
      PendingApproval: 'warning',
      Completed: 'default',
      Cancelled: 'error',
    };
    return colors[status] || 'default';
  };

  const getConflictColor = (status: string): 'success' | 'warning' | 'error' | 'default' => {
    const colors: { [key: string]: 'success' | 'warning' | 'error' | 'default' } = {
      None: 'success',
      PotentialConflict: 'warning',
      ConflictConfirmed: 'error',
      Resolved: 'success',
    };
    return colors[status] || 'default';
  };

  // Apply all filters
  const filteredBookings = bookings.filter((booking: Booking) => {
    // Tab filter
    if (tabValue === 1 && !['Active', 'Approved'].includes(booking.booking_status)) return false;
    if (tabValue === 2 && !['Requested', 'PendingApproval'].includes(booking.booking_status)) return false;
    if (tabValue === 3 && !['Completed', 'Cancelled'].includes(booking.booking_status)) return false;

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        (booking.title?.toLowerCase().includes(query)) ||
        (booking.description?.toLowerCase().includes(query)) ||
        (booking.test_phase?.toLowerCase().includes(query)) ||
        (booking.requested_by_name?.toLowerCase().includes(query)) ||
        (booking.project_id?.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Test phase filter
    if (filterTestPhase && booking.test_phase !== filterTestPhase) return false;

    // Status filter
    if (filterStatus && booking.booking_status !== filterStatus) return false;

    // Environment filter - check if booking has resources from selected environment
    if (filterEnvironment && booking.resources) {
      const hasMatchingEnv = booking.resources.some((r: any) => r.environment_id === filterEnvironment);
      if (!hasMatchingEnv) return false;
    }

    return true;
  });

  // Calendar helpers
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getBookingsForDay = (day: number) => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return filteredBookings.filter((b: Booking) => {
      const start = b.start_datetime.split('T')[0];
      const end = b.end_datetime.split('T')[0];
      return start <= dateStr && end >= dateStr && !['Completed', 'Cancelled'].includes(b.booking_status);
    });
  };

  const renderCalendar = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];
    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Header
    const header = weekDays.map(day => (
      <Box key={day} sx={{ flex: 1, textAlign: 'center', fontWeight: 'bold', p: 1, bgcolor: 'primary.main', color: 'white' }}>
        {day}
      </Box>
    ));

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      days.push(<Box key={`empty-${i}`} sx={{ flex: 1, minHeight: 100, border: '1px solid #e0e0e0', bgcolor: '#f5f5f5' }} />);
    }

    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
      const dayBookings = getBookingsForDay(day);
      const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

      days.push(
        <Box
          key={day}
          sx={{
            flex: 1,
            minHeight: 100,
            border: '1px solid #e0e0e0',
            p: 0.5,
            bgcolor: isToday ? 'primary.light' : 'white',
            overflow: 'hidden',
          }}
        >
          <Typography variant="body2" fontWeight={isToday ? 'bold' : 'normal'} sx={{ mb: 0.5 }}>
            {day}
          </Typography>
          {dayBookings.slice(0, 3).map((b, idx) => (
            <Chip
              key={b.booking_id}
              label={b.title || b.test_phase}
              size="small"
              color={getStatusColor(b.booking_status)}
              sx={{ width: '100%', mb: 0.25, fontSize: '0.7rem', height: 20 }}
              onClick={() => openBookingView(b)}
            />
          ))}
          {dayBookings.length > 3 && (
            <Typography variant="caption" color="text.secondary">
              +{dayBookings.length - 3} more
            </Typography>
          )}
        </Box>
      );
    }

    // Fill remaining cells
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;
    for (let i = firstDay + daysInMonth; i < totalCells; i++) {
      days.push(<Box key={`empty-end-${i}`} sx={{ flex: 1, minHeight: 100, border: '1px solid #e0e0e0', bgcolor: '#f5f5f5' }} />);
    }

    // Group into weeks
    const weeks = [];
    for (let i = 0; i < days.length; i += 7) {
      weeks.push(
        <Box key={`week-${i}`} sx={{ display: 'flex' }}>
          {days.slice(i, i + 7)}
        </Box>
      );
    }

    return (
      <Card>
        <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <IconButton onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1))}>
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6">
            {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
          </Typography>
          <IconButton onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1))}>
            <ArrowForwardIcon />
          </IconButton>
        </Box>
        <Box sx={{ display: 'flex' }}>{header}</Box>
        {weeks}
      </Card>
    );
  };

  if (loading) {
    return <LinearProgress />;
  }

  // Booking View - detailed view of a single booking with tabs
  if (mainTab === 'view' && viewingBooking) {
    return (
      <Box>
        {/* Header */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <IconButton onClick={closeBookingView}>
              <ArrowBackIcon />
            </IconButton>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 600 }}>
                {viewingBooking.title || 'Booking Details'}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                <Chip label={viewingBooking.booking_status} size="small" color={getStatusColor(viewingBooking.booking_status)} />
                <Chip label={viewingBooking.test_phase} size="small" variant="outlined" />
                {viewingBooking.conflict_status !== 'None' && (
                  <Chip label={viewingBooking.conflict_status} size="small" color={getConflictColor(viewingBooking.conflict_status)} icon={<WarningIcon />} />
                )}
              </Box>
            </Box>
          </Box>
          <Box>
            {canEdit && !['Completed', 'Cancelled'].includes(viewingBooking.booking_status) && (
              <>
                {viewingBooking.booking_status === 'Requested' && (
                  <Button color="success" variant="contained" sx={{ mr: 1 }} onClick={() => handleUpdateStatus(viewingBooking.booking_id, 'Approved')}>
                    Approve
                  </Button>
                )}
                <Button variant="outlined" sx={{ mr: 1 }} onClick={() => openEditDialog(viewingBooking)}>
                  Edit
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

        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {/* Booking Info Summary */}
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2" color="text.secondary">Time Period</Typography>
                <Typography>
                  {new Date(viewingBooking.start_datetime).toLocaleString()} — {new Date(viewingBooking.end_datetime).toLocaleString()}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Requested By</Typography>
                <Typography>{viewingBooking.requested_by_name || '-'}</Typography>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" color="text.secondary">Owning Group</Typography>
                <Typography>{viewingBooking.owning_group_name || '-'}</Typography>
              </Grid>
              {viewingBooking.description && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">Description</Typography>
                  <Typography>{viewingBooking.description}</Typography>
                </Grid>
              )}
            </Grid>
          </CardContent>
        </Card>

        {/* Tabs for Applications, Interfaces, Instances */}
        <Card>
          <Tabs value={viewTabValue} onChange={(_, v) => setViewTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}>
            <Tab icon={<AppsIcon />} iconPosition="start" label={`Applications (${relatedApplications.length})`} />
            <Tab icon={<InterfaceIcon />} iconPosition="start" label={`Interfaces (${relatedInterfaces.length})`} />
            <Tab icon={<InstanceIcon />} iconPosition="start" label={`Instances (${relatedInstances.length})`} />
          </Tabs>

          {loadingRelated ? (
            <Box sx={{ p: 3 }}><LinearProgress /></Box>
          ) : (
            <>
              {/* Applications Tab */}
              {viewTabValue === 0 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Short Code</TableCell>
                        <TableCell>Tier</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Owner</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {relatedApplications.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} align="center">
                            <Typography color="text.secondary" sx={{ py: 2 }}>
                              No applications associated with this booking
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedApplications.map((app) => (
                          <TableRow key={app.application_id} hover>
                            <TableCell>
                              <Typography fontWeight={500}>{app.name}</Typography>
                            </TableCell>
                            <TableCell>{app.short_code}</TableCell>
                            <TableCell>{app.tier}</TableCell>
                            <TableCell>
                              <Chip label={app.status} size="small" color={app.status === 'Active' ? 'success' : 'default'} />
                            </TableCell>
                            <TableCell>{app.owning_group_name || '-'}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Interfaces Tab */}
              {viewTabValue === 1 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Direction</TableCell>
                        <TableCell>Pattern</TableCell>
                        <TableCell>Frequency</TableCell>
                        <TableCell>Source App</TableCell>
                        <TableCell>Target App</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {relatedInterfaces.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} align="center">
                            <Typography color="text.secondary" sx={{ py: 2 }}>
                              No interfaces associated with this booking
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedInterfaces.map((iface) => (
                          <TableRow key={iface.interface_id} hover>
                            <TableCell>
                              <Typography fontWeight={500}>{iface.name}</Typography>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={iface.direction} 
                                size="small" 
                                color={iface.direction === 'Inbound' ? 'info' : iface.direction === 'Outbound' ? 'warning' : 'default'}
                              />
                            </TableCell>
                            <TableCell>{iface.pattern}</TableCell>
                            <TableCell>{iface.frequency}</TableCell>
                            <TableCell>{iface.source_application_name || '-'}</TableCell>
                            <TableCell>{iface.target_application_name || '-'}</TableCell>
                            <TableCell>
                              <Chip label={iface.status} size="small" color={iface.status === 'Active' ? 'success' : 'default'} />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {/* Instances Tab */}
              {viewTabValue === 2 && (
                <TableContainer>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Instance Name</TableCell>
                        <TableCell>Environment</TableCell>
                        <TableCell>Category</TableCell>
                        <TableCell>Logical Role</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Booking Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {relatedInstances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} align="center">
                            <Typography color="text.secondary" sx={{ py: 2 }}>
                              No instances associated with this booking
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        relatedInstances.map((inst) => (
                          <TableRow key={inst.env_instance_id} hover>
                            <TableCell>
                              <Typography fontWeight={500}>{inst.name}</Typography>
                            </TableCell>
                            <TableCell>{inst.environment_name}</TableCell>
                            <TableCell>
                              <Chip label={inst.environment_category} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>{inst.logical_role || '-'}</TableCell>
                            <TableCell>
                              <Chip label={inst.operational_status} size="small" color={inst.operational_status === 'Available' ? 'success' : 'default'} />
                            </TableCell>
                            <TableCell>
                              <Chip 
                                label={inst.resource_booking_status || 'N/A'} 
                                size="small" 
                                color={inst.resource_booking_status === 'Active' ? 'success' : inst.resource_booking_status === 'Reserved' ? 'warning' : 'default'}
                              />
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </>
          )}
        </Card>

        {/* Edit Dialog - reuse existing */}
        <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Edit Booking</DialogTitle>
          <DialogContent>
            <TextField
              label="Title"
              fullWidth
              margin="normal"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              margin="normal"
              multiline
              rows={2}
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <FormControl fullWidth>
                  <InputLabel>Test Phase</InputLabel>
                  <Select
                    value={formData.test_phase}
                    label="Test Phase"
                    onChange={(e) => setFormData({ ...formData, test_phase: e.target.value })}
                  >
                    {TEST_PHASES.map((phase) => (
                      <MenuItem key={phase} value={phase}>{phase}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="Project ID"
                  fullWidth
                  value={formData.project_id}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                />
              </Grid>
            </Grid>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={6}>
                <TextField
                  label="Start Date/Time"
                  type="datetime-local"
                  fullWidth
                  value={formData.start_datetime}
                  onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={6}>
                <TextField
                  label="End Date/Time"
                  type="datetime-local"
                  fullWidth
                  value={formData.end_datetime}
                  onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={async () => {
              await handleUpdateBooking();
              // Refresh viewing booking data
              if (viewingBooking) {
                const updated = bookings.find(b => b.booking_id === viewingBooking.booking_id);
                if (updated) setViewingBooking(updated);
              }
            }}>
              Update
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Default: Booking List View
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 600 }}>
          Bookings
        </Typography>
        <Box>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchData} sx={{ mr: 1 }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant={viewMode === 'calendar' ? 'contained' : 'outlined'}
            startIcon={<CalendarIcon />}
            onClick={() => setViewMode('calendar')}
            sx={{ mr: 1 }}
          >
            Calendar
          </Button>
          <Button
            variant={viewMode === 'table' ? 'contained' : 'outlined'}
            startIcon={<TableIcon />}
            onClick={() => setViewMode('table')}
            sx={{ mr: 2 }}
          >
            Table
          </Button>
          {canEdit && (
            <Button variant="contained" startIcon={<AddIcon />} onClick={openCreateDialog}>
              New Booking
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

      {/* Search and Filters */}
      <Card sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <TextField
            size="small"
            placeholder="Search bookings..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />,
              endAdornment: searchQuery && (
                <IconButton size="small" onClick={() => setSearchQuery('')}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              ),
            }}
            sx={{ minWidth: 250 }}
          />
          <Button
            variant={showFilters ? 'contained' : 'outlined'}
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            size="small"
          >
            Filters {(filterStatus || filterTestPhase || filterEnvironment) && '•'}
          </Button>
          {(searchQuery || filterStatus || filterTestPhase || filterEnvironment) && (
            <Button
              size="small"
              onClick={() => {
                setSearchQuery('');
                setFilterStatus('');
                setFilterTestPhase('');
                setFilterEnvironment('');
              }}
              startIcon={<ClearIcon />}
            >
              Clear All
            </Button>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 'auto' }}>
            {filteredBookings.length} of {bookings.length} bookings
          </Typography>
        </Box>
        <Collapse in={showFilters}>
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={filterStatus}
                label="Status"
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                <MenuItem value="">All Statuses</MenuItem>
                <MenuItem value="Requested">Requested</MenuItem>
                <MenuItem value="PendingApproval">Pending Approval</MenuItem>
                <MenuItem value="Approved">Approved</MenuItem>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Completed">Completed</MenuItem>
                <MenuItem value="Cancelled">Cancelled</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel>Test Phase</InputLabel>
              <Select
                value={filterTestPhase}
                label="Test Phase"
                onChange={(e) => setFilterTestPhase(e.target.value)}
              >
                <MenuItem value="">All Phases</MenuItem>
                <MenuItem value="SIT">SIT</MenuItem>
                <MenuItem value="UAT">UAT</MenuItem>
                <MenuItem value="NFT">NFT</MenuItem>
                <MenuItem value="Performance">Performance</MenuItem>
                <MenuItem value="DRRehearsal">DR Rehearsal</MenuItem>
                <MenuItem value="PenTest">PenTest</MenuItem>
                <MenuItem value="Other">Other</MenuItem>
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Environment</InputLabel>
              <Select
                value={filterEnvironment}
                label="Environment"
                onChange={(e) => setFilterEnvironment(e.target.value)}
              >
                <MenuItem value="">All Environments</MenuItem>
                {environments.map((env: any) => (
                  <MenuItem key={env.environment_id} value={env.environment_id}>
                    {env.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Card>

      {viewMode === 'calendar' ? (
        renderCalendar()
      ) : (
        <>
          <Card sx={{ mb: 3 }}>
            <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
              <Tab label={`All (${bookings.length})`} />
              <Tab label={`Active (${bookings.filter((b: any) => ['Active', 'Approved'].includes(b.booking_status)).length})`} />
              <Tab label={`Pending (${bookings.filter((b: any) => ['Requested', 'PendingApproval'].includes(b.booking_status)).length})`} />
              <Tab label="Past" />
            </Tabs>
          </Card>

          <Card>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Title / Phase</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Start</TableCell>
                    <TableCell>End</TableCell>
                    <TableCell align="center">Resources</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Conflicts</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredBookings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No bookings found. {(searchQuery || filterStatus || filterTestPhase || filterEnvironment) && 'Try adjusting your filters.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredBookings.map((booking: any) => (
                      <TableRow key={booking.booking_id} hover>
                        <TableCell>
                          <Typography fontWeight={500}>{booking.title || 'Untitled'}</Typography>
                          <Typography variant="body2" color="text.secondary">{booking.test_phase}</Typography>
                        </TableCell>
                        <TableCell>{booking.requested_by_name || 'Unknown'}</TableCell>
                        <TableCell>{new Date(booking.start_datetime).toLocaleString()}</TableCell>
                        <TableCell>{new Date(booking.end_datetime).toLocaleString()}</TableCell>
                        <TableCell align="center">
                          <Chip label={`${booking.resource_count || 0}`} size="small" />
                        </TableCell>
                        <TableCell>
                          <Chip label={booking.booking_status} size="small" color={getStatusColor(booking.booking_status)} />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={booking.conflict_status}
                            size="small"
                            color={getConflictColor(booking.conflict_status)}
                            icon={booking.conflict_status !== 'None' ? <WarningIcon /> : undefined}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="View Details">
                            <IconButton size="small" onClick={() => openBookingView(booking)}>
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          {canEdit && !['Completed', 'Cancelled'].includes(booking.booking_status) && (
                            <>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => openEditDialog(booking)}>
                                  <EditIcon />
                                </IconButton>
                              </Tooltip>
                              {booking.booking_status === 'Requested' && (
                                <Tooltip title="Approve">
                                  <IconButton size="small" color="success" onClick={() => handleUpdateStatus(booking.booking_id, 'Approved')}>
                                    <CheckCircleIcon />
                                  </IconButton>
                                </Tooltip>
                              )}
                              <Tooltip title="Cancel">
                                <IconButton size="small" color="error" onClick={() => handleUpdateStatus(booking.booking_id, 'Cancelled')}>
                                  <CancelIcon />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton size="small" color="error" onClick={() => openDeleteDialog(booking)}>
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
        </>
      )}

      {/* Create Booking Dialog */}
      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Booking</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            margin="normal"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Test Phase</InputLabel>
                <Select
                  value={formData.test_phase}
                  label="Test Phase"
                  onChange={(e) => setFormData({ ...formData, test_phase: e.target.value })}
                >
                  {TEST_PHASES.map((phase) => (
                    <MenuItem key={phase} value={phase}>{phase}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Booking Type</InputLabel>
                <Select
                  value={formData.booking_type}
                  label="Booking Type"
                  onChange={(e) => setFormData({ ...formData, booking_type: e.target.value })}
                >
                  {BOOKING_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>{type}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="Start Date/Time"
                type="datetime-local"
                fullWidth
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="End Date/Time"
                type="datetime-local"
                fullWidth
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
                required
              />
            </Grid>
          </Grid>
          <TextField
            label="Project ID"
            fullWidth
            margin="normal"
            value={formData.project_id}
            onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
          />
          
          <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>Environment Instances</Typography>
          <Autocomplete
            multiple
            options={instances}
            getOptionLabel={(option) => `${option.name} (${option.environment_name})`}
            value={selectedInstances}
            onChange={(_, newValue) => setSelectedInstances(newValue)}
            renderInput={(params) => <TextField {...params} label="Select Environment Instances" />}
          />

          {/* Conflict Detection Display */}
          {conflicts.length > 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                <WarningIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
                Potential Conflicts Detected ({conflicts.length})
              </Typography>
              <List dense>
                {conflicts.map((conflict, idx) => (
                  <ListItem key={idx}>
                    <ListItemIcon>
                      <WarningIcon color="warning" fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={`${conflict.resource_name}`}
                      secondary={`Conflicts with "${conflict.conflicting_title}" (${new Date(conflict.conflicting_start).toLocaleDateString()} - ${new Date(conflict.conflicting_end).toLocaleDateString()})`}
                    />
                  </ListItem>
                ))}
              </List>
              <Typography variant="body2" sx={{ mt: 1 }}>
                You can still create this booking. It will be marked for review.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateBooking}
            disabled={!formData.test_phase || !formData.start_datetime || !formData.end_datetime}
          >
            {conflicts.length > 0 ? 'Create with Conflicts' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Booking Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Edit Booking</DialogTitle>
        <DialogContent>
          <TextField
            label="Title"
            fullWidth
            margin="normal"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          />
          <TextField
            label="Description"
            fullWidth
            margin="normal"
            multiline
            rows={2}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          />
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <FormControl fullWidth>
                <InputLabel>Test Phase</InputLabel>
                <Select
                  value={formData.test_phase}
                  label="Test Phase"
                  onChange={(e) => setFormData({ ...formData, test_phase: e.target.value })}
                >
                  {TEST_PHASES.map((phase) => (
                    <MenuItem key={phase} value={phase}>{phase}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="Project ID"
                fullWidth
                value={formData.project_id}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={6}>
              <TextField
                label="Start Date/Time"
                type="datetime-local"
                fullWidth
                value={formData.start_datetime}
                onChange={(e) => setFormData({ ...formData, start_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={6}>
              <TextField
                label="End Date/Time"
                type="datetime-local"
                fullWidth
                value={formData.end_datetime}
                onChange={(e) => setFormData({ ...formData, end_datetime: e.target.value })}
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleUpdateBooking}>
            Update
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Booking Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Typography variant="h6">{selectedBooking?.title || 'Booking Details'}</Typography>
            <Box>
              <Chip label={selectedBooking?.booking_status} color={getStatusColor(selectedBooking?.booking_status || '')} sx={{ mr: 1 }} />
              {selectedBooking?.conflict_status !== 'None' && (
                <Chip label={selectedBooking?.conflict_status} color={getConflictColor(selectedBooking?.conflict_status || '')} icon={<WarningIcon />} />
              )}
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Test Phase</Typography>
              <Typography>{selectedBooking?.test_phase}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Booking Type</Typography>
              <Typography>{selectedBooking?.booking_type}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Start</Typography>
              <Typography>{selectedBooking?.start_datetime ? new Date(selectedBooking.start_datetime).toLocaleString() : '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">End</Typography>
              <Typography>{selectedBooking?.end_datetime ? new Date(selectedBooking.end_datetime).toLocaleString() : '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Requested By</Typography>
              <Typography>{selectedBooking?.requested_by_name || '-'}</Typography>
            </Grid>
            <Grid item xs={6}>
              <Typography variant="subtitle2" color="text.secondary">Owning Group</Typography>
              <Typography>{selectedBooking?.owning_group_name || '-'}</Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">Description</Typography>
              <Typography>{selectedBooking?.description || 'No description'}</Typography>
            </Grid>
          </Grid>

          {detailedBooking?.resources?.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle1" gutterBottom>Resources ({detailedBooking.resources.length})</Typography>
              <List dense>
                {detailedBooking.resources.map((resource: any, idx: number) => (
                  <ListItem key={idx}>
                    <ListItemText
                      primary={resource.resource_name || resource.resource_ref_id}
                      secondary={`Type: ${resource.resource_type} | Role: ${resource.logical_role || 'N/A'}`}
                    />
                    {resource.resource_conflict_status !== 'None' && (
                      <Chip label={resource.resource_conflict_status} size="small" color="warning" />
                    )}
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {selectedBooking?.conflict_notes && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">Conflict Notes</Typography>
              <Typography>{selectedBooking.conflict_notes}</Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          {canEdit && selectedBooking && !['Completed', 'Cancelled'].includes(selectedBooking.booking_status) && (
            <>
              {selectedBooking.booking_status === 'Requested' && (
                <Button color="success" onClick={() => { handleUpdateStatus(selectedBooking.booking_id, 'Approved'); setViewDialogOpen(false); }}>
                  Approve
                </Button>
              )}
              {selectedBooking.booking_status === 'Approved' && (
                <Button color="primary" onClick={() => { handleUpdateStatus(selectedBooking.booking_id, 'Active'); setViewDialogOpen(false); }}>
                  Activate
                </Button>
              )}
              {selectedBooking.booking_status === 'Active' && (
                <Button onClick={() => { handleUpdateStatus(selectedBooking.booking_id, 'Completed'); setViewDialogOpen(false); }}>
                  Complete
                </Button>
              )}
              <Button color="error" onClick={() => { handleUpdateStatus(selectedBooking.booking_id, 'Cancelled'); setViewDialogOpen(false); }}>
                Cancel Booking
              </Button>
            </>
          )}
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Booking</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete the booking "{selectedBooking?.title || selectedBooking?.test_phase}"?
            This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDeleteBooking}>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
