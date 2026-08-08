// DEV-ONLY preview of V2HomeScreen (verify @393 + anchor target). notFound in prod. Real mount = goo /v2.
// ?state=good|neutral|caution|loading|empty|overflow|empty-facet — enumerate the Zone-1 state-space.
// ?mut=hardcode — reproduce too's adversary regression (grade/pct hardcoded, ignoring fortune) so the
//   fidelity anchor drives clean+mutant from the URL alone (data-binding teeth, no source patch).
// ?el=full|partial|none|blankband — Contract #2 greeting element line (full = ธาตุ + ดิถี band).
// no "loading": element comes from settled compute (never loading here — too's dead-skeleton catch).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { V2HomeScreen, type DailyFortune, type ElementInfo } from '@/features/v2-home/components/V2HomeScreen'

// ground-truth ดิถี band vocab (ฟีม 2026-07-25), NOT Figma "แข็งแรง".
const ELEMENTS: Record<string, ElementInfo> = {
  full: { elementTh: 'ไม้', strengthLabel: 'ดิถีอ่อน' },
  partial: { elementTh: 'ไม้', strengthLabel: null }, // computed element, no strength band yet
  none: { elementTh: null, strengthLabel: null }, // no profile/compute → row hidden
  blankband: { elementTh: 'ไม้', strengthLabel: '   ' }, // too's whitespace catch — must NOT paint " · "
  worst: { elementTh: 'ดิน', strengthLabel: 'ดิถีแข็งเกินไป' }, // longest ground-truth vocab — must wrap, never clip (@320/360)
}

// date = RAW ISO (what bazi /api/home actually returns) → the component formats it to พ.ศ. (#3).
const FORTUNES: Record<string, DailyFortune> = {
  good: { percent: 88, grade: 'A', verdict: 'good', headline: 'วันนี้ดวงดีมาก เเค่เริ่มก็สำเร็จเเล้ว', date: '2026-06-01', best: { text: 'เริ่มต้นโปรเจกต์ใหม่ ติดต่อเจรจาเรื่องการเงิน' }, worst: { text: 'การตัดสินใจด้วยอารมณ์' } },
  neutral: { percent: 62, grade: 'C+', verdict: 'neutral', headline: 'วันนี้ทรงตัว ค่อยเป็นค่อยไป', date: '2026-11-15', best: { text: 'งานประจำที่คุ้นเคย' }, worst: { text: 'การเดินทางไกลยามวิกาล' } },
  caution: { percent: 34, grade: 'D', verdict: 'caution', headline: 'วันนี้ควรระมัดระวังเป็นพิเศษในทุกการตัดสินใจ', date: '2026-02-28', best: { text: 'พักผ่อน ทำสมาธิ อยู่กับตัวเอง' }, worst: { text: 'เซ็นสัญญา ลงทุนก้อนใหญ่ การเดินทางไกล' } },
  // goo รู1 — out-of-range pct (bad data). Component must clamp arc AND label to ≤100.
  overflow: { percent: 150, grade: 'A+', verdict: 'good', headline: 'ข้อมูลเกินช่วง — ต้อง clamp', date: '2026-06-01', best: { text: 'ทดสอบ bounds' }, worst: { text: 'ปล่อยให้ล้น' } },
  // goo รู2 — fortune with percent but empty facets. Chip must render a graceful "—", never a bare icon.
  'empty-facet': { percent: 70, grade: 'B', verdict: 'neutral', headline: 'มีคะแนนแต่ไม่มีรายละเอียดวันนี้', date: '2026-06-01', best: { text: '' }, worst: { text: '' } },
  // goo date-leak catch — impossible ISO (June has 30 days). Must NOT render "31 มิถุนายน" NOR leak the raw ISO.
  baddate: { percent: 55, grade: 'C', verdict: 'neutral', headline: 'ทดสอบวันที่พัง', date: '2026-06-31', best: { text: 'ก' }, worst: { text: 'ข' } },
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true }
  return { props: {} }
}

export default function V2HomePreview() {
  const q = useRouter().query
  const s = (q.state as string) || 'good'
  const loading = s === 'loading'
  let fortune = loading || s === 'empty' ? null : (FORTUNES[s] ?? FORTUNES.good)
  // too's regression: ignore per-state values, hardcode grade/pct → data-binding must be broken.
  if (fortune && q.mut === 'hardcode') fortune = { ...fortune, grade: 'A', percent: 99 }
  const el = (q.el as string) || 'full'
  let element = ELEMENTS[el] ?? ELEMENTS.full
  // ?element=ไม้|ไฟ|ดิน|ทอง|น้ำ|null — Zone 2 card gradient by element (force the 5 elements + no-data case)
  if (q.element !== undefined) element = { elementTh: q.element === 'null' ? null : (q.element as string), strengthLabel: element.strengthLabel }
  // ?name= — Structure A: name wraps ≤2 lines, never truncates (fast iteration; final verify = real /v2)
  const name = (q.name as string) || 'มิลา'
  // ?pay=paid → no upgrade badge · ?pic=y → avatar image (else letter). goo wires the real profile at /v2.
  const profile = { pictureUrl: q.pic === 'y' ? '/images/v2/mascot/01.webp' : null, showUpgrade: q.pay !== 'paid' }
  // ?mascot=<path> — Zone 2: force a specific mascot to test occlusion across the 60 shapes (?mascot=404 → broken → hero)
  const mascotCharacter = q.mascot === '404' ? '/images/v2/characters/__missing__.png' : ((q.mascot as string) || '/images/v2/characters/01_ชวด-ดิน.webp')
  return <V2HomeScreen greeting={{ name }} mascotCharacter={mascotCharacter} onLogout={() => window.alert('logout()')} fortune={fortune} fortuneLoading={loading} element={element} profile={profile} />
}
