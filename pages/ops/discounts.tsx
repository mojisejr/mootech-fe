// /ops/discounts (#2 คูปอง Phase 1) — สร้าง/ดู/หยุด "โค้ดส่วนลดเงิน" โดยไม่ต้อง deploy.
// gate จริงอยู่ที่ getServerSideProps (middleware เช็ค cookie แค่ที่ edge). โค้ดที่สร้างมีผลตอน checkout ทันที
// (เลนส่วนลดเดิม rules/repo/preview-flow/charge-flow ทำงานอยู่แล้ว).
import { useMemo, useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { listDiscounts, type OpsDiscount } from '@/lib/ops/discounts'

type Props = { authenticated: boolean; discounts: OpsDiscount[] }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  if (!isOpsAuthenticated(ctx.req as never)) return { props: { authenticated: false, discounts: [] } }
  return { props: { authenticated: true, discounts: await listDiscounts() } }
}

const baht = (satang: number) => `฿${(satang / 100).toLocaleString('th-TH')}`
const dt = (s: string | null) => (s ? new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' }) : '—')

export default function OpsDiscounts({ authenticated, discounts }: Props) {
  const [rows, setRows] = useState<OpsDiscount[]>(discounts)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  // form state
  const [code, setCode] = useState('')
  const [kind, setKind] = useState<'PERCENT' | 'FIXED'>('PERCENT')
  const [value, setValue] = useState('')
  const [maxDiscountBaht, setMaxDiscountBaht] = useState('')
  const [appliesTo, setAppliesTo] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [maxUseTotal, setMaxUseTotal] = useState('')
  const [maxUsePerUser, setMaxUsePerUser] = useState('')

  const canCreate = useMemo(() => code.trim() !== '' && value.trim() !== '', [code, value])

  if (!authenticated) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>โค้ดส่วนลด</h1>
        <p>ต้องเข้าสู่ระบบ ops ก่อน — <Link href="/ops">ไปหน้า /ops</Link></p>
      </main>
    )
  }

  async function create() {
    setBusy('create')
    setError(null)
    setMsg(null)
    try {
      const res = await fetch('/api/ops/discounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          kind,
          value: Number(value),
          maxDiscountBaht: kind === 'PERCENT' && maxDiscountBaht ? Number(maxDiscountBaht) : undefined,
          appliesTo: appliesTo.split(',').map((s) => s.trim()).filter(Boolean),
          startsAt: startsAt || undefined,
          endsAt: endsAt || undefined,
          maxUseTotal: maxUseTotal || undefined,
          maxUsePerUser: maxUsePerUser || undefined,
        }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(body?.reason ?? body?.error ?? res.status)); return }
      setRows(body.discounts as OpsDiscount[])
      setMsg(`สร้างโค้ด ${code.toUpperCase()} แล้ว`)
      setCode(''); setValue(''); setMaxDiscountBaht(''); setAppliesTo(''); setStartsAt(''); setEndsAt(''); setMaxUseTotal(''); setMaxUsePerUser('')
    } finally { setBusy(null) }
  }

  async function toggle(d: OpsDiscount) {
    const next = d.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    setBusy(d.id)
    setError(null)
    try {
      const res = await fetch('/api/ops/discounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, status: next }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setError(String(body?.reason ?? body?.error ?? res.status)); return }
      setRows(body.discounts as OpsDiscount[])
    } finally { setBusy(null) }
  }

  const input: React.CSSProperties = { width: '100%', padding: 6, boxSizing: 'border-box' }
  const td: React.CSSProperties = { borderBottom: '1px solid #eee', padding: 8, verticalAlign: 'top' }

  return (
    <>
      <Head><title>Ops · โค้ดส่วนลด</title></Head>
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 1000 }}>
        <p><Link href="/ops">← กลับหน้า ops</Link></p>
        <h1>โค้ดส่วนลดเงิน (discount code)</h1>
        <p style={{ color: '#666' }}>
          สร้างโค้ดลดตอนชำระเงิน — มีผลทันที ไม่ต้อง deploy · PERCENT = เปอร์เซ็นต์ (เพดานลดได้) · FIXED = ลดเป็นบาท ·
          ปล่อยว่าง = ไม่จำกัด/ทุกแพ็ก · (คูปองแจก QI/แชท ดูเฟส 2)
        </p>

        {/* create form */}
        <fieldset style={{ border: '1px solid #ddd', borderRadius: 8, padding: 16, marginBottom: 20 }}>
          <legend><strong>สร้างโค้ดใหม่</strong></legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <label>โค้ด<input style={input} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SONGKRAN50" /></label>
            <label>ชนิด
              <select style={input} value={kind} onChange={(e) => setKind(e.target.value as 'PERCENT' | 'FIXED')}>
                <option value="PERCENT">PERCENT (%)</option>
                <option value="FIXED">FIXED (บาท)</option>
              </select>
            </label>
            <label>{kind === 'PERCENT' ? 'ลดกี่ % (1-90)' : 'ลดกี่บาท'}<input style={input} type="number" value={value} onChange={(e) => setValue(e.target.value)} /></label>
            <label>เพดานลด (บาท){kind === 'FIXED' ? ' — ไม่ใช้' : ''}<input style={input} type="number" value={maxDiscountBaht} onChange={(e) => setMaxDiscountBaht(e.target.value)} disabled={kind === 'FIXED'} placeholder="เว้น=ไม่จำกัด" /></label>
            <label>ใช้กับแพ็ก (คั่น ,)<input style={input} value={appliesTo} onChange={(e) => setAppliesTo(e.target.value)} placeholder="เว้น=ทุกแพ็ก · เช่น V2_PRO_YEARLY,SINSAE_60" /></label>
            <label>เริ่ม<input style={input} type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} /></label>
            <label>หมดอายุ<input style={input} type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} /></label>
            <label>ใช้ได้รวม (ครั้ง)<input style={input} type="number" value={maxUseTotal} onChange={(e) => setMaxUseTotal(e.target.value)} placeholder="เว้น=ไม่จำกัด" /></label>
            <label>ต่อคน (ครั้ง)<input style={input} type="number" value={maxUsePerUser} onChange={(e) => setMaxUsePerUser(e.target.value)} placeholder="เว้น=ไม่จำกัด" /></label>
          </div>
          <div style={{ marginTop: 12 }}>
            <button disabled={!canCreate || busy === 'create'} onClick={() => void create()}>{busy === 'create' ? 'กำลังสร้าง…' : 'สร้างโค้ด'}</button>
            {msg && <span style={{ color: '#0a0', marginLeft: 12 }}>{msg}</span>}
            {error && <span style={{ color: '#b00', marginLeft: 12 }}>สร้างไม่สำเร็จ: {error}</span>}
          </div>
        </fieldset>

        {/* list */}
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th style={td}>โค้ด</th><th style={td}>ส่วนลด</th><th style={td}>ใช้กับ</th><th style={td}>ช่วงเวลา</th><th style={td}>ใช้แล้ว/รวม·ต่อคน</th><th style={td}>สถานะ</th><th style={td} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td style={td} colSpan={7}>ยังไม่มีโค้ด</td></tr>}
            {rows.map((d) => (
              <tr key={d.id} style={{ opacity: busy === d.id ? 0.5 : 1 }}>
                <td style={td}><code>{d.code}</code></td>
                <td style={td}>{d.kind === 'PERCENT' ? `${d.value}%${d.maxDiscountSatang ? ` (สูงสุด ${baht(d.maxDiscountSatang)})` : ''}` : baht(d.value)}</td>
                <td style={td}>{d.appliesTo.length ? d.appliesTo.join(', ') : 'ทุกแพ็ก'}</td>
                <td style={td}>{dt(d.startsAt)} → {dt(d.endsAt)}</td>
                <td style={td}>{d.usedCount}/{d.maxUseTotal ?? '∞'} · {d.maxUsePerUser ?? '∞'}/คน</td>
                <td style={td}><strong style={{ color: d.status === 'ACTIVE' ? '#0a0' : d.status === 'PAUSED' ? '#a60' : '#999' }}>{d.status}</strong></td>
                <td style={td}>{d.status !== 'EXPIRED' && <button disabled={busy === d.id} onClick={() => void toggle(d)}>{d.status === 'ACTIVE' ? 'พัก' : 'เปิด'}</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  )
}
