// features/v2-service/components/compat-loading-copy.ts — ONE source for the ดวงสมพงศ์ calc-wait copy.
// 2F (ฟีม-ordered): the heavy work (calculateCompatibility) runs on the FORM, then the result screen
// re-reads it. Both moments now show the SAME LoadingScreen with the SAME words, so the user sees ONE
// continuous wait across the navigate — not a long "กำลังคำนวณ…" button then a quick flash (D32/D35).
// Kept here as a single constant so the two mount sites can never drift apart.
export const COMPAT_CALC_LOADING = {
  title: 'กำลังคำนวณดวงสมพงศ์',
  // ฟีม-specified verbatim — do not reword.
  subtitle: 'กรุณาอย่าปิดหน้าจอ จนกว่าผลลัพธ์จะขึ้น · ระบบกำลังประมวลผล',
} as const

/**
 * #585 ก้อน 4 — the colleague lane's wait, which is a different length and says so.
 *
 * 🔴 THE SUBTITLE IS ฟีม'S VERBATIM LINE, REUSED UNCHANGED. Only the title differs, because only the
 * title can carry the one fact this lane has and the pair lane does not: how many people are being
 * calculated. Three co-workers measured 8.4 seconds end to end (mootech-fe#585, the real call), which is
 * long enough that a wait saying nothing reads as a screen that has stopped.
 *
 * ⚠️ IT NAMES THE COUNT, NOT THE SECONDS. A number of seconds on screen is a promise the screen cannot
 * keep — 8.4s was one measurement of one payload, and a slow network turns a printed "8 วินาที" into a
 * countdown that runs out while the user is still waiting, which reads as broken. The count is a fact we
 * actually hold: the person chose those people a moment ago.
 */
export const workCalcLoading = (people: number) => ({
  title: people > 1 ? `กำลังคำนวณดวงเพื่อนร่วมงาน ${people} คน` : 'กำลังคำนวณดวงเพื่อนร่วมงาน',
  subtitle: COMPAT_CALC_LOADING.subtitle,
})

