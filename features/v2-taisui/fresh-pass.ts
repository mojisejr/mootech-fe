// ปีชง 2570 — the page's form pass (the calculator nonce cookie) lives 10 minutes, but a visitor can stay on
// this long scroll page far longer before typing a birth. When the pass has run out, take a fresh one by
// loading the page again in the background (the page issues it), then send the same request once more.
export const PASS_REFRESH_PATH = '/taisui-2570'

export async function withFreshPass(
  send: () => Promise<Response>,
  refresh: () => Promise<unknown> = () => fetch(PASS_REFRESH_PATH, { credentials: 'same-origin', cache: 'no-store' }),
): Promise<Response> {
  const first = await send()
  if (first.status !== 403) return first
  const body = (await first.clone().json().catch(() => null)) as { error?: unknown } | null
  if (body?.error !== 'nonce') return first
  try { await refresh() } catch { return first }
  return send()
}
