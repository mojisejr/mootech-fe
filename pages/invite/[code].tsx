// pages/invite/[code].tsx — จุดรับ deep link ชวนเพื่อน (team.mp4: ลิงก์กลางรูปแบบ mumate.com/invite/MUMATE123).
// พาโค้ดไปหน้าสมัครพร้อมเติมช่อด้วย ?ref= — รูปแบบโค้ดผิดก็ส่งต่อให้หน้าสมัครเป็นคนกันเอง (ช่องว่าง = ผู้ใช้พิมพ์เอง)
// โค้ด invalid จะถูก useReferralApply/BFF ปฏิเสธตอน submit — ไม่มีทางสมัครพังเพราะลิงก์เพื่อนเน่า
import type { GetServerSideProps } from 'next'

export const getServerSideProps: GetServerSideProps = async ({ params }) => {
  const raw = typeof params?.code === 'string' ? params.code : ''
  const clean = raw.trim()
  const safe = /^[A-Za-z0-9]{4,32}$/.test(clean) ? clean : ''
  return {
    redirect: {
      destination: safe ? `/v2/register?ref=${encodeURIComponent(safe)}` : '/v2/register',
      permanent: false,
    },
  }
}

export default function InvitePage() {
  return null // redirect เสมอ — ไม่มีหน้าวาด
}
