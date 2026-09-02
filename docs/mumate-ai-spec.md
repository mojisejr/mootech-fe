# Mumate AI — screen spec (Figma "Mumate app_ final", page "- Mumate AI")

Source: node `55271-8612` (page `- Mumate AI`) — walked 2026-09-02, day 1 of the 3-day launch plan.
The page contains TWO frames; the shipped route today is the chat screen.

## 1) `mumate-ai-chat` → `/v2/chat` (SHIPPED — commit 4ae5d56)

Frame 393×852, corner radius 40, fill = linear gradient + image BG01 + image BG04 + solid `#F6ECF0`
(implemented as a CSS gradient approximation: `#CFE6FB → #E7E9FB → #F6E7F2 → #FBECEF`).

Element inventory (all present in `features/v2-chat/components/ChatScreen.tsx`):

| # | element | state(s) | notes |
|---|---|---|---|
| 1 | back button ‹ | hover | → `/v2` |
| 2 | title "Mate AI" | — | font-black navy |
| 3 | online pill "●ทำงานอยู่" | — | green dot + green-100 bg |
| 4 | gear ⚙ | idle / confirm ("ล้าง?") | two-tap clear chat (no dead control) |
| 5 | mascot | floating (`v3-float`) | `/images/v2/mascot/01.webp` — exact match to the frame's dragon |
| 6 | teal underlined link | toggles | "ดูสิ่งที่มิวน้อยทำได้" ↔ แสดงรายการ 15 คำถาม canonical |
| 7 | AI greeting bubble | static | Miu-persona copy + 💜 (TODO(figma-copy): swap designer's exact string) |
| 8 | starter chips ×3 | disabled while streaming | ดวงวันนี้เป็นงัย 🌟 · ความสมพงษ์ 💖 · เลขนำโชครายวัน 🎴 (TODO(figma-copy)) |
| 9 | next-question chips | shrink as asked | canonical `SUGGESTED_QUESTIONS` (constants) |
| 10 | mic button 🎤 | idle / listening / hidden | Web Speech API `th-TH`; hidden when unsupported |
| 11 | input "พิมพ์ถามมา..." | disabled while streaming | rounded-full white/85 |
| 12 | send ● | disabled when empty/busy | sapphire circle + arrow |
| 13 | disclaimer | — | "การแชทนี้อยู่เพียงเพื่อความบันเทิงเท่านั้น ไม่สามารถใช้แทนคำแนะนำทางการแพทย์ หรือคำแนะนำทางการเงินได้" |
| 14 | user bubble | — | sapphire bg, white text, right-aligned (not drawn in the frame — follows app grammar) |
| 15 | guard cards | 401 / 402 / 409 | re-login · เติมเครดิต→shop · กรอกวันเกิด→register |

Transport: `POST /api/chat/bazi` (BFF, already shipped) → bazi engine `/api/v1/chat/completions`,
OpenAI-SSE streamed, credits consumed server-side only on a non-empty answer.

## 2) `qi-token-guide-v2-brand-ci` → NOT BUILT YET (sprint-2 candidate; pairs with referral/missions)

Long scroll (1122×1402 art) read at low zoom — elements captured so far:
- title "คุณจะสะสม & ใช้ พลังงานเสียนมีชีวะ" + qi-token coin art (golden coin, floating coins)
- caption line under the coin
- white card "Qi Token คืออะไร?" + paragraph (ชี่ = พลังงานสะสม...)
- section "วิธีสะสมพลังชี่" + link "ดูรายละเอียด →"
  - "Login รายวัน **+5 QI**"
  - "ชวนเพื่อนสมัคร Free Tier **+50 QI**/คน" (more rows below the fold — not yet read)
- growth-loop diagram "สมควรหลีกเลี่ยง (Growth Loop)" (4 steps around the mascot)
- primary CTA + bottom nav with mascot badge

TODO: re-read at high zoom and finish the row list before building (`/api/qi/*` already serves it).
