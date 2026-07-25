// DEV-ONLY preview of V2HomeScreen (verify @393 + anchor target). notFound in prod. Real mount = goo /v2.
// ?state=good|neutral|caution|loading|empty|overflow|empty-facet — enumerate the Zone-1 state-space.
// ?mut=hardcode — reproduce too's adversary regression (grade/pct hardcoded, ignoring fortune) so the
//   fidelity anchor drives clean+mutant from the URL alone (data-binding teeth, no source patch).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { V2HomeScreen, type DailyFortune } from '@/features/v2-home/components/V2HomeScreen'

const FORTUNES: Record<string, DailyFortune> = {
  good: { percent: 88, grade: 'A', verdict: 'good', headline: 'วันนี้ดวงดีมาก เเค่เริ่มก็สำเร็จเเล้ว', date: '25 กรกฎาคม 2569', best: { text: 'เริ่มต้นโปรเจกต์ใหม่ ติดต่อเจรจาเรื่องการเงิน' }, worst: { text: 'การตัดสินใจด้วยอารมณ์' } },
  neutral: { percent: 62, grade: 'C+', verdict: 'neutral', headline: 'วันนี้ทรงตัว ค่อยเป็นค่อยไป', date: '25 กรกฎาคม 2569', best: { text: 'งานประจำที่คุ้นเคย' }, worst: { text: 'การเดินทางไกลยามวิกาล' } },
  caution: { percent: 34, grade: 'D', verdict: 'caution', headline: 'วันนี้ควรระมัดระวังเป็นพิเศษในทุกการตัดสินใจ', date: '25 กรกฎาคม 2569', best: { text: 'พักผ่อน ทำสมาธิ อยู่กับตัวเอง' }, worst: { text: 'เซ็นสัญญา ลงทุนก้อนใหญ่ การเดินทางไกล' } },
  // goo รู1 — out-of-range pct (bad data). Component must clamp arc AND label to ≤100.
  overflow: { percent: 150, grade: 'A+', verdict: 'good', headline: 'ข้อมูลเกินช่วง — ต้อง clamp', date: '25 กรกฎาคม 2569', best: { text: 'ทดสอบ bounds' }, worst: { text: 'ปล่อยให้ล้น' } },
  // goo รู2 — fortune with percent but empty facets. Chip must render a graceful "—", never a bare icon.
  'empty-facet': { percent: 70, grade: 'B', verdict: 'neutral', headline: 'มีคะแนนแต่ไม่มีรายละเอียดวันนี้', date: '25 กรกฎาคม 2569', best: { text: '' }, worst: { text: '' } },
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
  return <V2HomeScreen greeting={{ name: 'มิลา' }} mascotCharacter="/images/v2/characters/01_ชวด-ดิน.png" onLogout={() => window.alert('logout()')} fortune={fortune} fortuneLoading={loading} />
}
