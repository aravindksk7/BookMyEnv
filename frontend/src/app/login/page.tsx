'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '@/contexts/AuthContext';

// BME Logo Component
const BMELogo = ({ size = 64 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#1976d2' }} />
        <stop offset="100%" style={{ stopColor: '#1565c0' }} />
      </linearGradient>
      <linearGradient id="calGradLogin" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style={{ stopColor: '#42a5f5' }} />
        <stop offset="100%" style={{ stopColor: '#1e88e5' }} />
      </linearGradient>
    </defs>
    <circle cx="32" cy="32" r="30" fill="url(#bgGradLogin)" />
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
    <rect x="36" y="22" width="16" height="5" rx="2" fill="url(#calGradLogin)" />
    <rect x="39" y="30" width="3" height="3" rx="0.5" fill="#1976d2" />
    <rect x="44" y="30" width="3" height="3" rx="0.5" fill="#4caf50" />
    <rect x="39" y="35" width="3" height="3" rx="0.5" fill="#1976d2" />
    <rect x="44" y="35" width="3" height="3" rx="0.5" fill="#1976d2" />
    <circle cx="50" cy="44" r="8" fill="#4caf50" />
    <path d="M46 44 L49 47 L54 41" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <BMELogo size={64} />
          </Box>
          <Typography variant="h4" component="h1" gutterBottom align="center">
            BookMyEnv
          </Typography>
          <Typography variant="body2" color="text.secondary" align="center" sx={{ mb: 3 }}>
            Sign in to book and manage test environments
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <TextField
              label="Email"
              type="email"
              fullWidth
              margin="normal"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>
          </form>

          <Typography variant="body2" color="text.secondary" align="center">
            SSO login available for enterprise users
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}
