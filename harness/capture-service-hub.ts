// harness/capture-service-hub.ts — eye-proof for the service hub. Not an assertion: this exists so the
// change can be LOOKED at, at the two widths that matter (393 = design, 320 = the width every gutter bug
// this project has shipped showed up at first).
import { chromium } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'

const HOST = process.env.CAPTURE_HOST ?? 'http://localhost:3101'
const OUT = process.env.OUT_DIR ?? '/tmp'

function readPasskey(): string {
  const line = fs.readFileSync(path.resolve(process.cwd(), 'testenv/env/fe.env'), 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
  if (!line) throw new Error('no key')
  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
}

async function main() {
  const browser = await chromium.launch()
  for (const w of [393, 320]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2 })
    await ctx.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
    await ctx.addCookies([
      { name: 'cookie-mumate-id', value: 'capture', domain: new URL(HOST).hostname, path: '/' },
      { name: 'cookie-mumate-name', value: 'มุน', domain: new URL(HOST).hostname, path: '/' },
    ])
    const page = await ctx.newPage()
    await page.goto(`${HOST}/v2/service`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('a[data-testid^="service-card-"]')
    await page.evaluate(async () => {
      window.scrollTo(0, document.body.scrollHeight)
      await new Promise((r) => setTimeout(r, 700))
      window.scrollTo(0, 0)
      await Promise.all(Array.from(document.images).map((im) => (im.complete ? Promise.resolve() : im.decode().catch(() => undefined))))
    })
    await page.waitForTimeout(900)
    await page.screenshot({ path: `${OUT}/hub-${w}-top.png` })
    await page.evaluate(() => window.scrollTo(0, 900))
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${OUT}/hub-${w}-mid.png` })
    console.log(`captured @${w}`)
    await ctx.close()
  }
  await browser.close()
}
main()
