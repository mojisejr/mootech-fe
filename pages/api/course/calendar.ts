// GET /api/course/calendar — รายการ EP คอร์สปฏิทิน + สิทธิ์ของผู้ชม.
//   EP ฟรี → ส่ง videoId เสมอ (สาธารณะ) · EP เสียเงิน → ส่ง videoId เฉพาะคนมีสิทธิ์ (ไม่ส่ง id ให้ client ที่ไม่มีสิทธิ์)
//   ไม่ล็อกอินก็เรียกได้ (หน้าขายสาธารณะ) — loggedIn:false, access:false
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { EPISODES, courseAccessFor, readVideoIds } from '@/lib/course/calendar'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  let userId: string | null = null
  try {
    const who = await resolveSessionUserId(req, res)
    if (who.ok) userId = who.userId
  } catch {
    userId = null
  }

  const [{ access, via }, videos] = await Promise.all([courseAccessFor(userId), readVideoIds()])
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({
    loggedIn: Boolean(userId),
    access,
    via,
    episodes: EPISODES.map((e) => ({
      ...e,
      ready: Boolean(videos[e.ep]),
      videoId: e.free || access ? (videos[e.ep] ?? null) : null,
    })),
  })
}
