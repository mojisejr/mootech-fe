// MuMate v2 · external-calendar deep-links (เพิ่มปฏิทินภายนอก — Figma 375:11286).
//
// The reminder sheet's in-app "แจ้งเตือนในแอป Mumate" toggle drives the PWA push path (POST /api/v2/reminders).
// Google/Apple were REMOVED in #298 because neither had a backend — but neither NEEDS one: both consumer
// calendars ingest a client-built artefact, so these two destinations are pure client work here.
//   • Google  → a `calendar.google.com/render?action=TEMPLATE` pre-filled event URL (open in a new tab).
//   • Apple   → an RFC-5545 .ics VEVENT (Blob download; iOS/macOS opens it in Calendar).
// Both anchor to the yam START..END wall window and carry a 30-min-before alarm to match REMINDER_LEAD_MINUTES.
//
// Asia/Bangkok is a FIXED UTC+7 (no DST — see reminder-time.ts), so wall times are exact without a tz lib.
import { REMINDER_LEAD_MINUTES } from './reminder-time'

/** One calendar event = one selected ยาม on the day. */
export interface CalendarEvent {
  /** event title (ผู้ใช้พิมพ์โน้ต หรือ fallback = ชื่อยาม). */
  title: string
  /** longer text (ชื่อยาม + คำโปรย). */
  details: string
  /** "YYYY-MM-DD" — the yam START's Bangkok calendar day. */
  date: string
  /** "H:MM-H:MM" / "HH:MM-HH:MM" — the yam window. */
  window: string
}

/** "H:MM-H:MM" → { start:"HH:MM", end:"HH:MM" } (both padded), or null if malformed. Mirrors reminder-time. */
export function windowRange(window: string): { start: string; end: string } | null {
  const m = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/.exec(window.trim())
  if (!m) return null
  const [h1, m1, h2, m2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
  if (h1 > 23 || m1 > 59 || h2 > 23 || m2 > 59) return null
  const pad = (h: number, mm: number) => `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`
  return { start: pad(h1, m1), end: pad(h2, m2) }
}

/** "YYYY-MM-DD" + "HH:MM" → compact local stamp "YYYYMMDDTHHMMSS" (no zone suffix — carried by ctz/TZID). */
function localStamp(date: string, hhmm: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const [hh, mm] = hhmm.split(':')
  return `${date.replace(/-/g, '')}T${hh}${mm}00`
}

/** UTC "now" stamp with Z — for DTSTAMP (ICS requires a UTC timestamp). */
function utcStamp(now: Date): string {
  return now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * A Google Calendar "add event" URL, pre-filled with the yam window in Asia/Bangkok. Opening it lands the
 * user on Google's own event composer (they press Save) — no OAuth, no backend. Returns null if the window
 * can't be parsed (caller skips that yam).
 */
export function googleCalendarUrl(ev: CalendarEvent): string | null {
  const range = windowRange(ev.window)
  if (!range) return null
  const start = localStamp(ev.date, range.start)
  const end = localStamp(ev.date, range.end)
  if (!start || !end) return null
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: ev.title,
    dates: `${start}/${end}`,
    details: ev.details,
    ctz: 'Asia/Bangkok',
  })
  return `https://calendar.google.com/calendar/render?${params.toString()}`
}

/** RFC-5545 text escaping — backslash, comma, semicolon, and newline are the reserved ones. */
function icsEscape(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')
}

/**
 * Build a single .ics (VCALENDAR) for one or more yam events — Apple Calendar / any RFC-5545 client.
 * Each VEVENT carries a 30-min-before VALARM so the external calendar rings on the same lead as the app.
 * `now` is injectable for deterministic tests. Returns null if NO event has a parseable window.
 */
export function buildIcs(events: CalendarEvent[], now: Date = new Date()): string | null {
  const stamp = utcStamp(now)
  const vevents: string[] = []
  events.forEach((ev, i) => {
    const range = windowRange(ev.window)
    if (!range) return
    const start = localStamp(ev.date, range.start)
    const end = localStamp(ev.date, range.end)
    if (!start || !end) return
    const uid = `${ev.date.replace(/-/g, '')}-${i}-${Math.random().toString(36).slice(2, 8)}@mumate`
    vevents.push(
      [
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=Asia/Bangkok:${start}`,
        `DTEND;TZID=Asia/Bangkok:${end}`,
        `SUMMARY:${icsEscape(ev.title)}`,
        `DESCRIPTION:${icsEscape(ev.details)}`,
        'BEGIN:VALARM',
        `TRIGGER:-PT${REMINDER_LEAD_MINUTES}M`,
        'ACTION:DISPLAY',
        `DESCRIPTION:${icsEscape(ev.title)}`,
        'END:VALARM',
        'END:VEVENT',
      ].join('\r\n'),
    )
  })
  if (vevents.length === 0) return null
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MuMate//Calendar//TH', 'CALSCALE:GREGORIAN', ...vevents, 'END:VCALENDAR'].join('\r\n')
}

/**
 * Trigger a client-side .ics download (Apple Calendar path). Blob + object URL so iOS Safari opens it in
 * Calendar. Must be called inside a user gesture (the save tap). No-ops on the server / without a document.
 */
export function downloadIcs(ics: string, filename = 'mumate-reminder.ics'): void {
  if (typeof document === 'undefined') return
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // revoke after the click has had a chance to start the download
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
