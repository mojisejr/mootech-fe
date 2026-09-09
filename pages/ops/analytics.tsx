// /ops/analytics — รายได้ + การกระจาย tier (FE) + เศรษฐกิจ QI + metadata แชท (engine) เผื่อการตลาด
import { useCallback, useEffect, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { isOpsAuthenticated } from '@/lib/ops/gate'

type Props = { authenticated: boolean }
export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => ({
  props: { authenticated: isOpsAuthenticated(ctx.req as never) },
})

type Analytics = {
  days: number
  revenueByDay: { day: string; orders: number; satang: number }[]
  revenueByPackage: { package_code: string; tier_code: string; orders: number; satang: number }[]
  tierDistribution: { tier_code: string; members: number }[]
  engine: {
    qiEconomy?: { category: string; txns: number; qi_in: number; qi_out: number }[]
    chat?: { byPersona?: { persona: string; replies: number }[]; topTopics?: { topic_id: string; replies: number }[] }
    error?: string
  }
}

const box: React.CSSProperties = { border: '1px solid #e2e2e2', borderRadius: 10, padding: 16, marginTop: 16 }
const baht = (satang: number) => (Number(satang) / 100).toLocaleString('th-TH', { maximumFractionDigits: 0 })

export default function OpsAnalytics({ authenticated }: Props) {
  const [days, setDays] = useState(30)
  const [a, setA] = useState<Analytics | null>(null)
  const load = useCallback(async (d: number) => {
    const res = await fetch(`/api/ops/analytics?days=${d}`)
    const body = await res.json().catch(() => ({}))
    if (res.ok) setA(body as Analytics)
  }, [])
  useEffect(() => { if (authenticated) void load(days) }, [authenticated, days, load])

  if (!authenticated) return <main style={{ padding: 24, fontFamily: 'system-ui' }}><p>ต้องเข้าสู่ระบบ ops — <Link href="/ops">/ops</Link></p></main>

  const totalSatang = a?.revenueByDay.reduce((s, r) => s + Number(r.satang), 0) ?? 0
  const totalOrders = a?.revenueByDay.reduce((s, r) => s + Number(r.orders), 0) ?? 0

  return (
    <>
      <Head><title>Ops · Analytics</title></Head>
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
        <p><Link href="/ops">← กลับหน้า ops</Link></p>
        <h1>Analytics {a ? `(${a.days} วันล่าสุด)` : ''}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {[7, 30, 90].map((d) => <button key={d} onClick={() => setDays(d)} style={{ fontWeight: days === d ? 700 : 400 }}>{d} วัน</button>)}
        </div>
        {!a ? <p>กำลังโหลด…</p> : (
          <>
            <div style={box}>
              <strong>รายได้ (จ่ายสำเร็จ)</strong>
              <div style={{ fontSize: 24, fontWeight: 800 }}>฿{baht(totalSatang)} <span style={{ fontSize: 13, color: '#777' }}>· {totalOrders} ออร์เดอร์</span></div>
              <table cellPadding={6} style={{ width: '100%', marginTop: 8, fontSize: 13, borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: '#777' }}><th>แพ็ก</th><th>tier</th><th>ออร์เดอร์</th><th>รายได้</th></tr></thead>
                <tbody>{a.revenueByPackage.map((r) => (<tr key={r.package_code} style={{ borderTop: '1px solid #eee' }}><td><code>{r.package_code}</code></td><td>{r.tier_code}</td><td>{r.orders}</td><td>฿{baht(r.satang)}</td></tr>))}</tbody>
              </table>
            </div>

            <div style={box}>
              <strong>สมาชิกที่ยัง active</strong>
              <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                {a.tierDistribution.length === 0 ? <span style={{ color: '#777' }}>—</span> : a.tierDistribution.map((t) => (<span key={t.tier_code}><b>{t.members}</b> {t.tier_code}</span>))}
              </div>
            </div>

            <div style={box}>
              <strong>เศรษฐกิจ QI</strong>{a.engine.error ? <span style={{ color: '#b00' }}> · engine: {a.engine.error}</span> : null}
              <table cellPadding={6} style={{ width: '100%', marginTop: 8, fontSize: 13, borderCollapse: 'collapse' }}>
                <thead><tr style={{ textAlign: 'left', color: '#777' }}><th>หมวด</th><th>ครั้ง</th><th>เข้า</th><th>ออก</th></tr></thead>
                <tbody>{(a.engine.qiEconomy ?? []).map((r) => (<tr key={r.category} style={{ borderTop: '1px solid #eee' }}><td>{r.category || '—'}</td><td>{r.txns}</td><td style={{ color: '#080' }}>+{r.qi_in}</td><td style={{ color: '#b00' }}>{r.qi_out}</td></tr>))}</tbody>
              </table>
            </div>

            <div style={box}>
              <strong>แชท Mate AI (metadata)</strong>
              <div style={{ marginTop: 8, fontSize: 13 }}>
                persona: {(a.engine.chat?.byPersona ?? []).map((p) => `${p.persona}=${p.replies}`).join(' · ') || '—'}
              </div>
              <div style={{ marginTop: 4, fontSize: 13, color: '#777' }}>
                หัวข้อยอดฮิต: {(a.engine.chat?.topTopics ?? []).slice(0, 8).map((t) => `${t.topic_id}(${t.replies})`).join(' · ') || '—'}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  )
}
