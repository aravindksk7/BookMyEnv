let emailService;
let db;

// Lazy load to avoid startup issues
const getEmailService = () => {
  if (!emailService) {
    emailService = require('../services/emailService');
  }
  return emailService;
};

const getDb = () => {
  if (!db) {
    db = require('../config/database');
  }
  return db;
};

/**
 * Email Controller
 * Handles email configuration and testing endpoints
 */

/**
 * Get email configuration status
 */
const getEmailStatus = async (req, res) => {
  try {
    const { emailConfig } = require('../config/email');
    const verification = await getEmailService().verifyConnection();
    
    res.json({
      success: true,
      data: {
        enabled: emailConfig.enabled,
        provider: emailConfig.provider,
        from: emailConfig.from,
        verified: verification.success,
        message: verification.message
      }
    });
  } catch (error) {
    console.error('Error getting email status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email status',
      error: error.message
    });
  }
};

/**
 * Send test email
 */
const sendTestEmail = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required'
      });
    }
    
    const result = await getEmailService().sendTestEmail(email);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send test email',
      error: error.message
    });
  }
};

/**
 * Get email templates list
 */
const getTemplates = async (req, res) => {
  try {
    const service = getEmailService();
    const templateNames = Object.keys(service.templates);
    const templates = templateNames.map(name => ({
      name,
      subject: service.templates[name].subject
    }));
    
    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get templates',
      error: error.message
    });
  }
};

/**
 * Preview an email template
 */
const previewTemplate = async (req, res) => {
  try {
    const { templateName } = req.params;
    const service = getEmailService();
    const template = service.templates[templateName];
    
    if (!template) {
      return res.status(404).json({
        success: false,
        message: `Template "${templateName}" not found`
      });
    }
    
    // Sample data for preview
    const sampleData = {
      requesterName: 'John Doe',
      approverName: 'Jane Smith',
      userName: 'Test User',
      title: 'Sample Booking',
      environmentName: 'UAT Environment',
      startDate: new Date().toLocaleString(),
      endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleString(),
      purpose: 'Testing new feature deployment',
      priority: 'High',
      bookingId: '12345',
      requesterEmail: 'john.doe@example.com',
      rejectionReason: 'Environment already reserved for critical testing',
      conflictTitle: 'Existing Booking',
      conflictStart: new Date().toLocaleString(),
      conflictEnd: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toLocaleString(),
      resources: 'UAT-Instance-1, UAT-Instance-2',
      hoursRemaining: '24',
      maintenanceStart: new Date().toLocaleString(),
      maintenanceEnd: new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString(),
      reason: 'System upgrade',
      impact: 'Environment will be unavailable',
      appUrl: process.env.APP_URL || 'http://localhost:3000'
    };
    
    // Render template with sample data
    let html = template.html;
    let subject = template.subject;
    
    for (const [key, value] of Object.entries(sampleData)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, value);
      subject = subject.replace(regex, value);
    }
    
    res.json({
      success: true,
      data: {
        name: templateName,
        subject,
        html
      }
    });
  } catch (error) {
    console.error('Error previewing template:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to preview template',
      error: error.message
    });
  }
};

/**
 * Get notification preferences for current user
 */
const getNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.user_id;
    
    // Check if user has preferences stored
    const result = await getDb().query(
      `SELECT preferences FROM users WHERE user_id = $1`,
      [userId]
    );
    
    const preferences = result.rows[0]?.preferences?.notifications || {
      bookingRequested: true,
      bookingApproved: true,
      bookingRejected: true,
      bookingConflict: true,
      bookingReminder: true,
      bookingExpiring: true,
      maintenanceScheduled: true,
      approvalRequest: true
    };
    
    res.json({
      success: true,
      data: preferences
    });
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get notification preferences',
      error: error.message
    });
  }
};

/**
 * Update notification preferences for current user
 */
const updateNotificationPreferences = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { preferences } = req.body;
    
    // Get current user data
    const userResult = await getDb().query(
      `SELECT preferences FROM users WHERE user_id = $1`,
      [userId]
    );
    
    const currentPrefs = userResult.rows[0]?.preferences || {};
    currentPrefs.notifications = preferences;
    
    // Update preferences
    await getDb().query(
      `UPDATE users SET preferences = $1 WHERE user_id = $2`,
      [JSON.stringify(currentPrefs), userId]
    );
    
    res.json({
      success: true,
      message: 'Notification preferences updated',
      data: preferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update notification preferences',
      error: error.message
    });
  }
};

/**
 * Get email configuration (Admin only)
 */
const getEmailConfig = async (req, res) => {
  try {
    // First try to get from database
    const result = await getDb().query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'email_config'`
    );
    
    if (result.rows.length > 0) {
      const config = result.rows[0].setting_value;
      // Mask sensitive fields
      const maskedConfig = {
        ...config,
        smtp: config.smtp ? {
          ...config.smtp,
          pass: config.smtp.pass ? '********' : ''
        } : undefined,
        sendgrid: config.sendgrid ? {
          apiKey: config.sendgrid.apiKey ? '********' : ''
        } : undefined,
        ses: config.ses ? {
          ...config.ses,
          accessKeyId: config.ses.accessKeyId ? '********' : '',
          secretAccessKey: config.ses.secretAccessKey ? '********' : ''
        } : undefined
      };
      
      res.json({
        success: true,
        data: maskedConfig,
        source: 'database'
      });
    } else {
      // Fall back to environment variables
      const { emailConfig } = require('../config/email');
      res.json({
        success: true,
        data: {
          enabled: emailConfig.enabled,
          provider: emailConfig.provider,
          smtp: {
            host: emailConfig.smtp?.host || '',
            port: emailConfig.smtp?.port || 587,
            secure: emailConfig.smtp?.secure || false,
            user: emailConfig.smtp?.auth?.user || '',
            pass: emailConfig.smtp?.auth?.pass ? '********' : ''
          },
          from: emailConfig.from,
          appUrl: emailConfig.appUrl
        },
        source: 'environment'
      });
    }
  } catch (error) {
    console.error('Error getting email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get email configuration',
      error: error.message
    });
  }
};

/**
 * Update email configuration (Admin only)
 */
const updateEmailConfig = async (req, res) => {
  try {
    const { config } = req.body;
    const userId = req.user.user_id;
    
    if (!config) {
      return res.status(400).json({
        success: false,
        message: 'Configuration is required'
      });
    }
    
    // Get existing config to preserve passwords if not changed
    const existingResult = await getDb().query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'email_config'`
    );
    
    let finalConfig = { ...config };
    
    if (existingResult.rows.length > 0) {
      const existing = existingResult.rows[0].setting_value;
      
      // Preserve passwords if masked
      if (config.smtp?.pass === '********' && existing.smtp?.pass) {
        finalConfig.smtp.pass = existing.smtp.pass;
      }
      if (config.sendgrid?.apiKey === '********' && existing.sendgrid?.apiKey) {
        finalConfig.sendgrid.apiKey = existing.sendgrid.apiKey;
      }
      if (config.ses?.accessKeyId === '********' && existing.ses?.accessKeyId) {
        finalConfig.ses.accessKeyId = existing.ses.accessKeyId;
      }
      if (config.ses?.secretAccessKey === '********' && existing.ses?.secretAccessKey) {
        finalConfig.ses.secretAccessKey = existing.ses.secretAccessKey;
      }
    }
    
    // Upsert the configuration
    await getDb().query(
      `INSERT INTO system_settings (setting_key, setting_value, description, is_sensitive, updated_by, updated_at)
       VALUES ('email_config', $1, 'Email notification configuration', true, $2, NOW())
       ON CONFLICT (setting_key) 
       DO UPDATE SET setting_value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(finalConfig), userId]
    );
    
    // Reload email configuration
    try {
      const emailConfigModule = require('../config/email');
      if (emailConfigModule.reloadConfig) {
        await emailConfigModule.reloadConfig();
      }
    } catch (reloadError) {
      console.warn('Could not reload email config:', reloadError.message);
    }
    
    res.json({
      success: true,
      message: 'Email configuration updated successfully'
    });
  } catch (error) {
    console.error('Error updating email config:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update email configuration',
      error: error.message
    });
  }
};

/**
 * Test email connection with current config
 */
const testEmailConnection = async (req, res) => {
  try {
    const verification = await getEmailService().verifyConnection();
    
    res.json({
      success: verification.success,
      message: verification.message
    });
  } catch (error) {
    console.error('Error testing email connection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test email connection',
      error: error.message
    });
  }
};

module.exports = {
  getEmailStatus,
  sendTestEmail,
  getTemplates,
  previewTemplate,
  getNotificationPreferences,
  updateNotificationPreferences,
  getEmailConfig,
  updateEmailConfig,
  testEmailConnection
};
