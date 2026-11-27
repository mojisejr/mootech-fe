// features/v2-home/components/PromoPopup.tsx — ป็อปอัปหน้าแรก: โปรฯ "เช็กอินรับ Qi" อย่างเดียว (เอ็ม 2026-09-23).
// (โปรฯ อื่นย้ายไป carousel ในหน้าหลักแล้ว — features/v2-home/components/PromoCarousel.tsx)
//
// ประกาศปิดปรับปรุง (mumate-maintenance-notice-001, 2026-10-06): ก่อน NOTICE.until ป็อปอัปนี้แสดง "ประกาศแจ้ง
// ปิดปรับปรุงระบบ" แทนโปรฯ เช็กอิน — ให้ทุกคนเห็น (ล็อกอินหรือยังก็ได้), ไม่อ่าน wallet, แตะรูป = ปิด (ไม่พาไปไหน),
// "รับทราบ" = ไม่เด้งอีกจนหมดประกาศ. "ครั้งเดียวต่อ session" นับตอนผู้ใช้ปิด ไม่ใช่ตอนเด้ง — deploy ใหม่ทำให้ service
// worker สั่ง reload หน้า 1 ครั้ง (pages/_app.tsx controllerchange) ไม่กี่วินาทีหลังเข้าเว็บ ถ้านับตอนเด้ง ผู้ใช้เห็นแวบเดียวแล้วหาย
// (owner ลองบนมือถือ 2026-10-06). ตั้งแต่ NOTICE.until (เริ่มรอบย้าย server) กลับเป็นโปรฯ เช็กอินตามเดิมเอง —
// ไม่ต้อง deploy ซ้ำ (SHA เดียวกันรันทั้งบน Vercel ก่อนย้ายและบน DigitalOcean หลังย้าย).
// เลื่อนรอบย้าย = แก้ until + รูป แล้ว release ใหม่.
//
// พฤติกรรมโปรฯ เช็กอิน:
//   • เฉพาะสมาชิกที่ล็อกอินแล้ว (useCurrentUser = 'authed') และยังไม่เช็กอินวันนี้ (mumate-promo-popup-auth-001):
//     'anon' ไม่เด้ง, 'loading' รอ (คนที่กลับจาก LINE ค้าง 'loading' ได้ ~17 วิ ระหว่าง mint identity).
//     เช็กใหม่ทุกครั้งที่ status/path เปลี่ยน — /v2/login ส่งสมาชิกไป /v2 ด้วย router.replace (ไม่ remount).
//     อ่าน /api/qi-wallet ครั้งเดียว: เช็กอินวันนี้แล้ว = ไม่เด้ง; อ่านไม่ได้ = เด้ง (แย่สุด = พฤติกรรมเดิม)
//   • เด้งครั้งเดียวต่อ session ในหน้า /v2 แรกที่เข้าเงื่อนไข (ยกเว้นหน้า login/สมัคร/หาธาตุแท้)
//   • ปิด (X / แตะพื้นหลัง) = ปิดรอบนี้ (ไม่เด้งซ้ำใน session นี้)
//   • "ไม่แสดง 7 วัน" = จำใน localStorage 7 วัน
//   • แตะรูป = ไปหน้าเช็กอิน
//
// โปรช่วงเวลา "Limited time" (Home v3 รอบแรก · ประชุม 24 พ.ย. 2569 ข้อ 1):
//   • มีโปร (GET /api/v2/limited-offer ตอบ offer) → ขึ้นก่อนป๊อปอัปเช็กอิน และใช้โควตา "ครั้งเดียวต่อ session" ร่วมกัน
//   • ราคาเดิม/ราคาโปรมาจากเซิร์ฟเวอร์ (ตัวคิดเดียวกับ checkout) · นาฬิกานับถอยหลัง = เวลาที่เหลือจริงถึงวันหมดโค้ด
//     (ไม่ใช่ตัวจับเวลา 15 นาทีแบบในเฟรม — ไม่ทำให้ผู้ใช้เข้าใจว่าโปรหมดทั้งที่ยังใช้ได้) · โค้ดไม่มีวันหมด = ไม่โชว์นาฬิกา
//   • "ซื้อเลย" = ไป checkout พร้อมโค้ด · "ไว้ก่อน" = ปิดรอบนี้ · หมดเวลาแล้ว (cache เก่า) = ปุ่มซื้อใช้ไม่ได้ ไปร้านแทน
//   • ยังไม่มี artwork จากน้องเซิน → รอบนี้เป็นการ์ดตัวอักษร/ตัวเลข สีตามชุดของแอป
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useCurrentUser } from '@/lib/auth/use-current-user'
import { checkedInToday, todayBangkok, type Wallet } from '@/features/v2-qi/qi-model'
import { useTourActive } from '@/features/v2-guide/OnboardingTour'
import { LIMITED_OFFER_HREF, formatCountdown, parseOffer, type LimitedOffer } from '../limited-offer'
import { track } from '@/lib/analytics/track'

const CHECKIN = { src: '/images/v2/popup/checkin.png', href: '/v2/qi/checkin', alt: 'เช็กอินทุกวัน รับ Qi ฟรี' }
const HIDE_KEY = 'mumate:promo-hidden-until' // localStorage: timestamp ที่ให้กลับมาแสดงได้ (ไม่แสดง 7 วัน)
const SHOWN_KEY = 'mumate:promo-shown' // sessionStorage: ตัดสินแล้วรอบนี้ — เด้งไปแล้ว หรือเช็กอินแล้ว (กันอ่าน wallet/เด้งซ้ำทุกครั้งที่เปลี่ยนหน้า)
const HIDE_DAYS = 7

// รูปจากทีม (1040x1300) — ข้อความอยู่ในรูป จึงใส่ครบใน alt ให้ screen reader อ่านได้
export const NOTICE = {
  src: '/images/v2/popup/maintenance-20261009.png',
  alt: 'ประกาศแจ้ง Mumate ปิดปรับปรุงระบบชั่วคราว วันศุกร์ที่ 9 ตุลาคม 2569 เวลา 04.00-10.00 น. ไม่สามารถใช้งานได้ ขออภัยในความไม่สะดวก',
  width: 1040,
  height: 1300,
  until: Date.parse('2026-10-09T04:00:00+07:00'), // เริ่มรอบย้าย: หลังจากนี้ทุกคนเห็นหน้า maintenance อยู่แล้ว
}
const NOTICE_HIDE_KEY = 'mumate:notice-20261009-hidden' // localStorage: กด "รับทราบ" แล้ว
const NOTICE_CLOSED_KEY = 'mumate:notice-20261009-closed' // sessionStorage: ผู้ใช้ปิดแล้วรอบนี้ (X / พื้นหลัง / แตะรูป)
export const noticeActive = (now = Date.now()) => now < NOTICE.until

// ไม่เด้งบนหน้าที่ไม่ใช่แอปหลัก + หน้าหาธาตุแท้ (เอ็ม: ไม่เอา popup ในหน้านี้)
// /v2/policy-update: the updated-policy screen must not be covered by a promotion (CIEL mumate-pdpa-reconsent-001)
const EXCLUDE = ['/v2/login', '/v2/register', '/v2/onboarding', '/v2/first-run', '/v2/first-run-preview', '/v2/element-finder', '/v2/policy-update']
export function isPromoPath(path: string): boolean {
  if (!(path === '/v2' || path.startsWith('/v2/'))) return false
  return !EXCLUDE.some((p) => path === p || path.startsWith(`${p}/`))
}

function hiddenNow(): boolean {
  try {
    const until = Number(window.localStorage.getItem(HIDE_KEY))
    return Number.isFinite(until) && until > Date.now()
  } catch { return false }
}
function shownThisSession(): boolean {
  try { return window.sessionStorage.getItem(SHOWN_KEY) === '1' } catch { return false }
}
function noticeDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTICE_HIDE_KEY) === '1' || window.sessionStorage.getItem(NOTICE_CLOSED_KEY) === '1'
  } catch { return false }
}

// อ่านไม่ได้ (เครือข่าย/5xx/รูปร่างผิด) = false → เด้ง
async function alreadyCheckedInToday(): Promise<boolean> {
  try {
    const res = await fetch('/api/qi-wallet')
    if (!res.ok) return false
    const wallet = (await res.json()) as Wallet
    return checkedInToday(wallet?.history, todayBangkok())
  } catch { return false }
}

// อ่านไม่ได้ = ไม่มีโปร (ทำงานแบบเดิม — ป๊อปอัปเช็กอิน) ไม่เดาจาก response ครึ่ง ๆ กลาง
async function fetchLimitedOffer(): Promise<LimitedOffer | null> {
  try {
    const res = await fetch(LIMITED_OFFER_HREF)
    return res.ok ? parseOffer(await res.json().catch(() => null)) : null
  } catch { return null }
}

export function PromoPopup() {
  const router = useRouter()
  const { status } = useCurrentUser()
  const [open, setOpen] = useState<'notice' | 'checkin' | 'limited' | null>(null)
  const [offer, setOffer] = useState<LimitedOffer | null>(null)
  // นาฬิกาของป๊อปอัปโปร — เดินเฉพาะตอนเปิดและเมื่อโค้ดมีวันหมด (เฟรมเดิมของป๊อปอัปเช็กอินไม่มีนาฬิกา)
  const [now, setNow] = useState(() => Date.now())
  // ทัวร์แนะนำแอปกำลังเล่น → ป็อปอัปรอก่อน (ไม่บังส่วนที่ส่อง) แล้วค่อยขึ้นหลังจบทัวร์
  const touring = useTourActive()

  useEffect(() => {
    if (open !== 'limited' || !offer?.endsAt) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [open, offer?.endsAt])

  useEffect(() => {
    if (!isPromoPath(router.pathname)) return
    if (noticeActive()) {
      // ประกาศ: ทุกคน ไม่ดู status/wallet · โปรฯ เช็กอินไม่เด้งช่วงนี้
      if (noticeDismissed()) return
      // ไม่จดตอนเด้ง: ถ้าหน้า reload ก่อนผู้ใช้ปิด (service worker ตัวใหม่) ประกาศต้องเด้งกลับมา
      const t = setTimeout(() => setOpen('notice'), 1200)
      return () => clearTimeout(t)
    }
    if (status !== 'authed') return
    if (hiddenNow() || shownThisSession()) return
    let alive = true
    const delay = new Promise((resolve) => setTimeout(resolve, 1200))
    // อ่านครั้งเดียว: มีโปร → เด้งโปรก่อน · ไม่มีโปร → เด้งเช็กอินเมื่อยังไม่เช็กอินวันนี้
    void Promise.all([alreadyCheckedInToday(), delay, fetchLimitedOffer()]).then(([done, , limited]) => {
      if (!alive) return
      try { window.sessionStorage.setItem(SHOWN_KEY, '1') } catch { /* private mode */ }
      if (limited) {
        setOffer(limited)
        setOpen('limited')
        track('promo_offer_view', { offer: limited.packageCode })
        return
      }
      if (!done) setOpen('checkin')
    })
    return () => { alive = false }
  }, [status, router.pathname])

  const close = () => {
    if (open === 'notice') {
      try { window.sessionStorage.setItem(NOTICE_CLOSED_KEY, '1') } catch { /* private mode */ }
    }
    if (open === 'limited' && offer) track('promo_offer_click', { offer: offer.packageCode, action: 'close' })
    setOpen(null)
  }
  const hide7d = () => {
    try { window.localStorage.setItem(HIDE_KEY, String(Date.now() + HIDE_DAYS * 24 * 60 * 60 * 1000)) } catch { /* private mode */ }
    setOpen(null)
  }
  const acknowledge = () => {
    try { window.localStorage.setItem(NOTICE_HIDE_KEY, '1') } catch { /* private mode */ }
    setOpen(null)
  }
  const go = () => { setOpen(null); void router.push(CHECKIN.href) }
  const buyOffer = () => {
    if (!offer) return
    track('promo_offer_click', { offer: offer.packageCode, action: 'buy' })
    setOpen(null)
    void router.push(offer.href)
  }
  const laterOffer = () => {
    if (offer) track('promo_offer_click', { offer: offer.packageCode, action: 'later' })
    setOpen(null)
  }

  if (!open || touring) return null

  const notice = open === 'notice'
  const limited = open === 'limited' ? offer : null
  const tid = notice ? 'maintenance-notice' : limited ? 'promo-offer' : 'promo-popup'
  const countdown = limited?.endsAt ? formatCountdown(Date.parse(limited.endsAt) - now) : ''
  const expired = limited?.endsAt !== null && limited?.endsAt !== undefined && countdown === ''

  return (
    <div className={`fixed inset-0 z-[75] flex items-center justify-center px-8 ${notice ? 'bg-black/60' : 'bg-black/50'}`} onClick={close} data-testid={`${tid}-scrim`}>
      <div className="relative w-full max-w-[340px]" onClick={(e) => e.stopPropagation()}
        {...(notice || limited ? { role: 'dialog', 'aria-modal': true, 'aria-label': notice ? NOTICE.alt : 'โปรช่วงเวลา' } : {})}>
        {limited ? (
          /* การ์ดโปรช่วงเวลา — ราคาทุกบาทมาจากเซิร์ฟเวอร์ · นาฬิกา = เวลาจริงถึงวันหมดโค้ด (รอ artwork จากน้องเซิน) */
          <div data-testid="promo-offer-card" className="overflow-hidden rounded-[28px] bg-white p-6 text-center shadow-[0_12px_40px_rgba(0,0,0,0.35)]">
            <p className="text-[12px] font-black uppercase tracking-wider text-v3-cyan">Limited time</p>
            <h2 className="mt-1 text-[20px] font-black leading-7 text-v3-navy" data-testid="promo-offer-title">
              {limited.name}{limited.period ? ` ${limited.period}` : ''}
            </h2>
            <p className="mt-2 text-[13px] leading-5 text-v3-text-body" data-testid="promo-offer-off">
              {limited.percentOff > 0 ? `ลด ${limited.percentOff}% จาก ` : 'จาก '}<s>฿{limited.listBaht.toLocaleString('th-TH')}</s>
            </p>
            <p className="text-[40px] font-black leading-[48px] text-v3-pumpkin" data-testid="promo-offer-price">฿{limited.priceBaht.toLocaleString('th-TH')}</p>
            {limited.endsAt && (
              <p className="mt-1 text-[13px] font-bold text-v3-text-body" data-testid="promo-offer-countdown">
                {expired ? 'โปรนี้หมดเวลาแล้ว' : `เหลือเวลาอีก ${countdown} น.`}
              </p>
            )}
            <div className="mt-4 flex flex-col gap-2">
              {expired ? (
                <button type="button" onClick={() => { setOpen(null); void router.push('/v2/shop') }} data-testid="promo-offer-shop"
                  className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-v3-lime">
                  ดูแพ็กเกจทั้งหมด
                </button>
              ) : (
                <button type="button" onClick={buyOffer} data-testid="promo-offer-buy"
                  className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-bold text-v3-lime">
                  ซื้อเลย
                </button>
              )}
              <button type="button" onClick={laterOffer} data-testid="promo-offer-later"
                className="grid h-11 w-full place-items-center rounded-full border border-v3-border-card bg-white text-[14px] font-bold text-v3-navy">
                ไว้ก่อน
              </button>
            </div>
          </div>
        ) : (
        <button type="button" onClick={notice ? close : go} data-testid={`${tid}-image`} aria-label={notice ? NOTICE.alt : CHECKIN.alt}
          className={notice ? 'block w-full drop-shadow-[0_8px_20px_rgba(0,0,0,0.25)]' : 'block w-full overflow-hidden rounded-[24px] shadow-[0_12px_40px_rgba(0,0,0,0.35)]'}>
          {notice
            ? <Image src={NOTICE.src} alt={NOTICE.alt} width={NOTICE.width} height={NOTICE.height} priority className="h-auto w-full object-contain" />
            : <Image src={CHECKIN.src} alt={CHECKIN.alt} width={1000} height={1300} priority className="h-auto w-full object-contain" />}
        </button>
        )}

        <button type="button" onClick={close} aria-label="ปิด" data-testid={`${tid}-close`}
          className="absolute -top-3 -right-3 grid size-9 place-items-center rounded-full bg-white text-v3-navy shadow-lg">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
        </button>

        {notice && (
          <button type="button" onClick={acknowledge} data-testid="maintenance-notice-ack"
            className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
            รับทราบ
          </button>
        )}

        {!notice && !limited && (
          <button type="button" onClick={hide7d} data-testid="promo-popup-hide"
            className="mt-2 block w-full text-center text-[12px] font-medium text-white/80 underline">
            ไม่แสดงอีกใน 7 วัน
          </button>
        )}
      </div>
    </div>
  )
}
