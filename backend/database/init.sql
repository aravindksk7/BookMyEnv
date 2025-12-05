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
    tool_type VARCHAR(20) NOT NULL CHECK (tool_type IN ('Jira', 'GitLab', 'ServiceNow', 'Other')),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    base_url VARCHAR(500) NOT NULL,
    api_version VARCHAR(20),
    scope_type VARCHAR(20) NOT NULL DEFAULT 'Global' CHECK (scope_type IN ('Global', 'Project', 'Group')),
    scope_ref VARCHAR(100),
    auth_method VARCHAR(20) CHECK (auth_method IN ('PAT', 'OAuth2Client', 'Basic', 'APIKey', 'Other')),
    credentials_encrypted TEXT,
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

COMMIT;
