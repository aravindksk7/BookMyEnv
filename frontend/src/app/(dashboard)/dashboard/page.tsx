'use client';

import React, { useEffect, useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  Computer as EnvironmentIcon,
  CalendarMonth as BookingIcon,
  Rocket as ReleaseIcon,
  Apps as ApplicationIcon,
  Person as PersonIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { dashboardAPI } from '@/lib/api';

interface Stats {
  total_environments: number;
  total_instances: number;
  available_instances: number;
  active_bookings: number;
  in_progress_releases: number;
  total_applications: number;
  total_users: number;
}

interface Activity {
  activity_id: string;
  action: string;
  entity_type: string;
  entity_name: string;
  user_name: string;
  created_at: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, activitiesRes] = await Promise.all([
          dashboardAPI.getStats(),
          dashboardAPI.getActivities({ limit: 10 }),
        ]);
        setStats(statsRes.data);
        setActivities(activitiesRes.data.activities || []);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <LinearProgress />;
  }

  const statCards = [
    {
      title: 'Environments',
      value: stats?.total_environments || 0,
      icon: <EnvironmentIcon />,
      color: '#1976d2',
    },
    {
      title: 'Total Instances',
      value: stats?.total_instances || 0,
      icon: <EnvironmentIcon />,
      color: '#0288d1',
    },
    {
      title: 'Available Instances',
      value: stats?.available_instances || 0,
      icon: <CheckIcon />,
      color: '#2e7d32',
    },
    {
      title: 'Active Bookings',
      value: stats?.active_bookings || 0,
      icon: <BookingIcon />,
      color: '#ed6c02',
    },
    {
      title: 'Applications',
      value: stats?.total_applications || 0,
      icon: <ApplicationIcon />,
      color: '#9c27b0',
    },
    {
      title: 'Active Users',
      value: stats?.total_users || 0,
      icon: <PersonIcon />,
      color: '#7b1fa2',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 600 }}>
        Dashboard
      </Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((card) => (
          <Grid item xs={12} sm={6} md={4} lg={2} key={card.title}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                  <Avatar sx={{ bgcolor: card.color, mr: 2 }}>{card.icon}</Avatar>
                  <Typography variant="h4" sx={{ fontWeight: 700 }}>
                    {card.value}
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {card.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Recent Activity
              </Typography>
              <List>
                {activities.length === 0 ? (
                  <ListItem>
                    <ListItemText primary="No recent activities" />
                  </ListItem>
                ) : (
                  activities.map((activity) => (
                    <ListItem key={activity.activity_id}>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.light' }}>
                          {activity.user_name?.charAt(0) || 'U'}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body1">
                              {activity.user_name || 'System'}
                            </Typography>
                            <Chip
                              label={activity.action}
                              size="small"
                              color={activity.action === 'CREATE' ? 'success' : 'default'}
                            />
                          </Box>
                        }
                        secondary={`${activity.entity_type}: ${activity.entity_name || 'N/A'}`}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(activity.created_at).toLocaleString()}
                      </Typography>
                    </ListItem>
                  ))
                )}
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                Quick Stats
              </Typography>
              <Box sx={{ mt: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2">Instance Availability</Typography>
                  <Typography variant="body2" fontWeight={600}>
                    {stats && stats.total_instances > 0
                      ? Math.round((stats.available_instances / stats.total_instances) * 100)
                      : 0}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={
                    stats && stats.total_instances > 0
                      ? (stats.available_instances / stats.total_instances) * 100
                      : 0
                  }
                  sx={{ height: 8, borderRadius: 4, mb: 3 }}
                />

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CheckIcon color="success" />
                  <Typography variant="body2">
                    {stats?.available_instances || 0} of {stats?.total_instances || 0} instances available
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <WarningIcon color="warning" />
                  <Typography variant="body2">
                    {stats?.active_bookings || 0} active bookings
                  </Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
