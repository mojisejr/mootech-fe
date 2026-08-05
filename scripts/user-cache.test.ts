// Unit gate for the v2 user-fetch dedup cache (goo · G-0c identity). Plain tsx + node:assert (ci
// `scripts/*.test.ts`). This is the safety core of the round's heaviest PR — cross-user data must NEVER
// bleed, so the tests are adversarial, not confirmatory.
//
// ANCHOR: scripts/user-cache.test.ts#g0c-user-cache-dedup
// Bug-classes this owns:
//  1. DOUBLE FETCH (#165) — two hooks on one page firing UserGetById twice for one identity. The in-flight
//     map must make concurrent callers share ONE request.
//  2. CROSS-USER BLEED — a change of userId must NEVER serve the previous person's row (money/privacy). The
//     map is keyed by userId and nothing persists past settle, so B never sees A's row.
//  3. CACHED FAILURE — a failed fetch must NOT be remembered; the next call must retry (else everyone after
//     a blip is stuck erroring until reload).
//  4. STALE PERSISTENCE — there is no stored row at all, so a later call always re-fetches fresh (a user who
//     just paid is never stuck on a stale free gate). Proven by "later call refetches".
import assert from 'node:assert'
import { getUser, clearUserCache, _inflightSize } from '../lib/v2/user-cache'

let pass = 0
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`)
  pass += 1
}

async function run() {
  // ── (1) DEDUP: two concurrent callers for the SAME userId → the fetcher runs ONCE, both get one row ──
  let calls = 0
  const countingFetcher = async (uid: string) => {
    calls += 1
    return { user_id: uid, tag: 'v1' }
  }
  const [a, b] = await Promise.all([getUser('u1', countingFetcher), getUser('u1', countingFetcher)])
  ok('dedup: concurrent same-userId → fetcher called ONCE', calls === 1)
  ok('dedup: both concurrent callers get the SAME row object', a === b && (a as { user_id: string }).user_id === 'u1')
  ok('dedup: in-flight entry cleared after settle', _inflightSize() === 0)

  // ── (4) NO STALE: a LATER call re-fetches (no persistent cache) → matches today's per-mount freshness ──
  await getUser('u1', countingFetcher)
  ok('no-stale: a later call re-fetches (not served from a persistent cache)', calls === 2)

  // ── (2) CROSS-USER: changing userId must return the NEW person's row, never the old one ──
  const rowA = (await getUser('A', async (u) => ({ user_id: u, tag: 'A' }))) as { user_id: string; tag: string }
  const rowB = (await getUser('B', async (u) => ({ user_id: u, tag: 'B' }))) as { user_id: string; tag: string }
  ok('cross-user: getUser(B) returns B, never A', rowB.user_id === 'B' && rowB.tag === 'B')
  ok('cross-user: A was itself, unrelated', rowA.user_id === 'A' && rowA.tag === 'A')

  // keyed, not one global slot: two DIFFERENT users concurrently → TWO fetches, each its own row
  let diff = 0
  const diffFetcher = async (u: string) => {
    diff += 1
    return { user_id: u }
  }
  const [x, y] = await Promise.all([getUser('X', diffFetcher), getUser('Y', diffFetcher)])
  ok('keyed: two different users concurrent → TWO fetches (no shared slot)',
    diff === 2 && (x as { user_id: string }).user_id === 'X' && (y as { user_id: string }).user_id === 'Y')

  // ── (3) FAILURE NOT CACHED: a reject must be retryable, not remembered ──
  let attempts = 0
  const flaky = async (u: string) => {
    attempts += 1
    if (attempts === 1) throw new Error('network blip')
    return { user_id: u }
  }
  let threw = false
  try {
    await getUser('Z', flaky)
  } catch {
    threw = true
  }
  ok('failure: rejection propagates to the caller', threw)
  const retried = (await getUser('Z', flaky)) as { user_id: string }
  ok('failure NOT cached: the next call retries the fetcher', attempts === 2 && retried.user_id === 'Z')

  // concurrent callers on a FAILING fetch: one request, BOTH rejected (shared in-flight, not two)
  let rc = 0
  const rejecting = async () => {
    rc += 1
    throw new Error('boom')
  }
  const settled = await Promise.allSettled([getUser('R', rejecting), getUser('R', rejecting)])
  ok('failure: concurrent callers share ONE failing request, both reject',
    rc === 1 && settled.every((s) => s.status === 'rejected'))
  ok('failure: the failed in-flight entry is cleared (retryable)', _inflightSize() === 0)

  // ── clearUserCache (logout): abandons any in-flight fetch ──
  const never: (u: string) => Promise<unknown> = () => new Promise(() => {}) // never settles
  void getUser('N', never)
  ok('logout: an in-flight fetch is registered', _inflightSize() === 1)
  clearUserCache()
  ok('logout: clearUserCache empties the in-flight map', _inflightSize() === 0)

  console.log(`✅ user-cache.test.ts — ${pass} assertions passed`)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
