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
            exit={{ opacity: 0, scale: 0.6 }}
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
