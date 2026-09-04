// features/v2-qi/components/QiBuyScreen.tsx — จอ "เติมพลังชี่" (/v2/qi/buy) — เฟรม `buy-qi — select pack`.
// Reskin 2026-09-04 ตามเฟรม: แบนเนอร์โบนัสซื้อแรก + การ์ดแพ็กใหญ่ 3 ใบ (กองเหรียญ + ชี่/ราคาเด่นกลางการ์ด
// + badge คุ้มที่สุดบนแพ็กใหญ่สุด) ทั้งการ์ดกดเข้า checkout ของแพ็กนั้น (ราง Omise v2 เดิม).
// จำนวนชี่มาจาก QI_PACK_QTY (fail-loud) · ราคามาจาก /api/payment-package (แถวจริง — ห้าม hardcode).
import Head from "next/head"
import Link from "next/link"
import { useEffect, useState } from "react"

import { CoinStack, SectionCard, SkyHeader, SkyScreen } from "@/features/v2-profile/components/kit"
import { QI_PACK_CODES, qiQtyOf } from "@/lib/payment/catalog"

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
    <SkyScreen>
      <Head><title>เติมพลังชี่ · MuMate</title></Head>
      <SkyHeader title="เติมพลังชี่" testId="qi-buy" />

      {loading && (
        <div className="mt-3 flex flex-col gap-3" data-testid="qi-buy-loading">
          <div className="h-[104px] w-full animate-pulse rounded-[24px] bg-v3-ghost-white" />
          <div className="h-[128px] w-full animate-pulse rounded-[24px] bg-v3-ghost-white" />
        </div>
      )}

      {!loading && failed && (
        <div className="v3-shadow-card mt-4 rounded-[24px] bg-white p-5 text-center" data-testid="qi-buy-error">
          <p className="text-sm font-bold text-v3-navy">โหลดแพ็กชี่ไม่สำเร็จ</p>
          <Link href="/v2/qi" className="mt-3 grid h-11 place-items-center rounded-full bg-v3-cyan text-sm font-bold text-white">
            กลับหน้าชี่
          </Link>
        </div>
      )}

      {!loading && !failed && (
        <div className="mt-3 flex flex-col gap-4">
          {/* แบนเนอร์โบนัสซื้อครั้งแรก — first_buy_bonus +30 ครั้งเดียว (ตาม catalog ของ engine) */}
          <section
            className="flex w-full items-center gap-3 rounded-[24px] bg-gradient-to-r from-v3-lime to-[#FFE082] p-4"
            data-testid="qi-buy-bonus"
          >
            <span aria-hidden className="grid size-12 flex-none place-items-center rounded-full bg-white/70 text-[22px]">🎁</span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-black leading-5 text-v3-navy">เติมครั้งแรกรับโบนัส +30 ชี่</p>
              <p className="text-[11px] leading-4 text-v3-navy/70">โบนัสเข้าให้อัตโนมัติหลังชำระเงินสำเร็จ (ครั้งเดียวต่อบัญชี)</p>
            </div>
          </section>

          {/* การ์ดแพ็กใหญ่ 3 ใบ — ทั้งการ์ดกดเข้า checkout ของแพ็กนั้น */}
          <div className="flex flex-col gap-3" data-testid="qi-buy-packs">
            {QI_PACK_CODES.map((code) => {
              const qty = qiQtyOf(code)
              const row = rows[code] ?? null
              const onSale = Boolean(row?.is_active) && typeof row?.amount === "number" && (row?.amount as number) > 0
              const isBest = code === "QI_1200"
              const cardCls =
                "v3-shadow-card relative flex w-full items-center gap-4 rounded-[24px] bg-white p-5" +
                (onSale ? " transition hover:brightness-[.98]" : " opacity-80")
              const inner = (
                <>
                  {isBest && onSale ? (
                    <span className="absolute -top-2 right-4 rounded-full bg-v3-pumpkin px-3 py-[3px] text-[11px] font-black text-white">
                      คุ้มที่สุด
                    </span>
                  ) : null}
                  <CoinStack size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[24px] font-black leading-8 text-v3-navy">
                      {qty !== null ? `${qty.toLocaleString("th-TH")} ชี่` : "—"}
                    </p>
                    <p className="text-[12px] leading-4 text-v3-text-muted">
                      {typeof row?.amount === "number" && row.amount > 0
                        ? `ประหยัดกว่าซื้อทีละแพ็ก`
                        : "ราคายังไม่เปิด"}
                    </p>
                  </div>
                  {onSale ? (
                    <span className="grid h-12 w-[92px] flex-none place-items-center rounded-full bg-v3-cyan text-[16px] font-black text-white">
                      ฿{row?.amount}
                    </span>
                  ) : (
                    <span className="flex-none rounded-full bg-v3-disabled-bg px-4 py-2 text-[12px] font-bold text-v3-text-muted">
                      {row ? "ปิดขายชั่วคราว" : "อ่านราคาไม่ได้"}
                    </span>
                  )}
                </>
              )
              return (
                <div key={code} data-testid={`qi-pack-${code}`} className="w-full">
                  {onSale ? (
                    <a href={`/v2/shop/checkout?package_code=${encodeURIComponent(code)}`} data-testid={`qi-buy-cta-${code}`} className={cardCls}>
                      {inner}
                    </a>
                  ) : (
                    <div className={cardCls}>{inner}</div>
                  )}
                </div>
              )
            })}
          </div>

          <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
            ชี่ใช้เปิดการ์ด เสี่ยงทาย และปลดล็อคเนื้อหาเจาะลึก — ชำระผ่านบัตรเครดิต/พร้อมเพย์ ปลอดภัย
            หลังชำระสำเร็จชี่เข้าอัตโนมัติ
          </p>
        </div>
      )}
    </SkyScreen>
  )
}

export default QiBuyScreen
