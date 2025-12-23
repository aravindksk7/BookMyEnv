const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const groupRoutes = require('./routes/groupRoutes');
const environmentRoutes = require('./routes/environmentRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const releaseRoutes = require('./routes/releaseRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const changeRoutes = require('./routes/changeRoutes');
const interfaceRoutes = require('./routes/interfaceRoutes');
const configRoutes = require('./routes/configRoutes');
const testDataRoutes = require('./routes/testDataRoutes');
const topologyRoutes = require('./routes/topologyRoutes');
const bulkUploadRoutes = require('./routes/bulkUploadRoutes');
const refreshRoutes = require('./routes/refreshRoutes');
const auditRoutes = require('./routes/auditRoutes');

// Import database
const db = require('./config/database');

// Create Express app
const app = express();
const server = http.createServer(app);

// Socket.IO setup with authentication
// Allow flexible origins for deployment behind nginx reverse proxy
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      // Allow requests with no origin (same-origin via nginx proxy)
      if (!origin) return callback(null, true);
      // Allow all origins when behind nginx - nginx handles actual CORS
      callback(null, true);
    },
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible in routes
app.set('io', io);

// Trust proxy for rate limiting behind nginx
app.set('trust proxy', 1);

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true
  }
}));

// CORS configuration - flexible for deployment behind reverse proxy
// When behind nginx, nginx handles external CORS; backend just needs to accept proxied requests
const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:3000';
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.CORS_ORIGIN,
  'http://localhost:3000',
  'https://localhost',
  'http://localhost'
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (same-origin requests from nginx proxy, mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // Check if origin matches allowed origins
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow any origin that matches the CORS_ORIGIN pattern (supports IP addresses and hostnames)
    // This handles cases like http://192.168.1.100 or https://myserver.local
    if (corsOrigin === '*') {
      return callback(null, true);
    }
    
    // For production behind nginx: if origin uses same protocol, allow it
    // Nginx proxies requests so the real CORS check happens at nginx level
    const originUrl = new URL(origin);
    const allowedUrl = new URL(corsOrigin.startsWith('http') ? corsOrigin : `https://${corsOrigin}`);
    
    // Allow if same protocol (http/https) - nginx handles the real security
    if (originUrl.protocol === allowedUrl.protocol || 
        originUrl.protocol === 'https:' || 
        process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting for API protection (disabled for development)
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 10000, // High limit for dev
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' // Skip rate limiting in non-production
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 100, // Higher limit for dev
  message: { error: 'Too many login attempts, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' // Skip rate limiting in non-production
});

app.use(generalLimiter);
app.use(morgan('combined'));
// Request body size limit to prevent DoS
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Health check endpoint (no sensitive info exposed)
app.get('/health', async (req, res) => {
  try {
    await db.query('SELECT 1');
    res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    // Don't expose error details in production
    res.status(500).json({ status: 'unhealthy', database: 'disconnected' });
  }
});

// Apply stricter rate limiting to auth routes
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/environments', environmentRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/releases', releaseRoutes);
app.use('/api/integrations', integrationRoutes);
app.use('/api/changes', changeRoutes);
app.use('/api/interfaces', interfaceRoutes);
app.use('/api/configs', configRoutes);
app.use('/api/test-data', testDataRoutes);
app.use('/api/topology', topologyRoutes);
app.use('/api/bulk-upload', bulkUploadRoutes);
app.use('/api/refresh', refreshRoutes);
app.use('/api/audit', auditRoutes);

// Import auth middleware for protected routes
const { authenticate } = require('./middleware/auth');
const { requireRole } = require('./middleware/rbac');
const environmentController = require('./controllers/environmentController');

// Instance-level route for getting all instances
app.get('/api/instances', authenticate, environmentController.getAllInstances);

// Instance-level route for linking applications (separate from environment routes)
app.post('/api/instances/:instanceId/applications', authenticate, requireRole('Admin', 'EnvironmentManager'), environmentController.linkApplicationToInstance);

// App-environment instance routes (update and delete)
app.put('/api/app-env-instances/:appEnvInstanceId', authenticate, requireRole('Admin', 'EnvironmentManager'), environmentController.updateAppEnvInstance);
app.delete('/api/app-env-instances/:appEnvInstanceId', authenticate, requireRole('Admin', 'EnvironmentManager'), environmentController.deleteAppEnvInstance);

// Get all component instances (for interface endpoint linking)
app.get('/api/component-instances', authenticate, async (req, res) => {
  try {
    const { env_instance_id } = req.query;
    let query = `
      SELECT ci.*, 
             ac.name as component_name,
             app.name as application_name,
             app.application_id,
             ei.name as env_instance_name,
             e.name as environment_name
      FROM component_instances ci
      JOIN app_components ac ON ci.component_id = ac.component_id
      JOIN applications app ON ac.application_id = app.application_id
      JOIN environment_instances ei ON ci.env_instance_id = ei.env_instance_id
      JOIN environments e ON ei.environment_id = e.environment_id
    `;
    const params = [];
    
    if (env_instance_id) {
      params.push(env_instance_id);
      query += ` WHERE ci.env_instance_id = $${params.length}`;
    }
    
    query += ' ORDER BY app.name, ac.name, e.name, ei.name';
    
    const result = await db.query(query, params);
    res.json({ componentInstances: result.rows });
  } catch (error) {
    console.error('Get component instances error:', error);
    res.status(500).json({ error: 'Failed to fetch component instances' });
  }
});

// Identity Provider Management API (Admin only)
app.get('/api/identity-providers', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const result = await db.query(
      `SELECT idp_id, name, idp_type, issuer_url, metadata_url, is_active, created_at
       FROM identity_provider_configs
       ORDER BY name`
    );
    res.json({ providers: result.rows });
  } catch (error) {
    console.error('Get identity providers error:', error);
    res.status(500).json({ error: 'Failed to fetch identity providers' });
  }
});

app.post('/api/identity-providers', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const { name, idp_type, issuer_url, client_id, client_secret, metadata_url, is_active } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Provider name is required' });
    }

    const result = await db.query(
      `INSERT INTO identity_provider_configs (name, idp_type, issuer_url, client_id, client_secret_encrypted, metadata_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING idp_id, name, idp_type, issuer_url, metadata_url, is_active, created_at`,
      [name, idp_type, issuer_url, client_id, client_secret, metadata_url, is_active !== false]
    );

    // Log activity
    await db.query(
      `INSERT INTO activities (user_id, action, entity_type, entity_id, entity_name)
       VALUES ($1, $2, $3, $4, $5)`,
      [req.user.user_id, 'CREATE', 'IdentityProvider', result.rows[0].idp_id, name]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create identity provider error:', error);
    res.status(500).json({ error: 'Failed to create identity provider' });
  }
});

app.put('/api/identity-providers/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { name, idp_type, issuer_url, client_id, client_secret, metadata_url, is_active } = req.body;

    const result = await db.query(
      `UPDATE identity_provider_configs 
       SET name = COALESCE($1, name),
           idp_type = COALESCE($2, idp_type),
           issuer_url = COALESCE($3, issuer_url),
           client_id = COALESCE($4, client_id),
           client_secret_encrypted = COALESCE($5, client_secret_encrypted),
           metadata_url = COALESCE($6, metadata_url),
           is_active = COALESCE($7, is_active),
           updated_at = NOW()
       WHERE idp_id = $8
       RETURNING idp_id, name, idp_type, issuer_url, metadata_url, is_active`,
      [name, idp_type, issuer_url, client_id, client_secret, metadata_url, is_active, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Update identity provider error:', error);
    res.status(500).json({ error: 'Failed to update identity provider' });
  }
});

app.delete('/api/identity-providers/:id', authenticate, requireRole('Admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM identity_provider_configs WHERE idp_id = $1 RETURNING name',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Identity provider not found' });
    }

    res.json({ message: 'Identity provider deleted successfully' });
  } catch (error) {
    console.error('Delete identity provider error:', error);
    res.status(500).json({ error: 'Failed to delete identity provider' });
  }
});

// Activity log endpoint (protected)
app.get('/api/activities', authenticate, async (req, res) => {
  try {
    const { limit = 50, entity_type, user_id } = req.query;
    let query = `
      SELECT a.*, u.display_name as user_name
      FROM activities a
      LEFT JOIN users u ON a.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (entity_type) {
      params.push(entity_type);
      query += ` AND a.entity_type = $${params.length}`;
    }

    if (user_id) {
      params.push(user_id);
      query += ` AND a.user_id = $${params.length}`;
    }

    params.push(limit);
    query += ` ORDER BY a.created_at DESC LIMIT $${params.length}`;

    const result = await db.query(query, params);
    res.json({ activities: result.rows });
  } catch (error) {
    console.error('Get activities error:', error);
    res.status(500).json({ error: 'Failed to fetch activities' });
  }
});

// Dashboard statistics endpoint (protected)
app.get('/api/dashboard/stats', authenticate, async (req, res) => {
  try {
    const stats = await db.query(`
      SELECT 
        (SELECT COUNT(*) FROM environments) as total_environments,
        (SELECT COUNT(*) FROM environment_instances WHERE operational_status = 'Available') as available_instances,
        (SELECT COUNT(*) FROM environment_instances) as total_instances,
        (SELECT COUNT(*) FROM environment_bookings 
         WHERE booking_status IN ('Active', 'Approved') 
         AND start_datetime <= NOW() 
         AND end_datetime >= NOW()) as active_bookings,
        (SELECT COUNT(*) FROM releases WHERE status IN ('InProgress', 'Testing')) as in_progress_releases,
        (SELECT COUNT(*) FROM applications) as total_applications,
        (SELECT COUNT(*) FROM users WHERE is_active = true) as total_users
    `);

    res.json(stats.rows[0]);
  } catch (error) {
    console.error('Get dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard statistics' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Socket.IO connection handling with authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
  if (!token) {
    // Allow connection but mark as unauthenticated (for public rooms only)
    socket.authenticated = false;
    return next();
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    socket.authenticated = true;
    next();
  } catch (err) {
    socket.authenticated = false;
    next();
  }
});

io.on('connection', (socket) => {
  // Don't log socket IDs in production (potential security info leak)
  if (process.env.NODE_ENV === 'development') {
    console.log('Client connected:', socket.id, socket.authenticated ? '(authenticated)' : '(anonymous)');
  }

  // Join room for real-time updates - only allow authenticated users to join protected rooms
  socket.on('join', (room) => {
    // Sanitize room name to prevent injection
    const sanitizedRoom = String(room).replace(/[^a-zA-Z0-9_-]/g, '');
    if (sanitizedRoom !== room) {
      socket.emit('error', { message: 'Invalid room name' });
      return;
    }
    
    // Protected rooms require authentication
    const protectedPrefixes = ['user_', 'admin_', 'booking_', 'release_'];
    const isProtected = protectedPrefixes.some(p => room.startsWith(p));
    
    if (isProtected && !socket.authenticated) {
      socket.emit('error', { message: 'Authentication required for this room' });
      return;
    }
    
    socket.join(room);
    if (process.env.NODE_ENV === 'development') {
      console.log(`Socket ${socket.id} joined room: ${room}`);
    }
  });

  // Leave room
  socket.on('leave', (room) => {
    socket.leave(room);
  });

  socket.on('disconnect', () => {
    if (process.env.NODE_ENV === 'development') {
      console.log('Client disconnected:', socket.id);
    }
  });
});

// Utility function to emit real-time updates
const emitUpdate = (eventType, data) => {
  io.emit(eventType, data);
};

// Export for use in controllers
app.set('emitUpdate', emitUpdate);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io };
