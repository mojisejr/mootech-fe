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
      <motion.div
        onClick={() => setOpen((v) => !v)}
        title="คุยกับซินแส Mumate"
        aria-label="เปิดแชทซินแส Mumate"
        className="fixed right-0 bottom-0 m-6 z-[10000] w-[72px] h-[72px] rounded-2xl cursor-pointer flex items-center justify-center text-white text-[28px] leading-none select-none"
        style={{
          background: "linear-gradient(332.45deg, #1B9AAF 0%, #FF00EE 143.46%)",
          boxShadow: "0px 0px 20px rgba(56,59,231,0.7)",
        }}
        // idle breathing pulse
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 2.5, ease: "easeInOut", repeat: Infinity }}
        whileTap={{ scale: 0.9 }}
      >
        {/* icon morph: ☯ idle → ✕ when open (rotate + crossfade) */}
        <AnimatePresence mode="wait" initial={false}>
          {open ? (
            <motion.span
              key="close"
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.2 }}
            >
              ✕
            </motion.span>
          ) : (
            <motion.span
              key="yin"
              initial={{ opacity: 0, rotate: 90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: -90 }}
              transition={{ duration: 0.2 }}
            >
              ☯
            </motion.span>
          )}
        </AnimatePresence>
      </motion.div>

      {/* AnimatePresence lifted here so the sheet's exit animation actually plays on close */}
      <AnimatePresence>
        {open ? <BaziChatModal userId={userId} onClose={() => setOpen(false)} /> : null}
      </AnimatePresence>
    </>
  )
}

export default BaziChatLauncher
