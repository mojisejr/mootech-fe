// GET /api/course/[slug] — รายการ EP ของคอร์ส + สิทธิ์ของผู้ชม (calendar | life-matrix).
//   EP ฟรี → ส่ง videoId เสมอ · EP เสียเงิน → ส่ง videoId เฉพาะคนมีสิทธิ์ (ไม่ส่ง id ให้ client ที่ไม่มีสิทธิ์)
//   ไม่ล็อกอินก็เรียกได้ (หน้าขายสาธารณะ) — loggedIn:false, access:false
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId } from '@/lib/v2/resolve-user'
import { COURSES, isCourseSlug } from '@/lib/course/content'
import { courseAccessFor, readVideoIds } from '@/lib/course/access'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  const slug = String(req.query.slug ?? '')
  if (!isCourseSlug(slug)) return res.status(404).json({ error: 'course not found' })

  let userId: string | null = null
  try {
    const who = await resolveSessionUserId(req, res)
    if (who.ok) userId = who.userId
  } catch {
    userId = null
  }

  const [{ access, via }, videos] = await Promise.all([courseAccessFor(slug, userId), readVideoIds(slug)])
  res.setHeader('Cache-Control', 'private, no-store')
  return res.status(200).json({
    loggedIn: Boolean(userId),
    access,
    via,
    episodes: COURSES[slug].episodes.map((e) => ({
      ...e,
      ready: Boolean(videos[e.ep]),
      videoId: e.free || access ? (videos[e.ep] ?? null) : null,
    })),
  })
}
