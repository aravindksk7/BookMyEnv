// Role-Based Access Control Middleware

const ROLES = {
  Admin: ['Admin'],
  EnvironmentManager: ['Admin', 'EnvironmentManager'],
  ProjectLead: ['Admin', 'EnvironmentManager', 'ProjectLead'],
  Tester: ['Admin', 'EnvironmentManager', 'ProjectLead', 'Tester'],
  Viewer: ['Admin', 'EnvironmentManager', 'ProjectLead', 'Tester', 'Viewer']
};

// Check if user has required role
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRole = req.user.role;
    
    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({ 
        error: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

// Check if user has minimum role level
const requireMinRole = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const allowedRoles = ROLES[minRole] || [];
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        error: 'You do not have permission to perform this action'
      });
    }

    next();
  };
};

// Check if user can manage environments
const canManageEnvironments = requireRole('Admin', 'EnvironmentManager');

// Check if user can approve bookings
const canApproveBookings = requireRole('Admin', 'EnvironmentManager');

// Check if user can create bookings
const canCreateBookings = requireRole('Admin', 'EnvironmentManager', 'ProjectLead', 'Tester');

// Check if user can manage releases
const canManageReleases = requireRole('Admin', 'EnvironmentManager', 'ProjectLead');

// Check if user can manage users
const canManageUsers = requireRole('Admin');

// Check if user can manage integrations
const canManageIntegrations = requireRole('Admin', 'EnvironmentManager');

// Check ownership - user can modify their own resources
const isOwnerOrAdmin = (ownerField = 'requested_by_user_id') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Admins and EnvironmentManagers can modify anything
    if (['Admin', 'EnvironmentManager'].includes(req.user.role)) {
      return next();
    }

    // Check if resource in request body belongs to user
    if (req.resource && req.resource[ownerField] === req.user.user_id) {
      return next();
    }

    return res.status(403).json({ error: 'You can only modify your own resources' });
  };
};

module.exports = {
  requireRole,
  requireMinRole,
  canManageEnvironments,
  canApproveBookings,
  canCreateBookings,
  canManageReleases,
  canManageUsers,
  canManageIntegrations,
  isOwnerOrAdmin,
  ROLES
};
