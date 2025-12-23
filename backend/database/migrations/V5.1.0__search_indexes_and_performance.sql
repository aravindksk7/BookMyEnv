-- =====================================================
-- V5.1.0 - Search Indexes and Performance Improvements
-- =====================================================
-- This migration adds:
-- 1. pg_trgm extension for efficient ILIKE searches
-- 2. GIN indexes on text columns used for searching
-- =====================================================

-- Enable trigram extension for efficient text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================
-- TEXT SEARCH INDEXES (for ILIKE operations)
-- =====================================================

-- Environment search indexes
CREATE INDEX IF NOT EXISTS idx_environments_name_trgm 
    ON environments USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_environments_description_trgm 
    ON environments USING gin (description gin_trgm_ops);

-- Application search indexes  
CREATE INDEX IF NOT EXISTS idx_applications_name_trgm 
    ON applications USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_applications_description_trgm 
    ON applications USING gin (description gin_trgm_ops);

-- Booking search indexes
CREATE INDEX IF NOT EXISTS idx_bookings_title_trgm 
    ON environment_bookings USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_bookings_description_trgm 
    ON environment_bookings USING gin (description gin_trgm_ops);

-- Interface search indexes
CREATE INDEX IF NOT EXISTS idx_interfaces_name_trgm 
    ON interfaces USING gin (name gin_trgm_ops);

-- Release search indexes
CREATE INDEX IF NOT EXISTS idx_releases_name_trgm 
    ON releases USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_releases_description_trgm 
    ON releases USING gin (description gin_trgm_ops);

-- User search indexes
CREATE INDEX IF NOT EXISTS idx_users_display_name_trgm 
    ON users USING gin (display_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_users_username_trgm 
    ON users USING gin (username gin_trgm_ops);

-- =====================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- =====================================================

-- Environment category and lifecycle for filtering
CREATE INDEX IF NOT EXISTS idx_environments_category 
    ON environments(environment_category);
CREATE INDEX IF NOT EXISTS idx_environments_lifecycle 
    ON environments(lifecycle_stage);

-- Application criticality and domain for filtering
CREATE INDEX IF NOT EXISTS idx_applications_criticality 
    ON applications(criticality);
CREATE INDEX IF NOT EXISTS idx_applications_domain 
    ON applications(business_domain);
