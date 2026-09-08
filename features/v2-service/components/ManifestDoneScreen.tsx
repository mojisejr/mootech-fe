// features/v2-service/components/ManifestDoneScreen.tsx — /v2/service/manifest/done?id=<goalId>
// Design: Figma "11-payment-processing" (success) — มาสคอต + "สำเร็จแล้ว" + affirmation + สถิติ.
// Data: goals (หา goal by id → affirmation + createdAt) · entries (นับจำนวนครั้งอ่าน).
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/router"
import { useEffect, useState } from "react"

type Goal = { id: string; title: string; affirmation: string | null; createdAt?: string; status: string }
type DonePreview = { affirmation: string; startedAt?: string; reads?: number }

function thaiDate(iso?: string): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("th-TH", { day: "numeric", month: "short" })
}

export function ManifestDoneScreen({ previewData }: { previewData?: DonePreview } = {}) {
  const router = useRouter()
  const id = typeof router.query.id === "string" ? router.query.id : ""
  const [affirmation, setAffirmation] = useState(previewData?.affirmation ?? "")
  const [startedAt, setStartedAt] = useState<string | undefined>(previewData?.startedAt)
  const [reads, setReads] = useState<number>(previewData?.reads ?? 0)

  useEffect(() => {
    if (previewData) return
    void (async () => {
      try {
        const [gj, ej] = await Promise.all([
          fetch("/api/v2/manifest/goals").then((x) => (x.ok ? x.json() : null)).catch(() => null),
          fetch("/api/v2/manifest/entry").then((x) => (x.ok ? x.json() : null)).catch(() => null),
        ])
        const g = (gj?.goals ?? []).find((x: Goal) => x.id === id)
        if (g) { setAffirmation(g.affirmation || g.title); setStartedAt(g.createdAt) }
        setReads(Array.isArray(ej?.entries) ? ej.entries.length : 0)
      } catch { /* ignore */ }
    })()
  }, [previewData, id])

  const days = startedAt ? Math.max(1, Math.round((Date.now() - new Date(startedAt).getTime()) / 86400000)) : null

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-ghost-white">
      <Head><title>สำเร็จแล้ว · MuMate</title></Head>
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col items-center justify-center overflow-hidden bg-gradient-to-b from-[#eaf3ff] to-[#f6ecf0] px-6 pb-24 text-center">
        <Image src="/images/v2/destiny/el-wood.png" alt="" width={96} height={96} unoptimized className="v3-float h-24 w-24 object-contain" />
        <h1 className="mt-3 text-[24px] font-black text-v3-navy">สำเร็จแล้ว</h1>
        <p className="mt-1 max-w-[300px] text-[15px] font-bold leading-6 text-v3-navy">{affirmation || "ความปรารถนาของคุณเป็นจริงแล้ว"}</p>

        <div className="mt-5 flex w-full items-stretch justify-around rounded-[16px] bg-v3-lime px-4 py-3 text-center text-v3-sapphire">
          <div>
            <p className="text-[11px] font-medium">วันสำเร็จ</p>
            <p className="text-[15px] font-black">{thaiDate(new Date().toISOString())}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium">ใช้เวลา</p>
            <p className="text-[15px] font-black">{days ? `${days} วัน` : "-"}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium">อ่านรวม</p>
            <p className="text-[15px] font-black">{reads} ครั้ง</p>
          </div>
        </div>

        <p className="mt-3 max-w-[300px] text-[12px] leading-4 text-v3-text-muted">คุณกลับมาอ่านซ้ำ {reads} ครั้งก่อนที่มันจะเกิดขึ้น</p>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md px-4 py-3">
        <Link href="/v2/service/manifest" className="grid h-12 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-black text-white">กลับสู่สมุด</Link>
      </div>
    </div>
  )
}

export default ManifestDoneScreen
