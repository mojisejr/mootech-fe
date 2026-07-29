// features/v2-service/compatibility-api.ts — the v2 create-friend ADAPTER contract (PURE, no v1 import).
// 🔴 SLICE RULE (ฟีม): v2 wraps v1, never rewrites it. This file owns the *mapping* from the Figma form to
// v1's positional signature (the part worth unit-testing); the actual v1 call — MemberWithFriendCreateApi —
// is made in useCompatibility (a client module) so this file stays free of the Next-runtime `getConfig()`
// that the constants/api modules pull in at import, and can run under plain `tsx` in the CI gate.
// done-condition #6: importing/mapping never edits constants/api/* or pages/matching/* — `git diff` stays clean.

// 🔶 THE DOCUMENTED GAP (done-condition #13). v1's create takes 8 positional args including `surname` and
// `gender`; the Figma add-friend form (636:18533) has NEITHER field. FROZEN plan ruling: Figma is the source
// of truth, send documented defaults, DO NOT go silent. So Slice 1 sends:
//   surname = ''       (empty — the form collects no surname)
//   gender  = 'MALE'   (v1's OWN default in modal-add-freind.tsx line 93; NOT a fabricated value)
// Both are recorded in harness/compatibility.verify-evidence.md. When the form gains the fields (or ฟีม rules
// on a default gender), change these two constants — every call already flows through here.
export const COMPAT_FRIEND_DEFAULTS = {
  surname: '',
  gender: 'MALE' as const,
}

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
    COMPAT_FRIEND_DEFAULTS.surname, // gap: form has no surname → documented ''
    form.time,
    COMPAT_FRIEND_DEFAULTS.gender, // gap: form has no gender → documented 'MALE' (v1's own default)
    form.isRememberTime,
    form.imageProfile,
  ]
}
