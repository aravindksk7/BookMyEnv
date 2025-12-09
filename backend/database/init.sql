-- =====================================================
-- TEST ENVIRONMENT MANAGEMENT - DATABASE SCHEMA
-- Version: 1.2
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- USER & IDENTITY MANAGEMENT
-- =====================================================

-- User Groups
CREATE TABLE user_groups (
    group_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    group_type VARCHAR(20) CHECK (group_type IN ('Team', 'Project', 'LOB', 'Other')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    role VARCHAR(30) NOT NULL CHECK (role IN ('Admin', 'EnvironmentManager', 'ProjectLead', 'Tester', 'Viewer')),
    auth_mode VARCHAR(10) NOT NULL DEFAULT 'Local' CHECK (auth_mode IN ('Local', 'SSO')),
    default_group_id UUID REFERENCES user_groups(group_id),
    is_active BOOLEAN DEFAULT true,
    time_zone VARCHAR(50) DEFAULT 'UTC',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Identity Provider Configs
CREATE TABLE identity_provider_configs (
    idp_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idp_type VARCHAR(20) CHECK (idp_type IN ('AzureAD', 'Okta', 'Ping', 'Auth0', 'Custom')),
    name VARCHAR(100) NOT NULL,
    issuer_url VARCHAR(500),
    client_id VARCHAR(255),
    client_secret_encrypted TEXT,
    metadata_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User Identities (SSO)
CREATE TABLE user_identities (
    user_identity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    idp_id UUID NOT NULL REFERENCES identity_provider_configs(idp_id) ON DELETE CASCADE,
    subject_id VARCHAR(255) NOT NULL,
    idp_username VARCHAR(255),
    idp_email VARCHAR(255),
    raw_groups_claim TEXT,
    last_login_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(idp_id, subject_id)
);

-- User Group Memberships
CREATE TABLE user_group_memberships (
    membership_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES user_groups(group_id) ON DELETE CASCADE,
    membership_role VARCHAR(20) NOT NULL CHECK (membership_role IN ('Member', 'GroupAdmin')),
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, group_id)
);

-- SSO Group Mappings
CREATE TABLE sso_group_mappings (
    sso_group_mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    idp_id UUID NOT NULL REFERENCES identity_provider_configs(idp_id) ON DELETE CASCADE,
    idp_group_name VARCHAR(255) NOT NULL,
    group_id UUID NOT NULL REFERENCES user_groups(group_id) ON DELETE CASCADE,
    auto_provision_membership BOOLEAN DEFAULT true,
    UNIQUE(idp_id, idp_group_name)
);

-- =====================================================
-- EXTERNAL TOOL INTEGRATIONS
-- =====================================================

CREATE TABLE external_tool_integrations (
    integration_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_type VARCHAR(20) NOT NULL CHECK (tool_type IN ('Jira', 'GitLab', 'ServiceNow', 'Jenkins', 'AzureDevOps', 'Other')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_url VARCHAR(500) NOT NULL,
    api_version VARCHAR(20),
    project_key VARCHAR(100),
    scope_type VARCHAR(20) NOT NULL DEFAULT 'Global' CHECK (scope_type IN ('Global', 'Project', 'Group')),
    scope_ref VARCHAR(100),
    auth_method VARCHAR(20) CHECK (auth_method IN ('PAT', 'OAuth2Client', 'Basic', 'APIKey', 'Other')),
    credentials_encrypted TEXT,
    api_token_encrypted TEXT,
    additional_config JSONB,
    credentials_secret_ref VARCHAR(255),
    oauth_client_id VARCHAR(255),
    oauth_token_url VARCHAR(500),
    oauth_scopes TEXT,
    is_active BOOLEAN DEFAULT true,
    last_sync_at TIMESTAMP WITH TIME ZONE,
    last_sync_status VARCHAR(20) CHECK (last_sync_status IN ('Success', 'Failed', 'Partial', 'InProgress')),
    last_error_message TEXT,
    health_check_url VARCHAR(500),
    sync_enabled BOOLEAN DEFAULT true,
    sync_interval_minutes INTEGER DEFAULT 15,
    webhook_secret VARCHAR(255),
    webhook_url VARCHAR(500),
    created_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User External Accounts
CREATE TABLE user_external_accounts (
    user_external_account_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    external_username VARCHAR(100),
    external_user_id VARCHAR(255),
    external_email VARCHAR(255),
    access_token_encrypted TEXT,
    refresh_token_encrypted TEXT,
    token_expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, integration_id)
);

-- =====================================================
-- ENVIRONMENTS & INFRASTRUCTURE
-- =====================================================

-- Environments (Logical)
CREATE TABLE environments (
    environment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    environment_category VARCHAR(20) CHECK (environment_category IN ('NonProd', 'PreProd', 'DR', 'Training', 'Sandpit','E2E','Integration','Performance','NFT','UAT','ITE','IWT','Staging','Production','Other')),
    lifecycle_stage VARCHAR(20) CHECK (lifecycle_stage IN ('Planned', 'Active', 'Retiring', 'Decommissioned')),
    owner_team VARCHAR(100),
    support_group VARCHAR(100),
    data_sensitivity VARCHAR(20) CHECK (data_sensitivity IN ('PII', 'PCI', 'Confidential', 'NonProdDummy')),
    usage_policies TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Environment Instances
CREATE TABLE environment_instances (
    env_instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    environment_id UUID NOT NULL REFERENCES environments(environment_id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    operational_status VARCHAR(20) DEFAULT 'Available' CHECK (operational_status IN ('Available', 'Broken', 'Maintenance', 'Provisioning')),
    booking_status VARCHAR(20) DEFAULT 'Available' CHECK (booking_status IN ('Available', 'PartiallyBooked', 'FullyBooked')),
    active_booking_count INTEGER DEFAULT 0,
    availability_window VARCHAR(100),
    capacity INTEGER,
    primary_location VARCHAR(100),
    bookable BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(environment_id, name)
);

-- Infrastructure Components
CREATE TABLE infra_components (
    infra_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    env_instance_id UUID REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('VM', 'DB', 'KafkaTopic', 'MQQueue', 'Storage', 'LoadBalancer', 'DNS', 'Other')),
    technology VARCHAR(100),
    host VARCHAR(255),
    namespace VARCHAR(100),
    capacity VARCHAR(100),
    operational_status VARCHAR(20) DEFAULT 'Active' CHECK (operational_status IN ('Active', 'Degraded', 'Offline')),
    booking_status VARCHAR(20) DEFAULT 'Available' CHECK (booking_status IN ('Available', 'Reserved', 'InUse', 'Blocked')),
    current_booking_id UUID,
    owner_team VARCHAR(100),
    max_concurrent_bookings INTEGER DEFAULT 1,
    is_shared BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Interfaces
CREATE TABLE interfaces (
    interface_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    direction VARCHAR(20) CHECK (direction IN ('Inbound', 'Outbound', 'Bidirectional')),
    pattern VARCHAR(20) CHECK (pattern IN ('REST', 'SOAP', 'MQ', 'Kafka', 'FileDrop', 'FTP', 'SFTP', 'FIX', 'Other')),
    frequency VARCHAR(20) CHECK (frequency IN ('RealTime', 'NearRealTime', 'Batch')),
    external_party VARCHAR(255),
    sla VARCHAR(100),
    contract_id VARCHAR(100),
    source_application_id UUID,
    target_application_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- APPLICATIONS & COMPONENTS
-- =====================================================

-- Applications
CREATE TABLE applications (
    application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    business_domain VARCHAR(100),
    description TEXT,
    criticality VARCHAR(10) CHECK (criticality IN ('High', 'Medium', 'Low')),
    data_sensitivity VARCHAR(20) CHECK (data_sensitivity IN ('PII', 'PCI', 'Confidential', 'NonProdDummy','')),
    owner_team VARCHAR(100),
    test_owner VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application Components
CREATE TABLE app_components (
    component_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    component_type VARCHAR(30) CHECK (component_type IN ('API', 'UI', 'Batch', 'RuleEngine', 'DBSchema', 'MessageProcessor', 'Job', 'Lambda', 'Other')),
    source_repo VARCHAR(500),
    build_pipeline_id VARCHAR(255),
    runtime_platform VARCHAR(100),
    owner_team VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Application Environment Instances
CREATE TABLE application_environment_instances (
    app_env_instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    deployment_model VARCHAR(20) CHECK (deployment_model IN ('Monolith', 'Microservices', 'SaaS', 'COTS')),
    version VARCHAR(50),
    deployment_status VARCHAR(20) CHECK (deployment_status IN ('Aligned', 'Mixed', 'OutOfSync', 'Broken')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(application_id, env_instance_id)
);

-- Component Instances
CREATE TABLE component_instances (
    component_instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES app_components(component_id) ON DELETE CASCADE,
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    version VARCHAR(50),
    deployment_status VARCHAR(30) CHECK (deployment_status IN ('Deployed', 'PartiallyDeployed', 'RollbackPending', 'Failed')),
    last_deployed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(component_id, env_instance_id)
);

-- Interface Endpoints
CREATE TABLE interface_endpoints (
    interface_endpoint_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interface_id UUID NOT NULL REFERENCES interfaces(interface_id) ON DELETE CASCADE,
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    source_component_instance_id UUID REFERENCES component_instances(component_instance_id),
    target_component_instance_id UUID REFERENCES component_instances(component_instance_id),
    external_stub_id VARCHAR(255),
    endpoint VARCHAR(500),
    enabled BOOLEAN DEFAULT true,
    test_mode VARCHAR(20) CHECK (test_mode IN ('Live', 'Virtualised', 'Stubbed', 'Disabled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- CONFIGURATION MANAGEMENT
-- =====================================================

-- Config Sets
CREATE TABLE config_sets (
    config_set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_type VARCHAR(30) CHECK (scope_type IN ('EnvironmentInstance', 'Application', 'ComponentInstance', 'InterfaceEndpoint')),
    scope_ref_id UUID NOT NULL,
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('Draft', 'Active', 'Deprecated')),
    created_by UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Config Items
CREATE TABLE config_items (
    config_item_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    config_set_id UUID NOT NULL REFERENCES config_sets(config_set_id) ON DELETE CASCADE,
    key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    data_type VARCHAR(20) CHECK (data_type IN ('String', 'Int', 'Boolean', 'JSON', 'SecretRef')),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Test Data Sets
CREATE TABLE test_data_sets (
    test_data_set_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    application_id UUID REFERENCES applications(application_id),
    data_generation_method VARCHAR(20) CHECK (data_generation_method IN ('Masked', 'Synthetic', 'Hybrid')),
    refresh_frequency VARCHAR(50),
    last_refreshed_date TIMESTAMP WITH TIME ZONE,
    data_completeness_score INTEGER,
    constraints TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- RELEASES
-- =====================================================

-- Releases
CREATE TABLE releases (
    release_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    release_type VARCHAR(20) CHECK (release_type IN ('Major', 'Minor', 'Hotfix', 'ServicePack', 'Other')),
    status VARCHAR(20) NOT NULL CHECK (status IN ('Planned', 'InProgress', 'CodeComplete', 'Testing', 'ReadyForProd', 'Deployed', 'Failed', 'RolledBack', 'Cancelled')),
    planned_start_datetime TIMESTAMP WITH TIME ZONE,
    planned_end_datetime TIMESTAMP WITH TIME ZONE,
    actual_start_datetime TIMESTAMP WITH TIME ZONE,
    actual_end_datetime TIMESTAMP WITH TIME ZONE,
    release_manager_user_id UUID REFERENCES users(user_id),
    owning_group_id UUID REFERENCES user_groups(group_id),
    jira_release_key VARCHAR(100),
    git_tag VARCHAR(255),
    servicenow_change_batch_id VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- BOOKINGS
-- =====================================================

-- Environment Bookings
CREATE TABLE environment_bookings (
    booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_type VARCHAR(20) NOT NULL CHECK (booking_type IN ('SingleEnv', 'MultiEnvE2E')),
    project_id VARCHAR(100),
    test_phase VARCHAR(20) NOT NULL CHECK (test_phase IN ('SIT', 'UAT', 'NFT', 'Performance', 'DRRehearsal', 'PenTest', 'Other')),
    title VARCHAR(255),
    description TEXT,
    start_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    end_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
    booking_status VARCHAR(20) NOT NULL CHECK (booking_status IN ('Requested', 'PendingApproval', 'Approved', 'Active', 'Completed', 'Cancelled')),
    conflict_status VARCHAR(20) NOT NULL DEFAULT 'None' CHECK (conflict_status IN ('None', 'PotentialConflict', 'ConflictConfirmed', 'Resolved')),
    conflict_notes TEXT,
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id),
    owning_group_id UUID REFERENCES user_groups(group_id),
    approved_by_user_id UUID REFERENCES users(user_id),
    linked_release_id UUID REFERENCES releases(release_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key for infra_components
ALTER TABLE infra_components ADD CONSTRAINT fk_infra_current_booking 
    FOREIGN KEY (current_booking_id) REFERENCES environment_bookings(booking_id) ON DELETE SET NULL;

-- Add foreign keys for interfaces (applications are defined later)
ALTER TABLE interfaces ADD CONSTRAINT fk_interface_source_application
    FOREIGN KEY (source_application_id) REFERENCES applications(application_id) ON DELETE SET NULL;
ALTER TABLE interfaces ADD CONSTRAINT fk_interface_target_application
    FOREIGN KEY (target_application_id) REFERENCES applications(application_id) ON DELETE SET NULL;

-- Booking Resources
CREATE TABLE booking_resources (
    booking_resource_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES environment_bookings(booking_id) ON DELETE CASCADE,
    resource_type VARCHAR(30) NOT NULL CHECK (resource_type IN ('EnvironmentInstance', 'ComponentInstance', 'InfraComponent')),
    resource_ref_id UUID NOT NULL,
    source_env_instance_id UUID REFERENCES environment_instances(env_instance_id),
    logical_role VARCHAR(30) CHECK (logical_role IN ('SystemUnderTest', 'UpstreamDependency', 'DownstreamDependency', 'SharedInfra', 'DataStore', 'MessageBroker', 'SupportService', 'Other')),
    start_datetime_override TIMESTAMP WITH TIME ZONE,
    end_datetime_override TIMESTAMP WITH TIME ZONE,
    resource_conflict_status VARCHAR(20) DEFAULT 'None' CHECK (resource_conflict_status IN ('None', 'PotentialConflict', 'ConflictConfirmed', 'Resolved')),
    conflicting_booking_id UUID REFERENCES environment_bookings(booking_id),
    conflict_resolution_note TEXT,
    resource_booking_status VARCHAR(20) DEFAULT 'Pending' CHECK (resource_booking_status IN ('Pending', 'Reserved', 'Active', 'Released')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Booking Applications
CREATE TABLE booking_applications (
    booking_application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID NOT NULL REFERENCES environment_bookings(booking_id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    UNIQUE(booking_id, application_id)
);

-- =====================================================
-- RELEASE DETAILS
-- =====================================================

-- Release Applications
CREATE TABLE release_applications (
    release_application_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    release_id UUID NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
    application_id UUID NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    planned_version VARCHAR(50),
    actual_version VARCHAR(50),
    UNIQUE(release_id, application_id)
);

-- Release Environments
CREATE TABLE release_environments (
    release_environment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    release_id UUID NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id) ON DELETE CASCADE,
    deployment_window_start TIMESTAMP WITH TIME ZONE,
    deployment_window_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Planned', 'InProgress', 'Deployed', 'Failed', 'RolledBack', 'Skipped')),
    associated_booking_id UUID REFERENCES environment_bookings(booking_id),
    UNIQUE(release_id, env_instance_id)
);

-- Release Component Instances
CREATE TABLE release_component_instances (
    release_component_instance_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    release_id UUID NOT NULL REFERENCES releases(release_id) ON DELETE CASCADE,
    component_instance_id UUID NOT NULL REFERENCES component_instances(component_instance_id) ON DELETE CASCADE,
    planned_version VARCHAR(50),
    deployed_version VARCHAR(50),
    deployment_status VARCHAR(20) NOT NULL CHECK (deployment_status IN ('Planned', 'InProgress', 'Deployed', 'Failed', 'RolledBack'))
);

-- Changes
CREATE TABLE changes (
    change_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type VARCHAR(20) CHECK (type IN ('Infra', 'Config', 'CodeDeployment', 'DataRefresh', 'Other')),
    env_instance_id UUID NOT NULL REFERENCES environment_instances(env_instance_id),
    release_id UUID REFERENCES releases(release_id),
    planned_datetime TIMESTAMP WITH TIME ZONE,
    actual_datetime TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) CHECK (status IN ('Planned', 'InProgress', 'Completed', 'RolledBack')),
    risk_level VARCHAR(10) CHECK (risk_level IN ('Low', 'Medium', 'High')),
    requested_by UUID REFERENCES users(user_id),
    change_ticket_ref VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INTEGRATION LINKS
-- =====================================================

CREATE TABLE integration_links (
    integration_link_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    external_type VARCHAR(30) NOT NULL CHECK (external_type IN (
        'JiraIssue', 'JiraEpic', 'JiraRelease', 'JiraSprint',
        'GitLabPipeline', 'GitLabMR', 'GitLabTag', 'GitLabBranch', 'GitLabCommit',
        'ServiceNowChange', 'ServiceNowIncident', 'ServiceNowTask', 'ServiceNowCI',
        'Other'
    )),
    external_key VARCHAR(100) NOT NULL,
    external_id VARCHAR(255),
    external_url VARCHAR(1000),
    external_status VARCHAR(50),
    external_summary TEXT,
    linked_entity_type VARCHAR(30) NOT NULL CHECK (linked_entity_type IN (
        'EnvironmentInstance', 'Application', 'AppComponent', 'ComponentInstance',
        'EnvironmentBooking', 'BookingResource', 'Change', 'Release',
        'ReleaseEnvironment', 'TestDataSet', 'ConfigSet', 'Other'
    )),
    linked_entity_id UUID NOT NULL,
    link_purpose VARCHAR(100),
    link_direction VARCHAR(20) DEFAULT 'Outbound' CHECK (link_direction IN ('Inbound', 'Outbound', 'Bidirectional')),
    is_primary BOOLEAN DEFAULT false,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    sync_enabled BOOLEAN DEFAULT true,
    created_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Integration Sync Logs
CREATE TABLE integration_sync_logs (
    sync_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    sync_type VARCHAR(30) NOT NULL CHECK (sync_type IN ('Full', 'Incremental', 'Webhook', 'Manual')),
    sync_direction VARCHAR(20) CHECK (sync_direction IN ('Inbound', 'Outbound', 'Bidirectional')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('InProgress', 'Success', 'Failed', 'Partial')),
    records_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    records_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    triggered_by_user_id UUID REFERENCES users(user_id)
);

-- Webhook Events
CREATE TABLE integration_webhook_events (
    webhook_event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_source VARCHAR(50),
    payload JSONB NOT NULL,
    headers JSONB,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Processing', 'Processed', 'Failed', 'Ignored')),
    processing_result JSONB,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    next_retry_at TIMESTAMP WITH TIME ZONE
);

-- Jira Project Mappings
CREATE TABLE jira_project_mappings (
    jira_mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    jira_project_key VARCHAR(20) NOT NULL,
    jira_project_id VARCHAR(50),
    jira_project_name VARCHAR(255),
    default_application_id UUID REFERENCES applications(application_id),
    default_owning_group_id UUID REFERENCES user_groups(group_id),
    issue_type_mappings JSONB,
    sync_issues BOOLEAN DEFAULT true,
    sync_releases BOOLEAN DEFAULT true,
    sync_sprints BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- GitLab Project Mappings
CREATE TABLE gitlab_project_mappings (
    gitlab_mapping_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    gitlab_project_id VARCHAR(50) NOT NULL,
    gitlab_project_path VARCHAR(500),
    gitlab_project_name VARCHAR(255),
    default_application_id UUID REFERENCES applications(application_id),
    default_component_id UUID REFERENCES app_components(component_id),
    environment_mappings JSONB,
    sync_pipelines BOOLEAN DEFAULT true,
    sync_merge_requests BOOLEAN DEFAULT true,
    sync_tags BOOLEAN DEFAULT true,
    auto_create_releases BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ServiceNow Config
CREATE TABLE servicenow_config (
    snow_config_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id) ON DELETE CASCADE,
    instance_name VARCHAR(100),
    change_table VARCHAR(100) DEFAULT 'change_request',
    incident_table VARCHAR(100) DEFAULT 'incident',
    ci_table VARCHAR(100) DEFAULT 'cmdb_ci',
    change_field_mappings JSONB,
    incident_field_mappings JSONB,
    ci_field_mappings JSONB,
    auto_create_change_for_booking BOOLEAN DEFAULT false,
    auto_create_change_for_release BOOLEAN DEFAULT false,
    change_template_sys_id VARCHAR(50),
    sync_approval_status BOOLEAN DEFAULT true,
    approval_group_mapping JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Pipeline Executions
CREATE TABLE pipeline_executions (
    pipeline_execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES external_tool_integrations(integration_id),
    external_pipeline_id VARCHAR(100) NOT NULL,
    external_pipeline_url VARCHAR(1000),
    pipeline_name VARCHAR(255),
    git_ref VARCHAR(255),
    git_commit_sha VARCHAR(50),
    git_commit_message TEXT,
    status VARCHAR(30) CHECK (status IN ('Pending', 'Running', 'Success', 'Failed', 'Cancelled', 'Skipped')),
    started_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    duration_seconds INTEGER,
    triggered_by_release_id UUID REFERENCES releases(release_id),
    target_env_instance_id UUID REFERENCES environment_instances(env_instance_id),
    target_component_instance_id UUID REFERENCES component_instances(component_instance_id),
    stages JSONB,
    variables JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- ACTIVITY LOG
-- =====================================================

CREATE TABLE activities (
    activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(user_id),
    action VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    details JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATIONS
-- =====================================================

CREATE TABLE notifications (
    notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(30) CHECK (type IN ('Info', 'Warning', 'Error', 'Success', 'BookingReminder', 'ConflictAlert', 'ApprovalRequired')),
    related_entity_type VARCHAR(50),
    related_entity_id UUID,
    is_read BOOLEAN DEFAULT false,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_user_identities_user ON user_identities(user_id);
CREATE INDEX idx_user_group_memberships_user ON user_group_memberships(user_id);
CREATE INDEX idx_user_group_memberships_group ON user_group_memberships(group_id);

CREATE INDEX idx_environment_instances_env ON environment_instances(environment_id);
CREATE INDEX idx_environment_instances_status ON environment_instances(operational_status, booking_status);
CREATE INDEX idx_infra_components_env ON infra_components(env_instance_id);
CREATE INDEX idx_infra_components_booking ON infra_components(booking_status);

CREATE INDEX idx_applications_name ON applications(name);
CREATE INDEX idx_app_components_app ON app_components(application_id);
CREATE INDEX idx_component_instances_env ON component_instances(env_instance_id);
CREATE INDEX idx_app_env_instances_app ON application_environment_instances(application_id);
CREATE INDEX idx_app_env_instances_env ON application_environment_instances(env_instance_id);

CREATE INDEX idx_bookings_status ON environment_bookings(booking_status);
CREATE INDEX idx_bookings_dates ON environment_bookings(start_datetime, end_datetime);
CREATE INDEX idx_bookings_user ON environment_bookings(requested_by_user_id);
CREATE INDEX idx_booking_resources_booking ON booking_resources(booking_id);
CREATE INDEX idx_booking_resources_type_ref ON booking_resources(resource_type, resource_ref_id);

CREATE INDEX idx_releases_status ON releases(status);
CREATE INDEX idx_releases_dates ON releases(planned_start_datetime, planned_end_datetime);
CREATE INDEX idx_release_envs_release ON release_environments(release_id);

CREATE INDEX idx_integration_links_entity ON integration_links(linked_entity_type, linked_entity_id);
CREATE INDEX idx_integration_links_external ON integration_links(external_type, external_key);
CREATE INDEX idx_webhook_events_status ON integration_webhook_events(status, received_at);
CREATE INDEX idx_pipeline_executions_release ON pipeline_executions(triggered_by_release_id);

CREATE INDEX idx_activities_user ON activities(user_id);
CREATE INDEX idx_activities_entity ON activities(entity_type, entity_id);
CREATE INDEX idx_activities_created ON activities(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id, is_read);

-- =====================================================
-- DEMO DATA
-- =====================================================

-- Insert User Groups
INSERT INTO user_groups (group_id, name, description, group_type) VALUES
    ('11111111-1111-1111-1111-111111111111', 'Platform Team', 'Environment platform team', 'Team'),
    ('22222222-2222-2222-2222-222222222222', 'Payments Team', 'Payment services development team', 'Team'),
    ('33333333-3333-3333-3333-333333333333', 'Core Banking Team', 'Core banking development team', 'Team'),
    ('44444444-4444-4444-4444-444444444444', 'QA Team', 'Quality assurance team', 'Team');

-- Insert Demo Users (bcrypt hashed passwords with 12 rounds)
-- All demo users use password: Admin@123
-- Hash generated with: bcrypt.hash('Admin@123', 12)
INSERT INTO users (user_id, username, display_name, email, password_hash, role, auth_mode, default_group_id, is_active) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin', 'System Administrator', 'admin@bme.local', '$2a$12$keJpfSQ.XGgJ6emhmsAnwunZxONNvSs26kK6FSUR3rKmGueCxmcbC', 'Admin', 'Local', '11111111-1111-1111-1111-111111111111', true),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'envmgr', 'Environment Manager', 'envmgr@bme.local', '$2a$12$keJpfSQ.XGgJ6emhmsAnwunZxONNvSs26kK6FSUR3rKmGueCxmcbC', 'EnvironmentManager', 'Local', '11111111-1111-1111-1111-111111111111', true),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'lead', 'Project Lead', 'lead@bme.local', '$2a$12$keJpfSQ.XGgJ6emhmsAnwunZxONNvSs26kK6FSUR3rKmGueCxmcbC', 'ProjectLead', 'Local', '22222222-2222-2222-2222-222222222222', true),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'tester', 'Test Engineer', 'tester@bme.local', '$2a$12$keJpfSQ.XGgJ6emhmsAnwunZxONNvSs26kK6FSUR3rKmGueCxmcbC', 'Tester', 'Local', '44444444-4444-4444-4444-444444444444', true),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'viewer', 'Read Only User', 'viewer@bme.local', '$2a$12$keJpfSQ.XGgJ6emhmsAnwunZxONNvSs26kK6FSUR3rKmGueCxmcbC', 'Viewer', 'Local', '44444444-4444-4444-4444-444444444444', true);

-- Insert Group Memberships
INSERT INTO user_group_memberships (user_id, group_id, membership_role) VALUES
    ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'GroupAdmin'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'GroupAdmin'),
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'GroupAdmin'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', '44444444-4444-4444-4444-444444444444', 'Member'),
    ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '44444444-4444-4444-4444-444444444444', 'Member');

-- Insert Environments
INSERT INTO environments (environment_id, name, description, environment_category, lifecycle_stage, owner_team, data_sensitivity) VALUES
    ('e1111111-1111-1111-1111-111111111111', 'SIT', 'System Integration Testing', 'NonProd', 'Active', 'Platform Team', 'NonProdDummy'),
    ('e2222222-2222-2222-2222-222222222222', 'UAT', 'User Acceptance Testing', 'NonProd', 'Active', 'Platform Team', 'NonProdDummy'),
    ('e3333333-3333-3333-3333-333333333333', 'NFT', 'Non-Functional Testing', 'NonProd', 'Active', 'Platform Team', 'NonProdDummy'),
    ('e4444444-4444-4444-4444-444444444444', 'PERF', 'Performance Testing', 'PreProd', 'Active', 'Platform Team', 'NonProdDummy'),
    ('e5555555-5555-5555-5555-555555555555', 'DR', 'Disaster Recovery', 'DR', 'Active', 'Platform Team', 'Confidential');

-- Insert Environment Instances
INSERT INTO environment_instances (env_instance_id, environment_id, name, operational_status, booking_status, capacity, primary_location, bookable) VALUES
    ('a1111111-1111-1111-1111-111111111111', 'e1111111-1111-1111-1111-111111111111', 'SIT1', 'Available', 'Available', 10, 'Sydney DC', true),
    ('a2222222-2222-2222-2222-222222222222', 'e1111111-1111-1111-1111-111111111111', 'SIT2', 'Available', 'Available', 10, 'Sydney DC', true),
    ('a3333333-3333-3333-3333-333333333333', 'e2222222-2222-2222-2222-222222222222', 'UAT1', 'Available', 'Available', 15, 'Melbourne DC', true),
    ('a4444444-4444-4444-4444-444444444444', 'e2222222-2222-2222-2222-222222222222', 'UAT2', 'Maintenance', 'Available', 15, 'Melbourne DC', false),
    ('a5555555-5555-5555-5555-555555555555', 'e3333333-3333-3333-3333-333333333333', 'NFT1', 'Available', 'Available', 20, 'Sydney DC', true),
    ('a6666666-6666-6666-6666-666666666666', 'e4444444-4444-4444-4444-444444444444', 'PERF1', 'Available', 'Available', 50, 'Melbourne DC', true);

-- Insert Infrastructure Components
INSERT INTO infra_components (infra_id, env_instance_id, name, type, technology, host, operational_status, booking_status, is_shared) VALUES
    ('b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'payments-db', 'DB', 'PostgreSQL 15', 'sit1-db01.internal', 'Active', 'Available', false),
    ('b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'payments-kafka', 'KafkaTopic', 'Kafka 3.5', 'sit1-kafka.internal', 'Active', 'Available', true),
    ('b3333333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', 'payments-mq', 'MQQueue', 'IBM MQ 9.3', 'sit1-mq.internal', 'Active', 'Available', false),
    ('b4444444-4444-4444-4444-444444444444', 'a3333333-3333-3333-3333-333333333333', 'core-db', 'DB', 'Oracle 19c', 'uat1-db01.internal', 'Active', 'Available', false),
    ('b5555555-5555-5555-5555-555555555555', 'a3333333-3333-3333-3333-333333333333', 'core-kafka', 'KafkaTopic', 'Kafka 3.5', 'uat1-kafka.internal', 'Active', 'Available', true),
    ('b6666666-6666-6666-6666-666666666666', 'a5555555-5555-5555-5555-555555555555', 'nft-loadgen', 'VM', 'Linux RHEL 8', 'nft1-loadgen.internal', 'Active', 'Available', false);

-- Insert Applications
INSERT INTO applications (application_id, name, business_domain, description, criticality, owner_team, test_owner) VALUES
    ('c0a11111-1111-1111-1111-111111111111', 'Payment Gateway', 'Payments', 'Core payment processing system', 'High', 'Payments Team', 'QA Team'),
    ('c0a22222-2222-2222-2222-222222222222', 'Core Banking', 'Banking', 'Core banking platform', 'High', 'Core Banking Team', 'QA Team'),
    ('c0a33333-3333-3333-3333-333333333333', 'Customer Portal', 'Digital', 'Customer-facing web portal', 'Medium', 'Digital Team', 'QA Team'),
    ('c0a44444-4444-4444-4444-444444444444', 'Mobile App', 'Digital', 'Customer mobile application', 'Medium', 'Digital Team', 'QA Team');

-- Insert App Components
INSERT INTO app_components (component_id, application_id, name, component_type, source_repo, runtime_platform, owner_team) VALUES
    ('c0c11111-1111-1111-1111-111111111111', 'c0a11111-1111-1111-1111-111111111111', 'payment-api', 'API', 'gitlab.com/payments/api', 'Kubernetes', 'Payments Team'),
    ('c0c22222-2222-2222-2222-222222222222', 'c0a11111-1111-1111-1111-111111111111', 'payment-processor', 'MessageProcessor', 'gitlab.com/payments/processor', 'Kubernetes', 'Payments Team'),
    ('c0c33333-3333-3333-3333-333333333333', 'c0a22222-2222-2222-2222-222222222222', 'core-api', 'API', 'gitlab.com/core/api', 'WebLogic', 'Core Banking Team'),
    ('c0c44444-4444-4444-4444-444444444444', 'c0a22222-2222-2222-2222-222222222222', 'core-batch', 'Batch', 'gitlab.com/core/batch', 'Control-M', 'Core Banking Team'),
    ('c0c55555-5555-5555-5555-555555555555', 'c0a33333-3333-3333-3333-333333333333', 'portal-ui', 'UI', 'gitlab.com/portal/ui', 'Kubernetes', 'Digital Team');

-- Insert Application Environment Instances
INSERT INTO application_environment_instances (application_id, env_instance_id, deployment_model, version, deployment_status) VALUES
    ('c0a11111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'Microservices', '2.5.0', 'Aligned'),
    ('c0a11111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', 'Microservices', '2.4.0', 'Mixed'),
    ('c0a22222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'Monolith', '10.2.1', 'Aligned'),
    ('c0a22222-2222-2222-2222-222222222222', 'a3333333-3333-3333-3333-333333333333', 'Monolith', '10.2.0', 'Aligned');

-- Insert Component Instances
INSERT INTO component_instances (component_instance_id, component_id, env_instance_id, version, deployment_status, last_deployed_date) VALUES
    ('d0111111-1111-1111-1111-111111111111', 'c0c11111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '2.5.0', 'Deployed', NOW() - INTERVAL '2 days'),
    ('d0222222-2222-2222-2222-222222222222', 'c0c22222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', '2.5.0', 'Deployed', NOW() - INTERVAL '2 days'),
    ('d0333333-3333-3333-3333-333333333333', 'c0c33333-3333-3333-3333-333333333333', 'a1111111-1111-1111-1111-111111111111', '10.2.1', 'Deployed', NOW() - INTERVAL '5 days'),
    ('d0444444-4444-4444-4444-444444444444', 'c0c11111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', '2.4.0', 'Deployed', NOW() - INTERVAL '10 days');

-- Insert Sample Bookings
INSERT INTO environment_bookings (booking_id, booking_type, project_id, test_phase, title, description, start_datetime, end_datetime, booking_status, conflict_status, requested_by_user_id, owning_group_id) VALUES
    ('f0111111-1111-1111-1111-111111111111', 'SingleEnv', 'PAY-2024', 'SIT', 'Payment Gateway SIT Testing', 'Integration testing for payment gateway v2.5', NOW() + INTERVAL '1 day', NOW() + INTERVAL '3 days', 'Approved', 'None', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222'),
    ('f0222222-2222-2222-2222-222222222222', 'MultiEnvE2E', 'CORE-2024', 'UAT', 'Core Banking UAT Cycle 1', 'End-to-end UAT testing for core banking', NOW() + INTERVAL '5 days', NOW() + INTERVAL '10 days', 'PendingApproval', 'None', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '33333333-3333-3333-3333-333333333333'),
    ('f0333333-3333-3333-3333-333333333333', 'SingleEnv', 'PERF-Q4', 'Performance', 'Q4 Performance Testing', 'Quarterly performance testing', NOW() + INTERVAL '15 days', NOW() + INTERVAL '17 days', 'Requested', 'None', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222');

-- Insert Booking Resources
INSERT INTO booking_resources (booking_id, resource_type, resource_ref_id, source_env_instance_id, logical_role, resource_booking_status) VALUES
    ('f0111111-1111-1111-1111-111111111111', 'EnvironmentInstance', 'a1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'SystemUnderTest', 'Reserved'),
    ('f0111111-1111-1111-1111-111111111111', 'InfraComponent', 'b1111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 'DataStore', 'Reserved'),
    ('f0111111-1111-1111-1111-111111111111', 'InfraComponent', 'b2222222-2222-2222-2222-222222222222', 'a1111111-1111-1111-1111-111111111111', 'MessageBroker', 'Reserved'),
    ('f0222222-2222-2222-2222-222222222222', 'EnvironmentInstance', 'a3333333-3333-3333-3333-333333333333', 'a3333333-3333-3333-3333-333333333333', 'SystemUnderTest', 'Pending'),
    ('f0222222-2222-2222-2222-222222222222', 'InfraComponent', 'b4444444-4444-4444-4444-444444444444', 'a3333333-3333-3333-3333-333333333333', 'DataStore', 'Pending');

-- Insert Sample Release
INSERT INTO releases (release_id, name, description, release_type, status, planned_start_datetime, planned_end_datetime, release_manager_user_id, owning_group_id) VALUES
    ('f1e11111-1111-1111-1111-111111111111', 'Payment Gateway v2.5.0', 'Major release with new payment channels', 'Major', 'Testing', NOW() + INTERVAL '20 days', NOW() + INTERVAL '25 days', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222');

-- Insert Release Applications
INSERT INTO release_applications (release_id, application_id, planned_version, actual_version) VALUES
    ('f1e11111-1111-1111-1111-111111111111', 'c0a11111-1111-1111-1111-111111111111', '2.5.0', NULL);

-- Insert Release Environments
INSERT INTO release_environments (release_id, env_instance_id, deployment_window_start, deployment_window_end, status) VALUES
    ('f1e11111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', NOW() + INTERVAL '20 days', NOW() + INTERVAL '21 days', 'Planned'),
    ('f1e11111-1111-1111-1111-111111111111', 'a3333333-3333-3333-3333-333333333333', NOW() + INTERVAL '22 days', NOW() + INTERVAL '23 days', 'Planned');

-- Insert Sample Notifications
INSERT INTO notifications (user_id, title, message, type, related_entity_type, related_entity_id) VALUES
    ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'Booking Approved', 'Your booking for SIT1 has been approved', 'Success', 'EnvironmentBooking', 'f0111111-1111-1111-1111-111111111111'),
    ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'Approval Required', 'Your booking is pending approval', 'ApprovalRequired', 'EnvironmentBooking', 'f0222222-2222-2222-2222-222222222222'),
    ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'New Booking Request', 'A new booking request requires your approval', 'ApprovalRequired', 'EnvironmentBooking', 'f0222222-2222-2222-2222-222222222222');

-- =====================================================
-- REFRESH LIFECYCLE MANAGEMENT TABLES
-- Version: 4.0.0
-- =====================================================

-- Refresh History Table
CREATE TABLE IF NOT EXISTS refresh_history (
    refresh_history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 
        'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
    )),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    refresh_date TIMESTAMP WITH TIME ZONE NOT NULL,
    refresh_type VARCHAR(30) NOT NULL CHECK (refresh_type IN (
        'FULL_COPY', 'PARTIAL_COPY', 'DATA_ONLY', 'CONFIG_ONLY',
        'MASKED_COPY', 'SCHEMA_SYNC', 'GOLDEN_COPY', 'POINT_IN_TIME', 'OTHER'
    )),
    source_environment_id UUID,
    source_environment_name VARCHAR(255),
    source_snapshot_name VARCHAR(255),
    source_snapshot_date TIMESTAMP WITH TIME ZONE,
    requested_by_user_id UUID REFERENCES users(user_id),
    requested_at TIMESTAMP WITH TIME ZONE,
    executed_by_user_id UUID REFERENCES users(user_id),
    executed_at TIMESTAMP WITH TIME ZONE,
    change_ticket_ref VARCHAR(100),
    release_id UUID REFERENCES releases(release_id),
    jira_ref VARCHAR(100),
    servicenow_ref VARCHAR(100),
    execution_status VARCHAR(20) CHECK (execution_status IN (
        'SUCCESS', 'PARTIAL_SUCCESS', 'FAILED', 'ROLLED_BACK'
    )),
    duration_minutes INTEGER,
    data_volume_gb DECIMAL(10,2),
    rows_affected BIGINT,
    notes TEXT,
    error_message TEXT,
    execution_log_url VARCHAR(500),
    refresh_intent_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_history_entity_lookup ON refresh_history(entity_type, entity_id);
CREATE INDEX idx_refresh_history_date ON refresh_history(refresh_date DESC);
CREATE INDEX idx_refresh_history_requested_by ON refresh_history(requested_by_user_id);

-- Refresh Intents Table
CREATE TABLE IF NOT EXISTS refresh_intents (
    refresh_intent_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(30) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 
        'AppComponent', 'Interface', 'InfraComponent', 'TestDataSet'
    )),
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255),
    intent_status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (intent_status IN (
        'DRAFT', 'REQUESTED', 'APPROVED', 'SCHEDULED', 
        'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK'
    )),
    planned_date TIMESTAMP WITH TIME ZONE NOT NULL,
    planned_end_date TIMESTAMP WITH TIME ZONE,
    refresh_type VARCHAR(30) NOT NULL CHECK (refresh_type IN (
        'FULL_COPY', 'PARTIAL_COPY', 'DATA_ONLY', 'CONFIG_ONLY',
        'MASKED_COPY', 'SCHEMA_SYNC', 'GOLDEN_COPY', 'POINT_IN_TIME', 'OTHER'
    )),
    source_environment_id UUID,
    source_environment_name VARCHAR(255),
    source_snapshot_name VARCHAR(255),
    use_latest_snapshot BOOLEAN DEFAULT false,
    impact_scope TEXT[],
    requires_downtime BOOLEAN DEFAULT false,
    estimated_downtime_minutes INTEGER,
    affected_applications UUID[],
    requested_by_user_id UUID NOT NULL REFERENCES users(user_id),
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT NOT NULL,
    business_justification TEXT,
    requires_approval BOOLEAN DEFAULT true,
    approved_by_user_id UUID REFERENCES users(user_id),
    approved_at TIMESTAMP WITH TIME ZONE,
    approval_notes TEXT,
    rejected_by_user_id UUID REFERENCES users(user_id),
    rejected_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    change_ticket_ref VARCHAR(100),
    release_id UUID REFERENCES releases(release_id),
    jira_ref VARCHAR(100),
    servicenow_ref VARCHAR(100),
    notification_groups UUID[],
    notification_lead_days INTEGER[] DEFAULT ARRAY[7, 1],
    notification_sent_dates TIMESTAMP WITH TIME ZONE[],
    execution_started_at TIMESTAMP WITH TIME ZONE,
    execution_completed_at TIMESTAMP WITH TIME ZONE,
    execution_notes TEXT,
    refresh_history_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_refresh_intents_entity ON refresh_intents(entity_type, entity_id);
CREATE INDEX idx_refresh_intents_status ON refresh_intents(intent_status);
CREATE INDEX idx_refresh_intents_planned_date ON refresh_intents(planned_date);
CREATE INDEX idx_refresh_intents_pending_approval ON refresh_intents(intent_status, requested_at) 
    WHERE intent_status = 'REQUESTED';

-- Notification Settings Table
CREATE TABLE IF NOT EXISTS refresh_notification_settings (
    notification_setting_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    scope_type VARCHAR(20) NOT NULL CHECK (scope_type IN ('Entity', 'Group', 'Global')),
    entity_type VARCHAR(30),
    entity_id UUID,
    group_id UUID REFERENCES user_groups(group_id),
    email_enabled BOOLEAN DEFAULT true,
    teams_webhook_url VARCHAR(500),
    slack_webhook_url VARCHAR(500),
    in_app_enabled BOOLEAN DEFAULT true,
    custom_webhook_url VARCHAR(500),
    reminder_days INTEGER[] DEFAULT ARRAY[7, 1],
    reminder_hours INTEGER[] DEFAULT ARRAY[1],
    subscribed_events TEXT[] DEFAULT ARRAY[
        'REFRESH_APPROVED', 'REFRESH_SCHEDULED', 
        'REFRESH_REMINDER_1DAY', 'REFRESH_STARTING', 
        'REFRESH_COMPLETED', 'REFRESH_FAILED'
    ],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_settings_scope ON refresh_notification_settings(scope_type, entity_type, entity_id);

-- Notification Log Table
CREATE TABLE IF NOT EXISTS refresh_notification_log (
    notification_log_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refresh_intent_id UUID REFERENCES refresh_intents(refresh_intent_id),
    event_type VARCHAR(50) NOT NULL,
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('EMAIL', 'TEAMS', 'SLACK', 'IN_APP', 'WEBHOOK')),
    recipient_type VARCHAR(20) CHECK (recipient_type IN ('User', 'Group', 'Webhook')),
    recipient_id UUID,
    recipient_email VARCHAR(255),
    recipient_webhook_url VARCHAR(500),
    status VARCHAR(20) CHECK (status IN ('PENDING', 'SENT', 'DELIVERED', 'FAILED', 'BOUNCED')),
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    subject VARCHAR(500),
    message_body TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_notification_log_intent ON refresh_notification_log(refresh_intent_id);

-- Booking Conflicts Table
CREATE TABLE IF NOT EXISTS refresh_booking_conflicts (
    conflict_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    refresh_intent_id UUID NOT NULL REFERENCES refresh_intents(refresh_intent_id) ON DELETE CASCADE,
    booking_id UUID NOT NULL REFERENCES environment_bookings(booking_id) ON DELETE CASCADE,
    conflict_type VARCHAR(30) CHECK (conflict_type IN (
        'OVERLAP', 'DEPENDENCY', 'DATA_LOSS_RISK', 'DOWNTIME_CONFLICT'
    )),
    severity VARCHAR(10) CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
    resolution_status VARCHAR(20) DEFAULT 'UNRESOLVED' CHECK (resolution_status IN (
        'UNRESOLVED', 'ACKNOWLEDGED', 'BOOKING_MOVED', 'REFRESH_MOVED', 
        'OVERRIDE_APPROVED', 'DISMISSED'
    )),
    resolved_by_user_id UUID REFERENCES users(user_id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    booking_owner_notified BOOLEAN DEFAULT false,
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(refresh_intent_id, booking_id)
);

CREATE INDEX idx_conflicts_unresolved ON refresh_booking_conflicts(resolution_status) 
    WHERE resolution_status = 'UNRESOLVED';

-- Add refresh tracking columns to existing tables
ALTER TABLE environments 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE environment_instances 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE applications 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE interfaces 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE app_components 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE infra_components 
ADD COLUMN IF NOT EXISTS last_refresh_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

ALTER TABLE test_data_sets 
ADD COLUMN IF NOT EXISTS last_refresh_type VARCHAR(30),
ADD COLUMN IF NOT EXISTS last_refresh_source VARCHAR(255),
ADD COLUMN IF NOT EXISTS last_refresh_by UUID REFERENCES users(user_id);

-- Insert Sample Refresh History
INSERT INTO refresh_history (
    refresh_history_id, entity_type, entity_id, entity_name,
    refresh_date, refresh_type, source_environment_name, source_snapshot_name,
    requested_by_user_id, executed_by_user_id, executed_at,
    change_ticket_ref, execution_status, duration_minutes, notes
) VALUES
(
    'f1111111-1111-1111-1111-111111111111',
    'EnvironmentInstance', 'a1111111-1111-1111-1111-111111111111', 'SIT1',
    NOW() - INTERVAL '15 days', 'MASKED_COPY', 'PROD', 'PROD-SNAPSHOT-2025-11-24',
    'cccccccc-cccc-cccc-cccc-cccccccccccc', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '15 days',
    'CHG-123456', 'SUCCESS', 225, 'Masked PII columns as per data policy v4.'
),
(
    'f2222222-2222-2222-2222-222222222222',
    'EnvironmentInstance', 'a2222222-2222-2222-2222-222222222222', 'SIT2',
    NOW() - INTERVAL '10 days', 'FULL_COPY', 'PROD', 'PROD-SNAPSHOT-2025-11-29',
    'dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '10 days',
    'CHG-123789', 'SUCCESS', 180, 'Full environment refresh for release testing.'
);

-- Insert Sample Refresh Intents
INSERT INTO refresh_intents (
    refresh_intent_id, entity_type, entity_id, entity_name,
    intent_status, planned_date, planned_end_date, refresh_type,
    source_environment_name, requires_downtime, estimated_downtime_minutes,
    requested_by_user_id, requested_at, reason,
    change_ticket_ref, notification_groups, notification_lead_days,
    approved_by_user_id, approved_at, approval_notes
) VALUES
(
    'e1111111-1111-1111-1111-111111111111',
    'EnvironmentInstance', 'a1111111-1111-1111-1111-111111111111', 'SIT1',
    'APPROVED', NOW() + INTERVAL '7 days', NOW() + INTERVAL '7 days' + INTERVAL '4 hours', 'MASKED_COPY',
    'PROD', true, 240,
    'cccccccc-cccc-cccc-cccc-cccccccccccc', NOW() - INTERVAL '2 days', 
    'Align environment with Release 2025.1 regression baseline.',
    'CHG-125000', ARRAY['22222222-2222-2222-2222-222222222222'::UUID], ARRAY[7, 1],
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', NOW() - INTERVAL '1 day', 'Approved for weekend refresh.'
),
(
    'e2222222-2222-2222-2222-222222222222',
    'EnvironmentInstance', 'a3333333-3333-3333-3333-333333333333', 'UAT1',
    'REQUESTED', NOW() + INTERVAL '14 days', NOW() + INTERVAL '14 days' + INTERVAL '6 hours', 'FULL_COPY',
    'PROD', true, 360,
    'dddddddd-dddd-dddd-dddd-dddddddddddd', NOW() - INTERVAL '1 day',
    'Full refresh for UAT regression testing before production deployment.',
    'CHG-125100', ARRAY['22222222-2222-2222-2222-222222222222'::UUID], ARRAY[7, 1],
    NULL, NULL, NULL
);

-- Insert Sample Notification Settings
INSERT INTO refresh_notification_settings (
    scope_type, group_id, email_enabled, in_app_enabled,
    reminder_days, subscribed_events
) VALUES
(
    'Group', '22222222-2222-2222-2222-222222222222', true, true,
    ARRAY[7, 3, 1], ARRAY['REFRESH_APPROVED', 'REFRESH_SCHEDULED', 'REFRESH_REMINDER_1DAY', 
                          'REFRESH_STARTING', 'REFRESH_COMPLETED', 'REFRESH_FAILED']
);

-- Insert Sample Conflict
INSERT INTO refresh_booking_conflicts (
    conflict_id, refresh_intent_id, booking_id,
    conflict_type, severity, resolution_status
) VALUES
(
    'ab111111-1111-1111-1111-111111111111',
    'e2222222-2222-2222-2222-222222222222', 'f0222222-2222-2222-2222-222222222222',
    'OVERLAP', 'HIGH', 'UNRESOLVED'
);

-- Update environment instances with last refresh info
UPDATE environment_instances 
SET last_refresh_date = NOW() - INTERVAL '15 days',
    last_refresh_type = 'MASKED_COPY',
    last_refresh_source = 'PROD-SNAPSHOT-2025-11-24',
    last_refresh_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE env_instance_id = 'a1111111-1111-1111-1111-111111111111';

UPDATE environment_instances 
SET last_refresh_date = NOW() - INTERVAL '10 days',
    last_refresh_type = 'FULL_COPY',
    last_refresh_source = 'PROD-SNAPSHOT-2025-11-29',
    last_refresh_by = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
WHERE env_instance_id = 'a2222222-2222-2222-2222-222222222222';

-- =====================================================
-- v4.2: AUDIT & COMPLIANCE SYSTEM
-- =====================================================

-- Audit Events - Core table for full CRUD traceability
CREATE TABLE IF NOT EXISTS audit_events (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Actor information
    actor_user_id UUID REFERENCES users(user_id),
    actor_user_name VARCHAR(255),
    actor_role VARCHAR(50),
    
    -- Entity being audited
    entity_type VARCHAR(50) NOT NULL CHECK (entity_type IN (
        'Environment', 'EnvironmentInstance', 'Application', 'Interface', 
        'Component', 'Booking', 'RefreshIntent', 'RefreshExecution',
        'User', 'UserGroup', 'Role', 'Permission', 'Configuration', 
        'Integration', 'Release', 'Change', 'TestData', 'Report'
    )),
    entity_id UUID,
    entity_display_name VARCHAR(500),
    
    -- Action details
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN (
        'CREATE', 'UPDATE', 'DELETE', 'READ', 'LOGIN', 'LOGOUT',
        'PERMISSION_CHANGE', 'ROLE_CHANGE', 'STATUS_CHANGE',
        'REFRESH_EXECUTE', 'REFRESH_APPROVE', 'REFRESH_REJECT',
        'BOOKING_APPROVE', 'BOOKING_REJECT', 'BOOKING_CANCEL',
        'CONFLICT_RESOLVE', 'FORCE_APPROVE', 'EXPORT', 'IMPORT',
        'CONFIG_CHANGE', 'INTEGRATION_SYNC', 'REPORT_GENERATE'
    )),
    action_result VARCHAR(20) DEFAULT 'SUCCESS' CHECK (action_result IN (
        'SUCCESS', 'FAILED', 'UNAUTHORIZED', 'PARTIAL'
    )),
    
    -- Source information
    source_channel VARCHAR(30) NOT NULL DEFAULT 'WEB_UI' CHECK (source_channel IN (
        'WEB_UI', 'API', 'BATCH_JOB', 'INTEGRATION_SYSTEM', 'SCHEDULER', 'CLI'
    )),
    ip_address INET,
    user_agent TEXT,
    client_app VARCHAR(100),
    api_key_id UUID,
    
    -- State snapshots (JSONB for flexibility)
    before_snapshot JSONB,
    after_snapshot JSONB,
    changed_fields TEXT[],
    
    -- Compliance & correlation
    regulatory_tag VARCHAR(50) CHECK (regulatory_tag IN (
        'SOX_CHANGE', 'AU_APRA_CPS_230', 'GDPR', 'PCI_DSS', 'HIPAA', 
        'ISO_27001', 'SOC2', 'CUSTOM'
    )),
    correlation_id UUID,
    session_id UUID,
    
    -- Additional context
    comment TEXT,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    
    -- Indexing columns (for performance)
    event_date DATE GENERATED ALWAYS AS (DATE(timestamp_utc)) STORED
);

-- Audit Report Templates
CREATE TABLE IF NOT EXISTS audit_report_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) CHECK (category IN (
        'COMPLIANCE', 'SECURITY', 'OPERATIONS', 'INVESTIGATION', 'CUSTOM'
    )),
    
    -- Filter configuration
    entity_types TEXT[],
    action_types TEXT[],
    regulatory_tags TEXT[],
    include_sensitive BOOLEAN DEFAULT false,
    
    -- Query template
    filter_template JSONB NOT NULL,
    
    -- Output configuration
    output_columns TEXT[],
    sort_by VARCHAR(50) DEFAULT 'timestamp_utc',
    sort_order VARCHAR(4) DEFAULT 'DESC',
    
    -- Scheduling
    schedule_cron VARCHAR(100),
    schedule_enabled BOOLEAN DEFAULT false,
    email_recipients TEXT[],
    
    -- Metadata
    created_by_user_id UUID REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_system_template BOOLEAN DEFAULT false
);

-- Audit Report Executions
CREATE TABLE IF NOT EXISTS audit_report_executions (
    execution_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES audit_report_templates(template_id),
    
    -- Execution details
    executed_by_user_id UUID REFERENCES users(user_id),
    executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Filters used
    date_from TIMESTAMP WITH TIME ZONE,
    date_to TIMESTAMP WITH TIME ZONE,
    filters_applied JSONB,
    
    -- Results
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN (
        'PENDING', 'RUNNING', 'COMPLETED', 'FAILED'
    )),
    records_count INTEGER,
    file_format VARCHAR(10) CHECK (file_format IN ('PDF', 'CSV', 'XLSX', 'JSON')),
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    
    -- Completion
    completed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    
    -- Audit the audit (who generated what report)
    audit_event_id UUID REFERENCES audit_events(audit_id)
);

-- Saved Audit Filters (user-defined views)
CREATE TABLE IF NOT EXISTS audit_saved_filters (
    filter_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    user_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    is_shared BOOLEAN DEFAULT false,
    
    -- Filter configuration
    filters JSONB NOT NULL,
    
    -- UI preferences
    visible_columns TEXT[],
    sort_config JSONB,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE,
    use_count INTEGER DEFAULT 0
);

-- Performance indexes for audit_events
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_date ON audit_events(event_date DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_correlation ON audit_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_regulatory ON audit_events(regulatory_tag) WHERE regulatory_tag IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_result ON audit_events(action_result) WHERE action_result != 'SUCCESS';
CREATE INDEX IF NOT EXISTS idx_audit_source ON audit_events(source_channel);

-- Full-text search index for audit events
CREATE INDEX IF NOT EXISTS idx_audit_search ON audit_events 
    USING gin(to_tsvector('english', 
        COALESCE(entity_display_name, '') || ' ' || 
        COALESCE(actor_user_name, '') || ' ' ||
        COALESCE(comment, '')
    ));

-- Insert default report templates
INSERT INTO audit_report_templates (
    template_id, name, description, category,
    entity_types, action_types, regulatory_tags,
    filter_template, output_columns, is_system_template
) VALUES
(
    'a0000001-0000-0000-0000-000000000001',
    'Permission and Role Changes',
    'All permission and role changes in the selected period',
    'SECURITY',
    ARRAY['User', 'UserGroup', 'Role', 'Permission'],
    ARRAY['PERMISSION_CHANGE', 'ROLE_CHANGE', 'CREATE', 'UPDATE', 'DELETE'],
    NULL,
    '{"includeActorDetails": true, "includeBeforeAfter": true}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'action_type', 'entity_display_name', 'changed_fields'],
    true
),
(
    'a0000002-0000-0000-0000-000000000002',
    'Environment Configuration Changes',
    'All environment and instance configuration changes',
    'OPERATIONS',
    ARRAY['Environment', 'EnvironmentInstance', 'Configuration'],
    ARRAY['CREATE', 'UPDATE', 'DELETE', 'CONFIG_CHANGE'],
    NULL,
    '{"includeActorDetails": true, "includeBeforeAfter": true}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'entity_type', 'entity_display_name', 'action_type', 'changed_fields'],
    true
),
(
    'a0000003-0000-0000-0000-000000000003',
    'Data Refresh Executions and Overrides',
    'All data refresh executions including force approvals and conflict overrides',
    'COMPLIANCE',
    ARRAY['RefreshIntent', 'RefreshExecution'],
    ARRAY['REFRESH_EXECUTE', 'REFRESH_APPROVE', 'REFRESH_REJECT', 'FORCE_APPROVE', 'CONFLICT_RESOLVE'],
    NULL,
    '{"includeActorDetails": true, "includeBeforeAfter": true, "includeConflictDetails": true}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'action_type', 'entity_display_name', 'action_result', 'comment'],
    true
),
(
    'a0000004-0000-0000-0000-000000000004',
    'Failed and Unauthorized Access Attempts',
    'All failed or unauthorized access attempts for security review',
    'SECURITY',
    NULL,
    ARRAY['LOGIN', 'READ', 'UPDATE', 'DELETE'],
    NULL,
    '{"actionResult": ["FAILED", "UNAUTHORIZED"]}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'action_type', 'entity_display_name', 'action_result', 'ip_address', 'error_message'],
    true
),
(
    'a0000005-0000-0000-0000-000000000005',
    'SOX Compliance Report',
    'All changes tagged for SOX compliance review',
    'COMPLIANCE',
    NULL,
    NULL,
    ARRAY['SOX_CHANGE'],
    '{"includeActorDetails": true, "includeBeforeAfter": true, "includeApprovals": true}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'actor_role', 'entity_type', 'entity_display_name', 'action_type', 'regulatory_tag'],
    true
),
(
    'a0000006-0000-0000-0000-000000000006',
    'Booking Lifecycle Report',
    'Complete booking lifecycle including approvals, cancellations, and conflicts',
    'OPERATIONS',
    ARRAY['Booking'],
    ARRAY['CREATE', 'UPDATE', 'DELETE', 'BOOKING_APPROVE', 'BOOKING_REJECT', 'BOOKING_CANCEL', 'CONFLICT_RESOLVE'],
    NULL,
    '{"includeActorDetails": true, "includeBeforeAfter": true}'::jsonb,
    ARRAY['timestamp_utc', 'actor_user_name', 'entity_display_name', 'action_type', 'action_result'],
    true
)
ON CONFLICT (name) DO NOTHING;

-- Insert sample audit events for demonstration
INSERT INTO audit_events (
    audit_id, timestamp_utc, actor_user_id, actor_user_name, actor_role,
    entity_type, entity_id, entity_display_name, action_type, action_result,
    source_channel, changed_fields, comment
) VALUES
(
    'ae000001-0000-0000-0000-000000000001',
    NOW() - INTERVAL '2 hours',
    'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    'Admin User',
    'Admin',
    'Environment',
    'e1111111-1111-1111-1111-111111111111',
    'SIT Environment',
    'UPDATE',
    'SUCCESS',
    'WEB_UI',
    ARRAY['max_concurrent_bookings', 'availability_window'],
    'Updated booking limits for Q1 testing'
),
(
    'ae000002-0000-0000-0000-000000000002',
    NOW() - INTERVAL '1 hour',
    'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    'Environment Manager',
    'EnvironmentManager',
    'RefreshIntent',
    'e1111111-1111-1111-1111-111111111111',
    'SIT1 Refresh - Masked Copy',
    'REFRESH_APPROVE',
    'SUCCESS',
    'WEB_UI',
    NULL,
    'Approved for scheduled maintenance window'
),
(
    'ae000003-0000-0000-0000-000000000003',
    NOW() - INTERVAL '30 minutes',
    'cccccccc-cccc-cccc-cccc-cccccccccccc',
    'Project Lead',
    'ProjectLead',
    'Booking',
    'f0111111-1111-1111-1111-111111111111',
    'SIT1 Booking - Release 2.5 Testing',
    'CREATE',
    'SUCCESS',
    'WEB_UI',
    NULL,
    'Booking created for release testing'
);

-- =====================================================
-- v4.1: REFRESH-BOOKING DEPENDENCY ENHANCEMENTS
-- =====================================================

-- Add is_critical_booking flag to environment_bookings
ALTER TABLE environment_bookings 
ADD COLUMN IF NOT EXISTS is_critical_booking BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_priority VARCHAR(10) DEFAULT 'Normal' 
    CHECK (booking_priority IN ('Critical', 'High', 'Normal', 'Low'));

-- Add impact_type to refresh_intents  
ALTER TABLE refresh_intents
ADD COLUMN IF NOT EXISTS impact_type VARCHAR(30) DEFAULT 'DATA_OVERWRITE'
    CHECK (impact_type IN ('DATA_OVERWRITE', 'DOWNTIME_REQUIRED', 'READ_ONLY', 'CONFIG_CHANGE', 'SCHEMA_CHANGE')),
ADD COLUMN IF NOT EXISTS conflict_flag VARCHAR(10) DEFAULT 'NONE'
    CHECK (conflict_flag IN ('NONE', 'MINOR', 'MAJOR')),
ADD COLUMN IF NOT EXISTS conflict_summary JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS impacted_teams UUID[],
ADD COLUMN IF NOT EXISTS force_approved BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS force_approval_justification TEXT,
ADD COLUMN IF NOT EXISTS force_approved_by_user_id UUID REFERENCES users(user_id),
ADD COLUMN IF NOT EXISTS force_approved_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for conflict detection queries
CREATE INDEX IF NOT EXISTS idx_bookings_conflict_check 
ON environment_bookings(start_datetime, end_datetime, booking_status)
WHERE booking_status IN ('Approved', 'Active', 'PendingApproval');

CREATE INDEX IF NOT EXISTS idx_refresh_conflict_check 
ON refresh_intents(planned_date, planned_end_date, intent_status)
WHERE intent_status IN ('APPROVED', 'SCHEDULED', 'IN_PROGRESS');

-- Add booking owner notification tracking to conflicts table
ALTER TABLE refresh_booking_conflicts
ADD COLUMN IF NOT EXISTS auto_detected BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS conflict_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS overlap_start TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS overlap_end TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS overlap_minutes INTEGER,
ADD COLUMN IF NOT EXISTS booking_is_critical BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS booking_priority VARCHAR(10);

-- Update sample booking to be critical
UPDATE environment_bookings 
SET is_critical_booking = true, booking_priority = 'Critical'
WHERE booking_id = 'f0111111-1111-1111-1111-111111111111';

UPDATE environment_bookings 
SET is_critical_booking = false, booking_priority = 'Normal'
WHERE booking_id = 'f0222222-2222-2222-2222-222222222222';

-- Update sample refresh intent with impact type
UPDATE refresh_intents
SET impact_type = 'DATA_OVERWRITE',
    conflict_flag = 'MAJOR',
    conflict_summary = '{"totalConflicts": 1, "majorConflicts": 1, "minorConflicts": 0, "affectedBookings": ["f0222222-2222-2222-2222-222222222222"]}'::jsonb
WHERE refresh_intent_id = 'e2222222-2222-2222-2222-222222222222';

-- =====================================================
-- AUDIT & COMPLIANCE TABLES
-- =====================================================

-- Audit Events - Full CRUD traceability
CREATE TABLE IF NOT EXISTS audit_events (
    audit_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp_utc TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    actor_user_id UUID REFERENCES users(user_id),
    actor_username VARCHAR(100),
    actor_display_name VARCHAR(255),
    actor_role VARCHAR(30),
    actor_ip_address VARCHAR(45),
    actor_user_agent TEXT,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    entity_name VARCHAR(255),
    action_type VARCHAR(20) NOT NULL CHECK (action_type IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'EXPORT', 'IMPORT', 'APPROVE', 'REJECT', 'EXECUTE')),
    action_description TEXT,
    before_snapshot JSONB,
    after_snapshot JSONB,
    changed_fields JSONB,
    parent_entity_type VARCHAR(50),
    parent_entity_id VARCHAR(255),
    session_id VARCHAR(255),
    request_id VARCHAR(255),
    source_system VARCHAR(50) DEFAULT 'BookMyEnv',
    regulatory_tag VARCHAR(50),
    data_classification VARCHAR(20) CHECK (data_classification IN ('Public', 'Internal', 'Confidential', 'Restricted')),
    retention_days INTEGER DEFAULT 2555,
    is_sensitive BOOLEAN DEFAULT false,
    additional_context JSONB
);

-- Indexes for audit_events
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action_type);
CREATE INDEX IF NOT EXISTS idx_audit_regulatory ON audit_events(regulatory_tag) WHERE regulatory_tag IS NOT NULL;

-- Audit Report Templates
CREATE TABLE IF NOT EXISTS audit_report_templates (
    template_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    report_type VARCHAR(50) NOT NULL,
    filters JSONB,
    columns JSONB,
    grouping JSONB,
    created_by UUID REFERENCES users(user_id),
    is_system_template BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Generated Audit Reports
CREATE TABLE IF NOT EXISTS audit_generated_reports (
    report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES audit_report_templates(template_id),
    report_name VARCHAR(255) NOT NULL,
    generated_by UUID REFERENCES users(user_id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    date_range_start TIMESTAMP WITH TIME ZONE,
    date_range_end TIMESTAMP WITH TIME ZONE,
    filters_applied JSONB,
    total_records INTEGER,
    file_path VARCHAR(500),
    file_format VARCHAR(10) CHECK (file_format IN ('CSV', 'PDF', 'JSON', 'XLSX')),
    status VARCHAR(20) DEFAULT 'COMPLETED' CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'))
);

-- Insert default audit report templates
INSERT INTO audit_report_templates (template_id, name, description, report_type, filters, columns, is_system_template) VALUES
('a0000001-0001-0001-0001-000000000001', 'All Activity Report', 'Complete audit trail of all system activities', 'COMPREHENSIVE', '{}', '["timestamp_utc", "actor_username", "entity_type", "action_type", "action_description"]', true),
('a0000001-0001-0001-0001-000000000002', 'User Activity Report', 'All activities performed by a specific user', 'USER_ACTIVITY', '{"groupBy": "actor_user_id"}', '["timestamp_utc", "entity_type", "action_type", "entity_name", "action_description"]', true),
('a0000001-0001-0001-0001-000000000003', 'Environment Changes', 'All changes to environment configurations', 'ENTITY_CHANGES', '{"entity_type": "Environment"}', '["timestamp_utc", "actor_username", "action_type", "entity_name", "changed_fields"]', true),
('a0000001-0001-0001-0001-000000000004', 'Booking Audit Trail', 'Complete history of booking operations', 'ENTITY_CHANGES', '{"entity_type": "Booking"}', '["timestamp_utc", "actor_username", "action_type", "entity_name", "before_snapshot", "after_snapshot"]', true),
('a0000001-0001-0001-0001-000000000005', 'Security Events', 'Login/logout and access-related events', 'SECURITY', '{"action_type": ["LOGIN", "LOGOUT"]}', '["timestamp_utc", "actor_username", "actor_ip_address", "action_type", "action_description"]', true),
('a0000001-0001-0001-0001-000000000006', 'Compliance Report', 'Regulatory compliance audit report', 'COMPLIANCE', '{"regulatory_tag": "NOT NULL"}', '["timestamp_utc", "actor_username", "entity_type", "action_type", "regulatory_tag", "data_classification"]', true)
ON CONFLICT DO NOTHING;

COMMIT;
