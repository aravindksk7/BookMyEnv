'use client';

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Paper,
  Avatar,
  Divider,
  Snackbar,
  Alert,
} from '@mui/material';
import {
  Person as PersonIcon,
  Security as SecurityIcon,
  VpnKey as SsoIcon,
  Lock as LockIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { usersAPI } from '@/lib/api';

export default function ProfilePage() {
  const { user: currentUser } = useAuth();
  const [formData, setFormData] = useState({
    display_name: '',
    time_zone: 'UTC',
  });
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' as 'success' | 'error' });

  useEffect(() => {
    if (currentUser) {
      setFormData({
        display_name: currentUser.display_name || '',
        time_zone: currentUser.time_zone || 'UTC',
      });
    }
  }, [currentUser]);

  const handleSave = async () => {
    try {
      await usersAPI.updateOwnPreferences(formData);
      setSnackbar({ open: true, message: 'Profile saved successfully', severity: 'success' });
    } catch (error: any) {
      console.error('Failed to save profile:', error);
      setSnackbar({ 
        open: true, 
        message: error.response?.data?.error || 'Failed to save profile', 
        severity: 'error' 
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'Admin': return 'error';
      case 'EnvironmentManager': return 'warning';
      case 'ProjectLead': return 'info';
      case 'Tester': return 'success';
      default: return 'default';
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <PersonIcon /> My Profile
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 3 }}>
                <Avatar sx={{ width: 80, height: 80, mr: 3, bgcolor: 'primary.main', fontSize: 32 }}>
                  {currentUser?.display_name?.charAt(0) || 'U'}
                </Avatar>
                <Box>
                  <Typography variant="h5">{currentUser?.display_name}</Typography>
                  <Typography color="text.secondary">{currentUser?.email}</Typography>
                  <Chip 
                    label={currentUser?.role} 
                    color={getRoleColor(currentUser?.role || '') as any}
                    size="small"
                    sx={{ mt: 1 }}
                  />
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" gutterBottom>
                Edit Profile
              </Typography>

              <TextField
                label="Display Name"
                fullWidth
                margin="normal"
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              />
              
              <TextField
                label="Email"
                fullWidth
                margin="normal"
                value={currentUser?.email || ''}
                disabled
                helperText="Email cannot be changed"
              />
              
              <TextField
                label="Username"
                fullWidth
                margin="normal"
                value={currentUser?.username || ''}
                disabled
                helperText="Username cannot be changed"
              />

              <FormControl fullWidth margin="normal">
                <InputLabel>Time Zone</InputLabel>
                <Select 
                  value={formData.time_zone} 
                  label="Time Zone"
                  onChange={(e) => setFormData({ ...formData, time_zone: e.target.value })}
                >
                  <MenuItem value="UTC">UTC</MenuItem>
                  <MenuItem value="Australia/Sydney">Australia/Sydney</MenuItem>
                  <MenuItem value="Australia/Melbourne">Australia/Melbourne</MenuItem>
                  <MenuItem value="Australia/Brisbane">Australia/Brisbane</MenuItem>
                  <MenuItem value="Australia/Perth">Australia/Perth</MenuItem>
                  <MenuItem value="America/New_York">America/New York</MenuItem>
                  <MenuItem value="America/Los_Angeles">America/Los Angeles</MenuItem>
                  <MenuItem value="America/Chicago">America/Chicago</MenuItem>
                  <MenuItem value="Europe/London">Europe/London</MenuItem>
                  <MenuItem value="Europe/Paris">Europe/Paris</MenuItem>
                  <MenuItem value="Asia/Singapore">Asia/Singapore</MenuItem>
                  <MenuItem value="Asia/Tokyo">Asia/Tokyo</MenuItem>
                  <MenuItem value="Asia/Shanghai">Asia/Shanghai</MenuItem>
                  <MenuItem value="Asia/Kolkata">Asia/Kolkata</MenuItem>
                </Select>
              </FormControl>

              <Button 
                variant="contained" 
                sx={{ mt: 3 }} 
                onClick={handleSave}
              >
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SecurityIcon /> Security Info
              </Typography>

              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Role</Typography>
                <Chip 
                  label={currentUser?.role} 
                  color={getRoleColor(currentUser?.role || '') as any}
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

              <Paper sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Account Status</Typography>
                <Chip 
                  label={currentUser?.is_active ? 'Active' : 'Inactive'} 
                  color={currentUser?.is_active ? 'success' : 'error'}
                  sx={{ mt: 1 }}
                />
              </Paper>

              <Paper sx={{ p: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">Last Login</Typography>
                <Typography sx={{ mt: 1 }}>
                  {currentUser?.last_login_at 
                    ? new Date(currentUser.last_login_at).toLocaleString() 
                    : 'Never'}
                </Typography>
              </Paper>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Snackbar 
        open={snackbar.open} 
        autoHideDuration={6000} 
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
