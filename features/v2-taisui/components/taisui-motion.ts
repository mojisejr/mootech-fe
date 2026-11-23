// ปีชง 2570 — the scroll stage, guidance and scenes of preview D (design/PREVIEW-D.md, MOTION-KIT.md),
// driven by a real reading. One pinned stage; scroll progress p (0..1) drives every layer through
// seg(p, a, b). Only transform, opacity and one CSS variable (--n, the night amount) are written per frame.
//
// Member data reaches the DOM only through textContent, attributes and createElement — never as HTML.
import { celebrate } from './taisui-celebrate'
import { DEEPER_PACKAGES, deeperHref } from '../deeper'
import type { TaisuiReading } from '@/lib/taisui/types'
import { AREA, AT_TH, DAY_MASTER, MONTH_TIP, PAIR_LINE, HE_DOES, HE_VERB, PLAIN, RELATION_NAME, TONE, VERDICT, areaOf, heOf, pillarCaption, pillarName, strongestOf, type Relation } from '../content/readings'
import { animalImage, animalTh, MONTH_LABEL, WHEEL_BRANCHES } from '../content/animals'

export type Birth = { date: string; time: string | null; gender: 'female' | 'male' }
/** Two-hour ยาม with the middle that stands in for an unknown exact time. */
const YAM: Array<[string, string]> = [
  ['00:00', 'ยามชวด 23:00–00:59'], ['02:00', 'ยามฉลู 01:00–02:59'], ['04:00', 'ยามขาล 03:00–04:59'], ['06:00', 'ยามเถาะ 05:00–06:59'],
  ['08:00', 'ยามมะโรง 07:00–08:59'], ['10:00', 'ยามมะเส็ง 09:00–10:59'], ['12:00', 'ยามมะเมีย 11:00–12:59'], ['14:00', 'ยามมะแม 13:00–14:59'],
  ['16:00', 'ยามวอก 15:00–16:59'], ['18:00', 'ยามระกา 17:00–18:59'], ['20:00', 'ยามจอ 19:00–20:59'], ['22:00', 'ยามกุน 21:00–22:59'],
]
export type Sender = { name: string; animal: string; image: string } | null
export type OaClaim = { state: 'paid'; qi: number } | { state: 'already' | 'not_friend' | 'skip' }

export type TaisuiApi = {
  /** Loads the reading: no birth = the logged-in member's saved chart. */
  loadReading: (birth?: Birth) => Promise<{ ok: true; reading: TaisuiReading } | { ok: false; status: number }>
  stats: () => Promise<{ members: number; asOf: string } | null>
  login: (birth: Birth | null) => void
  openPacket: () => Promise<{ paid: boolean; qi?: number; reason?: string } | null>
  sendPacket: () => Promise<{ url: string } | null>
  /** The existing once-per-member LINE OA reward (100 QI), checked against LINE on the server. */
  claimOa: () => Promise<OaClaim>
  /** True once right after a LINE login started on this page (revision 0.13). */
  justLoggedIn: () => boolean
  oaUrl: string
  track: (event: string, params?: Record<string, string | number>) => void
  sender: Sender
  hasRef: boolean
}

type Sky = { s: [string, string, string]; img: 0 | 1; sunA: number; sunY?: string; sunC?: string; moonA: number; starA: number; cloudB: number; dark: 0 | 1; lbl: string }
const SKIES: Record<string, Sky> = {
  '2': { s: ['#081430', '#16285a', '#33407a'], img: 0, sunA: 0, moonA: 1, starA: 1, cloudB: 0.55, dark: 1, lbl: 'ฟ้าตอนคุณเกิด · 02:00 น. ฟ้าดาวเต็ม' },
  u: { s: ['#bfe3ff', '#e8eaff', '#fff1d6'], img: 1, sunA: 1, sunY: '44%', moonA: 0, starA: 0, cloudB: 1, dark: 0, lbl: 'ไม่ทราบเวลาเกิด · ใช้ฟ้ากลางวัน' },
  '6': { s: ['#2e3d7c', '#c780a6', '#ffc58a'], img: 0, sunA: 1, sunY: '70%', sunC: 'rgba(255,200,140,.95)', moonA: 0, starA: 0.25, cloudB: 0.85, dark: 1, lbl: 'ฟ้าตอนคุณเกิด · 06:00 น. ฟ้ารุ่งสาง' },
  '8.5': { s: ['#bfe3ff', '#e8eaff', '#fff1d6'], img: 1, sunA: 1, sunY: '44%', moonA: 0, starA: 0, cloudB: 1, dark: 0, lbl: 'ฟ้าปีมะแม 2570' },
  '15': { s: ['#5fb2ff', '#a9d8ff', '#fff3cc'], img: 0, sunA: 1, sunY: '24%', sunC: 'rgba(255,252,220,.95)', moonA: 0, starA: 0, cloudB: 1, dark: 0, lbl: 'ฟ้าตอนคุณเกิด · 15:00 น. ฟ้าบ่าย' },
  '18': { s: ['#3a3f8f', '#e2709a', '#ffb36b'], img: 0, sunA: 1, sunY: '76%', sunC: 'rgba(255,150,90,.95)', moonA: 0, starA: 0.4, cloudB: 0.85, dark: 1, lbl: 'ฟ้าตอนคุณเกิด · 18:00 น. ฟ้าเย็น' },
  '21': { s: ['#06142e', '#123a74', '#2b4f8f'], img: 0, sunA: 0, moonA: 1, starA: 0.85, cloudB: 0.6, dark: 1, lbl: 'ฟ้าตอนคุณเกิด · 21:00 น. ฟ้าค่ำ' },
}
const PRESETS = [2, 6, 8.5, 15, 18, 21]
const MONTHS_TH = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม']
const RESTS: Array<[number, string]> = [[0.3, 'ต่อ'], [0.5, 'ดูนักษัตรของฉัน'], [0.5325, 'ดูทีละตัว'], [0.5575, 'ตัวถัดไป'], [0.5825, 'ตัวถัดไป'], [0.6075, 'ตัวสุดท้าย'], [0.77, 'ดูกับ 12 นักษัตร'], [0.92, 'ไปต่อ']]
const SEG: Array<[number, number]> = [[0, 0.2], [0.2, 0.4], [0.4, 0.64], [0.64, 0.86], [0.86, 0.94]]
const FX: Record<'good' | 'care' | 'calm', [string, string]> = { good: ['six', '🎉'], care: ['harm', '😬'], calm: ['none', '🙂'] }

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x))
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a), 0, 1)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (text !== undefined) e.textContent = text
  return e
}

export function startTaisui(root: HTMLElement, api: TaisuiApi): () => void {
  const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  const $ = <T extends HTMLElement = HTMLElement>(id: string) => root.querySelector<T>('#' + id) as T
  const cleanups: Array<() => void> = []
  // A second start on the same frame (a remount, or React's dev double effect) begins from a clean frame.
  ;['stars', 'sparks', 'lanterns', 'wheel'].forEach((id) => { $(id).textContent = '' })
  root.querySelectorAll('.role, .rtabs, .ylead, .yam, .dock, .oaToast, .zc, .nextcue').forEach((n) => n.remove())
  const on = <E extends Event>(t: EventTarget, ev: string, fn: (e: E) => void, opts?: AddEventListenerOptions) => {
    t.addEventListener(ev, fn as EventListener, opts)
    cleanups.push(() => t.removeEventListener(ev, fn as EventListener, opts))
  }
  const timers = new Set<number>()
  const later = (fn: () => void, ms: number) => { const t = window.setTimeout(() => { timers.delete(t); fn() }, ms); timers.add(t); return t }
  const stage = $('stage'), cine = $('cine'), medal = $('medal'), ring = $('ring'), prog = $('prog')
  let reading: TaisuiReading | null = null
  let member = false

  // ① birth-hour sky
  function setSky(h: string, t?: string) {
    const k = SKIES[h]; if (!k) return
    stage.style.setProperty('--s1', k.s[0]); stage.style.setProperty('--s2', k.s[1]); stage.style.setProperty('--s3', k.s[2])
    $('skyImg').style.opacity = k.img ? 'calc(1 - var(--n))' : '0'
    stage.style.setProperty('--sunA', String(k.sunA)); stage.style.setProperty('--moonA', String(k.moonA)); stage.style.setProperty('--starA', String(k.starA)); stage.style.setProperty('--cloudB', String(k.cloudB))
    if (k.sunY) stage.style.setProperty('--sunY', k.sunY); else stage.style.removeProperty('--sunY')
    if (k.sunC) stage.style.setProperty('--sunC', k.sunC); else stage.style.removeProperty('--sunC')
    $('heroT').classList.toggle('dark', !!k.dark)
    $('skyLabel').textContent = t ? k.lbl.replace(/\d\d:\d\d/, t) : k.lbl
  }
  function skyFor(v: string): string {
    const [hh, mm] = v.split(':'); const h = +hh + (+mm || 0) / 60
    let best = 8.5, bd = 99
    for (const x of PRESETS) { const d = Math.min(Math.abs(h - x), 24 - Math.abs(h - x)); if (d < bd) { bd = d; best = x } }
    return String(best)
  }
  setSky('8.5')

  // sheet: day / month / B.E. year, a time or "don't know", gender; birthplace defaults to Thailand
  const bdD = $<HTMLSelectElement>('bdD'), bdM = $<HTMLSelectElement>('bdM'), bdY = $<HTMLSelectElement>('bdY'), bt = $<HTMLInputElement>('bt'), noT = $<HTMLInputElement>('noT')
  const opt = (s: HTMLSelectElement, v: string | number, t: string | number) => { const o = document.createElement('option'); o.value = String(v); o.textContent = String(t); s.appendChild(o) }
  MONTHS_TH.forEach((m, i) => opt(bdM, i + 1, m))
  for (let be = new Date().getFullYear() + 543; be >= 2443; be--) opt(bdY, be, be)
  function fillDays() {
    const keep = bdD.value, m = +bdM.value || 1, y = (+bdY.value || 2532) - 543, n = new Date(y, m, 0).getDate()
    while (bdD.options.length > 1) bdD.remove(1)
    for (let d = 1; d <= n; d++) opt(bdD, d, d)
    bdD.value = +keep <= n ? keep : ''
  }
  fillDays()
  function mark() {
    ;[bdD, bdM, bdY, bt].forEach((x) => x.classList.toggle('empty', !x.value))
    if (!root.querySelector('.box.bad')) $('shErr').textContent = ''
  }
  ;[bdD, bdM, bdY].forEach((x) => on(x, 'change', () => { if (x !== bdD) fillDays(); x.parentElement?.classList.remove('bad'); mark() }))
  on(bt, 'input', () => { if (bt.value) { $('bxT').classList.remove('bad'); setSky(skyFor(bt.value), bt.value) } mark() })
  // unknown time: the reader may still pick a two-hour ยาม; its middle stands in for the time
  const yam = el('select', 'yam') as HTMLSelectElement; yam.setAttribute('aria-label', 'ช่วงยามเกิด (ถ้าพอจำได้)'); yam.hidden = true
  ;[['', 'จำช่วงยามไม่ได้เลย'], ...YAM].forEach(([v, t]) => { const o = el('option'); o.value = v; o.textContent = t; yam.appendChild(o) })
  noT.closest('label')?.after(yam)
  on(noT, 'change', () => {
    yam.hidden = !noT.checked; if (!noT.checked) yam.value = ''
    bt.disabled = noT.checked; $('bxT').classList.toggle('off', noT.checked); $('bxT').classList.remove('bad')
    if (noT.checked) setSky('u'); else if (bt.value) setSky(skyFor(bt.value), bt.value); else setSky('8.5')
    mark()
  })
  mark()
  const sexBtns = Array.from(root.querySelectorAll<HTMLButtonElement>('#sex button'))
  sexBtns.forEach((b) => on(b, 'click', () => { sexBtns.forEach((x) => x.setAttribute('aria-pressed', String(x === b))); $('bxS').classList.remove('bad'); mark() }))
  function readSheet(): Birth | null {
    const miss: string[] = []
    ;([[bdD, 'bxD'], [bdM, 'bxM'], [bdY, 'bxY']] as const).forEach(([f, id]) => { if (!f.value) miss.push(id) })
    if (!noT.checked && !bt.value) miss.push('bxT')
    const sexI = sexBtns.findIndex((b) => b.getAttribute('aria-pressed') === 'true')
    if (sexI < 0) miss.push('bxS')
    miss.forEach((id) => { const b = $(id); b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad') })
    $('shErr').textContent = miss.length ? (miss.length === 1 && miss[0] === 'bxT' ? 'ใส่เวลาเกิด หรือติ๊ก "ไม่ทราบเวลาเกิด" ครับ' : 'ยังขาดช่องที่ขอบแดงอยู่ครับ') : ''
    if (miss.length) return null
    const pad = (n: string) => n.padStart(2, '0')
    return { date: `${+bdY.value - 543}-${pad(bdM.value)}-${pad(bdD.value)}`, time: noT.checked ? (yam.value || null) : bt.value, gender: sexI === 0 ? 'female' : 'male' }
  }

  // ambient layers
  const st = $('stars'), sp = $('sparks')
  for (let i = 0; i < 70; i++) { const s = el('i'); s.style.left = Math.random() * 100 + '%'; s.style.top = Math.random() * 62 + '%'; s.style.animationDelay = -Math.random() * 3 + 's'; st.appendChild(s) }
  for (let j = 0; j < 34; j++) { const k = el('i'); k.style.left = Math.random() * 100 + '%'; k.style.background = Math.random() < 0.5 ? '#E1FF00' : '#EBBF30'; k.style.animationDuration = 18 + Math.random() * 30 + 's'; k.style.animationDelay = -Math.random() * 40 + 's'; sp.appendChild(k) }
  const lans: HTMLElement[] = []
  ;[[10, 18], [24, 8], [76, 10], [90, 20], [40, 4], [62, 5]].forEach(([x, y], idx) => {
    const d = el('div', 'lantern'); d.style.left = `calc(${x}% - 22px)`; d.style.top = y + 6 + 'vh'; d.style.animationDelay = -idx * 1.3 + 's'
    d.appendChild(el('div', 'glow')); d.appendChild(el('b')); d.appendChild(el('em')); $('lanterns').appendChild(d); lans.push(d)
  })

  // twelve-animal wheel (the goat is the medallion in the middle)
  const wheel = $('wheel')
  const zs = WHEEL_BRANCHES.map((b) => { const z = el('div', 'z'); const c = el('span', 'c'); const im = el('img'); im.src = animalImage(b, 'ไฟ'); im.alt = ''; im.loading = 'lazy'; c.appendChild(im); z.appendChild(c); z.appendChild(el('b', 'n', animalTh(b))); wheel.appendChild(z); return { el: z, b } })
  const zc = el('b', 'zc', 'มะแม · ปีนี้'); zc.setAttribute('aria-hidden', 'true'); $('stage').appendChild(zc)
  let mine = new Set<string>()
  // ฮะ on the wheel: a thin line from the goat to each animal that joins it, and the element it makes
  const heSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); heSvg.setAttribute('class', 'he'); heSvg.setAttribute('aria-hidden', 'true'); wheel.prepend(heSvg)
  let heLinks: Array<{ b: string; line: SVGLineElement; badge: HTMLElement; sentence: string; short: string }> = []
  const EL_MARK: Record<string, string> = { ไฟ: '🔥', ไม้: '🌿', ดิน: '⛰️', ทอง: '✨', น้ำ: '💧' }

  // ② actors + ⑤ element flow, from the reading
  let actors: HTMLElement[] = []
  let caps: string[] = []
  let flowKind: Array<'gen' | 'ctl'> = []
  function renderPillars(r: TaisuiReading) {
    const row = $('row'); row.textContent = ''
    actors = r.pillars.map((p, i) => {
      const tone = TONE[p.relation as Relation]
      const [cls, fx] = FX[tone]
      const a = el('div', 'actor ' + cls)
      a.style.setProperty('--from', i < r.pillars.length / 2 ? '-70vw' : '70vw'); a.style.setProperty('--dl', i * 0.18 + 's')
      a.appendChild(el('span', 'pl', AREA[p.key].label.split(' · ')[0]))
      const fig = el('div', 'fig'); fig.appendChild(el('span', 'fx', fx)); const im = el('img'); im.src = p.image; im.alt = `${p.animal}ธาตุ${p.element}`; fig.appendChild(im); fig.appendChild(el('i', 'shadow')); a.appendChild(fig)
      a.appendChild(el('span', 'nm', `${p.animal} · ${p.element}`))
      const pr = el('span', 'pr'); pr.appendChild(document.createTextNode(p.preview[0])); pr.appendChild(el('br')); pr.appendChild(document.createTextNode(p.preview[1])); a.appendChild(pr)
      row.appendChild(a)
      return a
    })
    // every reaction bazi sends for the pillar, by position (the Sinse's check, revision 0.11)
    caps = r.pillars.map((p) => pillarCaption(p, r.hits, r.luck))
    flowKind = r.pillars.map((p) => (p.flow === 'controls' || p.flow === 'controlled-by' ? 'ctl' : 'gen'))
    $('pillars').querySelector('h2')!.textContent = r.pillars.length === 4 ? 'นักษัตรทั้ง 4 ตัวของคุณ' : 'นักษัตร 3 ตัวของคุณ'
    mine = new Set(r.mine)
    zs.forEach((z) => z.el.classList.toggle('me', mine.has(z.b)))
    wheel.classList.toggle('has', mine.size > 0); medal.classList.toggle('me', mine.has('未'))
    heLinks.forEach((l) => { l.line.remove(); l.badge.remove() }); heLinks = []
    const seen = new Set<string>()
    r.hits.forEach((h) => {
      if (!HE_VERB[h.kind] || seen.has(h.mine)) return
      const he = heOf(h, r.luck); if (!he) return
      seen.add(h.mine)
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line'); line.setAttribute('class', he.tone); heSvg.appendChild(line)
      const badge = el('span', 'heb ' + he.tone, `${EL_MARK[he.element] ?? ''} ${he.element}`); wheel.appendChild(badge)
      heLinks.push({ b: h.mine, line, badge, sentence: `${animalTh(h.mine)}ของคุณ${HE_VERB[h.kind]}กับแพะ ${he.gets} ${he.toYou}`.trim(), short: `${animalTh(h.mine)}${HE_VERB[h.kind]}กับแพะ ${he.gets} ${he.short}`.trim() })
    })
    $('wsub').textContent = `ตัวที่เรืองแสงคือของคุณ · ${Array.from(mine).map((b) => animalTh(b) + (b === '未' ? ' (ตรงกลาง)' : '')).join(' ')}`
  }
  let entered = false, reactT = 0
  function enter() { try { navigator.vibrate?.(12) } catch { /* no vibration */ } entered = true; actors.forEach((a) => a.classList.add('in')); window.clearTimeout(reactT); reactT = later(() => actors.forEach((a) => a.classList.add('react')), still ? 0 : 1600) }
  function leave() { entered = false; window.clearTimeout(reactT); actors.forEach((a) => a.classList.remove('in', 'react')) }

  const lines = $('lines') as unknown as SVGSVGElement
  function drawFlow(t: number, now: number) {
    if (t <= 0 || !actors.length) { if (lines.firstChild) lines.textContent = ''; return }
    const sr = stage.getBoundingClientRect(), mr = medal.getBoundingClientRect()
    const mx = mr.left + mr.width / 2 - sr.left, my = mr.top + mr.height * 0.86 - sr.top
    const ns = 'http://www.w3.org/2000/svg'
    lines.textContent = ''
    const g = document.createElementNS(ns, 'g')
    actors.forEach((a, i) => {
      const r = a.querySelector('.fig')!.getBoundingClientRect(), lb = a.querySelector('.pl')!.getBoundingClientRect(); const x = r.left + r.width / 2 - sr.left, y = lb.top - sr.top - 6, cy = (my + y) / 2
      const pe = document.createElementNS(ns, 'path'); pe.setAttribute('d', `M${mx} ${my} C ${mx} ${cy}, ${x} ${cy}, ${x} ${y}`)
      const gen = flowKind[i] === 'gen'
      pe.setAttribute('stroke', gen ? '#FF8A3D' : '#ff6b6b'); pe.setAttribute('opacity', (t * 0.55).toFixed(2)); lines.appendChild(pe)
      if (still) return
      const len = pe.getTotalLength(), n = gen ? 6 : 5, speed = gen ? 0.00022 : 0.0005
      for (let q = 0; q < n; q++) {
        const u = (now * speed + q / n) % 1, pt = pe.getPointAtLength(u * len), c = document.createElementNS(ns, 'circle')
        const jit = gen ? 0 : Math.sin(now / 40 + q * 3) * 3
        c.setAttribute('cx', (pt.x + jit).toFixed(1)); c.setAttribute('cy', pt.y.toFixed(1)); c.setAttribute('r', gen ? '3.2' : '2.2')
        c.setAttribute('fill', gen ? '#FFB066' : '#FF5A4D'); c.setAttribute('opacity', (t * (gen ? 0.95 : 0.85)).toFixed(2)); g.appendChild(c)
      }
    })
    lines.appendChild(g)
  }

  // ⑦ Mu's faces and bubble
  const faces = Array.from(root.querySelectorAll<HTMLImageElement>('#muFace img')), bub = $('bubble')
  let lastMsg = '', lastFace = 'greet'
  function say(t: string, face?: string) {
    if (face && face !== lastFace) { lastFace = face; faces.forEach((f) => f.classList.toggle('on', f.dataset.m === face)) }
    if (t === lastMsg) return
    lastMsg = t; bub.classList.add('swap'); later(() => { $('bubT').textContent = t; bub.classList.remove('swap') }, still ? 0 : 180)
  }

  // ⑦ member count, odometer
  let members = 0, counted = false, odoBuilt = false, odoT = 0
  function buildOdo() {
    const box = $('statN'), txt = members.toLocaleString('en-US'); box.textContent = ''
    for (const ch of txt) {
      if (ch === ',') { box.appendChild(el('span', 'sep', ',')); continue }
      const d = el('span', 'd'); d.dataset.v = ch; const reel = el('span', 'reel')
      for (let k = 0; k < 4; k++) for (let dg = 0; dg < 10; dg++) reel.appendChild(el('span', undefined, String(dg)))
      d.appendChild(reel); box.appendChild(d)
    }
    box.setAttribute('aria-label', txt); odoBuilt = true
  }
  function countUp() {
    if (!members) return
    counted = true; if (!odoBuilt) buildOdo()
    const box = $('statN'), ds = Array.from(box.querySelectorAll<HTMLElement>('.d')); box.classList.remove('done'); window.clearTimeout(odoT)
    ds.forEach((d, i) => { const reel = d.firstChild as HTMLElement, idx = 30 + +(d.dataset.v ?? 0), dur = still ? 0 : 1.3 + i * 0.38
      reel.style.transition = 'none'; reel.style.transform = 'translateY(0)'; void reel.offsetHeight
      reel.style.transition = dur ? `transform ${dur}s cubic-bezier(.15,.75,.15,1)` : 'none'; reel.style.transform = `translateY(-${idx * 1.05}em)` })
    odoT = later(() => box.classList.add('done'), still ? 0 : 1300 + ds.length * 380)
  }
  function resetOdo() { counted = false; if (!odoBuilt) return; window.clearTimeout(odoT); const box = $('statN'); box.classList.remove('done'); box.querySelectorAll<HTMLElement>('.reel').forEach((r) => { r.style.transition = 'none'; r.style.transform = 'translateY(0)' }) }
  $('statN').hidden = true
  api.stats().then((s) => { if (!s || !s.members) return; members = s.members; $('statN').hidden = false; $('statAsOf').textContent = `นับจากสมาชิกจริง ณ ${new Date(s.asOf).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}`; if (P > 0.89) countUp() })

  let P = 0, flowT = 0, sheetOpen = false, gliding = false
  function heCount() { return reading ? new Set(reading.hits.filter((x) => x.kind === 'six' || x.kind === 'half3' || x.kind === 'stemCombine').map((x) => x.pillar)).size : 0 }
  function careCount() { return reading ? reading.pillars.filter((p) => TONE[p.relation as Relation] === 'care').length : 0 }
  function frame() {
    const vh = stage.clientHeight || innerHeight, vw = stage.clientWidth || innerWidth
    const p = clamp((scrollY - cine.offsetTop) / (cine.offsetHeight - vh), 0, 1); P = p
    stage.style.setProperty('--n', seg(p, 0.04, 0.26).toFixed(3))
    const out = seg(p, 0, 0.06); $('heroT').style.opacity = String(1 - out); $('heroT').style.transform = `translateY(${-30 * out}px)`
    $('cta').style.opacity = String(1 - seg(p, 0, 0.04)); $('cta').style.pointerEvents = p > 0.03 ? 'none' : ''
    root.querySelectorAll<HTMLElement>('#prog b').forEach((b, i) => { b.style.transform = `scaleX(${seg(p, SEG[i][0], SEG[i][1]).toFixed(3)})` })
    prog.classList.toggle('day', seg(p, 0.04, 0.26) < 0.5); prog.style.opacity = scrollY > cine.offsetTop + cine.offsetHeight - vh * 0.6 ? '0' : '1'
    $('cFar').style.transform = `translateY(${seg(p, 0, 0.3) * 12}vh)`; $('cMid').style.transform = `translateY(${seg(p, 0, 0.3) * 22}vh)`; $('cNear').style.transform = `translateY(${seg(p, 0, 0.3) * 36}vh)`
    lans.forEach((l, i) => { l.classList.toggle('lit', p > 0.12 + i * 0.02); l.style.opacity = (seg(p, 0.05, 0.14) * (1 - seg(p, 0.9, 1)) * (1 - 0.62 * seg(p, 0.38, 0.44))).toFixed(2) })
    const shrink = ease(seg(p, 0.03, 0.2)), toC = ease(seg(p, 0.62, 0.7)), gone = seg(p, 0.84, 0.9)
    const y = lerp(lerp(0.06 * vh, -0.31 * vh, shrink), -0.02 * vh, toC), sc = lerp(lerp(1, 0.3, shrink), 0.36, toC)
    medal.style.transform = `translate(-50%,-50%) translateY(${y}px) scale(${sc})`; medal.style.opacity = (1 - gone).toFixed(2); ring.style.opacity = shrink.toFixed(2)
    const yIn = seg(p, 0.2, 0.26), yOut = seg(p, 0.34, 0.4); $('year').style.opacity = (yIn * (1 - yOut)).toFixed(2)
    const pIn = seg(p, 0.4, 0.45), pOut = seg(p, 0.6, 0.64); $('pillars').style.opacity = (pIn * (1 - pOut)).toFixed(2)
    if (p > 0.43 && !entered && actors.length) enter(); if (p < 0.38 && entered) leave()
    flowT = seg(p, 0.47, 0.52) * (1 - pOut)
    const spot = p >= 0.52 && p < 0.62 ? Math.min(actors.length - 1, Math.floor((p - 0.52) / 0.025)) : -1
    actors.forEach((a, i) => { a.classList.toggle('lit', spot === i); a.classList.toggle('dim', spot >= 0 && spot !== i) })
    const wIn = seg(p, 0.64, 0.7), wOut = seg(p, 0.84, 0.88), wv = wIn * (1 - wOut); wheel.style.opacity = wv.toFixed(2); $('wtitle').style.opacity = wv.toFixed(2)
    const R = Math.min(vw * 0.39, vh * 0.3, 240), cx = vw / 2, cy = vh / 2 - 0.02 * vh, rot = 90 + 140 * ease(seg(p, 0.6, 0.72)), pop = 1.08
    zs.forEach((z, i) => { const a = ((rot + i * (360 / zs.length)) * Math.PI) / 180, r = R * lerp(0.6, 1, wIn); z.el.style.left = cx + Math.cos(a) * r + 'px'; z.el.style.top = cy + Math.sin(a) * r * 0.92 + 'px'; z.el.style.transform = `scale(${mine.has(z.b) && p > 0.72 ? pop : 1})` })
    heLinks.forEach((l, i) => {
      const z = zs.find((q) => q.b === l.b); if (!z) return
      const x = parseFloat(z.el.style.left), y = parseFloat(z.el.style.top), k = still ? (p > 0.72 ? 1 : 0) : ease(seg(p, 0.72 + i * 0.025, 0.755 + i * 0.025))
      const ex = cx + (x - cx) * k, ey = cy + (y - cy) * k
      l.line.setAttribute('x1', String(cx)); l.line.setAttribute('y1', String(cy)); l.line.setAttribute('x2', ex.toFixed(1)); l.line.setAttribute('y2', ey.toFixed(1))
      l.line.style.opacity = (k > 0 ? wv : 0).toFixed(2)
      l.badge.style.left = cx + (x - cx) * 0.74 + 'px'; l.badge.style.top = cy + (y - cy) * 0.74 + 'px'
      l.badge.style.setProperty('--s', k > 0.95 && wv > 0.5 ? '1' : '0')
    })
    zc.style.left = cx + 'px'; zc.style.top = cy + medal.offsetWidth * sc * 0.4 + 'px'; zc.style.opacity = wv.toFixed(2); zc.classList.toggle('me', mine.has('未') && p > 0.72)
    const sIn = seg(p, 0.88, 0.93); $('stat').style.opacity = sIn.toFixed(2); $('toRead').style.pointerEvents = sIn > 0.6 ? 'auto' : 'none'; $('toRead').tabIndex = sIn > 0.6 ? 0 : -1
    if (p > 0.89 && !counted) countUp(); if (p < 0.86 && counted) resetOdo()
    if (sheetOpen) say('ใส่เวลาเกิด แล้วดูฟ้าด้านบนเปลี่ยนตามนะครับ', 'happy')
    else if (p < 0.05) say(api.sender ? `มีอั่งเปาจาก${api.sender.name}รออยู่ มาดูดวงปีมะแมของคุณกันก่อนครับ` : 'สวัสดีครับ ผมเสี่ยวมู่ มาดูกันว่าปีมะแมส่งผลกับคุณยังไง', 'greet')
    else if (p < 0.2) say('ฟ้ากำลังเข้าคืนเทศกาล โคมเริ่มจุดแล้วครับ', 'greet')
    else if (p < 0.4) say('丁 คือไฟหยิน 未 คือมะแม ปีนี้จึงเป็นปีมะแมไฟ', 'special')
    else if (!reading) say('กรอกวันเกิดก่อน แล้วนักษัตรของคุณจะวิ่งออกมาครับ', 'happy')
    else if (p < 0.52) say(`นี่คือนักษัตร ${actors.length} ตัวของคุณ ท่าทางบอกว่าเข้ากับปีมะแมแค่ไหน`, 'happy')
    else if (p < 0.62) say(caps[Math.max(0, spot)] ?? '', 'happy')
    else if (p < 0.86 && p > 0.745 && heLinks.length) say(heLinks.length > 1 ? `เส้นที่วงล้อคือตัวที่เชื่อมกับแพะ: ${heLinks.map((l) => l.short).join(' · ')}` : heLinks[0].sentence, 'special')
    else if (p < 0.86) { const n = careCount(), h = heCount(); say(n || h ? `ตัวที่เรืองแสงคือของคุณ ปีนี้${n ? `มี ${n} เสาที่โดนแรงของปี` : ''}${n && h ? ' และ' : ''}${h ? `มี ${h} เสาที่จับมือกับปี` : ''}` : 'ตัวที่เรืองแสงคือของคุณ ปีนี้ไม่มีเสาไหนโดนแรงของปีตรงๆ ครับ', n ? 'special' : 'happy') }
    else say(member ? 'อ่านภาพรวมทั้งปีของคุณก่อน แล้วค่อยดูทีละเดือนครับ' : 'คำทำนายเต็มกับโคม 12 เดือน ดูได้หลังเข้าสู่ระบบครับ', 'happy')
    bub.classList.toggle('dense', p >= 0.52 && p < 0.62 && (caps[Math.max(0, spot)] ?? '').split('\n').length > 2)
    updateNext(); updateDock()
  }
  let ticking = false
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(() => { ticking = false; frame() }) } }
  on(window, 'scroll', onScroll, { passive: true }); on(window, 'resize', onScroll)
  let raf = 0
  const loop = (now: number) => { drawFlow(flowT, now); raf = requestAnimationFrame(loop) }
  raf = requestAnimationFrame(loop)
  cleanups.push(() => cancelAnimationFrame(raf))

  // glide to a scroll point; any touch, wheel or key cancels it
  const cancelGlide = () => { gliding = false }
  ;['wheel', 'touchstart', 'keydown'].forEach((ev) => on(window, ev, cancelGlide, { passive: true }))
  function glideToY(to: number, done?: () => void) {
    if (still) { scrollTo(0, to); done?.(); return }
    const s0 = scrollY, dist = Math.abs(to - s0), dur = clamp(dist / 1.3, 500, 2400); let t0 = 0; gliding = true; hideNext()
    const stp = (t: number) => { if (!gliding) return; if (!t0) t0 = t; const k = Math.min(1, (t - t0) / dur); scrollTo(0, s0 + (to - s0) * ease(k)); if (k < 1) requestAnimationFrame(stp); else { gliding = false; done?.(); armIdle() } }
    requestAnimationFrame(stp)
  }
  const glideTo = (pp: number, done?: () => void) => glideToY(cine.offsetTop + (cine.offsetHeight - innerHeight) * pp, done)
  const toSection = (id: string) => glideToY($(id).getBoundingClientRect().top + scrollY - 12)

  // one guide button inside Mu's bubble
  const nextBtn = $<HTMLButtonElement>('next')
  let nextTo: number | 'sheet' | null = null, idleT = 0, nudgeT = 0
  function hideNext() { nextBtn.classList.remove('on', 'idle'); nextBtn.tabIndex = -1; window.clearTimeout(nudgeT) }
  function updateNext() {
    if (gliding || sheetOpen) return
    nextTo = null
    if (!reading && P >= 0.3 && P < 0.9) { nextTo = 'sheet'; nextBtn.textContent = 'กรอกวันเกิด'; return }
    if (P >= 0.03 && P < 0.9) for (const [at, label] of RESTS) if (at > P + 0.004) { nextTo = at; nextBtn.textContent = label; break }
  }
  function armIdle() {
    window.clearTimeout(idleT); window.clearTimeout(nudgeT); nextBtn.classList.remove('idle')
    idleT = later(() => { updateNext(); if (nextTo === null) { hideNext(); return } nextBtn.classList.add('on'); nextBtn.tabIndex = 0; nudgeT = later(() => nextBtn.classList.add('idle'), 2600) }, 450)
  }
  on(window, 'scroll', () => { if (gliding) return; hideNext(); armIdle() }, { passive: true })
  on(nextBtn, 'click', () => { if (!nextBtn.classList.contains('on')) return; if (nextTo === 'sheet') openSheet(); else if (nextTo !== null) glideTo(nextTo) })

  // the sheet (visitors) — members with a saved chart go straight in
  const sheet = $('sheet'), scrim = $('scrim')
  function openSheet() { sheetOpen = true; hideNext(); sheet.classList.add('on'); scrim.classList.add('on'); $('cta').style.visibility = 'hidden'; frame() }
  function closeSheet() { sheetOpen = false; sheet.classList.remove('on'); scrim.classList.remove('on'); $('cta').style.visibility = ''; frame() }
  on($('start'), 'click', () => { if (reading) glideTo(0.3); else openSheet() })
  on(scrim, 'click', closeSheet)
  on<KeyboardEvent>(window, 'keydown', (e) => { if (e.key === 'Escape' && sheetOpen) closeSheet() })
  let typed: Birth | null = null
  on<SubmitEvent>(sheet, 'submit', async (e) => {
    e.preventDefault()
    const birth = readSheet(); if (!birth) return
    const btn = sheet.querySelector<HTMLButtonElement>('button[type=submit]')!; btn.disabled = true
    api.track('taisui_form_submit', { time_known: birth.time ? 1 : 0 })
    const res = await api.loadReading(birth); btn.disabled = false
    if (!res.ok) { $('shErr').textContent = res.status === 429 ? 'กดถี่ไปหน่อย รอสักครู่แล้วลองใหม่ครับ' : 'ยังดูดวงไม่ได้ ลองใหม่อีกครั้งครับ'; return }
    typed = birth
    apply(res.reading)
    closeSheet(); glideTo(0.3)
  })
  on($('member'), 'click', () => { api.track('taisui_login_click', { from: 'hero' }); api.login(null) })
  on($('toRead'), 'click', () => { if (member) toSection('yearSec'); else { api.track('taisui_login_click', { from: 'count' }); api.login(typed) } })
  on($('lockLogin'), 'click', () => { api.track('taisui_login_click', { from: 'lock' }); api.login(typed) })

  // ⑥ twelve monthly lanterns
  const mz = $('months')
  function renderMonths(r: TaisuiReading) {
    mz.textContent = ''
    r.months.forEach((m, i) => {
      const b = el('button', 'mo' + (m.state === 'normal' ? '' : ' ' + m.state)); b.type = 'button'; b.setAttribute('aria-pressed', 'false')
      const lt = el('span', 'lt'); lt.style.animationDelay = -i * 0.6 + 's'; b.appendChild(lt)
      const lbl = MONTH_LABEL[m.branch]; const ms = el('span', 'm'); ms.appendChild(el('b', undefined, lbl.name)); ms.appendChild(document.createTextNode(lbl.short)); b.appendChild(ms)
      on(b, 'click', () => {
        Array.from(mz.children).forEach((x) => x.setAttribute('aria-pressed', 'false')); b.setAttribute('aria-pressed', 'true')
        const tip = $('mtip'); tip.textContent = ''; tip.appendChild(el('b', undefined, `เดือน${lbl.name} (${lbl.short}) `)); tip.appendChild(document.createTextNode(r.full?.monthTips[m.branch] ?? MONTH_TIP[m.state]))
        moAt = i; $<HTMLButtonElement>('moPrev').disabled = i === 0; $<HTMLButtonElement>('moNext').disabled = i === r.months.length - 1
      })
      mz.appendChild(b)
    })
  }
  // ‹ › beside the swipe (team review, revision 0.11)
  let moAt = 0
  const moGo = (d: number) => {
    const items = Array.from(mz.children) as HTMLElement[]; if (!items.length) return
    const b = items[clamp(moAt + d, 0, items.length - 1)]; b.click()
    mz.scrollTo({ left: b.offsetLeft - mz.offsetLeft - (mz.clientWidth - b.offsetWidth) / 2, behavior: still ? 'auto' : 'smooth' })
  }
  on($('moPrev'), 'click', () => moGo(-1)); on($('moNext'), 'click', () => moGo(1))
  if ('IntersectionObserver' in window) {
    const mo = new IntersectionObserver((es) => es.forEach((en) => {
      if (!en.isIntersecting || !mz.children.length) return
      mo.disconnect()
      if (!still) { mz.scrollTo({ left: 96, behavior: 'smooth' }); later(() => mz.scrollTo({ left: 0, behavior: 'smooth' }), 700) }
      const first = Array.from(mz.children).findIndex((c) => c.classList.contains('peak'))
      later(() => (mz.children[Math.max(0, first)] as HTMLElement | undefined)?.click(), still ? 0 : 1300)
    }), { threshold: 0.6 })
    mo.observe(mz); cleanups.push(() => mo.disconnect())
  }

  // reading per pillar (members) or the lock (visitors)
  function renderReads(r: TaisuiReading) {
    const box = $('reads'); box.textContent = ''
    $('lock').hidden = !r.locked
    $('draftNote').hidden = !r.draft
    renderRole(r)
    tabs.textContent = ''; tabs.hidden = !r.full
    ylead.hidden = !(r.full && r.role); ylead.textContent = ''
    if (r.full && r.role) { ylead.appendChild(el('b', undefined, `โทนทั้งปี: ${r.role.roleTh}`)); ylead.appendChild(document.createTextNode(` ${r.role.line}`)) }
    cue.hidden = !r.full
    if (!r.full) return
    r.pillars.forEach((p, i) => {
      const tb = el('button', 'rtab' + (i === 0 ? ' on' : '')) as HTMLButtonElement; tb.type = 'button'
      tb.textContent = `${AREA[p.key].label.split(' · ')[0].replace('เกิด', '')} · ${p.animal}`
      on(tb, 'click', () => { const card = box.children[i] as HTMLElement | undefined; if (card) box.scrollTo({ left: card.offsetLeft - box.offsetLeft - 16, behavior: still ? 'auto' : 'smooth' }) })
      tabs.appendChild(tb)
      const rd = r.full!.readings[i]; if (!rd) return
      const art = el('article', 'read')
      const hd = el('div', 'hd'); const im = el('img'); im.src = p.image; im.alt = `ตัวละคร${p.animal}ธาตุ${p.element}`; im.loading = 'lazy'; hd.appendChild(im)
      const t = el('div'); t.appendChild(el('div', 'k', `นักษัตร${AREA[p.key].label}`)); t.appendChild(el('div', 't', p.animal)); t.appendChild(el('span', 'rel ' + TONE[p.relation as Relation], RELATION_NAME[p.relation as Relation])); hd.appendChild(t); art.appendChild(hd)
      // three layers: plain words, then the Sinse's reading of the characters, then what to do
      art.appendChild(el('h3', undefined, rd.headline))
      if (rd.story) art.appendChild(el('p', 'story', rd.story))
      if (rd.details.length) {
        // folded by default: plain readers get an even, short card; chart readers open it
        const fold = el('details', 'sx'); fold.appendChild(el('summary', undefined, `อ่านแบบซินแส · ${rd.details.length} จุด`))
        const dl = el('div', 'rx'); fold.appendChild(dl)
        rd.details.forEach((d, k) => { const it = el('div', 'it'); it.appendChild(el('b', undefined, d.name)); it.appendChild(el('small', undefined, d.why)); if (k > 0 && d.story !== rd.story) it.appendChild(el('p', undefined, d.story)); dl.appendChild(it) })
        art.appendChild(fold)
      }
      art.appendChild(el('h3', undefined, 'ทำ 3 อย่างนี้'))
      const ul = el('ul', 'acts'); rd.actions.forEach((a, k) => { const li = el('li'); li.appendChild(el('span', undefined, String(k + 1))); li.appendChild(document.createTextNode(a)); ul.appendChild(li) }); art.appendChild(ul)
      const ask = el('a', 'ask'); ask.href = '/v2/chat'; const mi = el('img'); mi.src = '/images/v2/mascot/personas/mu/happy.png'; mi.alt = ''; ask.appendChild(mi); ask.appendChild(document.createTextNode('ถามเสี่ยวมู่เรื่องนี้ต่อ'))
      // the LINE send lives only on the share card (team review, revision 0.11)
      const foot = el('div', 'cfoot'); foot.appendChild(ask); art.appendChild(foot)
      box.appendChild(art)
    })
  }
  const tabs = el('div', 'rtabs'); tabs.setAttribute('role', 'tablist'); $('reads').before(tabs)
  // the year is a page of its own; it ends with a cue down to the months
  const cue = el('button', 'nextcue') as HTMLButtonElement; cue.type = 'button'; cue.hidden = true; cue.appendChild(document.createTextNode('ต่อไป: ดูทีละเดือน')); cue.appendChild(el('i'))
  $('reads').closest('section')?.appendChild(cue); on(cue, 'click', () => toSection('moSec'))
  const ylead = el('p', 'ylead'); ylead.hidden = true; tabs.before(ylead)
  on($('reads'), 'scroll', () => {
    const box = $('reads'); const w = (box.firstElementChild as HTMLElement | null)?.offsetWidth ?? 1
    const i = Math.round(box.scrollLeft / (w + 12)); tabs.querySelectorAll('.rtab').forEach((t, k) => t.classList.toggle('on', k === i))
  }, { passive: true })

  // the year's fire to the day master, and where the year lands in the chart: free for everyone
  const roleSec = el('section', 'sec gut role'); roleSec.id = 'yearSec'; roleSec.hidden = true; $('readT').closest('section')?.before(roleSec)
  function renderRole(r: TaisuiReading) {
    roleSec.textContent = ''; roleSec.hidden = !r.role
    if (!r.role) return
    // the answer first: one line for the year, then one plain line per pillar (owner pick A, 2026-11-20)
    const toneOfPillar = (p: TaisuiReading['pillars'][number]) => { const h = r.hits.find((x) => x.pillar === p.key && x.kind === p.relation); return (h && heOf(h, r.luck)?.tone) || TONE[p.relation as Relation] }
    const cares = r.pillars.filter((p) => toneOfPillar(p) === 'care').length
    const goods = r.pillars.filter((p) => toneOfPillar(p) === 'good').length
    const vd = el('div', 'verdict')
    vd.appendChild(el('span', 'pagehd', 'ภาพรวมทั้งปี'))
    vd.appendChild(el('div', 'k', 'ปีมะแม 2570 ของคุณ'))
    vd.appendChild(el('h2', undefined, VERDICT[strongestOf(r.pillars.map((p) => p.relation))]))
    // the year's fire in plain words, from bazi's role and 用神 (revision 0.11)
    const sub = el('p', 'sub'); sub.appendChild(el('b', undefined, r.role.fire)); sub.appendChild(document.createTextNode(' · '))
    sub.appendChild(document.createTextNode(cares || goods ? `${cares ? `ต้องระวัง ${cares} เรื่อง` : ''}${cares && goods ? ' · ' : ''}${goods ? `มีแรงหนุน ${goods} เรื่อง` : ''}` : 'ปีนี้ไม่มีเรื่องไหนโดนแรงของปีตรงๆ'))
    vd.appendChild(sub)
    const rows = el('ul', 'prow')
    r.pillars.slice().reverse().forEach((p, i) => {
      const own = r.hits.find((h) => h.pillar === p.key && h.kind === p.relation); const ownHe = own ? heOf(own, r.luck) : null
      const tone = ownHe ? ownHe.tone : TONE[p.relation as Relation]; const li = el('li', tone); li.style.transitionDelay = `${i * 0.12}s`
      const im = el('img'); im.src = p.image; im.alt = ''; im.loading = 'lazy'; li.appendChild(im)
      const t = el('div'); t.appendChild(el('small', undefined, `${AREA[p.key].label} · ${p.animal}`))
      const b = el('b'); b.appendChild(el('i')); b.appendChild(document.createTextNode(ownHe ? `${HE_DOES[p.relation]} ${ownHe.gets} ${ownHe.short}`.trim() : PLAIN[p.relation as Relation])); t.appendChild(b)
      const also = tone === 'care' ? r.hits.find((h) => h.pillar === p.key && HE_DOES[h.kind] && h !== own) : undefined
      const alsoHe = also ? heOf(also, r.luck) : null
      if (also && alsoHe) t.appendChild(el('em', 'also ' + alsoHe.tone, `${alsoHe.tone === 'care' ? 'และ' : 'แต่ '}${HE_DOES[also.kind]} ${alsoHe.gets} ${alsoHe.short}`.trim()))
      li.appendChild(t); rows.appendChild(li)
    })
    vd.appendChild(rows); roleSec.appendChild(vd)
    if (still || !('IntersectionObserver' in window)) rows.classList.add('in')
    else { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { rows.classList.add('in'); io.disconnect() } }), { threshold: 0.3 }); io.observe(rows); cleanups.push(() => io.disconnect()) }
    // the Sinse's reading of the characters, folded: the chart plays when it opens
    const fold = el('details', 'fold'); const sm = el('summary'); const st = el('div'); st.appendChild(document.createTextNode('ดูแบบซินแส: ปีมะแมโดนตัวอักษรไหน')); st.appendChild(el('small', undefined, 'ผังดวง 8 ตัวอักษร ราศีบน ราศีล่าง และดิถี')); sm.appendChild(st); fold.appendChild(sm)
    // the fold keeps the chart and its caption only (team review, revision 0.11)
    fold.appendChild(renderChart(r))
    roleSec.appendChild(fold)
  }

  // the chart's characters, and the year's two flying in to the ones they hit (plan revision 0.9)
  const HIT_FX: Record<string, string> = { chong: 'clash', stemClash: 'clash', heng: 'press', samheng: 'chain', hai: 'shade', phua: 'crack', same: 'glow', six: 'glow', half3: 'glow', stemCombine: 'glow' }
  const FX_ALL = ['fx-clash', 'fx-press', 'fx-chain', 'fx-shade', 'fx-crack', 'fx-glow']
  let chartStop: () => void = () => {}
  function renderChart(r: TaisuiReading): HTMLElement {
    chartStop()
    const box = el('div', 'chart')
    const yr = el('div', 'yr'); const chips: Record<string, HTMLElement> = {}
    ;[r.year.stem, r.year.branch].forEach((c) => { const ch = el('span', 'yc', c); chips[c] = ch; yr.appendChild(ch) })
    yr.appendChild(el('small', undefined, 'ตัวอักษรของปีมะแม 2570'))
    const again = el('button', 'again', 'ดูอีกครั้ง') as HTMLButtonElement; again.type = 'button'; again.hidden = !r.hits.length; yr.appendChild(again)
    box.appendChild(yr)
    const grid = el('div', 'g8'); grid.style.setProperty('--cols', String(r.pillars.length))
    grid.appendChild(el('span'))
    r.pillars.forEach((p) => grid.appendChild(el('span', 'ph', pillarName(p.key))))
    const cells: Record<string, HTMLElement> = {}
    const cap = el('p', 'cap'); cap.setAttribute('aria-live', 'polite')
    ;(['top', 'bottom'] as const).forEach((at) => {
      grid.appendChild(el('span', 'rlab', AT_TH[at]))
      r.pillars.forEach((p) => {
        const ch = at === 'top' ? p.stem : p.branch
        const c = el('button', 'c8' + (at === 'top' && p.key === 'day' ? ' me8' : '')) as HTMLButtonElement; c.type = 'button'
        c.setAttribute('aria-label', `${AT_TH[at]}${pillarName(p.key)} ${ch}`)
        c.appendChild(el('b', undefined, ch))
        c.appendChild(el('small', undefined, at === 'bottom' ? p.animal : p.key === 'day' ? 'ดิถี · คุณ' : DAY_MASTER[p.stem]?.th ?? ''))
        const mine = r.hits.filter((h) => h.pillar === p.key && h.at === at)
        on(c, 'click', () => {
          if (mine.length) { play(mine); return }
          cap.textContent = ''; cap.appendChild(el('span', undefined, `ปีมะแมไม่ได้ทำปฏิกิริยากับ ${ch} ที่${AT_TH[at]}${pillarName(p.key)}`))
        })
        cells[`${p.key}:${at}`] = c; grid.appendChild(c)
      })
    })
    box.appendChild(grid)
    const tok = el('span', 'tok'); tok.setAttribute('aria-hidden', 'true'); box.appendChild(tok)
    box.appendChild(cap)
    if (!r.hits.length) cap.appendChild(el('span', undefined, 'ปีมะแมไม่ได้เข้ามาทำปฏิกิริยากับตัวไหนในดวงคุณโดยตรง'))

    let ts: number[] = []
    const stop = () => { ts.forEach((t) => window.clearTimeout(t)); ts = []; tok.getAnimations?.().forEach((a) => a.cancel()); tok.classList.remove('on') }
    chartStop = stop
    type Hit = TaisuiReading['hits'][number]
    const land = (h: Hit, cell: HTMLElement) => {
      cell.classList.remove(...FX_ALL); void cell.offsetWidth
      cell.classList.add('fx-' + HIT_FX[h.kind], 'hit', h.tone)
      cap.textContent = ''; cap.appendChild(el('b', undefined, h.name)); cap.appendChild(el('span', 'why', h.why)); cap.appendChild(el('span', 'pl', `${areaOf(h.pillar)}: ${h.plain}`))
      if (h.tone === 'care') { try { navigator.vibrate?.(14) } catch { /* no vibration */ } }
    }
    const fly = (h: Hit, done: () => void) => {
      const cell = cells[`${h.pillar}:${h.at}`]; const from = chips[h.year]
      if (!cell) { done(); return }
      if (still || !from || typeof tok.animate !== 'function') { land(h, cell); done(); return }
      const b = box.getBoundingClientRect(), f = from.getBoundingClientRect(), t = cell.getBoundingClientRect()
      const x0 = f.left - b.left + f.width / 2, y0 = f.top - b.top + f.height / 2, x1 = t.left - b.left + t.width / 2, y1 = t.top - b.top + t.height / 2
      tok.textContent = h.year; tok.className = 'tok on ' + h.tone
      from.classList.remove('go'); void from.offsetWidth; from.classList.add('go')
      const at = (x: number, y: number, k: number) => `translate(${x}px,${y}px) translate(-50%,-50%) scale(${k})`
      const a = tok.animate([
        { transform: at(x0, y0, 1), opacity: 0 },
        { transform: at(x0, y0, 1.3), opacity: 1, offset: 0.18 },
        { transform: at((x0 + x1) / 2 + 18, Math.min(y0, y1) - 28, 1.15), opacity: 1, offset: 0.6 },
        { transform: at(x1, y1, 0.75), opacity: 0.3 },
      ], { duration: 760, easing: 'cubic-bezier(.45,0,.3,1)' })
      a.onfinish = () => { tok.classList.remove('on'); land(h, cell); done() }
    }
    const summary = () => {
      const n = new Map<string, number>(); r.hits.forEach((h) => n.set(h.name.split(' (')[0], (n.get(h.name.split(' (')[0]) ?? 0) + 1))
      cap.textContent = ''; cap.appendChild(el('b', undefined, `ปีมะแมเข้ามา ${r.hits.length} จุดในดวงคุณ`))
      cap.appendChild(el('span', 'why', Array.from(n).map(([k, c]) => (c > 1 ? `${k} ×${c}` : k)).join(' · ')))
      cap.appendChild(el('span', 'pl', 'แตะตัวอักษรที่มีกรอบสีเพื่อดูทีละจุด'))
    }
    const play = (list: Hit[]) => { stop(); let i = 0; const next = () => { if (i >= list.length) { if (list === r.hits) ts.push(later(summary, 1400)); return } const h = list[i++]; fly(h, () => { ts.push(later(next, 1250)) }) }; next() }
    on(again, 'click', () => { Object.values(cells).forEach((c) => c.classList.remove(...FX_ALL, 'hit', 'care', 'good', 'calm')); play(r.hits) })
    if (r.hits.length) {
      if ('IntersectionObserver' in window) {
        const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.disconnect(); ts.push(later(() => play(r.hits), 350)) } }), { threshold: 0.55 })
        io.observe(grid); cleanups.push(() => io.disconnect())
      } else play(r.hits)
    }
    return box
  }

  // bottom dock below the opening: one thumb-reach action for where the reader is
  const dock = el('div', 'dock'); const dockBtn = el('button', 'btn') as HTMLButtonElement; dockBtn.type = 'button'; dock.appendChild(dockBtn); root.appendChild(dock); cleanups.push(() => dock.remove())
  function updateDock() {
    const below = scrollY > cine.offsetTop + cine.offsetHeight - innerHeight * 0.5
    // only before a reading and for a visitor's login: members send from the share card (revision 0.11)
    dock.classList.toggle('on', below && !sheetOpen && !member)
    dockBtn.textContent = !reading ? 'ดูดวงปีมะแมของฉัน · ฟรี' : 'เข้าสู่ระบบ LINE ดูคำทำนายเต็ม'
  }
  on(dockBtn, 'click', () => {
    if (!reading) { glideTo(0.3, openSheet); return }
    api.track('taisui_login_click', { from: 'dock' }); api.login(typed)
  })

  // ③ + ⑧ red packet: drag the seal up to open; a tap also opens it
  const pz = $('pz'), env = $('env'), seal = $('seal'), burst = $('burst')
  if (api.hasRef) {
    $('pkSec').hidden = false
    if (api.sender) { $('pkFrom').textContent = api.sender.name; $('pkCardFrom').textContent = `อั่งเปาจาก ${api.sender.name}`; $('pkThem').textContent = `${api.sender.name} · ${api.sender.animal}`; $<HTMLImageElement>('pkThemImg').src = api.sender.image }
    const go = el('button', 'link', 'มีอั่งเปารออยู่ · แกะซอง'); go.type = 'button'; on(go, 'click', () => toSection('pkSec')); $('cta').appendChild(go)
  }
  for (let c = 0; c < 16; c++) { const q = el('div', 'coinq', 'Qi'); const an = Math.random() * Math.PI * 2, d = 120 + Math.random() * 120; q.style.setProperty('--dx', Math.cos(an) * d + 'px'); q.style.setProperty('--dy', Math.sin(an) * d - 60 + 'px'); q.style.setProperty('--rot', Math.random() * 540 - 270 + 'deg'); q.style.setProperty('--dl', (Math.random() * 0.25).toFixed(2) + 's'); burst.appendChild(q) }
  for (let f = 0; f < 14; f++) { const fl = el('i', 'flake'); fl.style.left = 10 + Math.random() * 80 + '%'; fl.style.setProperty('--dx', Math.random() * 80 - 40 + 'px'); fl.style.setProperty('--rot', Math.random() * 720 - 360 + 'deg'); fl.style.setProperty('--dl', (Math.random() * 0.6).toFixed(2) + 's'); pz.appendChild(fl) }
  const REASON: Record<string, string> = {
    own_packet: 'ซองนี้เป็นของคุณเอง ส่งให้เพื่อนเปิดได้เลยครับ', already_opened: 'คุณเปิดซองของคนนี้ไปแล้วครับ',
    receiver_daily_cap: 'วันนี้รับชี่จากอั่งเปาครบแล้ว พรุ่งนี้มาเปิดใหม่ได้ครับ', sender_daily_cap: 'ซองนี้แจกชี่ครบโควตาวันนี้แล้วครับ', unknown_code: 'ซองนี้หมดอายุหรือไม่ถูกต้องครับ',
  }
  async function openEnv() {
    if (env.classList.contains('open')) return
    env.classList.remove('dragging'); seal.classList.remove('drag', 'back'); env.style.removeProperty('--lift')
    env.classList.add('open'); pz.classList.add('open'); try { navigator.vibrate?.([18, 40, 25]) } catch { /* no vibration */ }
    api.track('taisui_packet_open', { member: member ? 1 : 0 })
    if (!member) { $('pkQi').textContent = 'ชี่ 5–10 รออยู่'; $('pkHint').textContent = 'เข้าสู่ระบบเพื่อรับชี่จากซองนี้'; $('pkLogin').hidden = false; return }
    const r = await api.openPacket()
    if (r?.paid && r.qi) { $('pkQi').textContent = `+${r.qi} ชี่`; $('pkHint').textContent = `ได้ ${r.qi} ชี่ เข้ากระเป๋าแล้วครับ` }
    else { $('pkQi').textContent = 'ชี่'; $('pkHint').textContent = REASON[r?.reason ?? ''] ?? 'ยังรับชี่ไม่ได้ ลองใหม่อีกครั้งครับ' }
  }
  on($('pkLogin'), 'click', () => { api.track('taisui_login_click', { from: 'packet' }); api.login(typed) })
  let y0: number | null = null, moved = 0
  on<PointerEvent>(seal, 'pointerdown', (e) => { if (env.classList.contains('open')) return; y0 = e.clientY; moved = 0; seal.setPointerCapture(e.pointerId); seal.classList.add('drag'); seal.classList.remove('back'); env.classList.add('dragging') })
  on<PointerEvent>(seal, 'pointermove', (e) => { if (y0 === null) return; const dy = Math.min(0, e.clientY - y0); moved = Math.max(moved, -dy); seal.style.setProperty('--dy', (dy * 0.9).toFixed(0) + 'px'); seal.style.setProperty('--rot', (dy * -0.15).toFixed(1) + 'deg'); env.style.setProperty('--lift', (Math.min(70, -dy) * 0.5).toFixed(0) + 'deg'); if (-dy > 70) { y0 = null; void openEnv() } })
  const endDrag = () => { if (y0 === null) return; const wasTap = moved < 6; y0 = null; seal.classList.remove('drag'); env.classList.remove('dragging'); if (wasTap) { void openEnv(); return } seal.classList.add('back'); seal.style.removeProperty('--dy'); seal.style.removeProperty('--rot'); env.style.removeProperty('--lift') }
  on(seal, 'pointerup', endDrag); on(seal, 'pointercancel', endDrag)
  on<KeyboardEvent>(seal, 'keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); void openEnv() } })

  // share card + send a packet
  const sh = $('share')
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) sh.classList.add('on') }), { threshold: 0.45 }); io.observe(sh); cleanups.push(() => io.disconnect()) } else sh.classList.add('on')
  on($('sendPk'), 'click', async () => {
    const r = await api.sendPacket()
    if (!r) { $('sendHint').textContent = 'ยังสร้างซองไม่ได้ ลองใหม่อีกครั้งครับ'; return }
    const text = 'ส่งอั่งเปาปีมะแมให้ แกะดูว่าปีนี้เราเข้ากันแค่ไหน แล้วรับชี่ฟรี'
    // LINE only: a friend who opens the link inside LINE logs in with one tap, no password page.
    window.location.href = `https://line.me/R/msg/text/?${encodeURIComponent(`${text} ${r.url}`)}`
    api.track('taisui_share', { channel: 'line' })
  })

  // the shop (revision 0.11): prices, codes and the Planner's order channel are the owner's to set
  // revision 0.12: the เสี่ยวมู่ card tries the chat first; the packages stay a small link
  on($('adMu'), 'click', () => api.track('taisui_shop', { item: 'mu' }))
  on($('adPkg'), 'click', () => api.track('taisui_shop', { item: 'packages' }))
  on($('deepStrip'), 'click', () => api.track('taisui_deeper', { from: 'strip' }))
  on($('adPlan'), 'click', () => { api.track('taisui_shop', { item: 'planner' }); $('adHint').textContent = 'Planner เปิดจองเร็วๆ นี้ เราจะแจ้งทาง LINE ของ MuMate ครับ' })

  // the LINE OA reward: asked once per page load as soon as the visitor is a member
  let oaAsked = false, oaWaiting = false
  let celDone = false
  let fromLogin: boolean | null = null
  const oaToast = el('div', 'oaToast'); oaToast.setAttribute('role', 'status'); oaToast.hidden = true; root.appendChild(oaToast); cleanups.push(() => oaToast.remove())
  function showOa(text: string, withAdd: boolean) {
    oaToast.textContent = ''
    const t = el('p'); t.textContent = text; oaToast.appendChild(t)
    if (withAdd) { const a = el('a', 'btn') as HTMLAnchorElement; a.href = api.oaUrl; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.textContent = 'แอด LINE รับ 100 ชี่'; on(a, 'click', () => { oaWaiting = true; api.track('taisui_oa_claim', { result: 'add_click' }) }); oaToast.appendChild(a) }
    const x = el('button', 'x') as HTMLButtonElement; x.type = 'button'; x.setAttribute('aria-label', 'ปิด'); x.textContent = '×'; on(x, 'click', () => { oaToast.hidden = true }); oaToast.appendChild(x)
    oaToast.hidden = false
  }
  async function claimOa() {
    const r = await api.claimOa().catch(() => ({ state: 'skip' as const }))
    api.track('taisui_oa_claim', { result: r.state })
    if (fromLogin === null) fromLogin = api.justLoggedIn()
    if (r.state === 'paid') { oaWaiting = false; oaToast.hidden = true; fromLogin = false; celebrateQi(r.qi, 'paid') }
    else if (r.state === 'not_friend') showOa('แอด LINE ของ MuMate เป็นเพื่อน รับเพิ่ม 100 ชี่ (ครั้งเดียว)', true)
    else {
      oaWaiting = false
      if (r.state === 'already') { oaToast.hidden = true; if (fromLogin) { fromLogin = false; celebrateQi(100, 'already') } }
    }
  }
  // revision 0.12: the paid QI as a bottom sheet, once; its buttons lead to sharing or the year
  // revision 0.13: right after a login from this page, an already-claimed reward is said once, not hidden
  function celebrateQi(qi: number, kind: 'paid' | 'already') {
    if (celDone) return
    celDone = true
    api.track('taisui_oa_cel', { action: kind === 'paid' ? 'shown' : 'already' })
    const close = celebrate(root, {
      qi, kind, img: '/images/v2/mascot/personas/mu/happy.png', still,
      deepHref: deeperHref(reading?.chart.source ?? 'typed'),
      onSend: () => { api.track('taisui_oa_cel', { action: 'send' }); $('sendPk').click() },
      onRead: () => { api.track('taisui_oa_cel', { action: 'read' }); toSection('yearSec') },
      onDeep: () => api.track('taisui_deeper', { from: 'sheet' }),
      onClose: () => undefined,
    })
    cleanups.push(close)
  }
  // back from adding the OA: ask again once
  on(document, 'visibilitychange', () => { if (document.visibilityState === 'visible' && oaWaiting) { oaWaiting = false; void claimOa() } })

  // apply a reading to every scene
  function apply(r: TaisuiReading) {
    reading = r; member = !r.locked
    api.track('taisui_result', { pillars: r.pillars.length, member: member ? 1 : 0 })
    renderPillars(r); renderMonths(r); renderReads(r)
    root.querySelectorAll<HTMLElement>('[data-full]').forEach((s) => { s.hidden = !member })
    const year = r.pillars.find((p) => p.key === 'year')
    if (year) { $<HTMLImageElement>('pkMeImg').src = year.image; $('pkMe').textContent = `คุณ · ${year.animal}` }
    if (r.partner) { const rel = el('span'); rel.textContent = PAIR_LINE[r.partner.relation as Relation]; $('pkRel').textContent = ''; $('pkRel').appendChild(rel) }
    const meds = $('meds'); meds.textContent = ''
    r.pillars.forEach((p, i) => { const d = el('div'); d.style.setProperty('--i', String(i)); const im = el('img'); im.src = p.image; im.alt = ''; d.appendChild(im); d.appendChild(document.createTextNode(p.animal)); meds.appendChild(d) })
    // the share card keeps a short title: the year pillar's two-word preview, not the long card headline
    $('scT').textContent = member && year ? `${year.preview[0]} · ${year.preview[1]}` : 'ปีมะแมของฉัน'
    $('start').textContent = 'ดูดวงปีมะแมของฉัน'
    $('member').hidden = true
    // revision 0.12: the deeper reading opens the chat for a saved chart, registration for a typed one
    const deep = deeperHref(r.chart.source); $<HTMLAnchorElement>('deepStrip').href = deep; $<HTMLAnchorElement>('adMu').href = deep; $<HTMLAnchorElement>('adPkg').href = DEEPER_PACKAGES
    if (member && !oaAsked) { oaAsked = true; void claimOa() }
    entered = false; frame()
  }

  // members with a saved chart: no sheet
  api.track('taisui_open', { ref: api.hasRef ? 1 : 0 })
  void api.loadReading().then((res) => { if (res.ok) apply(res.reading) })
  root.querySelectorAll<HTMLElement>('[data-full]').forEach((s) => { s.hidden = true })
  frame()

  return () => { cleanups.forEach((f) => f()); timers.forEach((t) => window.clearTimeout(t)) }
}
