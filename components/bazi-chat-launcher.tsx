// Self-gating floating launcher for the bazi chat (#mootech-bazi-chat-lane).
// Renders nothing unless the server-resolved access gate allows this user (public switch or
// tester allowlist). Drop one <BaziChatLauncher /> per page — it owns its own visibility,
// button, and modal toggle. Birth/identity are resolved server-side by the BFF.
import { useState } from "react"
import { useBaziChatAccess } from "@/lib/chat/use-bazi-chat-access"
import BaziChatModal from "@/components/bazi-chat-modal"

const BaziChatLauncher = () => {
  const { enabled, userId } = useBaziChatAccess()
  const [open, setOpen] = useState(false)

  if (!enabled) return null

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        title="คุยกับซินแส Mumate"
        aria-label="เปิดแชทซินแส Mumate"
        className="fixed right-0 bottom-0 m-6 z-50 w-[72px] h-[72px] rounded-2xl cursor-pointer flex items-center justify-center text-white text-[28px]"
        style={{
          background: "linear-gradient(332.45deg, #1B9AAF 0%, #FF00EE 143.46%)",
          boxShadow: "0px 0px 20px rgba(56,59,231,0.7)",
        }}
      >
        ☯
      </div>
      {open ? <BaziChatModal userId={userId} onClose={() => setOpen(false)} /> : null}
    </>
  )
}

export default BaziChatLauncher
