// PUT /api/member-with-friend/profile — edit a friend's birth profile (v2 compatibility "แก้ไขข้อมูลเพื่อน";
// v1 /friend/[id]/edit uses the same endpoint). Was mootech-be PUT /member-with-friend/profile until CIEL
// mumate-be-retirement-001 slice 1e. What is written, what is left alone, and every deliberate difference
// from the BE are in lib/v2/friend-store.ts (updateFriendProfile). This file owns WHO and the request shape.
//
// Body (the v1 wrapper's shape, unchanged): { friend_id, dob, time, gender, is_remember_time, name, surname }.
//
// 🔴 OWNERSHIP. The BE updated whichever row `friend_id` named — any member's friend, with no caller identity
//    at all. Here the row must belong to the caller's SESSION (resolveSessionUserId): the owner check is part
//    of the UPDATE's own WHERE, so there is no read-then-write gap for it to fall through. Someone else's
//    friend_id answers exactly like a friend_id that does not exist — 404 — so the route does not confirm
//    that another member's row exists.
//
// No quota: the BE had none on an edit, and an edit adds no row.
import type { NextApiRequest, NextApiResponse } from 'next'
import { resolveSessionUserId, memberCookieMismatch } from '@/lib/v2/resolve-user'
import { parseFriendFields, updateFriendProfile } from '@/lib/v2/friend-store'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PUT') {
    res.setHeader('Allow', 'PUT')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Identity first — before the body is looked at, so an unauthenticated caller learns nothing from it.
  const who = await resolveSessionUserId(req, res)
  if (!who.ok) return res.status(who.status).json({ error: who.error })
  if (memberCookieMismatch(req, who.userId)) {
    return res.status(409).json({ reason: 'identity', error: 'บัญชีไม่ตรงกัน โปรดออกจากระบบแล้วเข้าสู่ระบบใหม่' })
  }

  const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
  const friendId = typeof body.friend_id === 'string' ? body.friend_id.trim() : ''
  if (!friendId) return res.status(400).json({ error: 'friend_id is required' })
  const fields = parseFriendFields(body, false)
  if (!fields.ok) return res.status(400).json({ error: fields.error })

  try {
    const out = await updateFriendProfile({ ...fields.value, userId: who.userId, friendId })
    if (!out.ok) return res.status(404).json({ error: 'friend not found' })
    return res.status(200).json(out.row)
  } catch {
    // The driver's message is not relayed (it can name tables and values).
    return res.status(500).json({ error: 'update friend failed' })
  }
}
