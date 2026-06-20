// dev-access lane — chat playground page.
// Dev-only surface to develop the bazi chat lane in isolation. Birth info lives in
// localStorage (dev scaffold). Hidden in production via getServerSideProps notFound.
import type { GetServerSideProps } from "next"
import { useEffect, useState } from "react"
import BaziChatModal from "@/dev-access/bazi-chat-modal"
import {
  clearBirthProfile,
  loadBirthProfile,
  saveBirthProfile,
  type DevBirthProfile,
} from "@/dev-access/birth-adapter"

export const getServerSideProps: GetServerSideProps = async () => {
  // never expose this dev surface in production
  if (process.env.NODE_ENV === "production") {
    return { notFound: true }
  }
  return { props: {} }
}

const EMPTY: DevBirthProfile = {
  dob: "",
  time: "",
  gender: "MALE",
  isRememberTime: true,
}

export default function ChatPlaygroundPage() {
  const [form, setForm] = useState<DevBirthProfile>(EMPTY)
  const [saved, setSaved] = useState<DevBirthProfile | null>(null)
  const [showChat, setShowChat] = useState(false)

  useEffect(() => {
    const existing = loadBirthProfile()
    if (existing) {
      setSaved(existing)
      setForm(existing)
    }
  }, [])

  const onSave = () => {
    if (!form.dob) {
      alert("กรอกวันเกิดก่อนนะ")
      return
    }
    const profile: DevBirthProfile = {
      ...form,
      time: form.isRememberTime ? form.time : "",
    }
    saveBirthProfile(profile)
    setSaved(profile)
  }

  const onClear = () => {
    clearBirthProfile()
    setSaved(null)
    setForm(EMPTY)
    setShowChat(false)
  }

  return (
    <main className="min-h-screen bg-[#1f2b4d] text-white p-6 max-w-[560px] mx-auto">
      <h1 className="text-[22px] font-semibold mb-1">Bazi Chat Playground</h1>
      <p className="text-white/60 text-[13px] mb-6">
        dev-only · วันเกิดเก็บใน localStorage · คุยกับ bazi ผ่าน BFF (/api/chat/bazi)
      </p>

      <section className="bg-white/5 rounded-2xl p-5 mb-6 border border-white/10">
        <h2 className="text-[16px] font-medium mb-4">ข้อมูลวันเกิด</h2>

        <label className="block text-[13px] text-white/70 mb-1">วันเกิด</label>
        <input
          type="date"
          value={form.dob}
          onChange={(e) => setForm({ ...form, dob: e.target.value })}
          className="w-full mb-4 rounded-lg bg-white/10 px-3 py-2 outline-none"
        />

        <label className="flex items-center gap-2 text-[13px] text-white/70 mb-2">
          <input
            type="checkbox"
            checked={form.isRememberTime}
            onChange={(e) =>
              setForm({ ...form, isRememberTime: e.target.checked })
            }
          />
          รู้เวลาเกิด
        </label>
        {form.isRememberTime ? (
          <input
            type="time"
            value={form.time}
            onChange={(e) => setForm({ ...form, time: e.target.value })}
            className="w-full mb-4 rounded-lg bg-white/10 px-3 py-2 outline-none"
          />
        ) : (
          <p className="text-white/50 text-[12px] mb-4">
            ไม่รู้เวลา → ระบบจะใช้ 12:00 เป็นค่าเริ่มต้น
          </p>
        )}

        <label className="block text-[13px] text-white/70 mb-1">เพศ</label>
        <div className="flex gap-2 mb-5">
          {(["MALE", "FEMALE"] as const).map((g) => (
            <button
              key={g}
              onClick={() => setForm({ ...form, gender: g })}
              className={
                "px-4 py-2 rounded-lg text-[14px] " +
                (form.gender === g ? "bg-moumate_blue" : "bg-white/10")
              }
            >
              {g === "MALE" ? "ชาย" : "หญิง"}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-lg bg-moumate_blue text-[14px] cursor-pointer"
          >
            บันทึก
          </button>
          {saved ? (
            <button
              onClick={onClear}
              className="px-4 py-2 rounded-lg bg-white/10 text-[14px] cursor-pointer"
            >
              ล้าง
            </button>
          ) : null}
        </div>
      </section>

      {saved ? (
        <p className="text-white/70 text-[13px]">
          เก็บแล้ว: {saved.dob} · {saved.time || "ไม่ระบุเวลา (→12:00)"} ·{" "}
          {saved.gender} — กดปุ่มมุมขวาล่างเพื่อเปิดแชท
        </p>
      ) : (
        <p className="text-white/40 text-[13px]">บันทึกวันเกิดก่อนเพื่อเปิดแชท</p>
      )}

      {/* floating launcher */}
      {saved ? (
        <div
          onClick={() => setShowChat(true)}
          className="fixed right-0 bottom-0 m-6 z-50 w-[72px] h-[72px] rounded-2xl cursor-pointer flex items-center justify-center text-white text-[28px]"
          style={{
            background: "linear-gradient(332.45deg, #1B9AAF 0%, #FF00EE 143.46%)",
            boxShadow: "0px 0px 20px rgba(56,59,231,0.7)",
          }}
        >
          ☯
        </div>
      ) : null}

      {showChat && saved ? (
        <BaziChatModal birth={saved} onClose={() => setShowChat(false)} />
      ) : null}
    </main>
  )
}
