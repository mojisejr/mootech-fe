// features/v2-account/components/EditBirthScreen.tsx — /v2/settings/edit-birth
// ครบ 4 เฟรม: edit-birth-data (ฟอร์ม) · quota used (ใช้สิทธิ์ฟรีแล้ว โชว์ราคา 100 ชี่) ·
// correction request sheet (คำขอถึงทีม) · quota states (ฟรี/จ่ายชี่/รอพิจารณา).
//
// 🔴 โควตาตัดสินที่ engine เท่านั้น (GET quota + PATCH): จอโชว์สถานะจาก quota — ไม่เดาเอง.
// PATCH แต้มไม่พอ → 409 → เปิด InsufficientQiSheet (ชีตเดียวกับระบบชี่)
import Head from "next/head"
import { useCallback, useEffect, useState } from "react"

import { AppHeader } from "@/features/v2-shell/components/AppHeader"
import { useV2Tier } from "@/features/auth/hooks/useV2Tier"
import { InsufficientQiSheet } from "@/features/v2-qi/components/QiSpendSheets"
import { ProfileGate } from "./ProfileGate"

const CARD = "flex w-full flex-col gap-3 rounded-[20px] bg-white p-5 drop-shadow-[0_4px_15px_rgba(26,38,77,0.12)]"

type ProfileResp = {
  profile?: { birthDate?: string | null; birthTime?: string | null; timeUnknown?: boolean | null } | null
  quota?: { birthEditFreeUsed?: boolean; birthEditPriceQi?: number; pendingCorrection?: { reason: string } | null }
}

export function EditBirthScreen() {
  const tier = useV2Tier(false)
  const [loading, setLoading] = useState(true)
  const [kind, setKind] = useState<"ok" | "not_authenticated" | "failed">("ok")
  const [quota, setQuota] = useState<ProfileResp["quota"] | null>(null)
  const [current, setCurrent] = useState<ProfileResp["profile"]>(null)
  const [birth, setBirth] = useState("")
  const [birthTime, setBirthTime] = useState("")
  const [timeUnknown, setTimeUnknown] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [insufficient, setInsufficient] = useState(false)
  const [walletQi, setWalletQi] = useState(0)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [reason, setReason] = useState("")
  const [reqMsg, setReqMsg] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setKind("ok")
    try {
      const res = await fetch("/api/profile")
      if (res.status === 401) {
        setKind("not_authenticated")
        return
      }
      if (!res.ok) {
        setKind("failed")
        return
      }
      const j = (await res.json()) as ProfileResp
      setQuota(j.quota ?? null)
      setCurrent(j.profile ?? null)
      setBirth(j.profile?.birthDate ?? "")
      setBirthTime(j.profile?.birthTime ?? "")
      setTimeUnknown(j.profile?.timeUnknown ?? false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async () => {
    if (!birth) return
    setSaving(true)
    setMsg(null)
    setInsufficient(false)
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          birth,
          birthTime: timeUnknown ? null : birthTime || null,
          timeUnknown,
        }),
      })
      const j = (await res.json().catch(() => ({}))) as { error?: string; birthEditMode?: string }
      if (res.ok) {
        setMsg(
          j.birthEditMode === "free"
            ? "บันทึกแล้ว — ใช้สิทธิ์แก้ฟรี 1 ครั้งของคุณ (ครั้งถัดไปมีค่าใช้จ่าย)"
            : `บันทึกแล้ว — หัก ${quota?.birthEditPriceQi ?? 100} ชี่ ดวงของคุณจะอัปเดตตามวันเกิดใหม่`,
        )
        await load()
      } else if (res.status === 409) {
        // แต้มไม่พอ — ดึงยอดจริงมาโชว์ยอดขาในชีต (ยอดบนจออาจ stale)
        const w = await fetch("/api/qi-wallet").then((r) => (r.ok ? r.json() : null)).catch(() => null)
        setWalletQi(typeof w?.qi === "number" ? w.qi : 0)
        setInsufficient(true)
      } else {
        setMsg(String(j.error ?? "บันทึกไม่สำเร็จ"))
      }
    } finally {
      setSaving(false)
    }
  }

  const requestCorrection = async () => {
    if (!reason.trim()) return
    const res = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reason.trim() }),
    })
    const j = (await res.json().catch(() => ({}))) as { error?: string }
    setReqMsg(res.ok ? "ส่งคำขอแล้ว — ทีมจะติดต่อกลับ" : String(j.error ?? "ส่งไม่สำเร็จ"))
    if (res.ok) {
      setSheetOpen(false)
      setReason("")
      await load()
    }
  }

  const priceQi = quota?.birthEditPriceQi ?? 100
  const freeUsed = quota?.birthEditFreeUsed === true

  return (
    <div className="relative min-h-screen w-full overflow-x-hidden bg-v3-bg-cream font-ibm">
      <Head><title>แก้วันเกิด · MuMate</title></Head>
      <AppHeader testId="edit-birth-header" title="แก้วันเกิด" backHref="/v2/account" membership={tier} upgradeCta={false} className="items-center py-4" />

      <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 pb-36 pt-2">
        <ProfileGate loading={loading} kind={kind} onRetry={() => void load()} />

        {!loading && kind === "ok" && (
          <>
            {/* สถานะโควตา (เฟรม quota states) */}
            {quota?.pendingCorrection ? (
              <section className={CARD} data-testid="eb-pending">
                <p className="text-[13px] font-bold text-v3-sapphire">มีคำขอพิจารณารอทีมดูอยู่</p>
                <p className="text-[12px] leading-4 text-v3-text-body">“{quota.pendingCorrection.reason}”</p>
              </section>
            ) : null}
            <section className={CARD} data-testid="eb-quota">
              <p className="text-[13px] font-bold text-v3-navy">
                {freeUsed ? "คุณใช้สิทธิ์แก้ฟรีไปแล้ว" : "ฟรี 1 ครั้ง — ยังไม่ได้ใช้"}
              </p>
              <p className="text-[12px] leading-4 text-v3-text-body">
                {freeUsed
                  ? `การแก้ครั้งถัดไปใช้ ${priceQi} ชี่ เพราะดวงเปลี่ยนทั้งหมดเมื่อวันเกิดเปลี่ยน`
                  : "สิทธิ์แก้วันเกิดฟรี 1 ครั้งตลอดชีพ — ครั้งถัดไปใช้ชี่ เพราะดวงเปลี่ยนทั้งหมด"}
              </p>
              {current?.birthDate ? (
                <p className="text-[11px] text-v3-text-muted" data-testid="eb-current">
                  วันเกิดปัจจุบันในระบบ: {current.birthDate}{current.timeUnknown ? " (ไม่ทราบเวลาเกิด)" : current.birthTime ? ` ${current.birthTime}` : ""}
                </p>
              ) : null}
            </section>

            {/* ฟอร์ม (เฟรม edit-birth-data) */}
            <section className={CARD} data-testid="eb-form">
              <label className="flex flex-col gap-1">
                <span className="text-[13px] font-bold text-v3-navy">วันเกิด</span>
                <input
                  type="date"
                  value={birth}
                  onChange={(e) => setBirth(e.target.value)}
                  data-testid="eb-date"
                  className="h-11 rounded-full border border-v3-border-input bg-white px-4 text-[14px] outline-none"
                />
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={timeUnknown}
                  onChange={(e) => setTimeUnknown(e.target.checked)}
                  data-testid="eb-time-unknown"
                  className="size-4"
                />
                <span className="text-[13px] text-v3-navy">ไม่ทราบเวลาเกิด</span>
              </label>
              {!timeUnknown && (
                <label className="flex flex-col gap-1">
                  <span className="text-[13px] font-bold text-v3-navy">เวลาเกิด</span>
                  <input
                    type="time"
                    value={birthTime}
                    onChange={(e) => setBirthTime(e.target.value)}
                    data-testid="eb-time"
                    className="h-11 rounded-full border border-v3-border-input bg-white px-4 text-[14px] outline-none"
                  />
                </label>
              )}
              {msg && <p data-testid="eb-msg" className="text-[12px] font-bold text-v3-sapphire">{msg}</p>}
              <button
                onClick={() => void save()}
                disabled={saving || !birth}
                data-testid="eb-save"
                className="mt-1 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white disabled:opacity-40"
              >
                {saving ? "กำลังบันทึก..." : freeUsed ? `ยืนยันแก้ (ใช้ ${priceQi} ชี่)` : "ยืนยันแก้วันเกิด"}
              </button>
            </section>

            {/* คำขอพิจารณา (เฟรม correction request sheet) */}
            <section className={CARD} data-testid="eb-correction">
              <p className="text-[13px] font-bold text-v3-navy">มีข้อสงสัยเรื่องวันเกิด?</p>
              <p className="text-[12px] leading-4 text-v3-text-body">
                ถ้าระบบบันทึกวันเกิดไม่ตรง หรือมีเหตุพิเศษ ให้ทีมช่วยพิจารณาได้
              </p>
              <button
                onClick={() => setSheetOpen(true)}
                data-testid="eb-correction-open"
                className="h-11 w-full rounded-full border border-v3-border-card text-sm font-bold text-v3-navy"
              >
                ขอให้ทีมช่วยพิจารณา
              </button>
              {reqMsg && <p data-testid="eb-correction-msg" className="text-[12px] font-bold text-v3-sapphire">{reqMsg}</p>}
            </section>
          </>
        )}
      </div>

      {/* ชีตคำขอพิจารณา */}
      {sheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={() => setSheetOpen(false)}>
          <div
            className="w-full max-w-md rounded-t-[28px] bg-white p-6 pb-10 font-ibm"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="ขอให้ทีมช่วยพิจารณา"
          >
            <h2 className="text-[18px] font-bold text-v3-navy" data-testid="eb-correction-title">ขอให้ทีมช่วยพิจารณา</h2>
            <p className="mt-1 text-[13px] leading-5 text-v3-text-body">เล่าเหตุผลของคุณ — ทีมจะตรวจสอบและติดต่อกลับ</p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="เช่น สมัครผิดวัน ขอแก้เป็นวันที่ถูกต้อง"
              data-testid="eb-correction-reason"
              rows={4}
              className="mt-3 w-full rounded-[16px] border border-v3-border-input bg-white p-4 text-[14px] outline-none placeholder:text-v3-placeholder"
            />
            <button
              onClick={() => void requestCorrection()}
              disabled={!reason.trim()}
              data-testid="eb-correction-send"
              className="mt-3 grid h-12 w-full place-items-center rounded-full bg-v3-cyan text-base font-bold text-white disabled:opacity-40"
            >
              ส่งคำขอ
            </button>
          </div>
        </div>
      )}

      {/* แต้มไม่พอ — ชีตเดียวกับระบบชี่ (line สมมุติสำหรับแสดงยอดขา) */}
      {insufficient && (
        <InsufficientQiSheet
          line={{ code: "birth_edit", qi: priceQi, grant: { type: "credit", kind: "card_use", credits: 0 }, title: "แก้วันเกิด (ครั้งถัดไป)", note: "" }}
          balance={walletQi}
          onClose={() => setInsufficient(false)}
        />
      )}
    </div>
  )
}

export default EditBirthScreen
