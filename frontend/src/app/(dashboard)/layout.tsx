'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Menu,
  MenuItem,
  Divider,
  Badge,
  Popover,
  Card,
  CardContent,
  CardHeader,
  Chip,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Computer as EnvironmentIcon,
  CalendarMonth as BookingIcon,
  Rocket as ReleaseIcon,
  Group as GroupIcon,
  Settings as SettingsIcon,
  IntegrationInstructions as IntegrationIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  Analytics as MonitoringIcon,
  Storage as TestDataIcon,
  AccountTree as TopologyIcon,
  Autorenew as RefreshIcon,
  Security as AuditIcon,
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { dashboardAPI } from '@/lib/api';

// BME Logo Component
const BMELogo = ({ size = 32 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#1976d2' }} />
        <stop offset="100%" style={{ stopColor: '#1565c0' }} />
      </linearGradient>
      <linearGradient id="calGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#42a5f5' }} />
        <stop offset="100%" style={{ stopColor: '#1e88e5' }} />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#bgGrad)" />
    <rect x="14" y="18" width="20" height="6" rx="2" fill="#fff" />
    <circle cx="18" cy="21" r="1.5" fill="#4caf50" />
    <circle cx="23" cy="21" r="1.5" fill="#4caf50" />
    <rect x="14" y="26" width="20" height="6" rx="2" fill="#fff" />
    <circle cx="18" cy="29" r="1.5" fill="#ff9800" />
    <circle cx="23" cy="29" r="1.5" fill="#4caf50" />
    <rect x="14" y="34" width="20" height="6" rx="2" fill="#fff" />
    <circle cx="18" cy="37" r="1.5" fill="#4caf50" />
    <circle cx="23" cy="37" r="1.5" fill="#4caf50" />
    <rect x="36" y="22" width="16" height="18" rx="2" fill="#fff" />
    <rect x="36" y="22" width="16" height="5" rx="2" fill="url(#calGrad)" />
    <rect x="39" y="30" width="3" height="3" rx="0.5" fill="#1976d2" />
    <rect x="44" y="30" width="3" height="3" rx="0.5" fill="#4caf50" />
    <rect x="39" y="35" width="3" height="3" rx="0.5" fill="#1976d2" />
    <rect x="44" y="35" width="3" height="3" rx="0.5" fill="#1976d2" />
    <circle cx="50" cy="44" r="8" fill="#4caf50" />
    <path d="M46 44 L49 47 L54 41" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Activity {
  activity_id: string;
  action: string;
  entity_type: string;
  entity_name: string;
  user_name: string;
  created_at: string;
}

const drawerWidth = 260;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard' },
  { text: 'Monitoring', icon: <MonitoringIcon />, path: '/monitoring' },
  { text: 'Topology', icon: <TopologyIcon />, path: '/topology' },
  { text: 'Environments', icon: <EnvironmentIcon />, path: '/environments' },
  { text: 'Bookings', icon: <BookingIcon />, path: '/bookings' },
  { text: 'Refresh Calendar', icon: <RefreshIcon />, path: '/refresh' },
  { text: 'Releases', icon: <ReleaseIcon />, path: '/releases' },
  { text: 'Test Data', icon: <TestDataIcon />, path: '/testdata' },
  { text: 'Groups', icon: <GroupIcon />, path: '/groups' },
  { text: 'Integrations', icon: <IntegrationIcon />, path: '/integrations' },
  { text: 'Audit & Compliance', icon: <AuditIcon />, path: '/audit', roles: ['Admin', 'EnvironmentManager', 'ProjectLead'] },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [notificationAnchor, setNotificationAnchor] = useState<null | HTMLElement>(null);
  const [notifications, setNotifications] = useState<Activity[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [lastViewedTime, setLastViewedTime] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Load last viewed time from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('notificationsLastViewed');
    if (stored) {
      setLastViewedTime(stored);
    }
  }, []);

  useEffect(() => {
    // Only fetch if user is logged in
    if (!user) return;
    
    const fetchNotifications = async () => {
      try {
        const response = await dashboardAPI.getActivities({ limit: 10 });
        const activities: Activity[] = response.data.activities || [];
        setNotifications(activities);
        
        // Calculate unread count based on activities newer than last viewed time
        const storedTime = localStorage.getItem('notificationsLastViewed');
        if (storedTime) {
          const lastViewed = new Date(storedTime).getTime();
          const newCount = activities.filter((a: Activity) => 
            new Date(a.created_at).getTime() > lastViewed
          ).length;
          setUnreadCount(Math.min(newCount, 9));
        } else {
          // First time - show all as unread
          setUnreadCount(Math.min(activities.length, 9));
        }
      } catch (error) {
        console.error('Failed to fetch notifications:', error);
      }
    };
    fetchNotifications();
    
    // Refresh notifications every 30 seconds
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]); // Removed lastViewedTime dependency to prevent re-fetch on mark as read

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleNotificationClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setNotificationAnchor(event.currentTarget);
  };

  const handleNotificationClose = () => {
    setNotificationAnchor(null);
    
    // Mark all notifications as read by saving current timestamp
    const now = new Date().toISOString();
    localStorage.setItem('notificationsLastViewed', now);
    setLastViewedTime(now);
    setUnreadCount(0);
    // Don't clear notifications array - keep showing them, just mark as read
  };

  const handleLogout = () => {
    handleClose();
    logout();
  };

  const formatTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const getActionColor = (action: string): 'success' | 'info' | 'warning' | 'error' | 'default' => {
    switch (action) {
      case 'CREATE': return 'success';
      case 'UPDATE': return 'info';
      case 'DELETE': return 'error';
      case 'LOGIN': return 'default';
      case 'STATUS_CHANGE': return 'warning';
      default: return 'default';
    }
  };

  const drawer = (
    <Box>
      <Toolbar>
        <Typography variant="h6" noWrap component="div" sx={{ fontWeight: 700 }}>
          TEM
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems
          .filter((item) => {
            // If no roles specified, show to everyone
            if (!('roles' in item) || !item.roles) return true;
            // Check if user has required role
            return user && item.roles.includes(user.role);
          })
          .map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={pathname === item.path}
              onClick={() => router.push(item.path)}
              sx={{
                mx: 1,
                borderRadius: 2,
                '&.Mui-selected': {
                  bgcolor: 'primary.main',
                  color: 'white',
                  '& .MuiListItemIcon-root': {
                    color: 'white',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'white',
          color: 'text.primary',
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexGrow: 1 }}>
            <BMELogo size={32} />
            <Typography variant="h6" noWrap component="div">
              BookMyEnv
            </Typography>
          </Box>
          <IconButton color="inherit" onClick={handleNotificationClick}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <IconButton onClick={handleMenu} sx={{ ml: 2 }}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {user?.display_name?.charAt(0) || 'U'}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={() => { handleClose(); router.push('/profile'); }}>
              <PersonIcon sx={{ mr: 1 }} /> Profile
            </MenuItem>
            <MenuItem onClick={() => { handleClose(); router.push('/settings'); }}>
              <SettingsIcon sx={{ mr: 1 }} /> Settings
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} /> Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          mt: 8,
          minHeight: '100vh',
          bgcolor: 'background.default',
        }}
      >
        {children}
      </Box>
      {/* Notification Popover - placed outside AppBar for proper rendering */}
      <Popover
        open={Boolean(notificationAnchor)}
        anchorEl={notificationAnchor}
        onClose={handleNotificationClose}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'right',
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'right',
        }}
        PaperProps={{
          sx: { width: 380, maxHeight: 480, mt: 1 }
        }}
      >
        <Card elevation={0}>
          <CardHeader 
            title="Notifications" 
            titleTypographyProps={{ variant: 'h6' }}
            sx={{ pb: 1 }}
          />
          <Divider />
          <CardContent sx={{ p: 0, maxHeight: 400, overflow: 'auto' }}>
            {notifications.length === 0 ? (
              <Box sx={{ p: 3, textAlign: 'center' }}>
                <Typography color="text.secondary">No notifications</Typography>
              </Box>
            ) : (
              <List dense>
                {notifications.map((notification: Activity) => (
                  <ListItem 
                    key={notification.activity_id}
                    sx={{ 
                      borderBottom: '1px solid',
                      borderColor: 'divider',
                      '&:last-child': { borderBottom: 'none' }
                    }}
                  >
                    <ListItemText
                      primaryTypographyProps={{ component: 'div' }}
                      secondaryTypographyProps={{ component: 'div' }}
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip 
                            label={notification.action} 
                            size="small" 
                            color={getActionColor(notification.action)}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          <Typography variant="body2" component="span" fontWeight={500}>
                            {notification.entity_type}
                          </Typography>
                        </Box>
                      }
                      secondary={
                        <Box component="span" sx={{ display: 'block' }}>
                          <Typography variant="body2" component="span" color="text.primary" sx={{ display: 'block', mb: 0.5 }}>
                            {notification.entity_name || 'N/A'}
                          </Typography>
                          <Typography variant="caption" component="span" color="text.secondary">
                            {notification.user_name} • {formatTimeAgo(notification.created_at)}
                          </Typography>
                        </Box>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </CardContent>
        </Card>
      </Popover>
    </Box>
  );
}
