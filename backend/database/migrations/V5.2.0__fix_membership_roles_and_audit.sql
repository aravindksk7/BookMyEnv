-- =====================================================
-- V5.2.0: Fix membership roles and audit column names
-- =====================================================
-- This migration fixes two production issues:
-- 1. membership_role constraint doesn't allow 'Lead' and 'Owner' values
-- 2. Audit service query uses incorrect column names
-- =====================================================

-- Fix 1: Update user_group_memberships constraint to allow Lead and Owner roles
-- First, drop the existing constraint
ALTER TABLE user_group_memberships 
DROP CONSTRAINT IF EXISTS user_group_memberships_membership_role_check;

-- Add new constraint with all valid membership roles
ALTER TABLE user_group_memberships 
ADD CONSTRAINT user_group_memberships_membership_role_check 
CHECK (membership_role IN ('Member', 'Lead', 'Owner', 'GroupAdmin'));

-- Update any existing 'GroupAdmin' entries to 'Owner' for consistency (optional)
-- Uncomment if you want to migrate existing data:
-- UPDATE user_group_memberships SET membership_role = 'Owner' WHERE membership_role = 'GroupAdmin';

-- Fix 2: The audit column name issue is handled in application code (auditService.js)
-- No database migration needed for that fix as we're using column aliases

-- Log the migration
INSERT INTO audit_events (
    entity_type, 
    entity_display_name, 
    action_type, 
    comment,
    actor_user_name,
    actor_role
) VALUES (
    'Configuration',
    'V5.2.0 Migration',
    'CONFIG_CHANGE',
    'Fixed membership_role constraint to allow Lead and Owner values',
    'System',
    'System'
);
