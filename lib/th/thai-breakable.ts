// ไทยไม่มีเว้นวรรคระหว่างคำ → บาง webview (LINE/Android) ตัดบรรทัดกลางคำมั่ว
// (desktop Chrome ใช้ dictionary เลยดูปกติ → reproduce บนเดสก์ท็อปไม่ได้)
// แทรก zero-width space (U+200B) ตามขอบคำด้วย Intl.Segmenter แล้วคู่กับ CSS
// word-break:keep-all → เบราว์เซอร์จะตัดบรรทัด "เฉพาะ" ที่ขอบคำจริงเท่านั้น
// มิเรอร์ breakable() ใน pages/api/og/share.tsx (แก้ Thai wrap ฝั่ง OG image)
const ZWSP = "​";

type SegmenterLike = {
  segment: (s: string) => Iterable<{ segment: string }>;
};

let cached: SegmenterLike | null | undefined;

function getSegmenter(): SegmenterLike | null {
  if (cached !== undefined) return cached;
  try {
    const Ctor = (Intl as { Segmenter?: new (l: string, o: { granularity: string }) => SegmenterLike })
      .Segmenter;
    cached = Ctor ? new Ctor("th", { granularity: "word" }) : null;
  } catch {
    cached = null;
  }
  return cached;
}

/**
 * แทรก ZWSP ตามขอบคำไทย เพื่อให้ตัดบรรทัดตรงขอบคำ (ใช้คู่ class break-keep)
 * - ไม่มี Segmenter → fallback แทรกหลังอักษรไทยทุกตัว (ยอมตัดได้ทุกตัวดีกว่าล้น)
 * - ข้อความว่าง/ไม่ใช่ไทย → คืนเดิม
 */
export function thaiBreakable(s: string): string {
  if (!s) return s;
  const seg = getSegmenter();
  if (!seg) return s.replace(/([฀-๿])/g, `$1${ZWSP}`);
  try {
    return Array.from(seg.segment(s), (x) => x.segment).join(ZWSP);
  } catch {
    return s.replace(/([฀-๿])/g, `$1${ZWSP}`);
  }
}
