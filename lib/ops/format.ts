// Shared display formatting for /ops. `toLocaleString('th-TH', ...)` defaults to the Buddhist
// calendar (พ.ศ., e.g. 2569 for 2026) — inconsistent with the Gregorian date labels elsewhere on
// this page (Business Metrics section header). Force Gregorian everywhere on this internal
// engineering dashboard so all dates read the same way.
export function formatBangkokDateTime(iso: string): string {
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: 'Asia/Bangkok',
    calendar: 'gregory',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
