/**
 * Server-side event calendar utilities.
 * Ported from utils/eventCalendar.ts for Node.js usage.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MONTH_ABBREV = {
  Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6,
  Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12,
};

const YEAR = 2026;

function parseDateDMON(dMon) {
  const parts = dMon.trim().split("-");
  if (parts.length !== 2) return null;
  const day = parseInt(parts[0], 10);
  const monthIdx = MONTH_ABBREV[parts[1]];
  if (isNaN(day) || !monthIdx || day < 1 || day > 31) return null;
  const date = new Date(YEAR, monthIdx - 1, day);
  if (date.getMonth() !== monthIdx - 1) return null;
  return date.toISOString().slice(0, 10);
}

export function parseCalendarCsv(csv) {
  const lines = csv.trim().split(/\r?\n/);
  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const match = line.match(/^([^,]+),([^,]+),(.*)$/);
    if (!match) continue;
    const [, dateStr, month, name] = match;
    const dateIso = parseDateDMON(dateStr);
    if (!dateIso) continue;
    result.push({ name: name?.trim() || "", dateIso, month: month?.trim() });
  }
  return result;
}

export function filterEventsNext90Days(events) {
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

export function loadCalendarCsv() {
  const csvPath = path.join(__dirname, "..", "event_calendar_2026.csv");
  return fs.readFileSync(csvPath, "utf-8");
}
