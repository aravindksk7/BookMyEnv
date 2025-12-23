/**
 * Email Configuration
 * Supports SMTP, SendGrid, and AWS SES
 * Can load from environment variables or database
 */

// Lazy load nodemailer to avoid startup issues
let nodemailer = null;
const getNodemailer = () => {
  if (!nodemailer) {
    nodemailer = require('nodemailer');
  }
  return nodemailer;
};

// Email provider configuration - defaults from environment
let emailConfig = {
  provider: process.env.EMAIL_PROVIDER || 'smtp', // smtp, sendgrid, ses
  enabled: process.env.EMAIL_ENABLED === 'true',
  
  // SMTP Configuration
  smtp: {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  },
  
  // SendGrid Configuration
  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY
  },
  
  // AWS SES Configuration
  ses: {
    region: process.env.AWS_REGION || 'us-east-1',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
  },
  
  // Default sender
  from: {
    name: process.env.EMAIL_FROM_NAME || 'BookMyEnv',
    email: process.env.EMAIL_FROM_ADDRESS || 'noreply@bookmyenv.local'
  },
  
  // Application URLs for email links
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  
  // Email templates directory
  templatesDir: process.env.EMAIL_TEMPLATES_DIR || './src/templates/email'
};

/**
 * Load configuration from database
 */
async function loadConfigFromDatabase() {
  try {
    const db = require('./database');
    const result = await db.query(
      `SELECT setting_value FROM system_settings WHERE setting_key = 'email_config'`
    );
    
    if (result.rows.length > 0) {
      const dbConfig = result.rows[0].setting_value;
      
      // Merge database config with defaults
      emailConfig = {
        ...emailConfig,
        provider: dbConfig.provider || emailConfig.provider,
        enabled: dbConfig.enabled !== undefined ? dbConfig.enabled : emailConfig.enabled,
        smtp: {
          host: dbConfig.smtp?.host || emailConfig.smtp.host,
          port: dbConfig.smtp?.port || emailConfig.smtp.port,
          secure: dbConfig.smtp?.secure !== undefined ? dbConfig.smtp.secure : emailConfig.smtp.secure,
          auth: {
            user: dbConfig.smtp?.user || emailConfig.smtp.auth.user,
            pass: dbConfig.smtp?.pass || emailConfig.smtp.auth.pass
          }
        },
        sendgrid: {
          apiKey: dbConfig.sendgrid?.apiKey || emailConfig.sendgrid.apiKey
        },
        ses: {
          region: dbConfig.ses?.region || emailConfig.ses.region,
          accessKeyId: dbConfig.ses?.accessKeyId || emailConfig.ses.accessKeyId,
          secretAccessKey: dbConfig.ses?.secretAccessKey || emailConfig.ses.secretAccessKey
        },
        from: {
          name: dbConfig.from?.name || emailConfig.from.name,
          email: dbConfig.from?.email || emailConfig.from.email
        },
        appUrl: dbConfig.appUrl || emailConfig.appUrl
      };
      
      console.log('Email config loaded from database');
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Could not load email config from database:', error.message);
    return false;
  }
}

/**
 * Reload configuration (used when config is updated)
 */
async function reloadConfig() {
  // Reset transporter
  transporter = null;
  
  // Try to load from database
  await loadConfigFromDatabase();
  
  // Recreate transporter if enabled
  if (emailConfig.enabled) {
    transporter = createTransporter();
  }
  
  return emailConfig;
}

/**
 * Create email transporter based on provider
 */
function createTransporter() {
  if (!emailConfig.enabled) {
    console.log('Email notifications are disabled');
    return null;
  }
  
  const nm = getNodemailer();
  
  switch (emailConfig.provider) {
    case 'sendgrid':
      return nm.createTransport({
        host: 'smtp.sendgrid.net',
        port: 587,
        auth: {
          user: 'apikey',
          pass: emailConfig.sendgrid.apiKey
        }
      });
      
    case 'ses':
      const aws = require('@aws-sdk/client-ses');
      const { defaultProvider } = require('@aws-sdk/credential-provider-node');
      
      return nm.createTransport({
        SES: {
          ses: new aws.SES({
            region: emailConfig.ses.region,
            credentials: defaultProvider()
          }),
          aws
        }
      });
      
    case 'smtp':
    default:
      return nm.createTransport(emailConfig.smtp);
  }
}

// Create transporter instance
let transporter = null;

/**
 * Get or create transporter
 */
function getTransporter() {
  if (!transporter && emailConfig.enabled) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * Verify email configuration
 */
async function verifyConnection() {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, message: 'Email is disabled' };
  }
  
  try {
    await transport.verify();
    return { success: true, message: 'Email configuration verified' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Initialize email config - try to load from database
 */
async function initializeConfig() {
  await loadConfigFromDatabase();
}

module.exports = {
  emailConfig,
  getTransporter,
  verifyConnection,
  reloadConfig,
  initializeConfig,
  loadConfigFromDatabase
};
