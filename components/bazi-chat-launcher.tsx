// Self-gating floating launcher for the bazi chat (#mootech-bazi-chat-lane).
// Renders nothing unless the server-resolved access gate allows this user (public switch or
// tester allowlist). Drop one <BaziChatLauncher /> per page — it owns its own visibility,
// button, and modal toggle. Birth/identity are resolved server-side by the BFF.
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useBaziChatAccess } from "@/lib/chat/use-bazi-chat-access"
import BaziChatModal from "@/components/bazi-chat-modal"

const BaziChatLauncher = () => {
  const { enabled, userId } = useBaziChatAccess()
  const [open, setOpen] = useState(false)

  if (!enabled) return null

  return (
    <>
      {/* floating launcher — hidden while the chat is open so it never covers the sheet
          (the sheet has its own ✕ close). Animates out on open, back in on close. */}
      <AnimatePresence>
        {!open ? (
          <motion.div
            key="launcher"
            onClick={() => setOpen(true)}
            title="คุยกับซินแส Mumate"
            aria-label="เปิดแชทซินแส Mumate"
            className="fixed right-0 bottom-0 m-6 z-[10000] w-[72px] h-[72px] rounded-2xl cursor-pointer flex items-center justify-center text-white text-[28px] leading-none select-none"
            style={{
              background: "linear-gradient(332.45deg, #1B9AAF 0%, #FF00EE 143.46%)",
              boxShadow: "0px 0px 20px rgba(56,59,231,0.7)",
            }}
            initial={{ opacity: 0, scale: 0.6 }}
            // idle breathing pulse once shown
            animate={{ opacity: 1, scale: [1, 1.05, 1] }}
            // #376 A2 — exit ต้องถือ transition ของตัวเอง ห้ามยืม `transition` ก้อนล่างไปใช้
            //
            // ของเดิม `transition` ก้อนเดียวถูกใช้กับทั้ง animate และ exit และ scale ของมันมี
            // `repeat: Infinity` ⇒ แอนิเมชันขาออกไม่มีวันจบ ⇒ AnimatePresence ไม่ถอด node ทิ้ง
            // ปุ่มจึงค้างอยู่ทุกหน้าที่มี launcher (chinese-calendar · fortune-stick · matching ·
            // my-destiny) เป็นกล่อง 72×72 z-[10000] opacity 0 ที่ยังรับคลิกอยู่มุมขวาล่าง
            // และมันทับปุ่ม "ซื้อเพิ่ม" ในโมดัลแชตพอดี — ปุ่มที่ #376 เพิ่งเปลี่ยนให้ตอบ inline
            // ⇒ ของที่ใบนี้ใส่ไป ผู้ใช้กดไม่โดน (บองพิสูจน์ด้วย Playwright: elementFromPoint
            //   กึ่งกลาง "ซื้อเพิ่ม" คืน aria-label ของปุ่มนี้ · วัดที่ 1/4/8 วินาที ค้างทั้งสามครั้ง)
            //
            // 🔴 jsdom มองข้อนี้ไม่เห็น — แอนิเมชันไม่ได้เดินจริง node จึงถูกถอดทุกครั้งไม่ว่า
            // transition หน้าตายังไง ⇒ ด่านของข้อนี้อยู่บนเบราว์เซอร์เท่านั้น (ดู
            // scripts/bazi-chat-launcher-exit.test.tsx ว่ามันเฝ้าอะไรและ **ไม่**เฝ้าอะไร)
            exit={{
              opacity: 0,
              scale: 0.6,
              transition: { duration: 0.2, scale: { duration: 0.2, repeat: 0 } },
            }}
            transition={{
              opacity: { duration: 0.2 },
              scale: { duration: 2.5, ease: "easeInOut", repeat: Infinity },
            }}
            whileTap={{ scale: 0.9 }}
          >
            ☯
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* AnimatePresence lifted here so the sheet's exit animation actually plays on close */}
      <AnimatePresence>
        {open ? <BaziChatModal userId={userId} onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  )
}

export default BaziChatLauncher
