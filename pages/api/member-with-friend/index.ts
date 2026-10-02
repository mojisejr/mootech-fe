// MIGRATED from NestJS GET /member-with-friend  (Phase 1 backfill, #mootech-fullstack-supabase-fold)
// + POST (create a friend) — CIEL mumate-be-retirement-001 slice 1e; see the POST branch and lib/v2/friend-store.ts.
// Read list -> Supabase via Drizzle. Parity target: MemberWithFriendService.getMemberWithFriend.
// Usage gate via the Phase 2 helper: NestJS counts the user's member_with_friend rows (== rows.length)
// and limits free=20/member=20; if over limit, isRunAi=false and rows past index getLimit(true)=20 are
// flagged is_disable. Member friends (member_id != '') resolve their profile from the `user` table.
import type { NextApiRequest, NextApiResponse } from 'next'
import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberWithFriend, user } from '@/lib/db/schema'
import { checkMemberWithFriendUsage, AI_CODE, FREE_FRIEND_LIMIT } from '@/lib/usage'
import { resolveSessionUserId, memberCookieMismatch, resolveRouteMember, namesAnotherMember, IDENTITY_MISMATCH_BODY } from '@/lib/v2/resolve-user'
import { createFriend, parseFriendFields, MEMBER_FRIEND_MARKER } from '@/lib/v2/friend-store'

const FREE_LIMIT = FREE_FRIEND_LIMIT // free friend ceiling (#262: 1 → 20); single source in usage-core

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // POST /member-with-friend — add a friend (v2 compatibility "เพิ่มเพื่อน"; v1 modal-add-freind uses the same
  // endpoint). Was mootech-be POST /member-with-friend until slice 1e. Behaviour, parity and the deliberate
  // differences are written down once, in lib/v2/friend-store.ts. What this branch owns is WHO:
  //
  // 🔴 The owner of the new row is the caller's SESSION (resolveSessionUserId — the v2 identity home, the same
  //    resolver /api/v2/matching/calculate uses to read these rows back). The body's `user_id` — which the
  //    client still sends, because the v1 wrapper's signature carries it — is INERT: not read, not compared.
  //    The BE wrote whatever user_id the body named, so anyone could fill anyone's friend list.
  //    (GET and DELETE below follow the same rule since mumate-member-identity-hardening-001 slice 1: the
  //    caller comes from the session, and a ?user_id= naming anyone else is refused with 409.)
  if (req.method === 'POST') {
    const who = await resolveSessionUserId(req, res)
    if (!who.ok) return res.status(who.status).json({ error: who.error })
    // The screen lists friends by the MEMBER_ID cookie. If that names a different account than the session,
    // the friend would be created somewhere the screen is not looking — refuse, as calculate.ts does.
    if (memberCookieMismatch(req, who.userId)) {
      return res.status(409).json({ reason: 'identity', error: 'บัญชีไม่ตรงกัน โปรดออกจากระบบแล้วเข้าสู่ระบบใหม่' })
    }
    const body = (req.body && typeof req.body === 'object' ? req.body : {}) as Record<string, unknown>
    const fields = parseFriendFields(body, true)
    if (!fields.ok) return res.status(400).json({ error: fields.error })
    const pic = body.picture_url
    if (pic !== undefined && pic !== null && typeof pic !== 'string') {
      return res.status(400).json({ error: 'picture_url must be a string' })
    }
    try {
      const out = await createFriend({ ...fields.value, userId: who.userId, pictureUrl: pic as string | null | undefined })
      // 410 GONE with the BE's HttpException body verbatim — { code: 404, message, error: 'Error' }. The v2
      // hook treats any `error` in the answer as a failed create; v1's modal reads the same shape.
      if (!out.ok) return res.status(410).json(out.body)
      return res.status(200).json(out.row)
    } catch {
      // The driver's message is not relayed (it can name tables and values).
      return res.status(500).json({ error: 'create friend failed' })
    }
  }

  // DELETE /member-with-friend?user_id=..&id=.. — ลบเพื่อน (scope ที่ผู้เรียกจาก session + row id: ลบได้เฉพาะของตัวเอง)
  if (req.method === 'DELETE') {
    const who = await resolveRouteMember(req, res)
    if (!who.ok) return res.status(who.status).json(who.body)
    if (namesAnotherMember(req.query.user_id, who.userId)) return res.status(409).json({ ...IDENTITY_MISMATCH_BODY })
    try {
      const userId = who.userId
      const id = ((req.query.id as string) || (req.query.friend_id as string)) ?? ''
      if (!id) return res.status(400).json({ error: 'id is required' })
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
  const who = await resolveRouteMember(req, res)
  if (!who.ok) return res.status(who.status).json(who.body)
  if (namesAnotherMember(req.query.user_id, who.userId)) return res.status(409).json({ ...IDENTITY_MISMATCH_BODY })
  try {
    const userId = who.userId

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
            // not the friend's user_id (hardening slice 1): clients only test it against '' (v1 friend page)
            member_id: MEMBER_FRIEND_MARKER,
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
