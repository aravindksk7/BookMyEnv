'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { refreshAPI } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

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
  source_snapshot_name?: string;
  requires_downtime: boolean;
  estimated_downtime_minutes?: number;
  requested_by_user_id: string;
  requested_by_username?: string;
  requested_by_email?: string;
  requested_at: string;
  reason: string;
  business_justification?: string;
  change_ticket_ref?: string;
  release_name?: string;
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
  booking_owner_email?: string;
  booking_purpose?: string;
}

interface Statistics {
  summary: {
    pendingApprovals: number;
    upcomingRefreshes: number;
    unresolvedConflicts: number;
  };
  historyStats: {
    successCount: number;
    failedCount: number;
    totalCount: number;
    avgDurationMinutes: number;
  };
}

const ENTITY_ICONS: Record<string, string> = {
  Environment: '🌐',
  EnvironmentInstance: '📦',
  Application: '📱',
  AppComponent: '🧩',
  Interface: '🔗',
  InfraComponent: '🖥️',
  TestDataSet: '📊',
};

const REFRESH_TYPE_LABELS: Record<string, string> = {
  FULL_COPY: 'Full Copy',
  PARTIAL_COPY: 'Partial Copy',
  DATA_ONLY: 'Data Only',
  CONFIG_ONLY: 'Config Only',
  MASKED_COPY: 'Masked Copy',
  SCHEMA_SYNC: 'Schema Sync',
  GOLDEN_COPY: 'Golden Copy',
  POINT_IN_TIME: 'Point-in-Time',
  OTHER: 'Other',
};

export default function RefreshApprovalsPage() {
  const { user } = useAuth();
  const [pendingIntents, setPendingIntents] = useState<RefreshIntent[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIntent, setSelectedIntent] = useState<RefreshIntent | null>(null);
  const [conflicts, setConflicts] = useState<RefreshConflict[]>([]);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [pendingRes, statsRes] = await Promise.all([
        refreshAPI.getPendingApprovals(),
        refreshAPI.getStatistics(30)
      ]);
      setPendingIntents(pendingRes.data.intents || []);
      setStatistics(statsRes.data);
    } catch (err: any) {
      console.error('Failed to load approvals:', err);
      setError(err.response?.data?.error || 'Failed to load pending approvals');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load conflicts when selecting an intent
  const handleSelectIntent = async (intent: RefreshIntent) => {
    setSelectedIntent(intent);
    setApprovalNotes('');
    setRejectionReason('');
    try {
      const res = await refreshAPI.getConflicts(intent.refresh_intent_id);
      setConflicts(res.data.conflicts || []);
    } catch (err) {
      console.error('Failed to load conflicts:', err);
    }
  };

  // Approve intent
  const handleApprove = async () => {
    if (!selectedIntent) return;
    
    // Check for unresolved conflicts
    const unresolvedCount = conflicts.filter(c => c.resolution_status === 'UNRESOLVED').length;
    if (unresolvedCount > 0) {
      if (!confirm(`There are ${unresolvedCount} unresolved conflicts. Are you sure you want to approve anyway?`)) {
        return;
      }
    }
    
    setProcessingId(selectedIntent.refresh_intent_id);
    try {
      await refreshAPI.approveIntent(selectedIntent.refresh_intent_id, approvalNotes || undefined);
      setSelectedIntent(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to approve');
    } finally {
      setProcessingId(null);
    }
  };

  // Reject intent
  const handleReject = async () => {
    if (!selectedIntent) return;
    
    if (!rejectionReason.trim()) {
      setError('Rejection reason is required');
      return;
    }
    
    setProcessingId(selectedIntent.refresh_intent_id);
    try {
      await refreshAPI.rejectIntent(selectedIntent.refresh_intent_id, rejectionReason);
      setSelectedIntent(null);
      loadData();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reject');
    } finally {
      setProcessingId(null);
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

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString();
  };

  // Format relative date
  const getRelativeDate = (dateStr: string) => {
    const days = Math.floor((new Date(dateStr).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    if (days < 0) return `${Math.abs(days)} days ago`;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `in ${days} days`;
  };

  const canApprove = user?.role === 'Admin' || user?.role === 'EnvironmentManager';

  if (!canApprove) {
    return (
      <div className="p-6">
        <div className="bg-yellow-50 text-yellow-800 p-4 rounded-lg">
          You don't have permission to approve refresh requests. Only Admins and Environment Managers can approve.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Refresh Approvals</h1>
        <p className="text-gray-500 mt-1">Review and approve pending refresh requests</p>
      </div>

      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Pending Approvals</div>
            <div className="text-2xl font-bold text-yellow-600">{statistics.summary.pendingApprovals}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Upcoming (7 days)</div>
            <div className="text-2xl font-bold text-blue-600">{statistics.summary.upcomingRefreshes}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Unresolved Conflicts</div>
            <div className="text-2xl font-bold text-red-600">{statistics.summary.unresolvedConflicts}</div>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <div className="text-sm text-gray-500">Success Rate (30d)</div>
            <div className="text-2xl font-bold text-green-600">
              {statistics.historyStats.totalCount > 0 
                ? `${Math.round((statistics.historyStats.successCount / statistics.historyStats.totalCount) * 100)}%`
                : '-'}
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-lg mb-6 flex justify-between items-center">
          {error}
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">×</button>
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending List */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Pending Requests ({pendingIntents.length})
            </h2>
          </div>
          
          <div className="divide-y divide-gray-200 max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="p-6 text-center text-gray-500">Loading...</div>
            ) : pendingIntents.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                <div className="text-4xl mb-2">✅</div>
                No pending approvals
              </div>
            ) : (
              pendingIntents.map((intent) => (
                <div
                  key={intent.refresh_intent_id}
                  onClick={() => handleSelectIntent(intent)}
                  className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                    selectedIntent?.refresh_intent_id === intent.refresh_intent_id
                      ? 'bg-blue-50 border-l-4 border-blue-500'
                      : ''
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{ENTITY_ICONS[intent.entity_type]}</span>
                        <span className="font-medium text-gray-900">
                          {intent.entity_name || intent.entity_id}
                        </span>
                        {intent.unresolved_conflicts && intent.unresolved_conflicts > 0 && (
                          <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                            {intent.unresolved_conflicts} conflict{intent.unresolved_conflicts > 1 ? 's' : ''}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        {intent.entity_type} • {REFRESH_TYPE_LABELS[intent.refresh_type] || intent.refresh_type}
                      </p>
                      <p className="text-sm text-gray-500">
                        Planned: {formatDate(intent.planned_date)} ({getRelativeDate(intent.planned_date)})
                      </p>
                    </div>
                    <div className="text-right">
                      {intent.requires_downtime && (
                        <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-orange-100 text-orange-800">
                          ⚠️ Downtime
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mt-2 line-clamp-2">{intent.reason}</p>
                  <p className="text-xs text-gray-400 mt-2">
                    Requested by {intent.requested_by_username || 'Unknown'} • {formatDate(intent.requested_at)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="bg-white rounded-lg shadow">
          {selectedIntent ? (
            <>
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Request Details</h2>
              </div>
              
              <div className="p-6 space-y-6 max-h-[600px] overflow-y-auto">
                {/* Entity Info */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Entity</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{ENTITY_ICONS[selectedIntent.entity_type]}</span>
                    <div>
                      <p className="font-medium text-gray-900">
                        {selectedIntent.entity_name || selectedIntent.entity_id}
                      </p>
                      <p className="text-sm text-gray-500">{selectedIntent.entity_type}</p>
                    </div>
                  </div>
                </div>

                {/* Refresh Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Type</h3>
                    <p className="text-gray-900">{REFRESH_TYPE_LABELS[selectedIntent.refresh_type]}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Source</h3>
                    <p className="text-gray-900">
                      {selectedIntent.source_environment_name || selectedIntent.source_snapshot_name || 'N/A'}
                    </p>
                  </div>
                </div>

                {/* Schedule */}
                <div className="p-4 bg-gray-50 rounded-lg">
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Schedule</h3>
                  <div className="space-y-1">
                    <p className="text-gray-900">
                      <strong>Start:</strong> {formatDate(selectedIntent.planned_date)}
                    </p>
                    {selectedIntent.planned_end_date && (
                      <p className="text-gray-900">
                        <strong>End:</strong> {formatDate(selectedIntent.planned_end_date)}
                      </p>
                    )}
                  </div>
                  {selectedIntent.requires_downtime && (
                    <div className="mt-3 p-3 bg-orange-100 rounded border border-orange-200">
                      <p className="text-orange-800 font-medium">
                        ⚠️ Requires {selectedIntent.estimated_downtime_minutes || '?'} minutes downtime
                      </p>
                    </div>
                  )}
                </div>

                {/* Reason & Justification */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Reason</h3>
                  <p className="text-gray-900">{selectedIntent.reason}</p>
                  {selectedIntent.business_justification && (
                    <div className="mt-2">
                      <h4 className="text-sm font-medium text-gray-500">Business Justification</h4>
                      <p className="text-gray-700">{selectedIntent.business_justification}</p>
                    </div>
                  )}
                </div>

                {/* References */}
                {(selectedIntent.change_ticket_ref || selectedIntent.release_name) && (
                  <div className="grid grid-cols-2 gap-4">
                    {selectedIntent.change_ticket_ref && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Change Ticket</h3>
                        <p className="text-blue-600">{selectedIntent.change_ticket_ref}</p>
                      </div>
                    )}
                    {selectedIntent.release_name && (
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-1">Release</h3>
                        <p className="text-gray-900">{selectedIntent.release_name}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Requester */}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">Requested By</h3>
                  <p className="text-gray-900">{selectedIntent.requested_by_username || 'Unknown'}</p>
                  {selectedIntent.requested_by_email && (
                    <p className="text-sm text-gray-500">{selectedIntent.requested_by_email}</p>
                  )}
                  <p className="text-sm text-gray-400 mt-1">{formatDate(selectedIntent.requested_at)}</p>
                </div>

                {/* Conflicts */}
                {conflicts.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Booking Conflicts ({conflicts.length})
                    </h3>
                    <div className="space-y-2">
                      {conflicts.map((conflict) => (
                        <div 
                          key={conflict.conflict_id}
                          className={`p-3 rounded border ${
                            conflict.resolution_status === 'UNRESOLVED'
                              ? 'bg-red-50 border-red-200'
                              : 'bg-gray-50 border-gray-200'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded ${
                                  conflict.severity === 'HIGH' ? 'bg-red-200 text-red-800' : 'bg-yellow-200 text-yellow-800'
                                }`}>
                                  {conflict.severity}
                                </span>
                                <span className="text-sm font-medium">{conflict.conflict_type}</span>
                                <span className={`inline-flex px-2 py-0.5 text-xs rounded ${
                                  conflict.resolution_status === 'UNRESOLVED' 
                                    ? 'bg-red-100 text-red-700' 
                                    : 'bg-green-100 text-green-700'
                                }`}>
                                  {conflict.resolution_status}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {formatDate(conflict.booking_start)} - {formatDate(conflict.booking_end)}
                              </p>
                              {conflict.booking_owner && (
                                <p className="text-sm text-gray-500">
                                  Booked by: {conflict.booking_owner}
                                </p>
                              )}
                              {conflict.booking_purpose && (
                                <p className="text-sm text-gray-500">
                                  Purpose: {conflict.booking_purpose}
                                </p>
                              )}
                            </div>
                            {conflict.resolution_status === 'UNRESOLVED' && (
                              <select
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
                                <option value="OVERRIDE_APPROVED">Override</option>
                                <option value="DISMISSED">Dismiss</option>
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Approval Form */}
                <div className="border-t pt-4">
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Approval Notes (optional)
                    </label>
                    <textarea
                      rows={2}
                      value={approvalNotes}
                      onChange={(e) => setApprovalNotes(e.target.value)}
                      placeholder="Add any notes for the approval..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Rejection Reason (required for rejection)
                    </label>
                    <textarea
                      rows={2}
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why the request is being rejected..."
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={handleApprove}
                      disabled={processingId === selectedIntent.refresh_intent_id}
                      className="flex-1 px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 disabled:opacity-50"
                    >
                      {processingId === selectedIntent.refresh_intent_id ? 'Processing...' : '✓ Approve'}
                    </button>
                    <button
                      onClick={handleReject}
                      disabled={processingId === selectedIntent.refresh_intent_id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-md hover:bg-red-700 disabled:opacity-50"
                    >
                      {processingId === selectedIntent.refresh_intent_id ? 'Processing...' : '✗ Reject'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="p-6 text-center text-gray-500">
              <div className="text-4xl mb-4">👈</div>
              <p>Select a request to view details</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
