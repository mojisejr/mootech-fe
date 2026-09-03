// features/v2-account/components/ConnectedScreen.tsx — /v2/settings/connected
// เฟรม `account-login — connected`: ช่องทางล็อกอินที่เชื่อมต่ออยู่.
// แหล่งข้อมูล = next-auth session (provider เดียวที่ระบบรองรับตอนนี้) + @name จาก engine.
// 🔴 session ไม่พบ/ไม่มี provider → บอก "ไม่ทราบ" ตรง ๆ ❌ เดาเป็น LINE
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useEffect, useState } from "react"

import { AppHeader } from "@/features/v2-shell/components/AppHeader"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { ProfileGate } from "./ProfileGate"

const CARD = "flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

const PROVIDER_LABEL: Record<string, { name: string; mark: string }> = {
  line: { name: "LINE", mark: "🟢" },
  google: { name: "Google", mark: "🔵" },
  facebook: { name: "Facebook", mark: "🔷" },
  twitter: { name: "X (Twitter)", mark: "⚫" },
  dev: { name: "Dev Login", mark: "🛠" },
}

export function ConnectedScreen() {
  const tier = useV2Tier(false)
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
    return () => {
      alive = false
    }
  }, [])

  const provider = typeof session?.provider === "string" ? session.provider : null
  const known = PROVIDER_LABEL[provider ?? ""]

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>ช่องทางเข้าใช้งาน · MuMate</title></Head>
      <AppHeader testId="connected-header" title="ช่องทางเข้าใช้งาน" backHref="/v2/account" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading || sessionStatus === "loading"} kind={kind} onRetry={() => window.location.reload()} />

        {!loading && kind === "ok" && sessionStatus !== "loading" && (
          <>
            <section className={CARD} data-testid="connected-current">
              <p className="text-[13px] font-bold text-v3-navy">เข้าใช้งานอยู่ผ่าน</p>
              {known ? (
                <div className="flex items-center gap-3 rounded-[14px] border border-v3-border-card px-3 py-3">
                  <span aria-hidden className="text-[18px]">{known.mark}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-bold text-v3-navy">{known.name}</p>
                    <p className="text-[11px] leading-4 text-v3-text-muted">เชื่อมต่ออยู่</p>
                  </div>
                  <span className="flex-none rounded-full bg-v3-lime px-2 py-[2px] text-[11px] font-black text-v3-navy" data-testid="connected-badge">
                    เชื่อมต่ออยู่
                  </span>
                </div>
              ) : (
                <p className="text-[13px] leading-5 text-v3-text-body" data-testid="connected-unknown">
                  ไม่พบข้อมูลช่องทางของเซสชันนี้ — คุณยังใช้งานได้ตามปกติ
                </p>
              )}
            </section>

            <section className={CARD} data-testid="connected-name">
              <p className="text-[13px] font-bold text-v3-navy">ชื่อแสดง (@name)</p>
              {displayName ? (
                <p className="text-[15px] font-black text-v3-navy" data-testid="connected-display-name">@{displayName}</p>
              ) : (
                <p className="text-[13px] leading-5 text-v3-text-body">
                  ยังไม่ได้ตั้ง — ตั้งได้ที่หน้าสมัคร (ใช้โชว์ในระบบเพื่อน/ดวงสมพงษ์)
                </p>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  )
}

export default ConnectedScreen
