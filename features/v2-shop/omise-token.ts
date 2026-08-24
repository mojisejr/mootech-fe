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
    cb: (status: number, res: { id?: string; message?: string }) => void,
  ) => void
}

export class OmiseKeyMissingError extends Error {}

/** Resolve the v2 key. Throws LOUDLY rather than tokenizing with whatever key happens to be installed. */
export function v2OmiseKey(env: Record<string, string | undefined> = process.env as Record<string, string | undefined>): string {
  const k = env[V2_OMISE_KEY_ENV]
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
        else reject(new Error(res.message ?? `omise token failed (${status})`))
      },
    )
  })
}
