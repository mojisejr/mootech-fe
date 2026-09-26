// features/v2-account/components/ConnectedScreen.tsx — /v2/settings/connected (เฟรม `account-login — connected`)
// วิธีเข้าสู่ระบบปัจจุบัน + ช่องทางที่เชื่อมไว้จริง + ปุ่มเชื่อม/ถอด (mumate-login-identity-001 slice 3).
//
// §WHAT CHANGED AND WHY (slice 3). This screen used to decide "connected" with
// `b.key === session.provider` — string equality against whichever provider the
// member happened to sign in with. A second linked provider therefore rendered as
// "ยังไม่ได้เชื่อม" no matter what the database said, and no endpoint returned the
// caller's provider rows at all. /api/auth/link/connections now does, and every
// state on this page comes from it.
//
// §THE +10 QI BADGE WAS WRONG IN THREE WAYS (owner decision 9, 2026-09-24: keep it
// if the award is real, hide it if it is not). Researched in the engine's mission
// definitions: connect_line pays rewardCoins 20, not 10 — and connect_google DOES
// NOT EXIST, so linking Google paid nothing while the badge promised 10. Apple and
// phone showed the badge too and can never pay anything. The badge now reads the
// amount from the engine and is absent when there is no mission for that provider,
// so it self-corrects the day someone adds connect_google.
//
// §APPLE AND PHONE ARE GONE (owner decision 8). Nothing implements either. They
// were harmless while every button said "เร็ว ๆ นี้"; beside two working buttons
// they read as broken rather than unbuilt.
import Head from "next/head"
import { useSession } from "next-auth/react"
import { useCallback, useEffect, useRef, useState } from "react"

import { MergeOfferPanel, type MergePreview } from "./MergeOfferPanel"

import { IconTile, SkyBackdrop, SkyHeader } from "@/features/v2-profile/components/kit"
import { ProfileGate } from "./ProfileGate"

const CARD = "v3-shadow-card flex w-full flex-col gap-3 rounded-[24px] bg-white p-5"
const RETURN_TO = "/v2/settings/connected"
/** The support channel ProfileGate already sends members to. */
const SUPPORT_LINE_URL = "https://lin.ee/mumate"

const CHAT = <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h13a2 2 0 0 1 2 2Z" /></svg>

type ProviderMeta = { name: string; tone: Parameters<typeof IconTile>[0]["tone"]; icon: React.ReactNode }
const PROVIDER: Record<string, ProviderMeta> = {
  line: { name: "LINE", tone: "green", icon: CHAT },
  google: { name: "Google", tone: "blue", icon: <span className="text-[15px] font-black text-[#4285F4]">G</span> },
  facebook: { name: "Facebook", tone: "blue", icon: <span className="text-[15px] font-black text-[#1877F2]">f</span> },
  twitter: { name: "X", tone: "ghost", icon: <span className="text-[14px] font-black text-v3-navy">X</span> },
  dev: { name: "Dev Login", tone: "ghost", icon: <span className="text-[13px]">🛠</span> },
}

/** Only the two providers the identity contract covers. */
const LINKABLE = ["line", "google"] as const
type Linkable = (typeof LINKABLE)[number]

interface Connection {
  provider: Linkable
  linked: boolean
  current: boolean
  canUnlink: boolean
  /** Absent from an older server's reply, so every reader must tolerate undefined
   *  rather than assume the last-method reason and tell half of them something
   *  untrue. */
  unlinkBlockedBy?: 'last-method' | 'current-method' | null
}

/** Every message a member can see from this flow, in their own language. The
 *  collision case names nobody on purpose: saying whose account holds that
 *  identity would leak that it belongs to a member of this service. */
const MESSAGES: Record<string, string> = {
  owned_by_another: "ช่องทางนี้ถูกใช้กับอีกบัญชีหนึ่งอยู่แล้ว จึงเชื่อมกับบัญชีนี้ไม่ได้ — ถ้าคิดว่าเป็นของคุณ ติดต่อทีมงานได้เลย",
  "line-webview-google": "การเชื่อม Google ทำในแอป LINE ไม่ได้ กรุณาเปิดหน้านี้ในเบราว์เซอร์ (Chrome หรือ Safari) แล้วลองใหม่",
  cancelled: "ยกเลิกการเชื่อมแล้ว ไม่มีอะไรเปลี่ยนแปลง",
  not_signed_in: "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองอีกครั้ง",
  identity_unresolved: "ยืนยันตัวตนไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง",
  last_method: "นี่เป็นวิธีเข้าสู่ระบบวิธีเดียวที่เหลืออยู่ ถอดออกแล้วจะเข้าบัญชีไม่ได้อีก",
  // Slice 4. `merge_refused` is deliberately separate from `owned_by_another`: the
  // identity IS the member's own, and the flow declined to decide rather than
  // declining to link. Owner decision 9 makes support the answer for that.
  merge_refused: "ช่องทางนี้เป็นของอีกบัญชีหนึ่ง และเรายังรวมสองบัญชีนี้ให้อัตโนมัติไม่ได้ — ติดต่อทีมงานเพื่อให้ช่วยตรวจสอบได้เลย",
  not_a_collision: "ช่องทางนี้เชื่อมกับบัญชีนี้อยู่แล้ว",
  no_offer: "คำขอรวมบัญชีหมดอายุแล้ว กรุณาเริ่มเชื่อมใหม่อีกครั้ง",
  member_missing: "ยืนยันบัญชีไม่ได้ในตอนนี้ กรุณาลองใหม่อีกครั้ง",
  // The member is signed in THROUGH this method. Not a refusal to help — a door
  // they open by signing in the other way, so the sentence names that way.
  current_method: "คุณกำลังเข้าสู่ระบบด้วยวิธีนี้อยู่ ออกจากระบบแล้วเข้าด้วยอีกวิธีก่อน จึงจะถอดวิธีนี้ได้",
  // The feature is not configured on this deployment. It is NOT "try again": no
  // number of retries configures a server, and FALLBACK_ERROR used to say so.
  // Owner decision 22 (plan 0.8): one working identity per provider. The usual cause
  // is picking the wrong Google account in the chooser, so the sentence says that first.
  provider_already_held: "บัญชีนี้เชื่อมช่องทางนี้ไว้แล้วอีกบัญชีหนึ่ง — คุณอาจเลือกบัญชีผิด ถ้าต้องการเปลี่ยน ให้กด \"ยกเลิกการเชื่อม\" อันเดิมก่อน แล้วค่อยเชื่อมใหม่",
  link_unavailable: "ตอนนี้ยังเชื่อมบัญชีไม่ได้ ระบบยังไม่พร้อมใช้งานส่วนนี้ — ไม่ใช่ที่เครื่องคุณ ทีมงานกำลังดูแลอยู่",
}
const FALLBACK_ERROR = "เชื่อมบัญชีไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"

/** Read once on mount. The callback redirects back here with a result in the
 *  query string, and it is stripped afterwards so a refresh does not replay it. */
function readResultFromUrl(): {
  notice: { tone: "ok" | "warn"; text: string } | null
  /** slice 4: the callback is OFFERING a merge. Not a notice — it needs a decision. */
  offer: Linkable | null
} {
  if (typeof window === "undefined") return { notice: null, offer: null }
  const q = new URLSearchParams(window.location.search)
  const linked = q.get("linked")
  const error = q.get("link_error")
  const offer = q.get("merge_offer")
  if (!linked && !error && !offer) return { notice: null, offer: null }
  window.history.replaceState({}, "", window.location.pathname)
  if (offer && (LINKABLE as readonly string[]).includes(offer)) {
    return { notice: null, offer: offer as Linkable }
  }
  if (linked) {
    const name = PROVIDER[linked]?.name ?? linked
    return {
      notice: q.get("already")
        ? { tone: "ok", text: `${name} เชื่อมกับบัญชีนี้อยู่แล้ว` }
        : { tone: "ok", text: `เชื่อม ${name} เรียบร้อยแล้ว` },
      offer: null,
    }
  }
  return { notice: { tone: "warn", text: MESSAGES[error as string] ?? FALLBACK_ERROR }, offer: null }
}

/** jsdom cannot perform a real navigation, so the hop to the start route is
 *  injectable — the same pattern TeamPreviewResetBadge uses. The DECISION to
 *  navigate is the component's own and is what the test asserts; the shipped
 *  default is asserted separately. */
export const defaultNavigate = (url: string) => {
  window.location.href = url
}

export function ConnectedScreen({ navigate = defaultNavigate }: { navigate?: (url: string) => void } = {}) {
  const { data: session, status: sessionStatus } = useSession()
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")
  const [connections, setConnections] = useState<Connection[] | null>(null)
  const [rewards, setRewards] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ tone: "ok" | "warn"; text: string } | null>(null)
  const [mergeOffer, setMergeOffer] = useState<Linkable | null>(null)
  const [mergePreview, setMergePreview] = useState<MergePreview | null>(null)
  const [mergeBusy, setMergeBusy] = useState(false)

  useEffect(() => {
    const { notice: n, offer } = readResultFromUrl()
    setNotice(n)
    setMergeOffer(offer)
  }, [])

  // The server decides what the merge would do; the screen only asks. A preview that
  // cannot be fetched means the offer is gone, so the panel is not shown at all rather
  // than shown with a guess in it.
  useEffect(() => {
    if (!mergeOffer) return
    let alive = true
    fetch(`/api/auth/link/merge/preview?provider=${mergeOffer}`)
      .then((r) => r.json().catch(() => ({})))
      .then((j: {
        ok?: boolean
        survivor?: MergePreview["survivor"]
        loserKeepsNothing?: boolean
        movingProvider?: string
        reason?: string
        error?: string
      }) => {
        if (!alive) return
        if (j?.ok && j.survivor) {
          // movingProvider and reason are carried through unchanged. The panel says which
          // credential moves and why this side is kept, and both answers are the server's —
          // a screen that inferred either would eventually contradict the decision.
          setMergePreview({
            survivor: j.survivor,
            loserKeepsNothing: j.loserKeepsNothing !== false,
            movingProvider: j.movingProvider,
            reason: j.reason,
          })
          return
        }
        setMergeOffer(null)
        setNotice({ tone: "warn", text: MESSAGES[j?.error ?? ""] ?? FALLBACK_ERROR })
      })
      .catch(() => {
        if (!alive) return
        setMergeOffer(null)
        setNotice({ tone: "warn", text: FALLBACK_ERROR })
      })
    return () => {
      alive = false
    }
  }, [mergeOffer])

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

  const loadConnections = useCallback(async () => {
    try {
      const r = await fetch("/api/auth/link/connections")
      if (!r.ok) return
      const j = (await r.json()) as { connections?: Connection[] }
      if (Array.isArray(j?.connections)) setConnections(j.connections)
    } catch {
      // Leaving connections null keeps the list in its default shape rather than
      // rendering a confident "ยังไม่ได้เชื่อม" that may be untrue.
    }
  }, [])

  useEffect(() => {
    void loadConnections()
  }, [loadConnections])

  // The badge amount comes from the engine, never from a number typed here — that
  // is how it came to promise 10 QI for an award that pays 20 and for one that
  // does not exist.
  useEffect(() => {
    let alive = true
    fetch("/api/missions")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { missions?: Array<{ id?: string; rewardCoins?: number; completed?: boolean }> } | null) => {
        if (!alive || !Array.isArray(j?.missions)) return
        const map: Record<string, number> = {}
        for (const m of j.missions) {
          if (typeof m?.id !== "string" || !m.id.startsWith("connect_")) continue
          if (m.completed) continue
          if (typeof m.rewardCoins === "number" && m.rewardCoins > 0) map[m.id.slice("connect_".length)] = m.rewardCoins
        }
        setRewards(map)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  /* §THE MISSION WAS CREDITED FOR THE WRONG THING (recorded 2026-09-24, unfixed
     because it was in no slice's DoD). It fired when the SESSION's provider was
     line, so a member who signs in with LINE and merely opens this screen was paid,
     while a member who signs in with Google and genuinely links LINE was not. That
     was invisible while the reward badge was a hardcoded number; the badge now
     reads the engine, so the second member SEES "+20 QI" offered and then is not
     paid. Making it visible is what turned it into this branch's problem.

     The rule is now the honest one: credit connect_<provider> for a provider the
     member ACTUALLY HOLDS, read from the same /api/auth/link/connections every other
     state on this page comes from. Both members above are then paid, and neither is
     paid twice — `rewards` only carries missions the engine reports as INCOMPLETE,
     and a provider is posted at most once per mount. It also self-corrects the day
     someone adds connect_google to the engine, exactly as the badge does. */
  const credited = useRef<Set<string>>(new Set())
  useEffect(() => {
    if (!connections) return
    for (const row of connections) {
      if (!row.linked) continue
      if (!rewards[row.provider]) continue
      if (credited.current.has(row.provider)) continue
      credited.current.add(row.provider)
      void fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ missionId: `connect_${row.provider}` }),
      }).catch(() => {})
    }
  }, [connections, rewards])

  const startLink = (p: Linkable) => {
    setBusy(p)
    // A real top-level navigation, not fetch-then-assign: inside the LINE webview
    // a cold fetch has returned null and sent members to an error page before they
    // ever reached the provider (lib/auth/oauth-redirect.ts records that round).
    navigate(`/api/auth/link/start/${p}?return_to=${encodeURIComponent(RETURN_TO)}`)
  }

  const unlink = async (p: Linkable) => {
    const name = PROVIDER[p]?.name ?? p
    if (!window.confirm(`ถอด ${name} ออกจากบัญชีนี้? เชื่อมกลับเมื่อไหร่ก็ได้ ข้อมูลดวงและ QI ไม่หาย`)) return
    setBusy(p)
    try {
      const r = await fetch(`/api/auth/link/unlink/${p}`, { method: "DELETE" })
      const j = (await r.json().catch(() => ({}))) as { error?: string }
      if (r.ok) setNotice({ tone: "ok", text: `ถอด ${name} เรียบร้อยแล้ว` })
      else setNotice({ tone: "warn", text: MESSAGES[j?.error ?? ""] ?? FALLBACK_ERROR })
      await loadConnections()
    } catch {
      setNotice({ tone: "warn", text: FALLBACK_ERROR })
    } finally {
      setBusy(null)
    }
  }

  /** Slice 4. The member has read the panel and pressed its own confirm button. The
   *  body says `confirm: "merge"` because a POST alone is not proof of intent — a
   *  prefetch or a retried request produces one. */
  const confirmMerge = async () => {
    if (!mergeOffer) return
    const name = PROVIDER[mergeOffer]?.name ?? mergeOffer
    setMergeBusy(true)
    try {
      const r = await fetch("/api/auth/link/merge/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: mergeOffer, confirm: "merge" }),
      })
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string }
      if (r.ok && j?.ok) {
        setNotice({ tone: "ok", text: `รวมบัญชีเรียบร้อยแล้ว ${name} อยู่กับบัญชีที่เก็บไว้` })
      } else {
        setNotice({ tone: "warn", text: MESSAGES[j?.error ?? ""] ?? FALLBACK_ERROR })
      }
      setMergeOffer(null)
      setMergePreview(null)
      await loadConnections()
    } catch {
      setNotice({ tone: "warn", text: FALLBACK_ERROR })
    } finally {
      setMergeBusy(false)
    }
  }

  /** Declining writes nothing anywhere: the offer was never an authorisation, and the
   *  ticket expires on its own. */
  const cancelMerge = () => {
    setMergeOffer(null)
    setMergePreview(null)
    setNotice({ tone: "ok", text: "ยกเลิกการรวมบัญชีแล้ว ไม่มีอะไรเปลี่ยนแปลง" })
  }

  // Which method this session came in through. Used only to name it in the header;
  // every UNLINK decision reads the server's summary instead, because the session
  // provider alone is what the old screen guessed from.
  const sessionProvider = typeof session?.provider === "string" ? session.provider : null
  const known = sessionProvider ? PROVIDER[sessionProvider] : undefined
  const email = typeof session?.user?.email === "string" && session.user.email ? session.user.email : null
  const rows: Connection[] =
    connections ??
    LINKABLE.map((p) => ({ provider: p, linked: false, current: false, canUnlink: false, unlinkBlockedBy: null }))

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-white font-ibm">
      <SkyBackdrop />
      <Head><title>บัญชีที่เชื่อมต่อ · MuMate</title></Head>
      <SkyHeader title="บัญชีที่เชื่อมต่อ" backHref="/v2/account" testId="connected" />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading || sessionStatus === "loading"} kind={kind} onRetry={() => window.location.reload()} />

        {!loading && kind === "ok" && sessionStatus !== "loading" && (
          <>
            {notice && (
              <div
                data-testid="connected-notice"
                className={`rounded-[18px] border px-4 py-3 text-[13px] leading-5 ${
                  notice.tone === "ok"
                    ? "border-v3-badge-green bg-v3-grade-a-bg text-v3-navy"
                    : "border-v3-border-card bg-v3-ghost-white text-v3-text-body"
                }`}
              >
                {notice.text}
              </div>
            )}

            {/* การเชื่อมบัญชีปัจจุบัน */}
            <div>
              <p className="mb-2 px-1 text-[12px] font-medium text-v3-text-muted">การเชื่อมบัญชีปัจจุบัน</p>
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
                  <span className="flex-none rounded-full bg-v3-grade-a-bg px-3 py-1 text-[11px] font-black text-v3-badge-green" data-testid="connected-badge">ใช้อยู่</span>
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
            </div>

            {/* รวมบัญชี (slice 4) — แสดงเฉพาะเมื่อ callback เสนอ และ server ยืนยันว่ารวมได้ */}
            {mergeOffer && mergePreview ? (
              <MergeOfferPanel
                provider={mergeOffer}
                preview={mergePreview}
                busy={mergeBusy}
                onConfirm={confirmMerge}
                onCancel={cancelMerge}
              />
            ) : null}

            {/* เชื่อมต่อ — สถานะจริงจาก /api/auth/link/connections */}
            <div>
              <p className="mb-2 px-1 text-[12px] font-medium text-v3-text-muted">เชื่อมต่อ</p>
              <div className="flex flex-col divide-y divide-v3-border-card overflow-hidden rounded-[18px] border border-v3-border-card bg-white" data-testid="connected-backup">
                {rows.map((row) => {
                  const meta = PROVIDER[row.provider]
                  const reward = rewards[row.provider]
                  const working = busy === row.provider
                  return (
                    <div key={row.provider} className="flex items-center gap-3 px-4 py-3.5" data-testid={`connected-row-${row.provider}`}>
                      <IconTile tone={meta.tone}>{meta.icon}</IconTile>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-bold text-v3-navy">{meta.name}</p>
                        <p className="text-[11px] leading-4 text-v3-text-muted" data-testid={`connected-state-${row.provider}`}>
                          {row.linked ? (row.current ? "ใช้อยู่" : "เชื่อมแล้ว") : "ยังไม่ได้เชื่อม"}
                        </p>
                        {!row.linked && reward ? (
                          <span className="mt-1 inline-block rounded-full bg-v3-qi-earn-bg px-2 py-[2px] text-[11px] font-black text-v3-qi-earn" data-testid={`connected-reward-${row.provider}`}>
                            +{reward} QI
                          </span>
                        ) : null}
                        {/* Slice 4's merge can only START from a provider that is not yet
                            linked here, so a member who was silently given a second
                            account has no way to learn that this screen is where the two
                            are joined. This line is unconditional for an unlinked
                            provider: it never infers that they hold another account —
                            owner decision 2 forbids that — it only says what linking
                            does if they do. */}
                        {!row.linked ? (
                          <p className="mt-1 text-[11px] leading-4 text-v3-text-muted" data-testid={`connected-merge-hint-${row.provider}`}>
                            เคยเข้าด้วย {meta.name} มาก่อน? เชื่อมที่นี่เพื่อรวมสองบัญชีเป็นบัญชีเดียว
                          </p>
                        ) : null}
                      </div>
                      {row.linked ? (
                        row.canUnlink ? (
                          <button
                            type="button"
                            id={`unlink-${row.provider}`}
                            disabled={working}
                            onClick={() => void unlink(row.provider)}
                            data-testid={`connected-unlink-${row.provider}`}
                            className="flex-none rounded-full border border-v3-border-card px-3 py-1.5 text-[11px] font-bold text-v3-text-muted disabled:opacity-50"
                          >
                            {working ? "กำลังถอด…" : "ยกเลิกการเชื่อม"}
                          </button>
                        ) : (
                          <span
                            className="flex-none rounded-full bg-v3-grade-a-bg px-3 py-1 text-[11px] font-black text-v3-badge-green"
                            title={
                              row.unlinkBlockedBy === "current-method"
                                ? "กำลังเข้าสู่ระบบด้วยวิธีนี้ เข้าด้วยอีกวิธีก่อนจึงถอดได้"
                                : "เป็นวิธีเข้าสู่ระบบวิธีเดียวที่เหลืออยู่ ถอดออกไม่ได้"
                            }
                            data-testid={`connected-only-${row.provider}`}
                          >
                            ใช้อยู่
                          </span>
                        )
                      ) : (
                        <button
                          type="button"
                          id={`link-${row.provider}`}
                          disabled={working}
                          onClick={() => startLink(row.provider)}
                          data-testid={`connected-link-${row.provider}`}
                          className="flex-none rounded-full bg-v3-navy px-3 py-1.5 text-[11px] font-bold text-white disabled:opacity-50"
                        >
                          {working ? "กำลังไป…" : "เชื่อมบัญชี"}
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Owner decision 19 (plan 0.8). A member holding every provider has no link
                button left, so slice 4's merge — which starts from an unlinked provider —
                cannot be reached from here. Before this line they had no way out at all.
                Shown only once the real connections have loaded, never on the default shape. */}
            {connections && rows.every((row) => row.linked) ? (
              <p className="px-1 text-[11px] leading-4 text-v3-text-muted" data-testid="connected-all-linked-help">
                มีบัญชีเก่าอีกบัญชีที่ข้อมูลไม่ครบ?{" "}
                <a href={SUPPORT_LINE_URL} target="_blank" rel="noopener noreferrer" className="font-bold text-v3-sapphire">
                  ทักทีมงานทาง LINE @mumate.co
                </a>{" "}
                เพื่อให้ช่วยรวมบัญชี
              </p>
            ) : null}

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
