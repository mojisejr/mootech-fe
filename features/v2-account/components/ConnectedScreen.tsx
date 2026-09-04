// features/v2-account/components/ConnectedScreen.tsx — /v2/settings/connected (เฟรม `account-login — connected`)
// วิธีเข้าสู่ระบบปัจจุบัน (จาก next-auth session) + วิธีสำรอง (Google/Apple/เบอร์ +10 QI) + โน้ตกู้บัญชี.
// 🔴 การเชื่อมบัญชีสำรอง (account linking) ยังไม่มี backend → โชว์รายการตามเฟรม แต่ปุ่มเป็น "เร็ว ๆ นี้" (ไม่แกล้งทำ).
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

import { IconTile, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { ProfileGate } from "./ProfileGate"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"

const CHAT = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>
const PHONE = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" /></svg>

type ProviderMeta = { name: string; tone: Parameters<typeof IconTile>[0]["tone"]; icon: React.ReactNode }
const PROVIDER: Record<string, ProviderMeta> = {
  line: { name: "LINE", tone: "green", icon: CHAT },
  google: { name: "Google", tone: "blue", icon: <span className="text-[15px] font-black text-[#4285F4]">G</span> },
  facebook: { name: "Facebook", tone: "blue", icon: <span className="text-[15px] font-black text-[#1877F2]">f</span> },
  twitter: { name: "X", tone: "ghost", icon: <span className="text-[14px] font-black text-v3-navy">X</span> },
  dev: { name: "Dev Login", tone: "ghost", icon: <span className="text-[13px]">🛠</span> },
}
// วิธีสำรองตามเฟรม — key ไม่ซ้ำกับ provider ปัจจุบันจะถูกโชว์
const BACKUP: Array<{ key: string } & ProviderMeta> = [
  { key: "google", name: "Google", tone: "blue", icon: <span className="text-[15px] font-black text-[#4285F4]">G</span> },
  { key: "apple", name: "Apple", tone: "ghost", icon: <span className="text-[15px] font-black text-v3-navy">A</span> },
  { key: "phone", name: "เบอร์โทรศัพท์", tone: "teal", icon: PHONE },
]

export function ConnectedScreen() {
  const { data: session, status: sessionStatus } = useSession()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")

  useEffect(() => {
    let alive = true
    fetch("/api/profile")
      .then((r) => {
        if (r.status === 401) throw new Error("401")
        return r.ok ? r.json() : Promise.reject(new Error(String(r.status)))
      })
      .then((j) => {
        if (!alive) return
        setDisplayName(typeof j?.profile?.displayName === "string" ? j.profile.displayName : null)
        setKind("ok")
        setLoading(false)
      })
      .catch((e: Error) => {
        if (!alive) return
        setKind(e.message === "401" ? "not_authenticated" : "failed")
        setLoading(false)
      })
    return () => { alive = false }
  }, [])

  const provider = typeof session?.provider === "string" ? session.provider : null
  const known = provider ? PROVIDER[provider] : undefined
  const email = typeof session?.user?.email === "string" && session.user.email ? session.user.email : null
  const backup = BACKUP.filter((b) => b.key !== provider)

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>บัญชีเข้าสู่ระบบ · MuMate</title></Head>
      <SkyHeader title="บัญชีเข้าสู่ระบบ" backHref="/v2/account" testId="connected" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading || sessionStatus === "loading"} kind={kind} onRetry={() => window.location.reload()} />

        {!loading && kind === "ok" && sessionStatus !== "loading" && (
          <>
            {/* วิธีเข้าสู่ระบบปัจจุบัน */}
            <section className={CARD} data-testid="connected-current">
              {known ? (
                <div className="flex items-center gap-3">
                  <IconTile tone={known.tone}>{known.icon}</IconTile>
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-black text-v3-navy">{known.name}</p>
                    <p className="text-[11px] leading-4 text-v3-text-muted">
                      {email ? `${email} · ` : ""}วิธีเข้าสู่ระบบหลัก
                    </p>
                  </div>
                  <span className="flex-none rounded-full bg-[#E8F5E9] px-3 py-1 text-[11px] font-black text-[#1B7F3B]" data-testid="connected-badge">ใช้อยู่</span>
                </div>
              ) : (
                <p className="text-[13px] leading-5 text-v3-text-body" data-testid="connected-unknown">
                  ไม่พบข้อมูลช่องทางของเซสชันนี้ — คุณยังใช้งานได้ตามปกติ
                </p>
              )}
              {displayName ? (
                <p className="border-t border-v3-border-card pt-3 text-[12px] text-v3-text-muted" data-testid="connected-name">
                  ชื่อแสดง: <span className="font-bold text-v3-navy" data-testid="connected-display-name">@{displayName}</span>
                </p>
              ) : null}
            </section>

            {/* วิธีสำรอง — การ์ดเดียวมีเส้นแบ่งในตัว, ไม่มีไอคอน (เฟรม list) */}
            <div>
              <p className="mb-2 px-1 text-[12px] font-medium text-v3-text-muted">เพิ่มวิธีเข้าสู่ระบบสำรอง</p>
              <div className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white" data-testid="connected-backup">
                {backup.map((b) => (
                  <div key={b.key} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[14px] font-bold text-v3-navy">{b.name}</p>
                      <p className="text-[11px] leading-4 text-v3-text-muted">ยังไม่ได้เชื่อม</p>
                      <span className="mt-1 inline-block rounded-full bg-[#E3F8D1] px-2 py-[2px] text-[11px] font-black text-[#63B05F]">+10 QI</span>
                    </div>
                    <span className="flex-none rounded-full bg-v3-ghost-white px-3 py-1.5 text-[11px] font-bold text-v3-text-muted" title="เปิดให้ใช้เร็ว ๆ นี้">เร็ว ๆ นี้</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="px-1 text-[11px] leading-4 text-v3-text-muted">
              แนะนำให้เชื่อมอย่างน้อย 2 วิธี ถ้าเข้าวิธีหลักไม่ได้จะยังกู้บัญชีคืนได้ — ข้อมูลดวงและ QI ทั้งหมดผูกกับบัญชีนี้
            </p>
          </>
        )}
      </div>
    </div>
  )
}

export default ConnectedScreen
