// Shared display formatting for /ops. `toLocaleString('th-TH', ...)` defaults to the Buddhist
// calendar (พ.ศ., e.g. 2569 for 2026) — inconsistent with the Gregorian date labels elsewhere on
// this page. ISO-like `YYYY-MM-DD HH:mm` per design review (มุน): sorts correctly and matches the
// section labels / logs, instead of mixing DD/MM with ISO on the same page.
function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function formatBangkokDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(iso))
  const p: Record<string, string> = {}
  for (const part of parts) p[part.type] = part.value
  return `${p.year}-${p.month}-${p.day} ${pad(Number(p.hour))}:${p.minute}`
}
