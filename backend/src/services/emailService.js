/**
 * Email Service
 * Handles sending email notifications for various events
 */

const { emailConfig, getTransporter, verifyConnection } = require('../config/email');

/**
 * Email templates with HTML and plain text versions
 */
const templates = {
  // Booking request submitted
  bookingRequested: {
    subject: 'Booking Request Submitted - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1976d2; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>Booking Request Submitted</h2>
          <p>Hello {{requesterName}},</p>
          <p>Your booking request has been submitted and is pending approval.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #1976d2;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Start:</strong> {{startDate}}</p>
            <p><strong>End:</strong> {{endDate}}</p>
            <p><strong>Purpose:</strong> {{purpose}}</p>
            <p><strong>Status:</strong> <span style="color: #ff9800;">Pending Approval</span></p>
          </div>
          
          <p>You will receive a notification when your booking is approved or if additional information is needed.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Booking</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv. Please do not reply directly.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Request Submitted

Hello {{requesterName}},

Your booking request has been submitted and is pending approval.

Title: {{title}}
Environment: {{environmentName}}
Start: {{startDate}}
End: {{endDate}}
Purpose: {{purpose}}
Status: Pending Approval

You will receive a notification when your booking is approved.

View your booking at: {{appUrl}}/bookings
    `
  },
  
  // Booking approved
  bookingApproved: {
    subject: 'Booking Approved - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #4caf50; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>🎉 Booking Approved!</h2>
          <p>Hello {{requesterName}},</p>
          <p>Great news! Your booking request has been approved.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #4caf50;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Start:</strong> {{startDate}}</p>
            <p><strong>End:</strong> {{endDate}}</p>
            <p><strong>Approved By:</strong> {{approverName}}</p>
            <p><strong>Status:</strong> <span style="color: #4caf50;">Approved</span></p>
          </div>
          
          <p>Your environment will be ready at the scheduled start time.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Booking Details</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Approved

Hello {{requesterName}},

Great news! Your booking request has been approved.

Title: {{title}}
Environment: {{environmentName}}
Start: {{startDate}}
End: {{endDate}}
Approved By: {{approverName}}
Status: Approved

Your environment will be ready at the scheduled start time.

View your booking at: {{appUrl}}/bookings
    `
  },
  
  // Booking rejected
  bookingRejected: {
    subject: 'Booking Rejected - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #f44336; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>Booking Request Rejected</h2>
          <p>Hello {{requesterName}},</p>
          <p>Unfortunately, your booking request has been rejected.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #f44336;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Requested Dates:</strong> {{startDate}} - {{endDate}}</p>
            <p><strong>Rejected By:</strong> {{approverName}}</p>
            <p><strong>Reason:</strong> {{rejectionReason}}</p>
          </div>
          
          <p>If you have questions, please contact the environment manager or submit a new booking request with different dates.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Submit New Request</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Rejected

Hello {{requesterName}},

Unfortunately, your booking request has been rejected.

Title: {{title}}
Environment: {{environmentName}}
Requested Dates: {{startDate}} - {{endDate}}
Rejected By: {{approverName}}
Reason: {{rejectionReason}}

If you have questions, please contact the environment manager or submit a new booking request.

Create a new request at: {{appUrl}}/bookings
    `
  },
  
  // Booking conflict detected
  bookingConflict: {
    subject: 'Booking Conflict Detected - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>⚠️ Booking Conflict Detected</h2>
          <p>Hello {{requesterName}},</p>
          <p>A scheduling conflict has been detected with your booking.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #ff9800;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Your Booking:</strong> {{startDate}} - {{endDate}}</p>
            <p><strong>Conflicting Booking:</strong> {{conflictTitle}}</p>
            <p><strong>Conflict Period:</strong> {{conflictStart}} - {{conflictEnd}}</p>
          </div>
          
          <p>Please review your booking and consider adjusting the dates or contacting the environment manager to resolve this conflict.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Resolve Conflict</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Conflict Detected

Hello {{requesterName}},

A scheduling conflict has been detected with your booking.

Title: {{title}}
Environment: {{environmentName}}
Your Booking: {{startDate}} - {{endDate}}
Conflicting Booking: {{conflictTitle}}
Conflict Period: {{conflictStart}} - {{conflictEnd}}

Please review your booking and consider adjusting the dates.

Manage your booking at: {{appUrl}}/bookings
    `
  },
  
  // Booking reminder (24 hours before start)
  bookingReminder: {
    subject: 'Reminder: Booking Starting Tomorrow - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1976d2; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>⏰ Booking Reminder</h2>
          <p>Hello {{requesterName}},</p>
          <p>This is a reminder that your environment booking starts in 24 hours.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #1976d2;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Start:</strong> {{startDate}}</p>
            <p><strong>End:</strong> {{endDate}}</p>
            <p><strong>Resources:</strong> {{resources}}</p>
          </div>
          
          <p>Make sure you have everything ready to use the environment when your booking starts.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #1976d2; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Booking</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Reminder

Hello {{requesterName}},

This is a reminder that your environment booking starts in 24 hours.

Title: {{title}}
Environment: {{environmentName}}
Start: {{startDate}}
End: {{endDate}}
Resources: {{resources}}

View your booking at: {{appUrl}}/bookings
    `
  },
  
  // Booking expiring soon
  bookingExpiring: {
    subject: 'Booking Expiring Soon - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #ff9800; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>⏳ Booking Expiring Soon</h2>
          <p>Hello {{requesterName}},</p>
          <p>Your environment booking is ending in {{hoursRemaining}} hours.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #ff9800;">{{title}}</h3>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Ends:</strong> {{endDate}}</p>
          </div>
          
          <p>Please ensure you complete your work before the booking ends. If you need more time, please submit an extension request.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #ff9800; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">Request Extension</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Booking Expiring Soon

Hello {{requesterName}},

Your environment booking is ending in {{hoursRemaining}} hours.

Title: {{title}}
Environment: {{environmentName}}
Ends: {{endDate}}

Please ensure you complete your work before the booking ends.

Manage your booking at: {{appUrl}}/bookings
    `
  },
  
  // Environment maintenance scheduled
  maintenanceScheduled: {
    subject: 'Environment Maintenance Scheduled - {{environmentName}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #9c27b0; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>🔧 Maintenance Scheduled</h2>
          <p>Hello {{userName}},</p>
          <p>Scheduled maintenance has been planned for an environment you have booked.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #9c27b0;">{{environmentName}}</h3>
            <p><strong>Maintenance Window:</strong> {{maintenanceStart}} - {{maintenanceEnd}}</p>
            <p><strong>Reason:</strong> {{reason}}</p>
            <p><strong>Impact:</strong> {{impact}}</p>
          </div>
          
          <p>Your booking may be affected. Please plan accordingly or contact the environment manager if you need to reschedule.</p>
          
          <a href="{{appUrl}}/bookings" style="display: inline-block; background: #9c27b0; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-top: 10px;">View Your Bookings</a>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Maintenance Scheduled

Hello {{userName}},

Scheduled maintenance has been planned for an environment you have booked.

Environment: {{environmentName}}
Maintenance Window: {{maintenanceStart}} - {{maintenanceEnd}}
Reason: {{reason}}
Impact: {{impact}}

Your booking may be affected. Please plan accordingly.

View your bookings at: {{appUrl}}/bookings
    `
  },
  
  // Approval request for managers
  approvalRequest: {
    subject: 'Approval Required - {{title}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #1976d2; color: white; padding: 20px; text-align: center;">
          <h1 style="margin: 0;">BookMyEnv</h1>
        </div>
        <div style="padding: 20px; background: #f5f5f5;">
          <h2>📋 Approval Required</h2>
          <p>Hello {{approverName}},</p>
          <p>A new booking request requires your approval.</p>
          
          <div style="background: white; padding: 15px; border-radius: 8px; margin: 15px 0;">
            <h3 style="margin-top: 0; color: #1976d2;">{{title}}</h3>
            <p><strong>Requested By:</strong> {{requesterName}} ({{requesterEmail}})</p>
            <p><strong>Environment:</strong> {{environmentName}}</p>
            <p><strong>Dates:</strong> {{startDate}} - {{endDate}}</p>
            <p><strong>Purpose:</strong> {{purpose}}</p>
            <p><strong>Priority:</strong> {{priority}}</p>
          </div>
          
          <p>Please review and approve or reject this request.</p>
          
          <div style="margin-top: 20px;">
            <a href="{{appUrl}}/bookings?action=approve&id={{bookingId}}" style="display: inline-block; background: #4caf50; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin-right: 10px;">Approve</a>
            <a href="{{appUrl}}/bookings?action=reject&id={{bookingId}}" style="display: inline-block; background: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">Reject</a>
          </div>
        </div>
        <div style="padding: 15px; text-align: center; color: #666; font-size: 12px;">
          <p>This is an automated message from BookMyEnv.</p>
        </div>
      </div>
    `,
    text: `
BookMyEnv - Approval Required

Hello {{approverName}},

A new booking request requires your approval.

Title: {{title}}
Requested By: {{requesterName}} ({{requesterEmail}})
Environment: {{environmentName}}
Dates: {{startDate}} - {{endDate}}
Purpose: {{purpose}}
Priority: {{priority}}

Please review at: {{appUrl}}/bookings
    `
  }
};

/**
 * Replace template variables with actual values
 */
function renderTemplate(template, data) {
  let html = template.html;
  let text = template.text;
  let subject = template.subject;
  
  // Add app URL to data
  data.appUrl = data.appUrl || emailConfig.appUrl;
  
  // Replace all {{variable}} placeholders
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    html = html.replace(regex, value || '');
    text = text.replace(regex, value || '');
    subject = subject.replace(regex, value || '');
  }
  
  return { html, text, subject };
}

/**
 * Send an email
 */
async function sendEmail(to, templateName, data) {
  if (!emailConfig.enabled) {
    console.log(`[Email Disabled] Would send "${templateName}" to ${to}`);
    return { success: true, message: 'Email disabled - logged only' };
  }
  
  const template = templates[templateName];
  if (!template) {
    throw new Error(`Unknown email template: ${templateName}`);
  }
  
  const { html, text, subject } = renderTemplate(template, data);
  
  const transporter = getTransporter();
  if (!transporter) {
    throw new Error('Email transporter not configured');
  }
  
  try {
    const result = await transporter.sendMail({
      from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject,
      text,
      html
    });
    
    console.log(`[Email Sent] "${templateName}" to ${to} - MessageId: ${result.messageId}`);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`[Email Error] Failed to send "${templateName}" to ${to}:`, error.message);
    throw error;
  }
}

/**
 * Send booking request notification to requester
 */
async function sendBookingRequestedEmail(booking, requester) {
  return sendEmail(requester.email, 'bookingRequested', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    startDate: new Date(booking.start_datetime).toLocaleString(),
    endDate: new Date(booking.end_datetime).toLocaleString(),
    purpose: booking.purpose || 'Not specified'
  });
}

/**
 * Send approval request to approvers
 */
async function sendApprovalRequestEmail(booking, requester, approvers) {
  const promises = approvers.map(approver => 
    sendEmail(approver.email, 'approvalRequest', {
      approverName: approver.display_name || approver.email,
      requesterName: requester.display_name || requester.email,
      requesterEmail: requester.email,
      title: booking.title,
      environmentName: booking.environment_name,
      startDate: new Date(booking.start_datetime).toLocaleString(),
      endDate: new Date(booking.end_datetime).toLocaleString(),
      purpose: booking.purpose || 'Not specified',
      priority: booking.priority || 'Normal',
      bookingId: booking.booking_id
    })
  );
  
  return Promise.allSettled(promises);
}

/**
 * Send booking approved notification
 */
async function sendBookingApprovedEmail(booking, requester, approver) {
  return sendEmail(requester.email, 'bookingApproved', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    startDate: new Date(booking.start_datetime).toLocaleString(),
    endDate: new Date(booking.end_datetime).toLocaleString(),
    approverName: approver.display_name || approver.email
  });
}

/**
 * Send booking rejected notification
 */
async function sendBookingRejectedEmail(booking, requester, approver, reason) {
  return sendEmail(requester.email, 'bookingRejected', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    startDate: new Date(booking.start_datetime).toLocaleString(),
    endDate: new Date(booking.end_datetime).toLocaleString(),
    approverName: approver.display_name || approver.email,
    rejectionReason: reason || 'No reason provided'
  });
}

/**
 * Send conflict notification
 */
async function sendConflictNotificationEmail(booking, requester, conflictingBooking) {
  return sendEmail(requester.email, 'bookingConflict', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    startDate: new Date(booking.start_datetime).toLocaleString(),
    endDate: new Date(booking.end_datetime).toLocaleString(),
    conflictTitle: conflictingBooking.title,
    conflictStart: new Date(conflictingBooking.start_datetime).toLocaleString(),
    conflictEnd: new Date(conflictingBooking.end_datetime).toLocaleString()
  });
}

/**
 * Send booking reminder (24h before)
 */
async function sendBookingReminderEmail(booking, requester) {
  return sendEmail(requester.email, 'bookingReminder', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    startDate: new Date(booking.start_datetime).toLocaleString(),
    endDate: new Date(booking.end_datetime).toLocaleString(),
    resources: booking.resources || 'All environment resources'
  });
}

/**
 * Send expiring soon notification
 */
async function sendBookingExpiringEmail(booking, requester, hoursRemaining) {
  return sendEmail(requester.email, 'bookingExpiring', {
    requesterName: requester.display_name || requester.email,
    title: booking.title,
    environmentName: booking.environment_name,
    endDate: new Date(booking.end_datetime).toLocaleString(),
    hoursRemaining: hoursRemaining.toString()
  });
}

/**
 * Send maintenance notification to affected users
 */
async function sendMaintenanceNotificationEmail(environment, users, maintenanceDetails) {
  const promises = users.map(user =>
    sendEmail(user.email, 'maintenanceScheduled', {
      userName: user.display_name || user.email,
      environmentName: environment.name,
      maintenanceStart: new Date(maintenanceDetails.start).toLocaleString(),
      maintenanceEnd: new Date(maintenanceDetails.end).toLocaleString(),
      reason: maintenanceDetails.reason || 'Scheduled maintenance',
      impact: maintenanceDetails.impact || 'Environment will be unavailable'
    })
  );
  
  return Promise.allSettled(promises);
}

/**
 * Test email configuration
 */
async function sendTestEmail(to) {
  const transporter = getTransporter();
  if (!transporter) {
    return { success: false, message: 'Email not configured' };
  }
  
  try {
    const result = await transporter.sendMail({
      from: `"${emailConfig.from.name}" <${emailConfig.from.email}>`,
      to,
      subject: 'BookMyEnv - Test Email',
      text: 'This is a test email from BookMyEnv. If you received this, your email configuration is working correctly.',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1976d2; color: white; padding: 20px; text-align: center;">
            <h1 style="margin: 0;">BookMyEnv</h1>
          </div>
          <div style="padding: 20px; background: #f5f5f5;">
            <h2>✅ Test Email Successful</h2>
            <p>This is a test email from BookMyEnv.</p>
            <p>If you received this, your email configuration is working correctly.</p>
            <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
          </div>
        </div>
      `
    });
    
    return { success: true, messageId: result.messageId };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = {
  sendEmail,
  sendBookingRequestedEmail,
  sendApprovalRequestEmail,
  sendBookingApprovedEmail,
  sendBookingRejectedEmail,
  sendConflictNotificationEmail,
  sendBookingReminderEmail,
  sendBookingExpiringEmail,
  sendMaintenanceNotificationEmail,
  sendTestEmail,
  verifyConnection,
  templates
};
