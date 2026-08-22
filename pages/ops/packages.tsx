// /ops/packages (mootech-fe#377) — change a package's PRICE and whether it is ON SALE, without a deploy.
// Mirrors /ops/index: getServerSideProps is the real gate (middleware only checks the cookie at the edge),
// and the page renders nothing sensitive when unauthenticated.
//
// Deliberately NOT here: creating a package, or editing its tier. A package must be bound to a tier (and
// later to entitlement ceilings) in code, so one made from a screen would be a package nothing grants
// (ฟีม 2026-08-22).
import { useState } from 'react'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import Link from 'next/link'
import { isOpsAuthenticated } from '@/lib/ops/gate'
import { listPackages, type OpsPackage } from '@/lib/ops/packages'

type Props = { authenticated: boolean; packages: OpsPackage[] }

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  if (!isOpsAuthenticated(ctx.req as never)) return { props: { authenticated: false, packages: [] } }
  return { props: { authenticated: true, packages: await listPackages() } }
}

export default function OpsPackages({ authenticated, packages }: Props) {
  const [rows, setRows] = useState<OpsPackage[]>(packages)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (!authenticated) {
    return (
      <main style={{ padding: 24, fontFamily: 'system-ui' }}>
        <h1>แพ็กเกจ</h1>
        <p>
          ต้องเข้าสู่ระบบ ops ก่อน — <Link href="/ops">ไปหน้า /ops</Link>
        </p>
      </main>
    )
  }

  async function save(pkg: OpsPackage, amountBaht: number, isActive: boolean) {
    setBusy(pkg.packageCode)
    setError(null)
    try {
      const res = await fetch('/api/ops/packages', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ package_code: pkg.packageCode, amount_baht: amountBaht, is_active: isActive }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        // Show the server's reason instead of a generic failure — SELLING_A_ZERO_PRICE in particular is a
        // rule the operator needs to understand, not a mystery.
        setError(String(body?.reason ?? body?.error ?? res.status))
        return
      }
      setRows(body.packages as OpsPackage[])
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <Head>
        <title>Ops · แพ็กเกจ</title>
      </Head>
      <main style={{ padding: 24, fontFamily: 'system-ui', maxWidth: 900 }}>
        <p>
          <Link href="/ops">← กลับหน้า ops</Link>
        </p>
        <h1>แพ็กเกจสมาชิก</h1>
        <p style={{ color: '#666' }}>
          แก้ <strong>ราคา</strong> และ <strong>เปิด/ปิดขาย</strong> ได้ที่นี่ — มีผลทันที ไม่ต้อง deploy ·
          ระดับ (PLUS/PRO) และการสร้างแพ็กใหม่ต้องแก้ในโค้ด
        </p>
        {error && <p style={{ color: '#b00' }}>บันทึกไม่สำเร็จ: {error}</p>}
        <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #ddd' }}>
              <th>แพ็ก</th>
              <th>ระดับ</th>
              <th>รอบ</th>
              <th>ราคา (บาท)</th>
              <th>เปิดขาย</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <PackageRowEditor key={p.packageCode} pkg={p} busy={busy === p.packageCode} onSave={save} />
            ))}
          </tbody>
        </table>
      </main>
    </>
  )
}

function PackageRowEditor({
  pkg,
  busy,
  onSave,
}: {
  pkg: OpsPackage
  busy: boolean
  onSave: (p: OpsPackage, amountBaht: number, isActive: boolean) => void
}) {
  const [amount, setAmount] = useState(String(pkg.amountBaht))
  const [active, setActive] = useState(pkg.isActive)
  const dirty = Number(amount) !== pkg.amountBaht || active !== pkg.isActive

  return (
    <tr style={{ borderBottom: '1px solid #eee', opacity: busy ? 0.5 : 1 }}>
      <td>
        <code>{pkg.packageCode}</code>
        <div style={{ color: '#777', fontSize: 12 }}>{pkg.description}</div>
      </td>
      <td>
        {pkg.tierCode}
        {/* a tier_code the reader cannot map is shown, not hidden — an unknown level must never look fine */}
        {!pkg.tierKnown && <strong style={{ color: '#b00' }}> ⚠️ ไม่รู้จัก</strong>}
      </td>
      <td>{pkg.expire}</td>
      <td>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          style={{ width: 100 }}
          aria-label={`ราคา ${pkg.packageCode}`}
        />
      </td>
      <td>
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
          aria-label={`เปิดขาย ${pkg.packageCode}`}
        />
      </td>
      <td>
        <button disabled={!dirty || busy} onClick={() => onSave(pkg, Number(amount), active)}>
          บันทึก
        </button>
      </td>
    </tr>
  )
}
