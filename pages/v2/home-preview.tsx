// DEV-ONLY preview of V2HomeScreen (verify @393 + anchor target). notFound in prod. Real mount = goo /v2.
// ?state=good|neutral|caution|loading|empty — enumerate the Zone-1 state-space (completeness-pass).
import type { GetServerSideProps } from 'next'
import { useRouter } from 'next/router'
import { V2HomeScreen, type DailyFortune } from '@/features/v2-home/components/V2HomeScreen'

const FORTUNES: Record<string, DailyFortune> = {
  good: { percent: 88, grade: 'A', verdict: 'good', headline: 'วันนี้ดวงดีมาก เเค่เริ่มก็สำเร็จเเล้ว', date: '25 กรกฎาคม 2569', best: { text: 'เริ่มต้นโปรเจกต์ใหม่ ติดต่อเจรจาเรื่องการเงิน' }, worst: { text: 'การตัดสินใจด้วยอารมณ์' } },
  neutral: { percent: 62, grade: 'C+', verdict: 'neutral', headline: 'วันนี้ทรงตัว ค่อยเป็นค่อยไป', date: '25 กรกฎาคม 2569', best: { text: 'งานประจำที่คุ้นเคย' }, worst: { text: 'การเดินทางไกลยามวิกาล' } },
  caution: { percent: 34, grade: 'D', verdict: 'caution', headline: 'วันนี้ควรระมัดระวังเป็นพิเศษในทุกการตัดสินใจ', date: '25 กรกฎาคม 2569', best: { text: 'พักผ่อน ทำสมาธิ อยู่กับตัวเอง' }, worst: { text: 'เซ็นสัญญา ลงทุนก้อนใหญ่ การเดินทางไกล' } },
}

export const getServerSideProps: GetServerSideProps = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true }
  return { props: {} }
}

export default function V2HomePreview() {
  const s = (useRouter().query.state as string) || 'good'
  const loading = s === 'loading'
  const fortune = loading || s === 'empty' ? null : (FORTUNES[s] ?? FORTUNES.good)
  return <V2HomeScreen greeting={{ name: 'มิลา' }} mascotCharacter="/images/v2/characters/01_ชวด-ดิน.png" onLogout={() => window.alert('logout()')} fortune={fortune} fortuneLoading={loading} />
}
