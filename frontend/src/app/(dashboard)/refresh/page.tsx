'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { refreshAPI, environmentsAPI, applicationsAPI, interfacesAPI } from '@/lib/api';

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

interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  intents: RefreshIntent[];
  history: RefreshHistoryItem[];
}

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

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-400',
  REQUESTED: 'bg-yellow-500',
  APPROVED: 'bg-green-500',
  SCHEDULED: 'bg-blue-500',
  IN_PROGRESS: 'bg-purple-500',
  COMPLETED: 'bg-green-600',
  FAILED: 'bg-red-500',
  SUCCESS: 'bg-green-600',
};

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
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
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
          impactType: formData.impactType,
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
          impactType: formData.impactType,
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

  // Calculate date range based on view mode
  const getDateRange = useCallback(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    if (viewMode === 'month') {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      // Include days from previous/next month to fill calendar grid
      const startDate = new Date(firstDay);
      startDate.setDate(startDate.getDate() - startDate.getDay());
      const endDate = new Date(lastDay);
      endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
      return { startDate, endDate };
    } else {
      const dayOfWeek = currentDate.getDay();
      const startDate = new Date(currentDate);
      startDate.setDate(startDate.getDate() - dayOfWeek);
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      return { startDate, endDate };
    }
  }, [currentDate, viewMode]);

  // Load calendar data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { startDate, endDate } = getDateRange();
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
  }, [getDateRange, entityTypeFilter]);

  // Reload data when date range or filter changes
  useEffect(() => {
    loadData();
  }, [currentDate, viewMode, entityTypeFilter]);

  // Generate calendar days
  const generateCalendarDays = (): CalendarDay[] => {
    const { startDate, endDate } = getDateRange();
    const days: CalendarDay[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const current = new Date(startDate);
    while (current <= endDate) {
      const date = new Date(current);
      const dateStr = date.toISOString().split('T')[0];
      
      // Find intents and history for this day
      const dayIntents = intents.filter(intent => {
        const intentDate = new Date(intent.planned_date).toISOString().split('T')[0];
        return intentDate === dateStr;
      });
      
      const dayHistory = history.filter(item => {
        const historyDate = new Date(item.refresh_date).toISOString().split('T')[0];
        return historyDate === dateStr;
      });
      
      days.push({
        date,
        isCurrentMonth: date.getMonth() === currentDate.getMonth(),
        isToday: date.getTime() === today.getTime(),
        intents: dayIntents,
        history: dayHistory,
      });
      
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  // Navigate months/weeks
  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + direction);
    } else {
      newDate.setDate(newDate.getDate() + (direction * 7));
    }
    setCurrentDate(newDate);
  };

  // Go to today
  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Format date for header
  const formatHeaderDate = () => {
    if (viewMode === 'month') {
      return currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else {
      const { startDate, endDate } = getDateRange();
      return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    }
  };

  const calendarDays = generateCalendarDays();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Refresh Calendar</h1>
        <p className="text-gray-500 mt-1">View and manage scheduled refreshes across all environments and applications</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow mb-6 p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Navigation */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={goToToday}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Today
            </button>
            <button
              onClick={() => navigate(1)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold text-gray-900 ml-4">
              {formatHeaderDate()}
            </h2>
          </div>

          {/* View Mode & Filters */}
          <div className="flex items-center gap-4">
            <select
              value={entityTypeFilter}
              onChange={(e) => setEntityTypeFilter(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-1.5 text-sm"
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
            
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1 text-sm font-medium rounded ${viewMode === 'month' ? 'bg-white shadow' : ''}`}
              >
                Month
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1 text-sm font-medium rounded ${viewMode === 'week' ? 'bg-white shadow' : ''}`}
              >
                Week
              </button>
            </div>
            
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
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Calendar Grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Week day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b">
          {weekDays.map((day) => (
            <div key={day} className="p-3 text-center text-sm font-medium text-gray-500">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : (
          <div className={`grid grid-cols-7 ${viewMode === 'month' ? '' : 'min-h-[400px]'}`}>
            {calendarDays.map((day, index) => (
              <div
                key={index}
                className={`border-b border-r p-2 min-h-[100px] ${
                  !day.isCurrentMonth ? 'bg-gray-50' : ''
                } ${day.isToday ? 'bg-blue-50' : ''}`}
              >
                <div className={`text-sm font-medium mb-1 ${
                  day.isToday ? 'text-blue-600' : day.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'
                }`}>
                  {day.date.getDate()}
                </div>
                
                {/* Events */}
                <div className="space-y-1 overflow-y-auto max-h-[80px]">
                  {/* Intents (future/planned) */}
                  {day.intents.map((intent) => (
                    <div
                      key={intent.refresh_intent_id}
                      onClick={() => setSelectedEvent(intent)}
                      className={`px-2 py-1 rounded text-xs text-white cursor-pointer truncate ${STATUS_COLORS[intent.intent_status] || 'bg-gray-400'}`}
                      title={`${intent.entity_name || intent.entity_type}: ${intent.refresh_type} (${intent.intent_status})`}
                    >
                      {ENTITY_ICONS[intent.entity_type]} {intent.entity_name || intent.entity_type}
                      {intent.unresolved_conflicts && intent.unresolved_conflicts > 0 && ' ⚠️'}
                    </div>
                  ))}
                  
                  {/* History (completed) */}
                  {day.history.map((item) => (
                    <div
                      key={item.refresh_history_id}
                      onClick={() => setSelectedEvent(item)}
                      className={`px-2 py-1 rounded text-xs text-white cursor-pointer truncate opacity-70 ${STATUS_COLORS[item.execution_status || 'SUCCESS']}`}
                      title={`${item.entity_name || item.entity_type}: ${item.refresh_type} (${item.execution_status})`}
                    >
                      ✓ {ENTITY_ICONS[item.entity_type]} {item.entity_name || item.entity_type}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-sm">
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
          <span className="w-3 h-3 rounded bg-green-600 opacity-70"></span>
          <span>Completed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-red-500"></span>
          <span>Failed</span>
        </div>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full m-4">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {'intent_status' in selectedEvent ? 'Scheduled Refresh' : 'Completed Refresh'}
                </h3>
                <p className="text-sm text-gray-500">
                  {ENTITY_ICONS[selectedEvent.entity_type]} {selectedEvent.entity_type}: {selectedEvent.entity_name || selectedEvent.entity_id}
                </p>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-gray-400 hover:text-gray-600"
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
                      <label className="text-xs text-gray-500">Status</label>
                      <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                        selectedEvent.intent_status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                        selectedEvent.intent_status === 'REQUESTED' ? 'bg-yellow-100 text-yellow-800' :
                        selectedEvent.intent_status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedEvent.intent_status}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <p className="text-sm font-medium">{selectedEvent.refresh_type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500">Planned Date</label>
                    <p className="text-sm">{new Date(selectedEvent.planned_date).toLocaleString()}</p>
                  </div>
                  
                  {selectedEvent.requires_downtime && (
                    <div className="p-3 bg-orange-50 rounded border border-orange-200">
                      <p className="text-sm text-orange-800">
                        ⚠️ Requires downtime
                      </p>
                    </div>
                  )}
                  
                  {selectedEvent.unresolved_conflicts && selectedEvent.unresolved_conflicts > 0 && (
                    <div className="p-3 bg-red-50 rounded border border-red-200">
                      <p className="text-sm text-red-800">
                        ⚠️ {selectedEvent.unresolved_conflicts} unresolved booking conflict(s)
                      </p>
                    </div>
                  )}
                  
                  <div>
                    <label className="text-xs text-gray-500">Requested By</label>
                    <p className="text-sm">{selectedEvent.requested_by_username || 'Unknown'}</p>
                  </div>
                </>
              ) : (
                /* History details */
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs text-gray-500">Status</label>
                      <p className={`inline-flex px-2 py-1 rounded text-sm font-medium ${
                        selectedEvent.execution_status === 'SUCCESS' ? 'bg-green-100 text-green-800' :
                        selectedEvent.execution_status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {selectedEvent.execution_status || 'SUCCESS'}
                      </p>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Type</label>
                      <p className="text-sm font-medium">{selectedEvent.refresh_type}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500">Refresh Date</label>
                    <p className="text-sm">{new Date(selectedEvent.refresh_date).toLocaleString()}</p>
                  </div>
                </>
              )}
            </div>
            
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
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
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
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
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingIntent ? 'Edit Refresh Intent' : 'Schedule New Refresh'}
              </h3>
              <button
                onClick={() => setShowIntentModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-4">
              {formError && (
                <div className="bg-red-50 text-red-700 p-3 rounded-md text-sm">
                  {formError}
                </div>
              )}

              {/* Entity Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entityType}
                  onChange={(e) => handleEntityTypeChange(e.target.value)}
                  disabled={!!editingIntent}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
                >
                  <option value="">Select entity type...</option>
                  {ENTITY_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Entity Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Entity <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.entityId}
                  onChange={(e) => handleEntitySelect(e.target.value)}
                  disabled={!formData.entityType || loadingEntities || !!editingIntent}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm disabled:bg-gray-100"
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned Start <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.plannedDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, plannedDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned End
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.plannedEndDate}
                    onChange={(e) => setFormData(prev => ({ ...prev, plannedEndDate: e.target.value }))}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Refresh Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.refreshType}
                  onChange={(e) => setFormData(prev => ({ ...prev, refreshType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  {REFRESH_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>

              {/* Source Environment */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Source Environment
                </label>
                <input
                  type="text"
                  value={formData.sourceEnvironmentName}
                  onChange={(e) => setFormData(prev => ({ ...prev, sourceEnvironmentName: e.target.value }))}
                  placeholder="e.g., Production, UAT-Gold"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              {/* Impact Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Impact Type <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.impactType}
                  onChange={(e) => setFormData(prev => ({ ...prev, impactType: e.target.value }))}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="DATA_OVERWRITE">Data Overwrite (Destructive)</option>
                  <option value="DOWNTIME_REQUIRED">Downtime Required</option>
                  <option value="SCHEMA_CHANGE">Schema Change</option>
                  <option value="CONFIG_CHANGE">Config Change Only</option>
                  <option value="READ_ONLY">Read-Only (Non-destructive)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">
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
                  conflictResult?.conflictFlag === 'MAJOR' ? 'bg-red-50 border-red-300' :
                  conflictResult?.conflictFlag === 'MINOR' ? 'bg-yellow-50 border-yellow-300' :
                  conflictResult?.hasConflicts === false ? 'bg-green-50 border-green-300' :
                  'bg-gray-50 border-gray-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-900 flex items-center gap-2">
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
                      className="text-xs text-blue-600 hover:text-blue-800"
                    >
                      Recheck
                    </button>
                  </div>

                  {conflictResult?.hasConflicts && (
                    <>
                      <p className="text-sm text-gray-600 mb-3">
                        Found {conflictResult.conflicts.length} conflicting booking(s). 
                        {conflictResult.conflictFlag === 'MAJOR' && (
                          <span className="text-red-600 font-medium"> This refresh will require force approval.</span>
                        )}
                      </p>
                      
                      {/* Conflict List */}
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {conflictResult.conflicts.map((conflict, idx) => (
                          <div 
                            key={conflict.bookingId || idx}
                            className={`p-3 rounded-md text-sm ${
                              conflict.severity === 'HIGH' ? 'bg-red-100' :
                              conflict.severity === 'MEDIUM' ? 'bg-yellow-100' : 'bg-gray-100'
                            }`}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <span className={`inline-flex px-1.5 py-0.5 rounded text-xs font-medium mr-2 ${
                                  conflict.severity === 'HIGH' ? 'bg-red-200 text-red-800' :
                                  conflict.severity === 'MEDIUM' ? 'bg-yellow-200 text-yellow-800' : 'bg-gray-200 text-gray-800'
                                }`}>
                                  {conflict.severity}
                                </span>
                                <span className="font-medium text-gray-900">{conflict.title || 'Booking'}</span>
                                {conflict.isCritical && (
                                  <span className="ml-2 text-xs text-red-600 font-medium">CRITICAL</span>
                                )}
                              </div>
                            </div>
                            <div className="mt-1 text-gray-600">
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
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <label className="flex items-start gap-2">
                            <input
                              type="checkbox"
                              checked={acknowledgeConflicts}
                              onChange={(e) => setAcknowledgeConflicts(e.target.checked)}
                              className="rounded border-red-300 mt-0.5"
                            />
                            <span className="text-sm text-red-800">
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
                    className="rounded border-gray-300"
                  />
                  <span className="text-sm text-gray-700">Requires Downtime</span>
                </label>
                {formData.requiresDowntime && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={formData.estimatedDowntimeMinutes}
                      onChange={(e) => setFormData(prev => ({ ...prev, estimatedDowntimeMinutes: parseInt(e.target.value) || 0 }))}
                      className="w-20 border border-gray-300 rounded-md px-2 py-1 text-sm"
                      min="0"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.reason}
                  onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Why is this refresh needed?"
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>

              {/* Business Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Justification
                </label>
                <textarea
                  value={formData.businessJustification}
                  onChange={(e) => setFormData(prev => ({ ...prev, businessJustification: e.target.value }))}
                  placeholder="Business impact and justification for approval"
                  rows={2}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowIntentModal(false)}
                className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200"
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
