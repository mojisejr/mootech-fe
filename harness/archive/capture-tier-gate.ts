// harness/capture-tier-gate.ts — eyes on the Zone 4 gate. Renders each screen at each tier and writes PNGs
// so the cards can be held next to the Figma frames. Assertions say the right branch ran; only the picture
// says the branch looks like the design.
// Run: CAPTURE_HOST=http://localhost:3099 OUT=/tmp/shots npx tsx harness/capture-tier-gate.ts
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3099'
const OUT = process.env.OUT ?? '/tmp/tier-gate-shots'
const USER_ID = '5c7befb3-ebd3-4740-989e-fd6a1cca9662'

function readPasskey(): string {
  const line = fs
    .readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8')
    .split('\n')
    .find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no V2_PREVIEW_KEY')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

const body = (paid: boolean) => JSON.stringify({ user_id: USER_ID, name: 'มิลา', payment: { is_not_expired: paid } })

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const browser = await chromium.launch()
  for (const [tier, paid] of [['free', false], ['paid', true]] as [string, boolean][]) {
    for (const [name, route] of [['month', '/v2/calendar'], ['day', '/v2/calendar/2026-07-14']]) {
      const ctx = await browser.newContext({ viewport: { width: 393, height: 900 }, deviceScaleFactor: 2 })
      const host = new URL(HOST).hostname
      await ctx.addCookies([
        { name: 'v2_access', value: readPasskey(), domain: host, path: '/' },
        { name: 'cookie-mumate-id', value: USER_ID, domain: host, path: '/' },
        { name: 'cookie-mumate-name', value: 'มิลา', domain: host, path: '/' },
      ])
      const page = await ctx.newPage()
      await page.route('**/api/user**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: body(paid) }))
      // remove the float so the shot is byte-identical run to run (base transform stays, it lives outside
      // the keyframe) — pausing would freeze at whatever playhead the run happened to reach
      await page.emulateMedia({ reducedMotion: 'reduce' })
      await page.goto(HOST + route, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      const file = `${OUT}/${name}-${tier}.png`
      await page.screenshot({ path: file, fullPage: true })
      console.log(file)
      await ctx.close()
    }
  }
  await browser.close()
}

main()
