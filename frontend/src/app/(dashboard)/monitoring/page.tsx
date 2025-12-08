'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Alert,
  IconButton,
  Tooltip,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Computer as EnvironmentIcon,
  CalendarMonth as BookingIcon,
  Rocket as ReleaseIcon,
  Apps as ApplicationIcon,
  Warning as WarningIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import {
  environmentsAPI,
  bookingsAPI,
  releasesAPI,
  applicationsAPI,
  dashboardAPI,
} from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface EnvironmentStats {
  total_environments: number;
  total_instances: number;
  available_instances: number;
  fully_booked_instances: number;
  maintenance_instances: number;
  total_infra_components: number;
  active_bookings: number;
}

interface BookingStats {
  active_bookings: number;
  pending_approvals: number;
  upcoming_bookings: number;
  bookings_with_conflicts: number;
  bookings_last_week: number;
}

interface ReleaseStats {
  planned_releases: number;
  in_progress_releases: number;
  recent_deployments: number;
  failed_releases: number;
  upcoming_releases: number;
}

interface Activity {
  activity_id: string;
  action: string;
  entity_type: string;
  entity_name: string;
  user_name: string;
  created_at: string;
}

// Simple chart component using CSS
const BarChart = ({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) => {
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom>{title}</Typography>
      {data.map((item, index) => (
        <Box key={index} sx={{ mb: 1.5 }}>
          <Box display="flex" justifyContent="space-between" mb={0.5}>
            <Typography variant="body2">{item.label}</Typography>
            <Typography variant="body2" fontWeight={600}>{item.value}</Typography>
          </Box>
          <Box sx={{ 
            width: '100%', 
            height: 8, 
            bgcolor: 'grey.200', 
            borderRadius: 1,
            overflow: 'hidden'
          }}>
            <Box sx={{ 
              width: `${(item.value / maxValue) * 100}%`, 
              height: '100%', 
              bgcolor: item.color,
              borderRadius: 1,
              transition: 'width 0.5s ease-in-out'
            }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
};

// Pie chart using CSS
const PieChart = ({ data, title }: { data: { label: string; value: number; color: string }[]; title: string }) => {
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  let cumulativePercent = 0;
  
  const gradientStops = data.map((item) => {
    const start = cumulativePercent;
    cumulativePercent += (item.value / total) * 100;
    return `${item.color} ${start}% ${cumulativePercent}%`;
  }).join(', ');

  return (
    <Box>
      <Typography variant="subtitle2" gutterBottom textAlign="center">{title}</Typography>
      <Box display="flex" justifyContent="center" alignItems="center" gap={3}>
        <Box
          sx={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            background: total > 0 ? `conic-gradient(${gradientStops})` : '#e0e0e0',
          }}
        />
        <Box>
          {data.map((item, index) => (
            <Box key={index} display="flex" alignItems="center" gap={1} mb={0.5}>
              <Box sx={{ width: 12, height: 12, bgcolor: item.color, borderRadius: '50%' }} />
              <Typography variant="caption">{item.label}: {item.value}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
  );
};

// Stat Card Component
const StatCard = ({ 
  title, 
  value, 
  icon, 
  color, 
  trend,
  subtitle 
}: { 
  title: string; 
  value: number | string; 
  icon: React.ReactNode; 
  color: string;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
}) => (
  <Card sx={{ height: '100%' }}>
    <CardContent>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography color="text.secondary" variant="body2" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={600} color={color}>
            {value}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        <Box sx={{ 
          bgcolor: `${color}15`, 
          p: 1.5, 
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          {icon}
        </Box>
      </Box>
      {trend && (
        <Box display="flex" alignItems="center" mt={1}>
          {trend === 'up' && <TrendingUpIcon fontSize="small" color="success" />}
          {trend === 'down' && <TrendingDownIcon fontSize="small" color="error" />}
          <Typography variant="caption" color={trend === 'up' ? 'success.main' : trend === 'down' ? 'error.main' : 'text.secondary'}>
            vs last week
          </Typography>
        </Box>
      )}
    </CardContent>
  </Card>
);

export default function MonitoringPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tabValue, setTabValue] = useState(0);
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // Stats
  const [envStats, setEnvStats] = useState<EnvironmentStats | null>(null);
  const [bookingStats, setBookingStats] = useState<BookingStats | null>(null);
  const [releaseStats, setReleaseStats] = useState<ReleaseStats | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  const fetchAllStats = useCallback(async () => {
    try {
      setLoading(true);
      const [envRes, bookingRes, releaseRes, appsRes, activityRes] = await Promise.all([
        environmentsAPI.getStatistics().catch(() => ({ data: null })),
        bookingsAPI.getStatistics().catch(() => ({ data: null })),
        releasesAPI.getStatistics().catch(() => ({ data: null })),
        applicationsAPI.getAll().catch(() => ({ data: [] })),
        dashboardAPI.getActivities({ limit: 20 }).catch(() => ({ data: [] })),
      ]);

      setEnvStats(envRes.data);
      setBookingStats(bookingRes.data);
      setReleaseStats(releaseRes.data);
      
      const appData = appsRes.data;
      setApplications(Array.isArray(appData) ? appData : appData.applications || []);
      
      const actData = activityRes.data;
      setActivities(Array.isArray(actData) ? actData : actData.activities || []);
      
      setLastRefresh(new Date());
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllStats();
  }, [fetchAllStats]);

  // Auto-refresh
  useEffect(() => {
    if (refreshInterval > 0) {
      const interval = setInterval(fetchAllStats, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [refreshInterval, fetchAllStats]);

  // Calculate derived stats
  const envChartData = envStats ? [
    { label: 'Available', value: Number(envStats.available_instances) || 0, color: '#4caf50' },
    { label: 'Fully Booked', value: Number(envStats.fully_booked_instances) || 0, color: '#f44336' },
    { label: 'Maintenance', value: Number(envStats.maintenance_instances) || 0, color: '#ff9800' },
  ] : [];

  const bookingChartData = bookingStats ? [
    { label: 'Active', value: Number(bookingStats.active_bookings) || 0, color: '#2196f3' },
    { label: 'Pending Approval', value: Number(bookingStats.pending_approvals) || 0, color: '#ff9800' },
    { label: 'Upcoming', value: Number(bookingStats.upcoming_bookings) || 0, color: '#4caf50' },
    { label: 'With Conflicts', value: Number(bookingStats.bookings_with_conflicts) || 0, color: '#f44336' },
  ] : [];

  const releaseChartData = releaseStats ? [
    { label: 'Planned', value: Number(releaseStats.planned_releases) || 0, color: '#9c27b0' },
    { label: 'In Progress', value: Number(releaseStats.in_progress_releases) || 0, color: '#2196f3' },
    { label: 'Deployed', value: Number(releaseStats.recent_deployments) || 0, color: '#4caf50' },
    { label: 'Failed', value: Number(releaseStats.failed_releases) || 0, color: '#f44336' },
  ] : [];

  const appsByCriticality = applications.reduce((acc: any, app: any) => {
    const crit = app.criticality || 'Unknown';
    acc[crit] = (acc[crit] || 0) + 1;
    return acc;
  }, {});

  const appChartData = [
    { label: 'Critical', value: appsByCriticality['Critical'] || 0, color: '#f44336' },
    { label: 'High', value: appsByCriticality['High'] || 0, color: '#ff9800' },
    { label: 'Medium', value: appsByCriticality['Medium'] || 0, color: '#2196f3' },
    { label: 'Low', value: appsByCriticality['Low'] || 0, color: '#4caf50' },
  ];

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE': return <SuccessIcon fontSize="small" color="success" />;
      case 'UPDATE': return <ScheduleIcon fontSize="small" color="info" />;
      case 'DELETE': return <ErrorIcon fontSize="small" color="error" />;
      case 'STATUS_CHANGE': return <TrendingUpIcon fontSize="small" color="warning" />;
      default: return <ScheduleIcon fontSize="small" />;
    }
  };

  if (loading && !envStats) {
    return <LinearProgress />;
  }

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600 }}>
            Monitoring Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={2}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Auto Refresh</InputLabel>
            <Select
              value={refreshInterval}
              label="Auto Refresh"
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
            >
              <MenuItem value={0}>Off</MenuItem>
              <MenuItem value={10}>10 seconds</MenuItem>
              <MenuItem value={30}>30 seconds</MenuItem>
              <MenuItem value={60}>1 minute</MenuItem>
              <MenuItem value={300}>5 minutes</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh Now">
            <IconButton onClick={fetchAllStats} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Key Metrics */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Environments"
            value={envStats?.total_instances || 0}
            icon={<EnvironmentIcon sx={{ color: '#2196f3' }} />}
            color="#2196f3"
            subtitle={`${envStats?.available_instances || 0} available`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Bookings"
            value={bookingStats?.active_bookings || 0}
            icon={<BookingIcon sx={{ color: '#4caf50' }} />}
            color="#4caf50"
            subtitle={`${bookingStats?.pending_approvals || 0} pending approval`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Releases"
            value={releaseStats?.in_progress_releases || 0}
            icon={<ReleaseIcon sx={{ color: '#9c27b0' }} />}
            color="#9c27b0"
            subtitle={`${releaseStats?.recent_deployments || 0} deployed`}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Applications"
            value={applications.length}
            icon={<ApplicationIcon sx={{ color: '#ff9800' }} />}
            color="#ff9800"
            subtitle={`${appsByCriticality['Critical'] || 0} critical`}
          />
        </Grid>
      </Grid>

      {/* Alerts Section */}
      {((bookingStats?.bookings_with_conflicts || 0) > 0 || (envStats?.maintenance_instances || 0) > 0 || (releaseStats?.failed_releases || 0) > 0) && (
        <Card sx={{ mb: 3, bgcolor: 'warning.light' }}>
          <CardContent>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <WarningIcon color="warning" />
              <Typography variant="h6">Attention Required</Typography>
            </Box>
            <Box display="flex" gap={2} flexWrap="wrap">
              {(bookingStats?.bookings_with_conflicts || 0) > 0 && (
                <Chip 
                  icon={<WarningIcon />} 
                  label={`${bookingStats?.bookings_with_conflicts} booking conflicts`} 
                  color="warning" 
                />
              )}
              {(envStats?.maintenance_instances || 0) > 0 && (
                <Chip 
                  icon={<EnvironmentIcon />} 
                  label={`${envStats?.maintenance_instances} environments in maintenance`} 
                  color="warning" 
                />
              )}
              {(releaseStats?.failed_releases || 0) > 0 && (
                <Chip 
                  icon={<ErrorIcon />} 
                  label={`${releaseStats?.failed_releases} failed releases`} 
                  color="error" 
                />
              )}
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Card sx={{ mb: 3 }}>
        <Tabs value={tabValue} onChange={(_, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Overview" />
          <Tab label="Environments" />
          <Tab label="Bookings" />
          <Tab label="Releases" />
          <Tab label="Activity" />
        </Tabs>
      </Card>

      {/* Tab Content */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2, height: '100%' }}>
              <PieChart data={envChartData} title="Environment Instance Status" />
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2, height: '100%' }}>
              <PieChart data={releaseChartData} title="Release Status Distribution" />
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2 }}>
              <BarChart data={bookingChartData} title="Booking Statistics" />
            </Card>
          </Grid>
          <Grid item xs={12} md={6}>
            <Card sx={{ p: 2 }}>
              <BarChart data={appChartData} title="Applications by Criticality" />
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 1 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Environment Summary</Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography>Total Environments</Typography>
                  <Typography fontWeight={600}>{envStats?.total_environments || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography>Total Instances</Typography>
                  <Typography fontWeight={600}>{envStats?.total_instances || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="success.main">Available</Typography>
                  <Typography fontWeight={600} color="success.main">{envStats?.available_instances || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="error.main">Fully Booked</Typography>
                  <Typography fontWeight={600} color="error.main">{envStats?.fully_booked_instances || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="warning.main">Maintenance</Typography>
                  <Typography fontWeight={600} color="warning.main">{envStats?.maintenance_instances || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1}>
                  <Typography>Infra Components</Typography>
                  <Typography fontWeight={600}>{envStats?.total_infra_components || 0}</Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 2, height: '100%' }}>
              <PieChart data={envChartData} title="Instance Status Distribution" />
              <Box sx={{ mt: 4 }}>
                <BarChart data={envChartData} title="Instance Status Breakdown" />
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 2 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Booking Summary</Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="primary.main">Active Bookings</Typography>
                  <Typography fontWeight={600} color="primary.main">{bookingStats?.active_bookings || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="warning.main">Pending Approval</Typography>
                  <Typography fontWeight={600} color="warning.main">{bookingStats?.pending_approvals || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="success.main">Upcoming</Typography>
                  <Typography fontWeight={600} color="success.main">{bookingStats?.upcoming_bookings || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="error.main">With Conflicts</Typography>
                  <Typography fontWeight={600} color="error.main">{bookingStats?.bookings_with_conflicts || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1}>
                  <Typography>Created Last Week</Typography>
                  <Typography fontWeight={600}>{bookingStats?.bookings_last_week || 0}</Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 2, height: '100%' }}>
              <BarChart data={bookingChartData} title="Booking Status Distribution" />
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 3 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={4}>
            <Card sx={{ p: 2 }}>
              <Typography variant="h6" gutterBottom>Release Summary</Typography>
              <Box sx={{ mt: 2 }}>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="info.main">Planned</Typography>
                  <Typography fontWeight={600} color="info.main">{releaseStats?.planned_releases || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="primary.main">In Progress</Typography>
                  <Typography fontWeight={600} color="primary.main">{releaseStats?.in_progress_releases || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="success.main">Recent Deployments</Typography>
                  <Typography fontWeight={600} color="success.main">{releaseStats?.recent_deployments || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1} borderBottom={1} borderColor="divider">
                  <Typography color="error.main">Failed</Typography>
                  <Typography fontWeight={600} color="error.main">{releaseStats?.failed_releases || 0}</Typography>
                </Box>
                <Box display="flex" justifyContent="space-between" py={1}>
                  <Typography>Upcoming Releases</Typography>
                  <Typography fontWeight={600}>{releaseStats?.upcoming_releases || 0}</Typography>
                </Box>
              </Box>
            </Card>
          </Grid>
          <Grid item xs={12} md={8}>
            <Card sx={{ p: 2, height: '100%' }}>
              <PieChart data={releaseChartData} title="Release Status Distribution" />
              <Box sx={{ mt: 4 }}>
                <BarChart data={releaseChartData} title="Release Status Breakdown" />
              </Box>
            </Card>
          </Grid>
        </Grid>
      )}

      {tabValue === 4 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>Recent Activity</Typography>
            <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Action</TableCell>
                    <TableCell>Entity</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>User</TableCell>
                    <TableCell>Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activities.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center">No recent activity</TableCell>
                    </TableRow>
                  ) : (
                    activities.map((activity) => (
                      <TableRow key={activity.activity_id} hover>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            {getActionIcon(activity.action)}
                            <Chip label={activity.action} size="small" />
                          </Box>
                        </TableCell>
                        <TableCell>{activity.entity_type}</TableCell>
                        <TableCell>{activity.entity_name || '-'}</TableCell>
                        <TableCell>{activity.user_name || 'System'}</TableCell>
                        <TableCell>
                          {new Date(activity.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
