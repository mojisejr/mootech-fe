// Personalized empty-state greeting for the chat (#mootech-chat-mobile-ux, Phase 3).
// Pure + deterministic (testable). Voice = ซินแสมูเมท (female, warm, ค่ะ/นะคะ). Never uses the
// word "ปาจื่อ" (jargon) — says "ดวงชะตา/ดูดวง". Built only from data we actually have client-side:
// the user's name (next-auth session, may be empty), whether they've chatted before, and the hour.
export type Greeting = { line1: string; line2: string }

export type GreetingInput = {
  /** next-auth display name; empty/undefined when the session is still hydrating */
  name?: string | null
  /** true when the user already has prior chat turns (returning) */
  isReturning: boolean
  now: Date
}

function timeSalutation(hour: number): { salute: string; emoji: string } {
  if (hour >= 5 && hour < 11) return { salute: "อรุณสวัสดิ์ค่ะ", emoji: "☀️" }
  if (hour >= 11 && hour < 15) return { salute: "สวัสดีตอนกลางวันค่ะ", emoji: "🌤️" }
  if (hour >= 15 && hour < 18) return { salute: "สวัสดีตอนบ่ายค่ะ", emoji: "🌤️" }
  if (hour >= 18 && hour < 22) return { salute: "สวัสดีตอนเย็นค่ะ", emoji: "🌙" }
  return { salute: "สวัสดีค่ะ ดึกแล้วนะคะ", emoji: "🌙" }
}

export function buildGreeting({ name, isReturning, now }: GreetingInput): Greeting {
  const clean = (name ?? "").trim()
  const honor = clean ? ` คุณ${clean}` : ""
  const { salute, emoji } = timeSalutation(now.getHours())
  const line1 = `${emoji} ${salute}${honor}`

  let line2: string
  if (isReturning) {
    line2 = clean
      ? "ยินดีที่ได้เจอกันอีกนะคะ วันนี้อยากให้มูเมทช่วยดูเรื่องไหนดีคะ"
      : "มูเมทยังอยู่ตรงนี้ค่ะ มีเรื่องไหนในใจ อยากให้ช่วยดูไหมคะ"
  } else {
    line2 = clean
      ? "มูเมทเองนะคะ ซินแสประจำตัวของคุณ — อยากรู้เรื่องความรัก การเงิน การงาน หรือดวงชะตาช่วงนี้ ถามได้เลยค่ะ"
      : "มูเมทเองนะคะ ซินแสประจำตัวที่พร้อมดูดวงให้คุณ อยากรู้เรื่องไหน ถามได้เลยค่ะ"
  }

  return { line1, line2 }
}
