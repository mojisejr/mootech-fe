// features/v2-settings/components/NotificationsScreen.tsx — /v2/settings/notifications
// เฟรม `settings-notifications`: หมวดแจ้งเตือน 3 หมวดจาก engine (GET/PUT prefs) + สถานะ PWA push
// (สิทธิ์เบราว์เซอร์ — อ่าน Notification.permission ตรง ๆ) + ทางไปจัดการแจ้งเตือนยาม/ปฏิทิน
import Head from 'next/head'
import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { SkyBackdrop, SkyHeader, Toggle } from '@/features/v2-profile/components/kit'
import { ProfileGate } from '@/features/v2-account/components/ProfileGate'

const CARD = 'flex w-full flex-col rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]'

type Prefs = { dailyFortune?: boolean; reminders?: boolean; updates?: boolean }

const CATEGORIES: Array<{ key: keyof Prefs; title: string; sub: string; testId: string }> = [
  { key: 'dailyFortune', title: 'ดวงรายวัน', sub: 'แจ้งดวงประจำวันของคุณทุกเช้า', testId: 'notif-daily' },
  { key: 'reminders', title: 'การเตือน/ยามที่บันทึกไว้', sub: 'แจ้งเตือนเวลายามและกิจกรรมที่บันทึก', testId: 'notif-reminders' },
  { key: 'updates', title: 'ข่าวสารและโปรโมชัน', sub: 'แพ็กเกจใหม่ โบนัส และกิจกรรม (ปิดไว้ตามค่าเริ่มต้น)', testId: 'notif-updates' },
]

export function NotificationsScreen() {
  const [prefs, setPrefs] = useState<Prefs | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<'ok' | 'not_authenticated' | 'failed'>('ok')
  const [pushState, setPushState] = useState<'unsupported' | NotificationPermission>('default')
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [master, setMaster] = useState(true) // สวิตช์รวม (เครื่องนี้) — ปิดแล้วหรี่หมวดย่อย

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
      setPrefs((await res.json()) as Prefs)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    if (typeof Notification !== 'undefined') setPushState(Notification.permission)
    else setPushState('unsupported')
  }, [load])

  const toggle = async (key: keyof Prefs) => {
    if (!prefs) return
    setSavingKey(key)
    const next = { ...prefs, [key]: !prefs[key] }
    try {
      const res = await fetch('/api/notification-prefs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(next),
      })
      if (res.ok) setPrefs(next)
    } finally {
      setSavingKey(null)
    }
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
                  <p className="text-[14px] font-bold text-v3-navy">เปิดการแจ้งเตือนทั้งหมด</p>
                  <p className="text-[11px] leading-4 text-v3-text-muted">ปิดอันนี้จะไม่ได้รับอะไรเลย</p>
                </div>
                <Toggle on={master} onChange={setMaster} testId="notif-master-toggle" />
              </div>
            </section>

            <section className={CARD} data-testid="notif-categories">
              <p className="text-[13px] font-bold text-v3-navy">หมวดที่ต้องการรับ</p>
              <div className="flex flex-col divide-y divide-v3-border-card">
                {CATEGORIES.map((c) => (
                  <div key={c.key} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-v3-navy">{c.title}</p>
                      <p className="text-[11px] leading-4 text-v3-text-muted">{c.sub}</p>
                    </div>
                    <Toggle
                      on={Boolean(master && prefs?.[c.key])}
                      disabled={savingKey === c.key || !master}
                      onChange={() => void toggle(c.key)}
                      testId={c.testId}
                    />
                  </div>
                ))}
              </div>
              <p className="mt-1 text-[11px] leading-4 text-v3-text-muted">ช่องทางที่ได้รับ: แจ้งเตือนในแอป (Push) · LINE · อีเมล (เฉพาะใบเสร็จและเรื่องบัญชี)</p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default NotificationsScreen
