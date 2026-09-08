// features/v2-service/components/ManifestHistoryScreen.tsx — /v2/service/manifest/history
// Design: Figma "vb-04-review-done" — ประวัติย้อนหลัง: streak card + บันทึกย้อนหลัง (entries).
// Data: GET /api/v2/manifest/entry → { entries[], streak{current,best} }.
import Head from "next/head"
import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"

import { TopBarBell } from "@/features/v2-shell/components/TopBarBell"
import { TopBarAvatar } from "@/features/v2-shell/components/TopBarAvatar"

type Entry = { entryDate: string; mood: number | null; note: string | null }
type Streak = { current: number; best: number }
type HistoryPreview = { entries: Entry[]; streak: Streak }

const MOODS = ["😞", "😕", "🙂", "😊", "😍"]

function thaiDate(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return d.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" })
}

export function ManifestHistoryScreen({ previewData }: { previewData?: HistoryPreview } = {}) {
  const [entries, setEntries] = useState<Entry[]>(previewData?.entries ?? [])
  const [streak, setStreak] = useState<Streak>(previewData?.streak ?? { current: 0, best: 0 })
  const [loading, setLoading] = useState(!previewData)

  useEffect(() => {
    if (previewData) return
    fetch("/api/v2/manifest/entry")
      .then((x) => (x.ok ? x.json() : null))
      .then((j) => {
        setEntries(Array.isArray(j?.entries) ? j.entries : [])
        if (j?.streak) setStreak(j.streak)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [previewData])

  const toGo = Math.max(0, streak.best - streak.current)

  return (
    <div className="font-ibm min-h-[100dvh] w-full bg-v3-ghost-white">
      <Head><title>ประวัติย้อนหลัง · MuMate</title></Head>
      <div className="relative mx-auto min-h-[100dvh] w-full max-w-md overflow-hidden bg-v3-ghost-white pb-28">
        <header className="flex w-full items-center gap-2 px-4 pt-4">
          <Link href="/v2/service/manifest" aria-label="ย้อนกลับ" className="grid h-9 w-9 flex-none place-items-center rounded-full text-v3-navy hover:bg-black/5">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden><path d="M12.5 4.5 7 10l5.5 5.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Link>
          <h1 className="flex-1 text-lg font-black leading-6 text-v3-navy">ประวัติย้อนหลัง</h1>
          <TopBarBell variant="solid" href="/v2/calendar/notifications" />
          <TopBarAvatar variant="sapphire" href="/v2/account" />
        </header>

        <div className="flex flex-col gap-4 px-4 pt-3">
          {/* streak card */}
          <section className="relative overflow-hidden rounded-[20px] bg-v3-sapphire p-5 text-center text-white">
            <Image src="/images/v2/destiny/el-fire.png" alt="" width={40} height={40} unoptimized className="v3-float absolute left-3 top-3 h-9 w-9 object-contain" />
            <Image src="/images/v2/destiny/el-water.png" alt="" width={36} height={36} unoptimized className="v3-float absolute left-4 bottom-4 h-8 w-8 object-contain" style={{ animationDelay: ".6s" }} />
            <Image src="/images/v2/mascot/01-nav.png" alt="" width={56} height={64} unoptimized className="v3-float absolute right-2 top-2 h-14 w-auto object-contain" style={{ animationDelay: ".3s" }} />
            <p className="text-[40px] font-black leading-none text-v3-lime">{streak.current}</p>
            <p className="mt-1 text-[14px] font-bold">วันติดต่อกัน</p>
            <p className="mx-auto mt-2 inline-block rounded-full bg-white/15 px-3 py-1 text-[11px]">
              {toGo > 0 ? `อีก ${toGo} วันแตะสถิติสูงสุด (${streak.best})` : `แตะสถิติสูงสุดแล้ว (${streak.best})`}
            </p>
          </section>

          <p className="text-[16px] font-bold text-v3-navy">บันทึกย้อนหลัง</p>
          {loading ? (
            <div className="h-40 w-full animate-pulse rounded-[16px] bg-v3-ghost-white" />
          ) : entries.length === 0 ? (
            <p className="rounded-[16px] bg-white p-6 text-center text-[13px] text-v3-text-muted v3-shadow-line">ยังไม่มีบันทึก — เริ่มอ่านแมนิเฟสต์วันนี้กัน</p>
          ) : (
            <div className="flex flex-col gap-3">
              {entries.map((e) => (
                <div key={e.entryDate} className="flex items-start gap-3 rounded-[16px] bg-white p-4 v3-shadow-line">
                  <span className="grid size-8 flex-none place-items-center rounded-full bg-v3-ghost-white text-[16px]">{e.mood ? MOODS[e.mood - 1] : "🙂"}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-bold text-v3-navy">{thaiDate(e.entryDate)}</p>
                    {e.note ? <p className="mt-0.5 text-[13px] leading-5 text-v3-text-body">{e.note}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="rounded-[14px] bg-[#eef7f0] px-4 py-3 text-center text-[13px] font-bold text-[#3E9B4A]">บันทึกทุกวันรับ +5 QI</p>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-md border-t border-v3-border-card bg-white px-4 py-3">
        <Link href="/v2/service/manifest" className="grid h-11 w-full place-items-center rounded-full bg-v3-sapphire text-[15px] font-black text-white">กลับสู่สมุด</Link>
      </div>
    </div>
  )
}

export default ManifestHistoryScreen
