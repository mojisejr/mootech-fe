// features/v2-service/compatibility-api.ts — the v2 create-friend ADAPTER contract (PURE, no v1 import).
// 🔴 SLICE RULE (ฟีม): v2 wraps v1, never rewrites it. This file owns the *mapping* from the Figma form to
// v1's positional signature (the part worth unit-testing); the actual v1 call — MemberWithFriendCreateApi —
// is made in useCompatibility (a client module) so this file stays free of the Next-runtime `getConfig()`
// that the constants/api modules pull in at import, and can run under plain `tsx` in the CI gate.
// done-condition #6: importing/mapping never edits constants/api/* or pages/matching/* — `git diff` stays clean.

// 🔶 THE DOCUMENTED GAP (done-condition #13). v1's create takes 8 positional args including `surname` and
// `gender`; the Figma add-friend form (636:18533) has NEITHER field. FROZEN plan ruling: Figma is the source
// of truth, send documented defaults, DO NOT go silent.
//   surname = ''       (empty — the form STILL collects no surname; documented gap-fill, used below)
//   gender  = 'MALE'   RETAINED for the record (บอง/ฟีม: เก็บไว้ได้ ไม่ต้องลบ) — but as of REFRAME 3 it is
//     NO LONGER a runtime fallback. gender now comes from the user's choice (NewFriendForm.gender). It must
//     NEVER flow into the args by default: `form.gender || COMPAT_FRIEND_DEFAULTS.gender` would silently make
//     an unchosen gender 'MALE' — the EXACT bug REFRAME 3 fixes (the problem was "ผู้ใช้เลือกไม่ได้", not "the
//     default is wrong"). A tooth (scripts/compatibility.test.ts) goes RED if this silent-MALE path returns.
export const COMPAT_FRIEND_DEFAULTS = {
  surname: '',
  gender: 'MALE' as const,
}

// One person row the screen renders (both "คุณ" and the chosen friend share this shape).
export type CompatPerson = {
  /** current user's id for person1; friend_id for person2 (the value the result slice passes to calculate) */
  id: string
  name: string
  /** 'YYYY-MM-DD' | '' */
  dob: string
  /** 'HH:mm' | '' (empty when birth time is not remembered / not yet enriched) */
  time: string
  /** picture URL, '' when none */
  imageProfile: string
}

// 🔶 SEAM GAP CLOSED (μุน's flag): v1 modal-select-freind's onClickMatching gives only
// (id, name, surname, picture_url, is_disable) — NO dob/time. But Figma row-2 (636:18451) shows the friend's
// birthdate + time. μุน can't touch the v1 modal (iron rule) and won't add a fetch (goo's seam). So goo owns
// the enrichment: μุน passes the fields the modal DOES give (below), the hook fills dob/time by reading the
// v1 friend-DETAIL (MemberWithFriendGetDetailApi — a member-with-friend READ, NOT a matching path, so
// done-cond #6 stays clean; a GET, so done-cond #9 (no side effects) stays clean).
//
// 🔶 #570 widened this by TWO OPTIONAL fields, dob/time. The v1 modal still gives neither (its four fields are
// unchanged above), so the select-from-list path behaves exactly as before. The CREATE path is different in
// kind: v1's create echoes the whole saved row back, birth data included, so the friend who was just added is
// already complete in hand. Passing them through means the new friend never renders a blank birthdate row,
// not even for the moment the detail GET is in flight.
export type SelectFriendInput = {
  id: string
  name: string
  surname?: string
  picture_url?: string
  /** 'YYYY-MM-DD' — only the create path has this up front; the v1 modal does not */
  dob?: string
  /** 'HH:mm' — same */
  time?: string
}

// The instant person2 shown the moment a friend is picked. dob/time stay BLANK unless the caller already
// holds them (create path) — absent means absent, never fabricated. PURE.
export function friendInputToPerson(input: SelectFriendInput): CompatPerson {
  return {
    id: input.id,
    name: input.name,
    dob: input.dob ?? '',
    time: input.time ?? '',
    imageProfile: input.picture_url ?? '',
  }
}

// --- #570: the row v1's CREATE endpoint answers with -------------------------------------------------
// mootech-be `POST /member-with-friend` ends at member-with-friend.service.ts:142 `repository.save(entity)`,
// which resolves to the saved row — so the generated primary key comes back with it
// (member-with-friend-entity.model.ts:5-6, `@PrimaryGeneratedColumn('uuid') id`). Only the fields person2
// needs are typed; everything else on that row is ignored on purpose.
export type CreatedFriendRow = {
  error?: unknown
  id?: string | null
  name?: string | null
  surname?: string | null
  picture_url?: string | null
  dob?: string | null
  time?: string | null
}

// Turn that row into the input selectFriend takes, or null when it cannot be trusted to identify anybody.
// 🔴 The id is the ONLY hard requirement, and null here is not a detail: without an id there is no friend to
// read a detail for and no value to send to calculate, so the honest answer is "not selected" — the caller
// surfaces it. `fallbackName` is the name the user typed; it covers a row that echoes no name rather than
// showing an empty row. PURE.
export function createdFriendToSelectInput(
  row: CreatedFriendRow | null | undefined,
  fallbackName: string,
): SelectFriendInput | null {
  if (!row || row.error) return null
  const id = typeof row.id === 'string' ? row.id.trim() : ''
  if (!id) return null
  return {
    id,
    name: row.name || fallbackName,
    surname: row.surname ?? '',
    picture_url: row.picture_url ?? '',
    dob: row.dob ?? '',
    time: row.time ?? '',
  }
}

// The v1 friend-detail record — only the two fields the row-2 display needs are typed. Keys are 'dob'/'time',
// matching the write-side (MemberWithFriendUpdateProfileApi / Create) and UserBirthRow.
export type FriendDetail = { error?: unknown; dob?: string | null; time?: string | null }

// Merge the enriched dob/time onto the instant person2. PURE + defensive: on error / missing keys it KEEPS the
// name+picture person (no strand, no fabricated dob/time) — done-cond #3 discipline applied to person2 too.
export function applyFriendDetail(base: CompatPerson, detail: FriendDetail | null): CompatPerson {
  if (!detail || detail.error) return base
  return { ...base, dob: detail.dob || base.dob, time: detail.time || base.time }
}

// The user's chosen gender. v1 uses these exact uppercase strings (modal-add-freind.tsx). A closed union so
// '' / undefined are NOT representable — a form that fails to provide it is a tsc error, not a silent default.
export type Gender = 'MALE' | 'FEMALE'

// The fields the Figma add-friend form actually collects.
export type NewFriendForm = {
  name: string
  /** 'YYYY-MM-DD' */
  birthDay: string
  /** 'HH:mm' — '' when is_remember_time is false */
  time: string
  isRememberTime: boolean
  /** uploaded picture URL, '' when none */
  imageProfile: string
  /** REFRAME 3 (ฟีม): the user's chosen gender — a real bazi calc input, so locking it = permanently wrong
   *  compute. REQUIRED (union, no '' / undefined). μุน's V3 form pre-selects MALE VISIBLY (v1-style highlight,
   *  user sees + can change) so a value is ALWAYS sent; the default is seen, not hidden behind a fallback. */
  gender: Gender
}

// The exact positional argument tuple for v1's
// MemberWithFriendCreateApi(user_id, dob, name, surname, time, gender, is_remember_time, picture_url).
// PURE + exported so the harness can assert the mapping — especially that the two gap fields land in the
// RIGHT positions with the RIGHT documented values (a swap of surname↔gender is a silent data-corruption
// bug tsc can't see, since both are `string`). Position order here mirrors the v1 signature exactly.
export type CreateFriendArgs = [
  userId: string,
  dob: string,
  name: string,
  surname: string,
  time: string,
  gender: string,
  isRememberTime: boolean,
  pictureUrl: string,
]

export function buildCreateFriendArgs(userId: string, form: NewFriendForm): CreateFriendArgs {
  return [
    userId,
    form.birthDay,
    form.name,
    COMPAT_FRIEND_DEFAULTS.surname, // gap: form STILL has no surname → documented ''
    form.time,
    form.gender, // REFRAME 3: the user's CHOSEN gender — NO `|| default` (silent MALE = the bug we fixed)
    form.isRememberTime,
    form.imageProfile,
  ]
}

// --- Phase 4 (#266): EDIT an existing friend ------------------------------------------------------
// The v1 friend-detail record as the detail route returns it (snake_case), typed for the fields the edit
// form prefills. Keys mirror pages/api/member-with-friend/detail.ts.
export type FriendEditDetail = {
  error?: unknown
  name?: string | null
  surname?: string | null
  dob?: string | null
  time?: string | null
  gender?: string | null
  is_remember_time?: boolean | null
}

// The edit form's fields. Unlike NewFriendForm this carries `surname` (the friend may already have one —
// create left it '' but a member-linked friend has a real surname; we must not drop it on save) and no
// imageProfile (picture is a SEPARATE endpoint, MemberWithFriendUpdateApi — out of scope here).
export type EditFriendForm = {
  name: string
  surname: string
  /** 'YYYY-MM-DD' */
  birthDay: string
  /** 'HH:mm' — '' when time not remembered */
  time: string
  isRememberTime: boolean
  gender: Gender
}

// Prefill the edit form from the friend's existing detail. PURE + defensive: missing/legacy fields fall
// back to safe blanks so the form opens (never strands), and the user can fill them. gender: a legacy
// friend may have null gender — prefill FEMALE only if explicitly 'FEMALE', else MALE (a VISIBLE default
// the user can change, same discipline as the create form's visible MALE pre-select — not a hidden fallback).
export function friendDetailToEditForm(detail: FriendEditDetail | null): EditFriendForm {
  return {
    name: detail?.name || '',
    surname: detail?.surname || '',
    birthDay: detail?.dob || '',
    time: detail?.time || '', // empty when the friend was added without a birth time → user can fill it in
    isRememberTime: !!detail?.is_remember_time,
    gender: detail?.gender === 'FEMALE' ? 'FEMALE' : 'MALE',
  }
}

// The exact positional tuple for v1's
// MemberWithFriendUpdateProfileApi(friend_id, dob, name, surname, time, gender, is_remember_time).
// ⚠️ DIFFERENT order from create (no picture; friend_id first). A surname↔name or gender↔time swap is
// silent data-corruption tsc can't see (all string) — buildEditFriendArgs pins the positions, unit-tested.
export type EditFriendArgs = [
  friendId: string,
  dob: string,
  name: string,
  surname: string,
  time: string,
  gender: string,
  isRememberTime: boolean,
]

export function buildEditFriendArgs(friendId: string, form: EditFriendForm): EditFriendArgs {
  return [friendId, form.birthDay, form.name, form.surname, form.time, form.gender, form.isRememberTime]
}

// The edit outcome, carrying a `reason` on failure in the SAME vocabulary #263 gave the whole line
// ('quota' can't happen for an edit — realistic failures are 'system'/'network'). Type-only imports below
// are erased at runtime, so this module stays pure/node-testable (no axios, no getConfig).
import type { ApiResult } from '@/utils/fetch'
import type { CompatCalcErrorReason } from './hooks/useCompatibilityResult'

export type UpdateFriendResult =
  | { ok: true }
  | { ok: false; reason: CompatCalcErrorReason; error?: unknown }

// PURE classification of the status-aware update result → a reason μุน can turn into copy. Kept out of the
// hook so it unit-tests without React: network (no response) → 'network'; any error status → 'system';
// a 2xx that still echoes an {error} body (legacy BE shape) → 'system'; clean 2xx → ok.
export function mapUpdateFriendResult(res: ApiResult): UpdateFriendResult {
  if (res.ok) {
    const data = res.data as { error?: unknown } | null
    if (data?.error) return { ok: false, reason: 'system', error: data.error }
    return { ok: true }
  }
  if (res.kind === 'network') return { ok: false, reason: 'network', error: res.error }
  return { ok: false, reason: 'system', error: res.data } // any error status → system (no quota on edit)
}
