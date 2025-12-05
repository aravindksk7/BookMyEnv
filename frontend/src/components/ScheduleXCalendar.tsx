'use client';

// Import temporal polyfill before any Schedule-X imports
import 'temporal-polyfill/global';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useCalendarApp, ScheduleXCalendar } from '@schedule-x/react';
import {
  createViewMonthGrid,
  createViewWeek,
  createViewDay,
} from '@schedule-x/calendar';
import { createDragAndDropPlugin } from '@schedule-x/drag-and-drop';
import { createEventsServicePlugin } from '@schedule-x/events-service';
import '@schedule-x/theme-default/dist/index.css';

interface Booking {
  booking_id: string;
  booking_type: string;
  project_id: string;
  test_phase: string;
  title: string;
  description: string;
  start_datetime: string;
  end_datetime: string;
  booking_status: string;
  conflict_status: string;
  conflict_notes?: string;
  requested_by_name: string;
  approved_by_name?: string;
  owning_group_name?: string;
  resource_count?: number;
  created_at?: string;
  resources?: Array<{
    environment_id: string;
    instance_name: string;
    environment_name: string;
  }>;
}

interface BookingCalendarProps {
  bookings: Booking[];
  onEventClick: (booking: Booking) => void;
  onEventUpdate?: (bookingId: string, newStart: string, newEnd: string) => void;
  onDateClick?: (startDate: string, endDate: string) => void;
  canEdit?: boolean;
}

// Convert ISO datetime to Temporal.ZonedDateTime
const toZonedDateTime = (isoDate: string): Temporal.ZonedDateTime | null => {
  if (!isoDate) return null;
  try {
    // Parse ISO string to extract components
    const date = new Date(isoDate);
    const plainDateTime = Temporal.PlainDateTime.from({
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: 0,
    });
    // Convert to ZonedDateTime in browser's timezone
    return plainDateTime.toZonedDateTime(Temporal.Now.timeZoneId());
  } catch (e) {
    console.error('Error parsing date:', isoDate, e);
    return null;
  }
};

// Get calendar ID based on booking status for color coding
const getCalendarId = (booking: Booking): string => {
  if (booking.conflict_status !== 'None' && booking.conflict_status !== 'Resolved') {
    return 'conflict';
  }
  switch (booking.booking_status) {
    case 'Active':
      return 'active';
    case 'Approved':
      return 'approved';
    case 'Requested':
    case 'PendingApproval':
      return 'pending';
    case 'Completed':
      return 'completed';
    case 'Cancelled':
      return 'cancelled';
    default:
      return 'default';
  }
};

export default function BookingCalendar({
  bookings,
  onEventClick,
  onEventUpdate,
  onDateClick,
  canEdit = false,
}: BookingCalendarProps) {
  const [isClient, setIsClient] = useState(false);
  const eventsServiceRef = useRef(createEventsServicePlugin());

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Convert bookings to Schedule-X events
  const events = useMemo(() => {
    return bookings
      .filter(b => !['Completed', 'Cancelled'].includes(b.booking_status))
      .map(booking => {
        const start = toZonedDateTime(booking.start_datetime);
        const end = toZonedDateTime(booking.end_datetime);
        
        if (!start || !end) return null;
        
        return {
          id: booking.booking_id,
          title: booking.title || `${booking.test_phase} Booking`,
          start,
          end,
          calendarId: getCalendarId(booking),
          description: booking.description || '',
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
  }, [bookings]);

  // Update events when bookings/filters change
  useEffect(() => {
    if (isClient && eventsServiceRef.current) {
      eventsServiceRef.current.set(events);
    }
  }, [events, isClient]);

  // Create calendar configuration
  const calendarConfig = useMemo(() => {
    const plugins = canEdit 
      ? [createDragAndDropPlugin(), eventsServiceRef.current] 
      : [eventsServiceRef.current];
    
    return {
      views: [createViewMonthGrid(), createViewWeek(), createViewDay()] as [ReturnType<typeof createViewMonthGrid>, ...ReturnType<typeof createViewWeek>[]],
      plugins,
      defaultView: 'month-grid',
      events: events,
      calendars: {
        active: {
          colorName: 'active',
          lightColors: {
            main: '#4caf50',
            container: '#c8e6c9',
            onContainer: '#1b5e20',
          },
          darkColors: {
            main: '#81c784',
            container: '#2e7d32',
            onContainer: '#c8e6c9',
          },
        },
        approved: {
          colorName: 'approved',
          lightColors: {
            main: '#2196f3',
            container: '#bbdefb',
            onContainer: '#0d47a1',
          },
          darkColors: {
            main: '#64b5f6',
            container: '#1565c0',
            onContainer: '#bbdefb',
          },
        },
        pending: {
          colorName: 'pending',
          lightColors: {
            main: '#ff9800',
            container: '#ffe0b2',
            onContainer: '#e65100',
          },
          darkColors: {
            main: '#ffb74d',
            container: '#ef6c00',
            onContainer: '#ffe0b2',
          },
        },
        conflict: {
          colorName: 'conflict',
          lightColors: {
            main: '#f44336',
            container: '#ffcdd2',
            onContainer: '#b71c1c',
          },
          darkColors: {
            main: '#e57373',
            container: '#c62828',
            onContainer: '#ffcdd2',
          },
        },
        completed: {
          colorName: 'completed',
          lightColors: {
            main: '#9e9e9e',
            container: '#e0e0e0',
            onContainer: '#424242',
          },
          darkColors: {
            main: '#bdbdbd',
            container: '#616161',
            onContainer: '#e0e0e0',
          },
        },
        cancelled: {
          colorName: 'cancelled',
          lightColors: {
            main: '#9e9e9e',
            container: '#eeeeee',
            onContainer: '#616161',
          },
          darkColors: {
            main: '#757575',
            container: '#424242',
            onContainer: '#bdbdbd',
          },
        },
        default: {
          colorName: 'default',
          lightColors: {
            main: '#1976d2',
            container: '#e3f2fd',
            onContainer: '#0d47a1',
          },
          darkColors: {
            main: '#42a5f5',
            container: '#1565c0',
            onContainer: '#e3f2fd',
          },
        },
      },
      callbacks: {
        onEventClick: (calendarEvent: any) => {
          // Schedule-X may return id in different formats, extract the actual booking ID
          const eventId = String(calendarEvent.id).split(':')[0];
          // Find the original booking from our data
          const booking = bookings.find(b => b.booking_id === eventId);
          if (booking) {
            onEventClick(booking);
          }
        },
        onEventUpdate: canEdit && onEventUpdate
          ? (updatedEvent: any) => {
              // Convert Temporal ZonedDateTime back to ISO
              const start = updatedEvent.start as Temporal.ZonedDateTime;
              const end = updatedEvent.end as Temporal.ZonedDateTime;
              onEventUpdate(
                updatedEvent.id,
                start.toInstant().toString(),
                end.toInstant().toString()
              );
            }
          : undefined,
        onDoubleClickDate: canEdit && onDateClick
          ? (date: Temporal.PlainDate) => {
              // Create start at 9 AM and end at 5 PM on clicked date
              const dateStr = `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
              const startDateTime = `${dateStr}T09:00`;
              const endDateTime = `${dateStr}T17:00`;
              onDateClick(startDateTime, endDateTime);
            }
          : undefined,
        onDoubleClickDateTime: canEdit && onDateClick
          ? (dateTime: Temporal.ZonedDateTime) => {
              // Create a 2-hour booking from the clicked time
              const dateStr = `${dateTime.year}-${String(dateTime.month).padStart(2, '0')}-${String(dateTime.day).padStart(2, '0')}`;
              const startTime = `${String(dateTime.hour).padStart(2, '0')}:${String(dateTime.minute).padStart(2, '0')}`;
              const startDateTime = `${dateStr}T${startTime}`;
              
              // Calculate end time (2 hours later)
              const endHours = Math.min(dateTime.hour + 2, 23);
              const endTime = `${String(endHours).padStart(2, '0')}:${String(dateTime.minute).padStart(2, '0')}`;
              const endDateTime = `${dateStr}T${endTime}`;
              
              onDateClick(startDateTime, endDateTime);
            }
          : undefined,
      },
      locale: 'en-US',
      firstDayOfWeek: 7, // Sunday (1=Monday, 7=Sunday)
    };
  }, [events, bookings, onEventClick, onEventUpdate, canEdit]);

  const calendar = useCalendarApp(calendarConfig);

  // Don't render on server
  if (!isClient) {
    return (
      <div style={{ height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        Loading calendar...
      </div>
    );
  }

  return (
    <div style={{ height: 600 }}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
