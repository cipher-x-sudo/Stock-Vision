/**
 * Parse event_calendar_2026.csv and filter to events in the next 90 days.
 * CSV format: Date,Month,Event Name with Date as D-Mon (e.g. 1-Jan, 14-Feb).
 */

const MONTH_ABBREV: Record<string, number> = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12
};

const YEAR = 2026;

export interface CalendarEvent {
  name: string;
  dateIso: string;
  month?: string;
}

/**
 * Parse D-Mon format to ISO date string (YYYY-MM-DD) for year 2026.
 * Invalid dates (e.g. 31-Feb) are clamped.
 */
function parseDateDMON(dMon: string): string | null {
  const parts = dMon.trim().split('-');
  if (parts.length !== 2) return null;
  const day = parseInt(parts[0], 10);
  const monthIdx = MONTH_ABBREV[parts[1]];
  if (isNaN(day) || !monthIdx || day < 1 || day > 31) return null;
  const date = new Date(YEAR, monthIdx - 1, day);
  if (date.getMonth() !== monthIdx - 1) return null; // invalid date
  return date.toISOString().slice(0, 10);
}

/**
 * Parse CSV content (header + rows) into CalendarEvent[].
 */
export function parseCalendarCsv(csv: string): CalendarEvent[] {
  const lines = csv.trim().split(/\r?\n/);
  const result: CalendarEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = line.match(/^([^,]+),([^,]+),(.*)$/);
    if (!match) continue;
    const [, dateStr, month, name] = match;
    const dateIso = parseDateDMON(dateStr);
    if (!dateIso) continue;
    result.push({ name: name?.trim() || '', dateIso, month: month?.trim() });
  }
  return result;
}

/**
 * Filter events to those between today and today+90 days (inclusive).
 */
export function filterEventsNext90Days(events: CalendarEvent[]): CalendarEvent[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setDate(end.getDate() + 90);
  end.setHours(23, 59, 59, 999);
  return events.filter((e) => {
    const d = new Date(e.dateIso);
    return d >= today && d <= end;
  });
}
