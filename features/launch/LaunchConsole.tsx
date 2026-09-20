// features/launch/LaunchConsole.tsx — the #606 go-live console (secret /launch page).
// นับถอยหลังถึงฤกษ์ 20 ก.ย. 13:00-14:59 · เตือนพิธี (หันหน้า 195° อธิษฐาน) · ปุ่มเดียวเปิดระบบ (ยืนยัน 2 ชั้น)
// + ทดสอบแบบไม่เปิดจริง (dry-run) + ปุ่มปิดฉุกเฉิน (rollback). "คนกด" = เอ็ม เท่านั้น (ถือ LAUNCH_KEY).
import { useEffect, useMemo, useRef, useState } from "react"

// ฤกษ์อัพ: เสาร์ 20 ก.ย. 2569 (2026) 13:00-14:59 Asia/Bangkok
const RITE_START = new Date("2026-09-20T13:00:00+07:00").getTime()
const RITE_END = new Date("2026-09-20T15:00:00+07:00").getTime() // 14:59 น. = ก่อน 15:00

type Status = {
  armed: boolean
  missing: string[]
  env: { maintenance: string; v2Locked: boolean } | null
  project?: { projectId: string; teamId: string | null; via: string } | null
  error?: string
}

function useCountdown(target: number) {
  // null until mounted → server and first client render match (no hydration mismatch on the ticking clock)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = now == null ? 0 : Math.max(0, target - now)
  const s = Math.floor(ms / 1000)
  return {
    now,
    mounted: now != null,
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    sec: s % 60,
    reached: now != null && now >= target,
  }
}

export function LaunchConsole() {
  const c = useCountdown(RITE_START)
  const inWindow = c.now != null && c.now >= RITE_START && c.now < RITE_END
  const [status, setStatus] = useState<Status | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<null | "go" | "rollback">(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const loadStatus = async () => {
    try {
      const r = await fetch("/api/launch/status")
      const j = await r.json()
      setStatus(j)
    } catch {
      /* ignore */
    }
  }
  useEffect(() => {
    void loadStatus()
    pollRef.current = setInterval(() => void loadStatus(), 15000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [])

  const dryRun = async () => {
    setBusy(true); setMsg(null)
    try {
      const r = await fetch("/api/launch/go?dryRun=1", { method: "POST" })
      const j = await r.json()
      setMsg("ทดสอบ (ไม่เปิดจริง): " + (j.plan ? j.plan.join(" · ") : JSON.stringify(j)))
    } catch { setMsg("ทดสอบไม่สำเร็จ") } finally { setBusy(false) }
  }

  const doAction = async (kind: "go" | "rollback") => {
    setBusy(true); setMsg(null); setConfirming(null)
    try {
      const r = await fetch(`/api/launch/${kind === "go" ? "go" : "rollback"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true }),
      })
      const j = await r.json()
      setMsg(r.ok ? "✅ " + (j.note ?? "สำเร็จ") : "⛔ " + (j.error?.message ?? "ล้มเหลว"))
      setTimeout(() => void loadStatus(), 3000)
    } catch { setMsg("⛔ เชื่อมต่อไม่สำเร็จ") } finally { setBusy(false) }
  }

  const live = status?.env && status.env.maintenance !== "on" && !status.env.v2Locked
  const cd = useMemo(
    () => (!c.mounted ? "…" : c.reached ? "ถึงเวลาฤกษ์แล้ว" : `${c.d} วัน ${c.h} ชม. ${c.m} นาที ${c.sec} วิ`),
    [c],
  )

  return (
    <div style={{ minHeight: "100vh", background: "#ffffff", color: "#1a1a2e", maxWidth: 460, margin: "0 auto", padding: 20, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: "8px 0" }}>🚀 ฤกษ์อัพ MuMate</h1>

      {/* สถานะปัจจุบัน */}
      <div style={{ background: live ? "#eaf7ea" : "#fff3e0", border: "1px solid #e5e5e5", borderRadius: 14, padding: 14, margin: "12px 0" }}>
        <div style={{ fontWeight: 700 }}>
          สถานะเว็บตอนนี้: {status?.env == null ? "…" : live ? "🟢 เปิดสู่ผู้ใช้แล้ว" : "🔒 ยังปิด (maintenance/ล็อกทีม)"}
        </div>
        {status?.env ? (
          <div style={{ fontSize: 13, color: "#555", marginTop: 4 }}>
            maintenance: <b>{status.env.maintenance}</b> · v2 lock: <b>{status.env.v2Locked ? "ล็อก" : "ปลดแล้ว"}</b>
          </div>
        ) : null}
        {status && !status.armed ? (
          <div style={{ fontSize: 13, color: "#c0392b", marginTop: 6 }}>
            ⚠️ ปุ่มยังไม่พร้อม — ตั้งค่า env นี้บน Vercel ก่อน: <b>{status.missing.join(", ")}</b>
          </div>
        ) : null}
        {status?.armed && status.project ? (
          <div style={{ fontSize: 12, color: "#2e7d32", marginTop: 6 }}>
            🔎 เจอโปรเจกต์: <b>{status.project.projectId}</b>{status.project.teamId ? ` · team ${status.project.teamId}` : ""} ({status.project.via === "env" ? "จาก env" : "auto-discover"})
          </div>
        ) : null}
        {status?.armed && status.error ? (
          <div style={{ fontSize: 13, color: "#c0392b", marginTop: 6 }}>
            ⚠️ หาโปรเจกต์อัตโนมัติไม่ได้: {status.error} — ตั้ง <b>VERCEL_PROJECT_ID</b> เองแทน
          </div>
        ) : null}
      </div>

      {/* นับถอยหลัง + พิธี */}
      <div style={{ background: "#f6f3ff", borderRadius: 14, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 13, color: "#555" }}>ฤกษ์ เสาร์ 20 ก.ย. 2569 · 13:00–14:59 น.</div>
        <div style={{ fontSize: 26, fontWeight: 800, margin: "6px 0", color: inWindow ? "#2e7d32" : "#4527a0" }}>
          {inWindow ? "🎯 อยู่ในช่วงฤกษ์แล้ว" : cd}
        </div>
        <div style={{ fontSize: 13, color: "#333", lineHeight: 1.6 }}>
          หันหน้าไปทาง <b>195°</b> (ตะวันตกเฉียงใต้) · ตั้งจิตอธิษฐาน<br />แล้วจึงกดปุ่มด้านล่างด้วยตนเอง
        </div>
      </div>

      {/* ปุ่มเปิดระบบ
          2026-09-20 (เอ็มพบ live): เดิมปุ่มนี้ disable ตัวเองทันทีที่ status.env บอกว่า maintenance=off
          (Boolean(live) ใน disabled) — แต่ "env config ว่า off" ไม่เท่ากับ "เว็บจริงถูก redeploy ด้วยค่านั้นแล้ว"
          (เช่นเจอ race ที่ deploy hook build ก่อน env ใหม่ propagate ทัน — ดู lib/launch/vercel.ts). ผลคือ
          หลัง press ครั้งแรกที่ env กลาย off แล้ว ปุ่มล็อกตัวเองถาวร กดซ้ำเพื่อ "บังคับ redeploy อีกที" ไม่ได้เลย
          ทั้งที่ goLive() ออกแบบมาให้ idempotent อยู่แล้ว (คอมเมนต์เดิมในไฟล์นี้). แก้: ไม่ disable จาก live อีกต่อไป
          ปุ่มยังกดซ้ำได้เสมอเมื่อ armed — แค่เปลี่ยนป้าย/สีเป็นโหมด "บังคับ redeploy" แทน "เปิดระบบ" ตอน live. */}
      <button
        type="button"
        disabled={busy || !status?.armed}
        onClick={() => setConfirming("go")}
        style={{
          width: "100%", height: 56, marginTop: 16, borderRadius: 999, border: "none",
          background: live ? "#2e7d32" : "#e53935", color: "#fff", fontSize: 17, fontWeight: 800,
          cursor: busy || !status?.armed ? "not-allowed" : "pointer",
        }}
      >
        {busy ? "กำลังทำงาน…" : live ? "✅ เปิดอยู่แล้ว — กดเพื่อบังคับ redeploy อีกครั้ง" : "🙏 เผยแพร่ — เปิดระบบสู่ผู้ใช้"}
      </button>
      {live ? (
        <p style={{ marginTop: 6, fontSize: 12, color: "#2e7d32", textAlign: "center" }}>
          env บน Vercel เป็น off แล้ว — ถ้าเว็บจริงยังขึ้น maintenance ให้กดปุ่มนี้ซ้ำเพื่อบังคับ redeploy
        </p>
      ) : null}

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="button" disabled={busy || !status?.armed} onClick={() => void dryRun()}
          style={{ flex: 1, height: 40, borderRadius: 999, border: "1px solid #ccc", background: "#fff", fontSize: 13, fontWeight: 700 }}>
          ทดสอบ (ไม่เปิดจริง)
        </button>
        <button type="button" disabled={busy || !status?.armed} onClick={() => setConfirming("rollback")}
          style={{ flex: 1, height: 40, borderRadius: 999, border: "1px solid #e53935", background: "#fff", color: "#e53935", fontSize: 13, fontWeight: 700 }}>
          ปิดระบบฉุกเฉิน
        </button>
      </div>

      {msg ? <p style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, wordBreak: "break-word" }}>{msg}</p> : null}

      <p style={{ marginTop: 16, fontSize: 11, color: "#888", lineHeight: 1.6 }}>
        ปุ่มนี้เปิด production จริง · กดได้เฉพาะผู้ถือกุญแจ (เอ็ม) · หลังกด Vercel จะ redeploy ~1–2 นาที
      </p>

      {/* ยืนยัน 2 ชั้น */}
      {confirming ? (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "grid", placeItems: "center", padding: 20 }}
          onClick={() => setConfirming(null)}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 20, maxWidth: 360 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>
              {confirming === "go" ? "ยืนยันเปิดระบบสู่ผู้ใช้จริง?" : "ยืนยันปิดระบบ (maintenance)?"}
            </div>
            <p style={{ fontSize: 13, color: "#555", margin: "8px 0 16px" }}>
              {confirming === "go"
                ? "ผู้ใช้ทุกคนจะเห็นหน้า v2 ทันทีหลัง redeploy — ทำเมื่อพร้อมและอยู่ในฤกษ์แล้วเท่านั้น"
                : "ผู้ใช้จะกลับไปเห็นหน้าปิดปรับปรุงทั้งเว็บ"}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" onClick={() => setConfirming(null)}
                style={{ flex: 1, height: 44, borderRadius: 999, border: "1px solid #ccc", background: "#fff", fontWeight: 700 }}>ยกเลิก</button>
              <button type="button" onClick={() => void doAction(confirming)}
                style={{ flex: 1, height: 44, borderRadius: 999, border: "none", background: "#e53935", color: "#fff", fontWeight: 800 }}>
                ยืนยัน
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
