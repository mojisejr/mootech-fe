// harness/verify-characters.ts — characters/ asset gate (webgang · Phase 2, มุน)
//
// The bug this exists for: every character render point has `onError → HERO_FALLBACK` (mascot/01.webp).
// A wrong path therefore paints A DIFFERENT, VALID PICTURE — no broken image, no console error. So
// "หน้าไม่พัง" and "ไม่มี error" are NOT evidence. The only ground truth is: **is the picture that
// painted the one that was asked for?** This harness answers that three ways per slot:
//
//   1. currentSrc  — what the DOM ended up pointing at (catches the onError swap directly)
//   2. network     — the status the browser actually got for that URL (catches 404/500, not just !=200)
//   3. pixels      — a signature of the painted element box (catches "same URL, wrong/blank bytes"
//                    and proves the 60 are 60 DISTINCT pictures, not 60 copies of the fallback)
//
// Modes
//   --mode measure                 paint size of every character slot @393 (CSS px + device px)
//   --mode sweep [--ext webp]      walk all 60 characters through the slots that take a URL
//   --mode fixed                   the hardcoded slots (zone3 x9) — these take no URL, so one pass
//
// Negative control is NOT optional and NOT a flag: every run first drives a path that CANNOT exist
// (__nope__) and requires all three probes to trip. If the control does not trip, the run aborts and
// reports nothing — a probe that never says "bad" cannot be quoted when it says "good".
//
//   npx tsx harness/verify-characters.ts --mode measure --host http://localhost:3007
//   npx tsx harness/verify-characters.ts --mode sweep --ext png --host http://localhost:3007
//
// Reads the gate passkey from .env.local / .env at runtime (V2_PREVIEW_KEY) — never printed, never committed.
import { chromium, type Page, type Browser } from 'playwright'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

const HOST = arg('host', process.env.CAPTURE_HOST ?? 'http://localhost:3007')!
const EXT = arg('ext', 'png')!
const MODE = arg('mode', 'measure')!
const OUT = arg('out', 'harness/captures/characters')!
const VIEWPORT = Number(arg('viewport', '393'))
const DSF = Number(arg('dsf', '2'))
const CROP_LABEL = arg('crops') // --crops <label> → write one PNG per slot: <label>__<slot>-<i>.png (before/after proof)
let SAVE_CROPS: string | undefined // set only for the real pass — the negative control must not overwrite the proof
const CHAR_DIR = '/images/v2/characters'
const HERO_FALLBACK = '/images/v2/mascot/01.webp' // V2HomeScreen:63 — the silent substitute

function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}

// The slots that actually paint a character. Keyed by a STABLE hook (data-testid or the z3-* animation
// class), never by nth-child — a slot that stops matching must fail loudly, not silently measure nothing.
const SLOTS = [
  { key: 'element-line', sel: 'span.h-8.w-7 img', driven: true }, // V2HomeScreen:171 · sizes=28px
  { key: 'manifest', sel: '[data-testid="manifest-mascot"] img', driven: true }, // V2HomeScreen:276 · Zone 2
  { key: 'zone3-love-r', sel: 'img.z3-rock-r', driven: false }, // V2HomeScreen:308 · 01_ชวด-ไฟ
  { key: 'zone3-love-l', sel: 'img.z3-rock-l', driven: false }, // V2HomeScreen:310 · 01_ชวด-ไม้
  { key: 'zone3-huddle', sel: 'img.z3-pop', driven: false }, // V2HomeScreen:317 · COLLEAGUE_MASCOTS x7
] as const

function readPasskey(): string {
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(process.cwd(), f)
    if (!fs.existsSync(p)) continue
    const line = fs.readFileSync(p, 'utf-8').split('\n').find((l) => l.trim().startsWith('V2_PREVIEW_KEY='))
    if (line) return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')
  }
  throw new Error('V2_PREVIEW_KEY not found in .env.local/.env — copy it into this worktree (per-file, never cp -R)')
}

// The 60 are the source of truth for "what must work" — read them off disk, never a hardcoded list that
// can drift. Sorted so the report is diffable run to run.
function readCharacterNames(dir: string): string[] {
  const abs = path.resolve(process.cwd(), 'public' + CHAR_DIR)
  const src = fs.existsSync(abs) ? abs : path.resolve(process.cwd(), 'assets-src/characters')
  if (!fs.existsSync(src)) throw new Error(`no characters dir found (looked in public${CHAR_DIR} and assets-src/characters)`)
  return fs
    .readdirSync(src)
    .filter((f) => /\.(png|webp)$/i.test(f))
    .map((f) => f.replace(/\.(png|webp)$/i, ''))
    .sort()
}

async function gate(page: Page) {
  const res = await page.request.post(`${HOST}/api/v2/login`, { form: { passkey: readPasskey() }, maxRedirects: 0 })
  const loc = res.headers()['location'] ?? ''
  if (res.status() !== 303 || loc.includes('gate_error')) throw new Error(`gate rejected (${res.status()} → ${loc}) — is V2_PREVIEW_KEY the one this server booted with?`)
}

type Probe = {
  slot: string
  index: number
  requested: string | null
  currentSrc: string // decoded, /_next/image unwrapped
  isFallback: boolean
  natural: [number, number]
  box: { w: number; h: number } // CSS px
  boxAbs: { x: number; y: number } // page-absolute origin — crops key off this, never a guessed coordinate
  sig: string // pixel signature of the painted box
}

// /_next/image?url=%2Fimages%2Fv2%2Fcharacters%2Fx.webp&w=… → /images/v2/characters/x.webp
function unwrap(src: string): string {
  try {
    const u = new URL(src, HOST)
    const inner = u.searchParams.get('url')
    return inner ? decodeURIComponent(inner) : decodeURIComponent(u.pathname)
  } catch {
    return src
  }
}

async function probe(page: Page, requested: string | null): Promise<Probe[]> {
  const raw = await page.evaluate(
    ({ slots, fallback }) => {
      const out: { slot: string; index: number; currentSrc: string; nw: number; nh: number; w: number; h: number; x: number; y: number }[] = []
      for (const s of slots) {
        const els = Array.from(document.querySelectorAll<HTMLImageElement>(s.sel))
        els.forEach((el, i) => {
          const r = el.getBoundingClientRect()
          // PAGE-absolute, not viewport-relative: most of these slots sit below the fold, and a viewport
          // clip there is "empty or outside the image" — the crop must be taken against the full page.
          out.push({ slot: s.key, index: i, currentSrc: el.currentSrc || el.src, nw: el.naturalWidth, nh: el.naturalHeight, w: r.width, h: r.height, x: r.x + window.scrollX, y: r.y + window.scrollY })
        })
      }
      return { out, fallback }
    },
    { slots: SLOTS.map((s) => ({ key: s.key, sel: s.sel })), fallback: HERO_FALLBACK },
  )

  const probes: Probe[] = []
  for (const r of raw.out) {
    // pixel signature: screenshot the element's own box (device px) and hash it. Two different characters
    // MUST hash differently; a slot silently swapped to the hero hashes the same as the hero.
    let sig = 'no-box'
    if (r.w > 0 && r.h > 0) {
      const buf = await page.screenshot({ fullPage: true, clip: { x: r.x, y: r.y, width: r.w, height: r.h } })
      sig = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
      // The crop comes from the element's OWN box, never from guessed image coordinates — guessing cost
      // two rounds in Phase 1 and the bbox was already in hand both times.
      if (SAVE_CROPS) fs.writeFileSync(path.resolve(process.cwd(), OUT, `${SAVE_CROPS}__${r.slot}-${r.index}.png`), buf)
    }
    const cur = unwrap(r.currentSrc)
    probes.push({ slot: r.slot, index: r.index, requested, currentSrc: cur, isFallback: cur === HERO_FALLBACK, natural: [r.nw, r.nh], box: { w: r.w, h: r.h }, boxAbs: { x: r.x, y: r.y }, sig })
  }
  return probes
}

// One page load with the network watched. Returns the probes + every response that touched a character
// path (status >= 400 is a hard fail — "!= 200" would flag 304 as broken, ✱ Phase-1 lesson).
async function load(page: Page, url: string, requested: string | null) {
  const bad: { url: string; status: number }[] = []
  const seen: { url: string; status: number }[] = []
  const onResponse = (res: { url(): string; status(): number }) => {
    const u = unwrap(res.url())
    if (!u.includes(CHAR_DIR) && !u.includes('/images/v2/mascot/')) return
    seen.push({ url: u, status: res.status() })
    if (res.status() >= 400) bad.push({ url: u, status: res.status() })
  }
  page.on('response', onResponse)
  await page.goto(url, { waitUntil: 'networkidle' })
  // every <img> settled (Next/Image swaps src on error → wait for the SETTLED state, not first paint)
  await page.waitForFunction(() => Array.from(document.querySelectorAll('img')).every((i) => i.complete), null, { timeout: 15000 })
  await page.waitForTimeout(150) // let an onError setState re-render land
  const probes = await probe(page, requested)
  page.off('response', onResponse)
  return { probes, bad, seen }
}

const previewUrl = (mascot?: string) => `${HOST}/v2/home-preview?state=good&el=full${mascot ? `&mascot=${encodeURIComponent(mascot)}` : ''}`

// ── negative control ────────────────────────────────────────────────────────────────────────────────
// Drive a path that cannot exist. ALL THREE probes must trip. If any stays quiet, this instrument is
// blind on that axis and its zeros are worthless — abort rather than publish a number it cannot back.
async function negativeControl(page: Page): Promise<{ ok: boolean; lines: string[]; fallbackSig: string }> {
  const nope = `${CHAR_DIR}/__nope__.${EXT}`
  const { probes, bad } = await load(page, previewUrl(nope), nope)
  const driven = probes.filter((p) => SLOTS.find((s) => s.key === p.slot)?.driven)
  const lines: string[] = []
  const swapped = driven.filter((p) => p.isFallback)
  const net = bad.filter((b) => b.url.includes('__nope__'))
  const fallbackSig = driven.find((p) => p.isFallback && p.slot === 'manifest')?.sig ?? ''
  lines.push(`  currentSrc → fallback : ${swapped.length}/${driven.length} slots  ${swapped.length === driven.length ? '✓ trips' : '✗ BLIND'}`)
  lines.push(`  network   → >=400     : ${net.length} hit(s) ${net.map((n) => n.status).join(',')}  ${net.length > 0 ? '✓ trips' : '✗ BLIND'}`)
  lines.push(`  pixels    → fallback sig captured: ${fallbackSig || '(none)'}  ${fallbackSig ? '✓' : '✗ BLIND'}`)
  return { ok: swapped.length === driven.length && net.length > 0 && !!fallbackSig, lines, fallbackSig }
}

async function withPage<T>(fn: (page: Page, browser: Browser) => Promise<T>): Promise<T> {
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: VIEWPORT, height: 900 }, deviceScaleFactor: DSF, reducedMotion: 'reduce' })
  const page = await ctx.newPage()
  try {
    await gate(page)
    return await fn(page, browser)
  } finally {
    await browser.close()
  }
}

async function main() {
  fs.mkdirSync(path.resolve(process.cwd(), OUT), { recursive: true })
  const names = readCharacterNames(EXT)
  console.log(`# verify-characters · mode=${MODE} ext=${EXT} host=${HOST} viewport=${VIEWPORT} dsf=${DSF}`)
  console.log(`# characters on disk: ${names.length}`)
  // A sweep over an empty set prints every ✓ it has and means nothing. Coverage is part of the result,
  // so it fails here rather than reading as a pass downstream.
  if (names.length === 0) throw new Error('0 characters found — nothing would be swept, and "0 failures" over 0 items is not a pass')
  if (names.length !== 60) console.log(`⚠️  expected 60 characters (12 นักษัตร × 5 ธาตุ) — found ${names.length}`)

  await withPage(async (page) => {
    console.log('\n## negative control (must trip before any number below counts)')
    const nc = await negativeControl(page)
    nc.lines.forEach((l) => console.log(l))
    if (!nc.ok) {
      console.log('\n✗ ABORT — the instrument did not trip on a path that cannot exist. No results reported.')
      process.exitCode = 2
      return
    }
    console.log('  → instrument has teeth ✓\n')

    if (MODE === 'measure') {
      SAVE_CROPS = CROP_LABEL
      const { probes, bad } = await load(page, previewUrl(`${CHAR_DIR}/${names[0]}.${EXT}`), `${CHAR_DIR}/${names[0]}.${EXT}`)
      console.log('## paint size @' + VIEWPORT + ' (dsf ' + DSF + ')')
      console.log('| slot | # | CSS w×h | device w×h | natural | src |')
      console.log('|---|---|---|---|---|---|')
      for (const p of probes) {
        console.log(
          `| ${p.slot} | ${p.index} | ${p.box.w.toFixed(1)}×${p.box.h.toFixed(1)} | **${Math.ceil(p.box.w * DSF)}×${Math.ceil(p.box.h * DSF)}** | ${p.natural[0]}×${p.natural[1]} | ${p.currentSrc.split('/').pop()} |`,
        )
      }
      const maxDev = Math.max(...probes.map((p) => Math.max(p.box.w, p.box.h) * DSF))
      console.log(`\n**largest painted edge = ${Math.ceil(maxDev)} device px** → MAX_EDGE 800 ${maxDev <= 800 ? 'พอ ✓' : '❌ ไม่พอ — บอกบอง'}`)
      if (bad.length) console.log(`\n⚠️ network >=400 during measure: ${JSON.stringify(bad)}`)
      return
    }

    if (MODE === 'sweep') {
      const rows: { name: string; ok: boolean; why: string; sigs: string }[] = []
      const sigIndex = new Map<string, string[]>() // manifest signature → names (collision = same picture twice)
      for (const name of names) {
        const p = `${CHAR_DIR}/${name}.${EXT}`
        const { probes, bad } = await load(page, previewUrl(p), p)
        const driven = probes.filter((x) => SLOTS.find((s) => s.key === x.slot)?.driven)
        const wrong = driven.filter((x) => x.currentSrc !== p)
        const net = bad.filter((b) => b.url === p)
        const manifest = driven.find((x) => x.slot === 'manifest')
        const sig = manifest?.sig ?? 'none'
        // --crops in sweep mode writes ONE crop per character (the manifest slot — biggest, most detail),
        // named by the character. Run it on both sides and `--mode diff` compares the 60 by NAME. That is
        // the only check that catches two files whose CONTENTS were swapped between names: every
        // same-format check stays green, because each file is individually fine and every signature is
        // still distinct. The picture for a given name is the thing that must not change.
        if (CROP_LABEL && manifest) {
          const crop = await page.screenshot({ fullPage: true, clip: { x: manifest.boxAbs.x, y: manifest.boxAbs.y, width: manifest.box.w, height: manifest.box.h } })
          fs.writeFileSync(path.resolve(process.cwd(), OUT, `char__${name}.png`), crop)
        }
        sigIndex.set(sig, [...(sigIndex.get(sig) ?? []), name])
        const why = [
          wrong.length ? `src≠asked (${wrong.map((w) => `${w.slot}→${w.currentSrc.split('/').pop()}`).join(',')})` : '',
          net.length ? `net ${net.map((n) => n.status).join(',')}` : '',
          sig === nc.fallbackSig ? 'pixels = hero fallback' : '',
          driven.length !== 2 ? `slots ${driven.length}/2 present` : '',
        ]
          .filter(Boolean)
          .join(' · ')
        rows.push({ name, ok: !why, why, sigs: sig })
        process.stdout.write(why ? 'x' : '.')
      }
      console.log('\n')
      const dupes = [...sigIndex.entries()].filter(([, ns]) => ns.length > 1)
      const failed = rows.filter((r) => !r.ok)
      console.log(`## sweep ${names.length} characters (.${EXT})`)
      console.log(`- ผ่าน: **${rows.length - failed.length}/${rows.length}**`)
      console.log(`- ภาพซ้ำกัน (สองตัวขึ้นภาพเดียวกัน = ตัวหนึ่งถูกสวม): **${dupes.length}** ${dupes.length ? JSON.stringify(dupes) : '✓'}`)
      if (failed.length) {
        console.log('\n| character | ทำไมตก |')
        console.log('|---|---|')
        failed.forEach((f) => console.log(`| ${f.name} | ${f.why} |`))
        process.exitCode = 1
      }
      fs.writeFileSync(path.resolve(process.cwd(), OUT, `sweep-${EXT}.json`), JSON.stringify({ host: HOST, ext: EXT, viewport: VIEWPORT, dsf: DSF, rows, dupes }, null, 2))
      console.log(`\n→ ${OUT}/sweep-${EXT}.json`)
      return
    }

    if (MODE === 'fixed') {
      SAVE_CROPS = CROP_LABEL
      const { probes, bad, seen } = await load(page, previewUrl(), null)
      const fixed = probes.filter((p) => !SLOTS.find((s) => s.key === p.slot)?.driven)
      console.log(`## fixed zone-3 slots (${fixed.length} รูป — ต้องได้ 9)`)
      console.log('| slot | # | src | fallback? | CSS w×h | sig |')
      console.log('|---|---|---|---|---|---|')
      fixed.forEach((p) => console.log(`| ${p.slot} | ${p.index} | ${p.currentSrc.split('/').pop()} | ${p.isFallback ? '❌ ใช่' : 'ไม่'} | ${p.box.w.toFixed(0)}×${p.box.h.toFixed(0)} | ${p.sig} |`))
      const distinct = new Set(fixed.map((p) => p.sig)).size
      console.log(`\n- ภาพต่างกันจริง: **${distinct}/${fixed.length}**  ${distinct === fixed.length ? '✓' : '❌ มีตัวซ้ำ = ถูกสวมด้วย fallback'}`)
      console.log(`- สวมเป็น hero: **${fixed.filter((p) => p.isFallback).length}** ${fixed.some((p) => p.isFallback) ? '❌' : '✓'}`)
      if (bad.length) console.log(`- network >=400: ${JSON.stringify(bad)} ❌`)
      else console.log(`- network >=400: 0 ✓ (character requests seen: ${seen.filter((s) => s.url.includes(CHAR_DIR)).length})`)
      if (fixed.length !== 9 || distinct !== fixed.length || fixed.some((p) => p.isFallback) || bad.length) process.exitCode = 1
      return
    }

    if (MODE === 'resolver') {
      // ตู๋'s catch: ?mascot=<path> only proves "the file I typed exists". It says NOTHING about whether
      // buildMascotPaths points at a real file — a different question, and the one users actually ride.
      // /design-system MascotDemo runs the REAL builder off two dropdowns and has NO onError anywhere in
      // the file (verified: 0 occurrences), so a wrong path there is a genuinely broken image, not a
      // silent hero swap. 12 นักษัตร × 5 ธาตุ = the whole resolver surface.
      const url = `${HOST}/design-system`
      const CHAR_IMG = 'img[alt^="ตัวการ์ตูน"]'
      await page.goto(url, { waitUntil: 'networkidle' })
      // ⚠️ `select` is NOT unique on this page and neither is aria-label "ธาตุประจำวันเกิด" — the Dropdown
      // SHOWCASE section carries its own copy. Anchoring on .first()/.nth(1) grabbed the showcase pair and
      // produced "5 × 0 = 0 combos ✓ ผ่าน 0/0" — a green report from having tested nothing. Anchor on the
      // one aria-label that IS unique, take the element select that follows it, and refuse to run unless
      // the shape is exactly 12 × 5.
      const animalSel = page.locator('select[aria-label="นักษัตร (ปีเกิด)"]')
      if ((await animalSel.count()) !== 1) throw new Error(`expected exactly 1 นักษัตร select, found ${await animalSel.count()}`)
      const elementSel = animalSel.locator('xpath=following::select[1]')
      const animals = await animalSel.locator('option:not([hidden])').allTextContents()
      const elements = await elementSel.locator('option:not([hidden])').allTextContents()
      if (animals.length * elements.length !== 60) throw new Error(`resolver surface must be 12 นักษัตร × 5 ธาตุ = 60 — got ${animals.length} × ${elements.length}. A sweep of the wrong controls reports a pass it never earned.`)

      // negative control for THIS instrument: force every character byte to 404 and require all three
      // probes to trip. A resolver check that stays green when the file is missing is decoration.
      await page.route('**/*', (route) => (unwrap(route.request().url()).includes(CHAR_DIR) ? route.fulfill({ status: 404, body: '' }) : route.continue()))
      await page.reload({ waitUntil: 'networkidle' })
      await page.waitForTimeout(300)
      await page.locator(CHAR_IMG).first().scrollIntoViewIfNeeded() // lazy: must be in view to have tried at all
      await page.waitForTimeout(500)
      const ctl = await page.locator(CHAR_IMG).first().evaluate((el: HTMLImageElement) => ({ nw: el.naturalWidth, src: el.currentSrc || el.src, tried: el.complete }))
      await page.unroute('**/*')
      console.log('## negative control · resolver mode (ทุกไบต์ของ characters ถูกบังคับ 404)')
      // nw===0 alone is ambiguous — a lazy image that never loaded also reads 0. The control only counts
      // when the browser FINISHED trying (complete) and still got nothing.
      const tripped = ctl.nw === 0 && ctl.tried
      console.log(`  naturalWidth → 0 : ${ctl.nw} (พยายามโหลดจริง: ${ctl.tried})  ${tripped ? '✓ trips' : '✗ BLIND'}`)
      if (!tripped) {
        console.log('\n✗ ABORT — instrument blind on the resolver page.')
        process.exitCode = 2
        return
      }
      console.log('  → instrument has teeth ✓\n')
      await page.reload({ waitUntil: 'networkidle' })

      const bad: { url: string; status: number }[] = []
      page.on('response', (res) => {
        const u = unwrap(res.url())
        if (u.includes(CHAR_DIR) && res.status() >= 400) bad.push({ url: u, status: res.status() })
      })

      const sigIndex = new Map<string, string[]>()
      const fails: string[] = []
      let n = 0
      // MascotDemo sits far below the fold and next/image lazy-loads it: unscrolled, the image never even
      // requests — naturalWidth 0, complete false, and no error anywhere. "ไม่มี error" there means
      // "never tried", not "fine". Bring it into view before anything is measured.
      await page.locator(CHAR_IMG).first().scrollIntoViewIfNeeded()
      await page.waitForFunction(() => { const el = document.querySelector<HTMLImageElement>('img[alt^="ตัวการ์ตูน"]'); return !!el && el.complete }, null, { timeout: 15000 })
      let prevSrc = await page.locator(CHAR_IMG).first().evaluate((el: HTMLImageElement) => el.currentSrc || el.src)
      for (const a of animals) {
        for (const e of elements) {
          await animalSel.selectOption({ label: a })
          await elementSel.selectOption({ label: e })
          // The resolver's own answer for this combo, straight off the page (it re-renders with the state).
          const declared = (await page.getByText(/^filename:/).first().textContent())?.replace(/^filename:\s*/, '').trim() ?? ''
          // Settle on a signal INDEPENDENT of what we're about to assert: "the src is no longer the previous
          // combo's, and the image finished". Waiting for the src to equal `declared` would make the
          // equality check true by construction — the check would pass without ever being able to fail.
          // (A stuck src also times out here, which is itself the right answer: two combos, one picture.)
          await page.waitForFunction(
            (prev) => {
              const el = document.querySelector<HTMLImageElement>('img[alt^="ตัวการ์ตูน"]')
              return !!el && el.complete && (el.currentSrc || el.src) !== prev
            },
            prevSrc,
            { timeout: 15000 },
          )
          const got = await page.locator(CHAR_IMG).first().evaluate((el: HTMLImageElement) => {
            const r = el.getBoundingClientRect()
            return { nw: el.naturalWidth, src: el.currentSrc || el.src, x: r.x + window.scrollX, y: r.y + window.scrollY, w: r.width, h: r.height }
          })
          prevSrc = got.src
          const src = unwrap(got.src)
          const expected = `${CHAR_DIR}/${declared}.${EXT}`
          const buf = got.w > 0 && got.h > 0 ? await page.screenshot({ fullPage: true, clip: { x: got.x, y: got.y, width: got.w, height: got.h } }) : Buffer.from('')
          const sig = crypto.createHash('sha256').update(buf).digest('hex').slice(0, 16)
          sigIndex.set(sig, [...(sigIndex.get(sig) ?? []), `${a}-${e}`])
          const why = [got.nw === 0 ? 'naturalWidth=0 (รูปแตกจริง)' : '', src !== expected ? `src=${src} ≠ resolver=${expected}` : '', bad.find((b) => b.url === src) ? '404' : ''].filter(Boolean).join(' · ')
          if (why) fails.push(`| ${a} × ${e} | ${why} |`)
          n++
          process.stdout.write(why ? 'x' : '.')
        }
      }
      console.log('\n')
      const dupes = [...sigIndex.entries()].filter(([, v]) => v.length > 1)
      console.log(`## resolver sweep · ${animals.length} นักษัตร × ${elements.length} ธาตุ = ${n} (ผ่าน buildMascotPaths จริง)`)
      console.log(`- ผ่าน: **${n - fails.length}/${n}**`)
      console.log(`- ภาพซ้ำกัน: **${dupes.length}** ${dupes.length ? JSON.stringify(dupes) : '✓'}`)
      console.log(`- network >=400 บน characters: **${bad.length}** ${bad.length ? '❌ ' + JSON.stringify(bad.slice(0, 5)) : '✓'}`)
      if (fails.length) {
        console.log('\n| combo | ทำไมตก |\n|---|---|')
        fails.forEach((f) => console.log(f))
        process.exitCode = 1
      }
      return
    }

    throw new Error(`unknown --mode ${MODE}`)
  })
}

// --mode diff: one image is an opinion, two are a measurement. Compares the per-slot crops written by
// `--crops before` / `--crops after`. Codec change alone moves a few pixels; a slot that swapped to a
// different picture moves a LOT — the number is the point, not "looks the same".
async function diffMode() {
  const { default: pixelmatch } = await import('pixelmatch')
  const { PNG } = await import('pngjs')
  const beforeDir = path.resolve(process.cwd(), arg('before', 'harness/captures/p2-before')!)
  const afterDir = path.resolve(process.cwd(), arg('after', 'harness/captures/p2-after')!)
  // two shapes of pair: per-slot (before__x ↔ after__x) and per-character (char__<name> ↔ char__<name>)
  const files = fs.readdirSync(beforeDir).filter((f) => f.endsWith('.png') && (f.startsWith('before__') || f.startsWith('char__')))
  if (!files.length) throw new Error(`no before__*.png / char__*.png crops in ${beforeDir} — nothing to compare (an empty diff is not a clean diff)`)
  console.log(`# pixel diff · ${files.length} slots · ${beforeDir} → ${afterDir}`)
  console.log('| slot | ขนาด | px ต่าง | % | อ่านว่า |')
  console.log('|---|---|---|---|---|')
  let worst = 0
  for (const f of files) {
    const aPath = path.join(afterDir, f.startsWith('before__') ? f.replace('before__', 'after__') : f)
    if (!fs.existsSync(aPath)) {
      console.log(`| ${f} | — | — | — | ❌ ไม่มีคู่หลัง |`)
      process.exitCode = 1
      continue
    }
    const a = PNG.sync.read(fs.readFileSync(path.join(beforeDir, f)))
    const b = PNG.sync.read(fs.readFileSync(aPath))
    if (a.width !== b.width || a.height !== b.height) {
      console.log(`| ${f} | ${a.width}×${a.height} → ${b.width}×${b.height} | — | — | ❌ กล่องเปลี่ยนขนาด = เลย์เอาต์ขยับ |`)
      process.exitCode = 1
      continue
    }
    const n = pixelmatch(a.data, b.data, null, a.width, a.height, { threshold: 0.1 })
    const pct = (n / (a.width * a.height)) * 100
    worst = Math.max(worst, pct)
    const verdict = pct === 0 ? 'เหมือนกันทุกพิกเซล' : pct < 5 ? 'ภาพเดิม ต่างระดับ codec' : '⚠️ ต่างเยอะ — ต้องเปิดดูด้วยตา'
    console.log(`| ${f.replace('before__', '').replace('.png', '')} | ${a.width}×${a.height} | ${n} | ${pct.toFixed(2)}% | ${verdict} |`)
  }
  console.log(`\n- ต่างมากที่สุด: **${worst.toFixed(2)}%** ${worst < 5 ? '✓ ไม่มีสล็อตไหนเปลี่ยนเป็นภาพอื่น' : '⚠️'}`)
}

// diff needs no browser and no dev server — it reads two folders of crops
;(MODE === 'diff' ? diffMode() : main()).catch((e) => {
  console.error('✗', e.message)
  process.exit(2)
})
