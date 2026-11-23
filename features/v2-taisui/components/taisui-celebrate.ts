// ปีชง 2570 (revision 0.12): the 100 QI from the LINE OA, celebrated once, as a bottom sheet with
// เสี่ยวมู่ above it. Shown only after bazi has paid. Built with createElement and textContent only.
export type CelebrateOpts = {
  qi: number
  img: string
  still: boolean
  deepHref: string
  onSend: () => void
  onRead: () => void
  onDeep: () => void
  onClose: () => void
}

const COLORS = ['#ebbf30', '#e1ff00', '#ff5a4d', '#fff7e6', '#ff8a3d', '#06C755']

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag)
  if (cls) n.className = cls
  if (text !== undefined) n.textContent = text
  return n
}

/** Opens the sheet; returns a function that removes it at once (page cleanup). */
export function celebrate(host: HTMLElement, o: CelebrateOpts): () => void {
  host.querySelector('.cel')?.remove()
  const root = el('div', 'cel'); root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', `ได้รับ ${o.qi} ชี่`)
  const scrim = el('div', 'celScrim'); root.appendChild(scrim)
  const card = el('div', 'celCard')
  card.tabIndex = -1
  const mu = el('div', 'celMu'); const im = el('img'); im.src = o.img; im.alt = 'เสี่ยวมู่'; mu.appendChild(im); card.appendChild(mu)
  card.appendChild(el('div', 'celK', 'ขอบคุณที่เป็นเพื่อน MuMate ใน LINE'))
  const big = el('div', 'celBig'); const num = el('span', undefined, o.still ? `+${o.qi}` : '+0'); big.appendChild(num); big.appendChild(el('small', undefined, 'ชี่')); card.appendChild(big)
  card.appendChild(el('p', 'celUse celLate', 'เข้ากระเป๋าแล้ว ใช้ถามเสี่ยวมู่ต่อได้ เมื่อสิทธิ์ถามฟรีของวันนั้นหมด'))
  const acts = el('div', 'celActs celLate')
  const send = el('button', 'celP', 'ส่งอั่งเปาให้เพื่อน'); send.type = 'button'
  const read = el('button', 'celS', 'อ่านคำทำนายเต็มของฉัน'); read.type = 'button'
  acts.append(send, read); card.appendChild(acts)
  const deep = el('a', 'celDeep celLate') as HTMLAnchorElement; deep.href = o.deepHref
  deep.appendChild(document.createTextNode('อยากรู้ลึกกว่านี้? ')); deep.appendChild(el('b', undefined, 'ถามเสี่ยวมู่ด้วยชี่ที่เพิ่งได้ ›')); card.appendChild(deep)
  const x = el('button', 'celX', '×'); x.type = 'button'; x.setAttribute('aria-label', 'ปิด'); card.appendChild(x)
  const fx = el('div', 'celFx'); fx.setAttribute('aria-hidden', 'true')
  root.append(card, fx); host.appendChild(root)

  const timers: number[] = []
  let done = false
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
  const remove = () => { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); root.remove() }
  function close() { if (done) return; done = true; root.classList.remove('on'); timers.push(window.setTimeout(remove, 450)); o.onClose() }
  send.addEventListener('click', () => { close(); o.onSend() })
  read.addEventListener('click', () => { close(); o.onRead() })
  deep.addEventListener('click', () => o.onDeep())
  x.addEventListener('click', close); scrim.addEventListener('click', close)
  document.addEventListener('keydown', onKey)
  requestAnimationFrame(() => requestAnimationFrame(() => { root.classList.add('on'); card.focus({ preventScroll: true }) }))
  try { navigator.vibrate?.([20, 60, 30]) } catch { /* no vibration */ }
  if (o.still) return remove

  // count up once the sheet has landed, then pop
  const t0 = performance.now() + 420, dur = 900
  const tick = (t: number) => {
    const k = Math.min(1, Math.max(0, (t - t0) / dur))
    num.textContent = `+${Math.round(o.qi * (1 - Math.pow(1 - k, 3)))}`
    if (k < 1 && root.isConnected) requestAnimationFrame(tick); else big.classList.add('celPop')
  }
  requestAnimationFrame(tick)
  for (let i = 0; i < 64; i++) {
    const c = el('i', 'celCf'); c.style.left = `${Math.random() * 100}%`; c.style.background = COLORS[i % COLORS.length]
    c.style.setProperty('--dx', `${(Math.random() * 160 - 80).toFixed(0)}px`); c.style.setProperty('--r', `${(Math.random() * 900 - 450).toFixed(0)}deg`)
    c.style.setProperty('--d', `${(2 + Math.random() * 1.6).toFixed(2)}s`); c.style.setProperty('--dl', `${(0.15 + Math.random() * 0.7).toFixed(2)}s`)
    if (i % 3 === 0) { c.style.width = '8px'; c.style.height = '8px'; c.style.borderRadius = '50%' }
    fx.appendChild(c)
  }
  timers.push(window.setTimeout(() => {
    const r = big.getBoundingClientRect(); const cx = r.left + r.width / 2, cy = r.top + r.height / 2
    for (let i = 0; i < 16; i++) {
      const q = el('i', 'celCoin', 'Qi'); const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3, d = 90 + Math.random() * 110
      q.style.setProperty('--x', `${cx}px`); q.style.setProperty('--y', `${cy}px`)
      q.style.setProperty('--dx', `${(Math.cos(a) * d).toFixed(0)}px`); q.style.setProperty('--dy', `${(Math.sin(a) * d).toFixed(0)}px`)
      q.style.setProperty('--r', `${(Math.random() * 360 - 180).toFixed(0)}deg`); q.style.setProperty('--dl', `${(Math.random() * 0.2).toFixed(2)}s`)
      fx.appendChild(q)
    }
  }, 460))
  return remove
}
