// Phase 2 (#286) · ชีทสอนติดตั้ง — the way OUT of the two dead ends the notification toggle can hit:
// "ต้องติดตั้งก่อน" (iOS Safari tab has no PushManager until Add-to-Home-Screen) and "ปฏิเสธไปแล้ว".
//
// BORROWED, NOT INVENTED (the ใบ's rule, and DESIGN.md's):
//   shell      ComingSoonSheet — fixed inset-0 · items-end · scrim · rounded-t-[28px] · X close · role=dialog
//   sheet bg   v3-lemon-chiffon #F9F4F0 = DESIGN.md §7 "Bottom Sheet (636-10221)" bg, top-r28 exactly
//   step row   the PDPA icon-row (§7 Onboarding): white card r16 pad16 gap16 + ghost-white 48px chip r16
//              (24px glyph) + title Bold16/24 navy + body Regular14/22 text-body
// NO new colour, NO new radius, NO new component family. The only new art is the two Apple glyphs below.
//
// 🔴 BOTTOM SHEET, NOT A CENTRE MODAL (มุน, ปรึกษา 2026-08-16): the iOS steps point at the Share button in
// Safari's BOTTOM toolbar. A sheet rising from the bottom sends the eye the same way the instruction does;
// a centred box sends it to the middle and then asks it to look down. It also scrolls once there are 4 steps
// — LogoutModal's max-w-xs centre box does not.
//
// 🔴 WHY THE TWO VARIANTS CARRY DIFFERENT ICON KINDS — this is a decision, not an inconsistency:
//   install  → GLYPHS. The user has to RECOGNISE the Share and Add-to-Home marks on their own screen, so the
//              sheet must show the same shapes iOS shows. Drawn as inline SVG (❌ never a screenshot of
//              Apple's UI in the repo: licensing, and a raster shot is mush on a 3x display).
//   permission → NUMBERS. Device settings look different on every OS and every version; there is no single
//              glyph to recognise. Drawing a fake "settings" icon would be inventing a landmark that is not
//              on the user's screen. Numbers say "step 3 of 4" and lie about nothing.
//
// 🔴 THE PERMISSION VARIANT IS DELIBERATELY OS-NEUTRAL. lib/pwa/capability.ts (goo, #285) hands us
// canReceivePush / needsInstall / permission — and NOTHING that separates iOS-denied from Android-denied
// (needsInstall is already false once installed). Writing "ไปที่ ตั้งค่า > Safari" here would mean guessing
// the OS from something that is not in the contract — the exact move the contract exists to prevent. So the
// copy names what BOTH platforms genuinely have: the device's own settings → notifications → this app.
//
// Presentational only: no capability import, no useState, no network. The caller owns open/close and decides
// WHICH variant from capability — so this file compiles and renders before #285 lands.
import type { ReactNode } from 'react'

export type InstallGuideVariant = 'install' | 'permission'

// ── the two Apple marks, drawn (see the header note on why these are glyphs and not a screenshot) ──

/** iOS Share — the square with an arrow leaving the top. What the user taps in Safari's bottom toolbar. */
function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 15V3" />
      <path d="M8.5 6.5 12 3l3.5 3.5" />
      <path d="M7 10.5H5.75A1.75 1.75 0 0 0 4 12.25v6A1.75 1.75 0 0 0 5.75 20h12.5A1.75 1.75 0 0 0 20 18.25v-6a1.75 1.75 0 0 0-1.75-1.75H17" />
    </svg>
  )
}

/** "Add to Home Screen" — the rounded square with a plus, as it appears in the iOS share menu row. */
function AddToHomeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <path d="M12 8.25v7.5M8.25 12h7.5" />
    </svg>
  )
}

type Step = { key: string; icon: ReactNode; title: string; body: string }

// The chip content for a numbered step — same 48px ghost-white chip, a numeral instead of a glyph.
function StepNumber({ n }: { n: number }) {
  return <span className="font-poppins-v3 text-lg font-semibold leading-none">{n}</span>
}

const STEPS: Record<InstallGuideVariant, Step[]> = {
  install: [
    { key: 'share', icon: <ShareIcon />, title: 'แตะปุ่มแชร์', body: 'ปุ่มรูปสี่เหลี่ยมมีลูกศรชี้ขึ้น อยู่ที่แถบล่างของ Safari' },
    { key: 'add', icon: <AddToHomeIcon />, title: 'เลือก "เพิ่มไปยังหน้าจอโฮม"', body: 'เลื่อนรายการลงมาจะเจอ — ภาษาอังกฤษคือ Add to Home Screen' },
    { key: 'confirm', icon: <StepNumber n={3} />, title: 'แตะ "เพิ่ม" มุมขวาบน', body: 'ไอคอน Mumate จะไปอยู่บนหน้าจอโฮมของคุณ' },
    { key: 'reopen', icon: <StepNumber n={4} />, title: 'เปิด Mumate จากไอคอนนั้น', body: 'แล้วกลับมาเปิดการแจ้งเตือนอีกครั้ง คราวนี้จะเปิดได้' },
  ],
  permission: [
    { key: 'settings', icon: <StepNumber n={1} />, title: 'เปิด "ตั้งค่า" ของเครื่อง', body: 'แอปตั้งค่าของโทรศัพท์ ไม่ใช่ในหน้านี้' },
    { key: 'find', icon: <StepNumber n={2} />, title: 'หาหัวข้อการแจ้งเตือน แล้วเลือก Mumate', body: 'บางเครื่องอยู่ใต้รายชื่อแอป บางเครื่องอยู่ในหัวข้อ "การแจ้งเตือน"' },
    { key: 'allow', icon: <StepNumber n={3} />, title: 'เปิด "อนุญาตการแจ้งเตือน"', body: 'ถ้าปิดอยู่ ให้เปิด แล้วออกจากหน้าตั้งค่าได้เลย' },
    { key: 'back', icon: <StepNumber n={4} />, title: 'กลับมาที่หน้านี้', body: 'ระบบจะเห็นสิทธิ์ใหม่เอง ไม่ต้องรีเฟรช' },
  ],
}

const HEADING: Record<InstallGuideVariant, { title: string; lead: string }> = {
  install: {
    title: 'เปิดแจ้งเตือนบน iPhone',
    // Says WHY before HOW — without the reason this reads as an arbitrary hoop. It is Apple's rule, not ours.
    lead: 'iPhone ส่งแจ้งเตือนให้เว็บที่เปิดในแท็บ Safari ไม่ได้ ต้องเพิ่ม Mumate ลงหน้าจอโฮมก่อน แล้วเปิดจากไอคอนนั้น',
  },
  permission: {
    title: 'เปิดแจ้งเตือนอีกครั้ง',
    lead: 'ตอนนี้การแจ้งเตือนถูกปิดไว้ที่ตัวเครื่อง เราเปิดให้จากในแอปไม่ได้ ต้องเปิดจากตั้งค่าของเครื่องเอง',
  },
}

export function InstallGuideSheet({ variant, onClose }: { variant: InstallGuideVariant; onClose: () => void }) {
  const { title, lead } = HEADING[variant]
  const headingId = `install-guide-${variant}`

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose} data-testid="install-guide-scrim">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        data-testid="install-guide-sheet"
        data-variant={variant}
        onClick={(e) => e.stopPropagation()}
        // max-h + overflow so 4 steps still fit on a 320×568 device with the keyboard-free viewport;
        // pb uses the safe-area inset like SaveSheet so the last row clears the home indicator.
        className="flex max-h-[88vh] w-full max-w-md flex-col overflow-hidden rounded-t-[28px] bg-v3-lemon-chiffon font-ibm"
      >
        <div className="flex items-start gap-3 px-5 pb-2 pt-5">
          <h2 id={headingId} data-testid="install-guide-title" className="flex-1 text-lg font-extrabold leading-7 text-v3-navy">
            {title}
          </h2>
          <button
            type="button"
            aria-label="ปิด"
            data-testid="install-guide-close"
            onClick={onClose}
            className="-mr-1 grid size-8 shrink-0 place-items-center rounded-full text-v3-text-muted hover:bg-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="m6 6 12 12M18 6 6 18" />
            </svg>
          </button>
        </div>

        <p className="px-5 pb-4 text-sm font-medium leading-6 text-v3-text-body">{lead}</p>

        <ol className="flex flex-col gap-3 overflow-y-auto px-5 pb-4">
          {STEPS[variant].map((step) => (
            <li key={step.key} data-testid="install-guide-step" className="flex items-start gap-4 rounded-2xl bg-white p-4 shadow-sm">
              <span aria-hidden className="grid size-12 shrink-0 place-items-center rounded-2xl bg-v3-ghost-white text-v3-sapphire">
                {step.icon}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-base font-bold leading-6 text-v3-navy">{step.title}</span>
                <span className="mt-0.5 block text-sm font-normal leading-[22px] text-v3-text-body">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>

        <div className="px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-1">
          <button
            type="button"
            data-testid="install-guide-done"
            onClick={onClose}
            className="h-[52px] w-full rounded-2xl bg-v3-sapphire text-base font-bold text-white"
          >
            เข้าใจแล้ว
          </button>
        </div>
      </div>
    </div>
  )
}
