'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { refreshAPI, groupsAPI, releasesAPI, environmentsAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// Types
interface RefreshHistory {
  refresh_history_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  refresh_date: string;
  refresh_type: string;
  source_environment_name?: string;
  source_snapshot_name?: string;
  requested_by_username?: string;
  executed_by_username?: string;
  execution_status?: string;
  duration_minutes?: number;
  notes?: string;
  change_ticket_ref?: string;
}

interface RefreshIntent {
  refresh_intent_id: string;
  entity_type: string;
  entity_id: string;
  entity_name?: string;
  intent_status: string;
  planned_date: string;
  planned_end_date?: string;
  refresh_type: string;
  source_environment_name?: string;
  requires_downtime: boolean;
  estimated_downtime_minutes?: number;
  requested_by_username?: string;
  approved_by_username?: string;
  reason: string;
  unresolved_conflicts?: number;
}

interface RefreshConflict {
  conflict_id: string;
  booking_id: string;
  conflict_type: string;
  severity: string;
  resolution_status: string;
  booking_start: string;
  booking_end: string;
  booking_owner?: string;
  booking_purpose?: string;
}

interface RefreshPanelProps {
  entityType: 'Environment' | 'EnvironmentInstance' | 'Application' | 'AppComponent' | 'Interface' | 'InfraComponent' | 'TestDataSet';
  entityId: string;
  entityName?: string;
  lastRefreshDate?: string;
  lastRefreshType?: string;
  lastRefreshSource?: string;
  onRefreshComplete?: () => void;
}

const REFRESH_TYPES = [
  { value: 'FULL_COPY', label: 'Full Copy', description: 'Complete copy of all data' },
  { value: 'PARTIAL_COPY', label: 'Partial Copy', description: 'Copy selected tables/schemas' },
  { value: 'DATA_ONLY', label: 'Data Only', description: 'Data without schema changes' },
  { value: 'CONFIG_ONLY', label: 'Config Only', description: 'Configuration and settings only' },
  { value: 'MASKED_COPY', label: 'Masked Copy', description: 'Data with PII/sensitive data masked' },
  { value: 'SCHEMA_SYNC', label: 'Schema Sync', description: 'Schema changes only, no data' },
  { value: 'GOLDEN_COPY', label: 'Golden Copy', description: 'From golden/baseline dataset' },
  { value: 'POINT_IN_TIME', label: 'Point-in-Time', description: 'Restore to specific timestamp' },
  { value: 'OTHER', label: 'Other', description: 'Other refresh type' },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  REQUESTED: 'bg-yellow-100 text-yellow-800',
  APPROVED: 'bg-green-100 text-green-800',
  SCHEDULED: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-purple-100 text-purple-800',
  COMPLETED: 'bg-green-100 text-green-800',
  FAILED: 'bg-red-100 text-red-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
  ROLLED_BACK: 'bg-orange-100 text-orange-800',
  SUCCESS: 'bg-green-100 text-green-800',
  PARTIAL_SUCCESS: 'bg-yellow-100 text-yellow-800',
};

export default function RefreshPanel({
  entityType,
  entityId,
  entityName,
  lastRefreshDate,
  lastRefreshType,
  lastRefreshSource,
  onRefreshComplete
}: RefreshPanelProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'history' | 'intents' | 'schedule'>('history');
  const [history, setHistory] = useState<RefreshHistory[]>([]);
  const [intents, setIntents] = useState<RefreshIntent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Schedule form state
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    plannedDate: '',
    plannedEndDate: '',
    refreshType: 'FULL_COPY',
    sourceEnvironmentName: '',
    sourceSnapshotName: '',
    requiresDowntime: false,
    estimatedDowntimeMinutes: 60,
    reason: '',
    businessJustification: '',
    changeTicketRef: '',
    releaseId: '',
    notificationGroups: [] as string[],
  });
  
  // Reference data
  const [groups, setGroups] = useState<any[]>([]);
  const [releases, setReleases] = useState<any[]>([]);
  const [environments, setEnvironments] = useState<any[]>([]);
  
  // Selected intent for detail view
  const [selectedIntent, setSelectedIntent] = useState<RefreshIntent | null>(null);
  const [conflicts, setConflicts] = useState<RefreshConflict[]>([]);

  // Load data on mount
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [historyRes, intentsRes] = await Promise.all([
        refreshAPI.getHistory(entityType, entityId, 10),
        refreshAPI.getEntityIntents(entityType, entityId, true)
      ]);
      setHistory(historyRes.data.history || []);
      setIntents(intentsRes.data.intents || []);
    } catch (err: any) {
      console.error('Failed to load refresh data:', err);
      setError(err.response?.data?.error || 'Failed to load refresh data');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load reference data when schedule form opens
  useEffect(() => {
    if (showScheduleForm) {
      Promise.all([
        groupsAPI.getAll(),
        releasesAPI.getAll(),
        environmentsAPI.getAll()
      ]).then(([groupsRes, releasesRes, envsRes]) => {
        setGroups(groupsRes.data.groups || groupsRes.data || []);
        setReleases(releasesRes.data.releases || releasesRes.data || []);
        setEnvironments(envsRes.data.environments || envsRes.data || []);
      }).catch(console.error);
    }
  }, [showScheduleForm]);

  // Submit new refresh intent
  const handleSubmitIntent = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      await refreshAPI.createIntent({
        entityType,
        entityId,
        entityName,
        plannedDate: new Date(scheduleForm.plannedDate).toISOString(),
        plannedEndDate: scheduleForm.plannedEndDate ? new Date(scheduleForm.plannedEndDate).toISOString() : undefined,
        refreshType: scheduleForm.refreshType,
        sourceEnvironmentName: scheduleForm.sourceEnvironmentName || undefined,
        sourceSnapshotName: scheduleForm.sourceSnapshotName || undefined,
        requiresDowntime: scheduleForm.requiresDowntime,
        estimatedDowntimeMinutes: scheduleForm.requiresDowntime ? scheduleForm.estimatedDowntimeMinutes : undefined,
        reason: scheduleForm.reason,
        businessJustification: scheduleForm.businessJustification || undefined,
        changeTicketRef: scheduleForm.changeTicketRef || undefined,
        releaseId: scheduleForm.releaseId || undefined,
        notificationGroups: scheduleForm.notificationGroups.length > 0 ? scheduleForm.notificationGroups : undefined,
      });
      
      setShowScheduleForm(false);
      setScheduleForm({
        plannedDate: '',
        plannedEndDate: '',
        refreshType: 'FULL_COPY',
        sourceEnvironmentName: '',
        sourceSnapshotName: '',
        requiresDowntime: false,
        estimatedDowntimeMinutes: 60,
        reason: '',
        businessJustification: '',
        changeTicketRef: '',
        releaseId: '',
        notificationGroups: [],
      });
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create refresh intent');
    } finally {
      setLoading(false);
    }
  };

  // Load conflicts when selecting an intent
  const handleSelectIntent = async (intent: RefreshIntent) => {
    setSelectedIntent(intent);
    try {
      const res = await refreshAPI.getConflicts(intent.refresh_intent_id);
      setConflicts(res.data.conflicts || []);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
    }
  };

  // Approve intent
  const handleApprove = async (intentId: string) => {
    try {
      await refreshAPI.approveIntent(intentId);
      loadData();
      setSelectedIntent(null);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve');
    }
  };

  // Reject intent
  const handleReject = async (intentId: string) => {
    const reason = prompt('Enter rejection reason:');
    if (reason) {
      try {
        await refreshAPI.rejectIntent(intentId, reason);
        loadData();
        setSelectedIntent(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to reject');
      }
    }
  };

  // Cancel intent
  const handleCancel = async (intentId: string) => {
    if (confirm('Are you sure you want to cancel this refresh?')) {
      try {
        await refreshAPI.cancelIntent(intentId);
        loadData();
        setSelectedIntent(null);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to cancel');
      }
    }
  };

  // Start execution
  const handleStart = async (intentId: string) => {
    try {
      await refreshAPI.startExecution(intentId);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to start execution');
    }
  };

  // Complete execution
  const handleComplete = async (intentId: string, success: boolean) => {
    const notes = prompt('Enter execution notes:') || '';
    const duration = prompt('Enter duration in minutes:') || '0';
    
    try {
      await refreshAPI.completeExecution(intentId, {
        executionNotes: notes,
        durationMinutes: parseInt(duration),
        executionStatus: success ? 'SUCCESS' : 'FAILED',
        errorMessage: success ? undefined : 'Execution failed'
      });
      loadData();
      setSelectedIntent(null);
      onRefreshComplete?.();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to complete execution');
    }
  };

  // Resolve conflict
  const handleResolveConflict = async (conflictId: string, resolution: string) => {
    const notes = prompt('Enter resolution notes:') || '';
    try {
      await refreshAPI.resolveConflict(conflictId, {
        resolutionStatus: resolution as any,
        resolutionNotes: notes
      });
      if (selectedIntent) {
        handleSelectIntent(selectedIntent);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resolve conflict');
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Get days since/until date
  const getDaysLabel = (dateStr: string) => {
    const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days} days`;
  };

  const canApprove = user?.role === 'Admin' || user?.role === 'EnvironmentManager';
  const canManage = canApprove || user?.role === 'ReleaseManager';

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with last refresh info */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Refresh Lifecycle</h3>
            {lastRefreshDate && (
              <p className="text-sm text-gray-500 mt-1">
                Last refreshed: <span className="font-medium">{formatDate(lastRefreshDate)}</span>
                {lastRefreshType && <> ({lastRefreshType})</>}
                {lastRefreshSource && <> from {lastRefreshSource}</>}
              </p>
            )}
          </div>
          <button
            onClick={() => setShowScheduleForm(true)}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            Schedule Refresh
          </button>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mx-6 mt-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex -mb-px px-6">
          {['history', 'intents'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`py-4 px-6 text-sm font-medium border-b-2 ${
                activeTab === tab
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab === 'history' ? 'History' : 'Scheduled / Pending'}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="p-6">
        {loading && !history.length && !intents.length ? (
          <div className="text-center py-8 text-gray-500">Loading...</div>
        ) : activeTab === 'history' ? (
          /* History Tab */
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No refresh history yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Source</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Duration</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">By</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {history.map((item) => (
                      <tr key={item.refresh_history_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">{formatDate(item.refresh_date)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{item.refresh_type}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.source_environment_name || item.source_snapshot_name || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[item.execution_status || 'SUCCESS']}`}>
                            {item.execution_status || 'SUCCESS'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.duration_minutes ? `${item.duration_minutes} min` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {item.executed_by_username || item.requested_by_username || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          /* Intents Tab */
          <div className="space-y-4">
            {intents.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No scheduled or pending refreshes</p>
            ) : (
              <div className="space-y-3">
                {intents.map((intent) => (
                  <div
                    key={intent.refresh_intent_id}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedIntent?.refresh_intent_id === intent.refresh_intent_id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => handleSelectIntent(intent)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${STATUS_COLORS[intent.intent_status]}`}>
                            {intent.intent_status}
                          </span>
                          <span className="font-medium text-gray-900">{intent.refresh_type}</span>
                          {intent.unresolved_conflicts && intent.unresolved_conflicts > 0 && (
                            <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                              {intent.unresolved_conflicts} conflict{intent.unresolved_conflicts > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          Planned: {formatDate(intent.planned_date)} ({getDaysLabel(intent.planned_date)})
                        </p>
                        <p className="text-sm text-gray-500">{intent.reason}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {intent.requires_downtime && (
                          <span className="text-xs text-orange-600">
                            ⚠️ {intent.estimated_downtime_minutes || '?'} min downtime
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions when selected */}
                    {selectedIntent?.refresh_intent_id === intent.refresh_intent_id && (
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex flex-wrap gap-2">
                          {intent.intent_status === 'REQUESTED' && canApprove && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleApprove(intent.refresh_intent_id); }}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                              >
                                Approve
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleReject(intent.refresh_intent_id); }}
                                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {['APPROVED', 'SCHEDULED'].includes(intent.intent_status) && canManage && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleStart(intent.refresh_intent_id); }}
                              className="px-3 py-1.5 bg-purple-600 text-white text-sm rounded-md hover:bg-purple-700"
                            >
                              Start Execution
                            </button>
                          )}
                          {intent.intent_status === 'IN_PROGRESS' && canManage && (
                            <>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleComplete(intent.refresh_intent_id, true); }}
                                className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700"
                              >
                                Complete Successfully
                              </button>
                              <button
                                onClick={(e) => { e.stopPropagation(); handleComplete(intent.refresh_intent_id, false); }}
                                className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
                              >
                                Mark Failed
                              </button>
                            </>
                          )}
                          {!['COMPLETED', 'FAILED', 'CANCELLED', 'ROLLED_BACK', 'IN_PROGRESS'].includes(intent.intent_status) && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCancel(intent.refresh_intent_id); }}
                              className="px-3 py-1.5 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700"
                            >
                              Cancel
                            </button>
                          )}
                        </div>

                        {/* Conflicts section */}
                        {conflicts.length > 0 && (
                          <div className="mt-4">
                            <h4 className="text-sm font-medium text-gray-700 mb-2">Booking Conflicts</h4>
                            <div className="space-y-2">
                              {conflicts.map((conflict) => (
                                <div key={conflict.conflict_id} className="p-3 bg-red-50 rounded border border-red-200">
                                  <div className="flex justify-between items-start">
                                    <div>
                                      <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                        conflict.severity === 'HIGH' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                                      }`}>
                                        {conflict.severity}
                                      </span>
                                      <span className="ml-2 text-sm text-gray-700">{conflict.conflict_type}</span>
                                      <p className="text-sm text-gray-500 mt-1">
                                        Booking: {formatDate(conflict.booking_start)} - {formatDate(conflict.booking_end)}
                                        {conflict.booking_owner && <> by {conflict.booking_owner}</>}
                                      </p>
                                    </div>
                                    {conflict.resolution_status === 'UNRESOLVED' && canApprove && (
                                      <select
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => { 
                                          if (e.target.value) handleResolveConflict(conflict.conflict_id, e.target.value);
                                        }}
                                        className="text-sm border border-gray-300 rounded-md px-2 py-1"
                                        defaultValue=""
                                      >
                                        <option value="">Resolve...</option>
                                        <option value="ACKNOWLEDGED">Acknowledge</option>
                                        <option value="BOOKING_MOVED">Booking Moved</option>
                                        <option value="REFRESH_MOVED">Refresh Moved</option>
                                        <option value="OVERRIDE_APPROVED">Override Approved</option>
                                        <option value="DISMISSED">Dismiss</option>
                                      </select>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Schedule Form Modal */}
      {showScheduleForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div className="px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Schedule Refresh</h3>
              <p className="text-sm text-gray-500">
                {entityType}: {entityName || entityId}
              </p>
            </div>
            
            <form onSubmit={handleSubmitIntent} className="p-6 space-y-4">
              {/* Planned Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned Start Date *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduleForm.plannedDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, plannedDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Planned End Date
                  </label>
                  <input
                    type="datetime-local"
                    value={scheduleForm.plannedEndDate}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, plannedEndDate: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Refresh Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Refresh Type *
                </label>
                <select
                  required
                  value={scheduleForm.refreshType}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, refreshType: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {REFRESH_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label} - {type.description}
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Environment
                  </label>
                  <select
                    value={scheduleForm.sourceEnvironmentName}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, sourceEnvironmentName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select source...</option>
                    {environments.map((env: any) => (
                      <option key={env.environment_id} value={env.name}>
                        {env.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Source Snapshot Name
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., PROD-SNAPSHOT-2025-01-15"
                    value={scheduleForm.sourceSnapshotName}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, sourceSnapshotName: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Downtime */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={scheduleForm.requiresDowntime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, requiresDowntime: e.target.checked })}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Requires Downtime</span>
                </label>
                {scheduleForm.requiresDowntime && (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      value={scheduleForm.estimatedDowntimeMinutes}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, estimatedDowntimeMinutes: parseInt(e.target.value) })}
                      className="w-24 border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-500">minutes</span>
                  </div>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Why is this refresh needed?"
                  value={scheduleForm.reason}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, reason: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Business Justification */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Business Justification
                </label>
                <textarea
                  rows={2}
                  placeholder="Business impact and justification..."
                  value={scheduleForm.businessJustification}
                  onChange={(e) => setScheduleForm({ ...scheduleForm, businessJustification: e.target.value })}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* References */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Change Ticket
                  </label>
                  <input
                    type="text"
                    placeholder="CHG-123456"
                    value={scheduleForm.changeTicketRef}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, changeTicketRef: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Associated Release
                  </label>
                  <select
                    value={scheduleForm.releaseId}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, releaseId: e.target.value })}
                    className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select release...</option>
                    {releases.map((release: any) => (
                      <option key={release.release_id} value={release.release_id}>
                        {release.release_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notification Groups */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notify Groups
                </label>
                <div className="flex flex-wrap gap-2">
                  {groups.map((group: any) => (
                    <label key={group.group_id} className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={scheduleForm.notificationGroups.includes(group.group_id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setScheduleForm({
                              ...scheduleForm,
                              notificationGroups: [...scheduleForm.notificationGroups, group.group_id]
                            });
                          } else {
                            setScheduleForm({
                              ...scheduleForm,
                              notificationGroups: scheduleForm.notificationGroups.filter(id => id !== group.group_id)
                            });
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-700">{group.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowScheduleForm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit for Approval'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
