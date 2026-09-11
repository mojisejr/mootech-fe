// MIGRATED from NestJS GET /member-with-friend  (Phase 1 backfill, #mootech-fullstack-supabase-fold)
// Read list -> Supabase via Drizzle. Parity target: MemberWithFriendService.getMemberWithFriend.
// Usage gate via the Phase 2 helper: NestJS counts the user's member_with_friend rows (== rows.length)
// and limits free=20/member=20; if over limit, isRunAi=false and rows past index getLimit(true)=20 are
// flagged is_disable. Member friends (member_id != '') resolve their profile from the `user` table.
import type { NextApiRequest, NextApiResponse } from 'next'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberWithFriend, user } from '@/lib/db/schema'
import { checkMemberWithFriendUsage, AI_CODE, FREE_FRIEND_LIMIT } from '@/lib/usage'

const FREE_LIMIT = FREE_FRIEND_LIMIT // free friend ceiling (#262: 1 → 20); single source in usage-core

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // DELETE /member-with-friend?user_id=..&id=.. — ลบเพื่อน (scope ที่ user_id + row id: ลบได้เฉพาะของตัวเอง)
  if (req.method === 'DELETE') {
    try {
      const userId = (req.query.user_id as string) ?? ''
      const id = ((req.query.id as string) || (req.query.friend_id as string)) ?? ''
      if (!userId || !id) return res.status(400).json({ error: 'user_id and id are required' })
      const deleted = await db
        .delete(memberWithFriend)
        .where(and(eq(memberWithFriend.id, id), eq(memberWithFriend.userId, userId)))
        .returning({ id: memberWithFriend.id })
      if (deleted.length === 0) return res.status(404).json({ error: 'friend not found' })
      return res.status(200).json({ ok: true, id })
    } catch (e: any) {
      return res.status(500).json({ error: e?.message ?? 'internal error' })
    }
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const userId = (req.query.user_id as string) ?? ''

    const rows = await db
      .select()
      .from(memberWithFriend)
      .where(eq(memberWithFriend.userId, userId))
      .orderBy(asc(memberWithFriend.createAt))

    // NestJS isCheckUsage counts the user's member_with_friend rows -> equals rows.length here.
    const usage = await checkMemberWithFriendUsage(userId, rows.length)
    const isRunAi = usage.code === AI_CODE.SUCCESS

    const lists: any[] = []
    for (let i = 0; i < rows.length; i++) {
      const raw = rows[i]
      const isDisable = isRunAi ? false : i > FREE_LIMIT
      if (raw.memberId !== '') {
        const [friend] = await db
          .select()
          .from(user)
          .where(eq(user.userId, raw.memberId))
          .limit(1)
        if (friend) {
          lists.push({
            id: raw.id,
            user_id: raw.userId,
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
            is_disable: isDisable,
          })
          continue
        }
      }
      lists.push({
        id: raw.id,
        user_id: raw.userId,
        name: raw.name,
        surname: raw.surname,
        picture_url: raw.pictureUrl,
        create_at: raw.createAt,
        update_at: raw.updateAt,
        dob: raw.dob,
        time: raw.time,
        is_remember_time: raw.isRememberTime,
        gender: raw.gender,
        place_name: raw.placeName,
        is_member: false,
        member_id: '',
        is_disable: isDisable,
      })
    }

    return res.status(200).json(lists)
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? 'internal error' })
  }
}
