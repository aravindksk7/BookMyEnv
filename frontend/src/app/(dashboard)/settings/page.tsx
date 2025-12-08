'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Tabs,
  Tab,
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Alert,
  Snackbar,
  Paper,
  Avatar,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  InputAdornment,
  LinearProgress,
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Person as PersonIcon,
  Security as SecurityIcon,
  Notifications as NotificationsIcon,
  VpnKey as SsoIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
  Lock as LockIcon,
  Group as GroupIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  CloudUpload as BulkUploadIcon,
} from '@mui/icons-material';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usersAPI, groupsAPI, identityProvidersAPI } from '@/lib/api';

interface User {
  user_id: string;
  username: string;
  display_name: string;
  email: string;
  role: string;
  auth_mode: string;
  is_active: boolean;
  time_zone: string;
  last_login_at: string;
  created_at: string;
  default_group_id: string;
  default_group_name: string;
}

interface Group {
  group_id: string;
  name: string;
  description: string;
  group_type: string;
}

interface IdentityProvider {
  idp_id: string;
  name: string;
  idp_type: string;
  issuer_url: string;
  is_active: boolean;
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
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SettingsPage() {
  const { user: currentUser } = useAuth();
  const router = useRouter();
  const [tabValue, setTabValue] = useState(0);
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [identityProviders, setIdentityProviders] = useState<IdentityProvider[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [ssoDialogOpen, setSsoDialogOpen] = useState(false);
  const [idpDialogOpen, setIdpDialogOpen] = useState(false);
  
  // Form states
  const [userFormData, setUserFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    password: '',
    role: 'Tester',
    auth_mode: 'Local',
    default_group_id: '',
    is_active: true,
    time_zone: 'UTC',
  });
  
  const [passwordFormData, setPasswordFormData] = useState({
    new_password: '',
    confirm_password: '',
  });

  const [idpFormData, setIdpFormData] = useState({
    name: '',
    idp_type: 'AzureAD',
    issuer_url: '',
    client_id: '',
    client_secret: '',
    metadata_url: '',
    is_active: true,
  });

  const [ssoLinkData, setSsoLinkData] = useState({
    idp_id: '',
    subject_id: '',
    idp_username: '',
    idp_email: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  const isAdmin = currentUser?.role === 'Admin';

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await usersAPI.getAll();
      setUsers(response.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      showSnackbar('Failed to fetch users', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const response = await groupsAPI.getAll();
      setGroups(response.data.groups || []);
    } catch (error) {
      console.error('Failed to fetch groups:', error);
    }
  }, []);

  const fetchIdentityProviders = useCallback(async () => {
    try {
      const response = await identityProvidersAPI.getAll();
      setIdentityProviders(response.data.providers || []);
    } catch (error) {
      console.error('Failed to fetch identity providers:', error);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
      fetchGroups();
      fetchIdentityProviders();
    }
  }, [isAdmin, fetchUsers, fetchGroups, fetchIdentityProviders]);

  const showSnackbar = (message: string, severity: 'success' | 'error') => {
    setSnackbar({ open: true, message, severity });
  };

  const handleCloseSnackbar = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  const resetUserForm = () => {
    setUserFormData({
      username: '',
      display_name: '',
      email: '',
      password: '',
      role: 'Tester',
      auth_mode: 'Local',
      default_group_id: '',
      is_active: true,
      time_zone: 'UTC',
    });
    setEditingUser(null);
  };

  // CREATE User
  const handleCreateUser = async () => {
    try {
      await usersAPI.create(userFormData);
      setUserDialogOpen(false);
      resetUserForm();
      fetchUsers();
      showSnackbar('User created successfully', 'success');
    } catch (error: any) {
      console.error('Failed to create user:', error);
      showSnackbar(error.response?.data?.error || 'Failed to create user', 'error');
    }
  };

  // EDIT User - Open dialog
  const handleEditClick = (user: User) => {
    setEditingUser(user);
    setUserFormData({
      username: user.username,
      display_name: user.display_name,
      email: user.email,
      password: '',
      role: user.role,
      auth_mode: user.auth_mode,
      default_group_id: user.default_group_id || '',
      is_active: user.is_active,
      time_zone: user.time_zone || 'UTC',
    });
    setUserDialogOpen(true);
  };

  // UPDATE User
  const handleUpdateUser = async () => {
    if (!editingUser) return;
    try {
      const updateData: any = {
        display_name: userFormData.display_name,
        role: userFormData.role,
        is_active: userFormData.is_active,
        default_group_id: userFormData.default_group_id || null,
        time_zone: userFormData.time_zone,
      };
      
      await usersAPI.update(editingUser.user_id, updateData);
      setUserDialogOpen(false);
      resetUserForm();
      fetchUsers();
      showSnackbar('User updated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to update user:', error);
      showSnackbar(error.response?.data?.error || 'Failed to update user', 'error');
    }
  };

  // DELETE User
  const handleDeleteClick = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await usersAPI.deactivate(selectedUser.user_id);
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      showSnackbar('User deactivated successfully', 'success');
    } catch (error: any) {
      console.error('Failed to deactivate user:', error);
      showSnackbar(error.response?.data?.error || 'Failed to deactivate user', 'error');
    }
  };

  // Reset Password
  const handleResetPasswordClick = (user: User) => {
    setSelectedUser(user);
    setPasswordFormData({ new_password: '', confirm_password: '' });
    setPasswordDialogOpen(true);
  };

  const handleResetPassword = async () => {
    if (!selectedUser) return;
    if (passwordFormData.new_password !== passwordFormData.confirm_password) {
      showSnackbar('Passwords do not match', 'error');
      return;
    }
    if (passwordFormData.new_password.length < 6) {
      showSnackbar('Password must be at least 6 characters', 'error');
      return;
    }
    
    try {
      await usersAPI.resetPassword(selectedUser.user_id, { new_password: passwordFormData.new_password });
      setPasswordDialogOpen(false);
      setSelectedUser(null);
      showSnackbar('Password reset successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.error || 'Failed to reset password', 'error');
    }
  };

  // Link SSO Identity
  const handleSsoLinkClick = (user: User) => {
    setSelectedUser(user);
    setSsoLinkData({
      idp_id: '',
      subject_id: '',
      idp_username: user.username,
      idp_email: user.email,
    });
    setSsoDialogOpen(true);
  };

  const handleLinkSso = async () => {
    if (!selectedUser || !ssoLinkData.idp_id) return;
    
    try {
      await usersAPI.linkIdentity(selectedUser.user_id, ssoLinkData);
      
      // Update user auth_mode to SSO
      await usersAPI.update(selectedUser.user_id, { auth_mode: 'SSO' });
      
      setSsoDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
      showSnackbar('SSO identity linked successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.error || 'Failed to link SSO identity', 'error');
    }
  };

  // Create Identity Provider
  const handleCreateIdp = async () => {
    try {
      await identityProvidersAPI.create(idpFormData);
      
      setIdpDialogOpen(false);
      setIdpFormData({
        name: '',
        idp_type: 'AzureAD',
        issuer_url: '',
        client_id: '',
        client_secret: '',
        metadata_url: '',
        is_active: true,
      });
      fetchIdentityProviders();
      showSnackbar('Identity provider created successfully', 'success');
    } catch (error: any) {
      showSnackbar(error.response?.data?.error || 'Failed to create identity provider', 'error');
    }
  };

  const getRoleColor = (role: string) => {
    const colors: { [key: string]: 'error' | 'warning' | 'info' | 'success' | 'default' } = {
      Admin: 'error',
      EnvironmentManager: 'warning',
      ProjectLead: 'info',
      Tester: 'success',
      Viewer: 'default',
    };
    return colors[role] || 'default';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = !searchQuery || 
      user.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.username.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = !roleFilter || user.role === roleFilter;
    const matchesStatus = statusFilter === '' || 
      (statusFilter === 'active' && user.is_active) ||
      (statusFilter === 'inactive' && !user.is_active);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const formatDate = (dateStr: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleString();
  };

  if (loading && users.length === 0) {
    return <LinearProgress />;
  }

  return (
    <Box>
      <Typography variant="h4" sx={{ fontWeight: 600, mb: 3 }}>
        Settings
      </Typography>

      <Card>
        <Tabs
          value={tabValue}
          onChange={(_, v) => setTabValue(v)}
          sx={{ borderBottom: 1, borderColor: 'divider', px: 2 }}
        >
          <Tab icon={<PersonIcon />} label="Profile" iconPosition="start" />
          <Tab icon={<NotificationsIcon />} label="Notifications" iconPosition="start" />
          {isAdmin && <Tab icon={<GroupIcon />} label="User Management" iconPosition="start" />}
          {isAdmin && <Tab icon={<SsoIcon />} label="SSO Configuration" iconPosition="start" />}
          {isAdmin && <Tab icon={<BulkUploadIcon />} label="Data Management" iconPosition="start" />}
        </Tabs>

        {/* Profile Tab */}
        <TabPanel value={tabValue} index={0}>
          <CardContent>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Profile Settings
                </Typography>
                <TextField
                  label="Display Name"
                  fullWidth
                  margin="normal"
                  defaultValue={currentUser?.display_name || ''}
                />
                <TextField
                  label="Email"
                  fullWidth
                  margin="normal"
                  defaultValue={currentUser?.email || ''}
                  disabled
                />
                <TextField
                  label="Username"
                  fullWidth
                  margin="normal"
                  defaultValue={currentUser?.username || ''}
                  disabled
                />
                <FormControl fullWidth margin="normal">
                  <InputLabel>Time Zone</InputLabel>
                  <Select defaultValue={currentUser?.time_zone || 'UTC'} label="Time Zone">
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="Australia/Sydney">Australia/Sydney</MenuItem>
                    <MenuItem value="America/New_York">America/New York</MenuItem>
                    <MenuItem value="Europe/London">Europe/London</MenuItem>
                    <MenuItem value="Asia/Singapore">Asia/Singapore</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" sx={{ mt: 2 }}>
                  Save Changes
                </Button>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" gutterBottom>
                  Security
                </Typography>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">Role</Typography>
                  <Chip 
                    label={currentUser?.role} 
                    color={getRoleColor(currentUser?.role || '')}
                    sx={{ mt: 1 }}
                  />
                </Paper>
                <Paper sx={{ p: 2, mb: 2 }}>
                  <Typography variant="subtitle2" color="text.secondary">Authentication Mode</Typography>
                  <Chip 
                    icon={currentUser?.auth_mode === 'SSO' ? <SsoIcon /> : <LockIcon />}
                    label={currentUser?.auth_mode || 'Local'} 
                    variant="outlined"
                    sx={{ mt: 1 }}
                  />
                </Paper>
                {currentUser?.auth_mode === 'Local' && (
                  <Box>
                    <Divider sx={{ my: 2 }} />
                    <Typography variant="subtitle1" gutterBottom>
                      Change Password
                    </Typography>
                    <TextField
                      label="Current Password"
                      type="password"
                      fullWidth
                      margin="normal"
                    />
                    <TextField
                      label="New Password"
                      type="password"
                      fullWidth
                      margin="normal"
                    />
                    <TextField
                      label="Confirm New Password"
                      type="password"
                      fullWidth
                      margin="normal"
                    />
                    <Button variant="outlined" sx={{ mt: 2 }}>
                      Update Password
                    </Button>
                  </Box>
                )}
              </Grid>
            </Grid>
          </CardContent>
        </TabPanel>

        {/* Notifications Tab */}
        <TabPanel value={tabValue} index={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Notification Preferences
            </Typography>
            <List>
              <ListItem>
                <ListItemText 
                  primary="Booking Confirmations"
                  secondary="Receive email notifications when bookings are confirmed or rejected"
                />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Release Updates"
                  secondary="Receive notifications about release status changes"
                />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Environment Alerts"
                  secondary="Get notified about environment status changes"
                />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Daily Digest"
                  secondary="Receive a daily summary of activities"
                />
                <ListItemSecondaryAction>
                  <Switch />
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText 
                  primary="Browser Notifications"
                  secondary="Show desktop notifications for important updates"
                />
                <ListItemSecondaryAction>
                  <Switch defaultChecked />
                </ListItemSecondaryAction>
              </ListItem>
            </List>
          </CardContent>
        </TabPanel>

        {/* User Management Tab (Admin only) */}
        {isAdmin && (
          <TabPanel value={tabValue} index={2}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  User Management
                </Typography>
                <Box>
                  <IconButton onClick={fetchUsers} sx={{ mr: 1 }}>
                    <RefreshIcon />
                  </IconButton>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => {
                      resetUserForm();
                      setUserDialogOpen(true);
                    }}
                  >
                    Add User
                  </Button>
                </Box>
              </Box>

              {/* Filters */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    placeholder="Search users..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon />
                        </InputAdornment>
                      ),
                    }}
                    size="small"
                  />
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Role</InputLabel>
                    <Select
                      value={roleFilter}
                      label="Role"
                      onChange={(e) => setRoleFilter(e.target.value)}
                    >
                      <MenuItem value="">All Roles</MenuItem>
                      <MenuItem value="Admin">Admin</MenuItem>
                      <MenuItem value="EnvironmentManager">Environment Manager</MenuItem>
                      <MenuItem value="ProjectLead">Project Lead</MenuItem>
                      <MenuItem value="Tester">Tester</MenuItem>
                      <MenuItem value="Viewer">Viewer</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={statusFilter}
                      label="Status"
                      onChange={(e) => setStatusFilter(e.target.value)}
                    >
                      <MenuItem value="">All Status</MenuItem>
                      <MenuItem value="active">Active</MenuItem>
                      <MenuItem value="inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              {/* Users Table */}
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>User</TableCell>
                      <TableCell>Role</TableCell>
                      <TableCell>Auth Mode</TableCell>
                      <TableCell>Group</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Last Login</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} align="center">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((user) => (
                        <TableRow key={user.user_id} hover>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <Avatar sx={{ bgcolor: user.role === 'Admin' ? 'error.main' : 'primary.main' }}>
                                {user.display_name.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography fontWeight={500}>{user.display_name}</Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {user.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip 
                              label={user.role} 
                              size="small" 
                              color={getRoleColor(user.role)}
                            />
                          </TableCell>
                          <TableCell>
                            <Chip
                              icon={user.auth_mode === 'SSO' ? <SsoIcon /> : <LockIcon />}
                              label={user.auth_mode}
                              size="small"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell>{user.default_group_name || '-'}</TableCell>
                          <TableCell>
                            <Chip
                              label={user.is_active ? 'Active' : 'Inactive'}
                              size="small"
                              color={user.is_active ? 'success' : 'default'}
                            />
                          </TableCell>
                          <TableCell>
                            <Typography variant="caption">
                              {formatDate(user.last_login_at)}
                            </Typography>
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip title="Edit User">
                              <IconButton 
                                size="small"
                                onClick={() => handleEditClick(user)}
                              >
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            {user.auth_mode === 'Local' && (
                              <Tooltip title="Reset Password">
                                <IconButton 
                                  size="small"
                                  onClick={() => handleResetPasswordClick(user)}
                                >
                                  <LockIcon />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="Link SSO">
                              <IconButton 
                                size="small"
                                onClick={() => handleSsoLinkClick(user)}
                              >
                                <SsoIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={user.is_active ? 'Deactivate' : 'User inactive'}>
                              <span>
                                <IconButton 
                                  size="small" 
                                  color="error"
                                  onClick={() => handleDeleteClick(user)}
                                  disabled={!user.is_active || user.user_id === currentUser?.user_id}
                                >
                                  <DeleteIcon />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Showing {filteredUsers.length} of {users.length} users
              </Typography>
            </CardContent>
          </TabPanel>
        )}

        {/* SSO Configuration Tab (Admin only) */}
        {isAdmin && (
          <TabPanel value={tabValue} index={3}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">
                  Identity Providers
                </Typography>
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setIdpDialogOpen(true)}
                >
                  Add Provider
                </Button>
              </Box>

              {identityProviders.length === 0 ? (
                <Paper sx={{ p: 4, textAlign: 'center' }}>
                  <SsoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                  <Typography color="text.secondary">
                    No identity providers configured
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Add an identity provider to enable SSO authentication
                  </Typography>
                </Paper>
              ) : (
                <Grid container spacing={3}>
                  {identityProviders.map((idp) => (
                    <Grid item xs={12} md={6} key={idp.idp_id}>
                      <Card variant="outlined">
                        <CardContent>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <Box>
                              <Typography variant="h6">{idp.name}</Typography>
                              <Chip 
                                label={idp.idp_type} 
                                size="small" 
                                sx={{ mt: 1 }}
                              />
                            </Box>
                            <Chip
                              label={idp.is_active ? 'Active' : 'Inactive'}
                              color={idp.is_active ? 'success' : 'default'}
                              size="small"
                            />
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                            Issuer: {idp.issuer_url || 'Not configured'}
                          </Typography>
                          <Box sx={{ mt: 2 }}>
                            <Button size="small" sx={{ mr: 1 }}>Edit</Button>
                            <Button size="small" color="error">Delete</Button>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              )}

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" gutterBottom>
                SSO Group Mappings
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Map SSO groups to application roles for automatic role assignment during SSO login.
              </Typography>
              
              <Alert severity="info" sx={{ mb: 2 }}>
                When users log in via SSO, their group claims are automatically mapped to roles based on the configuration below.
              </Alert>

              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>SSO Group Name</TableCell>
                      <TableCell>Maps To Role</TableCell>
                      <TableCell>Maps To Group</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell colSpan={4} align="center">
                        <Typography variant="body2" color="text.secondary">
                          No group mappings configured
                        </Typography>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
              <Button variant="outlined" startIcon={<AddIcon />} sx={{ mt: 2 }}>
                Add Mapping
              </Button>
            </CardContent>
          </TabPanel>
        )}

        {/* Data Management Tab (Admin only) */}
        {isAdmin && (
          <TabPanel value={tabValue} index={4}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Data Management
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Import and manage bulk data for environments, applications, and other entities.
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <BulkUploadIcon sx={{ fontSize: 40, color: 'primary.main', mr: 2 }} />
                        <Box>
                          <Typography variant="h6">Bulk Upload</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Import data from CSV files
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Upload environments, instances, applications, interfaces, and components in bulk using CSV files.
                      </Typography>
                      <Button 
                        variant="contained" 
                        startIcon={<BulkUploadIcon />}
                        onClick={() => router.push('/settings/bulk-upload')}
                        fullWidth
                      >
                        Go to Bulk Upload
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Card variant="outlined" sx={{ height: '100%' }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                        <SecurityIcon sx={{ fontSize: 40, color: 'warning.main', mr: 2 }} />
                        <Box>
                          <Typography variant="h6">Data Export</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Export data for backup or migration
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="body2" sx={{ mb: 2 }}>
                        Export your environment data, configurations, and bookings to CSV or JSON format.
                      </Typography>
                      <Button 
                        variant="outlined" 
                        disabled
                        fullWidth
                      >
                        Coming Soon
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" gutterBottom>
                Supported Entity Types for Bulk Upload
              </Typography>
              
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Entity Type</TableCell>
                      <TableCell>Required Fields</TableCell>
                      <TableCell>Optional Fields</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    <TableRow>
                      <TableCell><strong>Environments</strong></TableCell>
                      <TableCell>name</TableCell>
                      <TableCell>description, type, status, region, owner_group</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Instances</strong></TableCell>
                      <TableCell>environment_name, instance_name</TableCell>
                      <TableCell>instance_url, status, version</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Applications</strong></TableCell>
                      <TableCell>name, application_type</TableCell>
                      <TableCell>description, owner_group</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Interfaces</strong></TableCell>
                      <TableCell>name, interface_type</TableCell>
                      <TableCell>description, source_app, target_app, protocol</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell><strong>Components</strong></TableCell>
                      <TableCell>name, component_type</TableCell>
                      <TableCell>description, parent_application, version</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </TabPanel>
        )}
      </Card>

      {/* Create/Edit User Dialog */}
      <Dialog open={userDialogOpen} onClose={() => setUserDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          {editingUser ? 'Edit User' : 'Create New User'}
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Username"
                fullWidth
                value={userFormData.username}
                onChange={(e) => setUserFormData({ ...userFormData, username: e.target.value })}
                disabled={!!editingUser}
                required
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Display Name"
                fullWidth
                value={userFormData.display_name}
                onChange={(e) => setUserFormData({ ...userFormData, display_name: e.target.value })}
                required
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Email"
                fullWidth
                type="email"
                value={userFormData.email}
                onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                disabled={!!editingUser}
                required
              />
            </Grid>
            {!editingUser && (
              <Grid item xs={12}>
                <TextField
                  label="Password"
                  fullWidth
                  type={showPassword ? 'text' : 'password'}
                  value={userFormData.password}
                  onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton onClick={() => setShowPassword(!showPassword)}>
                          {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                  helperText="Leave blank to send email invitation"
                />
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Role</InputLabel>
                <Select
                  value={userFormData.role}
                  label="Role"
                  onChange={(e) => setUserFormData({ ...userFormData, role: e.target.value })}
                >
                  <MenuItem value="Admin">Admin</MenuItem>
                  <MenuItem value="EnvironmentManager">Environment Manager</MenuItem>
                  <MenuItem value="ProjectLead">Project Lead</MenuItem>
                  <MenuItem value="Tester">Tester</MenuItem>
                  <MenuItem value="Viewer">Viewer</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Default Group</InputLabel>
                <Select
                  value={userFormData.default_group_id}
                  label="Default Group"
                  onChange={(e) => setUserFormData({ ...userFormData, default_group_id: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {groups.map((group) => (
                    <MenuItem key={group.group_id} value={group.group_id}>
                      {group.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Time Zone</InputLabel>
                <Select
                  value={userFormData.time_zone}
                  label="Time Zone"
                  onChange={(e) => setUserFormData({ ...userFormData, time_zone: e.target.value })}
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="Australia/Sydney">Australia/Sydney</MenuItem>
                  <MenuItem value="America/New_York">America/New York</MenuItem>
                  <MenuItem value="Europe/London">Europe/London</MenuItem>
                  <MenuItem value="Asia/Singapore">Asia/Singapore</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControlLabel
                control={
                  <Switch
                    checked={userFormData.is_active}
                    onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUserDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={editingUser ? handleUpdateUser : handleCreateUser}
            disabled={!userFormData.username || !userFormData.display_name || !userFormData.email}
          >
            {editingUser ? 'Update' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Deactivate User</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to deactivate <strong>{selectedUser?.display_name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The user will no longer be able to log in but their data will be preserved.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="error" onClick={handleDeleteUser}>
            Deactivate
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordDialogOpen} onClose={() => setPasswordDialogOpen(false)}>
        <DialogTitle>Reset Password for {selectedUser?.display_name}</DialogTitle>
        <DialogContent>
          <TextField
            label="New Password"
            fullWidth
            margin="normal"
            type={showPassword ? 'text' : 'password'}
            value={passwordFormData.new_password}
            onChange={(e) => setPasswordFormData({ ...passwordFormData, new_password: e.target.value })}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          <TextField
            label="Confirm Password"
            fullWidth
            margin="normal"
            type={showPassword ? 'text' : 'password'}
            value={passwordFormData.confirm_password}
            onChange={(e) => setPasswordFormData({ ...passwordFormData, confirm_password: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPasswordDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleResetPassword}
            disabled={!passwordFormData.new_password || !passwordFormData.confirm_password}
          >
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      {/* Link SSO Identity Dialog */}
      <Dialog open={ssoDialogOpen} onClose={() => setSsoDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link SSO Identity for {selectedUser?.display_name}</DialogTitle>
        <DialogContent>
          <FormControl fullWidth margin="normal">
            <InputLabel>Identity Provider</InputLabel>
            <Select
              value={ssoLinkData.idp_id}
              label="Identity Provider"
              onChange={(e) => setSsoLinkData({ ...ssoLinkData, idp_id: e.target.value })}
            >
              {identityProviders.map((idp) => (
                <MenuItem key={idp.idp_id} value={idp.idp_id}>
                  {idp.name} ({idp.idp_type})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="SSO Subject ID"
            fullWidth
            margin="normal"
            value={ssoLinkData.subject_id}
            onChange={(e) => setSsoLinkData({ ...ssoLinkData, subject_id: e.target.value })}
            helperText="The unique identifier from the SSO provider (e.g., Azure AD Object ID)"
          />
          <TextField
            label="SSO Username"
            fullWidth
            margin="normal"
            value={ssoLinkData.idp_username}
            onChange={(e) => setSsoLinkData({ ...ssoLinkData, idp_username: e.target.value })}
          />
          <TextField
            label="SSO Email"
            fullWidth
            margin="normal"
            value={ssoLinkData.idp_email}
            onChange={(e) => setSsoLinkData({ ...ssoLinkData, idp_email: e.target.value })}
          />
          {identityProviders.length === 0 && (
            <Alert severity="warning" sx={{ mt: 2 }}>
              No identity providers configured. Please add an identity provider first.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSsoDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleLinkSso}
            disabled={!ssoLinkData.idp_id || !ssoLinkData.subject_id}
          >
            Link Identity
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Identity Provider Dialog */}
      <Dialog open={idpDialogOpen} onClose={() => setIdpDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add Identity Provider</DialogTitle>
        <DialogContent>
          <TextField
            label="Provider Name"
            fullWidth
            margin="normal"
            value={idpFormData.name}
            onChange={(e) => setIdpFormData({ ...idpFormData, name: e.target.value })}
            required
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Provider Type</InputLabel>
            <Select
              value={idpFormData.idp_type}
              label="Provider Type"
              onChange={(e) => setIdpFormData({ ...idpFormData, idp_type: e.target.value })}
            >
              <MenuItem value="AzureAD">Azure AD</MenuItem>
              <MenuItem value="Okta">Okta</MenuItem>
              <MenuItem value="Ping">Ping Identity</MenuItem>
              <MenuItem value="Auth0">Auth0</MenuItem>
              <MenuItem value="Custom">Custom OIDC</MenuItem>
            </Select>
          </FormControl>
          <TextField
            label="Issuer URL"
            fullWidth
            margin="normal"
            value={idpFormData.issuer_url}
            onChange={(e) => setIdpFormData({ ...idpFormData, issuer_url: e.target.value })}
            placeholder="https://login.microsoftonline.com/{tenant}/v2.0"
          />
          <TextField
            label="Client ID"
            fullWidth
            margin="normal"
            value={idpFormData.client_id}
            onChange={(e) => setIdpFormData({ ...idpFormData, client_id: e.target.value })}
          />
          <TextField
            label="Client Secret"
            fullWidth
            margin="normal"
            type="password"
            value={idpFormData.client_secret}
            onChange={(e) => setIdpFormData({ ...idpFormData, client_secret: e.target.value })}
          />
          <TextField
            label="Metadata URL (Optional)"
            fullWidth
            margin="normal"
            value={idpFormData.metadata_url}
            onChange={(e) => setIdpFormData({ ...idpFormData, metadata_url: e.target.value })}
            placeholder="https://login.microsoftonline.com/{tenant}/.well-known/openid-configuration"
          />
          <FormControlLabel
            control={
              <Switch
                checked={idpFormData.is_active}
                onChange={(e) => setIdpFormData({ ...idpFormData, is_active: e.target.checked })}
              />
            }
            label="Active"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIdpDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleCreateIdp}
            disabled={!idpFormData.name}
          >
            Create Provider
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
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
