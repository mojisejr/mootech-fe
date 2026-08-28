// features/v2-shop/omise-token.ts — turn card fields into an Omise token, with the v2 key (mootech-fe#363).
//
// 🔴 THE KEY IS SET IMMEDIATELY BEFORE createToken, NOT ON MOUNT — and that is a correctness decision, not a
// style one. `window.Omise` is a SINGLETON loaded once for the whole app (pages/_document.tsx:19), and
// `setPublicKey` mutates it globally. v1's payment pages set it to the LIVE key on their own mount
// (pages/payment/creditcard/index.tsx:86 and four siblings). Two pages in one app, one global, and a
// client-side navigation between them leaves whichever ran last in charge.
//
// Setting it on OUR mount would be correct only until the user visits a v1 page and comes back without a
// full reload. Setting it one line before the call makes the key right at the only moment it matters, in
// every navigation order — and it costs nothing.
//
// 🔴 AND IT MUST BE THE _V2 KEY. `NEXT_PUBLIC_OMISE_KEY` is v1's LIVE key, in use by five files that take
// real money. If v2 borrowed it and anyone flipped it to a test key to try this screen, v1 would tokenize
// against test while mootech-be holds live — real customers would stop being able to pay, silently.
// (There is a third name, NEXT_STATIC_OMISE_PUBLIC_KEY, which nothing reads: see mootech-fe#395.)
export const V2_OMISE_KEY_ENV = 'NEXT_PUBLIC_OMISE_KEY_V2'

export type CardFields = { name: string; number: string; expMonth: string; expYear: string; cvc: string }

type OmiseGlobal = {
  setPublicKey: (k: string) => void
  createToken: (
    kind: 'card',
    fields: Record<string, string>,
    cb: (status: number, res: { id?: string; message?: string; code?: string }) => void,
  ) => void
}

export class OmiseKeyMissingError extends Error {}

/**
 * Omise's own machine-readable reason for refusing to tokenise, carried out with the Error.
 *
 * 🔴 IT WAS ALREADY BEING THROWN AWAY. `createToken` handed back `res.message` and nothing else, and
 * pages/v2/shop/checkout.tsx caught it with a bare `catch {}`. So every refusal — a mistyped number, an
 * expired card, AND our own key being wrong — arrived at the screen as the same nothing, and the screen
 * said the BANK declined. The information needed to tell those apart existed the whole time
 * (mootech-fe#492).
 */
export class OmiseTokenError extends Error {
  /** e.g. 'invalid_card' · 'expired_card' · 'invalid_security_code' · 'authentication_failure'. */
  readonly code: string | null
  constructor(message: string, code: string | null) {
    super(message)
    this.name = 'OmiseTokenError'
    this.code = code
  }
}

/**
 * Resolve the v2 key. Throws LOUDLY rather than tokenizing with whatever key happens to be installed.
 *
 * 🔴 THE READ MUST STAY A LITERAL `process.env.NEXT_PUBLIC_OMISE_KEY_V2` — mootech-fe#432.
 * This function used to take `env = process.env` and read `env[V2_OMISE_KEY_ENV]`. That is invisible to
 * the bundler: Next inlines a browser value ONLY where the source literally says `process.env.NAME`.
 * Through an alias there is nothing to substitute, so the compiled chunk kept the NAME as a string and
 * shipped no value — `undefined` in every browser, on every deploy, no matter what Vercel had set.
 * Verified: `NEXT_PUBLIC_OMISE_KEY_V2=pkey_test_PROOF123 npm run build` → 0 files under .next/static
 * contained that value, while the checkout chunk contained the literal "NEXT_PUBLIC_OMISE_KEY_V2".
 * Every card payment on /v2 threw OmiseKeyMissingError before a request ever left the browser.
 *
 * 🔑 Same root as the guard hole ตู๋ found in PR #425 — an alias hides the read from a tool. There it
 * was our own drift guard and the cost was a green that guarded nothing. Here the tool was the compiler
 * and the cost was a feature that could not work at all.
 *
 * `override` replaces the old injectable `env` param: tests still inject, and the production path is a
 * shape the bundler can see. Two guards keep it that way:
 *   scripts/public-env-inlinable.test.ts   — no NEXT_PUBLIC_* may be read through a subscript, repo-wide
 *   scripts/check-omise-key-inlined.sh     — postbuild: the VALUE must actually appear in .next/static
 */
export function v2OmiseKey(override?: string): string {
  const k = override ?? process.env.NEXT_PUBLIC_OMISE_KEY_V2
  // ❌ never fall back to NEXT_PUBLIC_OMISE_KEY: a missing v2 key must stop the screen, not quietly charge
  //    through v1's live credentials.
  if (!k) throw new OmiseKeyMissingError(`${V2_OMISE_KEY_ENV} is not set`)
  return k
}

export async function createCardToken(fields: CardFields, omise?: OmiseGlobal): Promise<string> {
  const O = omise ?? (globalThis as unknown as { Omise?: OmiseGlobal }).Omise
  if (!O) throw new Error('omise.js is not loaded')
  O.setPublicKey(v2OmiseKey()) // ← the line the header is about
  return new Promise((resolve, reject) => {
    O.createToken(
      'card',
      {
        name: fields.name,
        number: fields.number.replace(/\s+/g, ''),
        expiration_month: fields.expMonth,
        expiration_year: fields.expYear,
        security_code: fields.cvc,
      },
      (status, res) => {
        if (status === 200 && res.id) resolve(res.id)
        // The code is what lets the screen tell "your card" apart from "our key". Null when Omise sends
        // none — and null must be treated as OUR fault, not the buyer's (see pay-destination.ts).
        else reject(new OmiseTokenError(res.message ?? `omise token failed (${status})`, res.code ?? null))
      },
    )
  })
}
