/**
 * Pagination Utility
 * Provides helper functions for implementing pagination across API endpoints
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

/**
 * Parse pagination parameters from request query
 * @param {Object} query - Request query object
 * @returns {Object} - Parsed pagination params { page, limit, offset }
 */
const parsePaginationParams = (query) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(query.limit) || DEFAULT_PAGE_SIZE)
  );
  const offset = (page - 1) * limit;
  
  return { page, limit, offset };
};

/**
 * Build pagination response object
 * @param {Array} rows - Data rows
 * @param {number} totalCount - Total count of records
 * @param {number} page - Current page
 * @param {number} limit - Items per page
 * @returns {Object} - Pagination response with data and metadata
 */
const buildPaginationResponse = (rows, totalCount, page, limit) => {
  const totalPages = Math.ceil(totalCount / limit);
  
  return {
    data: rows,
    pagination: {
      page,
      limit,
      totalItems: parseInt(totalCount),
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1
    }
  };
};

/**
 * Add pagination SQL clause to a query
 * @param {number} limit - Items per page
 * @param {number} offset - Offset for pagination
 * @param {number} paramIndex - Starting parameter index
 * @returns {Object} - SQL clause and params
 */
const getPaginationSQL = (limit, offset, paramIndex) => {
  return {
    sql: ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
    params: [limit, offset]
  };
};

module.exports = {
  parsePaginationParams,
  buildPaginationResponse,
  getPaginationSQL,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE
};
