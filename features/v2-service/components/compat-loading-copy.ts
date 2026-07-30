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
