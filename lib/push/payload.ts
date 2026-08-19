// MuMate v2 · push payload builder (goo · #288 phase 4). PURE — a reminder row → the notification
// JSON the service worker renders. sw.ts (#285) already reads exactly { title, body, url }:
//   - title/body carry the ยาม name + time (DoD "บอกชื่อยาม กับ เวลา")
//   - url is the deep-link the notificationclick handler opens (DoD "กด → เปิดหน้าวันนั้น")
// NO note field — that lives in #331 (ฟีมเคาะ 2026-08-19: เอา A ก่อน), not this ticket.

export interface ReminderNotice {
  date: string // reminderDate "YYYY-MM-DD" — the ยาม START's Bangkok day
  yamLabel: string
  window: string // "HH:MM-HH:MM" — display window of the ยาม
}

export interface PushPayload {
  title: string
  body: string
  url: string
}

export function buildReminderPayload(r: ReminderNotice): PushPayload {
  return {
    title: `⏰ ${r.yamLabel}`,
    body: `ยามมงคลจะเริ่มเวลา ${r.window}`,
    // Deep-link straight to that day's calendar page (pages/v2/calendar/[date].tsx). A relative path
    // resolves against the SW's own origin in openWindow() — no host to hardcode across env.
    url: `/v2/calendar/${r.date}`,
  }
}
