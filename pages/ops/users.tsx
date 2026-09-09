// /ops/users — ค้นหาผู้ใช้ (ชื่อ/อีเมล/user_id) แล้วเข้าหน้ารายละเอียดเพื่อจัดการ tier/QI/วันเกิด
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { isOpsAuthenticated } from '@/lib/ops/gate'

type Props = { authenticated: boolean }
type UserRow = { userId: string; name: string | null; email: string | null; dob: string | null; gender: string | null }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => ({
  props: { authenticated: isOpsAuthenticated(ctx.req as never) },
})

export default function OpsUsers({ authenticated }: Props) {
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<UserRow[]>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (!authenticated) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>ผู้ใช้</h1>
        <p>ต้องเข้าสู่ระบบ ops ก่อน — <Link href="/ops">ไปหน้า /ops</Link></p>
      </main>
    )
  }

  async function search(e?: React.FormEvent) {
    e?.preventDefault()
    if (!q.trim()) return
    setBusy(true); setMsg(null)
    try {
      const res = await fetch(`/api/ops/users?q=${encodeURIComponent(q.trim())}`)
      const body = await res.json().catch(() => ({}))
      if (!res.ok) { setMsg(String(body?.error ?? res.status)); return }
      setRows(body.users as UserRow[])
      if (!body.users?.length) setMsg('ไม่พบผู้ใช้')
    } finally { setBusy(false) }
  }

  return (
    <>
      <Head><title>Ops · ผู้ใช้</title></Head>
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
        <p><Link href="/ops">← กลับหน้า ops</Link></p>
        <h1>ค้นหาผู้ใช้</h1>
        <p style={{ color: '#666' }}>ค้นด้วยชื่อ / อีเมล / user_id แล้วคลิกเพื่อจัดการ tier · QI · วันเกิด</p>
        <form onSubmit={search} style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="ชื่อ / อีเมล / user_id" style={{ flex: 1, padding: 8 }} aria-label="ค้นหาผู้ใช้" />
          <button disabled={busy || !q.trim()}>{busy ? 'กำลังค้นหา…' : 'ค้นหา'}</button>
        </form>
        {msg && <p style={{ color: '#b00' }}>{msg}</p>}
        <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
          <tbody>
            {rows.map((u) => (
              <tr key={u.userId} style={{ borderBottom: '1px solid #eee' }}>
                <td>
                  <Link href={`/ops/users/${encodeURIComponent(u.userId)}`}><strong>{u.name || '(ไม่มีชื่อ)'}</strong></Link>
                  <div style={{ color: '#777', fontSize: 12 }}>{u.email ?? '—'} · เกิด {u.dob ?? '—'} · {u.gender ?? '—'}</div>
                  <div style={{ color: '#aaa', fontSize: 11 }}><code>{u.userId}</code></div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </main>
    </>
  )
}
