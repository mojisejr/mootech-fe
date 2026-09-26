# FE-native register-login parity table

The parallel endpoint is `POST /api/auth/register-login-fe`. Nothing calls it in
production yet. The existing BE `POST /user/register-login` remains the live path
and the rollback path.

Every legacy behaviour below was read from `mootech-be`
`src/user/user.service.ts` (`registerOrLogin`) at commit `0705378`, not inferred
from the FE caller. Where the two differ, the row says so plainly: a row that
claims preservation means the observable response and the written rows match.

## Identity resolution

| Legacy branch | FE-native slice-1 behaviour | Difference / later gate |
|---|---|---|
| Existing Google or LINE provider identity, one `user_id` | Return that member and refresh the login/profile fields in one transaction | Preserved. Provider identity comes from the signed NextAuth session, never the request body. |
| Repeated provider rows that all point to the same `user_id` | Treat as the same member | Tolerated until slice 2 cleans duplicates and adds the unique index. |
| One provider identity points to several `user_id` values | `409`, no write, **no sign-out flag** | Never choose an account owner by row order. Manual recovery is owner-gated. |
| Provider row exists but its `user` row is gone | `409`, no write, **no sign-out flag** | Changed deliberately. Legacy returns `is_user_new: true` with every field null, which reads as success. The new path refuses the orphan explicitly so it cannot create or bind a second account silently. |
| First Google or LINE login | Create one UUID `user`, one provider row, referral code, and the legacy `log_activity(activity_id=1, point=20)` in one transaction | Preserved without calling BE, **except `is_info`** — see the response-drift table. |
| Matching email exists on another provider | Create a separate member; do not join by email | **Intentional change with a measured cost — see "The cost of no-join-by-email".** |

## Response field drift

These are the fields where the FE route's answer differs from the legacy one for
the same input. Nothing in `mootech-fe` reads `is_info` or `is_email` from this
response today — only the type in `constants/api/response-user.ts` mentions them
— so the drift is currently inert in the app and matters for rollback
compatibility and for any future reader.

| Field | Legacy | FE-native | Assessment |
|---|---|---|---|
| `is_info`, first login | Hardcoded `false`, even when the OAuth profile carried a name | `Boolean(name)`, so `true` for almost every Google login | **Owner decision 2026-09-23: keep the honest value.** `is_info: false` is the legacy "GO TO FORM" signal, so if a future caller routes on it, new Google members would skip the form the legacy path sends them to. Nothing reads it today; a future reader must be told this. |
| `is_email`, returning member | Hardcoded `true` on every returning branch, regardless of the stored email | `Boolean(member.email)` | **Owner decision 2026-09-23: keep the honest value.** A rollback flips it back, which the owner accepts: rollback is for genuine necessity, not routine. |
| `is_email`, first login | `email != ''` | `Boolean(member.email)` | Preserved. |
| `name`, `picture_url` absent | `''` | `''` | Preserved. Returning `null` here was a slice-1 defect: callers write these straight into a cookie, so a member saw the literal string `null`. |
| `email` | Not returned by `registerOrLogin` | Not returned | Preserved. |

## Failure semantics

`ok: false` is the flag both callers — `pages/index.tsx` and
`lib/auth/use-self-heal-identity.ts` — act on by clearing the member cookies and
calling `signOut`. The legacy route sets it only for a genuine identity
rejection. This route reserves it the same way.

| Condition | Status | `ok: false`? | Why |
|---|---|---|---|
| No signed NextAuth session, or a LINE profile subject that disagrees with `providerId` | `401` | Yes | No usable identity. **Open question for the owner: an ordinary expired session also lands here, so it takes the sign-out path. That is coherent, but it should be deliberate rather than inherited.** |
| Provider is neither Google nor LINE | `400` | Yes | The identity itself cannot be used; retrying the same session never succeeds. |
| Provider subject missing | `400` | Yes | Same. |
| Ambiguous identity (several `user_id`) or orphaned provider row | `409` | No | Manual recovery. A sign-out neither fixes it nor preserves the session support will need. |
| `refer_code` not a string | `400` | No | A caller-shape bug, not the member's identity. |
| Database or unknown fault | `500` | No | Retryable. Both callers treat a body with neither `ok: false` nor `user_id` as "do not wipe, let a later render retry". |

## Referral

| Legacy | FE-native | Difference |
|---|---|---|
| A non-empty `refer_code` triggers `checkReferCode` and `addFriend` during registration | The login proceeds; **no referral write is performed** | Intentional. Referral/friend/QI ownership belongs to another lane. Slice 1 originally answered `422` here, which was a defect: `pages/login/index.tsx` writes the `REFCODE_FGF` cookie from its `callback` query parameter, which **defaults to `/`**, so effectively every member carries a non-empty code and the flip would have signed the whole member base out. `/` is now read as "no referral". |

**Live upstream bug, unowned.** That `|| '/'` default in `pages/login/index.tsx`
line 42 makes the `else` branch that would write an empty `REFCODE_FGF`
unreachable. This lane does not touch that file — other lanes cross it — so the
bug stays live and is recorded here rather than silently worked around.

## LINE profile image

| Legacy | FE-native | Difference |
|---|---|---|
| On both first and returning LINE logins, copies the LINE image into object storage and saves the result to **`user.picture_url`** — the column the app reads | Refreshes `user.picture_url` with the **provider's own CDN URL**, on first and returning logins, for every provider. Nothing is copied into our storage | **Owner decision 2026-09-23: intentional change, gap closed.** The refresh behaviour is preserved; the storage copy is not, deliberately, so no storage of ours is consumed. An empty session image never blanks the stored one. |

Two consequences of holding the provider URL rather than a copy, stated so
nobody meets them as a surprise:

- **`user.picture_url` will hold mixed hosts.** Rows written before the flip
  point at Supabase Storage; rows written after point at
  `profile.line-scdn.net` or `lh3.googleusercontent.com`. Both are already
  listed in `next.config.mjs` `images.domains`, and `images.unoptimized` is
  true, so rendering is unaffected.
- **The image is now LINE's or Google's to keep alive.** If a provider rotates
  or expires an avatar URL, the stored one breaks, where a copy would not have.
  That is the price of not consuming storage, and it is accepted.
- The payment-lane CSP in `middleware.ts` is `img-src 'self' data:
  https://api.omise.co`, which allows no avatar host at all — including the
  Supabase one rows already use. So any avatar shown on a payment screen is
  already blocked today; this change neither causes nor worsens that. Not
  investigated further here.

Legacy refreshes `user.picture_url` only on its LINE-or-empty-email branch, so a
Google member with an email never had their avatar refreshed. This route
refreshes for every provider. **Declared deviation:** the fix is free once the
column is being written at all, and leaving Google avatars deliberately stale
would be the harder behaviour to justify.

**The storage is Supabase, not S3 — the names lie.** `downloadLineImageToS3`,
the `.Location` field and the `s3_key` key are legacy names kept deliberately so
the migration did not have to touch every consumer. `mootech-be`
`src/object-storage/object-storage.service.ts` is backed by Supabase Storage,
migrated in BE commit `2641c73` on 2026-06-17, which also copied the objects and
rewrote the stored URLs off both the S3 base and the `cdn.phoenix-stark.com`
CloudFront base (`scripts/phase3-backfill-urls.sql`). No file under `src/` uses
`aws-sdk`; only the unused dependency entry in `package.json` remains. Any
design here should assume Supabase Storage.

## Profile write scope

The legacy path's returning branch updates only `user_provider.email`
(`updateUserProvider(idToken, email, provider)`), plus `user.email` for non-LINE
with a non-empty email.

This route also refreshes `user_provider.name` and `user_provider.picture_url`
when the session carries them. **Declared deviation, not an accident.** An empty
incoming value never overwrites a stored one, via `COALESCE(NULLIF(...))`; and a
LINE session never sends an email at all, because `user_provider.email` is the
column `checkUserWithLine` branches on and blanking it on each LINE login would
quietly change that branch. Exact legacy parity remains a two-line change if the
owner prefers it.

## Provider spelling

Normalised **per provider, to whatever the live writer already stores**: Google
lower case (`google`), LINE upper case (`LINE`). Not one case for both.

- Four backend queries match a **stored** `LINE` exactly — the new-member cohort
  job, the paying-LINE-member audience, `checkUserWithLine`, and a migration
  idempotency check. Lower-casing LINE would make all four return zero rows
  **without raising an error**.
- No query anywhere reads a stored `GOOGLE`; the backend's `PROVIDER.GOOGLE`
  constant is declared and never used. Lower-casing Google is free.
- Matching the live spelling means no production file has to change in the same
  deploy.

Every provider comparison in the store is case-insensitive (`lower(provider)`,
`provider.toLowerCase()`), so a future spelling change cannot silently kill a
branch. The one branch nothing else reached — the `user`-table email write — is
covered directly by `scripts/register-login-fe-db.test.ts`.

## The cost of no-join-by-email

Refusing to join accounts by email is the right default: an OAuth email is
profile data, not proof that two provider identities belong to one member.
It is not free, and the price is paid by a specific, measured group.

Today the legacy path's email-discovery branch is the only thing that reunites a
returning member whose provider identity can no longer be matched. The FE route
drops that branch, so such a member silently receives a **new, empty account**
instead of their own.

Measured on production, read-only, 2026-09-23 — **a planning checkpoint that
slice 2 must re-measure, never migration input**:

- 657 `user_provider` rows carry a blank provider and hold a `ya29...` Google
  **access token** in `id_token` — a historical bug that stored a short-lived
  token as the identity. Those identities can never match by subject again.
- 98 members have only rows of that kind. 90 of them hold a computed chart, none
  hold a subscription, and none has signed in since 1 August.

Owner decision (2026-09-23): those rows are deleted and recovery for the members
behind them is routed to support, not to an email-adoption path. Collision
recovery ships as manual support first; an audited automatic merge is a later
decision, taken only if manual volume justifies it.

## Concurrency

The `user_provider` table has no unique index on the provider identity yet, so
every FE writer takes the same transaction-scoped advisory lock
(`pg_advisory_xact_lock`) before reading.

`scripts/register-login-fe-db.test.ts` proves this against a real Postgres:
eight concurrent first logins for one identity leave exactly one member and one
provider mapping, all callers see the same `user_id`, and exactly one reports
`is_user_new`. It carries a **negative control** that runs the identical race
with the lock removed and requires the duplicate to appear — without it the main
assertion passes even with no lock at all, which is how the original two-caller
version of this proof passed while proving nothing.

**What it does not prove:** it runs over a direct connection to a local
Postgres. Production reaches Supabase through the transaction pooler.
`pg_advisory_xact_lock` is transaction-scoped and so is safe there in principle,
but this file is not evidence about the pooler. Slice 2's unique index is what
makes the guarantee structural rather than cooperative.

The file is skipped unless `TEST_DATABASE_URL` is set:

```
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5433/mumate_test \
  npx vitest run scripts/register-login-fe-db.test.ts
```

---

The provider-independent MuMate identifier remains `user.user_id`. The provider
subject is only a credential attached through `user_provider`; the current
`id_token` column name is legacy terminology and contains the stable provider
account subject, not a short-lived OAuth token.
