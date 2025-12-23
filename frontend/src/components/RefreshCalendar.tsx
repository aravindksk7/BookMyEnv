'use client';

// Import temporal polyfill before any Schedule-X imports
import 'temporal-polyfill/global';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewMonthGrid,
  createViewWeek,
} from '@schedule-x/calendar';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import { useThemeContext } from '@/contexts/ThemeContext';
import '@schedule-x/theme-default/dist/index.css';

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

interface RefreshCalendarProps {
  intents: RefreshIntent[];
  history: RefreshHistoryItem[];
  onEventClick: (event: RefreshIntent | RefreshHistoryItem) => void;
  onDateClick?: (date: string) => void;
}

const ENTITY_ICONS: Record<string, string> = {
  Environment: '🏢',
  EnvironmentInstance: '📦',
  Application: '📱',
  AppComponent: '🧩',
  Interface: '🔗',
  InfraComponent: '⚙️',
  TestDataSet: '📊',
};

// Convert ISO datetime to Temporal.ZonedDateTime
const toZonedDateTime = (isoDate: string): Temporal.ZonedDateTime | null => {
  if (!isoDate) return null;
  try {
    const date = new Date(isoDate);
    const plainDateTime = Temporal.PlainDateTime.from({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: 0,
    });
    return plainDateTime.toZonedDateTime(Temporal.Now.timeZoneId());
  } catch (e) {
    console.error('Error parsing date:', isoDate, e);
    return null;
  }
};

// Get calendar ID based on intent status for color coding
const getIntentCalendarId = (intent: RefreshIntent): string => {
  if (intent.unresolved_conflicts && intent.unresolved_conflicts > 0) {
    return 'conflict';
  }
  switch (intent.intent_status) {
    case 'REQUESTED':
      return 'requested';
    case 'APPROVED':
      return 'approved';
    case 'SCHEDULED':
      return 'scheduled';
    case 'IN_PROGRESS':
      return 'in_progress';
    case 'COMPLETED':
      return 'completed';
    case 'FAILED':
      return 'failed';
    case 'DRAFT':
      return 'draft';
    default:
      return 'default';
  }
};

// Get calendar ID for history items
const getHistoryCalendarId = (item: RefreshHistoryItem): string => {
  switch (item.execution_status) {
    case 'SUCCESS':
    case 'COMPLETED':
      return 'history_success';
    case 'FAILED':
      return 'history_failed';
    default:
      return 'history_success';
  }
};

export default function RefreshCalendar({
  intents,
  history,
  onEventClick,
  onDateClick,
}: RefreshCalendarProps) {
  const [isClient, setIsClient] = useState(false);
  const eventsServiceRef = useRef(createEventsServicePlugin());
  const { mode } = useThemeContext();
  const intentsRef = useRef<RefreshIntent[]>([]);
  const historyRef = useRef<RefreshHistoryItem[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Keep refs updated
  useEffect(() => {
    intentsRef.current = intents;
    historyRef.current = history;
  }, [intents, history]);

  // Convert intents and history to Schedule-X events
  const events = useMemo(() => {
    const intentEvents = intents.map(intent => {
      const start = toZonedDateTime(intent.planned_date);
      // Default to 2 hours if no end date
      let end = intent.planned_end_date 
        ? toZonedDateTime(intent.planned_end_date)
        : start ? start.add({ hours: 2 }) : null;
      
      if (!start || !end) return null;
      
      const icon = ENTITY_ICONS[intent.entity_type] || '📋';
      const conflictWarning = intent.unresolved_conflicts && intent.unresolved_conflicts > 0 ? ' ⚠️' : '';
      
      return {
        id: `intent-${intent.refresh_intent_id}`,
        title: `${icon} ${intent.entity_name || intent.entity_type}${conflictWarning}`,
        start,
        end,
        calendarId: getIntentCalendarId(intent),
        description: `${intent.refresh_type} - ${intent.intent_status}`,
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    const historyEvents = history.map(item => {
      const start = toZonedDateTime(item.refresh_date);
      // History events are typically point-in-time, show as 1 hour
      const end = start ? start.add({ hours: 1 }) : null;
      
      if (!start || !end) return null;
      
      const icon = ENTITY_ICONS[item.entity_type] || '📋';
      
      return {
        id: `history-${item.refresh_history_id}`,
        title: `✓ ${icon} ${item.entity_name || item.entity_type}`,
        start,
        end,
        calendarId: getHistoryCalendarId(item),
        description: `${item.refresh_type} - ${item.execution_status || 'SUCCESS'}`,
      };
    }).filter((e): e is NonNullable<typeof e> => e !== null);

    return [...intentEvents, ...historyEvents];
  }, [intents, history]);

  // Update events when data changes
  useEffect(() => {
    if (isClient && eventsServiceRef.current) {
      eventsServiceRef.current.set(events);
    }
  }, [events, isClient]);

  // Create calendar configuration
  const calendarConfig = useMemo(() => {
    return {
      views: [createViewMonthGrid(), createViewWeek()] as [ReturnType<typeof createViewMonthGrid>, ReturnType<typeof createViewWeek>],
      plugins: [eventsServiceRef.current],
      defaultView: 'month-grid',
      isDark: mode === 'dark',
      events: events,
      calendars: {
        draft: {
          colorName: 'draft',
          lightColors: {
            main: '#9e9e9e',
            container: '#eeeeee',
            onContainer: '#424242',
          },
          darkColors: {
            main: '#bdbdbd',
            container: '#616161',
            onContainer: '#eeeeee',
          },
        },
        requested: {
          colorName: 'requested',
          lightColors: {
            main: '#f59e0b',
            container: '#fef3c7',
            onContainer: '#92400e',
          },
          darkColors: {
            main: '#fbbf24',
            container: '#b45309',
            onContainer: '#fef3c7',
          },
        },
        approved: {
          colorName: 'approved',
          lightColors: {
            main: '#22c55e',
            container: '#dcfce7',
            onContainer: '#166534',
          },
          darkColors: {
            main: '#4ade80',
            container: '#15803d',
            onContainer: '#dcfce7',
          },
        },
        scheduled: {
          colorName: 'scheduled',
          lightColors: {
            main: '#3b82f6',
            container: '#dbeafe',
            onContainer: '#1e40af',
          },
          darkColors: {
            main: '#60a5fa',
            container: '#1d4ed8',
            onContainer: '#dbeafe',
          },
        },
        in_progress: {
          colorName: 'in_progress',
          lightColors: {
            main: '#a855f7',
            container: '#f3e8ff',
            onContainer: '#6b21a8',
          },
          darkColors: {
            main: '#c084fc',
            container: '#7e22ce',
            onContainer: '#f3e8ff',
          },
        },
        completed: {
          colorName: 'completed',
          lightColors: {
            main: '#16a34a',
            container: '#bbf7d0',
            onContainer: '#14532d',
          },
          darkColors: {
            main: '#22c55e',
            container: '#166534',
            onContainer: '#bbf7d0',
          },
        },
        failed: {
          colorName: 'failed',
          lightColors: {
            main: '#ef4444',
            container: '#fee2e2',
            onContainer: '#991b1b',
          },
          darkColors: {
            main: '#f87171',
            container: '#b91c1c',
            onContainer: '#fee2e2',
          },
        },
        conflict: {
          colorName: 'conflict',
          lightColors: {
            main: '#dc2626',
            container: '#fecaca',
            onContainer: '#7f1d1d',
          },
          darkColors: {
            main: '#f87171',
            container: '#991b1b',
            onContainer: '#fecaca',
          },
        },
        history_success: {
          colorName: 'history_success',
          lightColors: {
            main: '#6b7280',
            container: '#e5e7eb',
            onContainer: '#374151',
          },
          darkColors: {
            main: '#9ca3af',
            container: '#4b5563',
            onContainer: '#e5e7eb',
          },
        },
        history_failed: {
          colorName: 'history_failed',
          lightColors: {
            main: '#9ca3af',
            container: '#fecaca',
            onContainer: '#7f1d1d',
          },
          darkColors: {
            main: '#6b7280',
            container: '#7f1d1d',
            onContainer: '#fecaca',
          },
        },
        default: {
          colorName: 'default',
          lightColors: {
            main: '#6b7280',
            container: '#f3f4f6',
            onContainer: '#374151',
          },
          darkColors: {
            main: '#9ca3af',
            container: '#4b5563',
            onContainer: '#f3f4f6',
          },
        },
      },
      callbacks: {
        onEventClick: (calendarEvent: { id: string }) => {
          const eventId = calendarEvent.id;
          
          if (eventId.startsWith('intent-')) {
            const intentId = eventId.replace('intent-', '');
            const intent = intentsRef.current.find(i => i.refresh_intent_id === intentId);
            if (intent) {
              onEventClick(intent);
            }
          } else if (eventId.startsWith('history-')) {
            const historyId = eventId.replace('history-', '');
            const historyItem = historyRef.current.find(h => h.refresh_history_id === historyId);
            if (historyItem) {
              onEventClick(historyItem);
            }
          }
        },
        onDoubleClickDate: onDateClick
          ? (date: Temporal.PlainDate) => {
              const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}T09:00`;
              onDateClick(dateStr);
            }
          : undefined,
        onDoubleClickDateTime: onDateClick
          ? (dateTime: Temporal.ZonedDateTime) => {
              const dateStr = `${dateTime.year}-${String(dateTime.month).padStart(2, '0')}-${String(dateTime.day).padStart(2, '0')}`;
              const timeStr = `${String(dateTime.hour).padStart(2, '0')}:${String(dateTime.minute).padStart(2, '0')}`;
              onDateClick(`${dateStr}T${timeStr}`);
            }
          : undefined,
      },
      locale: 'en-US',
      firstDayOfWeek: 7,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, onEventClick, onDateClick, mode]);

  const calendar = useCalendarApp(calendarConfig);

  if (!isClient) {
    return (
      <div style={{ height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="bg-white dark:bg-gray-800 rounded-lg">
        Loading calendar...
      </div>
    );
  }

  return (
    <div style={{ height: 600 }} key={`refresh-calendar-${mode}`}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
