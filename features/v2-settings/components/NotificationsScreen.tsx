// features/v2-settings/components/NotificationsScreen.tsx — /v2/settings/notifications
// เฟรม `settings-notifications`: 6 หมวดตาม Figma (~12 สวิตช์) + สถานะ PWA push + ทางไปจัดการยาม/ปฏิทิน
//   • 3 คีย์เชื่อม engine จริง (GET/PUT /api/notification-prefs): dailyFortune, reminders, updates
//   • ที่เหลือเก็บใน localStorage ต่ออุปกรณ์ (ยังไม่มี backend รองรับ) — behave เหมือนสวิตช์จริง
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { SkyBackdrop, SkyHeader, Toggle } from '@/features/v2-profile/components/kit'
import { ProfileGate } from '@/features/v2-account/components/ProfileGate'
import { dailyReminderAccessNote, type DailyReminderAccess } from '@/lib/v2/daily-fortune-access'

const CARD = 'flex w-full flex-col rounded-[24px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'
const LOCAL_STORE = 'mumate:notif-prefs-v1'
// ช่วงเวลาที่ให้เลือกสำหรับ "ดวงประจำวัน" (ทุกครึ่งชั่วโมง) — เวลาที่ผู้ใช้เคยตั้งไว้นอกช่วงจะถูกเติมเข้าตัวเลือกให้เอง
const DAILY_TIME_OPTIONS: string[] = Array.from({ length: 9 }, (_, i) => {
  const h = 6 + Math.floor(i / 2)
  const m = i % 2 === 0 ? '00' : '30'
  return `${String(h).padStart(2, '0')}:${m}`
})
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`

/** ฝั่ง client: ข้อความรองของแถว "ดวงประจำวัน" จากเวลาที่ตั้ง + สิทธิ์ (null = ยังไม่โหลด → ข้อความเริ่มต้น) */
export function dailyFortuneSubText(time: { hour: number; minute: number } | null, access: DailyReminderAccess | null): string {
  const base = `ส่งทุกเช้าเวลา ${time ? hhmm(time.hour, time.minute) : '07:00'} น.`
  return base + dailyReminderAccessNote(access)
}

type Prefs = { dailyFortune?: boolean; reminders?: boolean; updates?: boolean }
type LocalPrefs = {
  master: boolean
  streakRisk: boolean
  friendJoined: boolean
  qiLow: boolean
  billing: boolean
  newLogin: boolean
  features: boolean
  channelPush: boolean
  channelLine: boolean
  channelEmail: boolean
}
const LOCAL_DEFAULTS: LocalPrefs = {
  master: true,
  streakRisk: true,
  friendJoined: true,
  qiLow: false,
  billing: true,
  newLogin: true,
  features: false,
  channelPush: true,
  channelLine: true,
  channelEmail: true,
}

type Item =
  | { title: string; sub?: string; src: 'server'; key: keyof Prefs; testId: string }
  | { title: string; sub?: string; src: 'local'; key: keyof Omit<LocalPrefs, 'master'>; testId: string }
type Group = { title: string; testId: string; items: Item[] }

const GROUPS: Group[] = [
  {
    title: 'ดวงและการเช็คอิน',
    testId: 'notif-group-fortune',
    items: [
      { title: 'ดวงประจำวัน', sub: 'ส่งทุกเช้าเวลา 07:00 น.', src: 'server', key: 'dailyFortune', testId: 'notif-daily' },
      { title: 'เตือนเช็คอิน', sub: 'กันลืมเช็คอินช่วงเย็น 20:00 น.', src: 'server', key: 'reminders', testId: 'notif-reminders' },
      { title: 'ใกล้เสียสถิติต่อเนื่อง', sub: 'เตือนเมื่อใกล้ขาดวันเช็คอิน', src: 'local', key: 'streakRisk', testId: 'notif-streakrisk' },
    ],
  },
  {
    title: 'พลังชี่และเพื่อน',
    testId: 'notif-group-qi',
    items: [
      { title: 'เพื่อนสมัครสำเร็จ', sub: 'เมื่อเพื่อนที่คุณชวนเริ่มใช้งาน', src: 'local', key: 'friendJoined', testId: 'notif-friend' },
      { title: 'QI ใกล้หมด', sub: 'เตือนเมื่อเหลือน้อยกว่า 30 QI', src: 'local', key: 'qiLow', testId: 'notif-qilow' },
    ],
  },
  {
    title: 'บัญชีและการชำระเงิน',
    testId: 'notif-group-billing',
    items: [
      { title: 'ใบเสร็จและการต่ออายุ', sub: 'ใบเสร็จและแจ้งก่อนแพ็กเกจหมดอายุ', src: 'local', key: 'billing', testId: 'notif-billing' },
      { title: 'เข้าสู่ระบบจากอุปกรณ์ใหม่', sub: 'แจ้งเพื่อความปลอดภัยของบัญชี', src: 'local', key: 'newLogin', testId: 'notif-newlogin' },
    ],
  },
  {
    title: 'ข่าวสารและโปรโมชัน',
    testId: 'notif-group-news',
    items: [
      { title: 'โปรโมชันและส่วนลด', sub: 'แพ็กเกจใหม่ โบนัส และดีลพิเศษ', src: 'server', key: 'updates', testId: 'notif-updates' },
      { title: 'ฟีเจอร์ใหม่', sub: 'อัปเดตฟีเจอร์และบริการใหม่ ๆ', src: 'local', key: 'features', testId: 'notif-features' },
    ],
  },
  {
    title: 'ช่องทางที่ได้รับ',
    testId: 'notif-group-channels',
    items: [
      { title: 'แจ้งเตือนในแอป (Push)', src: 'local', key: 'channelPush', testId: 'notif-ch-push' },
      { title: 'LINE', sub: 'ส่งผ่าน LINE Official ของ MuMate', src: 'local', key: 'channelLine', testId: 'notif-ch-line' },
      { title: 'อีเมล', sub: 'เฉพาะใบเสร็จและเรื่องบัญชี', src: 'local', key: 'channelEmail', testId: 'notif-ch-email' },
    ],
  },
]

function readLocal(): LocalPrefs {
  try {
    const raw = typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_STORE) : null
    if (raw) return { ...LOCAL_DEFAULTS, ...(JSON.parse(raw) as Partial<LocalPrefs>) }
  } catch {
    /* ignore */
  }
  return { ...LOCAL_DEFAULTS }
}

export function NotificationsScreen() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [local, setLocal] = useState<LocalPrefs>(LOCAL_DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'ok' | 'not_authenticated' | 'failed'>('ok')
  const [pushState, setPushState] = useState<'unsupported' | NotificationPermission>('default')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  // ประชุม 24 พ.ย. ข้อ 6: เวลาส่ง + สิทธิ์ของ "ดวงประจำวัน" (Plus/Pro ทุกวัน · ฟรี 7 วันจากวันสมัคร) — null = ยังไม่โหลด/โหลดไม่ได้
  const [fortune, setFortune] = useState<{ hour: number; minute: number; access: DailyReminderAccess } | null>(null)
  const [savingTime, setSavingTime] = useState(false)

  const master = local.master

  // โหลดเวลา/สิทธิ์แบบ best-effort — ล้มไม่ควรทำให้ทั้งจอแจ้งเตือนเสีย (แถว "ดวงประจำวัน" ยังใช้ข้อความเริ่มต้น)
  const loadFortune = useCallback(async () => {
    try {
      const res = await fetch('/api/v2/daily-fortune-reminder')
      const j = (await res.json().catch(() => null)) as { hour?: unknown; minute?: unknown; access?: DailyReminderAccess } | null
      if (res.ok && typeof j?.hour === 'number' && typeof j?.minute === 'number' && j.access) {
        setFortune({ hour: j.hour, minute: j.minute, access: j.access })
      }
    } catch {
      /* ignore */
    }
  }, [])

  const saveFortuneTime = async (value: string) => {
    const [h, m] = value.split(':').map(Number)
    if (!Number.isInteger(h) || !Number.isInteger(m) || savingTime) return
    setSavingTime(true)
    try {
      const res = await fetch('/api/v2/daily-fortune-reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time: value }),
      })
      const j = (await res.json().catch(() => null)) as { hour?: unknown; minute?: unknown; access?: DailyReminderAccess } | null
      if (res.ok && typeof j?.hour === 'number' && typeof j?.minute === 'number' && j.access) {
        setFortune({ hour: j.hour, minute: j.minute, access: j.access })
      }
    } finally {
      setSavingTime(false)
    }
  }

  // ครบภารกิจ enable_notif (best-effort, engine กันซ้ำเอง) — เมื่อเปิดแจ้งเตือนช่องใดช่องหนึ่งจริง
  const reportNotifEnabled = useCallback(() => {
    void fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ missionId: 'enable_notif' }),
    }).catch(() => {})
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setKind('ok')
    try {
      const res = await fetch('/api/notification-prefs')
      if (res.status === 401) {
        setKind('not_authenticated')
        return
      }
      if (!res.ok) {
        setKind('failed')
        return
      }
      const p = (await res.json()) as Prefs
      setPrefs(p)
      // เคยเปิดไว้แล้ว (หรืออนุญาต push บนเบราว์เซอร์) → นับภารกิจให้เลย
      if (p.dailyFortune || p.reminders || p.updates || (typeof Notification !== 'undefined' && Notification.permission === 'granted')) {
        reportNotifEnabled()
      }
    } finally {
      setLoading(false)
    }
  }, [reportNotifEnabled])

  useEffect(() => {
    void load()
    void loadFortune()
    setLocal(readLocal())
    if (typeof Notification !== 'undefined') setPushState(Notification.permission)
    else setPushState('unsupported')
  }, [load, loadFortune])

  const saveLocal = (next: LocalPrefs) => {
    setLocal(next)
    try {
      window.localStorage.setItem(LOCAL_STORE, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const toggleServer = async (key: keyof Prefs) => {
    if (!prefs) return
    setSavingKey(key)
    const next = { ...prefs, [key]: !prefs[key] }
    try {
      const res = await fetch('/api/notification-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (res.ok) {
        setPrefs(next)
        if (next[key]) reportNotifEnabled() // เพิ่งเปิดช่องนี้ → นับภารกิจ
      }
    } finally {
      setSavingKey(null)
    }
  }

  const isOn = (it: Item): boolean =>
    Boolean(master && (it.src === 'server' ? prefs?.[it.key] : local[it.key]))

  const onToggle = (it: Item) => {
    if (it.src === 'server') void toggleServer(it.key)
    else saveLocal({ ...local, [it.key]: !local[it.key] })
  }

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>การแจ้งเตือน · MuMate</title></Head>
      <SkyHeader title="การแจ้งเตือน" backHref="/v2/settings" testId="notifications" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === 'ok' && (
          <>
            <section className={CARD} data-testid="notif-push">
              <p className="text-[13px] font-bold text-v3-navy">การแจ้งเตือนบนอุปกรณ์นี้ (เบราว์เซอร์)</p>
              {pushState === 'unsupported' ? (
                <p className="text-[13px] leading-5 text-v3-text-body">อุปกรณ์/เบราว์เซอร์นี้ไม่รองรับการแจ้งเตือนแบบ push</p>
              ) : pushState === 'granted' ? (
                <p className="text-[13px] font-bold text-v3-sapphire" data-testid="notif-push-state">เปิดใช้แล้ว ✓</p>
              ) : (
                <p className="text-[13px] leading-5 text-v3-text-body">
                  ยังไม่ได้อนุญาต — เปิดผ่านปุ่มล็อกของเบราว์เซอร์ หรือติดตั้งแอป (PWA) แล้วกดอนุญาต
                </p>
              )}
              <Link href="/v2/calendar/notifications" data-testid="notif-manage-reminders" className="mt-1 text-[13px] font-bold text-v3-cyan">
                จัดการแจ้งเตือนยาม/ปฏิทิน →
              </Link>
            </section>

            {/* สวิตช์รวม (เฟรม: เปิดการแจ้งเตือนทั้งหมด) */}
            <section className={CARD} data-testid="notif-master">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold text-v3-navy">เปิดการแจ้งเตือนทั้งหมด</p>
                  <p className="text-[11px] leading-4 text-v3-text-muted">ปิดอันนี้จะไม่ได้รับอะไรเลย</p>
                </div>
                <Toggle on={master} onChange={(v) => saveLocal({ ...local, master: v })} testId="notif-master-toggle" />
              </div>
            </section>

            {GROUPS.map((g) => (
              <section key={g.testId} className={CARD} data-testid={g.testId}>
                <p className="mb-1 text-[13px] font-black text-v3-navy">{g.title}</p>
                <div className="flex flex-col divide-y divide-v3-border-card">
                  {g.items.map((it) => {
                    const daily = it.testId === 'notif-daily'
                    const options = daily && fortune && !DAILY_TIME_OPTIONS.includes(hhmm(fortune.hour, fortune.minute))
                      ? [...DAILY_TIME_OPTIONS, hhmm(fortune.hour, fortune.minute)].sort()
                      : DAILY_TIME_OPTIONS
                    return (
                      <div key={it.testId} className="py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className={`text-[14px] font-bold ${master ? 'text-v3-navy' : 'text-v3-text-muted'}`}>{it.title}</p>
                            {it.sub ? (
                              <p className="text-[11px] leading-4 text-v3-text-muted" data-testid={daily ? 'notif-daily-sub' : undefined}>
                                {daily ? dailyFortuneSubText(fortune, fortune?.access ?? null) : it.sub}
                              </p>
                            ) : null}
                          </div>
                          <Toggle
                            on={isOn(it)}
                            disabled={!master || savingKey === it.key}
                            onChange={() => onToggle(it)}
                            testId={it.testId}
                          />
                        </div>
                        {/* ตั้งเวลาส่ง "ดวงประจำวัน" — โชว์เมื่อเปิดสวิตช์อยู่ · ผู้ใช้ฟรีหมดช่วง 7 วัน → ทางไปอัปเกรด */}
                        {daily && isOn(it) && (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-0">
                            <label className="flex items-center gap-2 text-[12px] font-medium text-v3-text-body">
                              เวลาส่ง
                              <select
                                value={fortune ? hhmm(fortune.hour, fortune.minute) : '07:00'}
                                disabled={savingTime || !master}
                                onChange={(e) => void saveFortuneTime(e.target.value)}
                                data-testid="notif-daily-time"
                                className="h-8 rounded-full border border-v3-border-card bg-white px-3 text-[12px] font-bold text-v3-navy outline-none"
                              >
                                {options.map((t) => <option key={t} value={t}>{t} น.</option>)}
                              </select>
                            </label>
                            {fortune?.access.reason === 'trial_over' && (
                              <Link href="/v2/shop" data-testid="notif-daily-upgrade" className="text-[12px] font-bold text-v3-cyan">
                                อัปเกรดเพื่อรับดวงรายวันต่อ →
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            ))}

            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              บางหมวดยังบันทึกไว้ในเครื่องนี้ก่อน — ระบบส่งจริงจะซิงก์ให้เมื่อพร้อม
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default NotificationsScreen
