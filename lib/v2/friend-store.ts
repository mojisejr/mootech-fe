// lib/v2/friend-store.ts — the two friend WRITES v2 compatibility makes (CIEL mumate-be-retirement-001 slice 1e).
//
// v2 /v2/service/compatibility/[kind] adds a friend (useCompatibility.createFriend) and edits one
// (useCompatibility.updateFriendProfile). Both used to go to mootech-be; the reads (list, detail) and the
// delete already live in pages/api/member-with-friend/. This module is the BE service moved in.
// Parity target: mootech-be src/member-with-friend/member-with-friend.service.ts at 0705378 —
//   createMemberWithFriend        :108-150
//   updateMemberWithFriendProfile :306-326
//   isCheckUsage (the quota)      :43-104, reached here through lib/usage evaluateMemberWithFriendUsage.
//
// WHAT IS KEPT EXACTLY
//   create
//     • the quota: count of ALL the caller's member_with_friend rows (no window) against 20 free / 20 member,
//       membership from member_payment (plan_code = 'MEMBER' and not expired, Asia/Bangkok date compare).
//       Refused → the BE's 410 body { code: 404, message: 'เกิน Limit การใช้งาน', error: 'Error' }.
//     • the row: name, surname, gender, dob, is_remember_time, time, picture_url as sent; place_name = '';
//       is_member = false; member_id = ''; create_at = update_at = Bangkok 'YYYY-MM-DD HH:mm:ss'.
//     • the answer: the saved row, every column, snake_case (TypeORM's save() returned the entity). v2 reads
//       `id` / `name` / `picture_url` / `dob` / `time` from it (compatibility-api createdFriendToSelectInput).
//   update profile
//     • name, surname, gender, dob, is_remember_time, time as sent; place_name = ''; update_at = now.
//       picture_url, is_member, member_id, is_notify, create_at are not touched.
//     • a field the request OMITS is left as it is — TypeORM's save() skips undefined properties, and
//       Drizzle's .set() skips undefined keys the same way. An explicit null still writes NULL.
//     • the answer: the saved row, every column.
//
// WHAT IS DELIBERATELY DIFFERENT (each one closes a hole; none changes a value the BE would have written)
//   • WHO: the owner is the caller's SESSION (pages/api/member-with-friend/*), never a user_id in the body.
//     The BE took `user_id` from the body on create and had no owner at all on update.
//   • update is scoped to the caller's own rows: `WHERE id = friend_id AND user_id = <session>`. The BE
//     updated any row whose id it was given; an id belonging to someone else is now "friend not found" (404).
//     A missing id is 404 too, where the BE threw a TypeError (500).
//   • the quota is race-safe: the count and the insert run in one transaction under a per-user advisory lock,
//     so two simultaneous adds cannot both see 19 and both insert. The BE counted, then saved, with nothing
//     holding the gap (the shape mootech-be#21 measured on the matching quota: 454 users past their ceiling).
//     The ceiling itself, the membership rule and the refusal body are unchanged.
//   • malformed input is 400 before any write, where the BE let the database refuse it (500).
//
// 🔴 INSIDE A TRANSACTION, `tx` ONLY. lib/db runs one connection (max: 1): a `db.` call inside the callback
//    waits for the connection the transaction is holding — a self-deadlock (the link-account.ts wedge).
//    Membership is therefore read before the transaction opens and passed in.
import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { memberWithFriend } from '@/lib/db/schema'
import { AI_CODE, bkkTimestamp } from '@/lib/usage-core'
import { evaluateMemberWithFriendUsage, resolveMembership } from '@/lib/usage'

type FriendRow = typeof memberWithFriend.$inferSelect

/** A member_with_friend row in the snake_case shape the BE returned (TypeORM entity, column names verbatim). */
export type FriendRowJson = {
  id: string
  user_id: string
  name: string | null
  surname: string | null
  picture_url: string | null
  create_at: string
  update_at: string
  dob: string
  time: string
  is_remember_time: boolean
  gender: string | null
  place_name: string
  is_member: boolean
  member_id: string
  is_notify: boolean
}

export function friendRowToJson(r: FriendRow): FriendRowJson {
  return {
    id: r.id,
    user_id: r.userId,
    name: r.name,
    surname: r.surname,
    picture_url: r.pictureUrl,
    create_at: r.createAt,
    update_at: r.updateAt,
    dob: r.dob,
    time: r.time,
    is_remember_time: r.isRememberTime,
    gender: r.gender,
    place_name: r.placeName,
    is_member: r.isMember,
    member_id: r.memberId,
    is_notify: r.isNotify,
  }
}

// ── input parsing ──────────────────────────────────────────────────────────────────────────────────────
// The BE DTOs had no validators; the database was the only check. These accept every shape v1 and v2 send
// (strings, '' for an unknown time, a boolean) and refuse the rest with a reason instead of a 500.

/** A nullable text field: string, null, or absent (→ undefined, meaning "not sent"). Anything else is refused. */
function optText(v: unknown): { ok: true; value: string | null | undefined } | { ok: false } {
  if (v === undefined) return { ok: true, value: undefined }
  if (v === null || typeof v === 'string') return { ok: true, value: v }
  return { ok: false }
}

export type FriendFields = {
  name?: string | null
  surname?: string | null
  gender?: string | null
  dob?: string
  time?: string
  isRememberTime?: boolean
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Parse the six profile fields both writes share. `requireBirth` = create: dob and time are NOT NULL columns
 * with no default, so a create without them could only fail in the database.
 */
export function parseFriendFields(body: Record<string, unknown>, requireBirth: boolean): ParseResult<FriendFields> {
  const out: FriendFields = {}
  for (const key of ['name', 'surname', 'gender'] as const) {
    const r = optText(body[key])
    if (!r.ok) return { ok: false, error: `${key} must be a string` }
    out[key] = r.value
  }
  for (const key of ['dob', 'time'] as const) {
    const v = body[key]
    if (v === undefined) {
      if (requireBirth) return { ok: false, error: `${key} is required` }
      continue
    }
    // dob must say something; time may be '' (the member does not know it — is_remember_time false).
    if (typeof v !== 'string' || (key === 'dob' && v.trim() === '')) {
      return { ok: false, error: `${key} must be a ${key === 'dob' ? 'non-empty ' : ''}string` }
    }
    out[key] = v
  }
  const irt = body.is_remember_time
  if (irt !== undefined) {
    if (typeof irt !== 'boolean') return { ok: false, error: 'is_remember_time must be a boolean' }
    out.isRememberTime = irt
  }
  return { ok: true, value: out }
}

// ── create ─────────────────────────────────────────────────────────────────────────────────────────────

export type CreateFriendInput = FriendFields & { userId: string; pictureUrl?: string | null; now?: Date }

export type CreateFriendOutcome =
  | { ok: true; row: FriendRowJson }
  | { ok: false; reason: 'quota'; body: { code: number; message: string; error: 'Error' } }

/** Thrown inside the transaction purely to roll it back; never escapes this module. */
class QuotaRefused extends Error {
  constructor(readonly body: { code: number; message: string; error: 'Error' }) {
    super('quota')
  }
}

/**
 * Serialise one user's friend-adds for the rest of the transaction. xact, never session-level: lib/db talks
 * to Supabase's TRANSACTION pooler, where only the commit is a unit of ownership (see lib/v2/compat-quota.ts).
 * The key is namespaced so it never shares a slot with the compatibility-quota lock on the same user_id.
 */
async function lockFriendAddsFor(tx: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> }, userId: string) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended('member_with_friend' || chr(31) || ${userId}, 0))`)
}

export async function createFriend(input: CreateFriendInput): Promise<CreateFriendOutcome> {
  const nowDate = input.now ?? new Date()
  const createAt = bkkTimestamp(nowDate)
  // Membership OUTSIDE the transaction (it reads through `db`; see the 🔴 note at the top).
  const membership = await resolveMembership(input.userId, nowDate)

  try {
    const row = await db.transaction(async (tx) => {
      await lockFriendAddsFor(tx, input.userId)
      const [c] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(memberWithFriend)
        .where(eq(memberWithFriend.userId, input.userId))
      const verdict = evaluateMemberWithFriendUsage(membership, Number(c?.n ?? 0))
      if (verdict.code !== AI_CODE.SUCCESS) {
        throw new QuotaRefused({ code: verdict.code, message: verdict.message, error: 'Error' })
      }
      const [inserted] = await tx
        .insert(memberWithFriend)
        .values({
          id: randomUUID(),
          userId: input.userId,
          name: input.name ?? null,
          surname: input.surname ?? null,
          pictureUrl: input.pictureUrl ?? null,
          createAt,
          updateAt: createAt,
          dob: input.dob as string,
          time: input.time as string,
          // TypeORM wrote DEFAULT (false) for an absent is_remember_time; so does this.
          isRememberTime: input.isRememberTime ?? false,
          gender: input.gender ?? null,
          placeName: '',
          isMember: false,
          memberId: '',
          isNotify: false,
        })
        .returning()
      return inserted
    })
    return { ok: true, row: friendRowToJson(row) }
  } catch (e) {
    if (e instanceof QuotaRefused) return { ok: false, reason: 'quota', body: e.body }
    throw e
  }
}

// ── update profile ─────────────────────────────────────────────────────────────────────────────────────

export type UpdateFriendProfileInput = FriendFields & { userId: string; friendId: string; now?: Date }

export type UpdateFriendProfileOutcome = { ok: true; row: FriendRowJson } | { ok: false; reason: 'not-found' }

export async function updateFriendProfile(input: UpdateFriendProfileInput): Promise<UpdateFriendProfileOutcome> {
  const updateAt = bkkTimestamp(input.now ?? new Date())
  // One statement, so no transaction is needed: the owner check and the write are the same WHERE.
  const [row] = await db
    .update(memberWithFriend)
    .set({
      // undefined keys are skipped by Drizzle — the BE's TypeORM save() skipped them too.
      name: input.name,
      surname: input.surname,
      gender: input.gender,
      dob: input.dob,
      isRememberTime: input.isRememberTime,
      time: input.time,
      placeName: '',
      updateAt,
    })
    .where(and(eq(memberWithFriend.id, input.friendId), eq(memberWithFriend.userId, input.userId)))
    .returning()
  if (!row) return { ok: false, reason: 'not-found' }
  return { ok: true, row: friendRowToJson(row) }
}

/**
 * What the friend list and detail answer as `member_id` for a friend who is a registered member
 * (mumate-member-identity-hardening-001 slice 1). It used to be that member's user_id; clients only ever
 * compare it with '' (v1 friend page: editable iff not a member), so a fixed non-empty marker keeps them
 * working without handing one member another member's id.
 */
export const MEMBER_FRIEND_MARKER = 'member'
