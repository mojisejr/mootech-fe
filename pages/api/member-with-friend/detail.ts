// MIGRATED from NestJS GET /member-with-friend/detail  (Phase 1 DB-CRUD batch, #mootech-fullstack-supabase-fold)
// Pure read -> Supabase via Drizzle. Parity target: MemberWithFriendService.getMemberWithFriendById.
// No usage gate. If the friend is a registered member (is_member=true), the profile fields are
// pulled from the linked `user` row (member_id) instead of the local copy; otherwise return the row.
import type { NextApiRequest, NextApiResponse } from 'next'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberWithFriend, user } from '@/lib/db/schema'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const id = (req.query.id as string) ?? ''

    const [row] = await db
      .select()
      .from(memberWithFriend)
      .where(eq(memberWithFriend.id, id))
      .limit(1)

    if (!row) return res.status(200).json(null)

    if (row.isMember === true) {
      const [friend] = await db
        .select()
        .from(user)
        .where(eq(user.userId, row.memberId))
        .limit(1)
      if (friend) {
        return res.status(200).json({
          id: row.id,
          user_id: row.userId,
          name: friend.name,
          surname: friend.surname,
          picture_url: friend.pictureUrl,
          create_at: friend.createAt,
          update_at: friend.updateAt,
          dob: friend.dob,
          time: friend.time,
          is_remember_time: friend.isRememberTime,
          gender: friend.gender,
          place_name: friend.placeName,
          is_member: true,
          member_id: friend.userId,
        })
      }
    }

    // non-member (or member with missing user row): return the local row in NestJS entity shape
    return res.status(200).json({
      id: row.id,
      user_id: row.userId,
      name: row.name,
      surname: row.surname,
      picture_url: row.pictureUrl,
      create_at: row.createAt,
      update_at: row.updateAt,
      dob: row.dob,
      time: row.time,
      is_remember_time: row.isRememberTime,
      gender: row.gender,
      place_name: row.placeName,
      is_member: row.isMember,
      member_id: row.memberId,
      is_notify: row.isNotify,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
