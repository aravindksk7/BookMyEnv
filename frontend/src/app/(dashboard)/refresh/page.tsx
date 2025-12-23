'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { refreshAPI, environmentsAPI, applicationsAPI, interfacesAPI } from '@/lib/api';
import dynamic from 'next/dynamic';

// Dynamically import RefreshCalendar to avoid SSR issues with Temporal
const RefreshCalendar = dynamic(() => import('@/components/RefreshCalendar'), {
  ssr: false,
  loading: () => (
    <div className="h-[600px] flex items-center justify-center bg-white dark:bg-gray-800 rounded-lg shadow">
      Loading calendar...
    </div>
  ),
});

// Types
interface RefreshIntent {
  refresh_intent_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  intent_status: string;
  planned_date: string;
  planned_end_date?: string;
  refresh_type: string;
  requires_downtime: boolean;
  estimated_downtime_minutes?: number;
  reason?: string;
  business_justification?: string;
  source_environment_name?: string;
  requested_by_username?: string;
  unresolved_conflicts?: number;
}

interface RefreshHistoryItem {
  refresh_history_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  refresh_date: string;
  refresh_type: string;
  execution_status?: string;
}

// CalendarDay interface removed - using Schedule-X calendar

interface EntityOption {
  id: string;
  name: string;
  type: string;
}

interface IntentFormData {
  entityType: string;
  entityId: string;
  entityName: string;
  plannedDate: string;
  plannedEndDate: string;
  refreshType: string;
  sourceEnvironmentName: string;
  impactType: string;
  requiresDowntime: boolean;
  estimatedDowntimeMinutes: number;
  reason: string;
  businessJustification: string;
}

// Conflict types for UI
interface BookingConflict {
  bookingId: string;
  title: string;
  startDatetime: string;
  endDatetime: string;
  bookingStatus: string;
  testPhase?: string;
  isCritical: boolean;
  priority?: string;
  bookedByName?: string;
  bookedByEmail?: string;
  owningGroupName?: string;
  overlapStart: string;
  overlapEnd: string;
  overlapMinutes: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  conflictType: string;
}

interface ConflictCheckResult {
  hasConflicts: boolean;
  conflictFlag: 'NONE' | 'MINOR' | 'MAJOR';
  conflicts: BookingConflict[];
  requiresForceApproval: boolean;
  canProceedWithoutOverride: boolean;
}

// Calendar status colors are now handled by RefreshCalendar component

const ENTITY_ICONS: Record<string, string> = {
  Environment: '🌐',
  EnvironmentInstance: '📦',
  Application: '📱',
  AppComponent: '🧩',
  Interface: '🔗',
  InfraComponent: '🖥️',
  TestDataSet: '📊',
};

const REFRESH_TYPES = [
  { value: 'FULL_COPY', label: 'Full Copy' },
  { value: 'PARTIAL_COPY', label: 'Partial Copy' },
  { value: 'DATA_ONLY', label: 'Data Only' },
  { value: 'CONFIG_ONLY', label: 'Config Only' },
  { value: 'MASKED_COPY', label: 'Masked Copy' },
  { value: 'SCHEMA_SYNC', label: 'Schema Sync' },
  { value: 'GOLDEN_COPY', label: 'Golden Copy' },
  { value: 'POINT_IN_TIME', label: 'Point-in-Time' },
  { value: 'OTHER', label: 'Other' },
];

const ENTITY_TYPES = [
  { value: 'Environment', label: 'Environment' },
  { value: 'EnvironmentInstance', label: 'Environment Instance' },
  { value: 'Application', label: 'Application' },
  { value: 'AppComponent', label: 'App Component' },
  { value: 'Interface', label: 'Interface' },
  { value: 'InfraComponent', label: 'Infra Component' },
  { value: 'TestDataSet', label: 'Test Data Set' },
];

const DEFAULT_FORM_DATA: IntentFormData = {
  entityType: '',
  entityId: '',
  entityName: '',
  plannedDate: '',
  plannedEndDate: '',
  refreshType: 'FULL_COPY',
  sourceEnvironmentName: '',
  impactType: 'DATA_OVERWRITE',
  requiresDowntime: false,
  estimatedDowntimeMinutes: 0,
  reason: '',
  businessJustification: '',
};

export default function RefreshCalendarPage() {
  const [intents, setIntents] = useState<RefreshIntent[]>([]);
  const [history, setHistory] = useState<RefreshHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RefreshIntent | RefreshHistoryItem | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');
  
  // Intent form state
  const [showIntentModal, setShowIntentModal] = useState(false);
  const [editingIntent, setEditingIntent] = useState<RefreshIntent | null>(null);
  const [formData, setFormData] = useState<IntentFormData>(DEFAULT_FORM_DATA);
  const [entityOptions, setEntityOptions] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  
  // Conflict detection state
  const [conflictResult, setConflictResult] = useState<ConflictCheckResult | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [acknowledgeConflicts, setAcknowledgeConflicts] = useState(false);

  // Load entities based on selected type
  const loadEntities = async (entityType: string) => {
    if (!entityType) {
      setEntityOptions([]);
      return;
    }
    
    setLoadingEntities(true);
    try {
      let options: EntityOption[] = [];
      
      switch (entityType) {
        case 'Environment':
          const envRes = await environmentsAPI.getAll();
          options = (envRes.data.environments || []).map((e: any) => ({
            id: e.environment_id,
            name: e.name,
            type: 'Environment'
          }));
          break;
        case 'EnvironmentInstance':
          const instRes = await environmentsAPI.getAllInstances();
          options = (instRes.data.instances || []).map((e: any) => ({
            id: e.env_instance_id,
            name: `${e.name} (${e.environment_name || 'Unknown Env'})`,
            type: 'EnvironmentInstance'
          }));
          break;
        case 'Application':
          const appRes = await applicationsAPI.getAll();
          options = (appRes.data.applications || []).map((e: any) => ({
            id: e.application_id,
            name: e.name,
            type: 'Application'
          }));
          break;
        case 'Interface':
          const intfRes = await interfacesAPI.getAll();
          options = (intfRes.data.interfaces || []).map((e: any) => ({
            id: e.interface_id,
            name: e.name,
            type: 'Interface'
          }));
          break;
        default:
          options = [];
      }
      
      setEntityOptions(options);
    } catch (err) {
      console.error('Failed to load entities:', err);
      setEntityOptions([]);
    } finally {
      setLoadingEntities(false);
    }
  };

  // Handle entity type change
  const handleEntityTypeChange = (type: string) => {
    setFormData(prev => ({ ...prev, entityType: type, entityId: '', entityName: '' }));
    loadEntities(type);
  };

  // Handle entity selection
  const handleEntitySelect = (entityId: string) => {
    const entity = entityOptions.find(e => e.id === entityId);
    setFormData(prev => ({
      ...prev,
      entityId,
      entityName: entity?.name || ''
    }));
    // Reset conflicts when entity changes
    setConflictResult(null);
    setAcknowledgeConflicts(false);
  };

  // Check for booking conflicts
  const checkConflicts = async () => {
    if (!formData.entityId || !formData.plannedDate) return;
    
    setCheckingConflicts(true);
    try {
      const res = await refreshAPI.checkConflictsPreview({
        entityType: formData.entityType,
        entityId: formData.entityId,
        plannedDate: new Date(formData.plannedDate).toISOString(),
        plannedEndDate: formData.plannedEndDate ? new Date(formData.plannedEndDate).toISOString() : undefined,
        impactType: formData.impactType as 'DATA_OVERWRITE' | 'DOWNTIME_REQUIRED' | 'READ_ONLY' | 'CONFIG_CHANGE' | 'SCHEMA_CHANGE',
        estimatedDowntimeMinutes: formData.estimatedDowntimeMinutes || 60,
      });
      setConflictResult(res.data);
    } catch (err) {
      console.error('Failed to check conflicts:', err);
    } finally {
      setCheckingConflicts(false);
    }
  };

  // Auto-check conflicts when form changes
  useEffect(() => {
    if (showIntentModal && formData.entityId && formData.plannedDate) {
      const timer = setTimeout(() => {
        checkConflicts();
      }, 500); // Debounce
      return () => clearTimeout(timer);
    }
  }, [formData.entityId, formData.plannedDate, formData.plannedEndDate, formData.impactType, showIntentModal]);

  // Open modal for new intent
  const openNewIntentModal = (date?: Date) => {
    const defaultDate = date || new Date();
    defaultDate.setHours(10, 0, 0, 0);
    
    setFormData({
      ...DEFAULT_FORM_DATA,
      plannedDate: defaultDate.toISOString().slice(0, 16),
    });
    setEditingIntent(null);
    setEntityOptions([]);
    setFormError(null);
    setConflictResult(null);
    setAcknowledgeConflicts(false);
    setShowIntentModal(true);
  };

  // Open modal for editing intent
  const openEditIntentModal = (intent: RefreshIntent) => {
    setFormData({
      entityType: intent.entity_type,
      entityId: intent.entity_id,
      entityName: intent.entity_name || '',
      plannedDate: new Date(intent.planned_date).toISOString().slice(0, 16),
      plannedEndDate: intent.planned_end_date ? new Date(intent.planned_end_date).toISOString().slice(0, 16) : '',
      refreshType: intent.refresh_type,
      sourceEnvironmentName: intent.source_environment_name || '',
      impactType: (intent as any).impact_type || 'DATA_OVERWRITE',
      requiresDowntime: intent.requires_downtime || false,
      estimatedDowntimeMinutes: intent.estimated_downtime_minutes || 0,
      reason: intent.reason || '',
      businessJustification: intent.business_justification || '',
    });
    setEditingIntent(intent);
    loadEntities(intent.entity_type);
    setFormError(null);
    setConflictResult(null);
    setAcknowledgeConflicts(false);
    setShowIntentModal(true);
  };

  // Save intent
  const handleSaveIntent = async () => {
    // Validation
    if (!formData.entityType) {
      setFormError('Please select an entity type');
      return;
    }
    if (!formData.entityId) {
      setFormError('Please select an entity');
      return;
    }
    if (!formData.plannedDate) {
      setFormError('Please select a planned date');
      return;
    }
    if (!formData.reason.trim()) {
      setFormError('Please provide a reason for the refresh');
      return;
    }
    
    // Check if MAJOR conflicts require acknowledgement
    if (conflictResult?.conflictFlag === 'MAJOR' && !acknowledgeConflicts) {
      setFormError('Please acknowledge the booking conflicts before proceeding');
      return;
    }

    setSaving(true);
    setFormError(null);

    try {
      if (editingIntent) {
        // Update existing intent
        await refreshAPI.updateIntent(editingIntent.refresh_intent_id, {
          plannedDate: new Date(formData.plannedDate).toISOString(),
          plannedEndDate: formData.plannedEndDate ? new Date(formData.plannedEndDate).toISOString() : undefined,
          refreshType: formData.refreshType,
          sourceEnvironmentName: formData.sourceEnvironmentName || undefined,
          requiresDowntime: formData.requiresDowntime,
          estimatedDowntimeMinutes: formData.estimatedDowntimeMinutes || undefined,
          reason: formData.reason,
          businessJustification: formData.businessJustification || undefined,
          impactType: formData.impactType as 'DATA_OVERWRITE' | 'DOWNTIME_REQUIRED' | 'READ_ONLY' | 'CONFIG_CHANGE' | 'SCHEMA_CHANGE' | undefined,
        });
      } else {
        // Create new intent
        await refreshAPI.createIntent({
          entityType: formData.entityType,
          entityId: formData.entityId,
          entityName: formData.entityName,
          plannedDate: new Date(formData.plannedDate).toISOString(),
          plannedEndDate: formData.plannedEndDate ? new Date(formData.plannedEndDate).toISOString() : undefined,
          refreshType: formData.refreshType,
          sourceEnvironmentName: formData.sourceEnvironmentName || undefined,
          requiresDowntime: formData.requiresDowntime,
          estimatedDowntimeMinutes: formData.estimatedDowntimeMinutes || undefined,
          reason: formData.reason,
          businessJustification: formData.businessJustification || undefined,
          requiresApproval: true,
          impactType: formData.impactType as 'DATA_OVERWRITE' | 'DOWNTIME_REQUIRED' | 'READ_ONLY' | 'CONFIG_CHANGE' | 'SCHEMA_CHANGE' | undefined,
          conflictAcknowledged: acknowledgeConflicts,
          conflictSummary: conflictResult ? {
            hasConflicts: conflictResult.hasConflicts,
            conflictFlag: conflictResult.conflictFlag,
            conflictCount: conflictResult.conflicts.length,
          } : undefined,
        });
      }

      setShowIntentModal(false);
      setSelectedEvent(null);
      loadData();
    } catch (err: any) {
      console.error('Failed to save intent:', err);
      setFormError(err.response?.data?.error || 'Failed to save refresh intent');
    } finally {
      setSaving(false);
    }
  };

  // Load calendar data - fetch 3 months of data for Schedule-X navigation
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Fetch 3 months: 1 month before and 1 month after current
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - 1);
      startDate.setDate(1);
      
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 2);
      endDate.setDate(0);
      
      const res = await refreshAPI.getCalendar(
        startDate.toISOString(),
        endDate.toISOString(),
        entityTypeFilter || undefined
      );
      setIntents(res.data.intents || []);
      setHistory(res.data.history || []);
    } catch (err: any) {
      console.error('Failed to load calendar data:', err);
      setError(err.response?.data?.error || 'Failed to load calendar data');
    } finally {
      setLoading(false);
    }
  }, [entityTypeFilter]);

  // Reload data when filter changes
  useEffect(() => {
    loadData();
  }, [entityTypeFilter, loadData]);

  // Handle event click from calendar
  const handleEventClick = (event: RefreshIntent | RefreshHistoryItem) => {
    setSelectedEvent(event);
  };

  // Handle date click to open new intent modal
  const handleDateClick = (date: string) => {
    setFormData({
      ...DEFAULT_FORM_DATA,
      plannedDate: date,
    });
    setEditingIntent(null);
    setShowIntentModal(true);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Refresh Calendar</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">View and manage scheduled refreshes across all environments and applications</p>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Filter */}
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by:</label>
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-1.5 text-sm"
            >
              <option value="">All Entity Types</option>
              <option value="Environment">Environments</option>
              <option value="EnvironmentInstance">Instances</option>
              <option value="Application">Applications</option>
              <option value="AppComponent">App Components</option>
              <option value="Interface">Interfaces</option>
              <option value="InfraComponent">Infra Components</option>
              <option value="TestDataSet">Test Data Sets</option>
            </select>
          </div>

          {/* Actions */}
          <button
            onClick={() => openNewIntentModal()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Schedule Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-4 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700 dark:hover:text-red-300">×</button>
        </div>
      )}

      {/* Schedule-X Calendar */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="h-[600px] flex items-center justify-center text-gray-500 dark:text-gray-400">
            Loading calendar data...
          </div>
        ) : (
          <RefreshCalendar
            intents={intents}
            history={history}
            onEventClick={handleEventClick}
            onDateClick={handleDateClick}
          />
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-yellow-500"></span>
          <span>Requested</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-green-500"></span>
          <span>Approved</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-500"></span>
          <span>Scheduled</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-purple-500"></span>
          <span>In Progress</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-gray-500"></span>
          <span>Completed (History)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          <span>Failed / Conflict</span>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-lg w-full m-4">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {'intent_status' in selectedEvent ? 'Scheduled Refresh' : 'Completed Refresh'}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {ENTITY_ICONS[selectedEvent.entity_type]} {selectedEvent.entity_type}: {selectedEvent.entity_name || selectedEvent.entity_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              {'intent_status' in selectedEvent ? (
                /* Intent details */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
                      <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                        selectedEvent.intent_status === 'APPROVED' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        selectedEvent.intent_status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        selectedEvent.intent_status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {selectedEvent.intent_status}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedEvent.refresh_type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Planned Date</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{new Date(selectedEvent.planned_date).toLocaleString()}</p>
                  </div>
                  
                  {selectedEvent.requires_downtime && (
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/30 rounded border border-orange-200 dark:border-orange-800">
                      <p className="text-sm text-orange-800 dark:text-orange-400">
                        ⚠️ Requires downtime
                      </p>
                    </div>
                  )}
                  
                  {selectedEvent.unresolved_conflicts && selectedEvent.unresolved_conflicts > 0 && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/30 rounded border border-red-200 dark:border-red-800">
                      <p className="text-sm text-red-800 dark:text-red-400">
                        ⚠️ {selectedEvent.unresolved_conflicts} unresolved booking conflict(s)
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Requested By</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{selectedEvent.requested_by_username || 'Unknown'}</p>
                  </div>
                </>
              ) : (
                /* History details */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Status</label>
                      <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                        selectedEvent.execution_status === 'SUCCESS' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                        selectedEvent.execution_status === 'FAILED' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {selectedEvent.execution_status || 'SUCCESS'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 dark:text-gray-400">Type</label>
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedEvent.refresh_type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400">Refresh Date</label>
                    <p className="text-sm text-gray-900 dark:text-gray-100">{new Date(selectedEvent.refresh_date).toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              {'intent_status' in selectedEvent && ['DRAFT', 'REQUESTED'].includes(selectedEvent.intent_status) && (
                <button
                  onClick={() => {
                    openEditIntentModal(selectedEvent as RefreshIntent);
                    setSelectedEvent(null);
                  }}
                  className="px-4 py-2 bg-yellow-500 text-white text-sm font-medium rounded-md hover:bg-yellow-600"
                >
                  Edit
                </button>
              )}
              {'intent_status' in selectedEvent && (
                <a
                  href={`/refresh/approvals`}
                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
                >
                  View Details
                </a>
              )}
              <button
                onClick={() => setSelectedEvent(null)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Intent Form Modal */}
      {showIntentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                {editingIntent ? 'Edit Refresh Intent' : 'Schedule New Refresh'}
              </h3>
              <button
                onClick={() => setShowIntentModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 p-3 rounded-md text-sm">
                  {formError}
                </div>
              )}

              {/* Entity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Entity Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entityType}
                  onChange={(e) => handleEntityTypeChange(e.target.value)}
                  disabled={!!editingIntent}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-600"
                >
                  <option value="">Select entity type...</option>
                  {ENTITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Entity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Entity <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entityId}
                  onChange={(e) => handleEntitySelect(e.target.value)}
                  disabled={!formData.entityType || loadingEntities || !!editingIntent}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm disabled:bg-gray-100 dark:disabled:bg-gray-600"
                >
                  <option value="">
                    {loadingEntities ? 'Loading...' : formData.entityType ? 'Select entity...' : 'Select entity type first'}
                  </option>
                  {entityOptions.map(entity => (
                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                  ))}
                </select>
              </div>

              {/* Planned Date/Time */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Planned Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.plannedDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, plannedDate: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Planned End
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.plannedEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Refresh Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Refresh Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.refreshType}
                  onChange={(e) => setFormData(prev => ({ ...prev, refreshType: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  {REFRESH_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Source Environment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Source Environment
                </label>
                <input
                  type="text"
                  value={formData.sourceEnvironmentName}
                  onChange={(e) => setFormData(prev => ({ ...prev, sourceEnvironmentName: e.target.value }))}
                  placeholder="e.g., Production, UAT-Gold"
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Impact Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Impact Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.impactType}
                  onChange={(e) => setFormData(prev => ({ ...prev, impactType: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm"
                >
                  <option value="DATA_OVERWRITE">Data Overwrite (Destructive)</option>
                  <option value="DOWNTIME_REQUIRED">Downtime Required</option>
                  <option value="SCHEMA_CHANGE">Schema Change</option>
                  <option value="CONFIG_CHANGE">Config Change Only</option>
                  <option value="READ_ONLY">Read-Only (Non-destructive)</option>
                </select>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {formData.impactType === 'DATA_OVERWRITE' && '⚠️ This will overwrite existing data in the target environment'}
                  {formData.impactType === 'DOWNTIME_REQUIRED' && '⚠️ Environment will be unavailable during refresh'}
                  {formData.impactType === 'SCHEMA_CHANGE' && '⚠️ Database schema will be modified'}
                  {formData.impactType === 'CONFIG_CHANGE' && 'ℹ️ Only configuration changes, data remains intact'}
                  {formData.impactType === 'READ_ONLY' && '✅ Safe - No data changes will occur'}
                </p>
              </div>

              {/* Booking Conflict Check Panel */}
              {formData.entityId && formData.plannedDate && (
                <div className={`p-4 rounded-lg border ${
                  conflictResult?.conflictFlag === 'MAJOR' ? 'bg-red-50 dark:bg-red-900/30 border-red-300 dark:border-red-700' :
                  conflictResult?.conflictFlag === 'MINOR' ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700' :
                  conflictResult?.hasConflicts === false ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' :
                  'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                      {checkingConflicts ? (
                        <>⏳ Checking for booking conflicts...</>
                      ) : conflictResult?.conflictFlag === 'MAJOR' ? (
                        <>⚠️ MAJOR Conflicts Detected</>
                      ) : conflictResult?.conflictFlag === 'MINOR' ? (
                        <>⚡ Minor Conflicts Detected</>
                      ) : conflictResult?.hasConflicts === false ? (
                        <>✅ No Booking Conflicts</>
                      ) : (
                        <>🔍 Conflict Check</>
                      )}
                    </h4>
                    <button
                      onClick={checkConflicts}
                      disabled={checkingConflicts}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                    >
                      Recheck
                    </button>
                  </div>

                  {conflictResult?.hasConflicts && (
                    <>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        Found {conflictResult.conflicts.length} conflicting booking(s). 
                        {conflictResult.conflictFlag === 'MAJOR' && (
                          <span className="text-red-600 dark:text-red-400 font-medium"> This refresh will require force approval.</span>
                        )}
                      </p>
                      
                      {/* Conflict List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {conflictResult.conflicts.map((conflict, idx) => (
                          <div 
                            key={conflict.bookingId || idx}
                            className={`p-3 rounded-md text-sm ${
                              conflict.severity === 'HIGH' ? 'bg-red-100 dark:bg-red-900/50' :
                              conflict.severity === 'MEDIUM' ? 'bg-yellow-100 dark:bg-yellow-900/50' : 'bg-gray-100 dark:bg-gray-600'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                  conflict.severity === 'HIGH' ? 'bg-red-200 dark:bg-red-800 text-red-800 dark:text-red-200' :
                                  conflict.severity === 'MEDIUM' ? 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200' : 'bg-gray-200 dark:bg-gray-500 text-gray-800 dark:text-gray-200'
                                }`}>
                                  {conflict.severity}
                                </span>
                                <span className="font-medium text-gray-900 dark:text-gray-100">{conflict.title || 'Booking'}</span>
                                {conflict.isCritical && (
                                  <span className="ml-2 text-xs text-red-600 dark:text-red-400 font-medium">CRITICAL</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 text-gray-600 dark:text-gray-400">
                              <p>📅 {new Date(conflict.startDatetime).toLocaleString()} - {new Date(conflict.endDatetime).toLocaleString()}</p>
                              <p>⏱️ Overlap: {conflict.overlapMinutes} minutes</p>
                              {conflict.bookedByName && <p>👤 Booked by: {conflict.bookedByName}</p>}
                              {conflict.testPhase && <p>🧪 Phase: {conflict.testPhase}</p>}
                              {conflict.owningGroupName && <p>👥 Team: {conflict.owningGroupName}</p>}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Acknowledgement for MAJOR conflicts */}
                      {conflictResult.conflictFlag === 'MAJOR' && (
                        <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-700">
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={acknowledgeConflicts}
                              onChange={(e) => setAcknowledgeConflicts(e.target.checked)}
                              className="rounded border-red-300 dark:border-red-600 mt-0.5"
                            />
                            <span className="text-sm text-red-800 dark:text-red-400">
                              I understand this refresh will impact active bookings and will notify affected teams. 
                              This requires force approval from an Admin/Environment Manager.
                            </span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* Downtime */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.requiresDowntime}
                    onChange={(e) => setFormData(prev => ({ ...prev, requiresDowntime: e.target.checked }))}
                    className="rounded border-gray-300 dark:border-gray-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Requires Downtime</span>
                </label>
                {formData.requiresDowntime && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.estimatedDowntimeMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedDowntimeMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-20 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-2 py-1 text-sm"
                      min="0"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">minutes</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why is this refresh needed?"
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>

              {/* Business Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Business Justification
                </label>
                <textarea
                  value={formData.businessJustification}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessJustification: e.target.value }))}
                  placeholder="Business impact and justification for approval"
                  rows={2}
                  className="w-full border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-md px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-gray-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => setShowIntentModal(false)}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-md hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveIntent}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingIntent ? 'Update Intent' : 'Schedule Refresh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
