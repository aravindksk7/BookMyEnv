/**
 * Audit Controller - API endpoints for Audit & Compliance
 * Version: 4.2
 */

const auditService = require('../services/auditService');

/**
 * Search audit events with filters
 * GET /api/audit/events
 */
const searchEvents = async (req, res) => {
  try {
    const {
      search,
      entityTypes,
      actionTypes,
      actorUserId,
      actorRole,
      sourceChannel,
      actionResult,
      regulatoryTag,
      dateFrom,
      dateTo,
      entityId,
      correlationId,
      page = 1,
      limit = 50,
      sortBy = 'timestamp_utc',
      sortOrder = 'DESC'
    } = req.query;

    // Parse array parameters
    const parsedEntityTypes = entityTypes ? entityTypes.split(',') : null;
    const parsedActionTypes = actionTypes ? actionTypes.split(',') : null;

    const result = await auditService.searchAuditEvents({
      searchText: search,
      entityTypes: parsedEntityTypes,
      actionTypes: parsedActionTypes,
      actorUserId,
      actorRole,
      sourceChannel,
      actionResult,
      regulatoryTag,
      dateFrom,
      dateTo,
      entityId,
      correlationId,
      page: parseInt(page),
      limit: parseInt(limit),
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result.events,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('Search audit events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search audit events',
      error: error.message
    });
  }
};

/**
 * Get single audit event by ID
 * GET /api/audit/events/:id
 */
const getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await auditService.getAuditEventById(id);

    if (!event) {
      return res.status(404).json({
        success: false,
        message: 'Audit event not found'
      });
    }

    res.json({
      success: true,
      data: event
    });
  } catch (error) {
    console.error('Get audit event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit event',
      error: error.message
    });
  }
};

/**
 * Get audit statistics for dashboard
 * GET /api/audit/stats
 */
const getStats = async (req, res) => {
  try {
    const { dateFrom, dateTo } = req.query;

    const stats = await auditService.getAuditStats(dateFrom, dateTo);

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Get audit stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get audit statistics',
      error: error.message
    });
  }
};

/**
 * Get all report templates
 * GET /api/audit/reports/templates
 */
const getReportTemplates = async (req, res) => {
  try {
    const templates = await auditService.getReportTemplates();

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('Get report templates error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get report templates',
      error: error.message
    });
  }
};

/**
 * Generate a report
 * POST /api/audit/reports/generate
 */
const generateReport = async (req, res) => {
  try {
    const { templateId, filters } = req.body;
    const userId = req.user.user_id;

    if (!templateId) {
      return res.status(400).json({
        success: false,
        message: 'Template ID is required'
      });
    }

    const report = await auditService.generateReport(templateId, filters || {}, userId);

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
};

/**
 * Get saved filters for current user
 * GET /api/audit/filters
 */
const getSavedFilters = async (req, res) => {
  try {
    const userId = req.user.user_id;

    const filters = await auditService.getSavedFilters(userId);

    res.json({
      success: true,
      data: filters
    });
  } catch (error) {
    console.error('Get saved filters error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get saved filters',
      error: error.message
    });
  }
};

/**
 * Save a filter
 * POST /api/audit/filters
 */
const saveFilter = async (req, res) => {
  try {
    const { name, description, filters, isShared } = req.body;
    const userId = req.user.user_id;

    if (!name || !filters) {
      return res.status(400).json({
        success: false,
        message: 'Name and filters are required'
      });
    }

    const savedFilter = await auditService.saveFilter(
      userId, name, description, filters, isShared
    );

    res.status(201).json({
      success: true,
      data: savedFilter,
      message: 'Filter saved successfully'
    });
  } catch (error) {
    console.error('Save filter error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save filter',
      error: error.message
    });
  }
};

/**
 * Get entity types and action types for filter dropdowns
 * GET /api/audit/options
 */
const getFilterOptions = async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        entityTypes: Object.values(auditService.ENTITY_TYPES),
        actionTypes: Object.values(auditService.ACTION_TYPES),
        sourceChannels: Object.values(auditService.SOURCE_CHANNELS),
        regulatoryTags: Object.values(auditService.REGULATORY_TAGS),
        actionResults: ['SUCCESS', 'FAILED', 'UNAUTHORIZED', 'PARTIAL'],
        roles: ['Admin', 'EnvironmentManager', 'ProjectLead', 'Tester', 'Viewer', 'System']
      }
    });
  } catch (error) {
    console.error('Get filter options error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get filter options',
      error: error.message
    });
  }
};

/**
 * Export audit events (CSV/JSON)
 * POST /api/audit/export
 */
const exportEvents = async (req, res) => {
  try {
    const { filters, format = 'json' } = req.body;

    // Search with high limit for export
    const result = await auditService.searchAuditEvents({
      ...filters,
      limit: 10000
    });

    // Log the export action
    await auditService.logAction(
      auditService.ACTION_TYPES.EXPORT,
      auditService.ENTITY_TYPES.REPORT,
      null,
      `Audit Export - ${result.events.length} records`,
      req,
      {
        metadata: { format, recordCount: result.events.length, filters }
      }
    );

    if (format === 'csv') {
      // Convert to CSV
      const headers = [
        'Timestamp', 'Actor', 'Role', 'Action', 'Entity Type', 
        'Entity Name', 'Result', 'Source', 'Regulatory Tag'
      ];
      
      const csvRows = [headers.join(',')];
      
      for (const event of result.events) {
        const row = [
          event.timestamp_utc,
          event.actor_user_name || '',
          event.actor_role || '',
          event.action_type,
          event.entity_type,
          (event.entity_display_name || '').replace(/,/g, ';'),
          event.action_result,
          event.source_channel,
          event.regulatory_tag || ''
        ];
        csvRows.push(row.join(','));
      }
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-export.csv');
      res.send(csvRows.join('\n'));
    } else {
      res.json({
        success: true,
        data: result.events,
        exportedAt: new Date().toISOString(),
        recordCount: result.events.length
      });
    }
  } catch (error) {
    console.error('Export audit events error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export audit events',
      error: error.message
    });
  }
};

module.exports = {
  searchEvents,
  getEventById,
  getStats,
  getReportTemplates,
  generateReport,
  getSavedFilters,
  saveFilter,
  getFilterOptions,
  exportEvents
};
