// /ops/users/[userId] — จัดการผู้ใช้: ดูสถานะ + เพิ่ม/ลด/เปลี่ยน tier · เพิ่ม/ลด QI · แก้วันเกิด (ไม่หัก QI)
import { useCallback, useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { isOpsAuthenticated } from '@/lib/ops/gate'

type Props = { authenticated: boolean }
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => ({
  props: { authenticated: isOpsAuthenticated(ctx.req as never) },
})

type Detail = {
  user: { userId: string; name: string | null; surname: string | null; email: string | null; dob: string | null; time: string | null; isRememberTime: boolean; gender: string | null; placeName: string | null }
  membership: { isPaid: boolean | null; tier: string | null; source: string; expireAt?: string | null }
  subscriptions: { id: string; tierCode: string; packageCode: string; startAt: string; expireAt: string; status: string; amountSatang: number }[]
  engine: { qi?: number | null; ledger?: { qiDelta: number; reason: string; ref: string | null; createdAt: string }[]; profile?: Record<string, unknown> | null; error?: string }
}

const box: React.CSSProperties = { border: '1px solid #e2e2e2', borderRadius: 10, padding: 16, marginTop: 16 }

export default function OpsUserDetail({ authenticated }: Props) {
  const router = useRouter()
  const userId = typeof router.query.userId === 'string' ? router.query.userId : ''
  const [d, setD] = useState<Detail | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    const res = await fetch(`/api/ops/users?userId=${encodeURIComponent(userId)}`)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) { setMsg(String(body?.error ?? res.status)); return }
    setD(body as Detail)
  }, [userId])
  useEffect(() => { if (authenticated) void load() }, [authenticated, load])

  async function act(url: string, method: string, payload: Record<string, unknown>, label: string) {
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(`${label} ไม่สำเร็จ: ${body?.reason ?? body?.error ?? res.status}`); return }
      setMsg(`${label} สำเร็จ`)
      await load()
    } finally { setBusy(false) }
  }

  if (!authenticated) return <main style={{ padding: 24, fontFamily: 'system-ui' }}><p>ต้องเข้าสู่ระบบ ops — <Link href="/ops">/ops</Link></p></main>

  return (
    <>
      <Head><title>Ops · ผู้ใช้ {userId.slice(0, 8)}</title></Head>
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 820 }}>
        <p><Link href="/ops/users">← ค้นหาผู้ใช้</Link></p>
        {msg && <p style={{ color: msg.includes('สำเร็จ') ? '#080' : '#b00' }}>{msg}</p>}
        {!d ? <p>กำลังโหลด…</p> : (
          <>
            <h1 style={{ marginBottom: 0 }}>{d.user.name || '(ไม่มีชื่อ)'} {d.user.surname ?? ''}</h1>
            <div style={{ color: '#777', fontSize: 13 }}>{d.user.email ?? '—'} · <code>{d.user.userId}</code></div>

            {/* สถานะ */}
            <div style={box}>
              <strong>สถานะ</strong>
              <div>Tier ปัจจุบัน: <b>{d.membership.tier ?? 'FREE'}</b> ({d.membership.source}{d.membership.expireAt ? ` · ถึง ${d.membership.expireAt}` : ''})</div>
              <div>QI คงเหลือ: <b>{d.engine.qi ?? '—'}</b>{d.engine.error ? <span style={{ color: '#b00' }}> · engine: {d.engine.error}</span> : null}</div>
            </div>

            {/* Tier */}
            <div style={box}>
              <strong>จัดการ Tier</strong>
              <TierPanel busy={busy} onGrant={(tier, expire) => act('/api/ops/tier', 'PATCH', { user_id: userId, action: 'grant', tier_code: tier, expire_at: expire }, `มอบ ${tier}`)} onRevoke={() => act('/api/ops/tier', 'PATCH', { user_id: userId, action: 'revoke' }, 'ถอนสมาชิก')} />
              <table cellPadding={6} style={{ width: '100%', marginTop: 8, fontSize: 13, borderCollapse: 'collapse' }}>
                <tbody>
                  {d.subscriptions.map((s) => (
                    <tr key={s.id} style={{ borderTop: '1px solid #eee', color: s.status === 'ACTIVE' ? '#000' : '#999' }}>
                      <td>{s.tierCode}</td><td>{s.packageCode}</td><td>{s.startAt}→{s.expireAt}</td><td>{s.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* QI */}
            <div style={box}>
              <strong>เพิ่ม/ลด QI</strong>
              <QiPanel busy={busy} onAdjust={(delta, note) => act('/api/ops/qi', 'POST', { user_id: userId, qi_delta: delta, note }, `ปรับ QI ${delta > 0 ? '+' : ''}${delta}`)} />
              <div style={{ marginTop: 8, fontSize: 12, color: '#777' }}>
                {(d.engine.ledger ?? []).slice(0, 8).map((l, i) => (
                  <div key={i}>{l.qiDelta > 0 ? '+' : ''}{l.qiDelta} · {l.reason} · {new Date(l.createdAt).toLocaleString('th-TH')}</div>
                ))}
              </div>
            </div>

            {/* วันเกิด */}
            <div style={box}>
              <strong>แก้วันเกิด (ไม่หัก QI)</strong>
              <BirthPanel busy={busy} current={{ dob: d.user.dob, time: d.user.time, isRememberTime: d.user.isRememberTime }}
                onSave={(p) => act('/api/ops/birth', 'PATCH', { user_id: userId, ...p }, 'แก้วันเกิด')} />
            </div>
          </>
        )}
      </main>
    </>
  )
}

function TierPanel({ busy, onGrant, onRevoke }: { busy: boolean; onGrant: (tier: string, expire: string) => void; onRevoke: () => void }) {
  const [tier, setTier] = useState('PRO')
  const [expire, setExpire] = useState(new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10))
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <select value={tier} onChange={(e) => setTier(e.target.value)} aria-label="tier"><option>PLUS</option><option>PRO</option></select>
      <input type="date" value={expire} onChange={(e) => setExpire(e.target.value)} aria-label="วันหมดอายุ" />
      <button disabled={busy} onClick={() => onGrant(tier, expire)}>มอบ/ต่ออายุ</button>
      <button disabled={busy} onClick={onRevoke} style={{ color: '#b00' }}>ถอนเป็น FREE</button>
    </div>
  )
}

function QiPanel({ busy, onAdjust }: { busy: boolean; onAdjust: (delta: number, note: string) => void }) {
  const [amount, setAmount] = useState('100')
  const [note, setNote] = useState('')
  const n = Number(amount)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 110 }} aria-label="จำนวน QI" />
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="เหตุผล (optional)" aria-label="เหตุผล" />
      <button disabled={busy || !Number.isInteger(n) || n === 0} onClick={() => onAdjust(Math.abs(n), note)}>+ เพิ่ม</button>
      <button disabled={busy || !Number.isInteger(n) || n === 0} onClick={() => onAdjust(-Math.abs(n), note)} style={{ color: '#b00' }}>− ลด</button>
    </div>
  )
}

function BirthPanel({ busy, current, onSave }: { busy: boolean; current: { dob: string | null; time: string | null; isRememberTime: boolean }; onSave: (p: Record<string, unknown>) => void }) {
  const [birth, setBirth] = useState((current.dob ?? '').slice(0, 10))
  const [time, setTime] = useState(current.time && /^\d{2}:\d{2}/.test(current.time) ? current.time.slice(0, 5) : '')
  const [unknown, setUnknown] = useState(!current.isRememberTime)
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <input type="date" value={birth} onChange={(e) => setBirth(e.target.value)} aria-label="วันเกิด" />
      <input type="time" value={time} onChange={(e) => setTime(e.target.value)} disabled={unknown} aria-label="เวลาเกิด" />
      <label style={{ fontSize: 13 }}><input type="checkbox" checked={unknown} onChange={(e) => setUnknown(e.target.checked)} /> ไม่ทราบเวลา</label>
      <button disabled={busy || !/^\d{4}-\d{2}-\d{2}$/.test(birth)} onClick={() => onSave({ birth, birth_time: time || null, time_unknown: unknown })}>บันทึกวันเกิด</button>
    </div>
  )
}
