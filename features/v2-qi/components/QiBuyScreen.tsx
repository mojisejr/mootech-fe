// features/v2-qi/components/QiBuyScreen.tsx — จอ "เติมพลังชี่" (/v2/qi/buy) — เฟรม `buy-qi — select pack`.
//
// แพ็ก 200/500/1,200 ชี่ — จำนวนชี่มาจาก QI_PACK_QTY (lib/payment/catalog, fail-loud) · ราคามาจาก
// /api/payment-package (แถว payment_package จริง — ห้าม hardcode ราคาในจอ เดินตามกติกา DoD ของร้าน).
// กดซื้อ → checkout เดิม (/v2/shop/checkout?package_code=QI_XXX) — ราง Omise/พร้อมเพย์/webhook/reconcile
// ใช้ของเดิมทั้งหมด; จบที่ result ซึ่งเครดิตชี่ผ่าน engine grant อัตโนมัติแล้วพากลับ /v2/qi.
import Head from "next/head"
import Link from "next/link"
import { useEffect, useState } from "react"

import { QiHeader } from "./QiHeader"
import { QI_PACK_CODES, qiQtyOf } from "@/lib/payment/catalog"

const CARD = "v3-shadow-card w-full rounded-[20px] bg-white p-5"

type PackRow = { package_code?: string; amount?: number | string; is_active?: boolean; description?: string }

export function QiBuyScreen() {
  const [rows, setRows] = useState<Record<string, PackRow | null>>({})
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setFailed(false)
    Promise.all(
      QI_PACK_CODES.map(async (code) => {
        const res = await fetch(`/api/payment-package?code=${encodeURIComponent(code)}`)
        return [code, res.ok ? ((await res.json()) as PackRow) : null] as const
      }),
    )
      .then((pairs) => {
        if (!alive) return
        const map: Record<string, PackRow | null> = {}
        let anyOk = false
        for (const [code, row] of pairs) {
          map[code] = row
          if (row) anyOk = true
        }
        setRows(map)
        setFailed(!anyOk)
      })
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-white pb-10">
      <div className="mx-auto w-full max-w-md px-4">
        <QiHeader title="เติมพลังชี่" testId="qi-buy" />

        {loading && (
          <div className="mt-3 flex flex-col gap-3" data-testid="qi-buy-loading">
            <div className="h-[92px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
            <div className="h-[92px] w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
          </div>
        )}

        {!loading && failed && (
          <div className="mt-4 rounded-[20px] bg-white p-5 text-center shadow-[0_4px_15px_rgba(26,38,77,0.12)]" data-testid="qi-buy-error">
            <p className="text-sm font-bold text-v3-navy">โหลดแพ็กชี่ไม่สำเร็จ</p>
            <Link href="/v2/qi" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
              กลับหน้าชี่
            </Link>
          </div>
        )}

        {!loading && !failed && (
          <div className="mt-3 flex flex-col gap-4">
            {/* โบนัสซื้อครั้งแรก — ตัวเลขตาม catalog ของ engine (first_buy_bonus +30, ครั้งเดียว) */}
            <section className={CARD} data-testid="qi-buy-bonus">
              <p className="text-[13px] font-bold text-v3-navy">🎁 เติมครั้งแรกรับโบนัส +30 ชี่</p>
              <p className="mt-1 text-[11px] leading-4 text-v3-text-muted">โบนัสเข้าให้อัตโนมัติหลังชำระเงินสำเร็จ (ครั้งเดียวต่อบัญชี)</p>
            </section>

            <div className="flex flex-col gap-3" data-testid="qi-buy-packs">
              {QI_PACK_CODES.map((code) => {
                const qty = qiQtyOf(code)
                const row = rows[code] ?? null
                // แพ็กที่ปิดขาย/อ่านไม่ได้ = ปุ่มปิด + เหตุผลตรง ๆ (ห้ามพาไป checkout แล้วโดน till ปฏิเสธ)
                const onSale = Boolean(row?.is_active) && typeof row?.amount === "number" && (row?.amount as number) > 0
                return (
                  <section key={code} className={CARD} data-testid={`qi-pack-${code}`}>
                    <div className="flex items-center gap-3">
                      <span className="grid h-12 w-12 flex-none place-items-center rounded-[14px] bg-v3-ghost-white text-[22px]" aria-hidden>
                        🪙
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-black text-v3-navy">
                          {qty !== null ? qty.toLocaleString("th-TH") : "—"} ชี่
                        </p>
                        <p className="text-[11px] leading-4 text-v3-text-muted">
                          {typeof row?.amount === "number" && row.amount > 0
                            ? `฿${row.amount.toLocaleString("th-TH")}`
                            : "ราคายังไม่เปิด"}
                        </p>
                      </div>
                      {onSale ? (
                        <Link
                          href={`/v2/shop/checkout?package_code=${encodeURIComponent(code)}`}
                          data-testid={`qi-buy-cta-${code}`}
                          className="grid h-10 flex-none place-items-center rounded-full bg-v3-cyan px-5 text-[13px] font-bold text-white"
                        >
                          ซื้อ
                        </Link>
                      ) : (
                        <span className="flex-none rounded-full bg-v3-disabled-bg px-4 py-2 text-[12px] font-bold text-v3-text-muted">
                          {row ? "ปิดขายชั่วคราว" : "อ่านราคาไม่ได้"}
                        </span>
                      )}
                    </div>
                  </section>
                )
              })}
            </div>

            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              ชี่ใช้เปิดการ์ด เสี่ยงทาย และปลดล็อคเนื้อหาเจาะลึก — ชำระผ่านบัตรเครดิต/พร้อมเพย์ ปลอดภัย
              หลังชำระสำเร็จชี่เข้าอัตโนมัติ
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default QiBuyScreen
