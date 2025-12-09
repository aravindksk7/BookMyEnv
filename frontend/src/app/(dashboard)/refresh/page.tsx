'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { refreshAPI } from '@/lib/api';

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

export default function RefreshCalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [intents, setIntents] = useState<RefreshIntent[]>([]);
  const [history, setHistory] = useState<RefreshHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<RefreshIntent | RefreshHistoryItem | null>(null);
  const [entityTypeFilter, setEntityTypeFilter] = useState<string>('');

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

  useEffect(() => {
    loadData();
  }, [loadData]);

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
              {'intent_status' in selectedEvent && (
                <a
                  href={`/environments?intent=${selectedEvent.refresh_intent_id}`}
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
    </div>
  );
}
